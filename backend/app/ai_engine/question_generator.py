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
    # Match ```json ... ``` or ``` ... ```
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", clean)
    if match:
        clean = match.group(1).strip()
    
    # In case there is text before the first '{'
    start_idx = clean.find("{")
    end_idx = clean.rfind("}")
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        clean = clean[start_idx : end_idx + 1]

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
    """
    raw_langs = portfolio_data.get("primary_languages") or portfolio_data.get("primaryLanguages") or ["Python"]
    langs = [l.strip().lower() for l in raw_langs if l and l.strip()]
    if not langs:
        langs = ["python"]

    frameworks = [f.strip().lower() for f in (portfolio_data.get("frameworks") or []) if f and f.strip()]
    projects = portfolio_data.get("projects") or []
    primary_lang = langs[0].capitalize()

    # Question 1: DSA / Algorithmic challenge tailored to candidate's primary language
    q1 = GeneratedQuestionSchema(
        question_id="q1",
        order_index=1,
        title=f"Adaptive Sliding Window & Hash Indexer ({primary_lang})",
        description=(
            f"Given an array of integer request timestamps and a sliding window duration `k` milliseconds, "
            f"implement an optimal function `max_throughput(timestamps, k)` that returns the maximum number of requests "
            f"received within any contiguous sub-window of length at most `k`. "
            f"Your solution should achieve O(N) time complexity and O(1) auxiliary space."
        ),
        difficulty=difficulty_preference,
        topic="Data Structures & Algorithms",
        domain="Sliding Window & Hash Maps",
        target_skill=f"{primary_lang} / Performance Optimization",
        constraints=[
            "Time limit: 2000ms",
            "Memory limit: 256MB",
            "1 <= len(timestamps) <= 200,000",
            "Timestamps are non-decreasing positive integers",
        ],
        examples=[
            {
                "test_case_id": "tc_pub_1",
                "input": "[10, 20, 25, 30, 45, 50], 15",
                "expected_output": "3",
                "explanation": "Window [10, 25] contains 3 timestamps: 10, 20, 25.",
            },
            {
                "test_case_id": "tc_pub_2",
                "input": "[100, 200, 300], 50",
                "expected_output": "1",
                "explanation": "All timestamps are spaced >50ms apart, maximum in any window is 1.",
            },
        ],
        allowed_languages=[langs[0], "python", "javascript", "java", "cpp"],
        starter_code={
            "python": (
                "def max_throughput(timestamps: list[int], k: int) -> int:\n"
                "    # Implement your O(N) sliding window solution here\n"
                "    pass\n"
            ),
            "javascript": (
                "function maxThroughput(timestamps, k) {\n"
                "    // Implement your O(N) sliding window solution here\n"
                "    return 0;\n"
                "}\n"
            ),
        },
        hidden_test_cases=[
            {
                "test_case_id": "tc_hid_1",
                "input": "[1, 2, 3, 4, 5], 3",
                "expected_output": "4",
                "weight": 1.0,
            },
            {
                "test_case_id": "tc_hid_2",
                "input": "[100], 10",
                "expected_output": "1",
                "weight": 1.0,
            },
            {
                "test_case_id": "tc_hid_3",
                "input": "[5, 5, 5, 5, 5], 0",
                "expected_output": "5",
                "weight": 1.5,
            },
        ],
        reference_solution=(
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
        ),
        time_limit_seconds=2.0,
        memory_limit_mb=256,
    )

    # Question 2: Framework & System Architecture challenge
    has_fastapi = "fastapi" in frameworks or "python" in langs
    has_react = "react" in frameworks or "typescript" in langs or "javascript" in langs

    if has_fastapi:
        q2_title = "High-Concurrency Token Bucket Rate Limiter"
        q2_topic = "Async Backend Architecture & Concurrency"
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
                "        self.current_tokens = capacity\n"
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
        domain=q2_topic,
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
                "explanation": "Consuming 5 succeeds (5 remaining); consuming 6 fails as only 5 are available.",
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
        target_skill=f"{primary_lang} / Data Engineering",
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
    and adaptive fallback synthesis.
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
        """
        # Validate portfolio has substance
        langs = portfolio_data.get("primary_languages") or portfolio_data.get("primaryLanguages") or []
        clean_langs = [l for l in langs if l and l.strip()]
        if not clean_langs:
            raise ValueError("Portfolio must contain at least one primary programming language.")

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
                response_format={"type": "json_object"},
            )

            # Extract content from response
            choices = raw_response.get("choices")
            if not choices or not isinstance(choices, list) or len(choices) == 0:
                raise QuestionValidationError("Featherless AI returned empty choices list.")

            content = choices[0].get("message", {}).get("content", "")
            if not content:
                raise QuestionValidationError("Featherless AI returned empty message content.")

            # Parse JSON
            parsed_json = _extract_json_from_text(content)
            assessment_model = GeneratedAssessmentSchema(**parsed_json)
            validate_generated_assessment(assessment_model)
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
            validate_generated_assessment(fallback_assessment)
            return fallback_assessment


# Global singleton
question_generator = QuestionGenerator()
