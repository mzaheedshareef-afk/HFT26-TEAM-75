"""
End-to-End Contract & Security Tests for:
1. GET /api/assessment/active
2. GET /api/submissions/latest
3. GET /api/assessment/results/latest

Verifies:
- Candidate authentication and ownership checks
- 200 OK consistent empty states (no false 404s)
- Redaction of secret keys, reference solutions, and hidden test cases
- Accurate score breakdowns from completed assessments
- Cross-candidate data isolation
"""

import pytest
from fastapi.testclient import TestClient

from backend.app.database.supabase import set_supabase_client
from backend.app.execution.docker_runner import (
    RawExecutionResult,
    set_custom_runner_hook,
    set_docker_available_override,
)
from backend.app.grading.grading_engine import _submissions_memory_store, _assessment_results_memory_store
from backend.app.main import app
from backend.app.services.assessment_service import (
    _assessment_memory_store,
    _assessment_questions_store,
    _assessment_results_store,
    _candidate_answers_store,
    _user_assessments_index,
)
from backend.tests.test_auth import MockSupabase
from backend.tests.test_recruiter import register_company, register_student


@pytest.fixture(autouse=True)
def clean_assessment_stores():
    """Resets memory stores and sets runner hooks between test runs."""
    def test_runner_hook(source_code="", language="", stdin_data="", **kwargs):
        return RawExecutionResult(
            status="SUCCESS",
            stdout="[2, 2]\n",
            stderr="",
            exit_code=0,
            execution_time_ms=10.0,
            memory_used_mb=15.0,
        )

    set_docker_available_override(True)
    set_custom_runner_hook(test_runner_hook)

    _assessment_memory_store.clear()
    _assessment_questions_store.clear()
    _candidate_answers_store.clear()
    _user_assessments_index.clear()
    _submissions_memory_store.clear()
    _assessment_results_store.clear()
    _assessment_results_memory_store.clear()
    yield
    set_docker_available_override(None)
    set_custom_runner_hook(None)
    _assessment_memory_store.clear()
    _assessment_questions_store.clear()
    _candidate_answers_store.clear()
    _user_assessments_index.clear()
    _submissions_memory_store.clear()
    _assessment_results_store.clear()
    _assessment_results_memory_store.clear()


@pytest.fixture
def mock_supabase():
    mock = MockSupabase()
    set_supabase_client(mock)
    yield mock
    set_supabase_client(None)


@pytest.fixture
def client(mock_supabase):
    return TestClient(app)


