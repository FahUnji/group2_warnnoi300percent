---
phase: 02-data-sync
plan: 01
subsystem: api
tags: [fastapi, sqlite, jira, oauth, fernet, requests, asyncio]

# Dependency graph
requires:
  - phase: 01-jira-connection
    provides: OAuth token stored in oauth_tokens table (access_token_enc, cloud_id) + Fernet _decrypt_token helper
provides:
  - bugs table in SQLite with 10 columns and UNIQUE(issue_id, project_key) constraint
  - JiraSyncService with sync_bugs(project_key) and list_projects() async methods
  - POST /api/sync/{project_key} endpoint — fetches Bug-type issues from Jira, upserts into bugs table
  - GET /api/projects endpoint — lists accessible Jira projects for the project picker
affects: [03-dashboard-ui, 04-sprint-report]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - asyncio.run_in_executor for blocking HTTP and DB calls inside async FastAPI routes
    - DELETE+INSERT upsert strategy per project_key for SQLite sync
    - Fernet-encrypted OAuth token loaded via load_oauth_token() + _decrypt_token()
    - All SQL uses sqlite3 '?' parameterized queries — no f-string SQL interpolation

key-files:
  created:
    - backend/services/jira_sync_service.py
    - backend/routers/sync.py
  modified:
    - backend/database.py
    - backend/main.py

key-decisions:
  - "D-02: Use OAuth access token + cloud_id from oauth_tokens table — no Basic Auth, no jira_config"
  - "D-04: JiraSyncService is a standalone class; does not extend JiraService"
  - "D-07: Sync endpoint is POST /api/sync/{project_key} with prefix /api on router"
  - "D-08: JQL = project = {project_key} AND issuetype = Bug ORDER BY created DESC, maxResults=1000"
  - "D-09: bugs table columns: id, issue_id, issue_key, project_key, summary, status, priority, sprint_name, assignee, synced_at"
  - "D-10: Upsert via DELETE+INSERT per project_key using parameterized queries"
  - "D-11: sprint_name extracted from customfield_10020[0]['name'] or None"

patterns-established:
  - "JiraSyncService pattern: blocking _fetch_*() and _store_*() functions + async class methods using run_in_executor"
  - "Sync router pattern: APIRouter(prefix='/api') with service instantiation inside route handlers"
  - "Security: access_token decrypted in-memory only, never logged, never in error messages"

requirements-completed: [SYNC-01, SYNC-02, SYNC-03]

# Metrics
duration: 15min
completed: 2026-05-12
---

# Phase 2 Plan 01: Backend Sync Layer Summary

**SQLite bugs table + JiraSyncService with OAuth token auth, DELETE+INSERT upsert, and POST /api/sync/{project_key} + GET /api/projects FastAPI endpoints**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-12T12:46:00Z
- **Completed:** 2026-05-12T13:01:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added `bugs` table to `database.py` init_db() with all 10 columns (id, issue_id, issue_key, project_key, summary, status, priority, sprint_name, assignee, synced_at) and UNIQUE(issue_id, project_key) constraint
- Created `JiraSyncService` with `sync_bugs(project_key)` and `list_projects()` async methods using asyncio.run_in_executor for blocking HTTP/DB calls; Jira Cloud API accessed via OAuth access_token (loaded from oauth_tokens table, decrypted with Fernet)
- Created `backend/routers/sync.py` with `POST /api/sync/{project_key}` and `GET /api/projects` endpoints; registered sync router in main.py

## Task Commits

Each task was committed atomically:

1. **Task 1: Add bugs table migration and create JiraSyncService** - `195e29c` (feat)
2. **Task 2: Create sync router and register in main.py** - `756c468` (feat)

## Files Created/Modified
- `backend/database.py` - Added `CREATE TABLE IF NOT EXISTS bugs` DDL inside existing init_db() try block
- `backend/services/jira_sync_service.py` - New file: JiraSyncService class with _fetch_bugs, _store_bugs, _fetch_projects blocking helpers and async sync_bugs/list_projects methods
- `backend/routers/sync.py` - New file: FastAPI router with POST /api/sync/{project_key} and GET /api/projects endpoints
- `backend/main.py` - Added `sync` to router import line and `app.include_router(sync.router)`

## Decisions Made
- Router uses `prefix="/api"` (not `/api/sync`) so both `/api/sync/{project_key}` and `/api/projects` can be served by the same router — this was specified in the plan action (vs the PATTERNS.md which showed `/api/sync` prefix only for the sync endpoint)
- sprint_name stored as TEXT or NULL from customfield_10020[0]["name"] per D-11 — raw JSON sprint array not stored
- Upsert approach: DELETE all bugs for project_key then batch-INSERT via executemany — simple and correct for Phase 2 scope (per D-10)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. One false-positive in acceptance check #8 (access_token logging check): grep matched "Never logs" and "never logged" in docstring comments — no actual logging of access_token exists in the code. Verified by manual inspection.

## User Setup Required

None — no external service configuration required beyond the existing FERNET_KEY and OAuth token setup from Phase 1.

## Threat Surface Scan

No new security surface beyond what's declared in the plan's threat_model. All T-02-0x mitigations implemented:
- T-02-01: All SQL uses ? parameterized placeholders (verified via grep)
- T-02-02: access_token decrypted in _get_auth_headers() local variable, never passed to log calls or HTTPException detail
- T-02-03: Error messages use generic codes only (api_error, timeout, unreachable_host) — cloud_id not echoed
- T-02-05: requests.get uses timeout=(5, 30) for search endpoint, (5, 15) for project list

## Next Phase Readiness
- Phase 3 (Dashboard UI) can now query the `bugs` table directly — populated by POST /api/sync/{project_key}
- GET /api/projects is available for the frontend project picker (NoProjectPage)
- POST /api/sync/{project_key} returns `{"ok": true, "synced": N, "project_key": "...", "synced_at": "..."}` for frontend sync button and last-synced display

---
*Phase: 02-data-sync*
*Completed: 2026-05-12*
