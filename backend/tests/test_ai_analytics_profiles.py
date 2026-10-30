"""
Comprehensive Test Suite for AI Hints, Efficiency Scoring, Analytics and Public Profiles
Role: Testing & Integration Lead (Vasil)
Project: Portfolio-Driven Adaptive Coding & Technical Assessment Platform
Team: HFT26-TEAM-75

Covers all 5 Modules:
1. Progressive AI Hints (Level 1, 2, 3, Leakage Prevention, Rate Limits, Timeouts)
2. AI Interaction Tracking
3. AI Efficiency Scoring (Deterministic v1.0, Difficulty Normalization, Boundary Conditions)
4. Candidate Performance Analytics & Historical Trends (Data Isolation, Empty State)
5. Public Student Profiles & Privacy Controls (Zero Sensitive Field Leakage, Revocation)
"""

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from backend.app.ai_engine.featherless_client import FeatherlessTimeoutError
from backend.app.ai_engine.guarded_assistant import GuardedAIAssistant
from backend.app.database.supabase import set_supabase_client
from backend.app.grading.grading_engine import (
    _assessment_results_memory_store,
    _submissions_memory_store,
)
from backend.app.main import app
from backend.app.services.assessment_service import (
    _assessment_memory_store,
    _assessment_questions_store,
    _user_assessments_index,
)
from backend.app.services.efficiency_service import AIEfficiencyScorer
from backend.app.services.hint_service import (
    MAX_HINTS_PER_QUESTION,
    HintService,
    _hint_interactions_store,
)
from backend.app.services.profile_service import (
    ProfileService,
    _public_profiles_by_share_id,
    _public_profiles_store,
)
from backend.tests.test_auth import MockSupabase


@pytest.fixture(autouse=True)
def clean_all_stores():
    """Resets memory stores between tests."""
    _hint_interactions_store.clear()
    _public_profiles_store.clear()
    _public_profiles_by_share_id.clear()
    yield
    _hint_interactions_store.clear()
    _public_profiles_store.clear()
    _public_profiles_by_share_id.clear()


@pytest.fixture
def mock_supabase():
    mock = MockSupabase()
    set_supabase_client(mock)
    yield mock
    set_supabase_client(None)


@pytest.fixture
def client(mock_supabase):
    return TestClient(app)


def register_student(client: TestClient, name="Ada Lovelace", email="ada@example.com"):
    res = client.post(
        "/api/auth/student/register",
        json={"full_name": name, "email": email, "password": "Password123!"},
    )
    assert res.status_code == 201
    return res.json()["access_token"], res.json()["user"]


def register_company(client: TestClient, name="TechCorp Recruiter", email="recruiter@techcorp.com"):
    res = client.post(
        "/api/auth/company/register",
        json={"company_name": name, "official_email": email, "password": "Password123!"},
    )
    assert res.status_code == 201
    return res.json()["access_token"], res.json()["user"]


