---
phase: 04-sprint-report
reviewed: 2026-05-13T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - backend/routers/sync.py
  - backend/services/jira_sprint_service.py
  - frontend/src/pages/BugReportPage.jsx
  - frontend/src/pages/BugReportPage.module.css
  - frontend/src/pages/DashboardPage.jsx
  - frontend/src/pages/DashboardPage.module.css
  - frontend/src/pages/SprintPage.jsx
  - frontend/src/pages/SprintPage.module.css
findings:
  critical: 3
  warning: 6
  info: 3
  total: 12
status: issues_found
---

# Phase 04: Code Review Report (Hotfix Re-review)

**Reviewed:** 2026-05-13
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

These are hotfix changes on top of the Phase 04 sprint-report implementation. The hotfixes
introduce: a `state=active,closed,future` param to the Jira Board Sprint API; a SQL JOIN
rewrite from `sprint_id` to `sprint_name`; graceful stale fallback when Jira is unreachable;
a fire-and-forget sprint sync in the POST `/api/sync` endpoint; and frontend changes to call
`/api/sync` before reading from the local DB across all three page components.

Three blockers were found: an unguarded dictionary key access that raises `KeyError` (and therefore
`500 Internal Server Error`) when `_get_auth_headers` returns an `HTTPException` whose `detail` is
not a dict; a missing `encodeURIComponent` on `projectKey` in `BugReportPage` that allows
path-traversal characters to reach the API; and a stale-banner logic bug that hides the warning
whenever an error is also present, even though the stale data is still being displayed.

---

## Critical Issues

### CR-01: `KeyError` crash when `HTTPException.detail` is a string

**File:** `backend/services/jira_sprint_service.py:235`
**Issue:** Line 235 accesses `exc.detail["error"]` and `exc.detail["message"]` assuming `detail`
is always a dict. `_get_auth_headers()` is documented to raise `HTTPException(status_code=400,
detail={"ok": False, "error": "not_configured", ...})`, so the dict shape is correct in the
normal case. However any caller (present or future) that raises an `HTTPException` with a plain
string `detail` — which is the FastAPI default for e.g. `HTTPException(404, "Not found")` — will
cause a `KeyError` inside the `except` block. Because this executes inside
`loop.run_in_executor(None, ...)` (line 261), the `KeyError` propagates as an unhandled exception
from the thread-pool, surfaces as an `asyncio` unhandled-exception log message, and the coroutine
awaiting the result raises a `concurrent.futures` exception. The endpoint then returns `500`
instead of the intended `400`.

Additionally, the except block only catches `HTTPException`. If `load_oauth_token()` or
`_decrypt_token()` raises any other exception (e.g. `sqlite3.Error`, `ValueError`), it propagates
uncaught through the executor thread.

**Fix:**
```python
except HTTPException as exc:
    cached = _get_sprint_stats(project_key)
    if cached:
        return {"ok": True, "sprints": cached, "synced_at": None, "stale": True}
    detail = exc.detail if isinstance(exc.detail, dict) else {}
    return {
        "ok": False,
        "error": detail.get("error", "not_configured"),
        "message": detail.get("message", "Jira is not configured."),
    }
except Exception:
    cached = _get_sprint_stats(project_key)
    if cached:
        return {"ok": True, "sprints": cached, "synced_at": None, "stale": True}
    return {"ok": False, "error": "not_configured", "message": "Failed to load Jira credentials."}
```

---

### CR-02: Missing `encodeURIComponent` on `projectKey` in `BugReportPage` — path traversal / wrong API call

**File:** `frontend/src/pages/BugReportPage.jsx:78`
**Issue:** The sync call is built as:
```js
await fetch(`/api/sync/${projectKey}`, { method: 'POST' }).catch(() => {});
```
`projectKey` comes directly from `useSearchParams().get('project')` (line 40) with no sanitisation
before insertion into the URL path. A crafted URL such as
`/bug-report?project=PROJ%2F..%2Finternal` would cause the fetch to hit
`/api/sync/PROJ/../internal`, potentially routing to a different backend endpoint. Even without
deliberate abuse, a project key containing special characters (which the backend validator rejects
anyway) will silently fail via the `.catch(()=>{})` swallow and then proceed to read stale local
data without the user knowing the sync was skipped.

The `SprintPage` equivalent (line 64) correctly uses `encodeURIComponent`, but `BugReportPage`
does not. The bug read on the line immediately after (line 79) also lacks encoding.

