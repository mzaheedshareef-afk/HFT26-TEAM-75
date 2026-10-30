"""
Authentication Mock Server for HFT26-TEAM-75
Role: Testing & Integration Developer (Vasil)

This mock server implements the agreed Authentication & RBAC API Contracts.
It allows:
1. Zaheed (Frontend) to develop and verify login/registration/redirection flows immediately.
2. Vasil (Testing) to run automated contract tests and Postman tests.
3. Establishing the baseline for Srinath's backend implementation.

Features:
- CORS enabled for frontend dev servers (http://localhost:5173, http://localhost:3000)
- In-memory database with initial seed accounts
- Self-contained HMAC-SHA256 JWT generation and validation (no external crypto lib required)
- Strict validation for email formats and missing fields
- Role-based access control (Student vs Company)
"""

import base64
import hashlib
import hmac
import json
import time
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, HTTPException, Header, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(
    title="HFT26 Authentication Mock Server",
    description="API Contract Verification Mock Server for Student & Company Auth",
    version="1.0.0"
)

# Enable CORS for Frontend Development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SECRET_KEY = "hft26-test-secret-key-change-in-production"
JWT_EXPIRATION_SECONDS = 3600  # 1 hour

# --- JWT Helper Functions (Pure Standard Library) ---
def base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode('utf-8').rstrip('=')

def base64url_decode(data: str) -> bytes:
    padding = '=' * (4 - (len(data) % 4)) if len(data) % 4 != 0 else ''
    return base64.urlsafe_b64decode(data + padding)

def create_jwt(payload: dict, secret: str = SECRET_KEY, expires_in: int = JWT_EXPIRATION_SECONDS) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    payload_copy = payload.copy()
    payload_copy["exp"] = int(time.time()) + expires_in
    payload_copy["iat"] = int(time.time())
    
    encoded_header = base64url_encode(json.dumps(header, separators=(',', ':')).encode('utf-8'))
    encoded_payload = base64url_encode(json.dumps(payload_copy, separators=(',', ':')).encode('utf-8'))
    
    signature_input = f"{encoded_header}.{encoded_payload}".encode('utf-8')
    signature = hmac.new(secret.encode('utf-8'), signature_input, hashlib.sha256).digest()
    encoded_signature = base64url_encode(signature)
    
    return f"{encoded_header}.{encoded_payload}.{encoded_signature}"

def verify_jwt(token: str, secret: str = SECRET_KEY) -> dict:
    parts = token.split('.')
    if len(parts) != 3:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token format"
        )
    
    header_b64, payload_b64, signature_b64 = parts
    signature_input = f"{header_b64}.{payload_b64}".encode('utf-8')
    expected_signature = base64url_encode(hmac.new(secret.encode('utf-8'), signature_input, hashlib.sha256).digest())
    
    if not hmac.compare_digest(expected_signature, signature_b64):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token signature"
        )
    
    try:
        payload = json.loads(base64url_decode(payload_b64).decode('utf-8'))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not decode token payload"
        )
        
    if "exp" in payload and time.time() > payload["exp"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
        
    return payload

# --- In-Memory Database & Seed Data ---
users_db: Dict[str, Dict[str, Any]] = {
    "student@cbit.ac.in": {
        "id": "std_001",
        "email": "student@cbit.ac.in",
        "password": "Password123!",
        "name": "Arjun Kumar",
        "role": "student",
        "github_profile": "https://github.com/arjun-cbit"
    },
    "recruiter@techcorp.com": {
        "id": "comp_001",
        "email": "recruiter@techcorp.com",
        "password": "CompanySecure2026!",
        "name": "Sarah Jenkins",
        "company_name": "TechCorp Solutions",
        "role": "company",
        "website": "https://techcorp.example.com"
    }
}

# --- Request / Response Schemas ---
import re
from pydantic import BaseModel, Field, field_validator

EMAIL_REGEX = re.compile(r"^[\w\.\+\-]+@([a-zA-Z0-9\-]+\.)+[a-zA-Z]{2,}$")

def validate_email_format(v: str) -> str:
    if not isinstance(v, str) or not EMAIL_REGEX.match(v.strip()):
        raise ValueError("Invalid email format")
    return v.strip().lower()

class StudentRegisterRequest(BaseModel):
    name: str = Field(..., min_length=1)
    email: str
    password: str = Field(..., min_length=6)
    github_profile: Optional[str] = None

    @field_validator("email")
    @classmethod
    def check_email(cls, v: str) -> str:
        return validate_email_format(v)

class StudentLoginRequest(BaseModel):
    email: str
    password: str = Field(..., min_length=1)

    @field_validator("email")
    @classmethod
    def check_email(cls, v: str) -> str:
        return validate_email_format(v)

class CompanyRegisterRequest(BaseModel):
    company_name: str = Field(..., min_length=1)
    contact_name: str = Field(..., min_length=1)
    email: str
    password: str = Field(..., min_length=6)
    website: Optional[str] = None

    @field_validator("email")
    @classmethod
    def check_email(cls, v: str) -> str:
        return validate_email_format(v)

class CompanyLoginRequest(BaseModel):
    email: str
    password: str = Field(..., min_length=1)

    @field_validator("email")
    @classmethod
    def check_email(cls, v: str) -> str:
        return validate_email_format(v)

class UserResponse(BaseModel):
    id: str
    email: str
    role: str
    name: Optional[str] = None
    company_name: Optional[str] = None

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
    message: Optional[str] = None

# --- Dependency: Auth & Role Validation ---
def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing"
        )
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header scheme. Must be Bearer <token>"
        )
    token = authorization[len("Bearer "):]
    payload = verify_jwt(token)
    return payload

