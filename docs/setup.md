# 🛠️ Complete Full-Stack Setup & Local Execution Guide

> **Project**: Portfolio-Driven Adaptive Coding & Technical Assessment Platform (`HFT26-TEAM-75`)  
> **Authors**: Vasil (Testing & Integration Lead), Srinath (Backend), Zaheed (Frontend)  
> **Target**: Local Development, Secure Docker Execution, AI Hints, Analytics & Public Profiles  

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
3. `database/migrations/003_submissions_and_grading.sql`: `submissions` and `assessment_results` tables with strict RLS policies.
4. `database/migrations/004_ai_hints_analytics_profiles.sql`: `ai_hint_interactions`, `assessment_ai_metrics`, and `student_public_profiles` tables with ownership and public-view RLS policies.

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

# Featherless AI Configuration (Personalized Assessment, Progressive Hints & Calibrations)
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

## 6. AI Progressive Hints & Interaction Tracking

The Progressive Hint Engine uses Featherless AI with a server-side leak prevention guardrail.

### 6.1 Progressive Hint Tiers

| Tier | Focus | Content Delivered |
| :--- | :--- | :--- |
| **Level 1** | Conceptual Intuition | High-level problem framing and invariant observations without implementation details. |
| **Level 2** | Strategy & Data Structures | Recommended data structures (hash maps, deques, sliding windows) and decomposition. |
| **Level 3** | Edge Cases & Optimization | Boundary conditions (empty inputs, duplicates) and Big-O complexity trade-offs. |

### 6.2 Pedagogical Guardrails
- **Zero Solution Spoilage**: Code blocks $\ge 3$ lines or function/class declarations (`def `, `class `, `int main`, etc.) are automatically redacted by the server guardrail before delivery.
- **Strict Rate Limits**: Candidates are restricted to a maximum of **3 hints per question** (`MAX_HINTS_PER_QUESTION = 3`). Exceeding requests returns `429 EXCESSIVE_HINT_REQUESTS`.
- **Fault-Tolerant Fallback**: If Featherless AI times out or is unreachable, the engine immediately serves curriculum-aligned deterministic hints without failing the request.
- **Isolation**: Students cannot view or request hints for assessments belonging to other candidates (`403 Forbidden`).

### 6.3 Endpoints
- `POST /api/assessment/{assessment_id}/questions/{question_id}/hint`: Request next hint.
- `GET /api/assessment/{assessment_id}/questions/{question_id}/hints`: View hint history for question.
- `GET /api/assessment/{assessment_id}/hints/stats`: View session hint usage statistics.
- `POST /api/assistant/hint`: Direct alias for frontend `assistantService.requestHint`.

---

## 7. AI Efficiency Scoring Engine (v1.0)

Calculated via transparent, deterministic backend logic (zero LLM reliance for score assignment).

### 7.1 Formula

$$\text{Final Score} = 0.80 \times \text{Coding Score} + 0.20 \times \text{AI Efficiency Score}$$

$$\text{AI Efficiency Score} = \text{clamp}\left(100.0 - \sum \text{Hint Deductions} + \text{Utilization Bonus} + \text{Independent Bonus} - \text{CE Penalty},\, 0,\, 100\right)$$

### 7.2 Difficulty Normalization

| Question Difficulty | Multiplier | Rationale |
| :--- | :--- | :--- |
| **Easy** | $1.2\times$ | Hints on fundamental concepts carry slightly higher deductions. |
| **Medium** | $1.0\times$ | Standard baseline progression. |
| **Hard** | $0.7\times$ | Proactive inquiry on complex algorithmic problems is expected and lightly penalized. |

- **Effective Utilization Bonus**: Students who request a hint and then successfully pass the question (`AC`) receive an offset ($+4.0 \times \text{diff}$), rewarding productive AI synthesis over blind trial-and-error.
- **Formula Versioning**: Every assessment result stores `formula_version: "v1.0"` to guarantee historical score consistency across algorithm revisions.

---

## 8. Student Analytics & Performance Trends

### 8.1 Endpoints
- `GET /api/analytics/me`: Aggregated dashboard metrics:
  - Total and completed assessments.
  - Overall average and highest scores.
  - Total correct and failed test cases.
  - Topic-wise breakdown (success rate, average score).
  - Difficulty-wise breakdown (easy, medium, hard).
  - Improvement delta (trend between earlier and later assessments).
  - Performance consistency score ($0-100$ based on score variance).
  - Chronological trend points for chart rendering.
