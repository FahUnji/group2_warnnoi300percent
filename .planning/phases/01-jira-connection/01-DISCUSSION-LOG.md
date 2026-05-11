# Phase 1: Jira Connection - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-11
**Phase:** 01-jira-connection
**Areas discussed:** Credential entry, Backend framework, Connection setup UI scope, Error handling shape

---

## Credential Entry

| Option | Description | Selected |
|--------|-------------|----------|
| UI form | User types credentials in the app; backend POSTs and tests | ✓ |
| .env file only | User sets env vars before starting server; no frontend form | |

**User's choice:** UI form

| Option | Description | Selected |
|--------|-------------|----------|
| Save to DB/config | Credentials stored after first successful connect | ✓ |
| Session only | Credentials lost on page refresh or server restart | |

**User's choice:** Save to DB/config

| Option | Description | Selected |
|--------|-------------|----------|
| MySQL table (jira_config) | Consistent with data model; updatable via UI | ✓ |
| config.json file | Local file; simpler but mixes concerns | |

**User's choice:** MySQL table

| Option | Description | Selected |
|--------|-------------|----------|
| Encrypted at rest | Fernet/AES encryption before storing | ✓ |
| Plaintext | Store as-is; simpler for internal tool | |

**User's choice:** Encrypted at rest

**Notes:** User confirmed Basic Auth (email + API token) before area selection, overriding the "Continue with Atlassian" OAuth button in the existing login.html prototype.

---

## Backend Framework

| Option | Description | Selected |
|--------|-------------|----------|
| FastAPI | Async, auto-docs, Pydantic type hints | ✓ |
| Flask | Already in bug-dashboard skill; simpler | |

**User's choice:** FastAPI

**Notes:** User asked for a recommendation on project structure. Recommended Layered over Flat because the project spans 5 phases with clear domain separation (jira, sync, dashboard, export).

| Option | Description | Selected |
|--------|-------------|----------|
| Layered (routers/services/models) | Scales across phases; clean for team work | ✓ |
| Flat (app.py + routers/) | Less boilerplate; fine for solo/tiny projects | |

**User's choice:** Layered

| Option | Description | Selected |
|--------|-------------|----------|
| mysql-connector-python | Already in existing skills; synchronous | ✓ |
| SQLAlchemy async (aiomysql) | Fully async ORM; heavier setup | |

**User's choice:** mysql-connector-python

| Option | Description | Selected |
|--------|-------------|----------|
| Separate servers + CORS | React :3000 → FastAPI :8000; standard setup | ✓ |
| FastAPI serves static React build | Single server in prod; complex dev setup | |

**User's choice:** Separate servers + CORS

---

## Connection Setup UI Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full connection form + status pages | React components; prototypes in UI/ as reference | ✓ |
| Backend API only | Phase 1 is just the endpoint; frontend comes in Phase 3 | |

**User's choice:** Full connection form + status pages

| Option | Description | Selected |
|--------|-------------|----------|
| React components | Build from scratch; use HTML prototypes as visual reference | ✓ |
| Keep plain HTML for Phase 1 | Use existing UI/ files with fetch(); migrate later | |

**User's choice:** React components

| Option | Description | Selected |
|--------|-------------|----------|
| Redirect to dashboard | Brief success flash then auto-redirect | ✓ |
| Stay on connection success page | User clicks button to continue | |

**User's choice:** Redirect to dashboard

| Option | Description | Selected |
|--------|-------------|----------|
| 3 fields: Base URL + Email + API Token | Matches JIRA-01 exactly | ✓ |
| 4 fields: add Project Key | Mixes connection setup with project selection (Phase 3) | |

**User's choice:** 3 fields

---

## Error Handling Shape

| Option | Description | Selected |
|--------|-------------|----------|
| 3 cases: invalid credentials + unreachable host + timeout | Covers real-world failure modes | ✓ |
| Just invalid credentials | Simpler; gives confusing messages for wrong URL | |

**User's choice:** 3 cases

| Option | Description | Selected |
|--------|-------------|----------|
| JSON with code + message | `{"ok": false, "error": "...", "message": "..."}` HTTP 400 | ✓ |
| HTTP status only | 401/503/408; frontend infers message | |

**User's choice:** JSON with code + message

| Option | Description | Selected |
|--------|-------------|----------|
| Edit and retry inline | Error on form; fields stay filled; no page navigation | ✓ |
| Redirect to connection-failed page | Matches jira-connection-failed.html prototype | |

**User's choice:** Edit and retry inline

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-verify on load + skip form if valid | Valid saved creds → skip to dashboard | ✓ |
| Always show connection form first | User must click through every time | |

**User's choice:** Auto-verify on load

---

## Claude's Discretion

- Connection test timeout value
- Fernet key management approach
- React component names and file structure
- Loading/spinner state during connection test

## Deferred Ideas

- `jira-connection-failed.html` as separate page — Phase 1 uses inline error instead
- Project key field on connection form — Phase 3 scope (PROJ-01)
- Auto-sync / scheduled refresh — v2 requirement (AUTO-01)
