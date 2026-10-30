"""
Frontend-Backend Integration & Contract Verification Suite
Role: Testing & Integration Developer (Vasil)
Project: Portfolio-Driven Adaptive Coding & Technical Assessment Platform
Team: HFT26-TEAM-75

This suite verifies:
1. CORS compliance for frontend dev origins (Vite/React: http://localhost:5173, Next/React: http://localhost:3000)
2. JSON Response Contract compatibility with Frontend User State Model
3. Standardized Error Response formatting (detail string or error object)
4. Frontend Behavior during Backend Unavailable (503 / Connection Failure) states
"""

import pytest
from starlette.testclient import TestClient
from tests.auth.auth_mock_server import app

@pytest.fixture
def client():
    return TestClient(app)

class TestFrontendBackendContracts:
    """Verifies that Backend APIs strictly conform to Frontend expectations."""

    def test_cors_preflight_headers(self, client):
        """Verify that CORS preflight (OPTIONS) requests allow Frontend origins and headers."""
        headers = {
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type"
        }
        res = client.options("/api/auth/student/login", headers=headers)
        assert res.status_code == 200
        assert res.headers.get("access-control-allow-origin") in ["*", "http://localhost:5173"]
        assert "authorization" in res.headers.get("access-control-allow-headers", "").lower()

    def test_student_response_contract_compatibility(self, client):
        """Verify that Student login returns the exact keys required by Frontend UserContext."""
        res = client.post("/api/auth/student/login", json={
            "email": "student@cbit.ac.in",
            "password": "Password123!"
        })
        assert res.status_code == 200
        data = res.json()

        # Contract assertion for frontend AuthProvider state:
        # Expected: { access_token: str, token_type: str, user: { id: str, email: str, role: 'student', name: str } }
        assert "access_token" in data, "Frontend requires 'access_token' for Authorization header"
        assert "token_type" in data, "Frontend requires 'token_type' (bearer)"
        assert "user" in data, "Frontend requires 'user' object"
        user = data["user"]
        assert "id" in user, "User object must contain 'id'"
        assert "email" in user, "User object must contain 'email'"
        assert "role" in user, "User object must contain 'role' for routing guards"
        assert user["role"] == "student"

    def test_company_response_contract_compatibility(self, client):
        """Verify that Company login returns the exact keys required by Recruiter portal."""
        res = client.post("/api/auth/company/login", json={
            "email": "recruiter@techcorp.com",
            "password": "CompanySecure2026!"
        })
        assert res.status_code == 200
        data = res.json()

        assert "access_token" in data
        assert "user" in data
        user = data["user"]
        assert user["role"] == "company", "User role must be company for dashboard redirection"
        assert "company_name" in user, "Company user must contain 'company_name' for header branding"

    def test_error_response_shape_consistency(self, client):
        """Verify that 4xx errors return standardized 'detail' field parsed by frontend toast/alert."""
        # 401 Unauthorized
        res_401 = client.post("/api/auth/student/login", json={
            "email": "student@cbit.ac.in",
            "password": "BadPassword"
        })
        assert res_401.status_code == 401
        assert "detail" in res_401.json()

        # 409 Conflict
        res_409 = client.post("/api/auth/student/register", json={
            "name": "Arjun Duplicate",
            "email": "student@cbit.ac.in",
            "password": "Password123!"
        })
        assert res_409.status_code == 409
        assert "detail" in res_409.json()

        # 403 Forbidden
        token = res = client.post("/api/auth/student/login", json={
            "email": "student@cbit.ac.in",
            "password": "Password123!"
        }).json()["access_token"]
        res_403 = client.get("/api/recruiter/candidates", headers={"Authorization": f"Bearer {token}"})
        assert res_403.status_code == 403
        assert "detail" in res_403.json()

    def test_backend_down_simulation_behavior(self):
        """
        Simulate frontend behavior when backend is completely offline.
        Verifies client timeout / connection error contract.
        """
        import httpx
        # Connecting to a non-existent port (e.g. 59999) simulates Backend Unavailable
        with pytest.raises((httpx.ConnectError, httpx.ConnectTimeout, httpx.NetworkError)):
            client = httpx.Client(base_url="http://127.0.0.1:59999", timeout=0.5)
            client.get("/api/health")
