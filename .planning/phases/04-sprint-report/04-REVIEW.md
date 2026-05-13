---
phase: 04-sprint-report
reviewed: 2026-05-13T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - backend/database.py
  - backend/routers/sync.py
  - backend/services/jira_sprint_service.py
  - frontend/src/App.jsx
  - frontend/src/pages/DashboardPage.jsx
  - frontend/src/pages/DashboardPage.module.css
  - frontend/src/pages/SprintPage.jsx
  - frontend/src/pages/SprintPage.module.css
findings:
  critical: 2
  warning: 6
  info: 3
  total: 11
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-05-13
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

This phase adds the Sprint Report page (`SprintPage.jsx`), the `JiraSprintService` backend service, database schema for the `sprints` table, a new `/api/sprints/{project_key}` endpoint, and sidebar navigation links on `DashboardPage`. The core data flow is: fetch board ID from Jira → fetch sprint list → upsert to SQLite → aggregate bug counts and return.

Two blocker-level issues were found: a JQL injection vulnerability that allows an attacker to exfiltrate bugs from arbitrary Jira projects, and a data-loss bug where deleting a project leaves orphaned sprint records in the database. Six additional warnings cover incorrect UI behavior (mislabeled sprint badge, missing error guard on delete, wrong sidebar link target, `window.location` instead of React Router, a CSS layout class applied incorrectly) and a fragile type assumption in the sprint field extraction.

---

## Critical Issues

### CR-01: JQL Injection via Unvalidated `project_key` Path Parameter

**File:** `backend/services/jira_sync_service.py:106`

**Issue:** `project_key` is received from a FastAPI path parameter (user-controlled string) and interpolated directly into a Jira JQL query string without any validation or escaping:

```python
f'project = {project_key} AND issuetype in (Bug, "Bug Task") ORDER BY created DESC'
```

A caller who sends `POST /api/sync/PROJ%20OR%20project%20%3D%20OTHERPROJKEY` (URL-encoded `PROJ OR project = OTHERPROJKEY`) injects additional JQL clauses. This allows the authenticated Jira token to be used to read bugs from projects the caller should not have access to, or to retrieve all bugs across all projects by injecting `OR project in projectsLeadByCurrentUser()`.

The impact is limited to read-only Jira data (the token is already required), but it bypasses the per-project authorization model this dashboard enforces.

**Fix:** Validate that `project_key` matches the Jira project key format before use:

```python
import re

_PROJECT_KEY_RE = re.compile(r'^[A-Z][A-Z0-9_]{0,9}$')

def _validate_project_key(project_key: str) -> None:
    if not _PROJECT_KEY_RE.match(project_key):
        raise ValueError(f"Invalid project key: {project_key!r}")
```

Call this at the top of `_fetch_bugs` (and `_fetch_board_id`) before constructing the JQL string. The same validation should be added at the router level in `sync.py` to reject malformed keys before they reach any service.

---

### CR-02: Orphaned Sprint Records After Project Deletion

**File:** `backend/routers/sync.py:92-106`

**Issue:** `DELETE /api/projects/{project_key}` removes rows from `bugs` and `jira_projects` but does not delete rows from `sprints`:

```python
conn.execute("DELETE FROM bugs WHERE project_key = ?", (project_key,))
conn.execute("DELETE FROM jira_projects WHERE project_key = ?", (project_key,))
# sprints table is never touched
```

Consequence 1: Stale sprint rows accumulate indefinitely. If a project is removed and re-added, `_get_sprint_stats` queries the sprints table for that `project_key`, so old sprint records reappear even if the Jira board has changed.

Consequence 2: `GET /api/sprints/{project_key}` calls `_get_sprint_stats` which queries sprints for a removed project and will return stale data if the project is queried before its sprints are synced.

**Fix:** Add the missing DELETE to the handler:

```python
conn.execute("DELETE FROM sprints WHERE project_key = ?", (project_key,))
conn.execute("DELETE FROM bugs WHERE project_key = ?", (project_key,))
conn.execute("DELETE FROM jira_projects WHERE project_key = ?", (project_key,))
conn.commit()
```

---

## Warnings

### WR-01: "Future" Sprint State Displayed as "COMPLETED" (Incorrect Badge)

**File:** `frontend/src/pages/SprintPage.jsx:420-445`

**Issue:** The badge rendering only differentiates `active` vs. everything else:

```jsx
const isActive = s.state === 'active';
// ...
{isActive ? 'ACTIVE' : 'COMPLETED'}
```

