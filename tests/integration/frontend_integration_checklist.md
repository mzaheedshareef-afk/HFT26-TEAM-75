# 🧪 Frontend Integration & QA Checklist (Phase 4)

**Role:** Testing & Integration Developer (Vasil)  
**Collaborator:** Mohammed Zaheed Shareef (Frontend Lead)  
**Project:** Portfolio-Driven Adaptive Coding & Technical Assessment Platform (`HFT26-TEAM-75`)

---

## 📌 Overview
This checklist defines the required user journeys, UI validation states, error messages, and contract requirements that the Frontend (`frontend/src/`) must satisfy before merging into `dev`.

The Frontend can be developed and verified against the running mock server:
```bash
python tests/auth/auth_mock_server.py
# Runs on http://localhost:8000 with CORS enabled for http://localhost:5173
```

---

## 1. Student Authentication Journey

### 1.1 Registration (`/register` or `/register/student`)
| Test ID | Action | Input Data | Expected UI Behavior | Contract Verification | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **FE-ST-01** | Fill valid student details | `name`: "Priya Sharma"<br>`email`: "priya@student.cbit.ac.in"<br>`password`: "Secret123!" | Form submits with loading spinner. On 201 Created, token is stored, user is redirected to `/dashboard/student`. | `POST /api/auth/student/register` | ⏳ Ready |
| **FE-ST-02** | Submit duplicate email | `email`: "student@cbit.ac.in" | Error toast or inline banner displays: *"Email is already registered"*. Form is not cleared. | HTTP 409 Conflict | ⏳ Ready |
| **FE-ST-03** | Submit invalid email | `email`: "invalid-email" | Client-side validation triggers *"Please enter a valid email address"* before sending request. | Frontend validation / 422 | ⏳ Ready |
| **FE-ST-04** | Submit empty required fields | Empty password or name | Submit button disabled or inline field errors highlight empty fields in red. | Client-side validation | ⏳ Ready |

### 1.2 Login (`/login` or `/login/student`)
| Test ID | Action | Input Data | Expected UI Behavior | Contract Verification | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **FE-ST-05** | Valid student credentials | `email`: "student@cbit.ac.in"<br>`password`: "Password123!" | Successful login. Token stored in `localStorage` / memory. Instant redirect to `/dashboard/student`. | `POST /api/auth/student/login` | ⏳ Ready |
| **FE-ST-06** | Incorrect password | `email`: "student@cbit.ac.in"<br>`password`: "WrongPassword!" | Toast displays: *"Invalid email or password"*. Password field cleared; cursor focused. | HTTP 401 Unauthorized | ⏳ Ready |

---

## 2. Company / Recruiter Authentication Journey

### 2.1 Registration (`/register/company`)
| Test ID | Action | Input Data | Expected UI Behavior | Contract Verification | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **FE-CP-01** | Valid company registration | `company_name`: "InnoTech"<br>`contact_name`: "Sarah"<br>`email`: "hr@innotech.com"<br>`password`: "Recruit2026!" | On 201 Created, token saved. Redirected to `/dashboard/recruiter`. | `POST /api/auth/company/register` | ⏳ Ready |
| **FE-CP-02** | Duplicate company email | `email`: "recruiter@techcorp.com" | Alert banner: *"Email is already registered"*. | HTTP 409 Conflict | ⏳ Ready |
| **FE-CP-03** | Missing company name | Company name left empty | Field highlighted in red: *"Company name is required"*. | HTTP 422 / Client-side | ⏳ Ready |

### 2.2 Login (`/login/company`)
| Test ID | Action | Input Data | Expected UI Behavior | Contract Verification | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **FE-CP-04** | Valid company login | `email`: "recruiter@techcorp.com"<br>`password`: "CompanySecure2026!" | Successful login. Redirected to `/dashboard/recruiter`. Company name displayed in navbar. | `POST /api/auth/company/login` | ⏳ Ready |
| **FE-CP-05** | Invalid recruiter login | `email`: "unknown@corp.com"<br>`password`: "WrongPass" | Toast: *"Invalid email or password"*. | HTTP 401 Unauthorized | ⏳ Ready |

---

## 3. Role-Based Navigation & Route Guards

| Test ID | Description | Precondition | Expected Behavior |
| :--- | :--- | :--- | :--- |
| **FE-RBAC-01** | Student accessing Recruiter routes | Logged in as Student | Attempting to navigate to `/dashboard/recruiter` or `/candidates` redirects to `/dashboard/student` or shows `403 Forbidden` page. |
| **FE-RBAC-02** | Company accessing Student assessment | Logged in as Company | Attempting to navigate to `/assessment/:id` shows `403 Forbidden` modal or redirects to recruiter dashboard. |
| **FE-RBAC-03** | Unauthenticated user accessing private route | No token in storage | Navigating directly to `/dashboard/*` triggers redirect to `/login` with `returnUrl` query parameter. |
| **FE-RBAC-04** | Logout action | Authenticated session | Clicking "Logout" clears tokens from `localStorage`/cookies, resets user context, and redirects to `/login`. |

---

## 4. Frontend & Backend Compatibility Checks

- [x] **Field Naming Alignment:**
  - Token key: `access_token` (snake_case)
  - Token type: `token_type` ("bearer")
  - User object: `user.role` ("student" | "company")
  - Recruiter branding: `user.company_name`
- [x] **Authorization Header Injection:**
  - Standard Axios / Fetch interceptor:
    ```javascript
    config.headers.Authorization = `Bearer ${token}`;
    ```
- [x] **Backend Unavailable State:**
  - When backend is down (network error / 502 / 503):
    - UI **must not** crash or show a blank white screen.
    - A clear toast or banner must display: *"Unable to reach the server. Please check your connection or try again shortly."*
    - Retry button provided on error screen.
