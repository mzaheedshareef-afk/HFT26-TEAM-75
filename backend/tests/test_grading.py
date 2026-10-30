"""
Secure Code Execution & Automated Grading Comprehensive Test Suite
Role: Testing & Integration Lead (Vasil)
Project: Portfolio-Driven Adaptive Coding & Technical Assessment Platform
Team: HFT26-TEAM-75

Tests all Phase 5 requirements:
- Correct code (Python, Java, C++)
- Incorrect code (Wrong Answer)
- Syntax errors / Compilation errors
- Runtime errors
- Infinite loops (Timeouts)
- Memory exhaustion (MLE)
- Unsupported language rejection
- Empty source code rejection
- Invalid question ID handling
- Missing authentication enforcement
- Candidate submission ownership isolation
- Hidden test confidentiality (zero data leaks)
- Docker unavailable handling
- Container cleanup after failure
"""

from datetime import datetime, timezone
import json
import os
import subprocess
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from backend.app.core.security import AuthException
from backend.app.database.supabase import set_supabase_client
from backend.app.execution.docker_runner import (
    DockerRunner,
    RawExecutionResult,
    set_custom_runner_hook,
    set_docker_available_override,
)
from backend.app.execution.execution_manager import ExecutionManager
from backend.app.execution.security import (
    DockerUnavailableError,
    ExecutionSecurityValidator,
    InvalidSourceCodeError,
    SecurityViolationError,
    UnsupportedLanguageError,
)
from backend.app.grading.ai_efficiency import AIEfficiencyEvaluator
from backend.app.grading.grading_engine import (
    GradingEngine,
    _assessment_results_memory_store,
    _submissions_memory_store,
)
from backend.app.grading.score_calculator import (
    ScoreCalculator,
    compare_outputs,
    normalize_output,
)
from backend.app.main import app
from backend.app.services.assessment_service import (
    _assessment_memory_store,
    _assessment_questions_store,
    _user_assessments_index,
)
from backend.tests.test_auth import MockSupabase


@pytest.fixture(autouse=True)
def clean_stores():
    """Resets memory stores and runner hooks between tests."""
    set_custom_runner_hook(None)
    set_docker_available_override(None)
    yield
    set_custom_runner_hook(None)
    set_docker_available_override(None)


@pytest.fixture
def mock_supabase():
    mock = MockSupabase()
    set_supabase_client(mock)
    yield mock
    set_supabase_client(None)


@pytest.fixture
def client(mock_supabase):
    return TestClient(app)


def create_candidate(client: TestClient, name="Candidate One", email="cand1@test.com"):
    res = client.post(
        "/api/auth/student/register",
        json={"full_name": name, "email": email, "password": "Password123!"},
    )
    assert res.status_code == 201
    return res.json()["access_token"], res.json()["user"]


@pytest.fixture
def sample_question_setup():
    """Sets up a trusted question with public and hidden test cases in memory store."""
    assessment_id = "test_assessment_101"
    question_id = "test_q_target_pair"
    user_id = "user_cand_1"

    question_data = {
        "id": question_id,
        "question_id": question_id,
        "assessment_id": assessment_id,
        "order_index": 1,
        "title": "Pair Target Sum",
        "description": "Find indices of two numbers that add to target.",
        "difficulty": "medium",
        "category": "Algorithms",
        "target_skill": "Data Structures",
        "time_limit_seconds": 2.0,
        "memory_limit_mb": 256,
        "sample_test_cases": [
            {"test_case_id": "pub_1", "input": "2,7,11,15\n9", "expected_output": "0 1", "weight": 1.0},
            {"test_case_id": "pub_2", "input": "3,2,4\n6", "expected_output": "1 2", "weight": 1.0},
        ],
        "hidden_test_cases": [
            {"test_case_id": "hid_1", "input": "-1,-2,-3,-4,-5\n-8", "expected_output": "2 4", "weight": 50.0},
            {"test_case_id": "hid_2", "input": "0,4,3,0\n0", "expected_output": "0 3", "weight": 50.0},
        ],
        "reference_solution": "import sys\nprint('0 1')",
    }

    assessment_data = {
        "id": assessment_id,
        "user_id": user_id,
        "title": "Technical Assessment",
        "status": "in_progress",
        "duration_seconds": 3600,
        "questions": [question_data],
    }

    _assessment_memory_store[assessment_id] = assessment_data
    _assessment_questions_store[assessment_id] = [question_data]
    _user_assessments_index[user_id] = [assessment_id]

    return {
        "assessment_id": assessment_id,
        "question_id": question_id,
        "user_id": user_id,
        "question": question_data,
    }


