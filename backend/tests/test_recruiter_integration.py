"""
Integration Tests for Recruiter Platform Frontend-Backend Contracts.
Verifies query aliases, JSON body shortlisting, GET/POST compare,
saved searches, settings updates, and strict candidate privacy.
Role: Integration Lead
Project: Portfolio-Driven Adaptive Coding & Technical Assessment Platform
"""

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
    _recruiter_saved_searches_store,
)
from backend.tests.test_auth import MockSupabase
from backend.tests.test_recruiter import (
    create_mock_candidate,
    register_company,
    register_student,
)


@pytest.fixture(autouse=True)
def clean_stores():
    """Resets memory stores between test runs."""
    _company_profiles_store.clear()
    _company_shortlists_store.clear()
    _recruiter_saved_searches_store.clear()
    _public_profiles_store.clear()
    _public_profiles_by_share_id.clear()
    yield
    _company_profiles_store.clear()
    _company_shortlists_store.clear()
    _recruiter_saved_searches_store.clear()
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


class TestRecruiterFrontendIntegration:

    @pytest.fixture
    def setup_data(self, client):
        c_token, comp = register_company(client, name="Acme Hiring", email="recruiter@acme.com")
        c2_token, comp2 = register_company(client, name="Globex Corp", email="hr@globex.com")
        s1_token, stu1 = register_student(client, name="Alice Walker", email="alice@test.com")
        s2_token, stu2 = register_student(client, name="Bob Builder", email="bob@test.com")
        s3_token, stu3 = register_student(client, name="Charlie Private", email="charlie@test.com")

        # Public candidates
        create_mock_candidate(
            user_id=stu1["id"],
            name="Alice Walker",
            share_id="alice-walker-pub",
            visibility="public",
            skills=["Python", "FastAPI", "PostgreSQL"],
            techs=["Docker", "Redis"],
            highest_score=94.0,
            coding_score=92.0,
            ai_score=88.0,
            consistency=90.0,
            completions=3,
            improvement=12.5,
        )
        create_mock_candidate(
            user_id=stu2["id"],
            name="Bob Builder",
            share_id="bob-builder-pub",
            visibility="public",
            skills=["TypeScript", "React", "Node.js"],
            techs=["Next.js", "Docker"],
            highest_score=86.0,
            coding_score=85.0,
            ai_score=80.0,
            consistency=82.0,
            completions=2,
            improvement=5.0,
        )
        # Private candidate
        create_mock_candidate(
            user_id=stu3["id"],
            name="Charlie Private",
            share_id="charlie-private",
            visibility="private",
            skills=["Python", "Machine Learning"],
            techs=["PyTorch"],
            highest_score=98.0,
            coding_score=97.0,
            ai_score=95.0,
        )

        return {
            "comp_token": c_token,
            "comp": comp,
            "comp2_token": c2_token,
            "comp2": comp2,
            "cand1_id": stu1["id"],
            "cand2_id": stu2["id"],
            "private_cand_id": stu3["id"],
        }

    def test_search_with_singular_and_frontend_query_params(self, client, setup_data):
        """Tests frontend search parameters (language, skill, page_size, min_ai_efficiency, portfolio_only)."""
        token = setup_data["comp_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Singular language & page_size
        res = client.get(
            "/api/recruiter/candidates?language=Python&page_size=5&min_ai_efficiency=80",
            headers=headers,
        )
        assert res.status_code == 200
        data = res.json()
        assert data["total"] == 1
        assert data["items"][0]["candidate_id"] == setup_data["cand1_id"]
        assert data["items"][0]["display_name"] == "Alice Walker"

        # Singular skill
        res_skill = client.get("/api/recruiter/candidates?skill=React", headers=headers)
        assert res_skill.status_code == 200
        data_skill = res_skill.json()
        assert data_skill["total"] == 1
        assert data_skill["items"][0]["candidate_id"] == setup_data["cand2_id"]

        # Private candidate never returned even if matching skill
        res_priv = client.get("/api/recruiter/candidates?skill=Machine Learning", headers=headers)
        assert res_priv.status_code == 200
        assert res_priv.json()["total"] == 0

    def test_saved_candidate_search_flow(self, client, setup_data):
        """Tests creating and retrieving saved candidate search presets."""
        token = setup_data["comp_token"]
        headers = {"Authorization": f"Bearer {token}"}

        save_res = client.post(
            "/api/recruiter/saved-searches",
            headers=headers,
            json={
                "name": "Senior Python Specialists",
                "query_string": "language=Python&min_score=90",
                "filters_summary": "Python, Score >= 90",
            },
        )
        assert save_res.status_code == 201
        saved = save_res.json()
        assert saved["name"] == "Senior Python Specialists"
        assert saved["id"].startswith("saved_")

        get_res = client.get("/api/recruiter/saved-searches", headers=headers)
        assert get_res.status_code == 200
        searches = get_res.json()
        assert len(searches) >= 1
        assert searches[0]["name"] == "Senior Python Specialists"

    def test_shortlist_via_json_body_and_duplicate_prevention(self, client, setup_data):
        """Tests POST /api/recruiter/shortlist with candidate_id in JSON body."""
        token = setup_data["comp_token"]
        headers = {"Authorization": f"Bearer {token}"}
        cand1_id = setup_data["cand1_id"]

        # Shortlist with candidate_id
        res = client.post(
            "/api/recruiter/shortlist",
            headers=headers,
            json={
                "candidate_id": cand1_id,
                "private_notes": "Impressive distributed systems projects",
            },
        )
        assert res.status_code == 201
        body = res.json()
        assert body["success"] is True
        assert body["entry"]["candidate_id"] == cand1_id
        assert body["entry"]["private_notes"] == "Impressive distributed systems projects"

        # Duplicate shortlist attempt returns 409
        dup_res = client.post(
            "/api/recruiter/shortlist",
            headers=headers,
            json={"candidate_id": cand1_id},
        )
        assert dup_res.status_code == 409
        assert dup_res.json()["error"]["code"] == "ALREADY_SHORTLISTED"

    def test_shortlist_notes_update_and_retrieval(self, client, setup_data):
        """Tests updating recruiter notes and retrieving company shortlist."""
        token = setup_data["comp_token"]
        headers = {"Authorization": f"Bearer {token}"}
        cand1_id = setup_data["cand1_id"]

        # Add to shortlist
        client.post(
            "/api/recruiter/shortlist",
            headers=headers,
            json={"candidate_id": cand1_id, "notes": "Initial note"},
        )

        # Update notes via PATCH
        update_res = client.patch(
            f"/api/recruiter/shortlist/{cand1_id}/notes",
            headers=headers,
            json={"notes": "Passed technical screening phone interview"},
        )
        assert update_res.status_code == 200

        # Retrieve shortlist and verify updated notes
        sl_res = client.get("/api/recruiter/shortlist", headers=headers)
        assert sl_res.status_code == 200
        items = sl_res.json()["items"]
        assert len(items) == 1
        assert items[0]["private_notes"] == "Passed technical screening phone interview"

    def test_compare_candidates_get_and_post(self, client, setup_data):
        """Tests comparing candidates via POST body and GET query params."""
        token = setup_data["comp_token"]
        headers = {"Authorization": f"Bearer {token}"}
        c1 = setup_data["cand1_id"]
        c2 = setup_data["cand2_id"]

        # POST comparison
        post_res = client.post(
            "/api/recruiter/compare",
            headers=headers,
            json={"candidate_ids": [c1, c2]},
        )
        assert post_res.status_code == 200
        post_data = post_res.json()
        assert post_data["candidate_count"] == 2
        assert "Docker" in post_data["common_skills"]
        assert post_data["metric_leaders"]["highest_score"]["student_id"] == c1

        # GET comparison alias
        get_res = client.get(
            f"/api/recruiter/compare?candidate_ids={c1},{c2}",
            headers=headers,
        )
        assert get_res.status_code == 200
        get_data = get_res.json()
        assert get_data["candidate_count"] == 2

    def test_company_profile_and_settings_endpoints(self, client, setup_data):
        """Tests recruiter company profile and settings routes."""
        token = setup_data["comp_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # GET /api/recruiter/company/profile
        prof_res = client.get("/api/recruiter/company/profile", headers=headers)
        assert prof_res.status_code == 200
        assert prof_res.json()["company_name"] == "Acme Hiring"

        # PUT /api/recruiter/company/profile
        update_prof = client.put(
            "/api/recruiter/company/profile",
            headers=headers,
            json={
                "company_name": "Acme Hiring Global",
                "industry": "FinTech",
                "company_size": "250-1000",
                "headquarters": "San Francisco, CA",
            },
        )
        assert update_prof.status_code == 200
        assert update_prof.json()["company_name"] == "Acme Hiring Global"
        assert update_prof.json()["industry"] == "FinTech"

        # PATCH /api/recruiter/company/settings
        settings_res = client.patch(
            "/api/recruiter/company/settings",
            headers=headers,
            json={
                "default_discovery_view": "compact_table",
                "notification_preferences": {"shortlist_alerts": False},
            },
        )
        assert settings_res.status_code == 200
        assert settings_res.json()["default_discovery_view"] == "compact_table"
        assert settings_res.json()["notification_preferences"]["shortlist_alerts"] is False