**Fix:**
```jsx
await fetch(`/api/sync/${encodeURIComponent(projectKey)}`, { method: 'POST' }).catch(() => {});
const r = await fetch(`/api/bugs/${encodeURIComponent(projectKey)}`);
```
Apply `encodeURIComponent` to all dynamic path segments (lines 78 and 79).

---

### CR-03: Stale banner hidden when error is also present — stale data silently displayed

**File:** `frontend/src/pages/SprintPage.jsx:426`
**Issue:** The stale banner condition is:
```jsx
{stale && !error && (
  <div className={styles.staleBanner} ...>Showing cached data...</div>
)}
```
If a previous load succeeded with `stale: true` (setting both `stale=true` and populating
`sprints`), and a subsequent "Refresh Data" click triggers a network error (setting `error`),
the `sprints` state is never cleared and the old stale data remains visible. The `!error` guard
then hides the stale banner. The user sees outdated sprint data with no indication it is stale
and a generic network error that implies zero data is loaded.

Separately, `setStale(false)` is never called at the start of `fetchSprints`, so stale state
from a previous call persists into the next call while loading is in progress.

**Fix:** Reset `stale` at the start of every fetch, and render the banners independently:
```jsx
async function fetchSprints() {
  setLoading(true);
  setError('');
  setStale(false);  // reset at start of every fetch
  // ...
}
```
And in the render:
```jsx
{error && <div className={styles.errorBanner} role="alert">{error}</div>}
{stale && (
  <div className={styles.staleBanner} role="status">
    Showing cached data — could not reach Jira. Click Refresh Data to retry.
  </div>
)}
```

---

## Warnings

### WR-01: `_fetch_sprint_list` pagination has no max-page guard — potential infinite loop

**File:** `backend/services/jira_sprint_service.py:97`
**Issue:** The pagination loop in `_fetch_sprint_list` terminates only when
`data.get("isLast", True)` is truthy or the page is empty. The default value `True` means: if
Jira omits `isLast` from the response (which some API versions or board configurations do), the
loop exits after the first page — silently returning a partial result. Conversely, a Jira instance
that always returns `"isLast": false` with non-empty pages would spin indefinitely, blocking
the thread-pool thread and causing all subsequent sprint requests to queue behind it.

**Fix:** Add an explicit page cap:
```python
MAX_PAGES = 200  # 200 * 50 = 10,000 sprints
page_count = 0
while True:
    # ... fetch page ...
    page_count += 1
    if data.get("isLast", True) or not page or page_count >= MAX_PAGES:
        break
    start_at += len(page)
```

---

### WR-02: Sprint sync errors in `trigger_sync` are silently discarded with no logging

**File:** `backend/routers/sync.py:41-44`
**Issue:** The sprint sync added in this hotfix swallows all exceptions silently:
```python
try:
    await _JiraSprintService().get_sprints(project_key)
except Exception:
    pass
```
While the intent (non-fatal for the bug sync response) is correct, swallowing without logging
means genuine configuration errors and unexpected exceptions leave no diagnostic trace. If the
sprint DB state is partially corrupted by a crash midway through `_upsert_sprints`, there is no
way to know.

**Fix:**
```python
import logging
_log = logging.getLogger(__name__)

try:
    await _JiraSprintService().get_sprints(project_key)
except Exception as exc:
    _log.warning("Sprint sync failed for %s (non-fatal): %s", project_key, exc)
```

---

### WR-03: `handleSyncProject` does not encode `key` and does not surface sync failure to the user

**File:** `frontend/src/pages/DashboardPage.jsx:211`
**Issue:** The "Sync now" handler builds the fetch URL without `encodeURIComponent`:
```jsx
await fetch(`/api/sync/${key}`, { method: 'POST' });
```
This is the same class of issue as CR-02. Furthermore, the sync response status is never checked
— if sync fails, the code silently reads from the local DB and updates card stats with stale data,
giving the user no indication that the sync they explicitly requested failed.

**Fix:**
```jsx
const syncResp = await fetch(`/api/sync/${encodeURIComponent(key)}`, { method: 'POST' });
const syncData = await syncResp.json().catch(() => ({}));
if (!syncResp.ok || !syncData.ok) {
  // surface a per-card error or toast notification
}
const r = await fetch(`/api/bugs/${encodeURIComponent(key)}`);
```

---

### WR-04: Sprint sort order puts `future` sprints after all `closed` sprints

