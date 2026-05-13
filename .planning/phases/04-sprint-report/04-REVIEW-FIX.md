---
phase: "04"
fixed_at: "2026-05-13T00:00:00Z"
review_path: ".planning/phases/04-sprint-report/04-REVIEW.md"
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 04: Code Review Fix Report

**Fixed at:** 2026-05-13
**Source review:** `.planning/phases/04-sprint-report/04-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (CR-01, CR-02, WR-01 through WR-06; IN-01/IN-02/IN-03 excluded per instruction)
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: JQL Injection

**Files modified:** `backend/services/jira_sync_service.py`, `backend/routers/sync.py`
**Commit:** 939f962
**Applied fix:** Added `_PROJECT_KEY_RE = re.compile(r'^[A-Z][A-Z0-9_]{0,9}$')` and `_validate_project_key()` function in `jira_sync_service.py`. Called it at the start of `_fetch_bugs`. Imported and called the validator in all four router endpoints that accept `project_key` (`trigger_sync`, `get_bugs`, `delete_project`, `get_sprints`), returning HTTP 400 on invalid input.

### CR-02: Orphaned sprints on delete

**Files modified:** `backend/routers/sync.py`
**Commit:** 11149a3
**Applied fix:** Added `DELETE FROM sprints WHERE project_key = ?` before the existing bug and project deletes in the `delete_project` handler. All three deletes run under the same `conn.commit()`.

### WR-01: "Future" sprint labeled "COMPLETED"

**Files modified:** `frontend/src/pages/SprintPage.jsx`
**Commit:** 5d00e28
**Applied fix:** Added `sprintBadgeLabel(state)` helper function that returns `'ACTIVE'`, `'UPCOMING'` (for `future`), or `'COMPLETED'`. Replaced the ternary `{isActive ? 'ACTIVE' : 'COMPLETED'}` with `{sprintBadgeLabel(s.state)}`. Introduced `isDone = !isActive` variable so both `closed` and `future` states use the gray `barDone`/`badgeDone`/`progressFillDone` styles without crashing.

### WR-02: Missing `response.ok` check in handleDeleteProject

**Files modified:** `frontend/src/pages/DashboardPage.jsx`
**Commit:** fba660a
**Applied fix:** Changed `await fetch(...)` to `const resp = await fetch(...)` and added `if (!resp.ok) { return; }` guard immediately after. The existing try/catch wrapper is preserved.

### WR-03: "Bug Report" sidebar link wrong target

**Files modified:** `frontend/src/pages/DashboardPage.jsx`, `frontend/src/pages/SprintPage.jsx`
**Commit:** 171796b
**Applied fix:** Changed the Bug Report `<a href="/dashboard">` to `<a href="#" aria-disabled="true" style={{ opacity: 0.5, pointerEvents: 'none' }} onClick={e => e.preventDefault()}>` in both files. The link is visually dimmed and non-interactive until the `/bugs` route is implemented.

### WR-04: `window.location.search` instead of `useSearchParams`

**Files modified:** `frontend/src/pages/SprintPage.jsx`
**Commit:** 1757359
**Applied fix:** Added `useSearchParams` to the `react-router-dom` import. Replaced `new URLSearchParams(window.location.search).get('project')` with `const [searchParams] = useSearchParams(); searchParams.get('project')`. Updated the sprints fetch `useEffect` dependency array from `[]` to `[projectKey]` and removed the `eslint-disable` comment.

### WR-05: `customfield_10020` no isinstance guard

**Files modified:** `backend/services/jira_sync_service.py`
**Commit:** 610a204
**Applied fix:** Replaced `sprint_name = sprint_raw[0]["name"] if sprint_raw else None` with an `isinstance(sprint_raw, list) and sprint_raw` guard using `.get("name")` for safe key access.

### WR-06: Sprint stats join on `sprint_name` string

**Files modified:** `backend/database.py`, `backend/services/jira_sync_service.py`, `backend/services/jira_sprint_service.py`
**Commit:** f59f864
**Applied fix (requires human verification — schema change):**
- `database.py`: Added `sprint_id INTEGER` column to `CREATE TABLE IF NOT EXISTS bugs`. Added `ALTER TABLE bugs ADD COLUMN sprint_id INTEGER` migration block (wrapped in `try/except OperationalError`) for existing databases.
- `jira_sync_service.py`: Extended the `isinstance` guard block (from WR-05) to also extract `sprint_id = sprint_raw[0].get("id")`. Added `sprint_id` to the row tuple and to the INSERT column list (now 10 placeholders).
- `jira_sprint_service.py`: Changed the LEFT JOIN condition from `b.sprint_name = s.sprint_name` to `b.sprint_id = s.sprint_id` — resolves the string-match fragility when sprint names differ between issues and board API.

## Skipped Issues

None — all in-scope findings were fixed.

---

_Fixed: 2026-05-13_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
