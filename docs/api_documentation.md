# 📚 Authentication API & Database Architecture

> **Project**: Portfolio-Driven Adaptive Coding & Technical Assessment Platform (`HFT26-TEAM-75`)  
> **Author**: Srinath (Backend Developer)  
> **Swagger Interactive Docs**: `http://localhost:8000/docs`  

---

## 1. Database Schema (`profiles`)

The authentication layer uses Supabase Auth for primary authentication and a synchronized `public.profiles` table for application identity and role authorization.

### Schema Definition
```sql
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('student', 'company')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);
```

### Fields Description
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, foreign key referencing `auth.users(id)` |
| `full_name` | `TEXT` | User's display name (Candidate's name for students, Company name for recruiters) |
| `email` | `TEXT` | Unique official email address |
| `role` | `TEXT` | User role, constrained to `'student'` or `'company'` |
| `created_at` | `TIMESTAMPTZ` | Timestamp when user was created |
| `updated_at` | `TIMESTAMPTZ` | Timestamp when user was last updated (managed via trigger) |
| `is_active` | `BOOLEAN` | Account status flag (allows deactivation) |

---

## 2. Row Level Security (RLS) Policies

Row Level Security is enabled on `public.profiles` to strictly isolate user data at the database engine level.

1. **Self Read Access**:
   Users can only query their own profile record.
   ```sql
   CREATE POLICY "Users can view own profile"
       ON public.profiles FOR SELECT
       USING (auth.uid() = id);
   ```

2. **Self Insert Access**:
   Users and service role can only insert records linked to their own authentication UUID.
   ```sql
   CREATE POLICY "Users can insert own profile"
       ON public.profiles FOR INSERT
       WITH CHECK (auth.uid() = id);
   ```

3. **Self Update (Role Immuntability)**:
   Users can update their profile information, but cannot change their assigned role (prevents student-to-company privilege escalation).
   ```sql
   CREATE POLICY "Users can update own profile except role"
       ON public.profiles FOR UPDATE
       USING (auth.uid() = id)
       WITH CHECK (
           auth.uid() = id AND
           role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
       );
   ```

4. **Deletion Protection**:
   Direct profile deletion is forbidden for ordinary users.
   ```sql
   CREATE POLICY "Prevent user profile deletion"
       ON public.profiles FOR DELETE
       USING (false);
   ```

---

## 3. Endpoints Reference

### 3.1 Student Registration
- **URL**: `/api/auth/student/register`
- **Method**: `POST`
- **Request**:
  ```json
  {
    "full_name": "Candidate Name",
    "email": "candidate@example.com",
    "password": "StrongPassword123"
  }
  ```
- **Response**: `201 Created`
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

### 3.2 Student Login
- **URL**: `/api/auth/student/login`
- **Method**: `POST`
- **Request**:
  ```json
  {
    "email": "candidate@example.com",
    "password": "StrongPassword123"
  }
  ```
- **Response**: `200 OK` (Same format as registration)

---

### 3.3 Company Registration
- **URL**: `/api/auth/company/register`
- **Method**: `POST`
- **Request**:
  ```json
  {
    "company_name": "Example Technologies",
    "official_email": "hr@example.com",
    "password": "StrongPassword123"
  }
  ```
- **Response**: `201 Created` (`role = "company"`, `name = "Example Technologies"`)

---

### 3.4 Company Login
- **URL**: `/api/auth/company/login`
- **Method**: `POST`
- **Request**:
  ```json
  {
    "email": "hr@example.com",
    "password": "StrongPassword123"
  }
  ```
- **Response**: `200 OK` (`role = "company"`)

---

### 3.5 Current User Profile
- **URL**: `/api/auth/me`
- **Method**: `GET`
- **Header**: `Authorization: Bearer <access_token>`
- **Response**: `200 OK`
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

## 4. Error Handling Contract

All errors return unified JSON matching:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Email or password is incorrect"
  }
}
```
Available error codes: `INVALID_CREDENTIALS`, `ROLE_MISMATCH`, `EMAIL_ALREADY_EXISTS`, `WEAK_PASSWORD`, `INVALID_EMAIL`, `MISSING_FIELDS`, `INVALID_TOKEN`, `EXPIRED_TOKEN`, `ACCOUNT_INACTIVE`, `ROLE_MODIFICATION_PROHIBITED`, `SERVICE_UNAVAILABLE`.
