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
Available error codes: `INVALID_CREDENTIALS`, `ROLE_MISMATCH`, `EMAIL_ALREADY_EXISTS`, `WEAK_PASSWORD`, `INVALID_EMAIL`, `MISSING_FIELDS`, `INVALID_TOKEN`, `EXPIRED_TOKEN`, `ACCOUNT_INACTIVE`, `ROLE_MODIFICATION_PROHIBITED`, `SERVICE_UNAVAILABLE`, `PORTFOLIO_NOT_FOUND`, `EMPTY_PORTFOLIO`, `ASSESSMENT_NOT_FOUND`, `UNAUTHORIZED_ACCESS`.

---

## 5. Assessment Database Schema (`assessments`, `assessment_questions`)

### 5.1 Table: `public.assessments`
```sql
CREATE TABLE IF NOT EXISTS public.assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    portfolio_id UUID REFERENCES public.portfolios(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    target_role TEXT NOT NULL DEFAULT 'Software Engineer',
    difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard', 'adaptive')),
    status TEXT NOT NULL CHECK (status IN ('generating', 'ready', 'in_progress', 'completed', 'expired')) DEFAULT 'ready',
    total_time_limit_minutes INT NOT NULL DEFAULT 60,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    completed_at TIMESTAMPTZ
);
```

### 5.2 Table: `public.assessment_questions`
```sql
CREATE TABLE IF NOT EXISTS public.assessment_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
    order_index INT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
    category TEXT NOT NULL,
    target_skill TEXT NOT NULL,
    starter_code JSONB NOT NULL DEFAULT '{}'::jsonb,
    sample_test_cases JSONB NOT NULL DEFAULT '[]'::jsonb,
    hidden_test_cases JSONB NOT NULL DEFAULT '[]'::jsonb,
    reference_solution TEXT,
    time_limit_seconds FLOAT NOT NULL DEFAULT 2.0,
    memory_limit_mb INT NOT NULL DEFAULT 256,
    validation_status TEXT NOT NULL CHECK (validation_status IN ('pending', 'validated', 'rejected')) DEFAULT 'validated',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
```

---

## 6. AI Assessment Endpoints Reference

### 6.1 Generate Personalized Assessment
- **URL**: `/api/assessment/generate`
- **Method**: `POST`
- **Auth**: `Bearer <student_token>`
- **Request**:
  ```json
  {
    "portfolio_id": "optional-uuid",
    "target_role": "Backend Systems Engineer",
    "difficulty_preference": "medium",
    "question_count": 3
  }
  ```
- **Response**: `201 Created`
  ```json
  {
    "success": true,
    "assessment": {
      "id": "c71a3962-d4b9-47e1-857e-39958742b821",
      "title": "Backend Systems Engineer Personalized Technical Assessment",
      "duration_minutes": 60,
      "total_time_limit_minutes": 60,
      "status": "ready",
      "questions": [
        {
          "question_id": "q1",
          "title": "Adaptive Sliding Window & Hash Indexer",
          "description": "Problem description with input/output format...",
          "difficulty": "medium",
          "topic": "Data Structures & Algorithms",
          "constraints": ["Time limit: 2000ms", "Memory: 256MB"],
          "examples": [
            {
              "test_case_id": "tc_pub_1",
              "input": "[10, 20, 25, 30], 15",
              "expected_output": "3",
              "explanation": "Window contains 3 timestamps."
            }
          ],
          "allowed_languages": ["python", "javascript", "java", "cpp"],
          "starter_code": {
            "python": "def max_throughput(timestamps: list[int], k: int) -> int:\n    pass\n"
          }
        }
      ]
    }
  }
  ```
  *(Security Guarantee: `hidden_test_cases` and `reference_solution` are strictly stripped from all candidate responses).*

### 6.2 Get Assessment by ID
- **URL**: `/api/assessment/{assessment_id}`
- **Method**: `GET`
- **Auth**: `Bearer <token>` (Enforces candidate ownership; students cannot access other students' assessments, recruiters can view).

### 6.3 Get Active Session
- **URL**: `/api/assessment/active`
- **Method**: `GET`
- **Auth**: `Bearer <student_token>`
- **Response**: `200 OK` with active session and 3600-second countdown timer.

### 6.4 Start Assessment Session
- **URL**: `/api/assessment/{assessment_id}/start` (or `POST /api/assessment/start`)
- **Method**: `POST`
- **Auth**: `Bearer <student_token>`
- **Response**: `200 OK` with status transitioned to `in_progress`.

