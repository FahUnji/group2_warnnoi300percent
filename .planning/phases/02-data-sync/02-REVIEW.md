---
phase: 02-data-sync
reviewed: 2026-05-12T06:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - backend/services/jira_sync_service.py
  - backend/routers/sync.py
  - backend/database.py
  - backend/main.py
  - frontend/src/pages/NoProjectPage.jsx
  - frontend/src/pages/NoProjectPage.module.css
  - frontend/src/pages/DashboardPage.jsx
findings:
  critical: 3
  warning: 5
  info: 3
  total: 11
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-05-12T06:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Reviewed the Phase 2 data sync backend (sync service, sync router, database, main app) and frontend
pages (NoProjectPage, DashboardPage). The parameterized SQL and Fernet encryption are applied
correctly. The most serious issues are: an unvalidated `project_key` path parameter that flows
directly into a JQL query string (JQL injection / SSRF-adjacent), a non-atomic delete-then-insert
that risks total data loss on a partial Jira failure, and a silent loss of all sync data when
`issue_id` is `None`. There are also meaningful gaps in error handling, an SSRF-permissive avatar
URL render, and several quality defects.

---

## Critical Issues

### CR-01: `project_key` is never validated — JQL injection via path parameter

**File:** `backend/routers/sync.py:24` / `backend/services/jira_sync_service.py:51`

**Issue:** `project_key` is taken verbatim from the URL path and interpolated directly into the JQL
string sent to Jira:

```python
jql = f"project = {project_key} AND issuetype = Bug ORDER BY created DESC"
```

FastAPI's `str` path parameter accepts any character string. A caller who sends
`POST /api/sync/FOO%20OR%20project%20%3D%20SECRET` would produce:

```
project = FOO OR project = SECRET AND issuetype = Bug ORDER BY created DESC
```

…which silently dumps bugs from an unintended project into the local database. There is no
authentication requirement on the endpoint either (see CR-02), so any local network client can
trigger this. Jira project keys follow a strict format (`[A-Z][A-Z0-9_]+`).

**Fix:** Validate `project_key` in the router before passing it to the service:

```python
import re
from fastapi import APIRouter, HTTPException, Path

PROJECT_KEY_RE = re.compile(r'^[A-Z][A-Z0-9_]{1,9}$')

@router.post("/sync/{project_key}")
async def trigger_sync(project_key: str = Path(...)):
    if not PROJECT_KEY_RE.match(project_key):
        raise HTTPException(
            status_code=400,
            detail={"ok": False, "error": "invalid_project_key",
                    "message": "project_key must match [A-Z][A-Z0-9_]{1,9}."},
        )
    service = JiraSyncService()
    return await service.sync_bugs(project_key)
```

---

### CR-02: Sync and project-list endpoints have no authentication guard

**File:** `backend/routers/sync.py:23-44`

**Issue:** Both `POST /api/sync/{project_key}` and `GET /api/projects` have no authentication
dependency. Any HTTP client on the same machine (or any client that can reach port 8000) can:

- Enumerate all Jira projects accessible to the connected OAuth token.
- Trigger a full sync (write to the local database) for any project key.

The CORS policy in `main.py` only restricts browser-based cross-origin requests; it has no effect
on `curl`, server-side scripts, or any non-browser client. The existing `auth` router patterns
should be inspected for a reusable `require_auth` dependency; if one exists it must be applied here.

**Fix:** Add an auth dependency (matching the pattern used by other routers) to both endpoints:

```python
from backend.dependencies import require_auth   # or equivalent existing dep

@router.post("/sync/{project_key}")
async def trigger_sync(project_key: str, _: None = Depends(require_auth)):
    ...

@router.get("/projects")
async def list_projects(_: None = Depends(require_auth)):
    ...
```

If no session/auth dependency exists yet, at minimum document the gap as a known risk and ensure
the backend never binds to a public interface in production.

---

### CR-03: Non-atomic delete-then-insert causes data loss on partial failure

**File:** `backend/services/jira_sync_service.py:123-133`

**Issue:** `_store_bugs` deletes all rows for `project_key` before inserting the freshly-fetched
list:

```python
conn.execute("DELETE FROM bugs WHERE project_key = ?", (project_key,))
conn.executemany("INSERT INTO bugs ...", rows)
conn.commit()
```