The Jira Agile API returns three states: `active`, `closed`, and `future`. A `future` sprint (not yet started) is displayed as "COMPLETED", which is factually wrong and would mislead QA users into thinking a sprint has already finished.

**Fix:**

```jsx
function sprintBadgeLabel(state) {
  if (state === 'active') return 'ACTIVE';
  if (state === 'future') return 'UPCOMING';
  return 'COMPLETED';
}
// ...
{sprintBadgeLabel(s.state)}
```

The progress bar and color styling (`barActive`/`barDone`) should also handle `future` with a distinct style.

---

### WR-02: `handleDeleteProject` Does Not Check Response Status

**File:** `frontend/src/pages/DashboardPage.jsx:206-229`

**Issue:** The DELETE request response is not checked for `ok` or HTTP status before the UI performs the optimistic removal animation:

```js
await fetch(`/api/projects/${key}`, { method: 'DELETE' });
// No check — if DELETE returns 500, the card is still removed from UI
const remaining = projects.filter(p => p.key !== key);
setRemovingKey(key);
```

If the backend DELETE fails (network error is caught, but a 4xx/5xx response is not), the project card disappears from the UI while the project data persists in the database. On next reload the card reappears, creating a confusing experience.

**Fix:**

```js
const resp = await fetch(`/api/projects/${key}`, { method: 'DELETE' });
if (!resp.ok) {
  setOpenCardMenu(null);
  // surface an error to the user
  return;
}
const remaining = projects.filter(p => p.key !== key);
```

---

### WR-03: "Bug Report" Sidebar Link Navigates to `/dashboard` (Wrong Target)

**File:** `frontend/src/pages/DashboardPage.jsx:488-496`

**Issue:** The "Bug Report" sidebar link points to `/dashboard`:

```jsx
<a href="/dashboard" className={styles.sidebarNavLink}>
  {/* ... */}
  Bug Report
</a>
```

This is a broken navigation item — clicking "Bug Report" keeps the user on the Dashboard. The same issue exists in `SprintPage.jsx:310-318` where the Bug Report link also points to `/dashboard`. If a `/bug-report` or `/bugs` route is not planned for this sprint, the link should either be disabled or removed. Leaving it as `/dashboard` will confuse users who try to navigate to the bug report view.

**Fix:** Either implement the route and update the `href`, or disable the link:

```jsx
<a
  href="/bugs"
  className={styles.sidebarNavLink}
  aria-disabled="true"
  style={{ opacity: 0.5, pointerEvents: 'none' }}
>
  Bug Report
</a>
```

---

### WR-04: `SprintPage` Reads `projectKey` from `window.location` Instead of React Router

**File:** `frontend/src/pages/SprintPage.jsx:7`

**Issue:**

```js
const projectKey = new URLSearchParams(window.location.search).get('project') || '';
```

This is computed once at component initialization, not in a `useState`/`useEffect` or `useSearchParams` hook. The value will not update if the URL changes programmatically (e.g., via `navigate()` or `history.pushState`). It also reads from `window.location.search` directly in the component body, which bypasses React Router's location context and can produce stale results in SSR-compatible setups.

The `useEffect` at line 81 uses an empty dependency array (`[]`) with a comment suppressing the lint warning, which is a sign the stale closure is already known but not fixed.

**Fix:**

```jsx
import { useSearchParams } from 'react-router-dom';

function SprintPage() {
  const [searchParams] = useSearchParams();
  const projectKey = searchParams.get('project') || '';
  // ...
  useEffect(() => {
    if (projectKey) fetchSprints();
    else setLoading(false);
  }, [projectKey]); // remove the eslint-disable comment
```

---

### WR-05: `customfield_10020` Sprint Field Assumes List Type Without Guard

**File:** `backend/services/jira_sync_service.py:119-120`

**Issue:**

```python
sprint_raw = fields.get("customfield_10020")
sprint_name = sprint_raw[0]["name"] if sprint_raw else None
```

The guard `if sprint_raw` only protects against `None` and empty list. The Jira API can return `customfield_10020` as a non-list type (e.g., a dict in older API versions, or a JSON object with nested structure for some configurations). If `sprint_raw` is a non-empty non-list value (e.g., a dict), `sprint_raw[0]` will either raise `TypeError` (dict subscript with int) or return an unexpected character, crashing the sync for the entire project.

**Fix:**