class TestAssessmentSubmissionResultsRoutes:
    def test_unauthorized_access_blocked(self, client):
        """Endpoints strictly require valid Authorization token header."""
        res_active = client.get("/api/assessment/active")
        assert res_active.status_code == 401
        assert res_active.json()["error"]["code"] == "UNAUTHORIZED"

        res_sub = client.get("/api/submissions/latest")
        assert res_sub.status_code == 401
        assert res_sub.json()["error"]["code"] == "UNAUTHORIZED"

        res_res = client.get("/api/assessment/results/latest")
        assert res_res.status_code == 401
        assert res_res.json()["error"]["code"] == "UNAUTHORIZED"

    def test_company_recruiter_blocked_from_student_routes(self, client):
        """Company recruiter accounts cannot access student-exclusive assessment endpoints."""
        company_token, _ = register_company(client, "Acme Corp", "recruiter@acme.com")
        headers = {"Authorization": f"Bearer {company_token}"}

        res_active = client.get("/api/assessment/active", headers=headers)
        assert res_active.status_code == 403
        assert res_active.json()["error"]["code"] == "ROLE_MISMATCH"

        res_sub = client.get("/api/submissions/latest", headers=headers)
        assert res_sub.status_code == 403
        assert res_sub.json()["error"]["code"] == "ROLE_MISMATCH"

        res_res = client.get("/api/assessment/results/latest", headers=headers)
        assert res_res.status_code == 403
        assert res_res.json()["error"]["code"] == "ROLE_MISMATCH"

    def test_candidate_with_no_assessment_empty_state(self, client):
        """When student has generated zero assessments, endpoints return 200 with empty state rather than 404."""
        token, user = register_student(client, "No Assessment Student", "no_assessment@test.com")
        headers = {"Authorization": f"Bearer {token}"}

        res_active = client.get("/api/assessment/active", headers=headers)
        assert res_active.status_code == 200
        data_active = res_active.json()
        assert data_active["success"] is True
        assert data_active["session"] is None
        assert data_active["assessment"] is None

        res_results = client.get("/api/assessment/results/latest", headers=headers)
        assert res_results.status_code == 200
        data_results = res_results.json()
        assert data_results["success"] is True
        assert data_results["results"] is None
        assert data_results["result"] is None

    def test_candidate_with_no_submissions_empty_state(self, client):
        """When candidate has submitted zero solutions, GET /api/submissions/latest returns 200 with null summary."""
        token, user = register_student(client, "No Subs Student", "no_subs@test.com")
        headers = {"Authorization": f"Bearer {token}"}

        res = client.get("/api/submissions/latest", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["summary"] is None
        assert data["submission"] is None

    def test_candidate_active_assessment_retrieval_and_sanitization(self, client):
        """Active session returns sanitized questions; hidden tests and reference solutions are strictly stripped."""
        token, user = register_student(client, "Active Candidate", "active_cand@test.com")
        headers = {"Authorization": f"Bearer {token}"}

        # Seed portfolio
        upload_res = client.post(
            "/api/portfolio/upload",
            headers=headers,
            json={
                "github_url": "https://github.com/active/project",
                "primary_languages": ["Python"],
                "skills": ["Python", "FastAPI"],
                "dsa_topics_solved": ["Arrays"],
            },
        )
        assert upload_res.status_code in (200, 201)

        # Generate assessment
        gen_res = client.post(
            "/api/assessment/generate",
            headers=headers,
            json={"target_role": "Backend Engineer", "question_count": 3, "mcq_count": 1, "msq_count": 1, "coding_count": 1},
        )
        assert gen_res.status_code == 201
        gen_data = gen_res.json()["assessment"]
        aid = gen_data["id"]

        # Call GET /api/assessment/active
        active_res = client.get("/api/assessment/active", headers=headers)
        assert active_res.status_code == 200
        active_data = active_res.json()
        assert active_data["success"] is True
        session = active_data["session"]
        assert session["assessment_id"] == aid
        assert session["status"] in ("ready", "in_progress")
        assert len(session["questions"]) == 3

        # Zero-trust verification: confidential keys must NEVER leak
        for q in session["questions"]:
            assert "correct_answer" not in q
            assert "correct_answers" not in q
            assert "explanation" not in q
            assert "hidden_test_cases" not in q
            assert "reference_solution" not in q
            assert "solution_code" not in q

    def test_candidate_submission_and_latest_submission_retrieval(self, client):
        """Candidate submits code and immediately retrieves it via GET /api/submissions/latest."""
        token, user = register_student(client, "Coder Candidate", "coder@test.com")
        headers = {"Authorization": f"Bearer {token}"}

        # Seed portfolio & generate assessment
        client.post(
            "/api/portfolio/upload",
            headers=headers,
            json={"github_url": "https://github.com/coder/repo", "primary_languages": ["Python"], "dsa_topics_solved": ["Arrays"]},
        )
        gen_res = client.post(
            "/api/assessment/generate",
            headers=headers,
            json={"question_count": 2, "mcq_count": 1, "msq_count": 0, "coding_count": 1},
        )
        aid = gen_res.json()["assessment"]["id"]

        # Get questions
        active_res = client.get("/api/assessment/active", headers=headers)
        coding_q = next(q for q in active_res.json()["session"]["questions"] if q.get("question_type") == "coding")
        qid = coding_q["question_id"]

        # Submit code solution
        sub_res = client.post(
            "/api/code/submit",
            headers=headers,
            json={
                "assessment_id": aid,
                "question_id": qid,
                "language": "python",
                "source_code": "def solution():\n    return True\n",
                "elapsed_seconds": 45,
            },
        )
        assert sub_res.status_code == 200
        sub_id = sub_res.json()["submission_id"]

        # Fetch latest submission via GET /api/submissions/latest
        latest_res = client.get("/api/submissions/latest", headers=headers)
        assert latest_res.status_code == 200
        data = latest_res.json()
        assert data["success"] is True
        summary = data["summary"]
        assert summary["submission_id"] == sub_id
        assert summary["assessment_id"] == aid
        assert summary["question_id"] == qid
        assert summary["language"] == "python"
        assert "score" in summary
        assert "passed_tests" in summary
        assert "total_tests" in summary

        # Also test alias /api/assessment/submissions/latest
        alias_res = client.get("/api/assessment/submissions/latest", headers=headers)
        assert alias_res.status_code == 200
        assert alias_res.json()["summary"]["submission_id"] == sub_id

    def test_candidate_completed_assessment_latest_results(self, client):
        """Candidate completes assessment and retrieves official results via GET /api/assessment/results/latest."""
        token, user = register_student(client, "Finisher Candidate", "finisher@test.com")
        headers = {"Authorization": f"Bearer {token}"}

        client.post(
            "/api/portfolio/upload",
            headers=headers,
            json={"github_url": "https://github.com/finisher/repo", "primary_languages": ["Python"], "dsa_topics_solved": ["Arrays"]},
        )
        gen_res = client.post(
            "/api/assessment/generate",
            headers=headers,
            json={"question_count": 3, "mcq_count": 2, "msq_count": 1, "coding_count": 0},
        )
        aid = gen_res.json()["assessment"]["id"]

        # Complete assessment
        comp_res = client.post(
            f"/api/assessment/{aid}/complete",
            headers=headers,
            json={"elapsed_seconds": 120, "total_hints_used": 0},
        )
        assert comp_res.status_code == 200

        # Retrieve via GET /api/assessment/results/latest
        res = client.get("/api/assessment/results/latest", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        results = data["results"]
        assert results["assessment_id"] == aid
        assert results["status"] == "completed"
        assert "total_score" in results
        assert "percentage" in results
        assert "mcq_score" in results
        assert "msq_score" in results
        assert "questions" in results

        # Also verify alias GET /api/submissions/results/latest
        alias_res = client.get("/api/submissions/results/latest", headers=headers)
        assert alias_res.status_code == 200
        assert alias_res.json()["results"]["assessment_id"] == aid

    def test_cross_candidate_data_isolation(self, client):
        """Strict isolation: Candidate B cannot access Candidate A's assessment, submissions, or results."""
        token_a, user_a = register_student(client, "Alice A", "alice@test.com")
        token_b, user_b = register_student(client, "Bob B", "bob@test.com")

        headers_a = {"Authorization": f"Bearer {token_a}"}
        headers_b = {"Authorization": f"Bearer {token_b}"}

        # Alice creates assessment
        client.post(
            "/api/portfolio/upload",
            headers=headers_a,
            json={"github_url": "https://github.com/alice/repo", "primary_languages": ["Python"], "dsa_topics_solved": ["Arrays"]},
        )
        gen_res = client.post(
            "/api/assessment/generate",
            headers=headers_a,
            json={"question_count": 2, "mcq_count": 1, "msq_count": 0, "coding_count": 1},
        )
        aid_a = gen_res.json()["assessment"]["id"]

        # Bob calls GET /api/assessment/active -> receives None (empty state for Bob)
        bob_active = client.get("/api/assessment/active", headers=headers_b)
        assert bob_active.status_code == 200
        assert bob_active.json()["session"] is None

        # Bob calls GET /api/submissions/latest -> receives None (empty state for Bob)
        bob_sub = client.get("/api/submissions/latest", headers=headers_b)
        assert bob_sub.status_code == 200
        assert bob_sub.json()["summary"] is None

        # Bob calls GET /api/assessment/results/latest -> receives None (empty state for Bob)
        bob_res = client.get("/api/assessment/results/latest", headers=headers_b)
        assert bob_res.status_code == 200
        assert bob_res.json()["results"] is None

        # Bob explicitly tries to query Alice's assessment results by ID -> 403 Forbidden
        bob_steal = client.get(f"/api/assessment/{aid_a}/results", headers=headers_b)
        assert bob_steal.status_code == 403
        assert bob_steal.json()["error"]["code"] == "UNAUTHORIZED_ACCESS"
