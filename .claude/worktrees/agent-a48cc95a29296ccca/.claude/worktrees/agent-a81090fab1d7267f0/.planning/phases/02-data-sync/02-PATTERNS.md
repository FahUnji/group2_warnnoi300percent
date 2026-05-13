# Phase 2: Data Sync - Pattern Map

**Mapped:** 2026-05-12
**Files analyzed:** 5 (3 new, 2 modified)
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/services/jira_sync_service.py` | service | request-response + CRUD | `backend/services/jira_service.py` | exact |
| `backend/routers/sync.py` | router/controller | request-response | `backend/routers/jira.py` | exact |
| `backend/database.py` | config/migration | CRUD | `backend/database.py` (self) | self |
| `frontend/src/pages/NoProjectPage.jsx` | component/page | request-response | `frontend/src/pages/ConnectionPage.jsx` | role-match |
| `frontend/src/pages/DashboardPage.jsx` | component/page | request-response | `frontend/src/pages/DashboardPage.jsx` (self) | self |

---

## Pattern Assignments

### `backend/services/jira_sync_service.py` (service, request-response + CRUD)

**Analog:** `backend/services/jira_service.py`

**Imports pattern** (lines 1-19):
```python
import asyncio
import os

import requests
from cryptography.fernet import Fernet
from fastapi import HTTPException

from backend.database import get_db
from backend.models.oauth_token import load_oauth_token
from backend.services.jira_service import _get_fernet, _decrypt_token
```

Key divergence from analog: do NOT import from `backend.models.jira_config` or use `load_config()`. Use `load_oauth_token()` from `backend/models/oauth_token.py` instead (D-02, D-03).

**Token loading pattern** — from `backend/models/oauth_token.py` lines 26-33:
```python
def load_oauth_token() -> dict | None:
    conn = get_db()
    try:
        cur = conn.execute("SELECT * FROM oauth_tokens ORDER BY id DESC LIMIT 1")
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()
```

Call sequence in `JiraSyncService`:
```python
row = load_oauth_token()          # returns dict with access_token_enc + cloud_id
access_token = _decrypt_token(row["access_token_enc"])
cloud_id = row["cloud_id"]
base_url = f"https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3/"
```

**Async executor pattern** — from `backend/services/jira_service.py` lines 121-133:
```python
async def sync_bugs(self, project_key: str) -> dict:
    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(
        None, _fetch_and_store_bugs, project_key
    )
    if not result["ok"]:
        raise HTTPException(
            status_code=400,
            detail={"ok": False, "error": result["error"], "message": result["message"]},
        )
    return result
```

The blocking HTTP call (`_fetch_bugs`) and blocking DB write (`_store_bugs`) must each be plain functions passed to `run_in_executor`. Never call `requests` or `sqlite3` directly inside an `async def`.

**HTTP call pattern** — from `backend/services/jira_service.py` lines 50-57 (`_test_jira_auth`):
```python
response = requests.get(
    url,
    headers={
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
    },
    timeout=(5, 10),
    verify=True,
)
```

For the Jira search endpoint the URL is:
`https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3/search`
with params `jql`, `maxResults`, `fields`.

**Error handling pattern** — from `backend/services/jira_service.py` lines 74-106:
```python
except requests.exceptions.ConnectionError:
    return {"ok": False, "error": "unreachable_host", "message": "..."}
except requests.exceptions.Timeout:
    return {"ok": False, "error": "timeout", "message": "..."}
except requests.exceptions.HTTPError as exc:
    status = exc.response.status_code if exc.response is not None else 0
    return {"ok": False, "error": "...", "message": f"HTTP {status}"}
except requests.exceptions.RequestException:
    return {"ok": False, "error": "unreachable_host", "message": "..."}
```

**DB write (upsert) pattern** — from `backend/models/oauth_token.py` lines 4-23:
```python
conn = get_db()
try:
    conn.execute("DELETE FROM bugs WHERE project_key = ?", (project_key,))
    conn.executemany(
        "INSERT INTO bugs (...) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        rows,
    )
    conn.commit()
finally:
    conn.close()
```

DELETE + INSERT per sync run is the approved upsert strategy (D-10). Use `conn.executemany()` for batch insert.

**Sprint field extraction** (D-11):
```python
sprint_raw = fields.get("customfield_10020")
sprint_name = sprint_raw[0]["name"] if sprint_raw else None
```

**Return shape** (from CONTEXT.md specifics):
```python
return {
    "ok": True,
    "synced": len(rows),
    "project_key": project_key,
    "synced_at": synced_at,   # ISO datetime string
}
```

---

### `backend/routers/sync.py` (router, request-response)

**Analog:** `backend/routers/jira.py`

**Imports + router declaration** (lines 1-19 of `jira.py`):
```python
from fastapi import APIRouter
from backend.services.jira_sync_service import JiraSyncService