If `executemany` raises (e.g., `rows` contains a duplicate `issue_id` that violates the
`UNIQUE(issue_id, project_key)` constraint, or a `None` issue_id — see WR-01 — triggers an
`IntegrityError`), the `finally` block closes the connection. Because `commit()` was never reached,
SQLite rolls back automatically — but the `DELETE` was part of the same un-committed transaction, so
it is also rolled back. That is actually safe _if_ SQLite's implicit transaction wraps both
statements.

However, the real problem is subtler: SQLite's default isolation mode (`isolation_level=''`) begins
a new implicit transaction on the first DML statement. If `conn.execute("DELETE ...")` commits the
implicit transaction before the `executemany`, then a subsequent exception leaves the bugs table
empty. The `sqlite3` Python module behavior depends on whether `autocommit` is active. Because
`get_db()` does not explicitly set `isolation_level` or call `conn.isolation_level`, the exact
behavior is driver-version-dependent.

The safe fix is to use an explicit transaction so both operations are atomic:

**Fix:**

```python
conn = get_db()
try:
    with conn:   # context manager: BEGIN / COMMIT or ROLLBACK automatically
        conn.execute("DELETE FROM bugs WHERE project_key = ?", (project_key,))
        conn.executemany(
            "INSERT INTO bugs (issue_id, issue_key, project_key, summary,"
            " status, priority, sprint_name, assignee, synced_at)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            rows,
        )
    return len(rows)
finally:
    conn.close()
```

Using `with conn:` guarantees that `DELETE` and `INSERT` are committed together or both rolled back,
regardless of Python sqlite3 version.

---

## Warnings

### WR-01: `None` issue_id causes silent data truncation via `IntegrityError`

**File:** `backend/services/jira_sync_service.py:115-118`

**Issue:** The code casts `issue_id` to `int` but guards only for `None`:

```python
rows = [
    (int(r[0]) if r[0] is not None else None, *r[1:])
    for r in rows
]
```

If any Jira issue has a missing `id` field, `r[0]` is `None` and the cast produces a `None`
`issue_id`. The schema declares `issue_id INTEGER NOT NULL`, so `executemany` will raise an
`IntegrityError` on that row. Because this happens mid-batch and the exception propagates up through
`_store_bugs` (which has no per-row error handling), the entire sync silently fails after the DELETE
has already executed. The caller in `sync_bugs` does not catch `IntegrityError`; FastAPI converts it
to an unhandled 500.

**Fix:** Skip or reject issues with a missing or non-numeric `id` before building `rows`:

```python
rows = []
for issue in issues:
    raw_id = issue.get("id")
    if raw_id is None:
        continue   # or log a warning
    try:
        issue_id = int(raw_id)
    except (ValueError, TypeError):
        continue
    fields = issue.get("fields", {})
    ...
    rows.append((issue_id, ...))
```

---

### WR-02: `sprint_raw[0]` accessed without confirming element is a dict

**File:** `backend/services/jira_sync_service.py:97`

**Issue:**

```python
sprint_raw = fields.get("customfield_10020")
sprint_name = sprint_raw[0]["name"] if sprint_raw else None
```

`sprint_raw` is truthy if it is a non-empty list, but the code does not verify:
1. That `sprint_raw[0]` is a `dict` (Jira sometimes returns the sprint field as a string or
   an object in a different schema version).
2. That `sprint_raw[0]` has a `"name"` key.

A `TypeError` or `KeyError` here propagates as an unhandled 500 from the sync endpoint.

**Fix:**

```python
sprint_raw = fields.get("customfield_10020")
sprint_name = None
if isinstance(sprint_raw, list) and sprint_raw:
    first = sprint_raw[0]
    if isinstance(first, dict):
        sprint_name = first.get("name")
```

---

### WR-03: `maxResults=1000` with no pagination — silently truncates large projects

**File:** `backend/services/jira_sync_service.py:53-54`

**Issue:** The JQL search is capped at `maxResults=1000`. Jira's default server-side cap is also
1000, so projects with more than 1000 bugs will be silently truncated. The sync endpoint returns a
count of inserted rows with no indication that the result set was incomplete, so the caller — and
the user — have no way to know the data is partial.

**Fix:** Either:
- Implement cursor-based pagination using `startAt` and loop until `startAt + len(issues) >= total`.
- Or cap the import at a documented limit and surface a warning field in the response:
  ```python
  "truncated": data.get("total", 0) > len(data.get("issues", []))
  ```

---

### WR-04: `handleProjectSelect` stores project key in `sessionStorage` before sync succeeds

