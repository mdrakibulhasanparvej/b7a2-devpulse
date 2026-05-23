# DevPulse – Internal Tech Issue & Feature Tracker

> A collaborative backend platform for software teams to report bugs, suggest features, and coordinate resolutions — powered by **Node.js**, **strict TypeScript**, **Express.js**, and **raw PostgreSQL**.

[![TypeScript](https://img.shields.io/badge/TypeScript-Strict%20%7C%200%25%20any-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express.js-5.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![JWT](https://img.shields.io/badge/Auth-JWT%20%7C%20bcrypt-000000?logo=jsonwebtoken&logoColor=white)](https://jwt.io/)

---

## Table of Contents

1. [Key Features](#key-features)
2. [Technology Stack & Strict Constraints](#technology-stack--strict-constraints)
3. [Project Structure](#project-structure)
4. [Database Schema](#database-schema)
5. [API Endpoints — Complete Testing Guide](#api-endpoints--complete-testing-guide)
   - [POST /api/auth/signup — Register a new user](#1-post-apiauthsignup--register-a-new-user)
   - [POST /api/auth/login — Authenticate & receive JWT](#2-post-apiauthlogin--authenticate--receive-jwt)
   - [POST /api/issues — Create an issue (Auth required)](#3-post-apiissues--create-an-issue-auth-required)
   - [GET /api/issues — List issues with filtering & sorting](#4-get-apiissues--list-issues-with-filtering--sorting)
   - [GET /api/issues/:id — Get a single issue](#5-get-apiissuesid--get-a-single-issue)
   - [PATCH /api/issues/:id — Update an issue (Auth required)](#6-patch-apiissuesid--update-an-issue-auth-required)
   - [DELETE /api/issues/:id — Delete an issue (Maintainer only)](#7-delete-apiissuesid--delete-an-issue-maintainer-only)
6. [Response Formats](#response-formats)
7. [Local Development Setup](#local-development-setup)
8. [Environment Variables](#environment-variables)

---

## Key Features

- **Role-Based Access Control** — Two roles: `contributor` (report issues, edit own open issues) and `maintainer` (full CRUD on all issues).
- **JWT Authentication** — Token carries `id`, `name`, and `role`. Passwords hashed with bcrypt (salt rounds = 10).
- **No-JOIN Data Aggregation** — Relational data between `issues` and `users` is resolved entirely in application logic via batch `WHERE id = ANY($1)` lookups. Zero SQL JOINs.
- **Fully Type-Safe** — Zero usage of the `any` keyword across the entire codebase. `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` enforced.
- **Record-Level Guards** — Contributors can only mutate their own reports when the issue status is `open`. Maintainers have universal write access.

---

## Technology Stack & Strict Constraints

| Layer     | Technology                        | Constraint                                               |
| --------- | --------------------------------- | -------------------------------------------------------- |
| Runtime   | Node.js (LTS v24+)                | —                                                        |
| Language  | TypeScript (strict mode)          | **Zero `any` keyword** across all files                  |
| Framework | Express.js (v5, modular)          | —                                                        |
| Database  | PostgreSQL via native `pg` driver | **No ORMs** (no Prisma, TypeORM, Sequelize, etc.)        |
| Auth      | `jsonwebtoken` + `bcryptjs`       | JWT payload: `{ id, name, role }`                        |
| SQL JOINs | **Strictly prohibited**           | All relational aggregation done in **application logic** |

---

## Project Structure

```text
DevPulse/
├── src/
│   ├── config/
│   │   └── index.ts                   # Environment variable loader (dotenv)
│   ├── db/
│   │   └── index.ts                   # pg Pool init + auto-table creation
│   ├── middleware/
│   │   ├── auth.ts                    # JWT verification + role guard
│   │   ├── globalErrorHandler.ts      # Centralized error handler
│   │   └── index.d.ts                 # Express Request.user type augmentation
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.controller.ts     # Login handler
│   │   │   ├── auth.interface.ts      # ILoginPayload
│   │   │   ├── auth.route.ts          # POST /login
│   │   │   └── auth.service.ts        # bcrypt verify + JWT sign
│   │   ├── issue/
│   │   │   ├── issue.controller.ts    # CRUD handlers
│   │   │   ├── issue.interface.ts     # IIssuePayload, IUpdateIssuePayload
│   │   │   ├── issue.route.ts         # All /api/issues routes
│   │   │   └── issue.service.ts       # Raw SQL + No-JOIN aggregation
│   │   └── user/
│   │       ├── user.controller.ts     # Signup handler
│   │       ├── user.interface.ts      # IUser
│   │       ├── user.route.ts          # POST /signup
│   │       └── user.service.ts        # bcrypt hash + INSERT
│   ├── types/
│   │   └── index.ts                   # USER_ROLE, ROLES, CustomJwtPayload
│   ├── utility/
│   │   └── sendResponse.ts            # Generic success/error response helper
│   ├── app.ts                         # Express app bootstrap
│   └── server.ts                      # Entry point
├── .env                               # Environment variables (not tracked)
├── package.json
├── tsconfig.json                      # strict: true, zero-any enforcement
└── tsup.config.ts                     # Build configuration
```

---

## Database Schema

### `users`

| Column       | Type           | Constraints                                                              |
| ------------ | -------------- | ------------------------------------------------------------------------ |
| `id`         | `SERIAL`       | `PRIMARY KEY`                                                            |
| `name`       | `VARCHAR(255)` | `NOT NULL`                                                               |
| `email`      | `VARCHAR(255)` | `UNIQUE`, `NOT NULL`                                                     |
| `password`   | `TEXT`         | `NOT NULL` (bcrypt-hashed)                                               |
| `role`       | `VARCHAR(50)`  | `DEFAULT 'contributor'`, `CHECK (role IN ('contributor', 'maintainer'))` |
| `created_at` | `TIMESTAMP`    | `DEFAULT CURRENT_TIMESTAMP`                                              |
| `updated_at` | `TIMESTAMP`    | `DEFAULT CURRENT_TIMESTAMP`                                              |

### `issues`

| Column        | Type           | Constraints                                                               |
| ------------- | -------------- | ------------------------------------------------------------------------- |
| `id`          | `SERIAL`       | `PRIMARY KEY`                                                             |
| `title`       | `VARCHAR(150)` | `NOT NULL`                                                                |
| `description` | `TEXT`         | `NOT NULL` (min 20 characters)                                            |
| `type`        | `VARCHAR(50)`  | `CHECK (type IN ('bug', 'feature_request'))`                              |
| `status`      | `VARCHAR(50)`  | `DEFAULT 'open'`, `CHECK (status IN ('open', 'in_progress', 'resolved'))` |
| `reporter_id` | `INTEGER`      | `NOT NULL` (application-level FK)                                         |
| `created_at`  | `TIMESTAMP`    | `DEFAULT CURRENT_TIMESTAMP`                                               |
| `updated_at`  | `TIMESTAMP`    | `DEFAULT CURRENT_TIMESTAMP`                                               |

---

## API Endpoints — Complete Testing Guide

> **Note:** All authenticated endpoints require the `Authorization` header in the format `Bearer <token>`. The JWT is obtained from the `/api/auth/login` response.

---

### 1. `POST /api/auth/signup` — Register a new user

**Access:** Public

**Request Body:**

```json
{
  "name": "Alice Johnson",
  "email": "alice@example.com",
  "password": "securePass123",
  "role": "contributor"
}
```

**Success Response (201):**

```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "id": 1,
    "name": "Alice Johnson",
    "email": "alice@example.com",
    "role": "contributor",
    "created_at": "2026-05-23T10:00:00.000Z",
    "updated_at": "2026-05-23T10:00:00.000Z"
  }
}
```

> ⚠️ The `password` field is **never** included in any JSON response.

**Register a maintainer for testing:**

```json
{
  "name": "Bob Maintainer",
  "email": "bob@example.com",
  "password": "securePass456",
  "role": "maintainer"
}
```

---

### 2. `POST /api/auth/login` — Authenticate & receive JWT

**Access:** Public

**Request Body:**

```json
{
  "email": "alice@example.com",
  "password": "securePass123"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "name": "Alice Johnson",
      "email": "alice@example.com",
      "role": "contributor",
      "created_at": "2026-05-23T10:00:00.000Z",
      "updated_at": "2026-05-23T10:00:00.000Z"
    }
  }
}
```

> 📌 The JWT payload contains `id`, `name`, and `role`. This token is used for all subsequent authenticated requests.

---

### 3. `POST /api/issues` — Create an issue (Auth required)

**Access:** Authenticated — `contributor` or `maintainer`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**

```json
{
  "title": "Login button unresponsive on Safari",
  "description": "The login button does not trigger any action when clicked on Safari v15. Console shows no errors.",
  "type": "bug"
}
```

> 🔧 `reporter_id` is **auto-extracted** from the JWT token. Do not send it in the body.

**Success Response (201):**

```json
{
  "success": true,
  "message": "Issue created successfully",
  "data": {
    "id": 1,
    "title": "Login button unresponsive on Safari",
    "description": "The login button does not trigger any action when clicked on Safari v15. Console shows no errors.",
    "type": "bug",
    "status": "open",
    "created_at": "2026-05-23T10:05:00.000Z",
    "updated_at": "2026-05-23T10:05:00.000Z",
    "reporter": {
      "id": 1,
      "name": "Alice Johnson",
      "role": "contributor"
    }
  }
}
```

**Create a second issue for multi-user testing:**

```json
{
  "title": "Dark mode toggle for dashboard",
  "description": "Users need a dark mode toggle on the main dashboard for better accessibility during night hours.",
  "type": "feature_request"
}
```

---

### 4. `GET /api/issues` — List issues with filtering & sorting

**Access:** Public

**Query Parameters:**

| Parameter | Type   | Values / Default                    | Description              |
| --------- | ------ | ----------------------------------- | ------------------------ |
| `sort`    | string | `newest` (default) / `oldest`       | Chronological order      |
| `type`    | string | `bug` / `feature_request`           | Filter by issue type     |
| `status`  | string | `open` / `in_progress` / `resolved` | Filter by current status |

**Example Requests:**

```bash
# All issues, newest first (default)
GET /api/issues

# Oldest first
GET /api/issues?sort=oldest

# Only bugs
GET /api/issues?type=bug

# Only open feature requests, sorted oldest first
GET /api/issues?sort=oldest&type=feature_request&status=open
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Issues retrieved successfully",
  "data": [
    {
      "id": 2,
      "title": "Dark mode toggle for dashboard",
      "description": "Users need a dark mode toggle on the main dashboard...",
      "type": "feature_request",
      "status": "open",
      "created_at": "2026-05-23T10:06:00.000Z",
      "updated_at": "2026-05-23T10:06:00.000Z",
      "reporter": {
        "id": 1,
        "name": "Alice Johnson",
        "role": "contributor"
      }
    },
    {
      "id": 1,
      "title": "Login button unresponsive on Safari",
      "description": "The login button does not trigger any action...",
      "type": "bug",
      "status": "open",
      "created_at": "2026-05-23T10:05:00.000Z",
      "updated_at": "2026-05-23T10:05:00.000Z",
      "reporter": {
        "id": 1,
        "name": "Alice Johnson",
        "role": "contributor"
      }
    }
  ]
}
```

> 🔍 **How the No-JOIN aggregation works:**
>
> 1. All matching `issues` rows are fetched with a single `SELECT`.
> 2. Unique `reporter_id` values are collected into a set.
> 3. A secondary batch query `SELECT id, name, role FROM users WHERE id = ANY($1)` retrieves all relevant users.
> 4. The reporter objects are mapped to their respective issues in application code — **zero SQL JOINs used**.

---

### 5. `GET /api/issues/:id` — Get a single issue

**Access:** Public

**Success Response (200):**

```json
{
  "success": true,
  "message": "Issue retrieved successfully",
  "data": {
    "id": 1,
    "title": "Login button unresponsive on Safari",
    "description": "The login button does not trigger any action when clicked on Safari v15. Console shows no errors.",
    "type": "bug",
    "status": "open",
    "created_at": "2026-05-23T10:05:00.000Z",
    "updated_at": "2026-05-23T10:05:00.000Z",
    "reporter": {
      "id": 1,
      "name": "Alice Johnson",
      "role": "contributor"
    }
  }
}
```

**Error Response (404):**

```json
{
  "success": false,
  "message": "Issue not found!"
}
```

---

### 6. `PATCH /api/issues/:id` — Update an issue (Auth required)

**Access:** Authenticated — `contributor` or `maintainer`

**Headers:** `Authorization: Bearer <token>`

**Composite Security Guard Logic:**

| Role          | Can update any issue? | Must be owner? | Must be status `open`? |
| ------------- | --------------------- | -------------- | ---------------------- |
| `maintainer`  | ✅ Yes                | ❌ No          | ❌ No                  |
| `contributor` | ❌ No                 | ✅ Yes         | ✅ Yes                 |

**Request Body (all fields optional):**

```json
{
  "title": "Login button unresponsive on Safari (updated)",
  "description": "Reproduced on Safari v15 and v16. Needs immediate fix.",
  "type": "bug"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Issue updated successfully",
  "data": {
    "id": 1,
    "title": "Login button unresponsive on Safari (updated)",
    "description": "Reproduced on Safari v15 and v16. Needs immediate fix.",
    "type": "bug",
    "status": "open",
    "created_at": "2026-05-23T10:05:00.000Z",
    "updated_at": "2026-05-23T10:07:00.000Z",
    "reporter": {
      "id": 1,
      "name": "Alice Johnson",
      "role": "contributor"
    }
  }
}
```

**Test Scenarios:**

| Scenario                                                               | Expected HTTP Status | Expected Behaviour                                    |
| ---------------------------------------------------------------------- | -------------------- | ----------------------------------------------------- |
| Maintainer edits any field on any issue                                | 200                  | Update succeeds                                       |
| Contributor edits their **own** issue while status is `open`           | 200                  | Update succeeds                                       |
| Contributor tries to edit **another user's** issue                     | 403                  | `"You can only update your own issues!"`              |
| Contributor tries to edit their own issue when status is `in_progress` | 403                  | `"You can only update issues that are still 'open'!"` |

---

### 7. `DELETE /api/issues/:id` — Delete an issue (Maintainer only)

**Access:** Maintainer only

**Headers:** `Authorization: Bearer <token>`

**Success Response (200):**

```json
{
  "success": true,
  "message": "Issue deleted successfully",
  "data": null
}
```

**Test Scenarios:**

| Scenario                                   | Expected HTTP Status | Expected Behaviour                              |
| ------------------------------------------ | -------------------- | ----------------------------------------------- |
| `maintainer` deletes any issue             | 200                  | Deletion succeeds                               |
| `contributor` attempts to delete any issue | 403                  | `"You have no permission to access this route"` |
| DELETE on a non-existent issue             | 404                  | `"Issue not found!"`                            |

---

## Response Formats

### Standard Success Response (200 / 201)

```json
{
  "success": true,
  "message": "<human-readable message>",
  "data": {}
}
```

### Standard Error Response (400 / 401 / 403 / 404 / 500)

```json
{
  "success": false,
  "message": "<human-readable error message>"
}
```

### HTTP Status Codes Used

| Code | Meaning               | Typical Use                                |
| ---- | --------------------- | ------------------------------------------ |
| 200  | OK                    | Successful GET, PATCH, DELETE              |
| 201  | Created               | Successful POST (signup, create issue)     |
| 400  | Bad Request           | Validation failure, duplicate email        |
| 401  | Unauthorized          | Missing or invalid JWT                     |
| 403  | Forbidden             | Insufficient role, not owner, wrong status |
| 404  | Not Found             | Issue or user not found                    |
| 500  | Internal Server Error | Unexpected server errors                   |

---

## Local Development Setup

### Prerequisites

- **Node.js** v24 or later
- **PostgreSQL** 14+ (or a cloud instance via Neon / Supabase)
- **npm** v10+

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/<your-username>/DevPulse.git
cd DevPulse

# 2. Install dependencies
npm install

# 3. Create a .env file in the project root
#    (see Environment Variables section below)

# 4. Start the development server with hot-reload
npm run dev
```

The server starts on the port specified in `.env` (default `6050`).

```bash
# Build for production
npm run build

# Start production build
npm start
```

---
