# GateCode Frontend — Authentication Module

Frontend authentication and landing module for **GateCode** (*Portfolio-Driven Adaptive Coding & Technical Assessment Platform*), developed by **HFT26-TEAM-75**.

## Tech Stack
- **React 19 + Vite 6**
- **TypeScript**
- **Tailwind CSS v4**
- **React Router v7**
- **Axios**
- **Lucide React**
- **Vitest + React Testing Library**

## Local Setup

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

By default, the frontend expects the backend API at `http://localhost:8000` (configurable via `VITE_API_BASE_URL`).

## Routes
| Route | Description |
| :--- | :--- |
| `/` | SaaS Landing Page with Candidate & Company entry points |
| `/student/signup` | Candidate Registration (`POST /api/auth/student/register`) |
| `/student/login` | Candidate Login (`POST /api/auth/student/login`) |
| `/company/signup` | Company Registration (`POST /api/auth/company/register`) |
| `/company/login` | Company Login (`POST /api/auth/company/login`) |
| `/student/dashboard` | Protected Student Dashboard Placeholder |
| `/company/dashboard` | Protected Company Dashboard Placeholder |

## API Contract (`http://localhost:8000`)

### Endpoints
- `POST /api/auth/student/register`
  - Request: `{ "name": "Candidate", "full_name": "Candidate", "email": "candidate@example.com", "password": "..." }`
- `POST /api/auth/student/login`
  - Request: `{ "email": "candidate@example.com", "password": "..." }`
- `POST /api/auth/company/register`
  - Request: `{ "name": "Acme Corp", "company_name": "Acme Corp", "email": "hr@acme.com", "official_email": "hr@acme.com", "password": "..." }`
- `POST /api/auth/company/login`
  - Request: `{ "email": "hr@acme.com", "official_email": "hr@acme.com", "password": "..." }`

### Expected Auth Response
```json
{
  "success": true,
  "access_token": "JWT_TOKEN",
  "token_type": "bearer",
  "user": {
    "id": "user_101",
    "name": "Candidate",
    "email": "candidate@example.com",
    "role": "student"
  }
}
```
*(Companies return `"role": "company"`.)*

## Scripts
- `npm run dev` — Start Vite development server
- `npm run test` — Run automated validation & authentication test suite
- `npm run build` — Type-check and create production bundle
