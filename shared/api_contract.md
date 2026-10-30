# 📡 API Contract & Integration Guide: Supabase Authentication Service

> **Author**: Srinath (Backend Developer)  
> **Audience**: Frontend Developer (Zaheed), Team-75  
> **Status**: Implemented & Ready for Integration  
> **Base URL**: `http://localhost:8000/api/auth`  
> **Swagger Docs**: `http://localhost:8000/docs`  
> **Tech Stack**: FastAPI, Supabase Auth, Supabase Database, Pydantic, Pytest  

---

## 1. Overview & General Standards

- All requests accept `Content-Type: application/json`.
- All responses return JSON with a top-level `"success": true` or `"success": false` boolean flag.
- Protected endpoints require an `Authorization: Bearer <access_token>` header containing the verified Supabase JWT token.
- Passwords are encrypted and managed securely via **Supabase Auth**.

### Success Response Format (Registration & Login)
```json
{
  "success": true,
  "access_token": "SUPABASE_ACCESS_TOKEN",
  "token_type": "bearer",
  "user": {
    "id": "7b8c9d01-e234-4567-890a-bcdef0123456",
    "name": "Candidate Name",
    "email": "candidate@example.com",
    "role": "student"
  }
}
```

### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Email or password is incorrect"
  }
}
```

### Standard Error Codes
| Error Code | HTTP Status | Description |
| :--- | :---: | :--- |
| `INVALID_CREDENTIALS` | 401 | Email or password incorrect (does not reveal user existence) |
| `ROLE_MISMATCH` | 403 | Student account attempting company login or vice-versa |
| `EMAIL_ALREADY_EXISTS` | 409 | Email is already registered |
| `WEAK_PASSWORD` | 400 | Password does not meet security criteria (min 8 chars, 1 uppercase, 1 lowercase, 1 number) |
| `INVALID_EMAIL` | 422 | Malformed email syntax |
| `MISSING_FIELDS` | 422 | Required fields missing in request body |
| `EXPIRED_TOKEN` | 401 | JWT access token has expired |
| `INVALID_TOKEN` | 401 | JWT access token signature is invalid, forged, or missing |
| `ROLE_MODIFICATION_PROHIBITED` | 403 | Attempt to change account role (privilege escalation prevention) |
| `ACCOUNT_INACTIVE` | 403 | Account has been deactivated |
| `SERVICE_UNAVAILABLE` | 503 | Supabase service is temporarily unavailable |
| `PROFILE_CREATION_FAILED` | 500 | Database error during user profile creation |

---

## 2. Student Authentication Endpoints

### 2.1 Student Registration
- **Method**: `POST`
- **Path**: `/api/auth/student/register`
- **Status**: `201 Created`

#### Request Body
```json
{
  "full_name": "Candidate Name",
  "email": "candidate@example.com",
  "password": "StrongPassword123"
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "access_token": "SUPABASE_ACCESS_TOKEN",
  "token_type": "bearer",
  "user": {
    "id": "7b8c9d01-e234-4567-890a-bcdef0123456",
    "name": "Candidate Name",
    "email": "candidate@example.com",
    "role": "student"
  }
}
```

---

### 2.2 Student Login
- **Method**: `POST`
- **Path**: `/api/auth/student/login`
- **Status**: `200 OK`

#### Request Body
```json
{
  "email": "candidate@example.com",
  "password": "StrongPassword123"
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "access_token": "SUPABASE_ACCESS_TOKEN",
  "token_type": "bearer",
  "user": {
    "id": "7b8c9d01-e234-4567-890a-bcdef0123456",
    "name": "Candidate Name",
    "email": "candidate@example.com",
    "role": "student"
  }
}
```

---

## 3. Company Authentication Endpoints

### 3.1 Company Registration
- **Method**: `POST`
- **Path**: `/api/auth/company/register`
- **Status**: `201 Created`

#### Request Body
```json
{
  "company_name": "Example Technologies",
  "official_email": "hr@example.com",
  "password": "StrongPassword123"
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "access_token": "SUPABASE_ACCESS_TOKEN",
  "token_type": "bearer",
  "user": {
    "id": "1c2d3e4f-5678-90ab-cdef-1234567890ab",
    "name": "Example Technologies",
    "email": "hr@example.com",
    "role": "company"
  }
}
```

---

### 3.2 Company Login
- **Method**: `POST`
- **Path**: `/api/auth/company/login`
- **Status**: `200 OK`

#### Request Body
```json
{
  "email": "hr@example.com",
  "password": "StrongPassword123"
}
```
*(Note: `"official_email"` is also supported)*

#### Response (200 OK)
```json
{
  "success": true,
  "access_token": "SUPABASE_ACCESS_TOKEN",
  "token_type": "bearer",
  "user": {
    "id": "1c2d3e4f-5678-90ab-cdef-1234567890ab",
    "name": "Example Technologies",
    "email": "hr@example.com",
    "role": "company"
  }
}
```

---

## 4. Current User Session Endpoint

### 4.1 Get Profile (`/me`)
- **Method**: `GET`
- **Path**: `/api/auth/me`
- **Headers**: `Authorization: Bearer <access_token>`
- **Status**: `200 OK`

#### Response (200 OK)
```json
{
  "success": true,
  "user": {
    "id": "7b8c9d01-e234-4567-890a-bcdef0123456",
    "name": "Candidate Name",
    "email": "candidate@example.com",
    "role": "student"
  }
}
```

---

## 5. Security & Edge Case Handling Summary
1. **Password Security**: Fully delegated to Supabase Auth. Plaintext passwords are never saved.
2. **Access Token Cryptographic Verification**: Signature verified using `SUPABASE_JWT_SECRET` (HS256) on every protected request.
3. **Role-Based Protection**: Students are strictly blocked from logging into the company portal, and companies cannot log into the student portal (`ROLE_MISMATCH`, 403).
4. **Privilege Escalation Prevention**: User profiles cannot alter their assigned role (`ROLE_MODIFICATION_PROHIBITED`, 403) and DB Row Level Security policies enforce this at database level.
5. **Safe Login Errors**: Timing-attack safe; failure messages do not disclose email registration status.
