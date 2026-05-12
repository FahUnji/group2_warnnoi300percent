# Phase 2: Data Sync - Context

**Gathered:** 2026-05-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Pull bug data from Jira via REST API using the OAuth access token established in Phase 1, store it in SQLite, and expose it to the frontend. Includes: project selection UI on NoProjectPage, a sync endpoint on the backend, and a sync button on the Dashboard. Produces a populated `bugs` table that Phase 3 (Dashboard UI) will query.

</domain>

<decisions>
## Implementation Decisions

### Storage
- **D-01:** Stay with **SQLite** — no migration to MySQL. REQUIREMENTS.md references to "MySQL" are incorrect; SQLite is the authoritative choice. Update traceability note accordingly.

### Jira API Authentication
- **D-02:** Use **OAuth access token + cloud_id** for all Jira API calls. Load `access_token_enc` + `cloud_id` from `oauth_tokens` table (decrypt with Fernet). Base URL for Jira Cloud API: `https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3/`.
- **D-03:** Do NOT use Basic Auth or `jira_config` table for data sync. That table is legacy from Phase 1 Basic Auth work and should be ignored.

### Service Architecture
- **D-04:** Create a **new `JiraSyncService`** class in `backend/services/jira_sync_service.py`. Single responsibility: fetch bugs from Jira API + write to SQLite. Does not inherit from or extend `JiraService`.

### Project Selection Flow
- **D-05:** **NoProjectPage** shows a list of available Jira projects (fetched from `/rest/api/3/project`). User picks one → project_key + project_url saved to `jira_projects` table → **auto-sync triggers immediately** (with loading spinner) → redirect to `/dashboard` on success.
- **D-06:** Dashboard also has a **manual Sync button** for subsequent syncs. This covers SYNC-01 ("user can trigger manual sync via button").

### Sync Endpoint
- **D-07:** Backend endpoint: `POST /api/sync/{project_key}` — fetches all Bug-type issues for the given project, upserts into `bugs` table, records sync timestamp.
- **D-08:** JQL: `project = {project_key} AND issuetype = Bug ORDER BY created DESC`. No pagination needed for Phase 2 — use `maxResults=1000`.

### Bug Schema (`bugs` table)
- **D-09:** Columns: `id` (autoincrement PK), `issue_id` (Jira numeric ID), `issue_key` (e.g. PROJ-123), `project_key`, `summary`, `status`, `priority`, `sprint_name` (TEXT, nullable), `assignee` (TEXT, nullable), `synced_at` (ISO datetime of sync run).
- **D-10:** `issue_id + project_key` should be UNIQUE to support upsert (DELETE + INSERT per sync run is acceptable for Phase 2 simplicity).

### Sprint Field
- **D-11:** Sprint is stored as `sprint_name TEXT`. Extract from Jira's `customfield_10020` field: take `customfield_10020[0]["name"]` if the array exists and is non-empty, else `NULL`. Do not store raw JSON.

### No Todos Folded
No pending todos were folded into this phase.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 1 Implementation (auth patterns to reuse)
- `.planning/phases/01-jira-connection/01-PLAN-02.md` — Fernet encryption pattern, oauth_tokens table schema, `_get_fernet()` / `_decrypt_token()` helpers
- `backend/models/oauth_token.py` — `load_oauth_token()` function that reads access_token_enc + cloud_id from DB
- `backend/routers/auth.py` — OAuth flow reference; shows how cloud_id is stored

### Requirements
- `.planning/REQUIREMENTS.md` — SYNC-01, SYNC-02, SYNC-03 are the governing requirements for this phase
- `.planning/ROADMAP.md` — Phase 2 success criteria (manual sync button, bugs table populated, sync timestamp recorded)

### Existing Backend Patterns
- `backend/database.py` — `get_db()`, `init_db()`, SQLite connection pattern; new `bugs` table migration goes here
- `backend/services/jira_service.py` — `_test_jira_auth` pattern for reference (HTTP call structure, timeout, error handling)
- `backend/main.py` — router registration pattern; new sync router registers here

### Jira Cloud API
- Jira REST API v3 search endpoint: `GET https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/search`
- Authorization header: `Bearer {access_token}` (not Basic Auth)
- Sprint custom field: `customfield_10020` (array of sprint objects, take `[0]["name"]`)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/models/oauth_token.py` → `load_oauth_token()`: loads the encrypted access_token + cloud_id — call this in JiraSyncService to get auth credentials
- `backend/database.py` → `get_db()`: reuse for all DB operations in sync service
- `backend/services/jira_service.py` → `_get_fernet()` / `_decrypt_token()`: import these helpers directly (do not rewrite)
- `frontend/src/components/LoadingSpinner/`: already exists — use for sync-in-progress state

### Established Patterns
- **Fernet encryption** for any sensitive data at rest — already in `jira_service.py`
- **`asyncio.run_in_executor`** for blocking HTTP/DB calls inside async FastAPI routes — follow `JiraService.test_and_save()` pattern
- **`sqlite3.Row` row factory** for dict-like row access — already in `get_db()`
- **CSS Modules** for component styling — `*.module.css` pattern used across all frontend components

### Integration Points
- `init_db()` in `database.py` — add `bugs` table CREATE IF NOT EXISTS here
- `frontend/src/pages/NoProjectPage.jsx` — add project search/select UI + trigger sync on pick
- `frontend/src/pages/DashboardPage.jsx` — add Sync button + last-synced timestamp display
- `frontend/src/App.jsx` — routing already exists; no new routes needed for Phase 2

</code_context>

<specifics>
## Specific Ideas

- NoProjectPage: call `GET /rest/api/3/project` (via backend proxy) to get project list → show as searchable list or dropdown → user picks → store + sync
- Sync endpoint returns `{"ok": true, "synced": N, "project_key": "...", "synced_at": "..."}` for frontend to display
- Dashboard sync button calls `POST /api/sync/{project_key}` and shows spinner during sync; on success refreshes bug data

</specifics>

<deferred>
## Deferred Ideas

- **Pagination for large projects** (>1000 issues) — `maxResults=1000` is sufficient for Phase 2. Add proper pagination in a future phase if needed.
- **Auto-sync / cron** — v2 requirement (AUTO-01), out of scope for all v1 phases.
- **Sync error recovery** — partial sync failures. Handle gracefully in Phase 2 (show error banner), but no retry logic needed yet.
- **Multiple project sync** — Phase 3 (PROJ-01) adds project switcher. Phase 2 stores bugs per project_key so multi-project works at the data layer already.

</deferred>

---

*Phase: 2-data-sync*
*Context gathered: 2026-05-12*