router = APIRouter(prefix="/api/sync", tags=["sync"])
```

**Route handler pattern** (lines 71-84 of `jira.py`):
```python
@router.post("/{project_key}")
async def trigger_sync(project_key: str):
    """
    Fetch all Bug-type issues for project_key from Jira, upsert into bugs table.

    Success: HTTP 200, {"ok": true, "synced": N, "project_key": "...", "synced_at": "..."}
    Failure: HTTP 400, {"ok": false, "error": "<code>", "message": "<human text>"}
    """
    service = JiraSyncService()
    # JiraSyncService.sync_bugs raises HTTPException(400) on failure
    return await service.sync_bugs(project_key)
```

**Router registration** — add to `backend/main.py` lines 27 and 56-57:
```python
# Line 27 — add sync to existing import:
from backend.routers import jira, auth, sync  # noqa: E402

# After existing include_router calls:
app.include_router(sync.router)
```

Pattern: no Pydantic model needed for `/{project_key}` path param (string only). If a request body is ever needed in a future endpoint, copy the `BaseModel` + `@field_validator` pattern from `jira.py` lines 22-68.

---

### `backend/database.py` (MODIFY — add `bugs` table to `init_db()`)

**Analog:** self (`backend/database.py`)

**Existing `init_db()` block to extend** (lines 16-51):
```python
def init_db() -> None:
    """Create tables if they don't exist. Called once on app startup."""
    conn = get_db()
    try:
        # ... existing CREATE TABLE IF NOT EXISTS blocks ...
        conn.execute("""
            CREATE TABLE IF NOT EXISTS bugs (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                issue_id    INTEGER NOT NULL,
                issue_key   TEXT    NOT NULL,
                project_key TEXT    NOT NULL,
                summary     TEXT,
                status      TEXT,
                priority    TEXT,
                sprint_name TEXT,
                assignee    TEXT,
                synced_at   TEXT    NOT NULL,
                UNIQUE (issue_id, project_key)
            )
        """)
        conn.commit()
    finally:
        conn.close()
```

Append the `bugs` CREATE TABLE block before the existing `conn.commit()` call (line 49). Do not create a new `conn` or new `try/finally` block — stay inside the existing one.

Column spec matches D-09 exactly:
- `id` — autoincrement PK
- `issue_id` — Jira numeric ID (INTEGER)
- `issue_key` — e.g. PROJ-123 (TEXT)
- `project_key` — TEXT NOT NULL
- `summary`, `status`, `priority` — TEXT
- `sprint_name` — TEXT nullable (D-11)
- `assignee` — TEXT nullable
- `synced_at` — ISO datetime TEXT NOT NULL
- UNIQUE constraint on `(issue_id, project_key)` (D-10)

---

### `frontend/src/pages/NoProjectPage.jsx` (MODIFY — project picker + auto-sync)

**Analog:** `frontend/src/pages/ConnectionPage.jsx`

**State + useEffect pattern** (lines 1-40 of `ConnectionPage.jsx`):
```jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner/LoadingSpinner';
import styles from './NoProjectPage.module.css';

// New state vars to add:
const [projects, setProjects] = useState([]);
const [selectedKey, setSelectedKey] = useState('');
const [syncing, setSyncing] = useState(false);
const [syncError, setSyncError] = useState('');
const navigate = useNavigate();
```

**Async fetch + navigate pattern** (lines 29-39 of `ConnectionPage.jsx`):
```jsx
useEffect(() => {
  fetch('/api/projects')          // backend proxy → GET /rest/api/3/project
    .then(r => r.json())
    .then(data => {
      if (data.ok) setProjects(data.projects);
    })
    .catch(() => {});
}, []);
```

**Async POST + navigate on success pattern** (derived from `ConnectionPage.jsx` lines 29-39, adapted):
```jsx
async function handleProjectSelect(projectKey) {
  setSyncing(true);
  setSyncError('');
  try {
    const resp = await fetch(`/api/sync/${projectKey}`, { method: 'POST' });
    const data = await resp.json();
    if (data.ok) {
      navigate('/dashboard', { replace: true });
    } else {
      setSyncError(data.message || 'Sync failed');
    }
  } catch {
    setSyncError('Network error — please try again.');
  } finally {
    setSyncing(false);
  }
}
```

**Loading spinner usage** (from `LoadingSpinner.jsx`):
```jsx
import LoadingSpinner from '../components/LoadingSpinner/LoadingSpinner';

