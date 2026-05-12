---
phase: 02-data-sync
verified: 2026-05-12T06:02:00Z
status: complete
score: 8/8 must-haves verified
overrides_applied: 0
re_verification: false
human_verification:
  - test: "Open the app, land on NoProjectPage, verify a scrollable list of real Jira projects appears (not a blank list or error)"
    expected: "Projects list renders with project name and key badge for each accessible Jira project; loading spinner shows briefly then resolves"
    why_human: "Cannot call the live Jira OAuth token from verification environment; requires a browser connected to a live Jira Cloud account"
  - test: "Click a project row — verify the sync status bar shows 'Syncing {PROJECT_NAME}…' with spinner, then navigates to /dashboard"
    expected: "Sync status bar appears immediately on click; after successful POST /api/sync/{project_key}, page navigates to /dashboard within ~500ms"
    why_human: "End-to-end flow requires a live Jira Cloud API call and OAuth token in the DB"
  - test: "On DashboardPage, click 'Sync Now' — verify button shows spinner + 'Syncing…' label, then 'Last synced: {formatted timestamp}' updates"
    expected: "Button is disabled and shows loading state during in-flight request; lastSynced updates to the synced_at value from the API response; 'Sync complete' message appears then disappears after 2 seconds"
    why_human: "Requires live backend and Jira OAuth token; timestamp formatting (toLocaleString) is locale-dependent and must be visually confirmed"
  - test: "Navigate directly to /dashboard without going through NoProjectPage — verify no-project warning banner appears"
    expected: "Role=alert banner reads 'No project selected.' with a link back to /no-project; Sync Now button is disabled (not-allowed cursor)"
    why_human: "Session state behavior (empty sessionStorage) must be verified in a browser"
---

# Phase 2: Data Sync Verification Report

