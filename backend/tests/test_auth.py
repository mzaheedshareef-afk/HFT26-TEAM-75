from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
import httpx
import jwt
from postgrest.exceptions import APIError
import pytest
from fastapi.testclient import TestClient
from supabase_auth.errors import AuthApiError

from backend.app.core.config import settings
from backend.app.core.security import AuthException
from backend.app.database.supabase import get_supabase_client
from backend.app.main import app
from backend.app.services.auth_service import AuthService


# =============================================================
# High-Fidelity Mock Supabase Client
# =============================================================

class MockAuthUser:
    def __init__(self, user_id: str, email: str, user_metadata: Dict[str, Any]):
        self.id = user_id
        self.email = email
        self.user_metadata = user_metadata
        self.identities = [{"id": user_id, "provider": "email"}]


class MockAuthSession:
    def __init__(self, access_token: str):
        self.access_token = access_token


class MockAuthResponse:
    def __init__(self, user: MockAuthUser, session: Optional[MockAuthSession] = None):
        self.user = user
        self.session = session


class MockQueryBuilder:
    def __init__(self, table_name: str, database_store: Dict[str, List[Dict[str, Any]]], client_ref: "MockSupabase"):
        self.table_name = table_name
        self.store = database_store
        self.client_ref = client_ref
        self._action = "select"
        self._data_to_insert: Optional[Dict[str, Any]] = None
        self._data_to_update: Optional[Dict[str, Any]] = None
        self._filters: List[Tuple[str, str]] = []

    def select(self, columns: str = "*"):
        self._action = "select"
        return self

    def insert(self, data: Dict[str, Any]):
        self._action = "insert"
        self._data_to_insert = data
        return self

    def update(self, data: Dict[str, Any]):
        self._action = "update"
        self._data_to_update = data
        return self

    def delete(self):
        self._action = "delete"
        return self

    def eq(self, column: str, value: Any):
        self._filters.append((column, str(value)))
        return self

    def execute(self):
        if self.client_ref.simulate_db_error:
            raise APIError({"message": "Database connection refused", "code": "08006"})

        if self.client_ref.simulate_profile_insert_failure and self._action == "insert":
            raise APIError({"message": "Foreign key violation or table error", "code": "23503"})

        table_records = self.store.setdefault(self.table_name, [])

        if self._action == "insert":
            # Check unique constraint on email
            if self._data_to_insert:
                email = self._data_to_insert.get("email")
                for r in table_records:
                    if r.get("email") == email:
                        raise APIError({"message": "duplicate key value violates unique constraint", "code": "23505"})
                table_records.append(dict(self._data_to_insert))
                return type("PostgrestResponse", (), {"data": [dict(self._data_to_insert)]})()

        elif self._action == "select":
            results = list(table_records)
            for col, val in self._filters:
                results = [r for r in results if str(r.get(col)) == val]
            return type("PostgrestResponse", (), {"data": results})()

        elif self._action == "update":
            results = list(table_records)
            for col, val in self._filters:
                results = [r for r in results if str(r.get(col)) == val]
            for r in results:
                if self._data_to_update:
                    r.update(self._data_to_update)
            return type("PostgrestResponse", (), {"data": results})()

        elif self._action == "delete":
            results = list(table_records)
            for col, val in self._filters:
                results = [r for r in results if str(r.get(col)) == val]
            for r in results:
                if r in table_records:
                    table_records.remove(r)
            return type("PostgrestResponse", (), {"data": results})()

        return type("PostgrestResponse", (), {"data": []})()


