"""
Unit Test Suite for Portfolio Management, Ingestion, and Versioning
Role: QA, Architecture & Full-Stack Lead
Project: Portfolio-Driven Adaptive Coding & Technical Assessment Platform
"""

import pytest
from fastapi.testclient import TestClient

from backend.app.core.security import AuthException
from backend.app.database.supabase import set_supabase_client
from backend.app.main import app
from backend.app.services.portfolio_service import (
    PortfolioService,
    _portfolio_memory_store,
    validate_portfolio_inputs,
)
from backend.tests.test_auth import MockSupabase


@pytest.fixture(autouse=True)
def clean_portfolio_stores():
    _portfolio_memory_store.clear()
    yield
    _portfolio_memory_store.clear()


@pytest.fixture
def mock_supabase():
    mock = MockSupabase()
    set_supabase_client(mock)
    yield mock
    set_supabase_client(None)


@pytest.fixture
def client(mock_supabase):
    return TestClient(app)


def register_student(client: TestClient, name="Linus Torvalds", email="linus@kernel.org"):
    res = client.post(
        "/api/auth/student/register",
        json={"full_name": name, "email": email, "password": "Password123!"},
    )
    assert res.status_code == 201
    return res.json()["access_token"], res.json()["user"]


class TestPortfolioValidationAndService:
    def test_valid_portfolio_inputs_pass(self):
        validate_portfolio_inputs("https://github.com/torvalds/linux", ["C", "Assembly"])

    def test_missing_github_url_rejected(self):
        with pytest.raises(AuthException) as exc_info:
            validate_portfolio_inputs("", ["Python"])
        assert exc_info.value.code == "MISSING_FIELDS"

    def test_invalid_github_url_rejected(self):
        with pytest.raises(AuthException) as exc_info:
            validate_portfolio_inputs("https://gitlab.com/torvalds/linux", ["C"])
        assert exc_info.value.code == "INVALID_GITHUB_URL"

    def test_empty_languages_rejected(self):
        with pytest.raises(AuthException) as exc_info:
            validate_portfolio_inputs("https://github.com/torvalds/linux", [])
        assert exc_info.value.code == "MISSING_FIELDS"


class TestPortfolioAPIEndpoints:
    def test_upload_json_portfolio_with_dsa_and_domain(self, client):
        token, user = register_student(client, "Dennis Ritchie", "dennis@bell.labs")
        headers = {"Authorization": f"Bearer {token}"}

        payload = {
            "github_url": "https://github.com/dennis/c-lang",
            "primary_languages": ["C", "Assembly"],
            "skills": [{"name": "Systems Programming", "category": "domain"}],
            "dsa_topics_solved": ["Pointers", "Arrays", "Bit Manipulation"],
            "preferred_domain": "Operating Systems",
        }

        res = client.post("/api/portfolio/upload", json=payload, headers=headers)
        assert res.status_code == 201
        data = res.json()
        assert data["success"] is True

        # Retrieve profile
        get_res = client.get("/api/portfolio/me", headers=headers)
        assert get_res.status_code == 200
        port = get_res.json()["portfolio"]
        assert "Operating Systems" in port["preferred_domain"]
        assert "Arrays" in port["dsa_topics_solved"]

    def test_unauthenticated_upload_rejected(self, client):
        res = client.post("/api/portfolio/upload", json={"github_url": "https://github.com/foo/bar"})
        assert res.status_code == 401

    def test_company_cannot_upload_portfolio(self, client):
        comp_res = client.post(
            "/api/auth/company/register",
            json={"company_name": "Bell Labs Corp", "official_email": "rec@bell.org", "password": "Password123!"},
        )
        token = comp_res.json()["access_token"]
        res = client.post(
            "/api/portfolio/upload",
            json={"github_url": "https://github.com/corp/code"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 403
