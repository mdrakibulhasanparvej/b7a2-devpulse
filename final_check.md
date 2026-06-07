# DevPulse Server - Final Investigation Report

## Summary Dashboard
- **Total Checklist Items:** 18
- **Passed:** 13
- **Failed / Action Required:** 5
- **Overall Status:** CRITICAL ISSUES FOUND

---

## Detailed Audit Breakdown

### 1. Architecture & Tech Stack Compliance

| Requirement | Status | Code Location / Findings |
| :--- | :--- | :--- |
| Node.js & TypeScript Version | **FAILED** | `package.json:23` — `typescript: "^6.0.3"` is a beta/unstable release. Spec requires **stable** TypeScript (no beta). Also missing `engines` field to enforce Node.js LTS 24.x+. |
| Native `pg` Driver Usage | **PASSED** | `src/db/index.ts:4` — `import { Pool } from "pg"`. No ORMs or query builders in dependencies. |
| Absolute Zero SQL JOINs | **PASSED** | All queries across `src/modules/{auth,issue,user}/` and `src/db/` are single-table statements. Reporter data resolved via separate `WHERE id = ANY($1)` or `WHERE id = $1` queries. Zero JOIN keywords. |

### 2. Database Schema & Models

| Requirement | Status | Code Location / Findings |
| :--- | :--- | :--- |
| `users` Table | **PASSED** | `src/db/index.ts:13-22` — All fields match spec: `id` (SERIAL PK), `name` (VARCHAR(255) NOT NULL), `email` (UNIQUE NOT NULL), `password` (TEXT NOT NULL), `role` (CHECK contributor/maintainer, DEFAULT contributor), `created_at`, `updated_at`. |
| `issues` Table | **PASSED** | `src/db/index.ts:25-35` — All fields match spec: `id` (SERIAL PK), `title` (VARCHAR(150) NOT NULL), `description` (TEXT NOT NULL), `type` (CHECK bug/feature_request), `status` (CHECK open/in_progress/resolved, DEFAULT open), `reporter_id` (INT NOT NULL, no FK constraint), `created_at`, `updated_at`. |

### 3. Authentication & Authorization Security

| Requirement | Status | Code Location / Findings |
| :--- | :--- | :--- |
| Token Header Format (`Authorization: <token>`) | **PASSED** | `src/middleware/auth.ts:9` — Reads `req.headers.authorization` as raw value. No `Bearer ` split/strip logic, compliant with the custom plain-token spec. |
| Password Masking in Responses | **PASSED** | `src/modules/user/user.service.ts:13` — Signup `RETURNING` explicitly excludes password column. `src/modules/auth/auth.service.ts:36` — Login destructures `password` out via `const { password: _, ...rest }`. |
| Route Guarding (401 for invalid JWT) | **FAILED** | `src/middleware/auth.ts:32-34` — When `jwt.verify()` throws (expired/malformed token), the catch block calls `next(err)`, which flows to the global error handler and returns **500** instead of **401**. Missing/invalid tokens must uniformly return 401. |

### 4. API Endpoints & Business Logic Validation

| Endpoint | Status | Code Location / Findings |
| :--- | :--- | :--- |
| **POST /api/auth/signup** | **PASSED** | `src/modules/user/user.controller.ts` + `user.service.ts` — Returns 201, hashes password with bcrypt salt=10, saves role (defaults to 'contributor'), returns clean user data without password. No explicit application-level input validation but DB constraints catch nulls/uniques. |
| **POST /api/auth/login** | **PASSED** | `src/modules/auth/auth.service.ts` — Validates credentials (email lookup + bcrypt.compare), signs JWT with `{id, name, role}`, returns 200 with token and password-stripped user object. |
| **POST /api/issues** | **PASSED** *(was FAILED)* | `src/modules/issue/issue.service.ts:43-48` — ✅ **FIXED**: Runtime validation now enforces `title.length <= 150` and `description.length >= 20`. Authenticates user, extracts `reporter_id` from token, status defaults to 'open'. |
| **GET /api/issues** | **PASSED** | `src/modules/issue/issue.service.ts:68-98` — Public access, validates `sort`/`type`/`status` query params, batched reporter lookup via `WHERE id = ANY($1)`. No JOINs. |
| **GET /api/issues/:id** | **PASSED** | `src/modules/issue/issue.service.ts:100-114` — Public access, fetches issue + reporter without JOINs, throws "Issue not found!" → controller returns **404**. |
| **PATCH /api/issues/:id** | **FAILED** | **Partially fixed — 2 sub-issues remain unresolved:** <br>1. ✅ `src/modules/issue/issue.interface.ts:11` — **FIXED**: `status` field added to `IUpdateIssuePayload`. `src/modules/issue/issue.service.ts:139-151` — **FIXED**: UPDATE query now includes `status = COALESCE($4, status)`. Maintainers can change status.<br>2. ❌ `src/modules/issue/issue.controller.ts:94` — **UNRESOLVED**: Contributor editing own in_progress/resolved issue returns **400** instead of **409 Conflict**. Error message `"You can only update issues that are still 'open'!"` doesn't match the keyword check (`"authorized"`/`"own"`), falling to the `400` default.<br>3. ❌ **UNRESOLVED**: Non-existent issue returns **400** instead of **404** — same keyword check misses "not found", defaults to 400. |
| **DELETE /api/issues/:id** | **PASSED** | `src/modules/issue/issue.route.ts:29-32` — `auth(USER_ROLE.maintainer)` guards correctly. Contributors get **403** from middleware. Non-existent issue returns **404**. |

### 5. Global Error Handling & Response Patterns