class MockSupabaseAuth:
    def __init__(self, client_ref: "MockSupabase"):
        self.client_ref = client_ref
        self.auth_users: Dict[str, Dict[str, Any]] = {}

    def sign_up(self, credentials: Dict[str, Any]) -> MockAuthResponse:
        if self.client_ref.simulate_service_unavailable:
            raise httpx.ConnectError("Connection refused by Supabase Auth server")

        email = credentials.get("email", "").lower()
        password = credentials.get("password")
        options = credentials.get("options", {})
        metadata = options.get("data", {})

        if email in self.auth_users:
            raise AuthApiError("User already registered", 422, "user_already_exists")

        import uuid
        user_id = str(uuid.uuid4())
        user_obj = {
            "id": user_id,
            "email": email,
            "password": password,
            "metadata": metadata,
        }
        self.auth_users[email] = user_obj

        # Generate JWT token
        token = jwt.encode(
            {
                "sub": user_id,
                "email": email,
                "role": "authenticated",
                "exp": int((datetime.now(timezone.utc) + timedelta(hours=24)).timestamp()),
                "iat": int(datetime.now(timezone.utc).timestamp()),
            },
            settings.SUPABASE_JWT_SECRET,
            algorithm="HS256",
        )

        user = MockAuthUser(user_id=user_id, email=email, user_metadata=metadata)
        session = MockAuthSession(access_token=token)
        return MockAuthResponse(user=user, session=session)

    def sign_in_with_password(self, credentials: Dict[str, Any]) -> MockAuthResponse:
        if self.client_ref.simulate_service_unavailable:
            raise httpx.ConnectError("Connection refused by Supabase Auth server")

        email = credentials.get("email", "").lower()
        password = credentials.get("password")

        user_data = self.auth_users.get(email)
        if not user_data or user_data["password"] != password:
            raise AuthApiError("Invalid login credentials", 400, "invalid_credentials")

        user_id = user_data["id"]
        token = jwt.encode(
            {
                "sub": user_id,
                "email": email,
                "role": "authenticated",
                "exp": int((datetime.now(timezone.utc) + timedelta(hours=24)).timestamp()),
                "iat": int(datetime.now(timezone.utc).timestamp()),
            },
            settings.SUPABASE_JWT_SECRET,
            algorithm="HS256",
        )
        user = MockAuthUser(user_id=user_id, email=email, user_metadata=user_data["metadata"])
        session = MockAuthSession(access_token=token)
        return MockAuthResponse(user=user, session=session)


class MockSupabase:
    def __init__(self):
        self.db: Dict[str, List[Dict[str, Any]]] = {}
        self.auth = MockSupabaseAuth(client_ref=self)
        self.simulate_service_unavailable = False
        self.simulate_db_error = False
        self.simulate_profile_insert_failure = False

    def table(self, table_name: str) -> MockQueryBuilder:
        return MockQueryBuilder(table_name=table_name, database_store=self.db, client_ref=self)


# =============================================================
# Pytest Fixtures
# =============================================================

@pytest.fixture
def mock_supabase():
    client = MockSupabase()
    return client


@pytest.fixture
def client(mock_supabase):
    app.dependency_overrides[get_supabase_client] = lambda: mock_supabase
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


# =============================================================
# 1. Base Health Endpoints
# =============================================================

def test_health_endpoints(client):
    res_root = client.get("/")
    assert res_root.status_code == 200
    assert res_root.json()["status"] == "healthy"
    assert res_root.json()["docs"] == "/docs"

    res_health = client.get("/health")
    assert res_health.status_code == 200
    assert res_health.json()["status"] == "ok"


# =============================================================
# 2. Student Registration Tests
# =============================================================