# =========================================================================
# 1. Output Normalization & Deterministic Grading Tests
# =========================================================================

class TestOutputComparisonAndGrading:
    def test_output_normalization(self):
        assert normalize_output("  hello world \r\n") == "  hello world"
        assert normalize_output("line 1\r\nline 2\n\n") == "line 1\nline 2"
        assert normalize_output(None) == ""

    def test_token_and_float_comparison(self):
        assert compare_outputs("0 1\n", "0 1")
        assert compare_outputs("3.14159265", "3.14159265")
        # Floating point tolerance 10^-6
        assert compare_outputs("1.0000001", "1.0000002")
        # Mismatch
        assert not compare_outputs("0 1", "1 0")
        assert not compare_outputs("hello", "world")

    def test_score_calculator_weighted_grading(self):
        evaluations = [
            {"test_case_id": "t1", "passed": True, "weight": 30.0, "execution_time_ms": 12.0, "memory_used_mb": 15.0},
            {"test_case_id": "t2", "passed": False, "weight": 20.0, "execution_time_ms": 15.0, "memory_used_mb": 18.0},
            {"test_case_id": "t3", "passed": True, "weight": 50.0, "execution_time_ms": 10.0, "memory_used_mb": 14.0},
        ]
        metrics = ScoreCalculator.evaluate_test_results(evaluations)
        # Passed weights = 30 + 50 = 80 out of 100
        assert metrics["score"] == 80.0
        assert metrics["passed_tests"] == 2
        assert metrics["failed_tests"] == 1
        assert metrics["total_tests"] == 3
        assert metrics["is_accepted"] is False

    def test_assessment_final_score_calculation(self):
        scores = [100.0, 50.0]
        final = ScoreCalculator.calculate_assessment_final_score(scores, total_questions=2)
        assert final == 75.0

        # Unattempted questions factor into denominator
        final_with_unattempted = ScoreCalculator.calculate_assessment_final_score([100.0], total_questions=2)
        assert final_with_unattempted == 50.0


# =========================================================================
# 2. Security Validation & Language Checks
# =========================================================================

class TestExecutionSecurity:
    def test_unsupported_language_rejection(self):
        with pytest.raises(UnsupportedLanguageError):
            ExecutionSecurityValidator.run_pre_execution_checks("print(1)", "ruby")

        with pytest.raises(UnsupportedLanguageError):
            ExecutionSecurityValidator.run_pre_execution_checks("print(1)", "")

    def test_empty_source_code_rejection(self):
        with pytest.raises(InvalidSourceCodeError):
            ExecutionSecurityValidator.run_pre_execution_checks("", "python")

        with pytest.raises(InvalidSourceCodeError):
            ExecutionSecurityValidator.run_pre_execution_checks("   \n\t  ", "python")

    def test_null_byte_rejection(self):
        with pytest.raises(SecurityViolationError):
            ExecutionSecurityValidator.run_pre_execution_checks("print('hi')\x00", "python")

    def test_forbidden_module_import_python(self):
        with pytest.raises(SecurityViolationError):
            ExecutionSecurityValidator.run_pre_execution_checks("import ctypes", "python")

    def test_supported_languages_normalized(self):
        assert ExecutionSecurityValidator.normalize_language("Python") == "python"
        assert ExecutionSecurityValidator.normalize_language("py") == "python"
        assert ExecutionSecurityValidator.normalize_language("c++") == "cpp"
        assert ExecutionSecurityValidator.normalize_language("Java") == "java"


