import json
import logging
import re
from typing import Any, Dict, List, Optional

from backend.app.ai_engine.featherless_client import (
    FeatherlessError,
    featherless_client,
)
from backend.app.ai_engine.prompt_builder import build_assessment_prompts
from backend.app.schemas.assessment import (
    GeneratedAssessmentSchema,
    GeneratedQuestionSchema,
)
from backend.app.validation.dsa_whitelist import (
    extract_claimed_dsa_topics,
    validate_question_dsa_whitelist,
)
from backend.app.validation.question_validator import (
    QuestionValidationError,
    validate_generated_assessment,
)

logger = logging.getLogger(__name__)


def _extract_json_from_text(raw_text: str) -> Dict[str, Any]:
    """
    Strips markdown code blocks, backticks, and extraneous preamble to extract pure JSON.
    """
    clean = raw_text.strip()
    start_idx = clean.find("{")
    end_idx = clean.rfind("}")
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        clean = clean[start_idx : end_idx + 1]
    else:
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", clean)
        if match:
            clean = match.group(1).strip()

    return json.loads(clean)


def generate_portfolio_calibrated_fallback(
    portfolio_data: Dict[str, Any],
    target_role: str = "Software Engineer",
    difficulty_preference: str = "medium",
    question_count: int = 3,
) -> GeneratedAssessmentSchema:
    """
    Deterministic adaptive synthesizer grounded in candidate's verified portfolio.
    Guarantees personalized, solvable questions when external AI API is unreachable or times out.
    Strictly restricts DSA questions to the candidate's claimed DSA topics.
    """
    raw_langs = portfolio_data.get("primary_languages") or portfolio_data.get("primaryLanguages") or ["Python"]
    langs = [l.strip().lower() for l in raw_langs if l and l.strip()]
    if not langs:
        langs = ["python"]

    frameworks = [f.strip().lower() for f in (portfolio_data.get("frameworks") or []) if f and f.strip()]
    projects = portfolio_data.get("projects") or []
    primary_lang = langs[0].capitalize()
    tier = difficulty_preference.lower()

    # Extract claimed DSA topics
    claimed_dsa = extract_claimed_dsa_topics(portfolio_data)
    has_linked_lists = any("linked list" in t.lower() for t in claimed_dsa)
    has_sliding_window = any("sliding window" in t.lower() for t in claimed_dsa)
    has_hash_tables = any("hash" in t.lower() for t in claimed_dsa)

    # Question 1: DSA Question calibrated strictly to claimed topics
    if has_linked_lists and not has_sliding_window:
        q1_title = f"Linked List Node Compactor ({primary_lang})"
        q1_topic = "Linked Lists"
        q1_domain = "Linked Lists"
        q1_desc = (
            "Given a singly-linked list represented as an array of integer values `head`, "
            "implement `compact_nodes(values)` that removes all consecutive duplicate nodes. "
            "Returns the compressed list of integer node values."
        )
        q1_starter = {
            "python": (
                "def compact_nodes(values: list[int]) -> list[int]:\n"
                "    # Return values with consecutive duplicates removed\n"
                "    pass\n"
            )
        }
        q1_ref = (
            "def compact_nodes(values: list[int]) -> list[int]:\n"
            "    if not values:\n"
            "        return []\n"
            "    res = [values[0]]\n"
            "    for v in values[1:]:\n"
            "        if v != res[-1]:\n"
            "            res.append(v)\n"
            "    return res\n"
        )
        q1_examples = [
            {"test_case_id": "tc_pub_1", "input": "[1, 1, 2, 3, 3]", "expected_output": "[1, 2, 3]", "explanation": "Consecutive duplicates are merged."},
            {"test_case_id": "tc_pub_2", "input": "[4, 4, 4]", "expected_output": "[4]", "explanation": "All identical consecutive elements become one."},
        ]
        q1_hidden = [
            {"test_case_id": "tc_hid_1", "input": "[1, 2, 3, 4]", "expected_output": "[1, 2, 3, 4]", "weight": 1.0},
            {"test_case_id": "tc_hid_2", "input": "[]", "expected_output": "[]", "weight": 1.0},
            {"test_case_id": "tc_hid_3", "input": "[7, 7, 8, 8, 7]", "expected_output": "[7, 8, 7]", "weight": 1.5},
        ]
    elif has_sliding_window:
        q1_title = f"Adaptive Sliding Window & Hash Indexer ({primary_lang})"
        q1_topic = "Sliding Window"
        q1_domain = "Sliding Window"
        q1_desc = (
            f"Given an array of integer request timestamps and a sliding window duration `k` milliseconds, "
            f"implement an optimal function `max_throughput(timestamps, k)` that returns the maximum number of requests "
            f"received within any contiguous sub-window of length at most `k`."
        )
        q1_starter = {
            "python": (
                "def max_throughput(timestamps: list[int], k: int) -> int:\n"
                "    # Implement your O(N) sliding window solution here\n"
                "    pass\n"
            )
        }
        q1_ref = (
            "def max_throughput(timestamps: list[int], k: int) -> int:\n"
            "    if not timestamps:\n"
            "        return 0\n"
            "    left = 0\n"
            "    max_count = 0\n"
            "    for right in range(len(timestamps)):\n"
            "        while timestamps[right] - timestamps[left] > k:\n"
            "            left += 1\n"
            "        max_count = max(max_count, right - left + 1)\n"
            "    return max_count\n"
        )
        q1_examples = [
            {"test_case_id": "tc_pub_1", "input": "[10, 20, 25, 30, 45, 50], 15", "expected_output": "3", "explanation": "Window [10, 25] contains 3 timestamps."},
            {"test_case_id": "tc_pub_2", "input": "[100, 200, 300], 50", "expected_output": "1", "explanation": "Timestamps are >50 apart."},
        ]
        q1_hidden = [
            {"test_case_id": "tc_hid_1", "input": "[1, 2, 3, 4, 5], 3", "expected_output": "4", "weight": 1.0},
            {"test_case_id": "tc_hid_2", "input": "[100], 10", "expected_output": "1", "weight": 1.0},
            {"test_case_id": "tc_hid_3", "input": "[5, 5, 5, 5, 5], 0", "expected_output": "5", "weight": 1.5},
        ]
    else:
        # Default for Arrays / Strings
        q1_title = f"Sequential Array In-Place Compactor ({primary_lang})"
        q1_topic = "Arrays"
        q1_domain = "Arrays"
        q1_desc = (
            "Given an array of integer tokens `nums` and an unwanted value `val`, "
            "implement `filter_array(nums, val)` that returns a new array with all occurrences of `val` removed, "
            "preserving the relative order of the remaining elements."
        )
        q1_starter = {
            "python": (
                "def filter_array(nums: list[int], val: int) -> list[int]:\n"
                "    # Return array without val preserving original order\n"
                "    pass\n"
            )
        }
        q1_ref = (
            "def filter_array(nums: list[int], val: int) -> list[int]:\n"
            "    return [x for x in nums if x != val]\n"
        )
        q1_examples = [
            {"test_case_id": "tc_pub_1", "input": "[3, 2, 2, 3], 3", "expected_output": "[2, 2]", "explanation": "3 is removed."},
            {"test_case_id": "tc_pub_2", "input": "[0, 1, 2, 2, 3, 0, 4, 2], 2", "expected_output": "[0, 1, 3, 0, 4]", "explanation": "2 is removed."},
        ]
        q1_hidden = [
            {"test_case_id": "tc_hid_1", "input": "[1, 1, 1], 1", "expected_output": "[]", "weight": 1.0},
            {"test_case_id": "tc_hid_2", "input": "[1, 2, 3], 4", "expected_output": "[1, 2, 3]", "weight": 1.0},
            {"test_case_id": "tc_hid_3", "input": "[], 5", "expected_output": "[]", "weight": 1.5},
        ]

    q1 = GeneratedQuestionSchema(
        question_id="q1",
        order_index=1,
        title=q1_title,
        description=q1_desc,
        difficulty=difficulty_preference,
        topic=q1_topic,
        domain=q1_domain,
        target_skill=q1_topic,
        constraints=[
            "Time limit: 2000ms",
            "Memory limit: 256MB",
            "Inputs are valid lists",
        ],
        examples=q1_examples,
        allowed_languages=raw_langs,
        starter_code=q1_starter,
        hidden_test_cases=q1_hidden,
        reference_solution=q1_ref,
        time_limit_seconds=2.0,
        memory_limit_mb=256,
    )

    # Question 2: Framework & System Architecture challenge
    has_fastapi = "fastapi" in frameworks or "python" in langs
    if has_fastapi:
        q2_title = "High-Concurrency Token Bucket Rate Limiter"
        q2_topic = "Async Backend Architecture & Concurrency"
        q2_domain = "Backend Development"
        q2_skill = "FastAPI / Python Asyncio"
        q2_desc = (
            "Design a thread-safe `TokenBucket` class capable of handling concurrent bursts. "
            "The bucket initializes with a maximum `capacity` (float) and a `refill_rate` (tokens per second). "
            "Implement `consume(tokens: float = 1.0) -> bool` which deducts tokens if available based on elapsed time, "
            "returning True on success and False when insufficient tokens exist."
        )
        q2_starter = {
            "python": (
                "class TokenBucket:\n"
                "    def __init__(self, capacity: float, refill_rate: float):\n"
                "        self.capacity = capacity\n"
                "        self.refill_rate = refill_rate\n"
                "        self.tokens = capacity\n"
                "\n"
                "    def consume(self, tokens: float = 1.0) -> bool:\n"
                "        pass\n"
            )
        }
        q2_ref = (
            "class TokenBucket:\n"
            "    def __init__(self, capacity: float, refill_rate: float):\n"
            "        self.capacity = float(capacity)\n"
            "        self.refill_rate = float(refill_rate)\n"
            "        self.tokens = float(capacity)\n"
            "\n"
            "    def consume(self, tokens: float = 1.0) -> bool:\n"
            "        if self.tokens >= tokens:\n"
            "            self.tokens -= tokens\n"
            "            return True\n"
            "        return False\n"
        )
    else:
        q2_title = "Thread-Safe Event Ingestion Buffer"
        q2_topic = "Distributed Systems & Buffering"
        q2_domain = "Backend Development"
        q2_skill = f"{primary_lang} / Concurrency"
        q2_desc = (
            "Implement an in-memory batch buffer `EventBuffer` with a maximum batch size `batch_size`. "
            "Implement `push(event_id: str) -> list[str]` which appends the event. "
            "If adding the event causes buffer length to reach `batch_size`, flush and return all buffered events. "
            "Otherwise, return an empty list."
        )
        q2_starter = {
            "python": (
                "class EventBuffer:\n"
                "    def __init__(self, batch_size: int):\n"
                "        self.batch_size = batch_size\n"
                "        self.buffer = []\n"
                "\n"
                "    def push(self, event_id: str) -> list[str]:\n"
                "        pass\n"
            )
        }
        q2_ref = (
            "class EventBuffer:\n"
            "    def __init__(self, batch_size: int):\n"
            "        self.batch_size = batch_size\n"
            "        self.buffer = []\n"
            "\n"
            "    def push(self, event_id: str) -> list[str]:\n"
            "        self.buffer.append(event_id)\n"
            "        if len(self.buffer) >= self.batch_size:\n"
            "            flushed = list(self.buffer)\n"
            "            self.buffer.clear()\n"
            "            return flushed\n"
            "        return []\n"
        )

    q2 = GeneratedQuestionSchema(
        question_id="q2",
        order_index=2,
        title=q2_title,
        description=q2_desc,
        difficulty=difficulty_preference,
        topic=q2_topic,
        domain=q2_domain,
        target_skill=q2_skill,
        constraints=[
            "Time limit: 2000ms",
            "Memory limit: 256MB",
            "Tokens and rates are positive non-zero values",
        ],
        examples=[
            {
                "test_case_id": "tc_pub_1",
                "input": "bucket = TokenBucket(10, 1.0); bucket.consume(5); bucket.consume(6)",
                "expected_output": "True, False",
                "explanation": "Consuming 5 succeeds; consuming 6 fails as only 5 are available.",
            }
        ],
        allowed_languages=raw_langs,
        starter_code=q2_starter,
        hidden_test_cases=[
            {
                "test_case_id": "tc_hid_1",
                "input": "bucket = TokenBucket(5, 0.5); bucket.consume(5); bucket.consume(1)",
                "expected_output": "True, False",
                "weight": 1.0,
            }
        ],
        reference_solution=q2_ref,
        time_limit_seconds=2.0,
        memory_limit_mb=256,
    )

    # Question 3: Domain & Portfolio Project Challenge
    proj_name = "Portfolio System"
    if projects and isinstance(projects[0], dict) and projects[0].get("title"):
        proj_name = projects[0]["title"]

    q3 = GeneratedQuestionSchema(
        question_id="q3",
        order_index=3,
        title=f"Data Pipeline Deduplication Engine ({proj_name})",
        description=(
            f"Inspired by the candidate's project `{proj_name}`, implement an idempotent event deduplication "
            f"function `deduplicate_records(records, key_field)`. The function accepts a list of dictionary records "
            f"and preserves only the earliest record observed for each unique `key_field`. "
            f"Maintains original relative ordering for first occurrences."
        ),
        difficulty=difficulty_preference,
        topic="System Optimization & Data Integrity",
        domain=f"Project: {proj_name}",
        target_skill=claimed_dsa[0] if claimed_dsa else "Arrays",
        constraints=[
            "Time limit: 2000ms",
            "Memory limit: 256MB",
            "1 <= len(records) <= 50,000",
        ],
        examples=[
            {
                "test_case_id": "tc_pub_1",
                "input": "[{'id': 'A', 'v': 1}, {'id': 'B', 'v': 2}, {'id': 'A', 'v': 3}], 'id'",
                "expected_output": "[{'id': 'A', 'v': 1}, {'id': 'B', 'v': 2}]",
                "explanation": "Second occurrence of id 'A' is discarded to maintain idempotency.",
            }
        ],
        allowed_languages=raw_langs,
        starter_code={
            "python": (
                "def deduplicate_records(records: list[dict], key_field: str) -> list[dict]:\n"
                "    # Return unique records preserving first occurrence order\n"
                "    pass\n"
            )
        },
        hidden_test_cases=[
            {  
                "test_case_id": "tc_hid_1",
                "input": "[{'x': 1}, {'x': 1}, {'x': 1}], 'x'",
                "expected_output": "[{'x': 1}]",
                "weight": 1.0,
            }
        ],
        reference_solution=(
            "def deduplicate_records(records: list[dict], key_field: str) -> list[dict]:\n"
            "    seen = set()\n"
            "    result = []\n"
            "    for r in records:\n"
            "        k = r.get(key_field)\n"
            "        if k not in seen:\n"
            "            seen.add(k)\n"
            "            result.append(r)\n"
            "    return result\n"
        ),
        time_limit_seconds=2.0,
        memory_limit_mb=256,
    )

    questions = [q1, q2, q3][:question_count]

    return GeneratedAssessmentSchema(
        title=f"{target_role} Personalized Technical Assessment",
        duration_minutes=60,
        difficulty=difficulty_preference,
        target_role=target_role,
        questions=questions,
    )


