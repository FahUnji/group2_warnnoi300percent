# Phase 05: Export - Pattern Map

**Mapped:** 2026-05-13
**Files analyzed:** 5 (1 new, 4 modified)
**Analogs found:** 5 / 5

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/routers/export.py` | router | request-response (binary streaming) | `backend/routers/sync.py` | role-match |
| `backend/main.py` | config | N/A | `backend/main.py` (self) | exact |
| `frontend/src/pages/BugReportPage.jsx` | component | request-response | `frontend/src/pages/SprintPage.jsx` (fetch pattern) | exact |
| `frontend/src/pages/SprintPage.jsx` | component | request-response | `frontend/src/pages/BugReportPage.jsx` (fetch pattern) | exact |
| `backend/requirements.txt` | config | N/A | `backend/requirements.txt` (self) | exact |

---

## Pattern Assignments

### `backend/routers/export.py` (router, request-response / binary streaming)

**Analog:** `backend/routers/sync.py`

**Imports pattern** (`backend/routers/sync.py` lines 16-21):
```python
from fastapi import APIRouter, HTTPException
from backend.database import get_db
from backend.services.jira_sync_service import _validate_project_key
```

New file needs these additions over the analog:
```python
import io
from datetime import date
from fastapi.responses import StreamingResponse
from backend.database import get_db
from backend.services.jira_sync_service import _validate_project_key
```

**Router declaration pattern** (`backend/routers/sync.py` line 22):
```python
router = APIRouter(prefix="/api", tags=["sync"])
```

Export router should use:
```python
router = APIRouter(prefix="/api/export", tags=["export"])
```

**Auth pattern** — IMPORTANT: This project has NO JWT `get_current_user` dependency.
Auth is implicit: the OAuth token is stored in SQLite (`oauth_tokens` table) and loaded
by services. Endpoints have no auth dependency parameter. Match the existing pattern exactly:
```python
# No Depends(get_current_user) — auth is ambient (OAuth token in DB)
# All existing endpoints: no auth dependency parameter on the function signature
@router.get("/bugs/{project_key}")
async def get_bugs(project_key: str):  # no auth dep
```

**Query param validation pattern** (`backend/routers/sync.py` lines 33-37):
```python
try:
    _validate_project_key(project_key)
except ValueError as exc:
    raise HTTPException(status_code=400, detail={"ok": False, "error": "invalid_project_key", "message": str(exc)})
```
Apply this to every export endpoint that accepts `project_key`.

**DB query pattern** (`backend/routers/sync.py` lines 59-67):
```python
conn = get_db()
try:
    rows = conn.execute(
        "SELECT issue_key, summary, status, priority, sprint_name, assignee, synced_at"
        " FROM bugs WHERE project_key = ? ORDER BY issue_key ASC",
        (project_key,),
    ).fetchall()
finally:
    conn.close()
```
For sprint export, filter additionally by `sprint_name`:
```python
rows = conn.execute(
    "SELECT issue_key, summary, status, priority, sprint_name, assignee"
    " FROM bugs WHERE project_key = ? AND sprint_name = ? ORDER BY issue_key ASC",
    (project_key, sprint_name),
).fetchall()
```

**StreamingResponse pattern** — no existing analog in codebase; use FastAPI standard:
```python
buf = io.BytesIO()
# ... write workbook/document to buf ...
buf.seek(0)
filename = f"{project_key}-bug-report-{date.today()}.xlsx"
return StreamingResponse(
    buf,
    media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    headers={"Content-Disposition": f'attachment; filename="{filename}"'},
)
```

Word media type:
```python
media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
```

**Error response shape** — match all existing routers (`backend/routers/sync.py` lines 36-37):
```python
raise HTTPException(
    status_code=400,
    detail={"ok": False, "error": "<code>", "message": "<human text>"},
)
```

**Filename slugify pattern** — no existing analog; implement inline:
```python
import re
slug = re.sub(r'[^a-z0-9]+', '-', sprint_name.lower()).strip('-')
filename = f"{project_key}-{slug}-{date.today()}.xlsx"
```

**Donut chart (matplotlib) pattern** — no existing analog; standard approach:
```python
import io
import matplotlib
matplotlib.use('Agg')  # non-interactive backend — required for server-side
import matplotlib.pyplot as plt

