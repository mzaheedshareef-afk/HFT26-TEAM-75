# 🏗️ Execution & Grading Module Architecture Plan (Phase 5)

**Author:** Vasil (Testing & Integration Lead)  
**Project:** Portfolio-Driven Adaptive Coding & Technical Assessment Platform  
**Team:** `HFT26-TEAM-75` (Gate code)

---

## 1. Executive Summary

This architecture specification outlines the design, security protocols, and test harnesses for the **Execution & Grading Engine** (`backend/app/execution/` and `backend/app/grading/`). The platform evaluates candidate coding submissions against both public and hidden test cases with deterministic grading, strictly isolated Docker sandboxes, and AI-driven algorithmic efficiency scoring.

> [!CAUTION]
> **Zero Host Execution Rule:** Never execute untrusted code submitted by users directly on the host system. All execution must be contained within ephemeral, resource-constrained, non-networked Docker containers.

---

## 2. Docker-Based Code Execution Architecture

```
                       +---------------------------------------+
                       |       Client Code Submission          |
                       +---------------------------------------+
                                           |
                                           v
                       +---------------------------------------+
                       |     Static Analysis & AST Gate        |
                       |  (Detect fork bombs, raw OS calls)    |
                       +---------------------------------------+
                                           | Passes static check
                                           v
+-----------------------------------------------------------------------------------+
|                           Docker Sandbox Container                                |
|                                                                                   |
|  * Image: python:3.12-slim (or alpine)                                            |
|  * User: sandboxuser (UID 1001, non-root)                                         |
|  * Flag: --network none (strictly blocked socket/network)                         |
|  * Resource Limits: --memory=256m --cpus=0.5 --pids-limit=64                      |
|  * Storage: --read-only with ephemeral --tmpfs /tmp:rw,size=32m                   |
|  * Security: --cap-drop=ALL --security-opt=no-new-privileges:true                 |
|                                                                                   |
|       Stdin (Test Case Input) ---> Runner Script ---> Stdout (Candidate Output)   |
|                                         |                                         |
|                                  Timeout Kill (2.0s)                              |
+-----------------------------------------------------------------------------------+
                                           |
                                           v
                       +---------------------------------------+
                       |      Deterministic Grading Engine     |
                       |  (Output normalization & diff check)   |
                       +---------------------------------------+
                                           |
                                           v
                       +---------------------------------------+
                       |      AI Efficiency Scoring Engine     |
                       |   (AST Complexity + Featherless LLM)  |
                       +---------------------------------------+
```

### 2.1 Container Configuration Matrix
| Parameter | Setting | Security Rationale |
| :--- | :--- | :--- |
| **Networking** | `--network none` | Completely prevents data exfiltration, outbound botnets, or SSRF attacks. |
| **Memory Limit** | `--memory=256m --memory-swap=256m` | Prevents memory exhaustion attacks (`arr = [0] * 10**9`). |
| **CPU Quota** | `--cpus=0.5` | Throttles CPU consumption to protect host responsiveness. |
| **PIDs Limit** | `--pids-limit=64` | Blocks `os.fork()` recursion bombs. |
| **Execution User** | `sandboxuser` (`UID 1001`) | Eliminates container escape vectors reliant on root privileges. |
| **Root Filesystem** | `--read-only` | Prevents writing persistent malware, modifying binaries, or corrupting host. |
| **Ephemeral FS** | `--tmpfs /tmp:rw,size=32m,noexec,nosuid` | Safe scratchpad for temporary files; files are destroyed upon exit. |
| **Timeout Guard** | `2.0 seconds` wall clock / `1.5s` CPU | Prevents infinite loops (`while True: pass`). |
| **Capabilities** | `--cap-drop=ALL` | Drops all Linux capabilities (`CAP_NET_RAW`, `CAP_SYS_ADMIN`, etc.). |

---

## 3. Question Validation Pipeline

Before any coding problem is published or served to students, it must pass the **Question Validation Pipeline**:

```
[ Question JSON / Task Schema ]
              |
              v
     1. Schema Validation (Constraints, types, IDs)
              |
              v
     2. Reference Solution Execution
              |
              +---> All Public Test Cases  == PASS?
              +---> All Hidden Test Cases  == PASS?
              |
              v
     3. Complexity Sanity Check
              |
              +---> Wall-clock execution time < 50% of Time Limit
              +---> Memory usage < 50% of Memory Limit
              |
              v
     4. Suboptimal Solution Validation
              |
              +---> Verifies that brute-force fails on large/hidden test cases (TLE)
              |
              v
   [ Problem Validated & Certified ]
```

