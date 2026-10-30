# 🛠️ Testing & Integration Suite (`tests/`)

**Author:** Vasil (Testing & Integration Lead)  
**Project:** Portfolio-Driven Adaptive Coding & Technical Assessment Platform  
**Team:** `HFT26-TEAM-75` (Gate code)

---

## 📁 Directory Structure
```
tests/
├── auth/
│   ├── auth_mock_server.py      # Contract-compliant FastAPI mock server with CORS & JWT
│   └── test_auth_api.py         # Automated pytest test cases (Student, Company, Security/RBAC)
├── integration/
│   ├── test_frontend_contracts.py  # Response shapes, CORS headers, backend-down handling
│   └── frontend_integration_checklist.md # Manual & UI verification checklist for Zaheed
├── postman/
│   ├── HFT26_Auth_Integration.postman_collection.json # Postman Collection v2.1 (17 requests)
│   └── HFT26_Environment.postman_environment.json    # Postman Environment variables
├── sandbox_planning/
│   ├── sample_question.json     # Sample coding problem with public, hidden & malicious test cases
│   └── test_sandbox_contract.py # Contract tests for Phase 5 execution & grading
└── README.md                    # This document
```

---

## 🚀 Quickstart Guide

### 1. Run Automated Test Suite
Run all 27 automated tests:
```bash
python -m pytest tests/ -v
```

### 2. Run Test Suite Against Srinath's Live Backend
When Srinath has the backend server running on `http://localhost:8000`:
```bash
$env:API_BASE_URL="http://localhost:8000"
python -m pytest tests/auth/test_auth_api.py -v
```

### 3. Start Mock Server for Zaheed's Frontend Development
Before backend deployment, Zaheed can run the mock server locally:
```bash
python tests/auth/auth_mock_server.py
```
- Server URL: `http://localhost:8000`
- Interactive Swagger UI: `http://localhost:8000/docs`
- Default Seed Accounts:
  - **Student:** `student@cbit.ac.in` / `Password123!`
  - **Company:** `recruiter@techcorp.com` / `CompanySecure2026!`

### 4. Postman Collection
Import both files into Postman (File > Import):
1. `tests/postman/HFT26_Auth_Integration.postman_collection.json`
2. `tests/postman/HFT26_Environment.postman_environment.json`

Select the **"HFT26 Local Development Environment"** in the environment dropdown and click **Run collection**.
