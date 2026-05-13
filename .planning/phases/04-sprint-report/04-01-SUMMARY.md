---
phase: 04-sprint-report
plan: "01"
subsystem: sprint-report
tags: [sprint, jira-api, sqlite, react, css-modules]
dependency_graph:
  requires: []
  provides: [sprints-table, jira-sprint-service, api-sprints-endpoint, sprint-page-ui]
  affects: [backend/database.py, backend/services/jira_sprint_service.py, backend/routers/sync.py, frontend/src/pages/SprintPage.jsx, frontend/src/pages/SprintPage.module.css]
tech_stack:
  added: []
  patterns: [css-modules, loop.run_in_executor, sqlite-upsert-on-conflict, parameterized-sql]
key_files:
  created:
    - backend/services/jira_sprint_service.py
    - frontend/src/pages/SprintPage.jsx
    - frontend/src/pages/SprintPage.module.css
  modified:
    - backend/database.py
    - backend/routers/sync.py
decisions:
  - "Board ID discovered fresh on each sync request (not stored in DB) — simpler, avoids stale board references"
  - "Export buttons are stubs (setExportOpen(false) only) — real export deferred to Phase 5 per D-12"
  - "Client-side pagination (10 per page) — no backend pagination needed for MVP per D-13"
  - "sprint_name join between bugs and sprints tables used for aggregation — no schema change to bugs table"
metrics:
  duration: "~20 minutes"
  completed_date: "2026-05-13"
  tasks_completed: 3
  files_changed: 5
---

# Phase 4 Plan 1: Sprint Report Vertical Slice Summary

Sprint report vertical slice: SQLite `sprints` table migration, `GET /api/sprints/{project_key}` endpoint calling Jira Board API, and `SprintPage.jsx` with full mockup-faithful UI including collapsible sprint cards, severity breakdown, and export stubs.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | sprints table migration + jira_sprint_service.py | cdf51fb | backend/database.py, backend/services/jira_sprint_service.py |
| 2 | GET /api/sprints/{project_key} endpoint | 562d8f2 | backend/routers/sync.py |
| 3 | SprintPage.jsx + SprintPage.module.css | b362068 | frontend/src/pages/SprintPage.jsx, frontend/src/pages/SprintPage.module.css |

## What Was Built

### Task 1: Database + Service Layer

**backend/database.py** — Added `sprints` table migration inside `init_db()` with schema:
- Columns: `sprint_id`, `sprint_name`, `state`, `start_date`, `end_date`, `project_key`, `synced_at`
- Constraint: `UNIQUE (sprint_id, project_key)` — enables ON CONFLICT upsert
- Migration guard for `synced_at` column (idempotent on re-run)

**backend/services/jira_sprint_service.py** — New service with 5 blocking functions:
- `_fetch_board_id()` — Discovers Jira board ID for a project via Board API
- `_fetch_sprint_list()` — Paginates through all sprints on the board
- `_upsert_sprints()` — Upserts sprint metadata into SQLite with parameterized SQL
- `_get_sprint_stats()` — Aggregates bug counts (found/resolved/critical/high/medium/low) via LEFT JOIN
- `_fetch_sprints_and_store()` — Orchestrates auth → board → sprints → upsert → stats
- `JiraSprintService.get_sprints()` — Async wrapper via `loop.run_in_executor`

Security: access_token used in-memory only; never logged, never returned; all SQL uses `?` parameterized placeholders.

### Task 2: API Endpoint

**backend/routers/sync.py** — Added to existing sync router (no new router registration needed):
- `GET /api/sprints/{project_key}` — calls JiraSprintService, returns HTTP 400 with error code on failure
- Import at file top: `from backend.services.jira_sprint_service import JiraSprintService as _JiraSprintService`
- Error codes documented in docstring: `not_configured | unreachable_host | timeout | invalid_credentials | forbidden | api_error`

### Task 3: Frontend Sprint Page

**frontend/src/pages/SprintPage.jsx** (536 lines):
- Reads project key via `new URLSearchParams(window.location.search).get('project')`
- Fetches `/api/sprints/{projectKey}` on mount and Refresh Data click (resp.ok guard)
- Fetches `/api/projects` to resolve project name (resp.ok guard)
- Auto-expands active sprint on load; toggles expand/collapse via `expandedIds` Set
- Sprint cards: left color bar (active=green, done=gray), ACTIVE/COMPLETED badge, Found/Resolved counts, progress bar with orange/green percentage
- Expanded detail: Bug Severity Distribution with Critical/High/Medium/Low indicators (inline style colors per mockup)
- Export Report dropdown: Word/Excel stubs — `setExportOpen(false)` on click only
- Client-side pagination: 10 sprints per page with ellipsis
- Error banner (`role="alert"`), loading state, empty state, no-project-key state
- User menu with logout handler matching DashboardPage pattern

**frontend/src/pages/SprintPage.module.css** (396 lines):
- CSS module converted from `UI/css/sprint.css` — all property values verbatim
- camelCase class names: `sprintCard`, `barActive`, `barDone`, `badgeActive`, `badgeDone`, `progressFill`, `progressFillDone`, `valResolved`, `severityCards`, `pagination`
- Brand colors preserved: `#1b4332`, `#065b41`, `#dc2626`, `#f59e0b`, `#eab308`, `#a5b4fc`

## Deviations from Plan

None — plan executed exactly as written. All 5 functions, table schema, endpoint contract, and UI mockup behavior implemented as specified.

## Verification Results

- Backend imports cleanly: `from backend.routers.sync import router` confirms `/api/sprints/{project_key}` route registered
- `sprints` table exists in SQLite after `init_db()` (verified via sqlite3 query)
- SprintPage.jsx: 536 lines (>= 200 required); contains `fetchSprints`, `toggleSprint`, `expandedIds`, `exportOpen`, `SPRINTS_PER_PAGE`
- SprintPage.module.css: contains all required class names; 20+ brand color occurrences
- JSX braces/parens balanced (node syntax check)
- Note: Vite build check could not run — `frontend/node_modules` is root-owned empty directory (pre-existing environment constraint, not a code issue)

## Known Stubs

| Stub | File | Note |
|------|------|------|
| Export as Word (.docx) | SprintPage.jsx | Intentional stub per D-12 — real export in Phase 5 |
| Export as Excel (.xlsx) | SprintPage.jsx | Intentional stub per D-12 — real export in Phase 5 |

## Threat Surface Scan

No new security surface introduced beyond what the plan's threat model covers. All mitigations applied:
- T-04-01: `project_key` used only as `?` parameter in SQL and as string param in Jira API URL — no interpolation
- T-04-02: `access_token` never logged, never returned to frontend
- T-04-04: Explicit `timeout=(5, 15)` on all requests; pagination bounded by `isLast` flag
- T-04-06: `UNIQUE(sprint_id, project_key)` constraint + ON CONFLICT UPDATE prevents duplicates

## Self-Check: PASSED

- `backend/services/jira_sprint_service.py` exists: FOUND
- `backend/database.py` contains `CREATE TABLE IF NOT EXISTS sprints`: FOUND
- `backend/routers/sync.py` contains `/api/sprints/{project_key}`: FOUND
- `frontend/src/pages/SprintPage.jsx` exists (536 lines): FOUND
- `frontend/src/pages/SprintPage.module.css` exists: FOUND
- Commits cdf51fb, 562d8f2, b362068 exist in git log: VERIFIED
