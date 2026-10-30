# 🛠️ Supabase Backend Setup & Local Execution Guide

> **Project**: Portfolio-Driven Adaptive Coding & Technical Assessment Platform (`HFT26-TEAM-75`)  
> **Author**: Srinath (Backend Developer)  
> **Target**: Local Development & Production  

---

## 1. Prerequisites

- Python 3.10+ (Tested on Python 3.14)
- Pip / virtualenv
- Supabase Account / Project (Free tier at [supabase.com](https://supabase.com))

---

## 2. Supabase Project Setup

1. **Create Project**:
   - Go to [Supabase Dashboard](https://supabase.com/dashboard) and click **New Project**.
   - Set the project name (e.g. `hft-adaptive-platform`).
   - Set a strong database password and choose your preferred region.

2. **Retrieve API Credentials**:
   - Navigate to **Project Settings > API**:
     - **Project URL**: `https://<your-project-ref>.supabase.co` (`SUPABASE_URL`)
     - **anon / public key** or **service_role key**: (`SUPABASE_KEY`)
   - Navigate to **Project Settings > API > JWT Settings**:
     - **JWT Secret**: (`SUPABASE_JWT_SECRET`)

3. **Run Database Migrations (Schema & RLS)**:
   - Navigate to the **SQL Editor** in the Supabase Dashboard.
   - Open and copy the contents of `database/schema.sql`.
   - Run the script to create the `profiles` table, indexes, triggers, and Row Level Security (RLS) policies.

---

## 3. Environment Variables Configuration

Copy `backend/.env.example` to `backend/.env` or project root `.env`:

```bash
cp backend/.env.example backend/.env
```

Populate the values:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_KEY=your-supabase-service-role-or-anon-key
SUPABASE_JWT_SECRET=your-supabase-jwt-secret

# Application Settings
PROJECT_NAME="Portfolio-Driven Adaptive Coding & Technical Assessment Platform"
API_PREFIX=/api
DEBUG=true

# CORS (Comma-separated origins)
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173,http://localhost:8000
```

> **Security Note**: Never commit `.env` to git repository. `.env` is ignored in `.gitignore`.

---

## 4. Local Installation & Execution

### 4.1 Install Dependencies
From the repository root or `backend/` directory:

```bash
pip install -r backend/requirements.txt
```

### 4.2 Start FastAPI Server
Start Uvicorn with auto-reload:

```bash
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

The server will be accessible at:
- **API Base**: `http://localhost:8000`
- **Swagger Documentation**: `http://localhost:8000/docs`
- **ReDoc Documentation**: `http://localhost:8000/redoc`

---

## 5. Running Automated Tests

Run the full pytest suite:

```bash
python -m pytest backend/tests/test_auth.py -v
```

All 22 test scenarios run against a mock Supabase environment without modifying or risking production user data.