@pytest.fixture
def candidate_assessment_setup(client):
    token, user = register_student(client, name="Grace Hopper", email="hopper@code.org")
    user_id = user["id"]
    assessment_id = f"assess_{user_id[:8]}"
    question_id_1 = f"q1_{user_id[:8]}"
    question_id_2 = f"q2_{user_id[:8]}"

    assess_data = {
        "id": assessment_id,
        "assessment_id": assessment_id,
        "user_id": user_id,
        "title": "Systems & Concurrency Assessment",
        "difficulty": "medium",
        "status": "in_progress",
        "total_time_limit_minutes": 60,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _assessment_memory_store[assessment_id] = assess_data
    if user_id not in _user_assessments_index:
        _user_assessments_index[user_id] = []
    if assessment_id not in _user_assessments_index[user_id]:
        _user_assessments_index[user_id].append(assessment_id)

    q1_data = {
        "id": question_id_1,
        "question_id": question_id_1,
        "assessment_id": assessment_id,
        "title": "Two-Sum Target Pair",
        "description": "Find indices of two numbers that add up to target.",
        "difficulty": "easy",
        "target_skill": "Hash Tables",
        "category": "Algorithms",
    }
    q2_data = {
        "id": question_id_2,
        "question_id": question_id_2,
        "assessment_id": assessment_id,
        "title": "LRU Cache Replacement",
        "description": "Implement a Least Recently Used (LRU) Cache in O(1) time.",
        "difficulty": "hard",
        "target_skill": "Data Structures",
        "category": "Systems",
    }
    _assessment_questions_store[assessment_id] = [q1_data, q2_data]

    return {
        "token": token,
        "user": user,
        "assessment_id": assessment_id,
        "q1_id": question_id_1,
        "q2_id": question_id_2,
    }


# =============================================================
# 1. AI Hints & Progressive Guardrails Tests
# =============================================================

class TestAIHintEngine:

    def test_valid_hint_request(self, client, candidate_assessment_setup):
        setup = candidate_assessment_setup
        res = client.post(
            f"/api/assessment/{setup['assessment_id']}/questions/{setup['q1_id']}/hint",
            headers={"Authorization": f"Bearer {setup['token']}"},
            json={"hint_level": 1, "language": "python"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["level"] == 1
        assert "hint_text" in data
        assert len(data["hint_text"]) > 20
        assert "def " not in data["hint_text"]

    def test_progressive_hint_levels(self, client, candidate_assessment_setup):
        setup = candidate_assessment_setup
        token = setup["token"]
        aid = setup["assessment_id"]
        qid = setup["q1_id"]

        # Request Level 1
        r1 = client.post(
            f"/api/assessment/{aid}/questions/{qid}/hint",
            headers={"Authorization": f"Bearer {token}"},
            json={"hint_level": 1},
        )
        assert r1.status_code == 200
        assert r1.json()["level"] == 1

        # Request Level 2
        r2 = client.post(
            f"/api/assessment/{aid}/questions/{qid}/hint",
            headers={"Authorization": f"Bearer {token}"},
            json={"hint_level": 2},
        )
        assert r2.status_code == 200
        assert r2.json()["level"] == 2

        # Request Level 3
        r3 = client.post(
            f"/api/assessment/{aid}/questions/{qid}/hint",
            headers={"Authorization": f"Bearer {token}"},
            json={"hint_level": 3},
        )
        assert r3.status_code == 200
        assert r3.json()["level"] == 3

        # History should have 3 items
        rh = client.get(
            f"/api/assessment/{aid}/questions/{qid}/hints",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert rh.status_code == 200
        assert rh.json()["total_hints"] == 3

    def test_excessive_requests(self, client, candidate_assessment_setup):
        setup = candidate_assessment_setup
        token = setup["token"]
        aid = setup["assessment_id"]
        qid = setup["q1_id"]

        for lvl in range(1, MAX_HINTS_PER_QUESTION + 1):
            r = client.post(
                f"/api/assessment/{aid}/questions/{qid}/hint",
                headers={"Authorization": f"Bearer {token}"},
                json={"hint_level": lvl},
            )
            assert r.status_code == 200

        # 4th request exceeds limit
        r_excess = client.post(
            f"/api/assessment/{aid}/questions/{qid}/hint",
            headers={"Authorization": f"Bearer {token}"},
            json={"hint_level": 3},
        )
        assert r_excess.status_code == 429
        assert r_excess.json()["error"]["code"] == "EXCESSIVE_HINT_REQUESTS"

    def test_invalid_question(self, client, candidate_assessment_setup):
        setup = candidate_assessment_setup
        res = client.post(
            f"/api/assessment/{setup['assessment_id']}/questions/non_existent_q_999/hint",
            headers={"Authorization": f"Bearer {setup['token']}"},
            json={"hint_level": 1},
        )
        assert res.status_code == 404
        assert res.json()["error"]["code"] == "QUESTION_NOT_FOUND"

    def test_invalid_assessment(self, client, candidate_assessment_setup):
        setup = candidate_assessment_setup
        res = client.post(
            f"/api/assessment/non_existent_aid_404/questions/{setup['q1_id']}/hint",
            headers={"Authorization": f"Bearer {setup['token']}"},
            json={"hint_level": 1},
        )
        assert res.status_code == 404
        assert res.json()["error"]["code"] == "ASSESSMENT_NOT_FOUND"

    def test_unauthorized_access(self, client, candidate_assessment_setup):
        setup = candidate_assessment_setup
        res = client.post(
            f"/api/assessment/{setup['assessment_id']}/questions/{setup['q1_id']}/hint",
            json={"hint_level": 1},
        )
        assert res.status_code == 401
        assert res.json()["error"]["code"] == "UNAUTHORIZED"

    def test_another_student_hint_history(self, client, candidate_assessment_setup):
        setup = candidate_assessment_setup
        other_token, _ = register_student(client, name="Other Student", email="other@test.com")

        # Student B cannot access Student A's hints
        res = client.get(
            f"/api/assessment/{setup['assessment_id']}/questions/{setup['q1_id']}/hints",
            headers={"Authorization": f"Bearer {other_token}"},
        )
        assert res.status_code in (403, 404)

    def test_featherless_timeout_fallback(self, client, candidate_assessment_setup):
        setup = candidate_assessment_setup
        with patch("backend.app.ai_engine.featherless_client.featherless_client.chat_completion") as mock_chat:
            mock_chat.side_effect = FeatherlessTimeoutError("Featherless AI timed out after 30s")
            res = client.post(
                f"/api/assessment/{setup['assessment_id']}/questions/{setup['q1_id']}/hint",
                headers={"Authorization": f"Bearer {setup['token']}"},
                json={"hint_level": 1},
            )
            assert res.status_code == 200
            assert res.json()["success"] is True
            assert "Conceptual Direction" in res.json()["hint_text"]

    def test_attempted_solution_leakage_redaction(self):
        leaked_code = (
            "Here is the solution to Two Sum:\n"
            "```python\n"
            "def two_sum(nums, target):\n"
            "    seen = {}\n"
            "    for i, num in enumerate(nums):\n"
            "        diff = target - num\n"
            "        if diff in seen:\n"
            "            return [seen[diff], i]\n"
            "        seen[num] = i\n"
            "    return []\n"
            "```\n"
            "Just copy and paste this code."
        )
        cleaned, redacted = GuardedAIAssistant.sanitize_hint_content(leaked_code)
        assert redacted is True
        assert "def two_sum" not in cleaned
        assert "[Full code block redacted by Guarded AI Tutor" in cleaned

    def test_direct_assistant_hint_alias(self, client, candidate_assessment_setup):
        setup = candidate_assessment_setup
        res = client.post(
            "/api/assistant/hint",
            headers={"Authorization": f"Bearer {setup['token']}"},
            json={
                "assessment_id": setup["assessment_id"],
                "question_id": setup["q1_id"],
                "hint_level": 1,
                "language": "python",
                "allow_solution": False,
            },
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["level"] == 1
        assert "hint_text" in data


# =============================================================
# 2. AI Efficiency Scoring Tests (Deterministic v1.0)
# =============================================================

class TestAIEfficiencyScoring:

    def test_no_hints_used(self):
        questions = [
            {"id": "q1", "difficulty": "medium"},
            {"id": "q2", "difficulty": "hard"},
        ]
        result = AIEfficiencyScorer.calculate_efficiency_score(
            coding_score=100.0,
            hint_interactions=[],
            questions=questions,
            submissions=[{"question_id": "q1", "verdict": "AC"}, {"question_id": "q2", "verdict": "AC"}],
        )
        assert result["coding_score"] == 100.0
        assert result["ai_efficiency_score"] == 100.0
        assert result["final_score"] == 100.0
        assert result["formula_version"] == "v1.0"

    def test_one_hint_used_with_ac(self):
        questions = [
            {"id": "q1", "difficulty": "hard"},
        ]
        hint = [{"question_id": "q1", "hint_level": 1}]
        submissions = [{"question_id": "q1", "verdict": "AC", "score": 100.0}]

        result = AIEfficiencyScorer.calculate_efficiency_score(
            coding_score=100.0,
            hint_interactions=hint,
            questions=questions,
            submissions=submissions,
        )
        # Using a hint on a Hard problem and subsequently solving it preserves high efficiency
        assert result["ai_efficiency_score"] >= 95.0
        assert result["final_score"] >= 99.0

    def test_different_difficulty_deductions(self):
        # Hint on Easy vs Hint on Hard
        questions_easy = [{"id": "q_easy", "difficulty": "easy"}]
        questions_hard = [{"id": "q_hard", "difficulty": "hard"}]
        hint_easy = [{"question_id": "q_easy", "hint_level": 2}]
        hint_hard = [{"question_id": "q_hard", "hint_level": 2}]

        res_easy = AIEfficiencyScorer.calculate_efficiency_score(100.0, hint_easy, questions_easy)
        res_hard = AIEfficiencyScorer.calculate_efficiency_score(100.0, hint_hard, questions_hard)

        # Easy problem hint deduction is strictly greater than Hard problem hint deduction
        assert res_hard["ai_efficiency_score"] > res_easy["ai_efficiency_score"]

    def test_score_boundary_conditions(self):
        # Ensure scores clamp between 0 and 100 even with extreme penalties
        questions = [{"id": "q1", "difficulty": "easy"}]
        many_hints = [{"question_id": "q1", "hint_level": 3} for _ in range(10)]
        many_ces = [{"question_id": "q1", "verdict": "CE", "status": "compilation_error"} for _ in range(15)]

        result = AIEfficiencyScorer.calculate_efficiency_score(
            coding_score=0.0,
            hint_interactions=many_hints,
            questions=questions,
            submissions=many_ces,
        )
        assert 0.0 <= result["ai_efficiency_score"] <= 100.0
        assert 0.0 <= result["final_score"] <= 100.0

    def test_formula_version_preservation(self):
        result = AIEfficiencyScorer.calculate_efficiency_score(80.0, [], [{"id": "q1"}])
        assert result["formula_version"] == "v1.0"
        assert "80% Coding Score + 20% AI Efficiency Score" in result["formula_description"]


# =============================================================
# 3. Student Analytics & History Tests
# =============================================================

class TestStudentAnalytics:

    def test_empty_history(self, client):
        token, _ = register_student(client, name="Newbie", email="newbie@test.com")
        res = client.get("/api/analytics/me", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200
        data = res.json()
        assert data["total_assessments"] == 0
        assert data["completed_assessments"] == 0
        assert data["average_score"] == 0.0
        assert data["highest_score"] == 0.0
        assert data["historical_trends"] == []

    def test_multiple_assessments_analytics(self, client, candidate_assessment_setup):
        setup = candidate_assessment_setup
        token = setup["token"]
        aid = setup["assessment_id"]

        # Record submissions
        sub1 = {
            "id": "sub_101",
            "user_id": setup["user"]["id"],
            "assessment_id": aid,
            "question_id": setup["q1_id"],
            "score": 100.0,
            "passed_tests": 5,
            "failed_tests": 0,
            "verdict": "AC",
            "status": "accepted",
        }
        sub2 = {
            "id": "sub_102",
            "user_id": setup["user"]["id"],
            "assessment_id": aid,
            "question_id": setup["q2_id"],
            "score": 80.0,
            "passed_tests": 4,
            "failed_tests": 1,
            "verdict": "AC",
            "status": "accepted",
        }
        _submissions_memory_store[sub1["id"]] = sub1
        _submissions_memory_store[sub2["id"]] = sub2

        # Mark assessment completed
        _assessment_memory_store[aid]["status"] = "completed"
        _assessment_memory_store[aid]["completed_at"] = datetime.now(timezone.utc).isoformat()

        res = client.get("/api/analytics/me", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200
        data = res.json()
        assert data["total_assessments"] >= 1
        assert data["completed_assessments"] >= 1
        assert data["highest_score"] > 0.0
        assert data["total_correct_test_cases"] == 9
        assert data["total_failed_test_cases"] == 1
        assert len(data["topic_performance"]) > 0

    def test_student_data_isolation(self, client, candidate_assessment_setup):
        setup = candidate_assessment_setup
        other_token, _ = register_student(client, name="Spy", email="spy@test.com")

        # Spy cannot access candidate's specific assessment results analytics
        res = client.get(
            f"/api/analytics/me/results/{setup['assessment_id']}",
            headers={"Authorization": f"Bearer {other_token}"},
        )
        assert res.status_code in (403, 404)


# =============================================================
# 4. Public Profiles & Privacy Controls Tests
# =============================================================

class TestStudentPublicProfiles:

    def test_default_private_profile(self, client, candidate_assessment_setup):
        setup = candidate_assessment_setup
        res = client.get("/api/profile/me", headers={"Authorization": f"Bearer {setup['token']}"})
        assert res.status_code == 200
        data = res.json()
        assert data["visibility"] == "private"
        assert "share_id" in data
        assert len(data["share_id"]) >= 16

    def test_public_profile_view_and_visibility_toggle(self, client, candidate_assessment_setup):
        setup = candidate_assessment_setup
        token = setup["token"]

        # 1. Fetch own profile
        r_me = client.get("/api/profile/me", headers={"Authorization": f"Bearer {token}"})
        share_id = r_me.json()["share_id"]

        # 2. While private, public endpoint should return 404 or 403 (access restricted)
        r_priv = client.get(f"/api/public/profile/{share_id}")
        assert r_priv.status_code in (403, 404)

        # 3. Toggle visibility to public
        r_toggle = client.patch(
            "/api/profile/me/visibility",
            headers={"Authorization": f"Bearer {token}"},
            json={"visibility": "public"},
        )
        assert r_toggle.status_code == 200
        assert r_toggle.json()["visibility"] == "public"

        # 4. Now public endpoint succeeds without token!
        r_pub = client.get(f"/api/public/profile/{share_id}")
        assert r_pub.status_code == 200
        pub_data = r_pub.json()
        assert pub_data["share_id"] == share_id
        assert "public_name" in pub_data

    def test_revoked_link(self, client, candidate_assessment_setup):
        setup = candidate_assessment_setup
        token = setup["token"]

        # Make public
        client.patch(
            "/api/profile/me/visibility",
            headers={"Authorization": f"Bearer {token}"},
            json={"visibility": "public"},
        )
        old_share_id = client.get("/api/profile/me", headers={"Authorization": f"Bearer {token}"}).json()["share_id"]

        # Old share_id works
        assert client.get(f"/api/public/profile/{old_share_id}").status_code == 200

        # Revoke share link
        r_revoke = client.post("/api/profile/me/revoke", headers={"Authorization": f"Bearer {token}"})
        assert r_revoke.status_code == 200
        new_share_id = r_revoke.json()["share_id"]
        assert new_share_id != old_share_id

        # Old link immediately returns 404!
        assert client.get(f"/api/public/profile/{old_share_id}").status_code == 404
        # New link works
        assert client.get(f"/api/public/profile/{new_share_id}").status_code == 200

    def test_sensitive_field_exposure_prevention(self, client, candidate_assessment_setup):
        setup = candidate_assessment_setup
        token = setup["token"]

        client.patch(
            "/api/profile/me/visibility",
            headers={"Authorization": f"Bearer {token}"},
            json={"visibility": "public"},
        )
        share_id = client.get("/api/profile/me", headers={"Authorization": f"Bearer {token}"}).json()["share_id"]

        res = client.get(f"/api/public/profile/{share_id}")
        assert res.status_code == 200
        raw_text = res.text

        # Verify zero leakage of candidate email, user ID, auth tokens, or passwords
        assert setup["user"]["email"] not in raw_text
        assert setup["user"]["id"] not in raw_text
        assert "password" not in raw_text.lower()
        assert "access_token" not in raw_text.lower()

    def test_company_user_cannot_manage_student_profile(self, client):
        company_token, _ = register_company(client, name="BigTech Recruiter", email="recruiter2@tech.com")
        res = client.get("/api/profile/me", headers={"Authorization": f"Bearer {company_token}"})
        assert res.status_code == 403
        assert res.json()["error"]["code"] == "ROLE_MISMATCH"

