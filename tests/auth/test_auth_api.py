"""
Automated Authentication & Security Test Suite
Role: Testing & Integration Developer (Vasil)
Project: Portfolio-Driven Adaptive Coding & Technical Assessment Platform
Team: HFT26-TEAM-75

This suite automates all Phase 2 test cases across:
- Student Registration & Login
- Company Registration & Login
- Security & RBAC (Role-Based Access Control)

Modes of Execution:
1. In-process against contract mock (default, zero network setup needed):
   pytest tests/auth/test_auth_api.py -v
2. Against live backend running on localhost:8000:
   API_BASE_URL=http://localhost:8000 pytest tests/auth/test_auth_api.py -v
"""

import os
import time
import pytest
import httpx
from starlette.testclient import TestClient

# Import mock server application
from tests.auth.auth_mock_server import app, create_jwt

API_BASE_URL = os.getenv("API_BASE_URL")

@pytest.fixture(scope="module")
def client():
    """Provides an HTTP test client, switching to live HTTP if API_BASE_URL is set."""
    if API_BASE_URL:
        with httpx.Client(base_url=API_BASE_URL, timeout=10.0) as http_client:
            yield http_client
    else:
        with TestClient(app) as test_client:
            yield test_client


# ============================================================================
# PHASE 2 - PART 1: STUDENT AUTHENTICATION TEST CASES
# ============================================================================