- `GET /api/analytics/me/history`: Assessment session history cards.
- `GET /api/analytics/me/results/{assessment_id}`: Comprehensive results report for a specific assessment.

### 8.2 Security Guarantees
- Strict RLS and backend ownership verification ensure candidates only access their own analytics.
- Empty candidate history returns clean zeroed metrics without application errors.

---

## 9. Public Student Profiles & Privacy Boundaries

Candidates can generate a public shareable portfolio profile to showcase verified technical accomplishments to recruiters.

### 9.1 Endpoints
- `GET /api/profile/me`: View own profile details and active `share_url`.
- `PATCH /api/profile/me`: Update profile fields (`public_name`, `headline`, `bio`, `skills`, `technologies`, `projects`).
- `PATCH /api/profile/me/visibility`: Toggle visibility (`"public"` or `"private"`).
- `POST /api/profile/me/revoke`: Immediately revokes the current share link by generating a brand new secret `share_id`.
- `GET /api/public/profile/{share_id}`: Zero-auth public profile view.

### 9.2 Privacy & Security Model
When a profile is accessed publicly via `GET /api/public/profile/{share_id}`:
1. **Zero Email Exposure**: Candidate email is completely withheld.
2. **Zero Internal ID Exposure**: User UUID, assessment IDs, and database keys are never included.
3. **Zero Code or Test Exposure**: Untrusted source code and private test assertions are strictly excluded.
4. **Instant Link Revocation**: Revoking immediately breaks previous URLs with a `404 PROFILE_NOT_FOUND`.
5. **Private by Default**: New profiles default to `visibility: "private"`.

---

## 10. Automated Testing Suite

### 10.1 Backend Test Suites (Pytest)
From the repository root:
```bash
# Run all backend test suites (auth, grading, AI hints, analytics, public profiles)
python -m pytest backend/tests/ -v

# Run full-stack and contract integration test suites
python -m pytest tests/ -v
```
**Total:** **134 Passed / 0 Failed**
- `backend/tests/test_ai_analytics_profiles.py` (23 passed)
- `backend/tests/test_auth.py` (22 passed)
- `backend/tests/test_grading.py` (27 passed)
- `tests/` integration suites (62 passed)

### 10.2 Frontend React & Monaco Editor Tests (Vitest)
From `frontend/`:
```bash
cd frontend
npm test -- --run
```
**Total:** **37 Passed / 0 Failed** (`portfolio.test.tsx`, `assessment.test.tsx`, `aiAnalyticsProfiles.test.tsx`, `auth.test.tsx`).

---

## 11. Verification & Security Checklist

| Scenario | Expected Result | Verified |
| :--- | :--- | :---: |
| **Untrusted Code Isolation** | Code executes exclusively inside ephemeral Docker sandboxes; never on FastAPI host | ✅ |
| **Progressive AI Hints** | Level 1, 2, and 3 hints delivered progressively with conceptual framing | ✅ |
| **Code Leakage Redaction** | Guardrail intercepts and redacts multi-line code solutions and function headers | ✅ |
| **Hint Rate Limiting** | Max 3 hints per question enforced; excess requests return `429 EXCESSIVE_HINT_REQUESTS` | ✅ |
| **Featherless Timeout Fallback** | AI timeout or failure automatically serves deterministic fallback hints gracefully | ✅ |
| **Cross-Student Hint Isolation** | Students cannot view or request hints on another student's assessment (`403 Forbidden`) | ✅ |
| **Deterministic Efficiency Score** | Calculated by deterministic backend logic with difficulty multipliers; zero LLM grading | ✅ |
| **Formula Version Stamping** | Every result preserves `formula_version: "v1.0"` and composite weights (80% / 20%) | ✅ |
| **Dashboard Analytics** | Aggregates assessments, test cases, topic breakdowns, delta, and consistency score | ✅ |
| **Empty Analytics Handling** | Zero-assessment candidates receive clean zeroed metrics without server error | ✅ |
| **Public Profile Privacy** | Zero exposure of email, user UUIDs, auth tokens, source code, or hidden tests | ✅ |
| **Instant Link Revocation** | Revoking `share_id` immediately disables the previous link with `404 Not Found` | ✅ |
| **Container Cleanup** | Disposable execution containers destroyed immediately on completion or failure | ✅ |
