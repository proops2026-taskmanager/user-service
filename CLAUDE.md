# user-service — Agent Context

> Copy this file to the root of the user-service repo as `CLAUDE.md` when scaffolding.

---

## What This Service Does

`user-service` owns every user record and every authentication decision.
- Registers new users (email, password, full_name, role)
- Issues JWT tokens on login
- Exposes GET /users/:id for internal use only (api-gateway or other services)

No other service stores passwords or issues JWTs. If a service needs to know who made a request,
it reads the `X-User-Id` header injected by api-gateway — it never calls user-service at runtime.

**Port:** 3001 (internal only — not exposed to host)
**Database:** user-db (PostgreSQL 15, separate from task-service)

---

## Governing Document

**IRD-001** is the law for this service. Read it before writing any code.

| Location | URL |
|----------|-----|
| Local (docs repo) | `../docs-taskmanager/docs/IRD-001.md` |
| Notion | https://www.notion.so/341dde5fafa981f2906ae06ef131a347 |

Also read **IRD-003** for NFRs (error format, health endpoint, .env pattern, Docker) that apply to this service.

---

## API Contract (summary — full spec in IRD-001)

```
POST /users              Register     → 201 { id, email, full_name, role }
POST /auth/login         Login        → 200 { token, user: { id, email, full_name, role } }
GET  /users/:id          Get user     → 200 { id, email, full_name, role }  ← internal only
GET  /health             Health check → 200 { "status": "ok" }
```

---

## Data Model

```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'lead')),
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
```

---

## Standards (locked — do not change)

| Rule | Value |
|------|-------|
| Error format | `{ "error": "string" }` — every endpoint |
| JWT algorithm | HS256 |
| JWT expiry | 24h |
| JWT payload | `{ sub: userId, role }` |
| bcrypt rounds | 12 |
| Secrets | `.env` (git-ignored) + `.env.example` (committed) |
| Health endpoint | `GET /health → 200 { "status": "ok" }` |

**Never validate JWT in this service.** This service issues JWTs. api-gateway validates them.
user-service never receives the Authorization header — api-gateway strips it.

---

## Environment Variables

```env
# .env.example — commit this, not .env
PORT=3001
DATABASE_URL=postgresql://USER:PASS@HOST:5432/users_db
JWT_SECRET=
JWT_EXPIRES_IN=24h
```

---

## Sprint 1 Tasks for This Service

| Task | Owner | Description |
|------|-------|-------------|
| T-01 | chau_tv | Scaffold: npm init, TS config, Express, /health, Dockerfile, .env.example |
| T-02 | thai_dm | DB schema: users table + migration script |
| T-03 | chau_tv | POST /users — validation + bcrypt + INSERT |
| T-04 | thai_dm | POST /auth/login — verify password + issue JWT |
| T-05 | chau_tv | GET /users/:id — return user (no password_hash) |
| T-06 | chau_tv | Integration tests: jest + supertest, all endpoints |

---

## Session Startup for This Service

```
1. Read IRD-001 (local or Notion) — full API contract
2. Read IRD-003 — NFRs: error format, health, .env, Docker
3. Check which task you're on (see sprint-01.md in docs repo)
4. Implement — follow IRD-001 exactly
```