def _make_donut_chart(counts: dict, labels: list, colors: list) -> bytes:
    fig, ax = plt.subplots(figsize=(4, 4))
    values = [counts.get(k, 0) for k in labels]
    ax.pie(values, labels=labels, colors=colors,
           wedgeprops=dict(width=0.5), startangle=90)
    buf = io.BytesIO()
    fig.savefig(buf, format='png', bbox_inches='tight')
    plt.close(fig)
    buf.seek(0)
    return buf.read()
```

---

### `backend/main.py` (config — router registration)

**Analog:** `backend/main.py` (self)

**Exact pattern to copy** (`backend/main.py` lines 27, 56-58):
```python
# Line 27 — import block (add export alongside existing routers):
from backend.routers import jira, auth, sync  # existing
from backend.routers import jira, auth, sync, export  # new

# Lines 56-58 — include_router block (append one line):
app.include_router(jira.router)
app.include_router(auth.router)
app.include_router(sync.router)
app.include_router(export.router)  # add this
```

No other changes to main.py.

---

### `frontend/src/pages/BugReportPage.jsx` (component — wire export stubs)

**Analog:** `frontend/src/pages/SprintPage.jsx` and self

**Existing export button stubs** (`BugReportPage.jsx` lines 274-299):
```jsx
// Word button — currently a no-op:
<button className={styles.exportItem} onClick={() => setExportOpen(false)}>

// Excel button — currently a no-op:
<button className={styles.exportItem} onClick={() => setExportOpen(false)}>
```

**Fetch-to-download pattern** — no existing analog in codebase; standard browser pattern:
```jsx
async function handleExport(format) {
  setExportOpen(false);
  setExportLoading(true);
  try {
    const url = `/api/export/bugs/${format}?project_key=${encodeURIComponent(projectKey)}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('Export failed');
    const blob = await r.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    const today = new Date().toISOString().slice(0, 10);
    a.download = `${projectKey}-bug-report-${today}.${format}`;
    a.click();
    URL.revokeObjectURL(href);
  } catch {
    setError('Export failed. Please try again.');
  } finally {
    setExportLoading(false);
  }
}
```

**Loading state pattern** — copy from existing `loading` state in BugReportPage (lines 47, 303):
```jsx
// Add new state alongside existing states (line ~47):
const [exportLoading, setExportLoading] = useState(false);

// Disable Export Report button while in-flight (line ~266):
<button
  className={styles.btnOutline}
  onClick={() => setExportOpen(v => !v)}
  disabled={exportLoading}
  aria-expanded={exportOpen}
>
  {exportLoading ? 'Exporting...' : 'Export Report'}
```

**Wire the stub buttons** — replace `onClick={() => setExportOpen(false)}` on each button:
```jsx
// Word button:
onClick={() => handleExport('docx')}

// Excel button:
onClick={() => handleExport('xlsx')}
```

---

### `frontend/src/pages/SprintPage.jsx` (component — wire export stubs)

**Analog:** `frontend/src/pages/BugReportPage.jsx` (mirror same pattern)

**Key difference from BugReportPage:** Sprint export requires `sprint_name` query param.
The export is for the **currently selected/active sprint** or the sprint the user is
viewing. Since SprintPage shows a list of sprints (not a single selected sprint), the
export button should export the active sprint if present, or the first sprint in the list.

**Existing export button stubs** (`SprintPage.jsx` lines 403-435):
```jsx
// Word button — currently a no-op:
<button className={styles.exportItem} role="menuitem" onClick={() => setExportOpen(false)}>

// Excel button — currently a no-op:
<button className={styles.exportItem} role="menuitem" onClick={() => setExportOpen(false)}>
```

**Fetch-to-download pattern for sprint** (same structure as BugReportPage, different URL):
```jsx
async function handleExport(format) {
  setExportOpen(false);
  // Use active sprint name, or first sprint in list
  const targetSprint = sprints.find(s => s.state === 'active') || sprints[0];
  if (!targetSprint) return;
  setExportLoading(true);
  try {
    const sprintParam = encodeURIComponent(targetSprint.sprint_name);
    const url = `/api/export/sprint/${format}?project_key=${encodeURIComponent(projectKey)}&sprint_name=${sprintParam}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('Export failed');
    const blob = await r.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    const today = new Date().toISOString().slice(0, 10);
    const slug = targetSprint.sprint_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    a.download = `${projectKey}-${slug}-${today}.${format}`;
    a.click();
    URL.revokeObjectURL(href);
  } catch {
    setError('Export failed. Please try again.');
  } finally {
    setExportLoading(false);
  }
}
```

**Loading state pattern** — add alongside existing state declarations (`SprintPage.jsx` lines 18-31):
```jsx
const [exportLoading, setExportLoading] = useState(false);
```

**Disable button while exporting** (line ~392):
```jsx
<button
  className={styles.btnOutline}
  onClick={() => setExportOpen(v => !v)}
  disabled={exportLoading}
  aria-expanded={exportOpen}
  aria-haspopup="true"
