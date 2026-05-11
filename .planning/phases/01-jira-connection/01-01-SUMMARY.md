---
phase: 01-jira-connection
plan: 01
subsystem: api
tags: [fastapi, mysql-connector-python, cryptography, fernet, python-dotenv, uvicorn, pydantic]

# Dependency graph
requires: []
provides:
  - FastAPI app entry point with CORS locked to http://localhost:3000
  - backend/database.py with get_db() reading all DB params from os.environ
  - backend/models/jira_config.py with upsert_config() and load_config()
  - migrations/001_create_jira_config.sql DDL for jira_config table
  - backend/requirements.txt pinning all Phase 1 Python dependencies
  - backend/routers/jira.py stub exposing GET /api/jira/status
affects:
  - 01-jira-connection/plan-02 (builds jira_service.py on top of this scaffold)
  - 01-jira-connection/plan-03 (frontend connects to /api/jira/connect and /api/jira/status)
  - all subsequent phases (all Jira API calls read from jira_config table)

# Tech tracking
tech-stack:
  added:
    - fastapi==0.111.0
    - uvicorn[standard]==0.29.0
    - mysql-connector-python==8.4.0
    - cryptography==42.0.7
    - requests==2.31.0
    - python-dotenv==1.0.1
    - pydantic==2.7.1
  patterns:
    - layered structure: routers/ -> services/ -> models/ (D-05)
    - env-var-only DB credentials via os.environ.get() (D-06, T-01-03)
    - FERNET_KEY from os.environ — KeyError if missing, no silent default (D-03, T-01-04)
    - CORS restricted to http://localhost:3000 only, no wildcard (D-07, T-01-01)
    - parameterized SQL queries via %s placeholders (T-01-07)
    - single-row upsert via ON DUPLICATE KEY UPDATE (D-02)

key-files:
  created:
    - backend/__init__.py
    - backend/database.py
    - backend/models/__init__.py
    - backend/routers/__init__.py
    - backend/services/__init__.py
    - backend/.env.example
    - backend/requirements.txt
    - backend/main.py
    - backend/models/jira_config.py
    - backend/routers/jira.py
    - migrations/001_create_jira_config.sql
  modified: []

key-decisions:
  - "FastAPI chosen over Flask for async support and auto-docs at /docs (D-04)"
  - "mysql-connector-python used synchronously — caller responsible for conn.close() (D-06)"
  - "CORS locked to http://localhost:3000 only — no wildcard origins (D-07)"
  - "FERNET_KEY must be set in env — missing key raises KeyError not silent default (D-03, T-01-04)"
  - "jira_config is single-row table — upsert via ON DUPLICATE KEY UPDATE (D-02)"
  - "All DB credentials via os.environ.get() — no hardcoded values anywhere (T-01-03)"

patterns-established:
  - "get_db() pattern: returns mysql.connector connection; caller must call conn.close()"
  - "upsert_config()/load_config() model layer pattern for single-row config tables"
  - "FastAPI router prefix: /api/jira with tags=['jira']"
  - ".env.example documents all required env vars; .env is gitignored"

requirements-completed:
  - JIRA-01

# Metrics
duration: 2min
completed: 2026-05-11
---

# Phase 01 Plan 01: Jira Connection Backend Scaffold Summary

**FastAPI app with CORS-locked CORS policy, mysql-connector-python get_db(), Fernet-encrypted credential storage model, and jira_config MySQL DDL — all wired through environment variables with no hardcoded credentials**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-11T08:46:37Z
- **Completed:** 2026-05-11T08:48:27Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Created FastAPI backend package scaffold (backend/ with models/, routers/, services/ subpackages) following D-05 layered structure
- Implemented get_db() factory reading all MySQL connection params from os.environ with no hardcoded passwords (T-01-03)
- Created jira_config model with upsert_config()/load_config() using parameterized queries to prevent SQL injection (T-01-07)
- Wrote migrations/001_create_jira_config.sql with api_token_encrypted TEXT column for Fernet storage (D-02, D-03)
- Configured FastAPI with CORS middleware locked strictly to http://localhost:3000, no wildcard (D-07, T-01-01)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create backend project scaffold and database utility** - `868bf9c` (feat)
2. **Task 2: Create jira_config model, SQL migration, and FastAPI app entry point** - `5a0615c` (feat)

## Files Created/Modified

- `backend/__init__.py` - Python package marker
- `backend/database.py` - get_db() connection factory using os.environ
- `backend/models/__init__.py` - Package marker
- `backend/routers/__init__.py` - Package marker
- `backend/services/__init__.py` - Package marker
- `backend/.env.example` - Documents all required env vars (DB_HOST, DB_NAME, DB_USER, DB_PASSWORD, FERNET_KEY)
- `backend/requirements.txt` - Pins all Phase 1 Python dependencies
- `backend/main.py` - FastAPI app with CORS middleware restricted to localhost:3000
- `backend/models/jira_config.py` - upsert_config() and load_config() with ON DUPLICATE KEY UPDATE
- `backend/routers/jira.py` - Stub router: GET /api/jira/status returns not_configured (Plan 02 replaces)
- `migrations/001_create_jira_config.sql` - jira_config DDL with api_token_encrypted TEXT column

## Decisions Made

- CORS locked to `http://localhost:3000` only — `allow_credentials=False`, methods restricted to GET/POST/OPTIONS per D-07 and ASVS L1
- `get_db()` is synchronous; callers must explicitly call `conn.close()` — matches D-06 mysql-connector-python pattern
- load_dotenv called before router import in main.py to ensure env vars available at import time
- Stub router in jira.py created to prevent main.py import crash before Plan 02 is executed

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

Git author identity was not configured in the worktree — set `user.email` and `user.name` via `git config` (local, not global) before first commit.

## User Setup Required

Before running the backend:

1. Copy `backend/.env.example` to `backend/.env` and fill in real values
2. Generate a Fernet key: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`
3. Set `FERNET_KEY=<generated key>` in `backend/.env`
4. Run MySQL migration: `mysql -u root -p < migrations/001_create_jira_config.sql`
5. Install dependencies: `pip install -r backend/requirements.txt`
6. Start server: `uvicorn backend.main:app --reload --port 8000`
7. Verify: `curl http://localhost:8000/health` should return `{"status":"ok"}`

## Next Phase Readiness

- Plan 02 can immediately add `backend/services/jira_service.py` and replace the stub in `backend/routers/jira.py`
- The `jira_config` table DDL is ready to run — Plan 02's connect endpoint will write to it
- All architectural patterns (routers/services/models, get_db, CORS) are established for all future phases

---
*Phase: 01-jira-connection*
*Completed: 2026-05-11*
