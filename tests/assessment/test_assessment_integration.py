import json
from unittest.mock import MagicMock, patch
import httpx
import pytest
from fastapi.testclient import TestClient

from backend.app.ai_engine.featherless_client import (
    FeatherlessAuthError,
    FeatherlessClient,
    FeatherlessRateLimitError,
    FeatherlessTimeoutError,
    _mask_secret,
)
from backend.app.ai_engine.question_generator import (
    QuestionGenerator,
    generate_portfolio_calibrated_fallback,
)
from backend.app.core.config import settings
from backend.app.database.supabase import set_supabase_client
from backend.app.main import app
from backend.app.schemas.assessment import (
    GeneratedAssessmentSchema,
    GeneratedQuestionSchema,
)
from backend.app.services.assessment_service import _assessment_memory_store
from backend.app.validation.question_validator import (
    QuestionValidationError,
    sanitize_assessment_for_candidate,
    validate_generated_assessment,
)
from backend.tests.test_auth import MockSupabase


@pytest.fixture
def mock_supabase():
    mock = MockSupabase()

    class MockStorageBucket:
        def __init__(self):
            self.files = {}

        def upload(self, path: str, file: bytes, file_options=None):
            self.files[path] = file
            return type("UploadResponse", (), {"path": path})()

        def download(self, path: str) -> bytes:
            if path in self.files:
                return self.files[path]
            raise Exception("File not found")

        def remove(self, paths):
            for p in paths:
                self.files.pop(p, None)

    class MockStorage:
        def __init__(self):
            self.buckets = [type("Bucket", (), {"name": "portfolios"})()]
            self._bucket = MockStorageBucket()

        def list_buckets(self):
            return self.buckets

        def create_bucket(self, name, options=None):
            return {"name": name}

        def from_(self, bucket_name):
            return self._bucket

    mock.storage = MockStorage()
    set_supabase_client(mock)
    yield mock
    set_supabase_client(None)


@pytest.fixture
def client(mock_supabase):
    return TestClient(app)


def create_student(client, name="Alice Dev", email="alice@test.com"):
    res = client.post(
        "/api/auth/student/register",
        json={"full_name": name, "email": email, "password": "Password123!"},
    )
    assert res.status_code == 201
    return res.json()["access_token"], res.json()["user"]


def create_company(client, name="HiringCorp", email="recruiter@hiring.com"):
    res = client.post(
        "/api/auth/company/register",
        json={"company_name": name, "official_email": email, "password": "Password123!"},
    )
    assert res.status_code == 201
    return res.json()["access_token"], res.json()["user"]


def upload_portfolio_for_student(client, token):
    res = client.post(
        "/api/portfolio/upload",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "github_url": "https://github.com/alicedev/high-throughput-system",
            "primary_languages": ["Python", "TypeScript"],
            "frameworks": ["FastAPI", "React", "PostgreSQL"],
            "headline": "Full-Stack Backend Specialist",
            "bio": "Experienced in high-throughput order matching and async systems.",
            "projects": [
                {
                    "title": "Crypto Matching Engine",
                    "description": "Sub-millisecond FIFO order matching using Redis and Python Asyncio.",
                    "tech_stack": ["Python", "FastAPI", "Redis", "Docker"],
                }
            ],
        },
    )
    assert res.status_code == 201
    return res.json()["portfolio"]


