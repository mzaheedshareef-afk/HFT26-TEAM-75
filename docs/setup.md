# 🛠️ Complete Full-Stack Setup & Local Execution Guide

> **Project**: Portfolio-Driven Adaptive Coding & Technical Assessment Platform (`HFT26-TEAM-75`)  
> **Authors**: Vasil (Testing & Integration Lead), Srinath (Backend), Zaheed (Frontend)  
> **Target**: Local Development, Secure Docker Execution, Grading & Integration  

---

## 1. Prerequisites

- **Python**: 3.10+ (Tested on Python 3.12.7)
- **Node.js**: v18+ (Tested on Node.js v24.15 / npm 11)
- **Docker**: Docker Desktop (Windows/macOS) or Docker Engine (Linux/WSL2) with Docker Compose v2+
- **Supabase Account**: Free project tier at [supabase.com](https://supabase.com)

---

## 2. Docker & Execution Sandbox Setup

Untrusted student code is **strictly executed inside isolated ephemeral Docker containers**. Untrusted code **never** runs directly on the FastAPI host under any circumstances.

### 2.1 Docker Installation
- **Windows**: Install [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/) with the WSL2 backend enabled. Verify that the Docker daemon is running (`docker info`).
- **macOS**: Install [Docker Desktop for Mac](https://docs.docker.com/desktop/setup/install/mac-install/) (Apple Silicon or Intel).
- **Linux**: Install Docker Engine and the Docker Compose plugin:
  ```bash
  sudo apt-get update && sudo apt-get install -y docker.io docker-compose-v2
  sudo usermod -aG docker $USER
  ```

### 2.2 Supported Languages & Runtimes

| Language | Runtimes / Compilers | Container Base Image | Runner Script |
| :--- | :--- | :--- | :--- |
| **Python** | Python 3.12 (`python3`) | `sandbox-python` (`python:3.12-slim`) | `sandbox/runners/python_runner.py` |
| **C++** | GCC 13 / G++ (`-O2 -std=c++17`) | `sandbox-cpp` (`gcc:13-bookworm`) | `sandbox/runners/cpp_runner.sh` |
| **Java** | OpenJDK 21 (`javac` & `java`) | `sandbox-java` (`eclipse-temurin:21-jdk-jammy`) | `sandbox/runners/java_runner.sh` |
| **Unified** | All 3 runtimes in one container | `gatecode-sandbox:unified` | Multi-runtime sandbox |

### 2.3 Build Sandbox Images

From the project root:
```bash
# Build the unified execution sandbox image (recommended for local development)
docker compose build sandbox-unified

# Or build individual language sandboxes
docker compose build sandbox-python sandbox-cpp sandbox-java
```

### 2.4 Docker Security Architecture

Every sandbox container is instantiated with strict defense-in-depth isolation flags:

| Security Flag | Protection Enforcement |
| :--- | :--- |
| `--user 1001:1001` | Non-root sandbox user (`sandboxuser:sandboxgroup`) |
| `--network none` | Completely disables container networking (no internet/outbound egress) |
| `--memory 256m --memory-swap 256m` | Hard 256 MB memory cap; swap disabled to prevent host paging exhaustion |
| `--cpus 0.5` | Limits CPU execution to 0.5 cores to prevent CPU starvation |
| `--pids-limit 64` | Restricts max processes to 64 to thwart fork-bombs |
| `--read-only` | Root filesystem mounted strictly read-only |
| `--tmpfs /tmp:rw,size=32m,noexec,nosuid` | In-memory temporary scratch space limited to 32 MB with noexec/nosuid |
| `--cap-drop ALL` | Drops all Linux kernel capabilities |
| `--security-opt no-new-privileges:true` | Blocks privilege escalation via setuid/setgid binaries |
| `--rm` + `finally: docker rm -f` | Guarantees container destruction on both success and timeout/failure |
| **No Host Mounts** | Source code and test inputs are passed solely via in-memory Docker CP/stdin; no host volumes |
| **Zero Secrets** | Host environment secrets (Supabase keys, JWT secrets, AI keys) are never injected into containers |
| **Zero Docker Socket** | `/var/run/docker.sock` is never mounted or accessible to student code |

---

## 3. Supabase Cloud Configuration

### 3.1 Create Supabase Project
1. Go to the [Supabase Dashboard](https://supabase.com/dashboard) and click **New Project**.
2. Name your project (e.g. `hft-adaptive-platform`).
3. Set a strong database password and select your preferred hosting region.

### 3.2 Disable Email Confirmation for Local Testing
> [!IMPORTANT]
> Supabase free tier rate-limits signup confirmation emails to ~3-4 emails per hour. To avoid signup failures (`429 Too Many Requests: email rate limit exceeded`) during evaluation:
1. Navigate to **Authentication > Providers > Email**.
2. Turn **OFF** the toggle for **"Confirm email"**.
3. Click **Save**.

### 3.3 Run Database Migrations
In the Supabase **SQL Editor**, execute in sequential order:
1. `database/schema.sql`: Core `profiles` table, indexes, updated_at triggers, and RLS policies.
2. `database/migrations/002_portfolio_and_assessment.sql`: `portfolios`, `assessments`, and `assessment_questions` tables.
3. `database/migrations/003_submissions_and_grading.sql`: `submissions` and `assessment_results` tables with strict RLS policies ensuring students can only access their own submissions and results.

### 3.4 Retrieve API Credentials
Navigate to **Project Settings > API**:
- **Project URL**: `https://<your-project-ref>.supabase.co` (`SUPABASE_URL`)
- **anon / public key** or **service_role key**: (`SUPABASE_KEY`)
- **JWT Secret** under **Project Settings > API > JWT Settings**: (`SUPABASE_JWT_SECRET`)

> [!CAUTION]
> Never expose your Supabase `service_role` key in frontend code. Frontend only communicates with the backend API (`http://localhost:8000`).

---

## 4. Environment Variables Setup

### 4.1 Backend Configuration (`backend/.env`)
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

# Featherless AI Configuration (Personalized Assessment Hints & Calibrations)
FEATHERLESS_API_KEY=your-featherless-api-key
FEATHERLESS_BASE_URL=https://api.featherless.ai/v1
FEATHERLESS_MODEL=meta-llama/Meta-Llama-3.1-70B-Instruct

# Docker Execution Sandbox Configuration
DOCKER_SANDBOX_IMAGE=gatecode-sandbox:unified
DOCKER_TIMEOUT_SECONDS=2.0
DOCKER_MEMORY_LIMIT_MB=256
```

### 4.2 Frontend Configuration (`frontend/.env`)
Copy `frontend/.env.example` to `frontend/.env`:

```bash
cp frontend/.env.example frontend/.env
```

Populate `frontend/.env`:
```env
VITE_API_BASE_URL=http://localhost:8000
```

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

## 6. Code Execution & Grading Endpoints

All execution and grading endpoints require a valid student JWT `Bearer` token in the `Authorization` header.

### 6.1 `POST /api/code/run`
Executes candidate code strictly against **public sample test cases** (or custom input). Never accesses or runs hidden test cases.

**Request Body:**
```json
{
  "assessment_id": "assess-75",
  "question_id": "q-101",
  "language": "python",
  "source_code": "def solve(nums, target):\n    return []\n"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "language": "python",
  "question_id": "q-101",
  "overall_verdict": "AC",
  "total_test_cases": 2,
  "passed_test_cases": 2,
  "failed_test_cases": 0,
  "total_time_ms": 32.5,
  "memory_used_mb": 18.4,
  "results": [
    {
      "test_case_id": "tc-public-1",
      "verdict": "AC",
      "passed": true,
      "input": "2 7 11 15\n9",
      "expected_output": "[0, 1]",
      "actual_output": "[0, 1]",
      "execution_time_ms": 16.2,
      "memory_used_mb": 18.4
    }
  ]
}
```

### 6.2 `POST /api/code/submit`
Submits final solution for deterministic grading against **both public and hidden test cases**. Hidden test case inputs, expected outputs, and raw stdout are **strictly redacted** on the server before the response is returned.

**Request Body:**
```json
{
  "assessment_id": "assess-75",
  "question_id": "q-101",
  "language": "cpp",
  "source_code": "#include <iostream>\nint main() { return 0; }",
  "elapsed_seconds": 180,
  "hints_used": 0
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "submission_id": "sub_4f8a2b...",
  "assessment_id": "assess-75",
  "question_id": "q-101",
  "status": "graded",
  "verdict": "AC",
  "score": 100.0,
  "deterministic_score": 100.0,
  "is_accepted": true,
  "passed_tests": 5,
  "failed_tests": 0,
  "total_tests": 5,
  "execution_time_ms": 48.0,
  "memory_used_mb": 22.1,
  "public_test_cases": [...],
  "hidden_test_cases": [
    {
      "test_case_id": "tc-hidden-1",
      "verdict": "AC",
      "passed": true,
      "is_hidden": true
    }
  ],
  "created_at": "2026-10-31T03:00:00Z"
}
```

### 6.3 `GET /api/submissions/{submission_id}`
Retrieves submission record by ID. Access is strictly constrained by RLS to the student who submitted the code.

### 6.4 `GET /api/assessment/{assessment_id}/results`
Retrieves aggregated scores, final completion status, and question-by-question performance breakdowns for the assessment.

---

## 7. Automated Testing Suite

### 7.1 Backend Unit & Integration Tests (Pytest)
From the repository root:
```bash
# Run all backend authentication and grading test suites
python -m pytest backend/tests/test_auth.py backend/tests/test_grading.py -v

# Run full-stack and contract integration test suites
python -m pytest tests/ -v
```
**Total:** **111 Passed / 0 Failed** (49 backend tests + 62 integration tests).

### 7.2 Frontend React & Monaco Editor Tests (Vitest)
From `frontend/`:
```bash
cd frontend
npm test -- --run
```
**Total:** **28 Passed / 0 Failed** across:
- `portfolio.test.tsx` (5 passed)
- `assessment.test.tsx` (9 passed: Monaco editor, language selector, public run, submit, CE, TLE, draft persistence)
- `auth.test.tsx` (14 passed)

---

## 8. Verification & Security Checklist

| Scenario | Expected Result | Verified |
| :--- | :--- | :---: |
| **Untrusted Code Isolation** | Code executes exclusively inside ephemeral Docker sandboxes; never on FastAPI host | ✅ |
| **Non-Root Execution** | Container runs as UID `1001:1001` (`sandboxuser`) | ✅ |
| **Network Egress Blocked** | `--network none` rejects all outbound network connections | ✅ |
| **Resource Limits Enforced** | Hard caps of 256 MB RAM, 0.5 CPU, 64 PIDs, and 2.0s execution timeout | ✅ |
| **Read-Only Filesystem** | Container rootfs is read-only; `/tmp` tmpfs is 32MB noexec/nosuid | ✅ |
| **Infinite Loop / TLE** | Infinite loops terminated at timeout returning `TLE` status safely | ✅ |
| **Compilation Error (CE)** | Syntax/compile errors in C++/Java return `CE` with sanitized compiler diagnostics | ✅ |
| **Runtime Error (RTE)** | Exceptions/panics return `RTE` with sanitized runtime diagnostics | ✅ |
| **Hidden Test Confidentiality** | Hidden inputs, expected outputs, and solution traces are never exposed in frontend payloads | ✅ |
| **Deterministic Grading** | Correctness calculated purely via deterministic token/float comparison (no LLM) | ✅ |
| **Ownership Isolation** | Students cannot view or run submissions belonging to other students (`403 Forbidden`) | ✅ |
| **Language Support** | Python 3.12, C++ 17, and Java 21 fully supported and normalized | ✅ |
| **Editor Draft Persistence** | Monaco editor preserves student drafts when switching between assessment questions | ✅ |
| **Duplicate Submit Prevention** | Submit button debounces and disables during in-flight evaluation | ✅ |
| **Container Cleanup** | Ephemeral containers destroyed immediately on completion or failure (`--rm`, `docker rm -f`) | ✅ |
