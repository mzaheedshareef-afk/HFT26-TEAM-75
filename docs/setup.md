# 🛠️ Complete Full-Stack Setup & Local Execution Guide

> **Project**: Portfolio-Driven Adaptive Coding & Technical Assessment Platform (`HFT26-TEAM-75`)  
> **Authors**: Vasil (Testing & Integration Lead), Srinath (Backend), Zaheed (Frontend)  
> **Target**: Local Development, Integration Testing & Evaluation  

---

## 1. Prerequisites

- **Python**: 3.10+ (Tested on Python 3.12 and 3.14)
- **Node.js**: v18+ (Tested on Node.js v24.15 / npm 11)
- **Supabase Account**: Free project tier at [supabase.com](https://supabase.com)

---

## 2. Supabase Cloud Configuration

### 2.1 Create Supabase Project
1. Go to the [Supabase Dashboard](https://supabase.com/dashboard) and click **New Project**.
2. Name your project (e.g. `hft-adaptive-platform`).
3. Set a strong database password and select your preferred hosting region.

### 2.2 Disable Email Confirmation for Local Testing
> [!IMPORTANT]
> Supabase free tier rate-limits signup confirmation emails to ~3-4 emails per hour. To avoid signup failures (`429 Too Many Requests: email rate limit exceeded`) during hackathon evaluation:
1. Navigate to **Authentication > Providers > Email**.
2. Turn **OFF** the toggle for **"Confirm email"**.
3. Click **Save**.

### 2.3 Run Database Schema & Migrations
1. Navigate to the **SQL Editor** in the Supabase Dashboard.
2. Open and copy the SQL code from [`database/schema.sql`](file:///e:/hackathon/HFT26-TEAM-75/database/schema.sql).
3. Execute the script to create:
   - `profiles` table (storing user ID, full name, email, role: `student` | `company`, active status).
   - Database indexes on `email` and `role`.
   - Automatic `updated_at` trigger.
   - Row Level Security (RLS) policies preventing privilege escalation or unauthorized profile alterations.

### 2.4 Retrieve API Credentials
Navigate to **Project Settings > API**:
- **Project URL**: `https://<your-project-ref>.supabase.co` (`SUPABASE_URL`)
- **anon / public key** or **service_role key**: (`SUPABASE_KEY`)
- **JWT Secret** under **Project Settings > API > JWT Settings**: (`SUPABASE_JWT_SECRET`)

> [!CAUTION]
> Never expose your Supabase `service_role` key in frontend code. Frontend only requires the backend API base URL (`http://localhost:8000`).

---

## 3. Environment Variables Setup

### 3.1 Backend Configuration (`backend/.env`)
Copy `backend/.env.example` to `backend/.env` (or root `.env`):

```bash
cp backend/.env.example backend/.env
```

Populate `backend/.env`:
```env
# Supabase Configuration
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_KEY=your-supabase-anon-or-service-role-key
SUPABASE_JWT_SECRET=your-supabase-jwt-secret

# Application Settings
PROJECT_NAME="Portfolio-Driven Adaptive Coding & Technical Assessment Platform"
API_PREFIX=/api
DEBUG=true

# Allowed CORS Origins (comma-separated)
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173,http://localhost:8000

# Featherless AI Configuration (Personalized Assessment)
FEATHERLESS_API_KEY=your-featherless-api-key
FEATHERLESS_BASE_URL=https://api.featherless.ai/v1
FEATHERLESS_MODEL=meta-llama/Meta-Llama-3.1-70B-Instruct

# Docker Execution Sandbox Configuration
DOCKER_SANDBOX_IMAGE=python:3.12-slim
DOCKER_TIMEOUT_SECONDS=2.0
DOCKER_MEMORY_LIMIT_MB=256
```

### 3.2 Frontend Configuration (`frontend/.env`)
Copy `frontend/.env.example` to `frontend/.env`:

```bash
cp frontend/.env.example frontend/.env
```

Populate `frontend/.env`:
```env
VITE_API_BASE_URL=http://localhost:8000
```

---

## 4. Supabase Storage & Migration Setup

### 4.1 Database Migration
1. In the Supabase Dashboard, open the **SQL Editor**.
2. Run `database/schema.sql` (if not already applied).
3. Run `database/migrations/002_portfolio_and_assessment.sql` to create:
   - `portfolios` table with RLS policies.
   - `assessments` and `assessment_questions` tables.

### 4.2 Supabase Storage Configuration
The backend automatically initializes the `portfolios` storage bucket on first upload. If configuring manually:
1. Navigate to **Storage** in the Supabase Dashboard.
2. Click **New bucket**.
3. Name the bucket `portfolios` (Private bucket).
4. Save.

---

## 5. Installation & Local Execution

### 5.1 Backend Setup & Execution
From the project root:

```bash
# 1. Install Python dependencies
pip install -r backend/requirements.txt

# 2. Start FastAPI Server
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

Backend URLs:
- **API Base**: `http://localhost:8000`
- **Swagger Documentation**: `http://localhost:8000/docs`
- **ReDoc Documentation**: `http://localhost:8000/redoc`
- **Health Check**: `http://localhost:8000/health`

### 5.2 Frontend Setup & Execution
From the project root in a second terminal:

```bash
cd frontend

# 1. Install Node dependencies
npm install

# 2. Start Vite Development Server
npm run dev -- --host 127.0.0.1 --port 5173
```

Frontend URL:
- **Application UI**: `http://localhost:5173`

---

## 6. Portfolio Upload Instructions

### Via the React Web UI:
1. Log in to the Student Portal at `http://localhost:5173/student/login`.
2. Navigate to the **Portfolio & Stack** tab (`/student/portfolio`).
3. Enter your primary **GitHub profile or flagship project repository URL** (e.g., `https://github.com/your-username`).
4. Select one or more **primary programming languages** (e.g., Python, TypeScript).
5. Optionally select frameworks, add architecture notes, or attach your resume / project archive.
6. Click **Save & Analyze Portfolio**.
7. The status will immediately update to **Calibrated & Ready**, displaying your linked repository, declared languages, and recommended assessment tracks.

### Via Direct API Call (curl / HTTP):
```bash
curl -X POST http://localhost:8000/api/portfolio/upload \
  -H "Authorization: Bearer <STUDENT_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "github_url": "https://github.com/candidate/repo",
    "primary_languages": ["Python", "TypeScript"],
    "frameworks": ["FastAPI", "React"],
    "notes": "Backend and distributed systems engineer"
  }'
```

---

## 7. Automated Testing Instructions

### 7.1 Run All Backend & Integration Tests (Pytest)
From the repository root:
```bash
python -m pytest -o pythonpath=. tests/ backend/tests/ -v
```
**Total:** **90 Passed / 0 Failed** across:
- `tests/assessment/test_assessment_integration.py` (20 passed)
- `tests/portfolio/test_portfolio_integration.py` (13 passed)
- `backend/tests/test_auth.py` (22 passed)
- `tests/auth/test_auth_api.py` (15 passed)
- `tests/integration/test_full_stack_integration.py` (8 passed)
- `tests/integration/test_frontend_contracts.py` (5 passed)
- `tests/sandbox_planning/test_sandbox_contract.py` (5 passed)
- `backend/tests/test_auth.py` (2 passed)

### 7.2 Run All Frontend Tests (Vitest)
From `frontend/`:
```bash
cd frontend
npm test
```
**Total:** **25 Passed / 0 Failed** across:
- `src/__tests__/assessment.test.tsx` (6 passed)
- `src/__tests__/portfolio.test.tsx` (5 passed)
- `src/__tests__/auth.test.tsx` (14 passed)

---

## 8. AI Personalized Assessment Workflow Instructions

### 8.1 Complete Candidate Workflow
1. **Login**: Access `http://localhost:5173/student/login` and log in with student credentials.
2. **Dashboard**: Navigate to the student dashboard (`http://localhost:5173/student/dashboard`).
3. **Assessment Overview**: Click **Take Assessment** or browse **Personalized Coding Assessments** generated from your verified portfolio.
4. **Instructions & Rules**: Review duration (60 minutes), allowed languages, problem breakdown, and test case constraints.
5. **Start Assessment**: Confirm and start session. The timer begins based on the backend authoritative start timestamp (`started_at`), which survives browser refreshes.
6. **Workspace**:
   - Navigate between questions using the top question tabs.
   - Read the problem statement, constraints, and public sample test cases.
   - Code in the Monaco editor.
   - Request progressive conceptual hints via the **AI Hint Panel** (`/api/assistant/hint`). Full code implementations are strictly redacted.
   - Click **Run Code** to execute against public test cases (`/api/assessment/run`).
   - Click **Submit Solution** to submit for deterministic grading against all test cases (`/api/submissions`).
7. **Complete Assessment**: Click **Finish Assessment** to finalize the session and view the comprehensive results breakdown at `http://localhost:5173/student/assessment/results`.

---

## 9. Verification Checklist

| Scenario | Expected Result | Verified |
| :--- | :--- | :---: |
| **Student Registration** | `POST /api/auth/student/register` returns 201 Created with JWT and `role: "student"` | ✅ |
| **Student Login** | `POST /api/auth/student/login` returns 200 OK and Bearer token; redirects to `/student/dashboard` | ✅ |
| **Company Registration** | `POST /api/auth/company/register` returns 201 Created with JWT and `role: "company"` | ✅ |
| **Company Login** | `POST /api/auth/company/login` returns 200 OK and Bearer token; redirects to `/company/dashboard` | ✅ |
| **Session Profile** | `GET /api/auth/me` with Bearer token returns verified user details | ✅ |
| **Portfolio Initial State** | `GET /api/portfolio/me` before upload returns 404 `PORTFOLIO_NOT_FOUND` (frontend displays clean empty state) | ✅ |
| **Portfolio Upload (Multipart)** | `POST /api/portfolio/upload` accepts form data + files, analyzes skills, returns 201 Created | ✅ |
| **Portfolio Upload (JSON)** | `POST /api/portfolio/upload` accepts direct JSON body, returns 201 Created | ✅ |
| **Portfolio Retrieval** | `GET /api/portfolio/me` returns uploaded record with declared stack and recommended tracks | ✅ |
| **Assessment Generation (AI)** | `POST /api/assessment/generate` uses Featherless AI with candidate portfolio grounding, returns 201 Created with 60-min personalized questions | ✅ |
| **Candidate Assessments List** | `GET /api/assessment` lists available assessments for candidate | ✅ |
| **Active Session Retrieval** | `GET /api/assessment/active` returns active session with authoritative timer | ✅ |
| **Start Assessment** | `POST /api/assessment/{id}/start` starts assessment session, records backend `started_at` | ✅ |
| **Timer Refresh Survival** | Reloading page during workspace retains accurate remaining seconds calculated from backend `started_at` | ✅ |
| **Guarded AI Hint** | `POST /api/assistant/hint` provides progressive Level 1/2/3 guidance without revealing code solutions | ✅ |
| **Code Execution (Public)** | `POST /api/assessment/run` evaluates public test cases and returns execution verdicts (`AC`, `WA`, `TLE`, `RTE`) | ✅ |
| **Solution Submission** | `POST /api/submissions` evaluates public and hidden tests, returns composite score | ✅ |
| **Complete Assessment** | `POST /api/assessment/{id}/complete` updates status to `completed` and compiles results report | ✅ |
| **Cross-Student Assessment Security** | Accessing another candidate's assessment returns `403 UNAUTHORIZED_ACCESS` | ✅ |
| **Company Assessment Restriction** | Recruiter accounts cannot generate student assessments (`403 ROLE_MISMATCH`) | ✅ |
| **Hidden Test Privacy** | Neither `/api/assessment` nor `/api/assessment/{id}` ever returns hidden test cases or reference solutions | ✅ |
| **Backend Unavailable** | Service disconnect renders alert banner gracefully without application crashes | ✅ |

