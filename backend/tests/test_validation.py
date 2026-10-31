"""
Comprehensive Task Validation Pipeline & DSA Whitelist Test Suite
Verifies:
- Test A: Reference Solution Validator (100% pass rate requirement)
- Test B: Starter Code Validator (Fails acceptance tests, not pre-solved)
- Test C: Test Suite Quality Validator (Count, uniqueness, non-empty outputs)
- Test D: Security Analysis (AST & regex for forbidden operations)
- DSA Whitelist Validator: Rejection of un-claimed DSA topics
- Lifecycle state transitions: GENERATED -> VALIDATING -> VALIDATED / REJECTED
"""

import pytest
from backend.app.execution.docker_runner import (
    RawExecutionResult,
    set_custom_runner_hook,
    set_docker_available_override,
)
from backend.app.schemas.assessment import GeneratedQuestionSchema
from backend.app.validation.dsa_whitelist import (
    CANONICAL_DSA_TOPICS,
    extract_claimed_dsa_topics,
    validate_question_dsa_whitelist,
)
from backend.app.validation.question_validator import (
    TaskValidationStatus,
    validate_single_task,
    validate_security_operations,
)
from backend.app.validation.reference_validator import validate_reference_solution
from backend.app.validation.test_validator import (
    validate_starter_code_fails_tests,
    validate_test_suite_quality,
)


@pytest.fixture(autouse=True)
def setup_runner_hooks():
    def test_runner_hook(source_code="", language="", stdin_data="", **kwargs):
        # Starter code has no 'seen' dictionary
        if "seen" not in source_code:
            return RawExecutionResult(
                status="SUCCESS",
                stdout="[]\n",
                stderr="",
                exit_code=0,
                execution_time_ms=10.0,
                memory_used_mb=15.0,
            )
        
        # Reference solution: output corresponding expected output based on input
        if "20" in stdin_data:
            out = "[2, 3]\n"
        elif "3, 2, 4" in stdin_data:
            out = "[1, 2]\n"
        elif "9" in stdin_data:
            out = "[0, 1]\n"
        elif "3, 3" in stdin_data:
            out = "[0, 1]\n"
        else:
            out = "[0, 1]\n"

        return RawExecutionResult(
            status="SUCCESS",
            stdout=out,
            stderr="",
            exit_code=0,
            execution_time_ms=10.0,
            memory_used_mb=15.0,
        )

    set_docker_available_override(True)
    set_custom_runner_hook(test_runner_hook)
    yield
    set_docker_available_override(None)
    set_custom_runner_hook(None)


def create_sample_valid_task() -> GeneratedQuestionSchema:
    return GeneratedQuestionSchema(
        question_id="task_two_sum_01",
        title="Find Target Two Sum",
        description="Given an array of integers and a target sum, return indices of the two numbers that add up to target.",
        difficulty="easy",
        target_skill="Arrays",
        category="Algorithms",
        starter_code={
            "python": "def two_sum(nums, target):\n    # Return empty list\n    return []\n"
        },
        reference_solution=(
            "def two_sum(nums, target):\n"
            "    seen = {}\n"
            "    for i, n in enumerate(nums):\n"
            "        comp = target - n\n"
            "        if comp in seen:\n"
            "            return [seen[comp], i]\n"
            "        seen[n] = i\n"
            "    return []\n"
        ),
        public_test_cases=[
            {
                "input": "nums = [2, 7, 11, 15], target = 9",
                "expected_output": "[0, 1]",
                "explanation": "2 + 7 = 9",
            },
            {
                "input": "nums = [3, 2, 4], target = 6",
                "expected_output": "[1, 2]",
                "explanation": "2 + 4 = 6",
            },
        ],
        hidden_test_cases=[
            {
                "input": "nums = [3, 3], target = 6",
                "expected_output": "[0, 1]",
            },
            {
                "input": "nums = [1, 5, 8, 12, 14], target = 20",
                "expected_output": "[2, 3]",
            },
        ],
    )


