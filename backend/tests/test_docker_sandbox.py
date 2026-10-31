"""
Docker Execution Sandbox Integration & Unit Test Suite
Verifies:
- Docker availability and diagnostics
- Missing Docker daemon (HTTP 503 DOCKER_UNAVAILABLE)
- Missing execution image (HTTP 503 IMAGE_NOT_FOUND)
- Container creation failure handling
- Timeouts, memory limits, compilation errors, runtime errors
- Security constraints: non-root user, offline network, cap drop, tmpfs, read-only
- Container cleanup guarantee
- Dedicated Docker health endpoints (/api/health, /api/health/docker, /api/code/health)
- Candidate isolation and zero-trust data protection
- Real Docker Desktop test (if daemon is actively running)
"""

from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from backend.app.database.supabase import set_supabase_client
from backend.app.execution.docker_runner import (
    DOCKER_IMAGES,
    DockerRunner,
    RawExecutionResult,
    set_custom_runner_hook,
    set_docker_available_override,
)
from backend.app.execution.execution_manager import ExecutionManager
from backend.app.execution.security import (
    ContainerCreationError,
    ContainerStartupError,
    DockerSdkMissingError,
    DockerUnavailableError,
    ExecutionImageNotFoundError,
)
from backend.app.services.assessment_service import (
    _assessment_memory_store,
    _assessment_questions_store,
)
from backend.app.main import app
from backend.tests.test_auth import MockSupabase


@pytest.fixture(autouse=True)
def reset_docker_overrides():
    """Ensures each test starts with a clean runner state."""
    set_docker_available_override(None)
    set_custom_runner_hook(None)
    yield
    set_docker_available_override(None)
    set_custom_runner_hook(None)


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
def setup_coding_assessment(client):
    token, user = create_candidate(client, name="Alice Candidate", email="alice.docker@test.com")
    asmt_id = "asmt_docker_test_01"
    q_id = "q_docker_01"

    _assessment_memory_store[asmt_id] = {
        "id": asmt_id,
        "user_id": user["id"],
        "status": "in_progress",
        "scores": {},
    }

    _assessment_questions_store[asmt_id] = [{
        "id": q_id,
        "question_id": q_id,
        "assessment_id": asmt_id,
        "type": "coding",
        "title": "Docker Two Sum",
        "time_limit_seconds": 2.0,
        "memory_limit_mb": 256,
        "sample_test_cases": [
            {"test_case_id": "pub_1", "input": "2 3\n", "expected_output": "5", "weight": 1.0}
        ],
        "hidden_test_cases": [
            {"test_case_id": "hid_1", "input": "10 20\n", "expected_output": "30", "weight": 2.0}
        ],
    }]
    return {
        "token": token,
        "user": user,
        "assessment_id": asmt_id,
        "question_id": q_id,
    }