# =========================================================================
# 3. Execution Engine Simulation (Language Runs, Errors, Timeouts)
# =========================================================================

class TestExecutionEngineBehaviors:
    def test_correct_code_python_execution(self, sample_question_setup):
        """Simulates Python solution passing all test cases."""
        def mock_python_runner(source_code, language, stdin_data, **kwargs):
            if stdin_data == "2,7,11,15\n9":
                return RawExecutionResult(status="SUCCESS", stdout="0 1\n", stderr="", exit_code=0, execution_time_ms=15.0, memory_used_mb=20.0)
            elif stdin_data == "3,2,4\n6":
                return RawExecutionResult(status="SUCCESS", stdout="1 2\n", stderr="", exit_code=0, execution_time_ms=12.0, memory_used_mb=20.0)
            elif stdin_data == "-1,-2,-3,-4,-5\n-8":
                return RawExecutionResult(status="SUCCESS", stdout="2 4\n", stderr="", exit_code=0, execution_time_ms=14.0, memory_used_mb=20.0)
            elif stdin_data == "0,4,3,0\n0":
                return RawExecutionResult(status="SUCCESS", stdout="0 3\n", stderr="", exit_code=0, execution_time_ms=16.0, memory_used_mb=20.0)
            return RawExecutionResult(status="SUCCESS", stdout="", stderr="", exit_code=0, execution_time_ms=10.0, memory_used_mb=10.0)

        set_custom_runner_hook(mock_python_runner)

        results = ExecutionManager.execute_test_suite(
            source_code="import sys\n# solution",
            language="python",
            test_cases=sample_question_setup["question"]["sample_test_cases"],
        )
        assert len(results) == 2
        assert all(r.passed for r in results)
        assert results[0].status == "ACCEPTED"

    def test_correct_code_cpp_execution(self):
        """Simulates C++ compilation and execution."""
        def mock_cpp_runner(source_code, language, stdin_data, **kwargs):
            return RawExecutionResult(status="SUCCESS", stdout="42\n", stderr="", exit_code=0, execution_time_ms=5.0, memory_used_mb=12.0)

        set_custom_runner_hook(mock_cpp_runner)

        test_cases = [{"test_case_id": "cpp_1", "input": "5\n", "expected_output": "42"}]
        results = ExecutionManager.execute_test_suite(
            source_code="#include <iostream>\nint main(){std::cout<<42<<std::endl;}",
            language="cpp",
            test_cases=test_cases,
        )
        assert len(results) == 1
        assert results[0].passed is True
        assert results[0].status == "ACCEPTED"

    def test_correct_code_java_execution(self):
        """Simulates Java compilation and execution."""
        def mock_java_runner(source_code, language, stdin_data, **kwargs):
            return RawExecutionResult(status="SUCCESS", stdout="100\n", stderr="", exit_code=0, execution_time_ms=50.0, memory_used_mb=35.0)

        set_custom_runner_hook(mock_java_runner)

        test_cases = [{"test_case_id": "java_1", "input": "", "expected_output": "100"}]
        results = ExecutionManager.execute_test_suite(
            source_code="public class Solution { public static void main(String[] args){ System.out.println(100); } }",
            language="java",
            test_cases=test_cases,
        )
        assert len(results) == 1
        assert results[0].passed is True
        assert results[0].status == "ACCEPTED"

    def test_compilation_error_handling(self):
        def mock_compile_error(source_code, language, stdin_data, **kwargs):
            return RawExecutionResult(
                status="COMPILATION_ERROR",
                stdout="",
                stderr="error: expected ';' before '}' token",
                exit_code=1,
                execution_time_ms=0.0,
                memory_used_mb=0.0,
                error_message="Compilation error",
            )

        set_custom_runner_hook(mock_compile_error)

        test_cases = [
            {"test_case_id": "t1", "input": "1", "expected_output": "1"},
            {"test_case_id": "t2", "input": "2", "expected_output": "2"},
        ]
        results = ExecutionManager.execute_test_suite(
            source_code="invalid cpp code",
            language="cpp",
            test_cases=test_cases,
        )
        assert len(results) == 2
        assert results[0].status == "COMPILATION_ERROR"
        assert results[1].status == "COMPILATION_ERROR"
        assert not results[0].passed

    def test_runtime_error_handling(self):
        def mock_runtime_error(source_code, language, stdin_data, **kwargs):
            return RawExecutionResult(
                status="RUNTIME_ERROR",
                stdout="",
                stderr="ZeroDivisionError: division by zero",
                exit_code=1,
                execution_time_ms=10.0,
                memory_used_mb=15.0,
                error_message="ZeroDivisionError",
            )

        set_custom_runner_hook(mock_runtime_error)

        test_cases = [{"test_case_id": "t1", "input": "", "expected_output": "1"}]
        results = ExecutionManager.execute_test_suite(
            source_code="print(1/0)",
            language="python",
            test_cases=test_cases,
        )
        assert len(results) == 1
        assert results[0].status == "RUNTIME_ERROR"
        assert not results[0].passed

    def test_infinite_loop_timeout_handling(self):
        def mock_timeout_runner(source_code, language, stdin_data, **kwargs):
            return RawExecutionResult(
                status="TIME_LIMIT_EXCEEDED",
                stdout="",
                stderr="Execution exceeded time limit of 2.0s.",
                exit_code=-1,
                execution_time_ms=2000.0,
                memory_used_mb=0.0,
                error_message="Time limit exceeded (2.0s).",
            )

        set_custom_runner_hook(mock_timeout_runner)

        test_cases = [{"test_case_id": "t_loop", "input": "", "expected_output": "done"}]
        results = ExecutionManager.execute_test_suite(
            source_code="while True: pass",
            language="python",
            test_cases=test_cases,
        )
        assert len(results) == 1
        assert results[0].status == "TIME_LIMIT_EXCEEDED"
        assert not results[0].passed

    def test_memory_exhaustion_handling(self):
        def mock_mle_runner(source_code, language, stdin_data, **kwargs):
            return RawExecutionResult(
                status="MEMORY_LIMIT_EXCEEDED",
                stdout="",
                stderr="Process was killed (Out of Memory).",
                exit_code=137,
                execution_time_ms=500.0,
                memory_used_mb=256.0,
                error_message="Memory limit exceeded.",
            )

        set_custom_runner_hook(mock_mle_runner)

        test_cases = [{"test_case_id": "t_mle", "input": "", "expected_output": "ok"}]
        results = ExecutionManager.execute_test_suite(
            source_code="arr = [0] * 10**9",
            language="python",
            test_cases=test_cases,
        )
        assert len(results) == 1
        assert results[0].status == "MEMORY_LIMIT_EXCEEDED"
        assert not results[0].passed

    def test_docker_unavailable_handling(self):
        set_docker_available_override(False)
        with pytest.raises(DockerUnavailableError):
            DockerRunner.run_code(
                source_code="print('hello')",
                language="python",
            )

    def test_container_cleanup_after_failure(self):
        """Verifies container cleanup helper invokes docker rm -f."""
        with patch("subprocess.run") as mock_subproc:
            DockerRunner._force_remove_container("test_container_id")
            mock_subproc.assert_called_once()
            args = mock_subproc.call_args[0][0]
            assert "docker" in args
            assert "rm" in args
            assert "-f" in args
            assert "test_container_id" in args