**Phase Goal:** Enable manual Jira data sync — users can select a Jira project, trigger a sync that fetches bug-type issues from Jira Cloud API via OAuth and upserts them into SQLite, and re-sync from the Dashboard.
**Verified:** 2026-05-12T06:02:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | POST /api/sync/{project_key} fetches Bug-type issues and returns {ok, synced, project_key, synced_at} | VERIFIED | `sync.py` line 23–32: `@router.post("/sync/{project_key}")` calls `service.sync_bugs(project_key)` which returns the exact dict shape. Route registered at `/api/sync/{project_key}` via `prefix="/api"` router in `main.py` line 58. |
| 2 | GET /api/projects returns accessible Jira projects for the frontend project picker | VERIFIED | `sync.py` lines 35–44: `@router.get("/projects")` calls `service.list_projects()` which returns `{"ok": True, "projects": [{key, name}, ...]}`. Registered in `main.py` line 58. |
| 3 | bugs table exists in SQLite with all 10 required columns and UNIQUE(issue_id, project_key) | VERIFIED | `database.py` lines 49–63: `CREATE TABLE IF NOT EXISTS bugs` with id, issue_id, issue_key, project_key, summary, status, priority, sprint_name, assignee, synced_at, and `UNIQUE (issue_id, project_key)`. Called by `init_db()` on startup. |
| 4 | Sync upserts via DELETE+INSERT per project_key so re-syncing replaces stale data | VERIFIED | `jira_sync_service.py` lines 123–129: `conn.execute("DELETE FROM bugs WHERE project_key = ?", (project_key,))` followed by `conn.executemany("INSERT INTO bugs ...")`. Parameterized queries throughout. |
| 5 | access_token loaded from oauth_tokens (Fernet-decrypted), never Basic Auth | VERIFIED | `jira_sync_service.py` line 17: `from backend.models.oauth_token import load_oauth_token`. Line 33: `_decrypt_token(row["access_token_enc"])`. No `Basic` or `Authorization: Basic` anywhere in service. |
| 6 | sprint_name extracted from customfield_10020[0]["name"], stored as TEXT or NULL | VERIFIED | `jira_sync_service.py` lines 96–97: `sprint_raw = fields.get("customfield_10020")` then `sprint_raw[0]["name"] if sprint_raw else None`. `customfield_10020` appears twice (params + extraction). |
| 7 | NoProjectPage fetches /api/projects on mount and triggers auto-sync on project click, navigating to /dashboard | VERIFIED | `NoProjectPage.jsx` lines 45–60: `useEffect` fetches `/api/projects` on mount. Lines 68–92: `handleProjectSelect` sets `active_project_key` in sessionStorage, fires `POST /api/sync/${project.key}`, navigates to `/dashboard` on success. |
| 8 | DashboardPage has Sync Now button (aria-busy, aria-disabled, spinner) and LastSyncedTimestamp that updates from API response | VERIFIED | `DashboardPage.jsx` lines 74–101: button with `aria-busy={syncing}`, `aria-disabled={syncing || !projectKey}`, inline `LoadingSpinner`. Lines 54, 112: `setLastSynced(data.synced_at)` and rendered as `{lastSynced ? new Date(lastSynced).toLocaleString() : 'Never'}`. |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/database.py` | bugs table DDL inside init_db() | VERIFIED | Lines 49–63: complete DDL with all 10 columns and UNIQUE constraint |
| `backend/services/jira_sync_service.py` | JiraSyncService class with sync_bugs() and list_projects() | VERIFIED | Lines 172–216: class with both async methods using run_in_executor |
| `backend/routers/sync.py` | POST /api/sync/{project_key} and GET /api/projects | VERIFIED | Lines 23–44: both routes, router prefix="/api" |
| `backend/main.py` | sync router registered with app.include_router | VERIFIED | Line 27: import includes `sync`; line 58: `app.include_router(sync.router)` |
| `frontend/src/pages/NoProjectPage.jsx` | Project list UI with fetch + auto-sync + navigate | VERIFIED | All wiring confirmed: fetch, handleProjectSelect, sessionStorage, navigate |
| `frontend/src/pages/NoProjectPage.module.css` | New CSS classes: projectList, syncStatusBar, errorBanner | VERIFIED | All three classes present (projectList at line 381, syncStatusBar, errorBanner) |
| `frontend/src/pages/DashboardPage.jsx` | Sync Now button + LastSyncedTimestamp + handleSync | VERIFIED | All three present and wired |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `backend/routers/sync.py` | `backend/services/jira_sync_service.py` | `JiraSyncService().sync_bugs(project_key)` | WIRED | `sync.py` line 18 imports `JiraSyncService`; line 31–32 instantiates and awaits |
| `backend/services/jira_sync_service.py` | `backend/models/oauth_token.py` | `load_oauth_token()` + `_decrypt_token()` | WIRED | Lines 17–18: both imports; line 27: `load_oauth_token()` called in `_get_auth_headers()`; line 33: `_decrypt_token(row["access_token_enc"])` |
| `backend/services/jira_sync_service.py` | `backend/database.py` | `get_db()` inside `_store_bugs()` | WIRED | Line 16: `from backend.database import get_db`; line 120: `conn = get_db()` inside `_store_bugs` |
| `NoProjectPage.jsx useEffect` | `GET /api/projects` | `fetch('/api/projects')` | WIRED | Line 47: `fetch('/api/projects')` → `.then(data => setProjects(data.projects))` on success |
| `NoProjectPage.jsx handleProjectSelect` | `POST /api/sync/{project_key}` | `fetch('/api/sync/${project.key}', {method:'POST'})` | WIRED | Line 75: fetch call; line 77–81: `data.ok` check + `navigate('/dashboard')` on success |
| `DashboardPage.jsx handleSync` | `POST /api/sync/{project_key}` | `fetch('/api/sync/${projectKey}', {method:'POST'})` | WIRED | Line 51: fetch; line 54: `setLastSynced(data.synced_at)` on success |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `NoProjectPage.jsx` | `projects` | `fetch('/api/projects')` → `setProjects(data.projects)` | Yes — data comes from live Jira Cloud API via `_fetch_projects()` → `GET /rest/api/3/project` | FLOWING |
| `NoProjectPage.jsx` | `syncing` / `selectedKey` | `handleProjectSelect` fires `POST /api/sync/${project.key}` | Yes — live Jira search API call + SQLite upsert | FLOWING |
| `DashboardPage.jsx` | `lastSynced` | `handleSync` → `data.synced_at` | Yes — `synced_at` is `datetime.now(timezone.utc).isoformat()` set after real DB write in `jira_sync_service.py` line 192 | FLOWING |
| `DashboardPage.jsx` | `projectKey` | `sessionStorage.getItem('active_project_key')` set by NoProjectPage before sync | Yes — set synchronously before API call on project click (line 71 before fetch on line 75) | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED (requires live Jira OAuth token and running server — cannot verify without external service)

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SYNC-01 | 02-01, 02-02 | User can trigger manual sync via button | SATISFIED | DashboardPage "Sync Now" button (line 74–101) + NoProjectPage auto-sync on project click (lines 68–92) |
| SYNC-02 | 02-01 | Sync fetches all Bug-type issues (fields: ID, summary, status, priority, sprint, assignee) | SATISFIED | `_fetch_bugs()` uses JQL `issuetype = Bug`; params include `summary,status,priority,assignee,customfield_10020`; all fields stored in bugs table |
| SYNC-03 | 02-01 | Synced records stored with sync timestamp | SATISFIED | `synced_at TEXT NOT NULL` column in bugs table; populated with `datetime.now(timezone.utc).isoformat()` on each sync run |

**Note on REQUIREMENTS.md vs ROADMAP.md discrepancy:** REQUIREMENTS.md SYNC-01 and SYNC-03 mention "MySQL" as the storage backend. The ROADMAP.md Phase 2 goal and success criteria explicitly specify "SQLite." The project stack in `CLAUDE.md` also states SQLite. The ROADMAP governs — the REQUIREMENTS.md MySQL reference is a stale artifact from the initial spec before SQLite was chosen. This is not a gap in the implementation.

**PROJ-01** ("User can select from multiple Jira projects via a project list page") is mapped to Phase 3 in REQUIREMENTS.md. Phase 2 delivers the project picker as part of the sync flow (NoProjectPage), which goes beyond the strict Phase 2 scope — but PROJ-01 is a Phase 3 requirement and is already addressed here. No orphaned requirement gap.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/services/jira_sync_service.py` | 51 | `jql = f"project = {project_key} AND issuetype = Bug ORDER BY created DESC"` — f-string with `project_key` in JQL string | Info | `project_key` is interpolated into a JQL query string (not a SQL statement). SQL uses parameterized queries throughout. Jira API accepts JQL as a query param value. Risk: a crafted `project_key` could inject JQL clauses, but Jira's API enforces project access and the threat model explicitly accepts this (T-02-04). Not a blocker. |
| `backend/main.py` | 83 | `background: syncing || !projectKey ? '#1b4332' : '#1b4332'` (both branches identical) | Info | Dead conditional in inline style — both enabled and disabled states have the same background color `#1b4332`. Visual distinction relies on `opacity: 0.7` only. No functional impact. |