**File:** `frontend/src/pages/NoProjectPage.jsx:71`

**Issue:**

```python
sessionStorage.setItem('active_project_key', project.key);
setSyncing(true);
...
const resp = await fetch(`/api/sync/${project.key}`, { method: 'POST' });
if (data.ok) {
    navigate('/dashboard', ...);
} else {
    setSyncError('...');
    setSelectedKey('');   // visual reset, but sessionStorage is NOT cleared
}
```

If sync fails, `selectedKey` is cleared visually but `active_project_key` in `sessionStorage`
remains set to the failed project's key. A subsequent navigation to `/dashboard` (e.g., back
button, direct URL) will show that project key as active even though no data was synced for it.
`DashboardPage` reads `active_project_key` from `sessionStorage` on mount and will attempt to sync
against a key whose data may be absent or stale.

**Fix:** Clear `sessionStorage` on sync failure:

```javascript
} else {
    sessionStorage.removeItem('active_project_key');
    setSyncError('Sync failed. Select the project again to retry.');
    setSelectedKey('');
}
```

---

### WR-05: Avatar URL rendered from Jira API data without sanitization

**File:** `frontend/src/pages/NoProjectPage.jsx:135` / `frontend/src/pages/DashboardPage.jsx:166`

**Issue:**

```jsx
<img src={user.avatar} alt="" ... />
```

`user.avatar` originates from Jira API data stored in `sessionStorage`. Although the Atlassian API
returns HTTPS avatar URLs, the value passes through `sessionStorage` without origin validation. If
an attacker can write to `sessionStorage` (e.g., via XSS on another same-origin page, or a MITM on
HTTP), they can inject an arbitrary `src` URL (including `javascript:` in some older browsers, or
simply cause a tracking pixel request to an attacker-controlled host).

**Fix:** Validate the avatar URL before rendering. At minimum, confirm it starts with `https://`:

```javascript
function safeSrc(url) {
  if (typeof url === 'string' && url.startsWith('https://')) return url;
  return undefined;
}
// Then:
<img src={safeSrc(user.avatar)} alt="" ... />
```

---

## Info

### IN-01: Dead CSS classes with no corresponding JSX usage

**File:** `frontend/src/pages/NoProjectPage.module.css:254-321`

**Issue:** The following CSS classes are defined but never referenced by any JSX element in
`NoProjectPage.jsx`: `.connectRow`, `.inputWrap`, `.inputIcon`, `.connectInput`, `.connectBtn`,
`.connectHint`, `.connectStatus`, `.loading`, `.success`, `.error`. These appear to be leftovers
from a previous text-input design that was replaced by the project-list picker in Phase 2.

**Fix:** Remove the dead CSS classes to avoid confusion about what UI state they represent.

---

### IN-02: `syncing` guard does not prevent concurrent sync calls from `DashboardPage`

**File:** `frontend/src/pages/DashboardPage.jsx:46`

**Issue:** `handleSync` guards with `if (!projectKey || syncing) return;`, but this is a local
component state guard. If the user opens multiple browser tabs on `/dashboard`, each tab maintains
its own `syncing` state. Rapid clicks in a single tab are prevented, but parallel tabs will each
independently POST to `/api/sync/{projectKey}` and race to delete-then-insert the same rows. Given
the non-atomic delete-insert (CR-03), concurrent syncs can interleave deletes and inserts,
corrupting the bugs table. This is an architectural gap that will need a server-side lock or
idempotency key when concurrency matters.

**Fix (short-term):** Document the single-tab assumption. **Fix (long-term):** Add a server-side
sync mutex or advisory lock keyed on `project_key`, or use `INSERT OR REPLACE` instead of
delete-then-insert.

---

### IN-03: Sync button background color is identical in active and disabled states

**File:** `frontend/src/pages/DashboardPage.jsx:83`

**Issue:**

```jsx
background: syncing || !projectKey ? '#1b4332' : '#1b4332',
```

The ternary expression evaluates to the same value in both branches. The disabled visual state is
communicated only via `opacity: 0.7` and `cursor: not-allowed`, but the button color itself gives
no disabled signal. This is a logic dead code remnant — the ternary is meaningless.

**Fix:** Either use a lighter color for the disabled state or remove the ternary:

```jsx
background: '#1b4332',
opacity: syncing || !projectKey ? 0.7 : 1,
```

---

_Reviewed: 2026-05-12T06:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
