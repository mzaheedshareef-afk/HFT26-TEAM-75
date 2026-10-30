"""
Comprehensive Pytest Test Suite for Recruiter Backend, Candidate Discovery,
Shortlisting, Candidate Comparison, and Recruiter Dashboard Analytics.
Role: Testing & Integration Lead (Vasil)
Project: Portfolio-Driven Adaptive Coding & Technical Assessment Platform
Team: HFT26-TEAM-75
"""

from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient

from backend.app.database.supabase import set_supabase_client
from backend.app.main import app
from backend.app.services.profile_service import (
    _public_profiles_by_share_id,
    _public_profiles_store,
)
from backend.app.services.recruiter_service import (
    _company_profiles_store,
    _company_shortlists_store,
)
from backend.tests.test_auth import MockSupabase


@pytest.fixture(autouse=True)
def clean_recruiter_stores():
    """Resets memory stores between test runs."""
    _company_profiles_store.clear()
    _company_shortlists_store.clear()
    _public_profiles_store.clear()
    _public_profiles_by_share_id.clear()
    yield
    _company_profiles_store.clear()
    _company_shortlists_store.clear()
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


def register_student(client: TestClient, name="Ada Lovelace", email="ada@test.com"):
    res = client.post(
        "/api/auth/student/register",
        json={"full_name": name, "email": email, "password": "Password123!"},
    )
    assert res.status_code == 201
    return res.json()["access_token"], res.json()["user"]


def register_company(client: TestClient, name="Google DeepMind", email="recruiter@deepmind.com"):
    res = client.post(
        "/api/auth/company/register",
        json={"company_name": name, "official_email": email, "password": "Password123!"},
    )
    assert res.status_code == 201
    return res.json()["access_token"], res.json()["user"]