// Render during sync:
{syncing && <LoadingSpinner size={24} />}
```

**CSS Modules pattern** (used across all pages — `NoProjectPage.module.css` already exists):
```jsx
import styles from './NoProjectPage.module.css';
// Use: className={styles.someClass}
```

The existing `handleConnect` form (URL input) should be **replaced** with a project list/dropdown UI. The `projectUrl` state can be removed. Keep the existing `user`, `showMenu`, `menuRef`, and `handleLogout` state — those are unchanged.

---

### `frontend/src/pages/DashboardPage.jsx` (MODIFY — sync button + last-synced timestamp)

**Analog:** self (`DashboardPage.jsx`) + `ConnectionPage.jsx` async pattern

**Existing state to preserve** (lines 1-19 of `DashboardPage.jsx`):
```jsx
import { useState, useEffect } from 'react';
// existing: user state + useEffect auth check + handleLogout
```

**New state to add:**
```jsx
const [syncing, setSyncing] = useState(false);
const [syncError, setSyncError] = useState('');
const [lastSynced, setLastSynced] = useState(null);
const [projectKey, setProjectKey] = useState('');
```

**Manual sync handler pattern** (modelled on `ConnectionPage.jsx` fetch pattern, lines 29-39):
```jsx
async function handleSync() {
  if (!projectKey || syncing) return;
  setSyncing(true);
  setSyncError('');
  try {
    const resp = await fetch(`/api/sync/${projectKey}`, { method: 'POST' });
    const data = await resp.json();
    if (data.ok) {
      setLastSynced(data.synced_at);
      // trigger bug data refresh here
    } else {
      setSyncError(data.message || 'Sync failed');
    }
  } catch {
    setSyncError('Network error — please try again.');
  } finally {
    setSyncing(false);
  }
}
```

**Sync button + timestamp render pattern:**
```jsx
<button onClick={handleSync} disabled={syncing}>
  {syncing ? <LoadingSpinner size={16} /> : 'Sync'}
</button>
{lastSynced && <span>Last synced: {new Date(lastSynced).toLocaleString()}</span>}
{syncError && <p style={{ color: '#dc2626' }}>{syncError}</p>}
```

**LoadingSpinner import** (same as NoProjectPage):
```jsx
import LoadingSpinner from '../components/LoadingSpinner/LoadingSpinner';
```

The `projectKey` must be resolved from wherever the active project is stored — either from `sessionStorage`, a call to `/api/projects/active`, or passed via router state. Planner should decide the mechanism; the fetch/state pattern above is the same regardless.

---

## Shared Patterns

### Token Decryption
**Source:** `backend/services/jira_service.py` lines 22-35 + `backend/routers/auth.py` lines 140-144
**Apply to:** `jira_sync_service.py` — do NOT rewrite `_get_fernet` / `_decrypt_token`; import them directly.
```python
from backend.services.jira_service import _get_fernet, _decrypt_token

access_token = _decrypt_token(row["access_token_enc"])
```

### DB Connection (get_db + try/finally close)
**Source:** `backend/models/oauth_token.py` lines 26-33 (canonical usage pattern)
**Apply to:** `jira_sync_service.py` (DB write function), any new model functions
```python
conn = get_db()
try:
    # ... queries ...
    conn.commit()
finally:
    conn.close()
```
Never use a context manager (`with`) — existing code uses explicit `try/finally` with `conn.close()`.

### HTTPException Error Shape
**Source:** `backend/services/jira_service.py` lines 124-129
**Apply to:** `jira_sync_service.py` `sync_bugs()` method
```python
raise HTTPException(
    status_code=400,
    detail={"ok": False, "error": result["error"], "message": result["message"]},
)
```

### asyncio.run_in_executor for Blocking I/O
**Source:** `backend/services/jira_service.py` lines 121-123
**Apply to:** `jira_sync_service.py` — both the HTTP fetch and the DB write are blocking; each must be wrapped.
```python
loop = asyncio.get_running_loop()
result = await loop.run_in_executor(None, _blocking_function, arg1, arg2)
```

### sessionStorage User Hydration
**Source:** `frontend/src/pages/DashboardPage.jsx` lines 4-19 + `NoProjectPage.jsx` lines 5-22
**Apply to:** Both pages already implement this; keep unchanged when modifying.
```jsx
const [user, setUser] = useState(() => {
  try { return JSON.parse(sessionStorage.getItem('jira_user') || 'null'); } catch { return null; }
});
```

### CSS Modules
**Source:** All frontend pages and components use `*.module.css`
**Apply to:** No new CSS files need to be created for Phase 2 modifications — extend existing `NoProjectPage.module.css` and `DashboardPage.jsx` inline styles.

---

## No Analog Found

All files have analogs. No entries.

---

## Metadata

**Analog search scope:** `backend/services/`, `backend/routers/`, `backend/models/`, `backend/database.py`, `frontend/src/pages/`, `frontend/src/components/`
**Files scanned:** 10 source files read directly
**Pattern extraction date:** 2026-05-12
