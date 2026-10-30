# 🛡️ Secure Code Execution & Automated Grading Engine Documentation

**Author:** Vasil (Testing & Integration Lead)  
**Project:** Portfolio-Driven Adaptive Coding & Technical Assessment Platform  
**Team:** `HFT26-TEAM-75`  
**Status:** Implemented & Fully Tested  

---

## 1. Executive Summary & Security Model

The **Secure Code Execution & Automated Grading Engine** evaluates candidate source code submissions within hardened, isolated, ephemeral Docker sandboxes. It features:
- **Zero Host Execution Rule:** Untrusted candidate code is never executed directly on the FastAPI host.
- **Deterministic Grading:** Correctness decisions are 100% deterministic using exact string and token comparison with floating-point tolerance ($10^{-6}$). No LLM is used to decide pass/fail.
- **Hidden Test Confidentiality:** Hidden test inputs, expected outputs, and reference solutions remain strictly confidential on the backend and are never leaked to the candidate.
- **Defense-in-Depth Isolation:** Containers run without network, as a non-root user, with dropped capabilities, read-only root filesystems, and strict CPU/memory quotas.

---

## 2. Docker Architecture & Installation

### 2.1 Host Prerequisites & Installation

To run sandboxed code execution in development or production:

#### Linux (Debian / Ubuntu):
```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
sudo systemctl enable --now docker
```

#### macOS / Windows:
1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/).
2. On Windows, ensure **WSL2** backend is enabled in Docker Desktop settings.
3. Verify installation:
   ```bash
   docker --version
   docker ps
   ```

### 2.2 Building Sandbox Images

You can build the unified multi-language sandbox or language-specific images using `docker-compose.yml`:

```bash
# Build multi-language sandbox runner
docker compose build sandbox-runner

# Or build individual images
docker compose build sandbox-python
docker compose build sandbox-cpp
docker compose build sandbox-java
```

---

## 3. Supported Languages & Runtime Environments

| Language | Canonical Name | Container Base Image | Source Filename | Compilation Step | Execution Command |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Python 3** | `python` | `python:3.12-slim` | `solution.py` | Syntax check (`compile()`) | `python3 /sandbox/solution.py` |
| **C++ 17** | `cpp` | `gcc:13-bookworm` | `solution.cpp` | `g++ -O3 -std=c++17 -Wall /sandbox/solution.cpp -o /sandbox/solution` | `/sandbox/solution` |
| **Java 17** | `java` | `openjdk:17-slim` | `Solution.java` | `javac /sandbox/Solution.java` | `java -Xmx256m -Xss16m -cp /sandbox Solution` |

Aliases accepted by the API:
- Python: `python`, `py`, `python3`
- C++: `cpp`, `c++`, `cxx`
- Java: `java`

---

## 4. Docker Security Hardening Matrix

Every execution enforces the following flags:

```bash
docker run \
  --name <ephemeral_container_id> \
  --rm \
  --network none \
  --memory 256m \
  --memory-swap 256m \
  --cpus 0.5 \
  --pids-limit 64 \
  --read-only \
  --tmpfs /tmp:rw,size=32m,noexec,nosuid \
  --cap-drop ALL \
  --security-opt no-new-privileges:true \
  --user 1001:1001 \
  -v <ephemeral_temp_dir>:/sandbox:ro \
  -w /tmp \
  -i \
  <image> <command>
```

| Security Flag | Value | Rationale |
| :--- | :--- | :--- |
| `--network` | `none` | Blocks all socket operations, prevents SSRF, data exfiltration, or botnets. |
| `--memory` | `256m` | Blocks memory exhaustion attacks (`arr = [0] * 10**9`). |
| `--memory-swap` | `256m` | Disables swap expansion beyond memory quota. |
| `--cpus` | `0.5` | Throttles CPU consumption to protect host responsiveness. |
| `--pids-limit` | `64` | Blocks `os.fork()` recursion bombs. |
| `--read-only` | Root FS read-only | Prevents writing persistent malware or tampering with binaries. |
| `--tmpfs` | `/tmp:rw,size=32m,noexec,nosuid` | In-memory ephemeral scratchpad destroyed on container exit. |
| `--cap-drop` | `ALL` | Drops all Linux capabilities (`CAP_NET_RAW`, `CAP_SYS_ADMIN`, etc.). |
| `--security-opt`| `no-new-privileges:true` | Prevents privilege escalation via `setuid` binaries. |
| `--user` | `1001:1001` (`sandboxuser`) | Eliminates container escape vectors reliant on root privileges. |
| Execution Timeout | `2.0 seconds` | Terminates infinite loops (`while True: pass`). |
| Output Cap | `1 MB` | Terminates infinite stdout generation (Output Limit Exceeded). |
| Ephemeral Cleanup | `--rm` + `finally: docker rm -f` | Guarantees container destruction even after crashes or timeouts. |
| Host Secrets Isolation| Clean environment | Host environment variables and `.env` files are never passed to containers. |

---