No blockers or critical anti-patterns detected. access_token is confirmed not present in any log or error message output. All SQL uses `?` parameterized placeholders.

### Human Verification Required

#### 1. Project Picker Renders Live Jira Projects

**Test:** With a valid OAuth token stored (from Phase 1), navigate to `/no-project`. Observe the project list area.
**Expected:** LoadingSpinner shows briefly; then a scrollable list of Jira projects with project name and key badge renders. If no OAuth token exists, an error banner with `role="alert"` appears.
**Why human:** Cannot call live Jira Cloud API from verification environment. Requires a browser with a running backend and a valid Fernet-encrypted OAuth token in the SQLite DB.

#### 2. Project Click Triggers Auto-Sync and Navigates to Dashboard

**Test:** Click any project row in the NoProjectPage list.
**Expected:** Sync status bar appears showing "Syncing {PROJECT_NAME}…" with a spinner. After ~500ms post-success, the browser navigates to `/dashboard`. `active_project_key` is visible in sessionStorage.
**Why human:** Requires live Jira API call and OAuth session. Navigation timing (500ms delay) needs browser verification.

#### 3. Sync Now Button Behavior on DashboardPage

**Test:** On `/dashboard` (arrived via NoProjectPage flow, so `active_project_key` is set), click "Sync Now."
**Expected:** Button becomes disabled with spinner; label changes to "Syncing…"; after completion, "Last synced: {locale-formatted timestamp}" updates and "Sync complete" message appears then disappears after 2 seconds.
**Why human:** Live API call required. `toLocaleString()` output is locale-dependent.

#### 4. No-Project Warning on Direct Dashboard Navigation

**Test:** Clear sessionStorage and navigate directly to `/dashboard`.
**Expected:** `role="alert"` warning banner appears: "No project selected." with a link to `/no-project`. Sync Now button is disabled (cursor: not-allowed, opacity 0.7).
**Why human:** Browser state manipulation (clearing sessionStorage) required for this test path.

---

## Gaps Summary

No gaps. All 8 must-haves verified against the codebase. All artifacts exist, are substantive, and are wired. Data flow is traceable from frontend fetch calls through backend service to SQLite and back. The 4 ROADMAP success criteria are all implemented:

1. SC1 (manual sync via UI button) — DashboardPage Sync Now + NoProjectPage auto-sync VERIFIED
2. SC2 (bugs table with required fields) — all 10 columns including sprint and assignee VERIFIED
3. SC3 (sync timestamp stored) — `synced_at TEXT NOT NULL` column written on every sync VERIFIED
4. SC4 (dashboard displays most recent sync timestamp) — `lastSynced` state updated from `data.synced_at`, rendered as "Last synced: {timestamp}" VERIFIED

Status is `human_needed` because 4 items require a live browser session with a running backend and valid Jira OAuth token to confirm end-to-end behavior.

---

_Verified: 2026-05-12T06:02:00Z_
_Verifier: Claude (gsd-verifier)_
