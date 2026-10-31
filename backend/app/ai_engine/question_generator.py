import hashlib
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
    QuestionOptionSchema,
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
    question_count: int = 6,
    mcq_count: int = 3,
    msq_count: int = 2,
    coding_count: int = 1,
    previous_fingerprints: Optional[List[str]] = None,
) -> GeneratedAssessmentSchema:
    """
    Deterministic adaptive multi-format synthesizer grounded in candidate's verified portfolio.
    Guarantees personalized, solvable MCQ, MSQ, and Coding questions when AI is unavailable.
    Tailors programming language (Python, Java, C++) and topics strictly to candidate's skills.
    """
    raw_langs = portfolio_data.get("primary_languages") or portfolio_data.get("primaryLanguages") or ["Python"]
    langs = [l.strip().lower() for l in raw_langs if l and l.strip()]
    if not langs:
        langs = ["python"]

    frameworks = [f.strip().lower() for f in (portfolio_data.get("frameworks") or []) if f and f.strip()]
    skills_raw = portfolio_data.get("skills") or []
    skills: List[str] = []
    for s in skills_raw:
        if isinstance(s, dict):
            skills.append(s.get("name", "").strip().lower())
        elif isinstance(s, str):
            skills.append(s.strip().lower())

    projects = portfolio_data.get("projects") or []
    primary_lang = langs[0].lower()
    claimed_dsa = extract_claimed_dsa_topics(portfolio_data) or ["Arrays"]

    # Detect candidate expertise areas
    has_ml = any("machine learning" in s or "tensorflow" in s or "pytorch" in s or "data science" in s for s in skills + frameworks)
    has_sql = any("sql" in s or "database" in s or "postgres" in s for s in skills + frameworks)
    has_fastapi = any("fastapi" in f for f in frameworks)
    has_react = any("react" in f or "frontend" in f for f in frameworks)
    has_spring = any("spring" in f or "java" in langs for f in frameworks)

    # Rotate pools based on previous fingerprints to guarantee question freshness
    attempt_offset = len(previous_fingerprints or [])

    questions: List[GeneratedQuestionSchema] = []

    # =========================================================================
    # ROUND 1: MCQ QUESTIONS (Exactly 1 correct answer)
    # =========================================================================
    mcqs_pool: List[Dict[str, Any]] = []

    # MCQ Option A: Language Syntax & Internals
    if primary_lang == "python":
        if attempt_offset % 2 == 0:
            mcqs_pool.append({
                "title": "Python Dictionary Time Complexity",
                "description": "Which Python standard data structure provides average O(1) time complexity for key lookup and insertion?",
                "topic": "Python / Data Structures",
                "skill": "Python",
                "options": [
                    {"id": "A", "text": "list"},
                    {"id": "B", "text": "dict"},
                    {"id": "C", "text": "tuple"},
                    {"id": "D", "text": "str"},
                ],
                "correct_answer": "B",
                "explanation": "Python's built-in dict is implemented as a high-performance hash table providing average O(1) key lookup.",
            })
        else:
            mcqs_pool.append({
                "title": "Python Generator Memory Consumption",
                "description": "What is the primary memory advantage of using a Python generator over a traditional list comprehension?",
                "topic": "Python / Memory Optimization",
                "skill": "Python",
                "options": [
                    {"id": "A", "text": "Generators execute synchronously in parallel threads"},
                    {"id": "B", "text": "Generators yield elements lazily one at a time, consuming O(1) auxiliary memory"},
                    {"id": "C", "text": "Generators bypass Python's Global Interpreter Lock"},
                    {"id": "D", "text": "Generators pre-compile bytecode directly to machine assembly"},
                ],
                "correct_answer": "B",
                "explanation": "Generators evaluate expressions lazily on demand using the yield keyword, maintaining constant memory overhead.",
            })
    elif primary_lang == "java":
        mcqs_pool.append({
            "title": "Java Memory Management & Garbage Collection",
            "description": "Where are newly instantiated objects allocated in the Java Virtual Machine (JVM) memory architecture?",
            "topic": "Java / JVM Architecture",
            "skill": "Java",
            "options": [
                {"id": "A", "text": "Stack Memory"},
                {"id": "B", "text": "Eden Space in Young Generation Heap"},
                {"id": "C", "text": "Metaspace"},
                {"id": "D", "text": "Program Counter Register"},
            ],
            "correct_answer": "B",
            "explanation": "In JVM generational garbage collection, all newly created objects are initially allocated in the Eden space of the Heap.",
        })
    elif primary_lang == "cpp":
        mcqs_pool.append({
            "title": "C++ Smart Pointer Ownership Semantics",
            "description": "Which C++ standard smart pointer enforces strict exclusive, non-transferable ownership without reference counting overhead?",
            "topic": "C++ / Memory Management",
            "skill": "C++",
            "options": [
                {"id": "A", "text": "std::shared_ptr"},
                {"id": "B", "text": "std::unique_ptr"},
                {"id": "C", "text": "std::weak_ptr"},
                {"id": "D", "text": "std::auto_ptr"},
            ],
            "correct_answer": "B",
            "explanation": "std::unique_ptr manages exclusive ownership of a dynamic resource, prohibiting copying and adding zero memory overhead.",
        })

    # MCQ Option B: Specialization / Framework
    if has_ml:
        mcqs_pool.append({
            "title": "Machine Learning Overfitting Mitigation",
            "description": "Which technique directly prevents a deep neural network from overfitting to training data during backpropagation?",
            "topic": "Machine Learning / Regularization",
            "skill": "Machine Learning",
            "options": [
                {"id": "A", "text": "Decreasing training batch size to 1"},
                {"id": "B", "text": "Dropout regularization and L2 weight decay"},
                {"id": "C", "text": "Removing activation functions from hidden layers"},
                {"id": "D", "text": "Increasing learning rate exponentially"},
            ],
            "correct_answer": "B",
            "explanation": "Dropout randomly deactivates neurons during training, forcing redundant representations and preventing co-adaptation.",
        })
    elif has_sql:
        mcqs_pool.append({
            "title": "SQL Aggregate Grouping Filter Semantics",
            "description": "Which SQL clause is used to filter rows after an aggregation function has been evaluated over grouped data?",
            "topic": "Database & SQL / Querying",
            "skill": "SQL",
            "options": [
                {"id": "A", "text": "WHERE"},
                {"id": "B", "text": "HAVING"},
                {"id": "C", "text": "ORDER BY"},
                {"id": "D", "text": "PARTITION BY"},
            ],
            "correct_answer": "B",
            "explanation": "The HAVING clause filters group records after the GROUP BY aggregation has executed, unlike WHERE which filters beforehand.",
        })
    else:
        mcqs_pool.append({
            "title": "REST API Idempotency Contract",
            "description": "According to the HTTP/1.1 RFC specification, which of the following standard methods is defined as strictly idempotent?",
            "topic": "API Design & Architecture",
            "skill": "Web Architecture",
            "options": [
                {"id": "A", "text": "POST"},
                {"id": "B", "text": "PUT"},
                {"id": "C", "text": "CONNECT"},
                {"id": "D", "text": "PATCH"},
            ],
            "correct_answer": "B",
            "explanation": "PUT is idempotent: multiple identical requests produce the identical resource state as a single request.",
        })

    # MCQ Option C: Project & Architectural Knowledge
    project_title = projects[0].get("title") if projects and isinstance(projects[0], dict) else "System Architecture"
    mcqs_pool.append({
        "title": f"Distributed State Consistency in {project_title}",
        "description": "In high-throughput distributed architectures, which database isolation level prevents dirty reads while allowing non-repeatable reads?",
        "topic": "System Design / Transactions",
        "skill": "Backend Architecture",
        "options": [
            {"id": "A", "text": "Read Uncommitted"},
            {"id": "B", "text": "Read Committed"},
            {"id": "C", "text": "Repeatable Read"},
            {"id": "D", "text": "Serializable"},
        ],
        "correct_answer": "B",
        "explanation": "Read Committed guarantees that any data read is committed at the moment it is read, preventing dirty reads.",
    })

    # Fallback MCQ to ensure we have enough
    mcqs_pool.append({
        "title": "Asynchronous Event Loop Concurrency",
        "description": "What enables single-threaded runtimes (like Python asyncio or Node.js) to achieve high I/O throughput?",
        "topic": "Asynchronous Concurrency",
        "skill": "Concurrency",
        "options": [
            {"id": "A", "text": "Hardware multi-core thread preemption"},
            {"id": "B", "text": "Non-blocking cooperative I/O polling via OS epoll/kqueue"},
            {"id": "C", "text": "Disabling garbage collection during network requests"},
            {"id": "D", "text": "Shared-memory spinlocks"},
        ],
        "correct_answer": "B",
        "explanation": "Non-blocking cooperative I/O registers file descriptors with OS event multiplexers (epoll/kqueue), context-switching on I/O pauses.",
    })

    if previous_fingerprints:
        mcqs_pool = [m for m in mcqs_pool if hashlib.sha256(f"mcq:{m['topic']}:{m['title']}".encode()).hexdigest()[:16] not in previous_fingerprints] + [m for m in mcqs_pool if hashlib.sha256(f"mcq:{m['topic']}:{m['title']}".encode()).hexdigest()[:16] in previous_fingerprints]

    for idx, m in enumerate(mcqs_pool[:mcq_count]):
        qid = f"mcq_{idx + 1}"
        q_raw = f"mcq:{m['topic']}:{m['title']}"
        fp = hashlib.sha256(q_raw.encode()).hexdigest()[:16]
        questions.append(
            GeneratedQuestionSchema(
                question_id=qid,
                question_type="mcq",
                order_index=len(questions) + 1,
                title=m["title"],
                description=m["description"],
                difficulty=difficulty_preference,
                topic=m["topic"],
                target_skill=claimed_dsa[0] if claimed_dsa else "Arrays",
                portfolio_skill_reference=m["skill"],
                marks=2.0,
                options=[QuestionOptionSchema(**opt) for opt in m["options"]],
                correct_answer=m["correct_answer"],
                explanation=m["explanation"],
                question_fingerprint=fp,
            )
        )

    # =========================================================================
    # ROUND 2: MSQ QUESTIONS (Multiple select, at least 2 correct answers)
    # =========================================================================
    msqs_pool: List[Dict[str, Any]] = []

    if has_ml or primary_lang == "python":
        msqs_pool.append({
            "title": "Tabular Data & Numerical Computing Libraries",
            "description": "Which of the following libraries are standard industry packages for tabular data manipulation and array computation in Python? (Select all that apply)",
            "topic": "Python / Data Libraries",
            "skill": "Python Ecosystem",
            "options": [
                {"id": "A", "text": "Pandas"},
                {"id": "B", "text": "NumPy"},
                {"id": "C", "text": "Pygame"},
                {"id": "D", "text": "Polars"},
            ],
            "correct_answers": ["A", "B", "D"],
            "explanation": "Pandas, NumPy, and Polars are fundamental libraries for structured tabular data and array manipulations. Pygame is for game rendering.",
        })
    else:
        msqs_pool.append({
            "title": "Object-Oriented Programming Core Pillars",
            "description": "Which of the following are recognized fundamental principles of Object-Oriented Programming (OOP)? (Select all that apply)",
            "topic": "Software Engineering / OOP",
            "skill": "Software Design",
            "options": [
                {"id": "A", "text": "Encapsulation"},
                {"id": "B", "text": "Polymorphism"},
                {"id": "C", "text": "Compilation"},
                {"id": "D", "text": "Inheritance"},
            ],
            "correct_answers": ["A", "B", "D"],
            "explanation": "Encapsulation, Polymorphism, Inheritance (and Abstraction) are the four core pillars of OOP. Compilation is a build phase.",
        })

    msqs_pool.append({
        "title": "Database ACID Transactional Guarantees",
        "description": "Which of the following properties constitute the ACID standard for relational database transaction reliability? (Select all that apply)",
        "topic": "Databases / ACID",
        "skill": "Databases",
        "options": [
            {"id": "A", "text": "Atomicity"},
            {"id": "B", "text": "Consistency"},
            {"id": "C", "text": "Indexability"},
            {"id": "D", "text": "Durability"},
        ],
        "correct_answers": ["A", "B", "D"],
        "explanation": "ACID stands for Atomicity, Consistency, Isolation, and Durability. Indexability is a feature, not a transactional guarantee.",
    })

    msqs_pool.append({
        "title": "Network Transport & Application Layer Protocols",
        "description": "Which of the following application layer protocols run on top of reliable TCP transmission? (Select all that apply)",
        "topic": "Networking / Protocols",
        "skill": "Networking",
        "options": [
            {"id": "A", "text": "HTTP/1.1"},
            {"id": "B", "text": "HTTPS"},
            {"id": "C", "text": "DNS (standard queries)"},
            {"id": "D", "text": "SSH"},
        ],
        "correct_answers": ["A", "B", "D"],
        "explanation": "HTTP/1.1, HTTPS, and SSH rely on TCP for connection reliability. Standard small DNS queries use UDP for low-latency resolution.",
    })

    if previous_fingerprints:
        msqs_pool = [m for m in msqs_pool if hashlib.sha256(f"msq:{m['topic']}:{m['title']}".encode()).hexdigest()[:16] not in previous_fingerprints] + [m for m in msqs_pool if hashlib.sha256(f"msq:{m['topic']}:{m['title']}".encode()).hexdigest()[:16] in previous_fingerprints]

    for idx, m in enumerate(msqs_pool[:msq_count]):
        qid = f"msq_{idx + 1}"
        q_raw = f"msq:{m['topic']}:{m['title']}"
        fp = hashlib.sha256(q_raw.encode()).hexdigest()[:16]
        questions.append(
            GeneratedQuestionSchema(
                question_id=qid,
                question_type="msq",
                order_index=len(questions) + 1,
                title=m["title"],
                description=m["description"],
                difficulty=difficulty_preference,
                topic=m["topic"],
                target_skill=claimed_dsa[0] if claimed_dsa else "Arrays",
                portfolio_skill_reference=m["skill"],
                marks=3.0,
                options=[QuestionOptionSchema(**opt) for opt in m["options"]],
                correct_answers=m["correct_answers"],
                explanation=m["explanation"],
                question_fingerprint=fp,
            )
        )

    # =========================================================================
    # ROUND 3: CODING QUESTIONS (Executable programming problems)
    # =========================================================================
    # Selected language must strictly match candidate's portfolio
    lang_key = primary_lang if primary_lang in ("python", "java", "cpp") else "python"
    has_hash = any("hash" in t.lower() for t in claimed_dsa)
    has_sliding = any("sliding window" in t.lower() for t in claimed_dsa)

    if lang_key == "python":
        if has_sliding:
            c_title = "Adaptive Request Window Throughput Calculator (Python)"
            c_topic = "Sliding Window"
            c_desc = (
                "Given an array of integer request timestamps and a sliding window duration `k` milliseconds, "
                "implement `max_throughput(timestamps, k)` that returns the maximum number of requests "
                "received within any contiguous sub-window of length at most `k`."
            )
            c_starter = {
                "python": "def max_throughput(timestamps: list[int], k: int) -> int:\n    # Implement sliding window throughput calculation\n    pass\n"
            }
            c_ref = (
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
            c_pub = [
                {"test_case_id": "tc_pub_1", "input": "[1, 2, 3, 7, 8], 3", "expected_output": "3", "explanation": "Timestamps [1, 2, 3] span width 2 <= 3."},
                {"test_case_id": "tc_pub_2", "input": "[10, 20, 30], 5", "expected_output": "1", "explanation": "Each timestamp is isolated."},
            ]
            c_hid = [
                {"test_case_id": "tc_hid_1", "input": "[], 10", "expected_output": "0", "weight": 1.0},
                {"test_case_id": "tc_hid_2", "input": "[1, 2, 3, 4, 5], 10", "expected_output": "5", "weight": 1.0},
                {"test_case_id": "tc_hid_3", "input": "[1, 5, 6, 7, 12, 13, 14, 15], 3", "expected_output": "4", "weight": 2.0},
            ]
        else:
            c_title = "Sequential Array In-Place Compactor (Python)"
            c_topic = claimed_dsa[0] if claimed_dsa else "Arrays"
            c_desc = (
                "Given an array of integers `nums` and a target value `val`, "
                "implement `remove_element(nums, val)` that returns a new list containing only the elements "
                "not equal to `val`, maintaining relative order."
            )
            c_starter = {
                "python": "def remove_element(nums: list[int], val: int) -> list[int]:\n    # Return elements not equal to val\n    pass\n"
            }
            c_ref = (
                "def remove_element(nums: list[int], val: int) -> list[int]:\n"
                "    return [x for x in nums if x != val]\n"
            )
            c_pub = [
                {"test_case_id": "tc_pub_1", "input": "[3, 2, 2, 3], 3", "expected_output": "[2, 2]", "explanation": "3 is removed."},
                {"test_case_id": "tc_pub_2", "input": "[0, 1, 2, 2, 3, 0, 4, 2], 2", "expected_output": "[0, 1, 3, 0, 4]", "explanation": "2 is removed."},
            ]
            c_hid = [
                {"test_case_id": "tc_hid_1", "input": "[], 1", "expected_output": "[]", "weight": 1.0},
                {"test_case_id": "tc_hid_2", "input": "[1, 1, 1], 1", "expected_output": "[]", "weight": 1.0},
                {"test_case_id": "tc_hid_3", "input": "[5, 6, 7], 8", "expected_output": "[5, 6, 7]", "weight": 1.5},
            ]
    elif lang_key == "java":
        c_title = "Sequential Array Compactor (Java)"
        c_topic = claimed_dsa[0] if claimed_dsa else "Arrays"
        c_desc = (
            "Given an array of integers `nums` and a target integer `val`, "
            "implement `removeElement(nums, val)` to filter out `val` and return the result array."
        )
        c_starter = {
            "java": "public class Solution {\n    public static int[] removeElement(int[] nums, int val) {\n        // implementation\n        return new int[0];\n    }\n}\n"
        }
        c_ref = (
            "import java.util.Arrays;\n"
            "public class Solution {\n"
            "    public static int[] removeElement(int[] nums, int val) {\n"
            "        return Arrays.stream(nums).filter(x -> x != val).toArray();\n"
            "    }\n"
            "}\n"
        )
        c_pub = [
            {"test_case_id": "tc_pub_1", "input": "[3, 2, 2, 3], 3", "expected_output": "[2, 2]"},
            {"test_case_id": "tc_pub_2", "input": "[1, 2, 3], 2", "expected_output": "[1, 3]"},
        ]
        c_hid = [
            {"test_case_id": "tc_hid_1", "input": "[], 1", "expected_output": "[]", "weight": 1.0},
            {"test_case_id": "tc_hid_2", "input": "[5, 5], 5", "expected_output": "[]", "weight": 1.0},
            {"test_case_id": "tc_hid_3", "input": "[10, 20, 30], 5", "expected_output": "[10, 20, 30]", "weight": 2.0},
        ]
    else:  # cpp
        c_title = "Sequential Vector Compactor (C++)"
        c_topic = claimed_dsa[0] if claimed_dsa else "Arrays"
        c_desc = (
            "Given a std::vector<int> `nums` and a target integer `val`, "
            "implement `removeElement(nums, val)` to filter out `val`."
        )
        c_starter = {
            "cpp": "#include <vector>\nstd::vector<int> removeElement(const std::vector<int>& nums, int val) {\n    return {};\n}\n"
        }
        c_ref = (
            "#include <vector>\n"
            "std::vector<int> removeElement(const std::vector<int>& nums, int val) {\n"
            "    std::vector<int> res;\n"
            "    for (int x : nums) if (x != val) res.push_back(x);\n"
            "    return res;\n"
            "}\n"
        )
        c_pub = [
            {"test_case_id": "tc_pub_1", "input": "[3, 2, 2, 3], 3", "expected_output": "[2, 2]"},
            {"test_case_id": "tc_pub_2", "input": "[1, 2, 3], 2", "expected_output": "[1, 3]"},
        ]
        c_hid = [
            {"test_case_id": "tc_hid_1", "input": "[], 1", "expected_output": "[]", "weight": 1.0},
            {"test_case_id": "tc_hid_2", "input": "[5, 5], 5", "expected_output": "[]", "weight": 1.0},
            {"test_case_id": "tc_hid_3", "input": "[10, 20, 30], 5", "expected_output": "[10, 20, 30]", "weight": 2.0},
        ]

    c_raw = f"coding:{c_topic}:{c_title}"
    c_fp = hashlib.sha256(c_raw.encode()).hexdigest()[:16]

    questions.append(
        GeneratedQuestionSchema(
            question_id=f"coding_{len(questions) + 1}",
            question_type="coding",
            order_index=len(questions) + 1,
            title=c_title,
            description=c_desc,
            difficulty=difficulty_preference,
            topic=c_topic,
            portfolio_skill_reference=f"{primary_lang.capitalize()} / Algorithms",
            marks=10.0,
            constraints=["Time limit: 2000ms", "Memory limit: 256MB"],
            examples=c_pub,
            allowed_languages=[lang_key],
            starter_code=c_starter,
            hidden_test_cases=c_hid,
            reference_solution=c_ref,
            question_fingerprint=c_fp,
        )
    )

    return GeneratedAssessmentSchema(
        title=f"{target_role} Multi-Format Technical Assessment",
        duration_minutes=60,
        difficulty=difficulty_preference,
        target_role=target_role,
        mcq_count=mcq_count,
        msq_count=msq_count,
        coding_count=coding_count,
        questions=questions[:question_count],
    )


class QuestionGenerator:
    """
    Orchestrates multi-format prompt building, Featherless AI invocation, Pydantic schema validation,
    strict DSA whitelist verification, and adaptive fallback synthesis.
    """

    def __init__(self, client=None):
        self.client = client or featherless_client

    def generate_assessment(
        self,
        portfolio_data: Dict[str, Any],
        target_role: str = "Software Engineer",
        difficulty_preference: str = "medium",
        question_count: int = 6,
        mcq_count: int = 3,
        msq_count: int = 2,
        coding_count: int = 1,
        previous_fingerprints: Optional[List[str]] = None,
    ) -> GeneratedAssessmentSchema:
        """
        Generates a validated personalized multi-format assessment grounded in candidate portfolio.
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
            mcq_count=mcq_count,
            msq_count=msq_count,
            coding_count=coding_count,
            previous_fingerprints=previous_fingerprints,
        )

        # 1. Attempt Featherless AI generation
        try:
            logger.info("Requesting personalized multi-format assessment from Featherless AI...")
            raw_response = self.client.chat_completion(
                messages=prompts,
                temperature=0.3,
                max_tokens=4000,
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
            logger.info("Successfully generated and validated multi-format assessment via Featherless AI.")
            return assessment_model

        except (FeatherlessError, json.JSONDecodeError, QuestionValidationError, ValueError, Exception) as exc:
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
                mcq_count=mcq_count,
                msq_count=msq_count,
                coding_count=coding_count,
                previous_fingerprints=previous_fingerprints,
            )
            # Enforce zero-trust validation pipeline on fallback
            validate_generated_assessment(
                assessment=fallback_assessment,
                claimed_dsa_topics=claimed_dsa_topics,
            )
            return fallback_assessment


# Global singleton
question_generator = QuestionGenerator()
