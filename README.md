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