**File:** `frontend/src/pages/SprintPage.jsx:73`
**Issue:** The `stateOrder` map is `{ active: 0, closed: 1, future: 2 }`. Upcoming sprints are
therefore sorted below all closed sprints, which could mean hundreds of completed sprints appear
between the active sprint and any planned upcoming sprint. The backend API call was extended to
include `future` sprints in this hotfix, so the intent was clearly to surface them — but the
sort order buries them.

**Fix:**
```js
const stateOrder = { active: 0, future: 1, closed: 2 };
```

---

### WR-05: `_get_sprint_stats` GROUP BY `sprint_id` but JOIN is on `sprint_name` — double-counting when sprint names collide

**File:** `backend/services/jira_sprint_service.py:198`
**Issue:** The SQL query joins `sprints` to `bugs` on `b.sprint_name = s.sprint_name AND
b.project_key = s.project_key` (line 196), but groups only by `s.sprint_id` (line 198). If two
sprints in the same project share the same `sprint_name` (e.g. a sprint was deleted and
re-created with the same name, giving it a new ID), each sprint row will match all bugs with that
name, producing duplicated bug counts per sprint. This is a data-integrity regression introduced
by the JOIN-on-name hotfix.

**Fix:** Include `sprint_name` in the GROUP BY:
```sql
GROUP BY s.sprint_id, s.sprint_name
```
Or, if `bugs.sprint_id` is reliably populated by the sync service, prefer joining on `sprint_id`
to restore uniqueness guarantees.

---

### WR-06: `isDone` in `SprintPage` incorrectly applies "done" styling to `future` sprints

**File:** `frontend/src/pages/SprintPage.jsx:448`
**Issue:**
```jsx
const isDone = !isActive; // covers 'closed' and 'future' — both use gray styles
```
A `future` sprint has `found === 0` and `resolved === 0`, so `calcProgress` returns `0` — no fill
is drawn. However `isDone === true` applies `.progressFillDone` (green) CSS class to the fill
element and `.progressPctFull` (green) to the percentage label. While visually harmless now (0%
is 0% width), the "done" CSS semantics are wrong for a sprint that hasn't started. Any future
CSS change to `.progressFillDone` (e.g. adding an animation) would incorrectly affect upcoming
sprints.

**Fix:**
```jsx
const isActive = s.state === 'active';
const isFuture = s.state === 'future';
const isDone   = s.state === 'closed';
// Apply neutral/gray styling for future sprints, orange-active for active, green for closed
```

---

## Info

### IN-01: `SprintPage` navbar shows hardcoded "BugTrack Pro" instead of real user name

**File:** `frontend/src/pages/SprintPage.jsx:280`
**Issue:** The navbar user button has a hardcoded string:
```jsx
<span className={styles.navUsername}>BugTrack Pro</span>
```
`BugReportPage` and `DashboardPage` both read the user from `sessionStorage` and fall back to
`'Account'`. `SprintPage` has no user state and always shows a placeholder, which is a regression.

**Fix:** Add the same `user` state pattern used in the other pages:
```jsx
const [user, setUser] = useState(() => {
  try { return JSON.parse(sessionStorage.getItem('jira_user') || 'null'); } catch { return null; }
});
// ...
<span className={styles.navUsername}>{user?.name || 'Account'}</span>
```

---

### IN-02: `BugReportPage` search input is decorative — silently ignores user input

**File:** `frontend/src/pages/BugReportPage.jsx:159`
**Issue:** The navbar search input has no `value`, no `onChange` handler, and no search logic.
The placeholder "Search bugs, users, tasks..." implies functionality that does not exist. Input
typed by users is silently discarded.

**Fix:** Either wire the input to filter the bug list, or mark it as non-functional with
`disabled` and `title="Search coming soon"` until implemented, or remove the element.

---

### IN-03: Export buttons in `BugReportPage` and `SprintPage` are no-ops with no user feedback

**File:** `frontend/src/pages/BugReportPage.jsx:270`, `frontend/src/pages/SprintPage.jsx:378`
**Issue:** Export as Word and Export as Excel buttons only close the dropdown on click — there is
no export logic. The buttons have no `disabled` attribute, no `title`, and no visual indication
they are not yet implemented (Phase 05). A user clicking them sees the menu close silently.

**Fix:** Add `disabled` and `title="Export — coming in Phase 05"` to make the non-functional
state explicit, or remove the items until Phase 05 is implemented.

---

_Reviewed: 2026-05-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