# =========================================================================
# 4. API Endpoints & Contract Integration Tests
# =========================================================================

class TestCodeExecutionAPIEndpoints:
    def test_run_code_public_tests_success(self, client, sample_question_setup):
        token, user = create_candidate(client, name="Alice", email="alice@run.com")
        sample_question_setup["question"]["assessment_id"] = sample_question_setup["assessment_id"]
        _assessment_memory_store[sample_question_setup["assessment_id"]]["user_id"] = user["id"]

        def mock_runner(source_code, language, stdin_data, **kwargs):
            if "9" in stdin_data:
                return RawExecutionResult(status="SUCCESS", stdout="0 1", stderr="", exit_code=0, execution_time_ms=10.0, memory_used_mb=10.0)
            return RawExecutionResult(status="SUCCESS", stdout="1 2", stderr="", exit_code=0, execution_time_ms=10.0, memory_used_mb=10.0)

        set_custom_runner_hook(mock_runner)

        res = client.post(
            "/api/code/run",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "source_code": "import sys\n# solution",
                "language": "python",
                "question_id": sample_question_setup["question_id"],
                "assessment_id": sample_question_setup["assessment_id"],
            },
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["passed_test_cases"] == 2
        assert len(data["test_results"]) == 2
        # Verify public test outputs ARE present
        assert "expected_output" in data["test_results"][0]

    def test_run_code_missing_auth(self, client, sample_question_setup):
        res = client.post(
            "/api/code/run",
            json={
                "source_code": "print(1)",
                "language": "python",
                "question_id": sample_question_setup["question_id"],
            },
        )
        assert res.status_code == 401
        assert res.json()["error"]["code"] == "UNAUTHORIZED"

    def test_run_code_unsupported_language(self, client, sample_question_setup):
        token, user = create_candidate(client, name="Bob", email="bob@lang.com")
        res = client.post(
            "/api/code/run",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "source_code": "puts 'hi'",
                "language": "ruby",
                "question_id": sample_question_setup["question_id"],
            },
        )
        assert res.status_code == 400
        assert res.json()["error"]["code"] == "UNSUPPORTED_LANGUAGE"

    def test_run_code_empty_source(self, client, sample_question_setup):
        token, user = create_candidate(client, name="Empty", email="empty@code.com")
        res = client.post(
            "/api/code/run",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "source_code": "   ",
                "language": "python",
                "question_id": sample_question_setup["question_id"],
            },
        )
        assert res.status_code == 400
        assert res.json()["error"]["code"] == "INVALID_SOURCE_CODE"

    def test_submit_code_hidden_test_confidentiality(self, client, sample_question_setup):
        """
        Critical test: Verifies that hidden test inputs and expected outputs
        are strictly stripped from the submit API response.
        """
        token, user = create_candidate(client, name="SubmitDev", email="sub@test.com")
        aid = sample_question_setup["assessment_id"]
        qid = sample_question_setup["question_id"]
        _assessment_memory_store[aid]["user_id"] = user["id"]

        def mock_perfect_runner(source_code, language, stdin_data, **kwargs):
            if "9" in stdin_data:
                return RawExecutionResult(status="SUCCESS", stdout="0 1", stderr="", exit_code=0, execution_time_ms=10.0, memory_used_mb=10.0)
            elif "6" in stdin_data:
                return RawExecutionResult(status="SUCCESS", stdout="1 2", stderr="", exit_code=0, execution_time_ms=10.0, memory_used_mb=10.0)
            elif "-8" in stdin_data:
                return RawExecutionResult(status="SUCCESS", stdout="2 4", stderr="", exit_code=0, execution_time_ms=10.0, memory_used_mb=10.0)
            else:
                return RawExecutionResult(status="SUCCESS", stdout="0 3", stderr="", exit_code=0, execution_time_ms=10.0, memory_used_mb=10.0)

        set_custom_runner_hook(mock_perfect_runner)

        res = client.post(
            "/api/code/submit",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "source_code": "import sys\n# perfect solution",
                "language": "python",
                "question_id": qid,
                "assessment_id": aid,
            },
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["status"] == "accepted"
        assert data["score"] == 100.0
        assert data["is_accepted"] is True

        # Check hidden test cases in response: MUST NOT contain input or expected_output
        hidden_cases = data["hidden_test_cases"]
        assert len(hidden_cases) == 2
        for hc in hidden_cases:
            assert hc["is_hidden"] is True
            assert "input" not in hc or hc.get("input") is None or hc.get("input") == ""
            assert "expected_output" not in hc
            assert "actual_output" not in hc

    def test_submission_ownership_isolation(self, client, sample_question_setup):
        """Student A cannot access Student B's submission."""
        token_a, user_a = create_candidate(client, name="Alice A", email="alice_a@test.com")
        token_b, user_b = create_candidate(client, name="Bob B", email="bob_b@test.com")

        aid = sample_question_setup["assessment_id"]
        qid = sample_question_setup["question_id"]
        _assessment_memory_store[aid]["user_id"] = user_a["id"]

        def mock_runner(source_code, language, stdin_data, **kwargs):
            return RawExecutionResult(status="SUCCESS", stdout="0 1", stderr="", exit_code=0, execution_time_ms=5.0, memory_used_mb=10.0)

        set_custom_runner_hook(mock_runner)

        # Alice submits
        res_submit = client.post(
            "/api/code/submit",
            headers={"Authorization": f"Bearer {token_a}"},
            json={
                "source_code": "print('0 1')",
                "language": "python",
                "question_id": qid,
                "assessment_id": aid,
            },
        )
        assert res_submit.status_code == 200
        sub_id = res_submit.json()["submission_id"]

        # Alice accesses her own submission: SUCCESS
        res_alice = client.get(
            f"/api/submissions/{sub_id}",
            headers={"Authorization": f"Bearer {token_a}"},
        )
        assert res_alice.status_code == 200
        assert res_alice.json()["submission"]["id"] == sub_id

        # Bob attempts to access Alice's submission: FORBIDDEN 403
        res_bob = client.get(
            f"/api/submissions/{sub_id}",
            headers={"Authorization": f"Bearer {token_b}"},
        )
        assert res_bob.status_code == 403
        assert res_bob.json()["error"]["code"] == "UNAUTHORIZED_ACCESS"

    def test_submit_to_another_students_assessment_forbidden(self, client, sample_question_setup):
        """Student B attempts to submit to Student A's assessment."""
        token_a, user_a = create_candidate(client, name="Owner", email="owner@test.com")
        token_b, user_b = create_candidate(client, name="Attacker", email="attacker@test.com")

        aid = sample_question_setup["assessment_id"]
        qid = sample_question_setup["question_id"]
        _assessment_memory_store[aid]["user_id"] = user_a["id"]

        res = client.post(
            "/api/code/submit",
            headers={"Authorization": f"Bearer {token_b}"},
            json={
                "source_code": "print(1)",
                "language": "python",
                "question_id": qid,
                "assessment_id": aid,
            },
        )
        assert res.status_code == 403
        assert res.json()["error"]["code"] == "UNAUTHORIZED_ACCESS"

    def test_assessment_results_endpoint(self, client, sample_question_setup):
        """Verifies GET /api/assessment/{assessment_id}/results returns rolled-up score."""
        token, user = create_candidate(client, name="EvalStudent", email="eval@test.com")
        aid = sample_question_setup["assessment_id"]
        qid = sample_question_setup["question_id"]
        _assessment_memory_store[aid]["user_id"] = user["id"]

        def mock_runner(source_code, language, stdin_data, **kwargs):
            return RawExecutionResult(status="SUCCESS", stdout="0 1", stderr="", exit_code=0, execution_time_ms=5.0, memory_used_mb=10.0)

        set_custom_runner_hook(mock_runner)

        # Submit code
        client.post(
            "/api/code/submit",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "source_code": "print('0 1')",
                "language": "python",
                "question_id": qid,
                "assessment_id": aid,
            },
        )

        res = client.get(
            f"/api/assessment/{aid}/results",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert "total_score" in data["results"]
        assert "question_scores" in data["results"]

    def test_ast_complexity_detection(self):
        code_on = "def solve(nums):\n    for x in nums:\n        pass\n"
        code_on2 = "def solve(nums):\n    for x in nums:\n        for y in nums:\n            pass\n"

        res_on = AIEfficiencyEvaluator.analyze_python_ast_complexity(code_on)
        res_on2 = AIEfficiencyEvaluator.analyze_python_ast_complexity(code_on2)

        assert res_on["detected_time_complexity"] == "O(N)"
        assert res_on["max_loop_depth"] == 1
        assert res_on2["detected_time_complexity"] == "O(N^2)"
        assert res_on2["max_loop_depth"] == 2
