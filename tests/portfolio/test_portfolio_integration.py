import io
import json
import uuid
import pytest
from fastapi.testclient import TestClient

from backend.app.core.config import settings
from backend.app.core.security import verify_supabase_jwt
from backend.app.database.supabase import get_supabase_client, set_supabase_client
from backend.app.main import app
from backend.tests.test_auth import MockSupabase


@pytest.fixture
def mock_supabase():
    mock = MockSupabase()
    # Add storage mock
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


def create_test_student(client, name="Test Student", email="student@example.com"):
    res = client.post(
        "/api/auth/student/register",
        json={"full_name": name, "email": email, "password": "StrongPassword123"},
    )
    assert res.status_code == 201
    return res.json()["access_token"], res.json()["user"]


def create_test_company(client, name="TechCorp", email="recruiter@techcorp.com"):
    res = client.post(
        "/api/auth/company/register",
        json={"company_name": name, "official_email": email, "password": "StrongPassword123"},
    )
    assert res.status_code == 201
    return res.json()["access_token"], res.json()["user"]


class TestPortfolioIntegration:
    def test_get_portfolio_me_not_found_initially(self, client):
        token, _ = create_test_student(client, email="new_student@example.com")
        res = client.get("/api/portfolio/me", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 404
        data = res.json()
        assert data["success"] is False
        assert data["error"]["code"] == "PORTFOLIO_NOT_FOUND"

    def test_upload_portfolio_multipart_success(self, client):
        token, user = create_test_student(client, email="portfolio_student@example.com")

        form_data = {
            "github_url": "https://github.com/portfolio-student/awesome-project",
            "primary_languages": json.dumps(["Python", "TypeScript"]),
            "frameworks": json.dumps(["FastAPI", "React"]),
            "notes": "Experienced backend developer with microservices background.",
        }
        fake_resume = ("resume.pdf", io.BytesIO(b"%PDF-1.4 Mock resume content"), "application/pdf")

        res = client.post(
            "/api/portfolio/upload",
            data=form_data,
            files={"resume_file": fake_resume},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 201
        data = res.json()
        assert data["success"] is True
        assert "portfolio" in data
        p = data["portfolio"]
        assert p["githubUrl"] == "https://github.com/portfolio-student/awesome-project"
        assert "Python" in p["primaryLanguages"]
        assert "FastAPI" in p["frameworks"]
        assert p["status"] == "ready"
        assert p["resumeFileName"] == "resume.pdf"
        assert p["experience_level"] in ["intermediate", "advanced"]
        assert len(p["recommended_tracks"]) > 0

    def test_upload_portfolio_json_success(self, client):
        token, user = create_test_student(client, email="json_student@example.com")

        payload = {
            "github_url": "https://github.com/json-student",
            "primary_languages": ["Python", "Go"],
            "frameworks": ["FastAPI", "Docker"],
            "notes": "Systems and API engineer",
        }
        res = client.post(
            "/api/portfolio/upload",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 201
        data = res.json()
        assert data["success"] is True
        assert data["portfolio"]["githubUrl"] == "https://github.com/json-student"

    def test_get_portfolio_me_after_upload(self, client):
        token, user = create_test_student(client, email="retrieval_student@example.com")

        # Upload
        payload = {
            "github_url": "https://github.com/retrieval-student",
            "primary_languages": ["Python"],
            "frameworks": ["FastAPI"],
        }
        upload_res = client.post(
            "/api/portfolio/upload",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
        )
        assert upload_res.status_code == 201

        # Retrieve via /me
        me_res = client.get("/api/portfolio/me", headers={"Authorization": f"Bearer {token}"})
        assert me_res.status_code == 200
        p = me_res.json()["portfolio"]
        assert p["githubUrl"] == "https://github.com/retrieval-student"
        assert p["primaryLanguages"] == ["Python"]

    def test_get_portfolio_by_id_owner_success(self, client):
        token, user = create_test_student(client, email="owner_student@example.com")

        upload_res = client.post(
            "/api/portfolio/upload",
            json={"github_url": "https://github.com/owner-student", "primary_languages": ["Python"]},
            headers={"Authorization": f"Bearer {token}"},
        )
        portfolio_id = upload_res.json()["portfolio"]["id"]

        # Owner fetches by ID
        res = client.get(f"/api/portfolio/{portfolio_id}", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200
        assert res.json()["portfolio"]["id"] == portfolio_id

    def test_company_can_view_student_portfolio(self, client):
        student_token, _ = create_test_student(client, email="student_view@example.com")
        company_token, _ = create_test_company(client, email="recruiter_view@example.com")

        upload_res = client.post(
            "/api/portfolio/upload",
            json={"github_url": "https://github.com/student-view", "primary_languages": ["Python"]},
            headers={"Authorization": f"Bearer {student_token}"},
        )
        portfolio_id = upload_res.json()["portfolio"]["id"]

        # Recruiter views student portfolio
        res = client.get(f"/api/portfolio/{portfolio_id}", headers={"Authorization": f"Bearer {company_token}"})
        assert res.status_code == 200
        assert res.json()["portfolio"]["id"] == portfolio_id

    def test_student_cannot_view_another_student_portfolio(self, client):
        s1_token, _ = create_test_student(client, email="student_one@example.com")
        s2_token, _ = create_test_student(client, email="student_two@example.com")

        upload_res = client.post(
            "/api/portfolio/upload",
            json={"github_url": "https://github.com/student-one", "primary_languages": ["Python"]},
            headers={"Authorization": f"Bearer {s1_token}"},
        )
        p1_id = upload_res.json()["portfolio"]["id"]

        # Student Two tries to access Student One's portfolio
        res = client.get(f"/api/portfolio/{p1_id}", headers={"Authorization": f"Bearer {s2_token}"})
        assert res.status_code == 403
        data = res.json()
        assert data["success"] is False
        assert data["error"]["code"] == "UNAUTHORIZED_ACCESS"

    def test_company_cannot_upload_portfolio(self, client):
        company_token, _ = create_test_company(client, email="company_uploader@example.com")

        res = client.post(
            "/api/portfolio/upload",
            json={"github_url": "https://github.com/company", "primary_languages": ["Python"]},
            headers={"Authorization": f"Bearer {company_token}"},
        )
        assert res.status_code == 403
        data = res.json()
        assert data["success"] is False
        assert data["error"]["code"] == "ROLE_MISMATCH"

    def test_upload_missing_auth_token(self, client):
        res = client.post(
            "/api/portfolio/upload",
            json={"github_url": "https://github.com/test", "primary_languages": ["Python"]},
        )
        assert res.status_code == 401
        assert res.json()["error"]["code"] == "UNAUTHORIZED"

    def test_upload_invalid_github_url(self, client):
        token, _ = create_test_student(client, email="invalid_url@example.com")
        res = client.post(
            "/api/portfolio/upload",
            json={"github_url": "https://notgithub.com/profile", "primary_languages": ["Python"]},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 422
        assert res.json()["error"]["code"] == "INVALID_GITHUB_URL"

    def test_upload_missing_languages(self, client):
        token, _ = create_test_student(client, email="missing_lang@example.com")
        res = client.post(
            "/api/portfolio/upload",
            json={"github_url": "https://github.com/user", "primary_languages": []},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 422
        assert res.json()["error"]["code"] == "MISSING_FIELDS"

    def test_upload_empty_payload(self, client):
        token, _ = create_test_student(client, email="empty_payload@example.com")
        res = client.post(
            "/api/portfolio/upload",
            json={},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 422
        assert res.json()["error"]["code"] == "MISSING_FIELDS"

    def test_upload_oversized_file(self, client):
        token, _ = create_test_student(client, email="oversized@example.com")
        oversized_data = b"0" * (16 * 1024 * 1024)  # 16 MB
        oversized_file = ("huge_archive.zip", io.BytesIO(oversized_data), "application/zip")

        res = client.post(
            "/api/portfolio/upload",
            data={
                "github_url": "https://github.com/testuser",
                "primary_languages": json.dumps(["Python"]),
            },
            files={"project_archive": oversized_file},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 413
        assert res.json()["error"]["code"] == "PAYLOAD_TOO_LARGE"