| Requirement | Status | Code Location / Findings |
| :--- | :--- | :--- |
| Centralized Error Middleware (4 params) | **PASSED** | `src/middleware/globalErrorHandler.ts:3-13` — `(err, req, res, next)` signature present, catches `next(err)` forwarding. |
| Standardized Payloads (success/error format) | **FAILED** | `src/utility/sendResponse.ts:8,16` — Success responses `{success, message, data}` match spec. **But**: Error response field is `error` (singular) but spec requires `errors` (plural). The auth middleware (`src/middleware/auth.ts:12-15,24-27`) returns raw JSON without the standard format and missing `errors` field entirely. |
| HTTP Status Code Precision | **FAILED** | Status 409 **never used** — contributor editing non-open issue must return 409 Conflict per spec. PATCH on non-existent issue returns 400 instead of 404. Invalid/expired JWT returns 500 instead of 401. |

---

## Edge-Cases & Business Logic Vulnerabilities

### 1. Contributor In-Progress Issue Update (Incorrect Status Code) — UNRESOLVED
- **Location:** `src/modules/issue/issue.controller.ts:92-98`
- **Issue:** Contributor editing own issue that is `in_progress` or `resolved` gets a `400 Bad Request`. Spec mandates `409 Conflict`.
- **Root cause:** Error message `"You can only update issues that are still 'open'!"` does not match the keyword logic (`"authorized"`/`"own"`) that maps to 4xx codes.

### 2. Non-Existent Issue PATCH Returns Wrong Code — UNRESOLVED
- **Location:** `src/modules/issue/issue.controller.ts:92-98`
- **Issue:** PATCH on non-existent issue returns 400 instead of 404. The service throws `"Issue not found!"` but the controller's status code logic doesn't account for it.

### 3. Invalid JWT Returns 500 Instead of 401 — UNRESOLVED
- **Location:** `src/middleware/auth.ts:32-34`
- **Issue:** When `jwt.verify()` throws (expired token, bad signature), the error is forwarded via `next(err)` to the global handler which returns `500 Internal Server Error`. Should return 401.

### 4. Response Payload Field Name Mismatch — UNRESOLVED
- **Location:** `src/utility/sendResponse.ts:8,16`
- **Issue:** Error response field is `error` (singular) in both `TResponse` type and JSON output. Spec requires `errors` (plural).

### 5. bcryptjs vs bcrypt — UNRESOLVED
- **Location:** `package.json:26`
- **Issue:** Dependency is `bcryptjs` (pure JS implementation), not `bcrypt` (native binding). Both implement the bcrypt algorithm, but the spec explicitly names `bcrypt`.
- **Severity:** Low — functionally identical, but a literal reading expects the `bcrypt` package.

### 6. TypeScript Beta Version — UNRESOLVED
- **Location:** `package.json:23`
- **Issue:** `typescript: "^6.0.3"` — This is a pre-release/beta version. Spec requires **stable** TypeScript with no beta versions.

### ✅ Issues Resolved Since Initial Audit

| # | Issue | Fix Verification |
|---|-------|-----------------|
| 1 | POST /api/issues missing title/description validation | `src/modules/issue/issue.service.ts:43-48` — Guards added for `title.length > 150` and `description.length < 20`. |
| 2 | Maintainer cannot change issue status via PATCH | `src/modules/issue/issue.interface.ts:11` — `status` field added. `src/modules/issue/issue.service.ts:139-151` — UPDATE query now includes `status = COALESCE($4, status)`. |

---

## Required Fixes (Action Items)

To achieve a 100% perfect score, apply the remaining fixes:

### 🔴 CRITICAL (Compliance Breakers)

| # | File | Line(s) | Issue | Fix |
|---|------|---------|-------|-----|
| 1 | `src/modules/issue/issue.controller.ts` | 92-98 | In-progress edit returns 400 instead of 409; non-existent issue returns 400 instead of 404 | Restructure the catch block to check for all three error types: `if (message.includes("still 'open'")) → 409; else if (message.includes("not found")) → 404; else if (message.includes("own") \|\| message.includes("authorized")) → 403; else → 400`. |
| 2 | `src/middleware/auth.ts` | 32-34 | Invalid/expired JWT forwarded to global error handler (500) | Instead of `next(err)`, return `res.status(401).json({ success: false, message: "Invalid or expired token" })` directly in the catch block. |
| 3 | `src/utility/sendResponse.ts` | 3-9, 16 | Error field named `error` (singular) | Rename `error` → `errors` in both `TResponse` type and the `sendResponse` JSON output object. |
| 4 | `src/middleware/auth.ts` | 12-15, 24-27 | Raw JSON response without `errors` field | Use `sendResponse` utility for consistency, or add `errors: []` field manually. |
| 5 | `package.json` | 23 | TypeScript beta version | Pin to latest stable TypeScript (e.g., `"typescript": "^5.7.0"`) — ensure no beta/rc suffix. |

### 🟡 MODERATE (Spec Literal Compliance)

| # | File | Line(s) | Issue | Fix |
|---|------|---------|-------|-----|
| 6 | `package.json` | 26 | Uses `bcryptjs` instead of `bcrypt` | Replace `bcryptjs` with `bcrypt` (and update types from `@types/bcryptjs` to `@types/bcrypt`). Both implement the same algorithm, but the spec names `bcrypt`. |

### 🟢 MINOR (Polish)

| # | File | Line(s) | Issue | Fix |
|---|------|---------|-------|-----|
| 7 | `src/modules/user/user.controller.ts` | catch block | Signup lacks explicit input validation | Add validation for email format, password minimum length, name presence before calling service. |
| 8 | `package.json` | — | No `engines` field for Node.js version | Add `"engines": { "node": ">=24.0.0" }` to enforce LTS requirement. |