---

## 4. Hidden Test Execution & Deterministic Grading

### 4.1 Execution Protocol
1. Hidden test inputs and outputs are never sent to the candidate's browser.
2. The submission runner feeds each test case sequentially into the container's `stdin`.
3. Execution time is recorded using high-resolution monotonic clocks (`time.perf_counter()`).
4. Output truncation: If standard output exceeds `1 MB`, the process is terminated with `Output Limit Exceeded` (OLE).

### 4.2 Deterministic Comparison Rules
- **String Output:** Whitespace and trailing newlines are stripped (`output.strip()`).
- **Token Comparison:** Line endings (`\r\n` vs `\n`) are normalized.
- **Float Comparison:** Numeric floating point outputs are compared with tolerance:
  $$\| \text{actual} - \text{expected} \| \le 10^{-6}$$
- **Execution Status Categories:**
  - `AC` (Accepted): Correct output within time & memory limits.
  - `WA` (Wrong Answer): Incorrect output produced.
  - `TLE` (Time Limit Exceeded): Execution exceeded time quota (2000ms).
  - `MLE` (Memory Limit Exceeded): Exceeded 256MB threshold.
  - `RTE` (Runtime Error): Non-zero exit code or unhandled exception.
  - `SEC` (Security Violation): Prohibited module or syscall attempted.

### 4.3 Weighted Scoring Formula
$$\text{Deterministic Score} = \sum_{i=1}^{N} \left( \mathbb{I}(\text{test}_i == \text{PASS}) \times \text{Weight}_i \right)$$

---

## 5. AI Efficiency Scoring Engine

While deterministic grading scores functional correctness, the **AI Efficiency Engine** assesses code quality, algorithmic optimality, and clean code principles:

### 5.1 Static AST Analysis
- **Loop Nesting Depth:** Inspects Abstract Syntax Tree (`ast.For`, `ast.While`) to estimate algorithmic time complexity:
  - 1 Loop: Likely $O(N)$
  - 2 Nested Loops: Likely $O(N^2)$
  - 3 Nested Loops: Likely $O(N^3)$
- **Data Structure Usage:** Detects dictionary/hash map lookup ($O(1)$) versus array scanning ($O(N)$).
- **Recursion Detection:** Flags recursion without base cases or memoization.

### 5.2 Featherless / LLM Evaluation Prompt (Guarded)
```text
System Prompt:
You are an expert algorithmic assessment evaluator. Analyze the following code submission.
Evaluate strictly on:
1. Time Complexity (Big-O notation)
2. Space Complexity (Big-O notation)
3. Code Cleanliness & Readability (1-10)
4. Algorithmic Optimality (1-10)

Constraints:
- Do not provide code solutions or reveal hidden test cases.
- Provide constructive feedback on how to optimize time/space.

Input:
Problem: {problem_title}
Reference Complexity: {reference_time_complexity}
Candidate Code:
```python
{candidate_code}
```
Output JSON format:
{
  "detected_time_complexity": "O(N)",
  "detected_space_complexity": "O(N)",
  "optimality_score": 9.5,
  "cleanliness_score": 9.0,
  "feedback": "Optimal hash map solution achieving linear time complexity."
}
```

---

## 6. Reference Coding Problem Implementation

A fully validated reference problem has been authored and tested at:
`tests/sandbox_planning/sample_question.json`

- **Problem:** Pair Target Sum (Two Sum)
- **Public Cases:** 2 cases (demonstrating normal pairing)
- **Hidden Cases:** 5 cases (negative integers, zeros, large bounds, distant pairs)
- **Reference Solution:** Python 3 Hash Map ($O(N)$ Time, $O(N)$ Space) — 100% Pass Rate
- **Suboptimal Solution:** Python 3 Nested Loop ($O(N^2)$ Time, $O(1)$ Space) — Flagged by AST complexity scanner
- **Malicious Test Suite:** 5 security violation samples verified against static detection rules.

---

## 7. Next-Phase Integration Milestones

| Milestone | Target Owner | Verification Criteria |
| :--- | :--- | :--- |
| **M1: Docker Sandbox Script** | Srinath & Vasil | `docker_runner.py` container spawning with `--network none` |
| **M2: Test Harness Service** | Srinath & Vasil | `execution_manager.py` batch test runner matching `sample_question.json` |
| **M3: Frontend Code Editor** | Zaheed | Monaco / CodeMirror editor with language selection and test runner button |
| **M4: Live Assessment Run** | Entire Team | End-to-end flow: Candidate logs in -> selects problem -> submits code -> grades deterministically -> AI feedback generated |