class QuestionGenerator:
    """
    Orchestrates prompt building, Featherless AI invocation, Pydantic schema validation,
    strict DSA whitelist verification, and adaptive fallback synthesis.
    """

    def __init__(self, client=None):
        self.client = client or featherless_client

    def generate_assessment(
        self,
        portfolio_data: Dict[str, Any],
        target_role: str = "Software Engineer",
        difficulty_preference: str = "medium",
        question_count: int = 3,
    ) -> GeneratedAssessmentSchema:
        """
        Generates a validated personalized assessment grounded in candidate portfolio.
        Employs AI with automatic retry, then falls back to calibrated adaptive synthesis if AI is unavailable.
        Strictly enforces that DSA questions belong to the candidate's claimed DSA whitelist.
        """
        # Validate portfolio has substance
        langs = portfolio_data.get("primary_languages") or portfolio_data.get("primaryLanguages") or []
        clean_langs = [l for l in langs if l and l.strip()]
        if not clean_langs:
            raise ValueError("Portfolio must contain at least one primary programming language.")

        claimed_dsa_topics = extract_claimed_dsa_topics(portfolio_data)

        prompts = build_assessment_prompts(
            portfolio_data=portfolio_data,
            target_role=target_role,
            difficulty_preference=difficulty_preference,
            question_count=question_count,
        )

        # 1. Attempt Featherless AI generation
        try:
            logger.info("Requesting personalized assessment from Featherless AI...")
            raw_response = self.client.chat_completion(
                messages=prompts,
                temperature=0.2,
                max_tokens=3500,
            )

            choices = raw_response.get("choices")
            if not choices or not isinstance(choices, list) or len(choices) == 0:
                raise QuestionValidationError("Featherless AI returned empty choices list.")

            content = choices[0].get("message", {}).get("content", "")
            if not content:
                raise QuestionValidationError("Featherless AI returned empty message content.")

            parsed_json = _extract_json_from_text(content)
            assessment_model = GeneratedAssessmentSchema(**parsed_json)

            # Enforce zero-trust validation pipeline + DSA whitelist
            validate_generated_assessment(
                assessment=assessment_model,
                claimed_dsa_topics=claimed_dsa_topics,
            )
            logger.info("Successfully generated and validated assessment via Featherless AI.")
            return assessment_model

        except (FeatherlessError, json.JSONDecodeError, QuestionValidationError, ValueError) as exc:
            logger.warning(
                "Featherless AI generation failed (%s: %s). Activating portfolio-calibrated adaptive synthesizer fallback.",
                type(exc).__name__,
                exc,
            )
            fallback_assessment = generate_portfolio_calibrated_fallback(
                portfolio_data=portfolio_data,
                target_role=target_role,
                difficulty_preference=difficulty_preference,
                question_count=question_count,
            )
            # Enforce zero-trust validation pipeline + DSA whitelist on fallback
            validate_generated_assessment(
                assessment=fallback_assessment,
                claimed_dsa_topics=claimed_dsa_topics,
            )
            return fallback_assessment


# Global singleton
question_generator = QuestionGenerator()
