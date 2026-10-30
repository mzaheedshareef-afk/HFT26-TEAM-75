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

## 4. Installation & Local Execution

### 4.1 Backend Setup & Execution
From the project root:

```bash
# 1. Install Python dependencies
pip install -r backend/requirements.txt

# 2. Start FastAPI Server
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

Backend URLs:
- **API Base**: `http://localhost:8000`
- **Swagger Documentation**: `http://localhost:8000/docs`
- **ReDoc Documentation**: `http://localhost:8000/redoc`
- **Health Check**: `http://localhost:8000/health`

### 4.2 Frontend Setup & Execution
From the project root in a second terminal:

```bash
cd frontend

# 1. Install Node dependencies
npm install

# 2. Start Vite Development Server
npm run dev
```

Frontend URL:
- **Application UI**: `http://localhost:5173`

---

## 5. Automated Testing Instructions

### 5.1 Backend Unit & Contract Tests (Pytest)
Run all 22 backend authentication unit scenarios (using in-memory Supabase mocks):
```bash
python -m pytest backend/tests/test_auth.py -v
```

### 5.2 Full-Stack E2E Integration Tests (Pytest)
Run the 8 full-stack integration tests covering student, company, and security workflows:
```bash
python -m pytest tests/integration/test_full_stack_integration.py -v
```

### 5.3 Frontend Component & UI Tests (Vitest)
Run all 14 React frontend component and flow tests:
```bash
cd frontend
npm test
```

### 5.4 Run Entire Integration Test Suite Together
From the repository root:
```bash
python -m pytest backend/tests/test_auth.py tests/integration/test_full_stack_integration.py tests/sandbox_planning/test_sandbox_contract.py -v
```
**Result:** **35 Passed / 0 Failed**.

---

## 6. Verification Checklist

| Scenario | Expected Result | Verified |
| :--- | :--- | :---: |
| **Student Registration** | `POST /api/auth/student/register` returns 201 Created with JWT and `role: "student"` | ✅ |
| **Student Login** | `POST /api/auth/student/login` returns 200 OK and Bearer token; redirects to `/student/dashboard` | ✅ |
| **Company Registration** | `POST /api/auth/company/register` returns 201 Created with JWT and `role: "company"` | ✅ |
| **Company Login** | `POST /api/auth/company/login` returns 200 OK and Bearer token; redirects to `/company/dashboard` | ✅ |
| **Session Profile** | `GET /api/auth/me` with Bearer token returns verified user details | ✅ |
| **Role Protection** | Student attempting company login or dashboard access is blocked (`403 ROLE_MISMATCH`) | ✅ |
| **Duplicate Registration** | Registering existing email returns `409 Conflict (EMAIL_ALREADY_EXISTS)` | ✅ |
| **Weak Password** | Passwords without uppercase, lowercase, and number return `400 WEAK_PASSWORD` | ✅ |
| **Invalid Email** | Malformed emails return `422 Unprocessable Entity (INVALID_EMAIL)` | ✅ |
| **Empty Fields** | Submitting missing fields returns `422 Unprocessable Entity (MISSING_FIELDS)` | ✅ |
| **Token Expiration / Invalid Token** | Expired or forged token returns `401 Unauthorized`; frontend automatically clears session | ✅ |
| **Sign Out** | Clicking "Sign Out" removes tokens from `localStorage` and redirects to login | ✅ |
| **Backend Unavailable** | Network failure or 503 renders an alert banner without app crashes | ✅ |