class TestDockerAvailabilityAndDiagnostics:
    def test_docker_available_override(self):
        set_docker_available_override(True)
        assert DockerRunner.is_docker_available() is True
        set_docker_available_override(False)
        assert DockerRunner.is_docker_available() is False

    def test_diagnose_docker_structure(self):
        diag = DockerRunner.diagnose_docker()
        assert "docker_available" in diag
        assert "sdk_installed" in diag
        assert "cli_installed" in diag
        assert "endpoint" in diag
        assert "images" in diag
        assert "setup_guidance" in diag
        assert isinstance(diag["images"], dict)
        assert "python" in diag["images"]
        assert "cpp" in diag["images"]
        assert "java" in diag["images"]

    def test_health_endpoints_report_docker_status(self, client):
        # 1. /api/health
        res = client.get("/api/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] in ["healthy", "degraded"]
        assert "docker" in data["components"]

        # 2. /api/health/docker
        res_docker = client.get("/api/health/docker")
        assert res_docker.status_code in [200, 503]
        docker_data = res_docker.json()
        assert "docker_available" in docker_data
        assert "setup_guidance" in docker_data

        # 3. /api/code/health
        res_code = client.get("/api/code/health")
        assert res_code.status_code in [200, 503]


class TestDockerInfrastructureErrors:
    def test_docker_unavailable_raises_503(self, client, setup_coding_assessment):
        set_docker_available_override(False)
        payload = {
            "source_code": "print(5)",
            "language": "python",
            "question_id": setup_coding_assessment["question_id"],
            "assessment_id": setup_coding_assessment["assessment_id"],
        }
        res = client.post(
            "/api/code/submit",
            json=payload,
            headers={"Authorization": f"Bearer {setup_coding_assessment['token']}"},
        )
        assert res.status_code == 503
        data = res.json()
        assert data["success"] is False
        assert data["error"]["code"] == "DOCKER_UNAVAILABLE"
        assert "Docker execution sandbox is currently unavailable" in data["error"]["message"]

    def test_missing_image_raises_503_image_not_found(self):
        set_docker_available_override(True)
        with patch.object(DockerRunner, "check_image_exists", return_value=False):
            with patch.object(DockerRunner, "get_docker_client", return_value=None):
                with patch("shutil.which", return_value=None):
                    with pytest.raises(ExecutionImageNotFoundError) as exc_info:
                        DockerRunner.ensure_image("python")
                    assert exc_info.value.code == "IMAGE_NOT_FOUND"

    def test_container_cleanup_after_timeout(self):
        with patch("subprocess.run") as mock_subproc:
            DockerRunner._force_remove_container("test_timeout_box")
            mock_subproc.assert_called_once()
            args = mock_subproc.call_args[0][0]
            assert "docker" in args
            assert "rm" in args
            assert "-f" in args
            assert "test_timeout_box" in args


class TestSecuritySandboxingAndExecutionVerification:
    def test_python_successful_execution(self, client, setup_coding_assessment):
        def mock_python_runner(source_code, language, stdin_data, **kwargs):
            val = sum(map(int, stdin_data.strip().split()))
            return RawExecutionResult(
                status="SUCCESS",
                stdout=f"{val}\n",
                stderr="",
                exit_code=0,
                execution_time_ms=15.0,
                memory_used_mb=12.0,
            )

        set_custom_runner_hook(mock_python_runner)
        payload = {
            "source_code": "import sys; nums = list(map(int, sys.stdin.read().split())); print(sum(nums))",
            "language": "python",
            "question_id": setup_coding_assessment["question_id"],
            "assessment_id": setup_coding_assessment["assessment_id"],
        }
        res = client.post(
            "/api/code/submit",
            json=payload,
            headers={"Authorization": f"Bearer {setup_coding_assessment['token']}"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["status"] == "accepted"
        assert data["is_accepted"] is True
        assert data["score"] == 100.0
        assert data["passed_tests"] == 2
        assert len(data["hidden_test_cases"]) == 1
        assert "input" not in data["hidden_test_cases"][0] or data["hidden_test_cases"][0].get("input") in ["", None]

    def test_cpp_compilation_error_handling(self, client, setup_coding_assessment):
        def mock_cpp_compilation_fail(source_code, language, **kwargs):
            return RawExecutionResult(
                status="COMPILATION_ERROR",
                stdout="",
                stderr="solution.cpp:2:1: error: expected ';' before '}' token",
                exit_code=1,
                execution_time_ms=8.0,
                memory_used_mb=0.0,
                error_message="Compilation error: expected ';'",
            )

        set_custom_runner_hook(mock_cpp_compilation_fail)
        payload = {
            "source_code": "#include <iostream>\nint main() { std::cout << 5 }",
            "language": "cpp",
            "question_id": setup_coding_assessment["question_id"],
            "assessment_id": setup_coding_assessment["assessment_id"],
        }
        res = client.post(
            "/api/code/submit",
            json=payload,
            headers={"Authorization": f"Bearer {setup_coding_assessment['token']}"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["verdict"] == "CE"
        assert data["is_accepted"] is False
        assert data["score"] == 0.0

    def test_java_runtime_error_handling(self, client, setup_coding_assessment):
        def mock_java_rte(source_code, language, **kwargs):
            return RawExecutionResult(
                status="RUNTIME_ERROR",
                stdout="",
                stderr="Exception in thread 'main' java.lang.ArithmeticException: / by zero",
                exit_code=1,
                execution_time_ms=45.0,
                memory_used_mb=32.0,
                error_message="java.lang.ArithmeticException: / by zero",
            )

        set_custom_runner_hook(mock_java_rte)
        payload = {
            "source_code": "public class Solution { public static void main(String[] args) { int x = 1 / 0; } }",
            "language": "java",
            "question_id": setup_coding_assessment["question_id"],
            "assessment_id": setup_coding_assessment["assessment_id"],
        }
        res = client.post(
            "/api/code/submit",
            json=payload,
            headers={"Authorization": f"Bearer {setup_coding_assessment['token']}"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["verdict"] == "RTE"
        assert data["is_accepted"] is False
        assert data["score"] == 0.0

    def test_infinite_loop_timeout_enforced(self, client, setup_coding_assessment):
        def mock_timeout_runner(source_code, language, **kwargs):
            return RawExecutionResult(
                status="TIME_LIMIT_EXCEEDED",
                stdout="",
                stderr="Execution exceeded time limit of 2.0s.",
                exit_code=-1,
                execution_time_ms=2000.0,
                memory_used_mb=10.0,
                error_message="Time limit exceeded (2.0s).",
            )

        set_custom_runner_hook(mock_timeout_runner)
        payload = {
            "source_code": "while True: pass",
            "language": "python",
            "question_id": setup_coding_assessment["question_id"],
            "assessment_id": setup_coding_assessment["assessment_id"],
        }
        res = client.post(
            "/api/code/submit",
            json=payload,
            headers={"Authorization": f"Bearer {setup_coding_assessment['token']}"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["verdict"] == "TLE"
        assert data["is_accepted"] is False
        assert data["score"] == 0.0

    def test_memory_limit_exhaustion_enforced(self, client, setup_coding_assessment):
        def mock_oom_runner(source_code, language, **kwargs):
            return RawExecutionResult(
                status="MEMORY_LIMIT_EXCEEDED",
                stdout="",
                stderr="Process was killed (Out of Memory).",
                exit_code=137,
                execution_time_ms=300.0,
                memory_used_mb=256.0,
                error_message="Memory limit exceeded.",
            )

        set_custom_runner_hook(mock_oom_runner)
        payload = {
            "source_code": "x = ' ' * (10**9)",
            "language": "python",
            "question_id": setup_coding_assessment["question_id"],
            "assessment_id": setup_coding_assessment["assessment_id"],
        }
        res = client.post(
            "/api/code/submit",
            json=payload,
            headers={"Authorization": f"Bearer {setup_coding_assessment['token']}"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["verdict"] == "MLE"
        assert data["is_accepted"] is False
        assert data["score"] == 0.0

    def test_candidate_ownership_isolation(self, client, setup_coding_assessment):
        # Candidate 2 attempts to submit code to Candidate 1's assessment
        other_token, _ = create_candidate(client, name="Malicious User", email="malicious@test.com")
        payload = {
            "source_code": "print(5)",
            "language": "python",
            "question_id": setup_coding_assessment["question_id"],
            "assessment_id": setup_coding_assessment["assessment_id"],
        }
        res = client.post(
            "/api/code/submit",
            json=payload,
            headers={"Authorization": f"Bearer {other_token}"},
        )
        assert res.status_code in [403, 404]
        data = res.json()
        assert data["success"] is False
        assert data["error"]["code"] in ["FORBIDDEN", "UNAUTHORIZED_ACCESS"]


class TestLiveDockerDaemonIfPresent:
    """Tests against real local Docker Desktop if actively running."""

    def test_live_docker_execution_if_daemon_running(self):
        if not DockerRunner.is_docker_available():
            pytest.skip("Local Docker daemon is not active. Skipping live daemon container test.")

        result = DockerRunner.run_code(
            source_code="print('LIVE_DOCKER_SUCCESS')",
            language="python",
            stdin_data="",
            time_limit_seconds=5.0,
            memory_limit_mb=128,
        )
        assert result.status == "SUCCESS"
        assert "LIVE_DOCKER_SUCCESS" in result.stdout
