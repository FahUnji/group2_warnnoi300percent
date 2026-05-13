# Phase 4: Sprint Report - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a dedicated Sprint Report page (`/sprint?project=KEY`) that displays sprint history for a selected Jira project — showing each sprint's found/resolved bug counts, progress %, severity breakdown (Critical/High/Medium/Low), and ACTIVE/COMPLETED state. Sprint metadata (names, dates, state) is fetched from Jira Board API and cached in SQLite.

</domain>

<decisions>
## Implementation Decisions

### Routing
- **D-01:** Sprint view is a new `/sprint` route — `SprintPage.jsx` — matching the mockup's full-page layout with sidebar. NOT a tab on `/dashboard`.
- **D-02:** Sidebar on sprint page contains: Dashboard, Bug Report, Sprint nav links (Sprint = active). Matches `UI/html/sprint.html` exactly.

### Sprint Data Source
- **D-03:** Sprint metadata comes from Jira Board API — NOT derived from existing `sprint_name` text field.
  - Step 1: Discover board ID — `GET /rest/agile/1.0/board?projectKeyOrId={project_key}` → pick first board.
  - Step 2: Fetch sprint list — `GET /rest/agile/1.0/board/{board_id}/sprint` → returns sprint name, startDate, endDate, state (active/closed/future).
  - Step 3: Store in new `sprints` table: `sprint_id` (Jira ID), `sprint_name`, `state`, `start_date`, `end_date`, `project_key`.
- **D-04:** Bug counts per sprint are derived from existing `bugs` table by grouping on `sprint_name`. Found = total bugs in sprint; Resolved = bugs where status is done/resolved/closed.
- **D-05:** Severity breakdown (Critical/High/Medium/Low) computed from `priority` field in `bugs` table grouped by `sprint_name`.

### Project Context
- **D-06:** Sprint page receives project key via URL query param: `/sprint?project=PROJ_KEY`.
- **D-07:** Dashboard's sidebar Sprint link passes the currently selected/viewed project key in the URL.

### Active Sprint + Caching
- **D-08:** Sprint state sourced from Jira Board API — `state='active'` identifies the active sprint; `state='closed'` = COMPLETED.
- **D-09:** Sprint metadata cached in SQLite `sprints` table on fetch. "Refresh Data" button on sprint page triggers re-fetch via backend endpoint.
- **D-10:** Active sprint card is auto-expanded on page load (collapsed for completed sprints, matching mockup).

### Backend Endpoint
- **D-11:** New endpoint `GET /api/sprints/{project_key}` — fetches Board API, upserts `sprints` table, returns combined sprint list with bug counts and severity breakdown aggregated from `bugs` table.

### Export Stubs
- **D-12:** Export Report dropdown (Word/.docx, Excel/.xlsx) is rendered per mockup but is non-functional — clicking closes menu only. Real export is Phase 5.

### Pagination
- **D-13:** Sprint list pagination is rendered per mockup (Previous / numbered pages / Next) but can be client-side or show-all for MVP (no backend pagination required in Phase 4).

### Claude's Discretion
- Error and empty states (no sprints found, board not found, token expired) — follow same pattern as DashboardPage (resp.ok guards, user-visible error message).
- CSS module naming for SprintPage — follow DashboardPage.module.css conventions.
- Whether board ID is stored in DB or discovered fresh on each sync request.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### UI Mockup (source of truth)
- `UI/html/sprint.html` — complete sprint page mockup; layout, sprint card structure, severity breakdown, export stub, pagination
- `UI/css/sprint.css` — sprint page CSS

### Backend Patterns
- `backend/routers/sync.py` — existing router pattern to follow; endpoint shape, error response format
- `backend/services/jira_sync_service.py` — `_get_auth_headers()`, `_jira_search()`, error mapping; reuse auth and error patterns for Board API calls
- `backend/database.py` — `get_db()` pattern for SQLite access

### Frontend Patterns
- `frontend/src/pages/DashboardPage.jsx` — page structure, CSS module usage, fetch + resp.ok guards, animation patterns to carry forward

### Requirements
- `.planning/REQUIREMENTS.md` — SPRINT-01 (active sprint bugs list), SPRINT-02 (per-sprint history with counts and priority breakdown)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `_get_auth_headers()` in `jira_sync_service.py` — returns `(access_token, cloud_id, base_url)`; use as-is for Board API auth (same OAuth token, different URL path)
- `JiraSyncService` error mapping — `unreachable_host / timeout / invalid_credentials / forbidden / api_error` codes; apply same codes to Board API errors
- `bugs` SQLite table — `sprint_name`, `status`, `priority`, `project_key` fields already available for aggregation; no schema change needed to compute sprint stats

### Established Patterns
- All fetch calls use `resp.ok` guard before parsing JSON (CR-02 fix from Phase 3 — mandatory)
- `Array.isArray()` guard before mapping response arrays
- CSS modules — `DashboardPage.module.css` naming conventions
- Backend endpoints in `sync.py` (prefix `/api`, tag `sync`); new sprint endpoints register on same router

### Integration Points
- `main.py` already imports and includes the sync router — no new router registration needed if sprint endpoint added to `sync.py`
- Sidebar on `/sprint` links back to `/dashboard` (existing route)
- Dashboard sidebar (in DashboardPage.jsx) needs Sprint link added pointing to `/sprint?project={selectedProjectKey}`

</code_context>

<specifics>
## Specific Ideas

- Sprint card left-bar color: green (`bar-active`) for active sprint, gray (`bar-done`) for completed — per mockup CSS classes
- Active sprint badge: `badge-active` (green); completed: `badge-done` (gray)
- Progress bar: green fill for active (`progress-fill`), full gray for completed (`progress-fill-done`) — per mockup
- Severity indicators: Critical=#dc2626, High=#f59e0b, Medium=#eab308, Low=#a5b4fc — per mockup inline styles
- Page subtitle format: `{project_name} · {N} sprints · Last synced {X} min ago`

</specifics>

<deferred>
## Deferred Ideas

- Real export (Word/Excel) — Phase 5
- Filtering sprints by date range or status — v2 backlog (FILT-02)
- Real-time sprint sync / auto-refresh — v2 (AUTO-01)

</deferred>

---

*Phase: 4-sprint-report*
*Context gathered: 2026-05-13*