## 5. Environment Variables Configuration

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `DOCKER_IMAGE_PYTHON` | `python:3.12-slim` | Docker image for Python execution |
| `DOCKER_IMAGE_CPP` | `gcc:13-bookworm` | Docker image for C++ compilation and run |
| `DOCKER_IMAGE_JAVA` | `openjdk:17-slim` | Docker image for Java compilation and run |
| `SUPABASE_URL` | *Configured in `.env`* | Supabase project URL |
| `SUPABASE_KEY` | *Configured in `.env`* | Supabase backend service/anon key |
| `SUPABASE_JWT_SECRET`| *Configured in `.env`* | JWT secret for verifying auth tokens |
| `FEATHERLESS_API_KEY`| *Optional* | Optional LLM key for qualitative efficiency feedback |

---

## 6. API Contracts & Endpoints

All protected endpoints require `Authorization: Bearer <access_token>`.

### 6.1 POST `/api/code/run`
Runs code **strictly against public test cases** (or custom input). Never touches hidden test cases or persists a score.

#### Request Body
```json
{
  "source_code": "import sys\n\ndef solve():\n    lines = sys.stdin.read().strip().split('\\n')\n    print('0 1')\n\nif __name__ == '__main__':\n    solve()",
  "language": "python",
  "question_id": "q_target_pair_001",
  "assessment_id": "optional-assessment-uuid",
  "custom_input": null
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "language": "python",
  "question_id": "q_target_pair_001",
  "total_test_cases": 2,
  "passed_test_cases": 2,
  "failed_test_cases": 0,
  "test_results": [
    {
      "test_case_id": "pub_1",
      "status": "ACCEPTED",
      "passed": true,
      "input": "2,7,11,15\n9",
      "expected_output": "0 1",
      "actual_output": "0 1",
      "error_message": null,
      "execution_time_ms": 14.5,
      "is_hidden": false
    }
  ]
}
```

---

### 6.2 POST `/api/code/submit`
Evaluates code against **both public and hidden test cases**, calculates deterministic weighted score, and persists submission in Supabase.

#### Request Body
```json
{
  "source_code": "import sys\n# solution code",
  "language": "python",
  "question_id": "q_target_pair_001",
  "assessment_id": "8f3b92d1-2134-4567-890a-bcdef0123456"
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "submission_id": "sub_4e2a87b1-9123-4455-88aa-bb1122334455",
  "assessment_id": "8f3b92d1-2134-4567-890a-bcdef0123456",
  "question_id": "q_target_pair_001",
  "status": "accepted",
  "score": 100.0,
  "is_accepted": true,
  "passed_tests": 7,
  "failed_tests": 0,
  "total_tests": 7,
  "public_test_cases": [
    {
      "test_case_id": "pub_1",
      "status": "ACCEPTED",
      "passed": true,
      "input": "2,7,11,15\n9",
      "expected_output": "0 1",
      "actual_output": "0 1",
      "execution_time_ms": 12.3,
      "is_hidden": false
    }
  ],
  "hidden_test_cases": [
    {
      "test_case_id": "hid_1",
      "status": "ACCEPTED",
      "passed": true,
      "execution_time_ms": 15.1,
      "is_hidden": true
    }
  ],
  "efficiency": {
    "detected_time_complexity": "O(N)",
    "detected_space_complexity": "O(N)",
    "max_loop_depth": 1,
    "feedback": "Algorithmic complexity evaluated as O(N) time and O(N) space."
  },
  "created_at": "2026-10-31T02:40:00Z"
}
```

> [!IMPORTANT]
> Notice that for hidden test cases, `input`, `expected_output`, and `actual_output` are never included in the response.

---

### 6.3 GET `/api/submissions/{submission_id}`
Retrieves submission details. Enforces ownership: students can only view their own submissions; company recruiters can review candidate submissions.

---

### 6.4 GET `/api/assessment/{assessment_id}/results`
Retrieves aggregated assessment results, best score per question, and rolled-up final assessment score.

---

## 7. Automated Testing Suite

The execution engine includes test coverage for:
1. Output normalization & token/float comparisons ($10^{-6}$).
2. Weighted test case grade calculations.
3. Unsupported language rejection (`400 UNSUPPORTED_LANGUAGE`).
4. Empty source code rejection (`400 INVALID_SOURCE_CODE`).
5. Null-byte injection prevention (`400 SECURITY_VIOLATION`).
6. Forbidden Python imports (`ctypes`, `pty`).
7. Correct code execution for Python, C++, and Java.
8. Compilation error reporting.
9. Runtime error & traceback capture.
10. Infinite loop execution timeout handling.
11. Memory limit exhaustion (MLE) handling.
12. Docker unavailable handling (`503 DOCKER_UNAVAILABLE`).
13. Ephemeral container cleanup guarantees.
14. Public run vs hidden submit separation.
15. Hidden test confidentiality verification.
16. Candidate cross-submission authorization isolation.
17. Assessment results score rollups.
18. AST complexity detection ($O(N)$ vs $O(N^2)$).

### Running Tests:
```powershell
# Run secure execution & grading test suite
$env:PYTHONPATH="."; python -m pytest backend/tests/test_grading.py -v

# Run contract validation test suite
$env:PYTHONPATH="."; python -m pytest tests/sandbox_planning/test_sandbox_contract.py -v

# Run all backend tests
$env:PYTHONPATH="."; python -m pytest backend/tests/test_auth.py backend/tests/test_portfolio.py backend/tests/test_validation.py backend/tests/test_grading.py -v
```