>
  {exportLoading ? 'Exporting...' : 'Export Report'}
```

---

### `backend/requirements.txt` (config — add dependencies)

**Analog:** `backend/requirements.txt` (self)

**Current content** (lines 1-6):
```
fastapi==0.111.0
uvicorn[standard]==0.29.0
cryptography==42.0.7
requests==2.31.0
python-dotenv==1.0.1
pydantic==2.7.1
```

**Append these three lines** (no version pins required — use latest compatible):
```
openpyxl
python-docx
matplotlib
```

---

## Shared Patterns

### DB access (apply to all export endpoints)
**Source:** `backend/routers/sync.py` lines 59-67
```python
conn = get_db()
try:
    rows = conn.execute("SELECT ... FROM bugs WHERE project_key = ?", (project_key,)).fetchall()
finally:
    conn.close()
```
Always use `try/finally conn.close()` — `get_db()` returns a raw connection, not a context manager.

### Project key validation (apply to all export endpoints)
**Source:** `backend/routers/sync.py` lines 33-37
```python
try:
    _validate_project_key(project_key)
except ValueError as exc:
    raise HTTPException(status_code=400, detail={"ok": False, "error": "invalid_project_key", "message": str(exc)})
```

### Error detail shape (apply to all export endpoints)
**Source:** `backend/routers/sync.py` line 37 and `backend/routers/jira.py` lines 7-9
```python
# Always use dict detail, never string:
raise HTTPException(status_code=400, detail={"ok": False, "error": "<code>", "message": "<human text>"})
# Frontend reads: err.detail?.message (not err.message) — see CONTEXT.md constraints
```

### Frontend fetch error reading (apply to both page export handlers)
**Source:** `frontend/src/pages/SprintPage.jsx` lines 86-90
```jsx
const err = await resp.json().catch(() => ({}));
setError(err.detail?.message || err.message || `HTTP ${resp.status} — request failed.`);
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `backend/routers/export.py` (StreamingResponse) | router | binary streaming | No streaming endpoints exist in codebase yet |
| Export fetch-to-download (frontend) | utility | file I/O | No fetch-to-download pattern exists in codebase yet |
| matplotlib donut chart generation | utility | transform | No chart generation exists in codebase yet |

For these three sub-patterns, use the standard patterns documented in Pattern Assignments above (derived from FastAPI docs + browser File API conventions). No codebase analog to copy from.

---

## Metadata

**Analog search scope:** `backend/routers/`, `backend/services/`, `backend/database.py`, `backend/main.py`, `frontend/src/pages/`
**Files scanned:** 8
**Pattern extraction date:** 2026-05-13