class TestAssessmentGenerationAndSecurity:
    """Test suite for AI Assessment generation, validation, privacy, and error handling."""

    def test_generate_assessment_missing_portfolio(self, client):
        """Student without uploaded portfolio should receive 404 PORTFOLIO_NOT_FOUND."""
        token, _ = create_student(client, email="no_portfolio@test.com")
        res = client.post(
            "/api/assessment/generate",
            headers={"Authorization": f"Bearer {token}"},
            json={"target_role": "Backend Engineer"},
        )
        assert res.status_code == 404
        data = res.json()
        assert data["success"] is False
        assert data["error"]["code"] == "PORTFOLIO_NOT_FOUND"

    def test_generate_assessment_empty_portfolio(self, client, mock_supabase):
        """Student with empty portfolio should receive 400 EMPTY_PORTFOLIO."""
        token, user = create_student(client, email="empty_portfolio@test.com")
        # Inject an empty portfolio directly into storage/service
        from backend.app.services.portfolio_service import _portfolio_memory_store
        _portfolio_memory_store[user["id"]] = {
            "id": "empty-p-1",
            "user_id": user["id"],
            "github_url": "https://github.com/empty/empty",
            "primary_languages": [],
            "frameworks": [],
        }

        res = client.post(
            "/api/assessment/generate",
            headers={"Authorization": f"Bearer {token}"},
            json={"target_role": "Backend Engineer"},
        )
        assert res.status_code == 400
        data = res.json()
        assert data["success"] is False
        assert data["error"]["code"] == "EMPTY_PORTFOLIO"

    def test_generate_assessment_valid_portfolio_success(self, client):
        """Valid portfolio generates a personalized 60-minute assessment with zero test leaks."""
        token, user = create_student(client, email="valid_student@test.com")
        portfolio = upload_portfolio_for_student(client, token)

        res = client.post(
            "/api/assessment/generate",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "portfolio_id": portfolio["id"],
                "target_role": "Backend Systems Engineer",
                "difficulty_preference": "medium",
                "question_count": 3,
            },
        )
        assert res.status_code == 201
        data = res.json()
        assert data["success"] is True
        assessment = data["assessment"]

        # Check structure
        assert assessment["duration_minutes"] == 60
        assert assessment["total_time_limit_minutes"] == 60
        assert assessment["status"] == "ready"
        assert len(assessment["questions"]) == 3

        # Verify question details are present
        for q in assessment["questions"]:
            assert "question_id" in q or "id" in q
            assert len(q["title"]) > 3
            assert len(q["description"]) > 10
            assert "difficulty" in q
            assert "topic" in q
            assert "constraints" in q
            assert "examples" in q
            assert len(q["examples"]) >= 1
            assert "allowed_languages" in q

            # SECURITY CHECK: Hidden test cases and reference solutions MUST NOT be returned!
            assert "hidden_test_cases" not in q
            assert "reference_solution" not in q

        # Verify no root leaks
        raw_text = res.text
        assert "reference_solution" not in raw_text
        assert "hidden_test_cases" not in raw_text

    def test_get_assessment_by_id_owner_success(self, client):
        """Owner candidate can fetch their assessment by ID."""
        token, user = create_student(client, email="owner_student@test.com")
        upload_portfolio_for_student(client, token)

        gen_res = client.post(
            "/api/assessment/generate",
            headers={"Authorization": f"Bearer {token}"},
            json={"target_role": "Backend Engineer"},
        )
        assert gen_res.status_code == 201
        assessment_id = gen_res.json()["assessment"]["id"]

        get_res = client.get(
            f"/api/assessment/{assessment_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert get_res.status_code == 200
        data = get_res.json()
        assert data["success"] is True
        assert data["assessment"]["id"] == assessment_id
        # Ensure confidentiality
        assert "hidden_test_cases" not in get_res.text

    def test_student_cannot_access_other_student_assessment(self, client):
        """Candidate B attempting to access Candidate A's assessment gets 403 UNAUTHORIZED_ACCESS."""
        token_a, _ = create_student(client, email="student_a@test.com")
        token_b, _ = create_student(client, email="student_b@test.com")
        upload_portfolio_for_student(client, token_a)

        gen_res = client.post(
            "/api/assessment/generate",
            headers={"Authorization": f"Bearer {token_a}"},
            json={"target_role": "Backend Engineer"},
        )
        assert gen_res.status_code == 201
        assessment_id = gen_res.json()["assessment"]["id"]

        # Student B attempts access
        unauthorized_res = client.get(
            f"/api/assessment/{assessment_id}",
            headers={"Authorization": f"Bearer {token_b}"},
        )
        assert unauthorized_res.status_code == 403
        data = unauthorized_res.json()
        assert data["success"] is False
        assert data["error"]["code"] == "UNAUTHORIZED_ACCESS"

    def test_list_candidate_assessments(self, client):
        """Candidate can list all assessments generated for them."""
        token, user = create_student(client, email="lister@test.com")
        upload_portfolio_for_student(client, token)

        client.post(
            "/api/assessment/generate",
            headers={"Authorization": f"Bearer {token}"},
            json={"target_role": "Backend Engineer"},
        )

        res = client.get("/api/assessment", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert len(data["assessments"]) >= 1

    def test_get_active_session_and_start(self, client):
        """Candidate can fetch active assessment session and start it."""
        token, user = create_student(client, email="session_tester@test.com")
        upload_portfolio_for_student(client, token)

        # Generate assessment
        client.post(
            "/api/assessment/generate",
            headers={"Authorization": f"Bearer {token}"},
            json={"target_role": "Software Engineer"},
        )

        # Get active session
        active_res = client.get(
            "/api/assessment/active",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert active_res.status_code == 200
        session_data = active_res.json()["session"]
        assert session_data["status"] == "in_progress"
        assert session_data["duration_seconds"] == 3600
        assert len(session_data["questions"]) > 0

    def test_company_cannot_generate_assessment(self, client):
        """Company recruiter accounts cannot generate student assessments."""
        company_token, _ = create_company(client, email="recruiter_corp@test.com")
        res = client.post(
            "/api/assessment/generate",
            headers={"Authorization": f"Bearer {company_token}"},
            json={"target_role": "Backend Engineer"},
        )
        assert res.status_code == 403
        data = res.json()
        assert data["success"] is False
        assert data["error"]["code"] == "ROLE_MISMATCH"


class TestFeatherlessClientAndErrorResilience:
    """Tests covering Featherless AI timeout, rate limiting, invalid keys, and malformed outputs."""

    def test_featherless_api_timeout(self):
        """Client properly handles timeouts by raising FeatherlessTimeoutError."""
        fake_client = FeatherlessClient(timeout=0.01, max_retries=0)
        with patch("httpx.Client.post", side_effect=httpx.TimeoutException("Read timed out")):
            with pytest.raises(FeatherlessTimeoutError) as exc_info:
                fake_client.chat_completion([{"role": "user", "content": "hi"}])
            assert "timed out" in str(exc_info.value).lower()
            assert exc_info.value.status_code == 504

    def test_featherless_invalid_api_key(self):
        """HTTP 401 returns FeatherlessAuthError without leaking key."""
        fake_client = FeatherlessClient(api_key="secret-key-12345", max_retries=0)
        mock_resp = MagicMock()
        mock_resp.status_code = 401
        mock_resp.text = "Unauthorized: Invalid API Key"

        with patch("httpx.Client.post", return_value=mock_resp):
            with pytest.raises(FeatherlessAuthError) as exc_info:
                fake_client.chat_completion([{"role": "user", "content": "hi"}])
            assert "authentication with featherless ai failed" in str(exc_info.value).lower()
            # Verify secret is masked
            assert "secret-key-12345" not in str(exc_info.value)

    def test_featherless_rate_limiting(self):
        """HTTP 429 raises FeatherlessRateLimitError when max retries exceeded."""
        fake_client = FeatherlessClient(max_retries=0)
        mock_resp = MagicMock()
        mock_resp.status_code = 429
        mock_resp.text = "Too Many Requests"

        with patch("httpx.Client.post", return_value=mock_resp):
            with pytest.raises(FeatherlessRateLimitError) as exc_info:
                fake_client.chat_completion([{"role": "user", "content": "hi"}])
            assert "rate limit exceeded" in str(exc_info.value).lower()

    def test_malformed_ai_response_triggers_adaptive_fallback(self):
        """Malformed AI output activates calibrated adaptive synthesizer fallback."""
        mock_ai = MagicMock()
        mock_ai.chat_completion.return_value = {
            "choices": [{"message": {"content": "This is not JSON at all! Just plain text."}}]
        }
        generator = QuestionGenerator(client=mock_ai)

        portfolio_data = {
            "primary_languages": ["Python"],
            "frameworks": ["FastAPI"],
            "projects": [{"title": "FastAPI Order Stream"}],
        }

        # Should not crash; must safely fall back to calibrated assessment
        assessment = generator.generate_assessment(portfolio_data)
        assert isinstance(assessment, GeneratedAssessmentSchema)
        assert assessment.duration_minutes == 60
        assert len(assessment.questions) == 3
        assert "Python" in assessment.questions[0].title or "Sliding Window" in assessment.questions[0].title

    def test_question_validator_rejects_empty_fields(self):
        """Validator raises QuestionValidationError when question is missing required fields."""
        broken_assessment = GeneratedAssessmentSchema(
            title="Broken Assessment",
            duration_minutes=60,
            questions=[
                GeneratedQuestionSchema(
                    question_id="q1",
                    title="",  # Broken: empty title
                    description="Too short",
                    examples=[],  # Broken: empty examples
                )
            ],
        )

        with pytest.raises(QuestionValidationError) as exc:
            validate_generated_assessment(broken_assessment)
        assert "title is too short" in str(exc.value)

    def test_mask_secret_helper(self):
        """Secret masking utility never exposes keys."""
        assert _mask_secret(None) == "<empty>"
        assert _mask_secret("") == "<empty>"
        assert _mask_secret("short") == "***"
        masked = _mask_secret("featherless_secret_key_123456789")
        assert masked == "feat...6789"
        assert "secret_key" not in masked


class TestFullAssessmentWorkflowAndHints:
    """Verifies end-to-end integration for hints, code execution, scoring, completion, and timer."""

    def test_guarded_assistant_hint_request(self, client):
        """Student requests progressive hint without solution leakage."""
        token, _ = create_student(client, email="hint_student@test.com")
        res = client.post(
            "/api/assistant/hint",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "question_id": "q1",
                "question_title": "Sliding Window Maximum Throughput",
                "hint_level": 1,
                "language": "python",
                "current_code": "def max_throughput(timestamps, k):\n    pass\n",
            },
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert "hint" in data
        assert data["hint"]["level"] == 1
        assert len(data["hint"]["content"]) > 10
        # Leak check
        assert "def max_throughput" not in data["hint"]["content"]

    def test_guarded_assistant_role_guard(self, client):
        """Company recruiter is forbidden from requesting student hints."""
        token, _ = create_company(client, email="recruiter_hint@test.com")
        res = client.post(
            "/api/assistant/hint",
            headers={"Authorization": f"Bearer {token}"},
            json={"question_id": "q1", "hint_level": 1},
        )
        assert res.status_code == 403
        assert res.json()["error"]["code"] == "ROLE_MISMATCH"

    def test_run_public_tests_endpoint(self, client):
        """Student executes code against public test cases."""
        token, _ = create_student(client, email="runner_student@test.com")
        upload_portfolio_for_student(client, token)

        # Generate assessment
        gen_res = client.post(
            "/api/assessment/generate",
            headers={"Authorization": f"Bearer {token}"},
            json={"target_role": "Software Engineer"},
        )
        assessment = gen_res.json()["assessment"]
        q = assessment["questions"][0]

        run_res = client.post(
            "/api/assessment/run",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "assessment_id": assessment["id"],
                "question_id": q["question_id"],
                "language": "python",
                "code": "print(3)",  # Matches expected_output '3' for sample test case
            },
        )
        assert run_res.status_code == 200
        run_data = run_res.json()
        assert run_data["success"] is True
        assert "overall_verdict" in run_data
        assert "results" in run_data

    def test_submit_solution_endpoint(self, client):
        """Student submits solution and receives graded summary."""
        token, _ = create_student(client, email="submit_student@test.com")
        upload_portfolio_for_student(client, token)

        gen_res = client.post(
            "/api/assessment/generate",
            headers={"Authorization": f"Bearer {token}"},
            json={"target_role": "Backend Engineer"},
        )
        assessment = gen_res.json()["assessment"]
        q = assessment["questions"][0]

        sub_res = client.post(
            "/api/submissions",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "assessment_id": assessment["id"],
                "question_id": q["question_id"],
                "language": "python",
                "code": "print(3)",
                "elapsed_seconds": 150,
                "hints_used": 1,
            },
        )
        assert sub_res.status_code == 200
        sub_data = sub_res.json()
        assert sub_data["success"] is True
        assert "summary" in sub_data
        assert "deterministic_score" in sub_data["summary"]

        # Check latest submission endpoint
        latest_res = client.get("/api/submissions/latest", headers={"Authorization": f"Bearer {token}"})
        assert latest_res.status_code == 200
        assert latest_res.json()["success"] is True

    def test_complete_assessment_and_results(self, client):
        """Student completes assessment and retrieves comprehensive results report."""
        token, _ = create_student(client, email="complete_student@test.com")
        upload_portfolio_for_student(client, token)

        gen_res = client.post(
            "/api/assessment/generate",
            headers={"Authorization": f"Bearer {token}"},
            json={"target_role": "Backend Engineer"},
        )
        assessment_id = gen_res.json()["assessment"]["id"]

        comp_res = client.post(
            f"/api/assessment/{assessment_id}/complete",
            headers={"Authorization": f"Bearer {token}"},
            json={"elapsed_seconds": 1800, "total_hints_used": 2},
        )
        assert comp_res.status_code == 200
        comp_data = comp_res.json()
        assert comp_data["success"] is True
        assert comp_data["result"]["completion_status"] == "completed"

        # Check get results
        get_res = client.get(f"/api/assessment/{assessment_id}/results", headers={"Authorization": f"Bearer {token}"})
        assert get_res.status_code == 200
        assert get_res.json()["result"]["assessment_id"] == assessment_id

        # Check latest results
        latest_res = client.get("/api/assessment/results/latest", headers={"Authorization": f"Bearer {token}"})
        assert latest_res.status_code == 200

    def test_backend_authoritative_timer_and_refresh_survival(self, client):
        """Backend establishes authoritative start timestamp and computes remaining seconds across refreshes."""
        token, _ = create_student(client, email="timer_student@test.com")
        upload_portfolio_for_student(client, token)

        gen_res = client.post(
            "/api/assessment/generate",
            headers={"Authorization": f"Bearer {token}"},
            json={"target_role": "Backend Engineer"},
        )
        assessment_id = gen_res.json()["assessment"]["id"]

        # Start session
        start_res = client.post(
            f"/api/assessment/{assessment_id}/start",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert start_res.status_code == 200
        start_session = start_res.json()["session"]
        assert "started_at" in start_session
        assert start_session["started_at"] is not None
        initial_remaining = start_session["remaining_seconds"]
        assert initial_remaining <= 3600

        # Simulate page refresh by fetching session directly
        refresh_res = client.get(
            f"/api/assessment/{assessment_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert refresh_res.status_code == 200
        refreshed_assessment = refresh_res.json()["assessment"]
        assert "remaining_seconds" in refreshed_assessment
        assert refreshed_assessment["started_at"] == start_session["started_at"]