def require_role(required_role: str):
    def role_checker(user: dict = Depends(get_current_user)):
        user_role = user.get("role")
        if user_role != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: Requires {required_role} role, but user is {user_role}"
            )
        return user
    return role_checker

# --- API Endpoints ---

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "auth-mock-server", "version": "1.0.0"}

# 1. Student Registration
@app.post("/api/auth/student/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register_student(req: StudentRegisterRequest):
    email_key = req.email.lower()
    if email_key in users_db:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered"
        )
    
    new_user = {
        "id": f"std_{int(time.time() * 1000) % 1000000}",
        "name": req.name,
        "email": email_key,
        "password": req.password,
        "role": "student",
        "github_profile": req.github_profile
    }
    users_db[email_key] = new_user
    
    token = create_jwt({"sub": new_user["id"], "email": email_key, "role": "student"})
    return AuthResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(
            id=new_user["id"],
            email=new_user["email"],
            name=new_user["name"],
            role="student"
        ),
        message="Student registered successfully"
    )

# 2. Student Login
@app.post("/api/auth/student/login", response_model=AuthResponse, status_code=status.HTTP_200_OK)
def login_student(req: StudentLoginRequest):
    email_key = req.email.lower()
    user = users_db.get(email_key)
    if not user or user.get("role") != "student" or user.get("password") != req.password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
        
    token = create_jwt({"sub": user["id"], "email": email_key, "role": "student"})
    return AuthResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            name=user.get("name"),
            role="student"
        ),
        message="Login successful"
    )

# 3. Company Registration
@app.post("/api/auth/company/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register_company(req: CompanyRegisterRequest):
    email_key = req.email.lower()
    if email_key in users_db:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered"
        )
        
    new_user = {
        "id": f"comp_{int(time.time() * 1000) % 1000000}",
        "company_name": req.company_name,
        "name": req.contact_name,
        "email": email_key,
        "password": req.password,
        "role": "company",
        "website": req.website
    }
    users_db[email_key] = new_user
    
    token = create_jwt({"sub": new_user["id"], "email": email_key, "role": "company"})
    return AuthResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(
            id=new_user["id"],
            email=new_user["email"],
            name=new_user["name"],
            company_name=new_user["company_name"],
            role="company"
        ),
        message="Company registered successfully"
    )

# 4. Company Login
@app.post("/api/auth/company/login", response_model=AuthResponse, status_code=status.HTTP_200_OK)
def login_company(req: CompanyLoginRequest):
    email_key = req.email.lower()
    user = users_db.get(email_key)
    if not user or user.get("role") != "company" or user.get("password") != req.password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
        
    token = create_jwt({"sub": user["id"], "email": email_key, "role": "company"})
    return AuthResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            name=user.get("name"),
            company_name=user.get("company_name"),
            role="company"
        ),
        message="Login successful"
    )

# 5. Get Current User Profile (Protected - Any Authenticated User)
@app.get("/api/auth/me", response_model=UserResponse)
def get_current_user_profile(user: dict = Depends(get_current_user)):
    email = user.get("email")
    user_record = users_db.get(email)
    if not user_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserResponse(
        id=user_record["id"],
        email=user_record["email"],
        role=user_record["role"],
        name=user_record.get("name"),
        company_name=user_record.get("company_name")
    )

# 6. Student-Only Route (e.g., Submit Assessment)
@app.post("/api/assessment/submit")
def submit_assessment(user: dict = Depends(require_role("student"))):
    return {
        "status": "success",
        "message": f"Assessment submission received from student {user.get('email')}",
        "student_id": user.get("sub")
    }

# 7. Company-Only Route (e.g., View Candidate Pool)
@app.get("/api/recruiter/candidates")
def view_candidates(user: dict = Depends(require_role("company"))):
    return {
        "status": "success",
        "company_id": user.get("sub"),
        "candidates": [
            {"id": "std_001", "name": "Arjun Kumar", "score": 94, "rank": 1}
        ]
    }

# Endpoint to generate test tokens (expired / malformed) for testing suites
@app.get("/api/test/generate-token")
def generate_test_token(role: str = "student", expired: bool = False):
    expires_in = -3600 if expired else 3600
    token = create_jwt({"sub": "test_user_id", "email": f"test_{role}@example.com", "role": role}, expires_in=expires_in)
    return {"token": token, "is_expired": expired, "role": role}

if __name__ == "__main__":
    import uvicorn
    print("Starting HFT26 Authentication Mock Server on http://localhost:8000...")
    uvicorn.run(app, host="0.0.0.0", port=8000)
