# Phase 1: Jira Connection - Context

**Gathered:** 2026-05-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 delivers: a React connection form (base URL, email, API token) that POSTs to a FastAPI endpoint, which validates Jira credentials via Basic Auth REST API call, stores them encrypted in MySQL, and redirects to the dashboard on success. On app load, saved credentials are auto-verified — valid credentials skip the form entirely.

Requirements in scope: JIRA-01 (config), JIRA-02 (authenticate), JIRA-03 (validate + error).

</domain>

<decisions>
## Implementation Decisions

### Credential Entry
- **D-01:** User enters Jira credentials via UI form — fields: `base_url`, `email`, `api_token` (exactly 3 fields, no project key)
- **D-02:** Credentials persisted in MySQL `jira_config` table after first successful connection
- **D-03:** API token encrypted at rest (Fernet/AES) before storing — decrypt only when making Jira API calls

### Backend Framework
- **D-04:** FastAPI (not Flask) — async, auto-docs at `/docs`, type hints with Pydantic
- **D-05:** Layered structure: `backend/routers/` → `backend/services/` → `backend/models/`; Phase 1 adds `routers/jira.py` + `services/jira_service.py` + `models/jira_config.py`
- **D-06:** `mysql-connector-python` for DB access (synchronous, run in FastAPI thread pool via `run_in_executor`)
- **D-07:** Separate dev servers — React on `:3000`, FastAPI on `:8000` — CORS enabled on FastAPI for `localhost:3000`

### Connection Setup UI
- **D-08:** Phase 1 includes full frontend: connection form + inline error state as React components
- **D-09:** Existing `UI/html/` files are visual reference only — React components built from scratch matching that design
- **D-10:** On successful connection: brief success flash then auto-redirect to dashboard
- **D-11:** On failed connection: error shown inline on form, fields preserved except `api_token`, user edits and retries without page navigation

### Error Handling
- **D-12:** 3 error cases detected and distinguished:
  - `invalid_credentials` — Jira returns 401 (wrong email or API token)
  - `unreachable_host` — DNS failure or connection refused (wrong base URL)
  - `timeout` — Jira did not respond within threshold
- **D-13:** Error response shape: `{"ok": false, "error": "<code>", "message": "<human-readable text>"}` with HTTP 400
- **D-14:** On app load, backend auto-verifies saved credentials; if valid → skip form → dashboard; if invalid/expired → connection form with inline error message

### Claude's Discretion
- Connection test timeout value (suggest 10s)
- Fernet key management (suggest `SECRET_KEY` env var, generated once on setup)
- Exact React component names and file structure under `frontend/src/`
- Loading/spinner state during connection test

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — JIRA-01, JIRA-02, JIRA-03 are the Phase 1 requirements; read for acceptance criteria
- `.planning/ROADMAP.md` — Phase 1 goal and phase boundary

### Existing Skill Patterns (adapt to FastAPI)
- `skills/jira-to-mysql/SKILL.md` — MySQL schema for project/user/issue tables; `jira_config` table is new (not in this skill — create it)
- `skills/bug-dashboard/SKILL.md` — Flask API patterns; adapt routes to FastAPI style (use `@router.get`, `@router.post`, Pydantic models)

### UI Visual References
- `UI/html/login.html` — Visual reference for connection form layout (⚠ ignore the "Continue with Atlassian" button — replace with credential form)
- `UI/html/jira-connection-success.html` — Visual reference for success state
- `UI/html/jira-connection-failed.html` — Visual reference for error state (⚠ Phase 1 uses inline error on form, not a separate page)
- `UI/css/login.css`, `UI/css/jira-connection-success.css`, `UI/css/jira-connection-failed.css` — CSS to port to React

### Project Spec
- `SPEC.md` — Project-level spec (⚠ edge cases section #1-6 are from a different project — ignore them; use Requirements section only)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `skills/jira-to-mysql/SKILL.md` MySQL schema: `project`, `user`, `issue`, `issue_label` tables — Phase 1 adds `jira_config` table alongside these
- `skills/bug-dashboard/SKILL.md` Flask route patterns — direct analog for FastAPI router structure

### Established Patterns
- `mysql-connector-python` already in skill code — use `conn = mysql.connector.connect(...)` pattern
- Plain HTML prototypes define the visual design — port CSS variables and layout to React/CSS modules

### Integration Points
- `jira_config` table is the foundation for ALL subsequent phases — every Jira API call in Phases 2-5 reads credentials from this table
- FastAPI app structure (routers/services/models) established in Phase 1 — all later phases add new routers to the same app

</code_context>

<specifics>
## Specific Ideas

- Basic Auth implementation: `import requests; requests.get(f"{base_url}/rest/api/3/myself", auth=(email, api_token))` — a call to `/rest/api/3/myself` is the standard Jira connection test
- Fernet encryption: `from cryptography.fernet import Fernet` — store `FERNET_KEY` in `.env`, encrypt token before INSERT, decrypt before use
- `jira_config` table schema suggestion: `id`, `base_url`, `email`, `api_token_encrypted`, `created_at`, `updated_at` — single-row table (upsert on re-configure)

</specifics>

<deferred>
## Deferred Ideas

- `jira-connection-failed.html` as a separate page — deferred; Phase 1 uses inline error instead
- Project key selection on connection form — belongs in Phase 3 (Project Switcher / PROJ-01)
- Auto-sync / scheduled refresh — v2 requirement (AUTO-01), not Phase 1

</deferred>

---

*Phase: 1-jira-connection*
*Context gathered: 2026-05-11*