```python
sprint_raw = fields.get("customfield_10020")
if isinstance(sprint_raw, list) and sprint_raw:
    sprint_name = sprint_raw[0].get("name")
else:
    sprint_name = None
```

---

### WR-06: `_get_sprint_stats` Groups by `sprint_id` but Joins on `sprint_name`

**File:** `backend/services/jira_sprint_service.py:187-200`

**Issue:** The SQL query aggregates bug counts by joining on `sprint_name` (string) but groups by `sprint_id`:

```sql
LEFT JOIN bugs b ON b.sprint_name = s.sprint_name AND b.project_key = s.project_key
...
GROUP BY s.sprint_id
```

The `bugs` table records `sprint_name` as the text value extracted from the Jira issue's `customfield_10020` field (set during sync). The `sprints` table records `sprint_name` from the board API. If the two APIs ever return different representations of the same sprint name (e.g., truncation, trailing whitespace, or encoding differences), bugs will be invisibly excluded from the sprint's count. Because there is no foreign key between bugs and sprints, silent zero-count results are the failure mode rather than an error.

**Fix:** Store and join on `sprint_id` in the `bugs` table. This requires adding a `sprint_id` column to `bugs` and populating it during sync by resolving the sprint name to an ID:

```python
# In _store_bugs, after extracting sprint_name, also extract sprint_id:
sprint_id = sprint_raw[0].get("id") if isinstance(sprint_raw, list) and sprint_raw else None
```

Then update the `bugs` schema and the JOIN in `_get_sprint_stats` to use `b.sprint_id = s.sprint_id`.

---

## Info

### IN-01: Redundant Database Migration for `sprints.synced_at`

**File:** `backend/database.py:84-89`

**Issue:** The `CREATE TABLE IF NOT EXISTS sprints` statement at line 65 already includes `synced_at TEXT DEFAULT (datetime('now'))`. The migration block at line 84 attempts to `ALTER TABLE sprints ADD COLUMN synced_at TEXT`, which will always raise `sqlite3.OperationalError` (column already exists) on any fresh install and silently pass. This is dead code on new databases, and only meaningful for databases created before `synced_at` was added to the `CREATE TABLE` statement.

**Fix:** Remove the migration block if it is no longer needed:

```python
# Remove lines 84-89:
# Migration: add synced_at column to sprints if not present
try:
    conn.execute("ALTER TABLE sprints ADD COLUMN synced_at TEXT")
    conn.commit()
except sqlite3.OperationalError:
    pass  # already exists
```

Or keep it only if old databases need to be supported, and add a comment documenting the schema version at which the column was added to the `CREATE TABLE`.

---

### IN-02: `.mainWithSidebar` CSS Class Defined but Never Applied

**File:** `frontend/src/pages/DashboardPage.module.css:1222-1227`

**Issue:** The `.mainWithSidebar` class is defined in the CSS module:

```css
.mainWithSidebar {
  flex: 1;
  overflow-y: auto;
  min-width: 0;
}
```

It is never referenced in `DashboardPage.jsx`. The `mainContent` class (which has `max-width: 1200px; margin: 0 auto`) is applied to the `<main>` element that sits inside the `.layout` flex container alongside `.sidebar`. The `max-width` and `margin: auto` are intended for a full-width centered layout, not a flex child next to a sidebar, which could produce unexpected width behavior at certain viewport sizes.

**Fix:** Apply `.mainWithSidebar` to the `<main>` element inside `.layout`:

```jsx
<main className={`${styles.mainWithSidebar} ...`}>
```

Or remove `.mainWithSidebar` if `.mainContent` styling is intentional.

---

### IN-03: Hardcoded Username "BugTrack Pro" in SprintPage Navbar

**File:** `frontend/src/pages/SprintPage.jsx:263`

**Issue:** The user menu on `SprintPage` displays a hardcoded string instead of the authenticated user's name:

```jsx
<span className={styles.navUsername}>BugTrack Pro</span>
```

`DashboardPage` correctly loads the user from `sessionStorage` and displays `user?.name || 'Account'`. `SprintPage` skips this and always shows "BugTrack Pro", which is a placeholder leftover from development.

**Fix:** Load the user identity the same way `DashboardPage` does:

```jsx
const [user, setUser] = useState(() => {
  try { return JSON.parse(sessionStorage.getItem('jira_user') || 'null'); } catch { return null; }
});
// ...
<span className={styles.navUsername}>{user?.name || 'Account'}</span>
```

---

_Reviewed: 2026-05-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