class TestDSAWhitelistValidation:
    """Zero-trust validation of candidate claimed DSA topics."""

    def test_canonical_topics_exist(self):
        assert "Arrays" in CANONICAL_DSA_TOPICS.values()
        assert "Trees" in CANONICAL_DSA_TOPICS.values()
        assert "Dynamic Programming" in CANONICAL_DSA_TOPICS.values()
        assert "Graphs" in CANONICAL_DSA_TOPICS.values()

    def test_extract_claimed_dsa_topics(self):
        portfolio = {
            "dsa_topics_solved": ["Arrays", "Strings", "Hash Tables"],
            "technical_skills": ["Python", "Docker", "Binary Search"],
        }
        claimed = extract_claimed_dsa_topics(portfolio)
        assert "Arrays" in claimed
        assert "Strings" in claimed
        assert "Hash Tables" in claimed
        assert "Binary Search" in claimed
        assert "Graphs" not in claimed

    def test_question_allowed_when_topic_in_whitelist(self):
        claimed = ["Arrays", "Strings"]
        q = create_sample_valid_task()
        q.target_skill = "Arrays"
        valid, violations = validate_question_dsa_whitelist(q, claimed)
        assert valid is True
        assert len(violations) == 0

    def test_question_rejected_when_topic_not_in_whitelist(self):
        claimed = ["Arrays", "Strings"]
        q = create_sample_valid_task()
        q.target_skill = "Graphs"
        valid, violations = validate_question_dsa_whitelist(q, claimed)
        assert valid is False
        assert len(violations) > 0
        assert any("Graphs" in v for v in violations)


class TestPipelineTestAtoD:
    """Validates Tests A, B, C, D of the Task Validation Pipeline."""

    def test_test_a_reference_solution_passes(self):
        task = create_sample_valid_task()
        ok, failures = validate_reference_solution(task, "python")
        assert ok is True
        assert len(failures) == 0

    def test_test_b_starter_code_fails_not_presolved(self):
        task = create_sample_valid_task()
        ok, failures = validate_starter_code_fails_tests(task, "python")
        assert ok is True
        assert len(failures) == 0

    def test_test_b_rejects_presolved_starter_code(self):
        task = create_sample_valid_task()
        task.starter_code["python"] = task.reference_solution
        ok, failures = validate_starter_code_fails_tests(task, "python")
        assert ok is False
        assert any("pre-solved" in f for f in failures)

    def test_test_c_test_suite_quality(self):
        task = create_sample_valid_task()
        ok, failures = validate_test_suite_quality(task)
        assert ok is True
        assert len(failures) == 0

    def test_test_c_rejects_empty_hidden_tests(self):
        task = create_sample_valid_task()
        task.hidden_test_cases = []
        ok, failures = validate_test_suite_quality(task)
        assert ok is False
        assert any("hidden test case" in f for f in failures)

    def test_test_d_security_detects_forbidden_ops(self):
        dangerous_code = "import os\nos.system('rm -rf /')"
        ok, msg = validate_security_operations(dangerous_code, "starter_code")
        assert ok is False
        assert "Forbidden security operation" in msg or "Dangerous import" in msg

    def test_single_task_validation_success(self):
        task = create_sample_valid_task()
        report = validate_single_task(task, claimed_dsa_topics=["Arrays"])
        assert report["status"] == TaskValidationStatus.VALIDATED.value
        assert report["is_valid"] is True
        assert report["test_a_reference_passed"] is True
        assert report["test_b_starter_fails_passed"] is True
        assert report["test_c_quality_passed"] is True
        assert report["test_d_security_passed"] is True
        assert report["dsa_whitelist_passed"] is True

    def test_single_task_validation_rejected_on_unclaimed_dsa(self):
        task = create_sample_valid_task()
        task.target_skill = "Dynamic Programming"
        report = validate_single_task(task, claimed_dsa_topics=["Arrays", "Strings"])
        assert report["status"] == TaskValidationStatus.REJECTED.value
        assert report["is_valid"] is False
        assert any("un-claimed topic" in err for err in report["errors"])