class TestStudentAuthentication:
    """Test Suite for Student Registration and Login flows."""

    def test_student_registration_success(self, client):
        """TC_AUTH_STUD_01: Successful student registration with valid payload."""
        timestamp = int(time.time() * 1000)
        payload = {
            "name": f"Priya Sharma {timestamp}",
            "email": f"priya_{timestamp}@student.cbit.ac.in",
            "password": "ValidPassword123!",
            "github_profile": f"https://github.com/priya-{timestamp}"
        }
        response = client.post("/api/auth/student/register", json=payload)
        assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["token_type"].lower() == "bearer"
        assert data["user"]["email"] == payload["email"].lower()
        assert data["user"]["role"] == "student"

    def test_student_login_success(self, client):
        """TC_AUTH_STUD_02: Successful student login with valid seeded credentials."""
        payload = {
            "email": "student@cbit.ac.in",
            "password": "Password123!"
        }
        response = client.post("/api/auth/student/login", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "student"
        assert data["user"]["email"] == "student@cbit.ac.in"

    def test_student_duplicate_registration(self, client):
        """TC_AUTH_STUD_03: Duplicate registration must return 409 Conflict."""
        # 'student@cbit.ac.in' is seeded in initial DB
        payload = {
            "name": "Another Arjun",
            "email": "student@cbit.ac.in",
            "password": "Password999!"
        }
        response = client.post("/api/auth/student/register", json=payload)
        assert response.status_code == 409, f"Expected 409 Conflict, got {response.status_code}"
        assert "already registered" in response.text.lower()

    def test_student_registration_invalid_email(self, client):
        """TC_AUTH_STUD_04: Malformed email syntax must be rejected with 422/400."""
        payload = {
            "name": "Invalid Email User",
            "email": "not-a-valid-email",
            "password": "Password123!"
        }
        response = client.post("/api/auth/student/register", json=payload)
        assert response.status_code in [400, 422], f"Expected 422 or 400 for bad email, got {response.status_code}"

    def test_student_login_incorrect_password(self, client):
        """TC_AUTH_STUD_05: Valid email with incorrect password must return 401 Unauthorized."""
        payload = {
            "email": "student@cbit.ac.in",
            "password": "WrongPassword999!"
        }
        response = client.post("/api/auth/student/login", json=payload)
        assert response.status_code == 401, f"Expected 401 Unauthorized, got {response.status_code}"
        assert "invalid" in response.text.lower()

    def test_student_registration_missing_fields(self, client):
        """TC_AUTH_STUD_06: Missing required fields (e.g. missing password) must return 422."""
        payload = {
            "name": "Incomplete User",
            "email": "incomplete@student.cbit.ac.in"
            # password omitted
        }
        response = client.post("/api/auth/student/register", json=payload)
        assert response.status_code in [400, 422], f"Expected 422/400 for missing password, got {response.status_code}"


# ============================================================================
# PHASE 2 - PART 2: COMPANY / RECRUITER AUTHENTICATION TEST CASES
# ============================================================================

class TestCompanyAuthentication:
    """Test Suite for Recruiter & Company Registration and Login flows."""

    def test_company_registration_success(self, client):
        """TC_AUTH_COMP_01: Successful company registration with valid payload."""
        timestamp = int(time.time() * 1000)
        payload = {
            "company_name": f"InnovateX Labs {timestamp}",
            "contact_name": "Marcus Aurelius",
            "email": f"hiring_{timestamp}@innovatex.io",
            "password": "CompanySecret2026!",
            "website": "https://innovatex.io"
        }
        response = client.post("/api/auth/company/register", json=payload)
        assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "company"
        assert data["user"]["company_name"] == payload["company_name"]

    def test_company_login_success(self, client):
        """TC_AUTH_COMP_02: Successful company login with valid seeded credentials."""
        payload = {
            "email": "recruiter@techcorp.com",
            "password": "CompanySecure2026!"
        }
        response = client.post("/api/auth/company/login", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "company"
        assert data["user"]["email"] == "recruiter@techcorp.com"

    def test_company_duplicate_registration(self, client):
        """TC_AUTH_COMP_03: Duplicate company registration must return 409 Conflict."""
        payload = {
            "company_name": "TechCorp Clone",
            "contact_name": "Fake Recruiter",
            "email": "recruiter@techcorp.com",  # Already exists
            "password": "AnotherPassword123!"
        }
        response = client.post("/api/auth/company/register", json=payload)
        assert response.status_code == 409, f"Expected 409 Conflict, got {response.status_code}"

    def test_company_login_invalid_credentials(self, client):
        """TC_AUTH_COMP_04: Non-existent email or wrong password returns 401 Unauthorized."""
        payload = {
            "email": "nonexistent@company.com",
            "password": "WrongPassword!"
        }
        response = client.post("/api/auth/company/login", json=payload)
        assert response.status_code == 401, f"Expected 401 Unauthorized, got {response.status_code}"

    def test_company_registration_missing_fields(self, client):
        """TC_AUTH_COMP_05: Missing required fields (e.g. company_name) must return 422."""
        payload = {
            "contact_name": "Ghost Recruiter",
            "email": "ghost@company.com",
            "password": "Pass12345!"
            # company_name omitted
        }
        response = client.post("/api/auth/company/register", json=payload)
        assert response.status_code in [400, 422], f"Expected 422/400 for missing company_name, got {response.status_code}"


# ============================================================================
# PHASE 2 - PART 3: SECURITY & ROLE-BASED ACCESS CONTROL (RBAC) TEST CASES
# ============================================================================

class TestSecurityAndRBAC:
    """Test Suite for JWT Token Integrity, Expiration, and Cross-Role Restrictions."""

    @pytest.fixture
    def student_token(self, client):
        """Helper fixture generating a valid student token."""
        res = client.post("/api/auth/student/login", json={
            "email": "student@cbit.ac.in",
            "password": "Password123!"
        })
        assert res.status_code == 200, f"Setup student login failed: {res.text}"
        return res.json()["access_token"]

    @pytest.fixture
    def company_token(self, client):
        """Helper fixture generating a valid company token."""
        res = client.post("/api/auth/company/login", json={
            "email": "recruiter@techcorp.com",
            "password": "CompanySecure2026!"
        })
        assert res.status_code == 200, f"Setup company login failed: {res.text}"
        return res.json()["access_token"]

    def test_unauthorized_access_to_protected_endpoint(self, client):
        """TC_SEC_01: Accessing protected /api/auth/me without token must return 401."""
        response = client.get("/api/auth/me")
        assert response.status_code == 401, f"Expected 401 Unauthorized, got {response.status_code}"

    def test_invalid_jwt_token(self, client):
        """TC_SEC_02: Providing malformed or tampered JWT must return 401 Unauthorized."""
        headers = {"Authorization": "Bearer not.a.valid.jwt.token"}
        response = client.get("/api/auth/me", headers=headers)
        assert response.status_code == 401, f"Expected 401 for malformed JWT, got {response.status_code}"

    def test_expired_jwt_token(self, client):
        """TC_SEC_03: Providing an expired JWT must return 401 Unauthorized."""
        # Generate token with negative expiration (-3600 seconds)
        expired_token = create_jwt(
            {"sub": "std_001", "email": "student@cbit.ac.in", "role": "student"},
            expires_in=-3600
        )
        headers = {"Authorization": f"Bearer {expired_token}"}
        response = client.get("/api/auth/me", headers=headers)
        assert response.status_code == 401, f"Expected 401 for expired token, got {response.status_code}"
        assert "expired" in response.text.lower()

    def test_student_accessing_company_only_route(self, client, student_token):
        """TC_SEC_04: Student attempting to access company route (/api/recruiter/candidates) must return 403 Forbidden."""
        headers = {"Authorization": f"Bearer {student_token}"}
        response = client.get("/api/recruiter/candidates", headers=headers)
        assert response.status_code == 403, f"Expected 403 Forbidden for cross-role student access, got {response.status_code}"
        assert "forbidden" in response.text.lower() or "requires company" in response.text.lower()

    def test_company_accessing_student_only_route(self, client, company_token):
        """TC_SEC_05: Company attempting to access student route (/api/assessment/submit) must return 403 Forbidden."""
        headers = {"Authorization": f"Bearer {company_token}"}
        response = client.post("/api/assessment/submit", headers=headers, json={"code": "print('hello')"})
        assert response.status_code == 403, f"Expected 403 Forbidden for cross-role company access, got {response.status_code}"
        assert "forbidden" in response.text.lower() or "requires student" in response.text.lower()

    def test_valid_profile_access_with_tokens(self, client, student_token, company_token):
        """Verify that legitimate tokens can access their own /api/auth/me profile."""
        # Student profile
        res_stud = client.get("/api/auth/me", headers={"Authorization": f"Bearer {student_token}"})
        assert res_stud.status_code == 200
        assert res_stud.json()["role"] == "student"

        # Company profile
        res_comp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {company_token}"})
        assert res_comp.status_code == 200
        assert res_comp.json()["role"] == "company"