def create_mock_candidate(
    user_id: str,
    name: str,
    share_id: str,
    visibility: str = "public",
    skills=None,
    techs=None,
    highest_score=88.0,
    coding_score=90.0,
    ai_score=80.0,
    consistency=85.0,
    completions=2,
    improvement=10.0,
):
    profile = {
        "id": f"prof_{user_id[:8]}",
        "user_id": user_id,
        "full_name": name,
        "public_name": name,
        "headline": f"Backend Engineer specialized in {skills[0] if skills else 'Python'}",
        "bio": f"Engineering portfolio for {name}.",
        "skills": skills or ["Python", "Algorithms", "Data Structures"],
        "technologies": techs or ["FastAPI", "Docker", "PostgreSQL"],
        "projects": [
            {
                "title": f"{name} Portfolio Project",
                "description": "Distributed task worker pool",
                "technologies": ["Python", "Redis"],
                "repo_url": "https://github.com/example/repo",
            }
        ],
        "portfolio_highlights": [],
        "verified_achievements": [
            {"badge": "First Assessment Completed", "level": "Bronze"},
            {"badge": "Deterministic Accuracy", "level": "Silver"},
        ],
        "performance_summary": {
            "total_assessments_completed": completions,
            "average_score": round((highest_score + 80.0) / 2.0, 1),
            "highest_score": highest_score,
            "coding_score": coding_score,
            "ai_efficiency_score": ai_score,
            "consistency_score": consistency,
            "consistency_rating": "Solid",
            "improvement_delta": improvement,
            "improvement_label": "+10.0% trajectory",
            "total_correct_test_cases": 18,
            "total_test_cases": 20,
            "top_topics": ["Algorithms", "Systems", "Data Structures"],
        },
        "visibility": visibility,
        "share_id": share_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    _public_profiles_store[user_id] = profile
    _public_profiles_by_share_id[share_id] = profile
    return profile


# =============================================================
# 1. Company Authentication and Profile Tests
# =============================================================

class TestCompanyProfileAndAuth:

    def test_unauthenticated_recruiter_access_rejected(self, client):
        """Unauthenticated requests to recruiter endpoints must return 401."""
        res = client.get("/api/recruiter/candidates")
        assert res.status_code == 401
        assert res.json()["error"]["code"] in ("UNAUTHORIZED", "INVALID_TOKEN")

    def test_student_cannot_access_recruiter_endpoints(self, client):
        """Students attempting to access recruiter APIs must receive 403 ROLE_MISMATCH."""
        student_token, _ = register_student(client, name="Alice Student", email="alice.stu@test.com")
        endpoints = [
            ("GET", "/api/company/me"),
            ("GET", "/api/recruiter/candidates"),
            ("GET", "/api/recruiter/dashboard"),
            ("GET", "/api/recruiter/shortlist"),
        ]
        for method, path in endpoints:
            if method == "GET":
                res = client.get(path, headers={"Authorization": f"Bearer {student_token}"})
            assert res.status_code == 403
            assert res.json()["error"]["code"] == "ROLE_MISMATCH"

    def test_company_profile_get_and_update(self, client):
        """Authenticated company can retrieve and update company profile."""
        token, user = register_company(client, name="Stripe Inc.", email="recruiting@stripe.com")
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Get initial profile
        res_get = client.get("/api/company/me", headers=headers)
        assert res_get.status_code == 200
        data = res_get.json()
        assert data["company_name"] == "Stripe Inc."
        assert data["official_email"] == "recruiting@stripe.com"
        assert data["role"] == "company"

        # 2. Update profile details
        res_patch = client.patch(
            "/api/company/me",
            headers=headers,
            json={
                "industry": "Financial Infrastructure",
                "website": "https://stripe.com",
                "location": "San Francisco, CA",
                "description": "Financial infrastructure for the internet.",
                "company_size": "1000+",
            },
        )
        assert res_patch.status_code == 200
        updated = res_patch.json()
        assert updated["industry"] == "Financial Infrastructure"
        assert updated["website"] == "https://stripe.com"
        assert updated["company_size"] == "1000+"
        assert updated["role"] == "company"

    def test_role_tampering_is_prevented(self, client):
        """Company profile updates cannot alter account role."""
        token, user = register_company(client, name="OpenAI", email="jobs@openai.com")
        headers = {"Authorization": f"Bearer {token}"}

        # Attempt to pass role="student" or role="admin"
        client.patch("/api/company/me", headers=headers, json={"role": "student"})
        res = client.get("/api/company/me", headers=headers)
        assert res.status_code == 200
        assert res.json()["role"] == "company"


# =============================================================
# 2. Candidate Discovery Tests
# =============================================================

class TestCandidateDiscovery:

    @pytest.fixture
    def setup_talent_pool(self, client):
        """Populates talent pool with public and private candidates."""
        token, user = register_company(client, name="Anthropic", email="careers@anthropic.com")

        # 1. Public candidate Ada (Python, 95.0 score, 98.0 coding)
        create_mock_candidate(
            user_id="user_ada_001",
            name="Ada Lovelace",
            share_id="share_ada_001",
            visibility="public",
            skills=["Python", "FastAPI", "Algorithms"],
            techs=["Docker", "PostgreSQL"],
            highest_score=95.0,
            coding_score=98.0,
            ai_score=85.0,
            consistency=90.0,
            completions=3,
            improvement=15.0,
        )

        # 2. Public candidate Alan (C++, 88.0 score, 90.0 coding)
        create_mock_candidate(
            user_id="user_alan_002",
            name="Alan Turing",
            share_id="share_alan_002",
            visibility="public",
            skills=["C++", "Systems", "Cryptography"],
            techs=["Linux", "CMake"],
            highest_score=88.0,
            coding_score=90.0,
            ai_score=80.0,
            consistency=85.0,
            completions=2,
            improvement=8.0,
        )

        # 3. Public candidate Grace (Java, 78.0 score)
        create_mock_candidate(
            user_id="user_grace_003",
            name="Grace Hopper",
            share_id="share_grace_003",
            visibility="public",
            skills=["Java", "Compilers", "Architecture"],
            techs=["Spring", "Kubernetes"],
            highest_score=78.0,
            coding_score=80.0,
            ai_score=70.0,
            consistency=75.0,
            completions=1,
            improvement=5.0,
        )

        # 4. PRIVATE candidate SecretDev (must be excluded!)
        create_mock_candidate(
            user_id="user_secret_004",
            name="Secret Candidate",
            share_id="share_secret_004",
            visibility="private",
            skills=["Python", "Go"],
            highest_score=99.0,
        )

        return {"token": token, "user": user}

    def test_private_candidates_are_strictly_excluded(self, client, setup_talent_pool):
        token = setup_talent_pool["token"]
        res = client.get("/api/recruiter/candidates", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200
        data = res.json()
        assert data["total"] == 3  # Only 3 public candidates
        names = [c["public_name"] for c in data["candidates"]]
        assert "Secret Candidate" not in names
        assert "Ada Lovelace" in names
        assert "Alan Turing" in names

    def test_search_by_programming_language(self, client, setup_talent_pool):
        token = setup_talent_pool["token"]
        # Search Python
        res_py = client.get(
            "/api/recruiter/candidates?languages=Python",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res_py.status_code == 200
        py_cands = res_py.json()["candidates"]
        assert len(py_cands) == 1
        assert py_cands[0]["public_name"] == "Ada Lovelace"

        # Search C++
        res_cpp = client.get(
            "/api/recruiter/candidates?languages=C%2B%2B",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res_cpp.status_code == 200
        assert len(res_cpp.json()["candidates"]) == 1
        assert res_cpp.json()["candidates"][0]["public_name"] == "Alan Turing"

    def test_search_by_score_range(self, client, setup_talent_pool):
        token = setup_talent_pool["token"]
        # min_score = 85.0
        res = client.get(
            "/api/recruiter/candidates?min_score=85.0",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["total"] == 2
        for c in data["candidates"]:
            assert c["highest_score"] >= 85.0

    def test_invalid_score_range_rejected(self, client, setup_talent_pool):
        token = setup_talent_pool["token"]
        # min_score > max_score
        res = client.get(
            "/api/recruiter/candidates?min_score=90.0&max_score=80.0",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 422

    def test_sorting_options(self, client, setup_talent_pool):
        token = setup_talent_pool["token"]
        # Default / highest_score
        res_score = client.get(
            "/api/recruiter/candidates?sort_by=highest_score",
            headers={"Authorization": f"Bearer {token}"},
        )
        cands = res_score.json()["candidates"]
        assert cands[0]["public_name"] == "Ada Lovelace"  # 95.0
        assert cands[1]["public_name"] == "Alan Turing"   # 88.0
        assert cands[2]["public_name"] == "Grace Hopper"  # 78.0

        # highest_improvement
        res_imprv = client.get(
            "/api/recruiter/candidates?sort_by=highest_improvement",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res_imprv.json()["candidates"][0]["public_name"] == "Ada Lovelace"  # 15.0

    def test_pagination(self, client, setup_talent_pool):
        token = setup_talent_pool["token"]
        # Limit 2, Page 1
        r1 = client.get(
            "/api/recruiter/candidates?page=1&limit=2",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r1.status_code == 200
        data1 = r1.json()
        assert len(data1["candidates"]) == 2
        assert data1["total"] == 3
        assert data1["total_pages"] == 2

        # Page 2
        r2 = client.get(
            "/api/recruiter/candidates?page=2&limit=2",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r2.status_code == 200
        data2 = r2.json()
        assert len(data2["candidates"]) == 1

    def test_empty_search_results_handled_cleanly(self, client, setup_talent_pool):
        token = setup_talent_pool["token"]
        res = client.get(
            "/api/recruiter/candidates?skills=Rust&min_score=99.0",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["total"] == 0
        assert data["candidates"] == []


# =============================================================
# 3. Candidate Profile Details Tests
# =============================================================

class TestCandidateProfileDetails:

    def test_get_public_candidate_detail(self, client):
        token, _ = register_company(client, name="Meta", email="recruiting@meta.com")
        create_mock_candidate(
            user_id="user_john_001",
            name="John von Neumann",
            share_id="share_john_001",
            visibility="public",
            skills=["Algorithms", "Systems Architecture"],
            highest_score=94.0,
        )

        res = client.get(
            "/api/recruiter/candidates/user_john_001",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["public_name"] == "John von Neumann"
        assert "self_reported" in data
        assert "verified_assessment" in data
        assert data["verified_assessment"]["highest_score"] == 94.0
        assert data["verified_assessment"]["formula_version"] == "v1.0"

    def test_private_candidate_detail_returns_403(self, client):
        token, _ = register_company(client, name="Apple", email="jobs@apple.com")
        create_mock_candidate(
            user_id="user_priv_002",
            name="Private Student",
            share_id="share_priv_002",
            visibility="private",
        )

        res = client.get(
            "/api/recruiter/candidates/user_priv_002",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 403
        assert res.json()["error"]["code"] == "CANDIDATE_PROFILE_PRIVATE"

    def test_nonexistent_candidate_detail_returns_404(self, client):
        token, _ = register_company(client, name="Netflix", email="recruiter@netflix.com")
        res = client.get(
            "/api/recruiter/candidates/nonexistent_uuid_999",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 404
        assert res.json()["error"]["code"] == "CANDIDATE_NOT_FOUND"

    def test_sensitive_fields_not_exposed_in_candidate_detail(self, client):
        token, _ = register_company(client, name="Amazon", email="jobs@amazon.com")
        create_mock_candidate(
            user_id="user_clean_003",
            name="Claude Shannon",
            share_id="share_claude_003",
            visibility="public",
        )

        res = client.get(
            "/api/recruiter/candidates/user_clean_003",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        raw_text = res.text

        # Verify zero email, password, auth tokens, or hidden test cases
        assert "email" not in res.json() or res.json().get("email") is None
        assert "password" not in raw_text.lower()
        assert "access_token" not in raw_text.lower()
        assert "hidden_test_cases" not in raw_text
        assert "reference_solution" not in raw_text


# =============================================================
# 4. Shortlisted Candidates Tests
# =============================================================

class TestCandidateShortlisting:

    def test_add_and_remove_shortlist(self, client):
        token, _ = register_company(client, name="Uber", email="eng-recruiting@uber.com")
        create_mock_candidate(
            user_id="user_sl_001",
            name="Barbara Liskov",
            share_id="share_barbara_001",
            visibility="public",
        )
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Add to shortlist
        res_add = client.post(
            "/api/recruiter/shortlist/user_sl_001",
            headers=headers,
            json={"notes": "Strong in data abstraction principles."},
        )
        assert res_add.status_code == 201
        assert res_add.json()["success"] is True

        # 2. View shortlist
        res_list = client.get("/api/recruiter/shortlist", headers=headers)
        assert res_list.status_code == 200
        sl_data = res_list.json()
        assert sl_data["total"] == 1
        assert sl_data["shortlist"][0]["student_id"] == "user_sl_001"
        assert sl_data["shortlist"][0]["notes"] == "Strong in data abstraction principles."

        # 3. Remove from shortlist
        res_del = client.delete("/api/recruiter/shortlist/user_sl_001", headers=headers)
        assert res_del.status_code == 200

        # 4. Confirm empty
        res_empty = client.get("/api/recruiter/shortlist", headers=headers)
        assert res_empty.json()["total"] == 0

    def test_duplicate_shortlist_rejected(self, client):
        token, _ = register_company(client, name="Airbnb", email="jobs@airbnb.com")
        create_mock_candidate(
            user_id="user_dup_002",
            name="Donald Knuth",
            share_id="share_knuth_002",
            visibility="public",
        )
        headers = {"Authorization": f"Bearer {token}"}

        # First add
        r1 = client.post("/api/recruiter/shortlist/user_dup_002", headers=headers)
        assert r1.status_code == 201

        # Duplicate add returns 409
        r2 = client.post("/api/recruiter/shortlist/user_dup_002", headers=headers)
        assert r2.status_code == 409
        assert r2.json()["error"]["code"] == "ALREADY_SHORTLISTED"

    def test_shortlisting_private_candidate_rejected(self, client):
        token, _ = register_company(client, name="Figma", email="talent@figma.com")
        create_mock_candidate(
            user_id="user_priv_sl",
            name="Stealth Student",
            share_id="share_stealth",
            visibility="private",
        )
        headers = {"Authorization": f"Bearer {token}"}

        res = client.post("/api/recruiter/shortlist/user_priv_sl", headers=headers)
        assert res.status_code == 403
        assert res.json()["error"]["code"] == "CANNOT_SHORTLIST_PRIVATE_CANDIDATE"

    def test_update_shortlist_notes(self, client):
        token, _ = register_company(client, name="Databricks", email="recruiting@databricks.com")
        create_mock_candidate(
            user_id="user_notes_003",
            name="Leslie Lamport",
            share_id="share_lamport_003",
            visibility="public",
        )
        headers = {"Authorization": f"Bearer {token}"}

        client.post("/api/recruiter/shortlist/user_notes_003", headers=headers)
        res_upd = client.patch(
            "/api/recruiter/shortlist/user_notes_003/notes",
            headers=headers,
            json={"notes": "Passed systems architectural design review with flying colors."},
        )
        assert res_upd.status_code == 200
        assert "flying colors" in res_upd.json()["shortlist_item"]["notes"]

    def test_company_shortlist_isolation(self, client):
        """Company A cannot see or edit Company B's shortlist."""
        token_a, _ = register_company(client, name="Company A", email="a@comp.com")
        token_b, _ = register_company(client, name="Company B", email="b@comp.com")

        create_mock_candidate(
            user_id="user_shared_004",
            name="Tim Berners-Lee",
            share_id="share_tim_004",
            visibility="public",
        )

        # Company A shortlists candidate
        client.post(
            "/api/recruiter/shortlist/user_shared_004",
            headers={"Authorization": f"Bearer {token_a}"},
            json={"notes": "Company A Private Evaluation"},
        )

        # Company B's shortlist is completely empty!
        res_b = client.get("/api/recruiter/shortlist", headers={"Authorization": f"Bearer {token_b}"})
        assert res_b.status_code == 200
        assert res_b.json()["total"] == 0

        # Company B cannot delete Company A's shortlist item
        res_del_b = client.delete(
            "/api/recruiter/shortlist/user_shared_004",
            headers={"Authorization": f"Bearer {token_b}"},
        )
        assert res_del_b.status_code == 404

    def test_visibility_revocation_handled_in_shortlist(self, client):
        """If shortlisted candidate later switches to private, details are redacted in shortlist."""
        token, _ = register_company(client, name="Twitter", email="recruiting@twitter.com")
        headers = {"Authorization": f"Bearer {token}"}

        cand = create_mock_candidate(
            user_id="user_rev_005",
            name="Linus Torvalds",
            share_id="share_linus_005",
            visibility="public",
        )

        client.post(
            "/api/recruiter/shortlist/user_rev_005",
            headers=headers,
            json={"notes": "Kernel design specialist."},
        )

        # Candidate now revokes sharing (sets visibility to private)
        cand["visibility"] = "private"

        res_list = client.get("/api/recruiter/shortlist", headers=headers)
        assert res_list.status_code == 200
        item = res_list.json()["shortlist"][0]
        assert item["is_visible"] is False
        assert "[Private Candidate]" in item["candidate"]["public_name"]
        assert item["notes"] == "Kernel design specialist."


# =============================================================
# 5. Candidate Comparison Tests
# =============================================================

class TestCandidateComparison:

    @pytest.fixture
    def setup_comparison_candidates(self, client):
        token, _ = register_company(client, name="Microsoft", email="careers@microsoft.com")

        create_mock_candidate(
            user_id="cand_comp_1",
            name="Candidate Alpha",
            share_id="share_c1",
            visibility="public",
            skills=["Python", "Algorithms", "Docker"],
            highest_score=92.0,
            coding_score=95.0,
            ai_score=85.0,
        )

        create_mock_candidate(
            user_id="cand_comp_2",
            name="Candidate Beta",
            share_id="share_c2",
            visibility="public",
            skills=["Python", "FastAPI", "React"],
            highest_score=85.0,
            coding_score=88.0,
            ai_score=92.0,
        )

        create_mock_candidate(
            user_id="cand_comp_3",
            name="Candidate Gamma",
            share_id="share_c3",
            visibility="public",
            skills=["Python", "Docker", "Kubernetes"],
            highest_score=79.0,
        )

        create_mock_candidate(
            user_id="cand_comp_4",
            name="Candidate Delta",
            share_id="share_c4",
            visibility="public",
            skills=["Python", "AWS"],
            highest_score=88.0,
        )

        create_mock_candidate(
            user_id="cand_comp_priv",
            name="Private Candidate",
            share_id="share_cpriv",
            visibility="private",
        )

        return {"token": token}

    def test_compare_two_candidates_success(self, client, setup_comparison_candidates):
        token = setup_comparison_candidates["token"]
        res = client.post(
            "/api/recruiter/compare",
            headers={"Authorization": f"Bearer {token}"},
            json={"student_ids": ["cand_comp_1", "cand_comp_2"]},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["candidate_count"] == 2
        assert "Python" in data["common_skills"]
        assert data["metric_leaders"]["highest_score"]["student_id"] == "cand_comp_1"
        assert data["metric_leaders"]["highest_score"]["score"] == 92.0

    def test_compare_four_candidates_success(self, client, setup_comparison_candidates):
        token = setup_comparison_candidates["token"]
        res = client.post(
            "/api/recruiter/compare",
            headers={"Authorization": f"Bearer {token}"},
            json={"student_ids": ["cand_comp_1", "cand_comp_2", "cand_comp_3", "cand_comp_4"]},
        )
        assert res.status_code == 200
        assert res.json()["candidate_count"] == 4

    def test_compare_less_than_two_candidates_rejected(self, client, setup_comparison_candidates):
        token = setup_comparison_candidates["token"]
        res = client.post(
            "/api/recruiter/compare",
            headers={"Authorization": f"Bearer {token}"},
            json={"student_ids": ["cand_comp_1"]},
        )
        assert res.status_code in (400, 422)

    def test_compare_more_than_four_candidates_rejected(self, client, setup_comparison_candidates):
        token = setup_comparison_candidates["token"]
        res = client.post(
            "/api/recruiter/compare",
            headers={"Authorization": f"Bearer {token}"},
            json={"student_ids": ["c1", "c2", "c3", "c4", "c5"]},
        )
        assert res.status_code in (400, 422)

    def test_compare_with_private_candidate_rejected(self, client, setup_comparison_candidates):
        token = setup_comparison_candidates["token"]
        res = client.post(
            "/api/recruiter/compare",
            headers={"Authorization": f"Bearer {token}"},
            json={"student_ids": ["cand_comp_1", "cand_comp_priv"]},
        )
        assert res.status_code == 403
        assert res.json()["error"]["code"] == "CANNOT_COMPARE_PRIVATE_CANDIDATE"


# =============================================================
# 6. Recruiter Dashboard Analytics Tests
# =============================================================

class TestRecruiterDashboard:

    def test_recruiter_dashboard_telemetry(self, client):
        token, _ = register_company(client, name="Nvidia", email="jobs@nvidia.com")
        headers = {"Authorization": f"Bearer {token}"}

        create_mock_candidate(
            user_id="user_dash_1",
            name="Jensen Huang",
            share_id="share_jh",
            visibility="public",
            skills=["CUDA", "C++", "Python"],
            highest_score=96.0,
        )
        create_mock_candidate(
            user_id="user_dash_2",
            name="Lisa Su",
            share_id="share_ls",
            visibility="public",
            skills=["Architecture", "C++"],
            highest_score=84.0,
        )

        # Shortlist 1 candidate
        client.post("/api/recruiter/shortlist/user_dash_1", headers=headers)

        res = client.get("/api/recruiter/dashboard", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["total_accessible_candidates"] == 2
        assert data["total_shortlisted_candidates"] == 1
        assert len(data["recent_shortlist_activity"]) == 1
        assert data["platform_average_score"] == 90.0
        assert data["score_distribution"]["90-100"] == 1
        assert data["score_distribution"]["80-89"] == 1