def test_student_register_success(client):
    payload = {
        "full_name": "Candidate One",
        "email": "candidate1@example.com",
        "password": "StrongPassword123",
    }
    response = client.post("/api/auth/student/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "candidate1@example.com"
    assert data["user"]["name"] == "Candidate One"
    assert data["user"]["role"] == "student"


def test_student_register_duplicate_email(client):
    payload = {
        "full_name": "Candidate Two",
        "email": "duplicate@example.com",
        "password": "StrongPassword123",
    }
    res1 = client.post("/api/auth/student/register", json=payload)
    assert res1.status_code == 201

    res2 = client.post("/api/auth/student/register", json=payload)
    assert res2.status_code == 409
    err = res2.json()
    assert err["success"] is False
    assert err["error"]["code"] == "EMAIL_ALREADY_EXISTS"


def test_student_register_weak_passwords(client):
    weak_cases = [
        "short1A",
        "nouppercase123",
        "NOLOWERCASE123",
        "NoDigitsInPassword",
    ]
    for pwd in weak_cases:
        payload = {
            "full_name": "Weak Tester",
            "email": f"weak_{abs(hash(pwd))}@example.com",
            "password": pwd,
        }
        res = client.post("/api/auth/student/register", json=payload)
        assert res.status_code == 400
        err = res.json()
        assert err["success"] is False
        assert err["error"]["code"] == "WEAK_PASSWORD"


def test_student_register_invalid_email(client):
    payload = {
        "full_name": "Invalid Email",
        "email": "not-a-valid-email",
        "password": "StrongPassword123",
    }
    res = client.post("/api/auth/student/register", json=payload)
    assert res.status_code == 422
    err = res.json()
    assert err["success"] is False
    assert err["error"]["code"] == "INVALID_EMAIL"


def test_student_register_missing_fields(client):
    payload = {
        "full_name": "Missing Password Candidate",
        "email": "missing_pwd@example.com",
    }
    res = client.post("/api/auth/student/register", json=payload)
    assert res.status_code == 422
    err = res.json()
    assert err["success"] is False
    assert err["error"]["code"] == "MISSING_FIELDS"


# =============================================================
# 3. Student Login Tests
# =============================================================

def test_student_login_success(client):
    reg_payload = {
        "full_name": "Login Candidate",
        "email": "student_login@example.com",
        "password": "StrongPassword123",
    }
    client.post("/api/auth/student/register", json=reg_payload)

    login_payload = {
        "email": "student_login@example.com",
        "password": "StrongPassword123",
    }
    response = client.post("/api/auth/student/login", json=login_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "access_token" in data
    assert data["user"]["email"] == "student_login@example.com"
    assert data["user"]["role"] == "student"


def test_student_login_incorrect_password(client):
    reg_payload = {
        "full_name": "Wrong Password Candidate",
        "email": "wrongpwd@example.com",
        "password": "StrongPassword123",
    }
    client.post("/api/auth/student/register", json=reg_payload)

    login_payload = {
        "email": "wrongpwd@example.com",
        "password": "WrongPassword999",
    }
    response = client.post("/api/auth/student/login", json=login_payload)
    assert response.status_code == 401
    err = response.json()
    assert err["success"] is False
    assert err["error"]["code"] == "INVALID_CREDENTIALS"
    assert err["error"]["message"] == "Email or password is incorrect"


def test_student_login_non_existent_email(client):
    login_payload = {
        "email": "nonexistent_candidate@example.com",
        "password": "StrongPassword123",
    }
    response = client.post("/api/auth/student/login", json=login_payload)
    assert response.status_code == 401
    err = response.json()
    assert err["success"] is False
    assert err["error"]["code"] == "INVALID_CREDENTIALS"


# =============================================================
# 4. Company Registration & Login Tests
# =============================================================

def test_company_register_and_login_success(client):
    reg_payload = {
        "company_name": "Example Technologies",
        "official_email": "hr@example.com",
        "password": "StrongPassword123",
    }
    res_reg = client.post("/api/auth/company/register", json=reg_payload)
    assert res_reg.status_code == 201
    data_reg = res_reg.json()
    assert data_reg["success"] is True
    assert data_reg["user"]["name"] == "Example Technologies"
    assert data_reg["user"]["email"] == "hr@example.com"
    assert data_reg["user"]["role"] == "company"

    # Login with official_email
    login_res = client.post(
        "/api/auth/company/login",
        json={"email": "hr@example.com", "password": "StrongPassword123"},
    )
    assert login_res.status_code == 200
    assert login_res.json()["success"] is True
    assert login_res.json()["user"]["role"] == "company"


def test_company_register_duplicate_email(client):
    reg_payload = {
        "company_name": "Duplicate Company",
        "official_email": "dup@company.com",
        "password": "StrongPassword123",
    }
    res1 = client.post("/api/auth/company/register", json=reg_payload)
    assert res1.status_code == 201

    res2 = client.post("/api/auth/company/register", json=reg_payload)
    assert res2.status_code == 409
    assert res2.json()["error"]["code"] == "EMAIL_ALREADY_EXISTS"


# =============================================================
# 5. Role Mismatch Tests
# =============================================================

def test_student_attempting_company_login(client):
    reg_student = {
        "full_name": "Student A",
        "email": "student_a@example.com",
        "password": "StrongPassword123",
    }
    client.post("/api/auth/student/register", json=reg_student)

    # Student attempts company login
    res = client.post(
        "/api/auth/company/login",
        json={"email": "student_a@example.com", "password": "StrongPassword123"},
    )
    assert res.status_code == 403
    err = res.json()
    assert err["success"] is False
    assert err["error"]["code"] == "ROLE_MISMATCH"


def test_company_attempting_student_login(client):
    reg_company = {
        "company_name": "Company B",
        "official_email": "company_b@example.com",
        "password": "StrongPassword123",
    }
    client.post("/api/auth/company/register", json=reg_company)

    # Company attempts student login
    res = client.post(
        "/api/auth/student/login",
        json={"email": "company_b@example.com", "password": "StrongPassword123"},
    )
    assert res.status_code == 403
    err = res.json()
    assert err["success"] is False
    assert err["error"]["code"] == "ROLE_MISMATCH"


# =============================================================
# 6. Current User API (/api/auth/me) & JWT Verification Tests
# =============================================================

def test_get_me_success(client):
    reg = client.post(
        "/api/auth/student/register",
        json={
            "full_name": "Auth Me Candidate",
            "email": "auth_me@example.com",
            "password": "StrongPassword123",
        },
    )
    token = reg.json()["access_token"]

    response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["user"]["name"] == "Auth Me Candidate"
    assert data["user"]["email"] == "auth_me@example.com"
    assert data["user"]["role"] == "student"


def test_get_me_unauthorized_missing_token(client):
    response = client.get("/api/auth/me")
    assert response.status_code == 401
    err = response.json()
    assert err["success"] is False
    assert err["error"]["code"] == "INVALID_TOKEN"


def test_get_me_invalid_token(client):
    response = client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer malformed.or.untrusted.token"},
    )
    assert response.status_code == 401
    err = response.json()
    assert err["success"] is False
    assert err["error"]["code"] == "INVALID_TOKEN"


def test_get_me_expired_token(client, mock_supabase):
    import uuid
    user_id = str(uuid.uuid4())
    mock_supabase.db.setdefault("profiles", []).append({
        "id": user_id,
        "full_name": "Expired Candidate",
        "email": "expired@example.com",
        "role": "student",
        "is_active": True,
    })

    expired_token = jwt.encode(
        {
            "sub": user_id,
            "email": "expired@example.com",
            "role": "authenticated",
            "exp": int((datetime.now(timezone.utc) - timedelta(minutes=10)).timestamp()),
            "iat": int((datetime.now(timezone.utc) - timedelta(minutes=60)).timestamp()),
        },
        settings.SUPABASE_JWT_SECRET,
        algorithm="HS256",
    )

    response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert response.status_code == 401
    err = response.json()
    assert err["success"] is False
    assert err["error"]["code"] == "EXPIRED_TOKEN"


# =============================================================
# 7. Role Modification Attempts (Privilege Escalation Prevention)
# =============================================================

def test_role_modification_attempt(mock_supabase):
    user_profile = {
        "id": "user-uuid-1",
        "full_name": "Student Tester",
        "email": "student@example.com",
        "role": "student",
        "is_active": True,
    }
    mock_supabase.db.setdefault("profiles", []).append(user_profile)

    with pytest.raises(AuthException) as exc_info:
        AuthService.update_user_profile(
            client=mock_supabase,
            user_id="user-uuid-1",
            current_profile=user_profile,
            updates={"role": "company", "full_name": "Hacker"},
        )
    assert exc_info.value.code == "ROLE_MODIFICATION_PROHIBITED"
    assert exc_info.value.status_code == 403


# =============================================================
# 8. Service Unavailable & Profile Creation Failure Tests
# =============================================================

def test_supabase_service_unavailable(client, mock_supabase):
    mock_supabase.simulate_service_unavailable = True

    response = client.post(
        "/api/auth/student/register",
        json={
            "full_name": "Network Fail",
            "email": "netfail@example.com",
            "password": "StrongPassword123",
        },
    )
    assert response.status_code == 503
    err = response.json()
    assert err["success"] is False
    assert err["error"]["code"] == "SERVICE_UNAVAILABLE"


def test_profile_creation_failure(client, mock_supabase):
    mock_supabase.simulate_profile_insert_failure = True

    response = client.post(
        "/api/auth/student/register",
        json={
            "full_name": "DB Fail Candidate",
            "email": "dbfail@example.com",
            "password": "StrongPassword123",
        },
    )
    assert response.status_code == 500
    err = response.json()
    assert err["success"] is False
    assert err["error"]["code"] == "PROFILE_CREATION_FAILED"


# =============================================================
# 9. Inactive Account Tests
# =============================================================

def test_inactive_account_student_login(client, mock_supabase):
    reg = client.post(
        "/api/auth/student/register",
        json={
            "full_name": "Inactive Candidate",
            "email": "inactive@example.com",
            "password": "StrongPassword123",
        },
    )
    assert reg.status_code == 201

    # Deactivate account in database
    for p in mock_supabase.db.get("profiles", []):
        if p["email"] == "inactive@example.com":
            p["is_active"] = False

    response = client.post(
        "/api/auth/student/login",
        json={"email": "inactive@example.com", "password": "StrongPassword123"},
    )
    assert response.status_code == 403
    err = response.json()
    assert err["success"] is False
    assert err["error"]["code"] == "ACCOUNT_INACTIVE"


def test_inactive_account_get_me(client, mock_supabase):
    import uuid
    user_id = str(uuid.uuid4())
    mock_supabase.db.setdefault("profiles", []).append({
        "id": user_id,
        "full_name": "Inactive Profile",
        "email": "inactive_profile@example.com",
        "role": "student",
        "is_active": False,
    })

    token = jwt.encode(
        {
            "sub": user_id,
            "email": "inactive_profile@example.com",
            "role": "authenticated",
            "exp": int((datetime.now(timezone.utc) + timedelta(minutes=60)).timestamp()),
            "iat": int(datetime.now(timezone.utc).timestamp()),
        },
        settings.SUPABASE_JWT_SECRET,
        algorithm="HS256",
    )

    response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403
    err = response.json()
    assert err["success"] is False
    assert err["error"]["code"] == "ACCOUNT_INACTIVE"
