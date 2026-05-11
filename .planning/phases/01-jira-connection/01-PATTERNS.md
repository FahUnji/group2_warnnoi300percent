# Phase 1: Jira Connection - Pattern Map

**Mapped:** 2026-05-11
**Files analyzed:** 12 new files (no existing codebase — new project)
**Analogs found:** 12 / 12 (all from skills/ and UI/ reference materials)

---

## File Classification

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `backend/routers/jira.py` | route | request-response | `skills/bug-dashboard/SKILL.md` Flask routes | role-match |
| `backend/services/jira_service.py` | service | request-response | `skills/jira-to-mysql/SKILL.md` sync logic | role-match |
| `backend/models/jira_config.py` | model | CRUD | `skills/jira-to-mysql/SKILL.md` schema + upsert | role-match |
| `backend/main.py` | config | request-response | `skills/bug-dashboard/SKILL.md` Flask app setup | partial-match |
| `backend/database.py` | utility | CRUD | `skills/jira-to-mysql/SKILL.md` `conn = mysql.connector.connect(...)` | role-match |
| `backend/.env` | config | file-I/O | none (new pattern) | no-analog |
| `frontend/src/components/ConnectionForm.jsx` | component | request-response | `UI/html/login.html` + `UI/css/login.css` | role-match |
| `frontend/src/components/ConnectionForm.module.css` | config | file-I/O | `UI/css/login.css` | exact |
| `frontend/src/components/SuccessModal.jsx` | component | event-driven | `UI/html/jira-connection-success.html` + `UI/css/jira-connection-success.css` | role-match |
| `frontend/src/components/ErrorInline.jsx` | component | event-driven | `UI/html/jira-connection-failed.html` + `UI/css/jira-connection-failed.css` | role-match |
| `frontend/src/App.jsx` | component | request-response | `UI/html/login.html` structure | partial-match |
| `migrations/001_create_jira_config.sql` | migration | file-I/O | `skills/jira-to-mysql/SKILL.md` schema block | role-match |

---

## Pattern Assignments

### `backend/routers/jira.py` (route, request-response)

**Analog:** `skills/bug-dashboard/SKILL.md` (Flask routes adapted to FastAPI)

**Imports pattern** — adapt Flask `@app.route` to FastAPI `APIRouter`:
```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from backend.services.jira_service import JiraService

router = APIRouter(prefix="/api/jira", tags=["jira"])
```

**Request model pattern** — use Pydantic for body validation (Pydantic replaces Flask's `request.json`):
```python
class JiraConfigRequest(BaseModel):
    base_url: str
    email: str
    api_token: str
```

**Core route pattern** — adapted from `skills/bug-dashboard/SKILL.md` lines 34-39 (`@app.route` → `@router.post`):
```python
@router.post("/connect")
async def connect_jira(payload: JiraConfigRequest):
    service = JiraService()
    result = await service.test_and_save(
        payload.base_url, payload.email, payload.api_token
    )
    return {"ok": True, "message": "Connected successfully"}
```

**Error response pattern** — D-13 shape `{"ok": false, "error": "<code>", "message": "<text>"}` with HTTP 400:
```python
# Raise HTTPException so FastAPI returns correct HTTP status
raise HTTPException(
    status_code=400,
    detail={"ok": False, "error": "invalid_credentials", "message": "Wrong email or API token"}
)
```

**Startup verify route** — D-14 auto-verify on app load:
```python
@router.get("/status")
async def jira_status():
    service = JiraService()
    return await service.verify_saved_credentials()
```

---

### `backend/services/jira_service.py` (service, request-response)

**Analog:** `skills/jira-to-mysql/SKILL.md` Step 3 sync logic (lines 96-159)

**Imports pattern:**
```python
import requests
from cryptography.fernet import Fernet
import os
from backend.database import get_db
from backend.models.jira_config import upsert_config, load_config
```

**Core connection-test pattern** — from CONTEXT.md `<specifics>`:
```python
def _test_jira_auth(base_url: str, email: str, api_token: str) -> dict:
    """Calls /rest/api/3/myself — the standard Jira connection test."""
    try:
        response = requests.get(
            f"{base_url.rstrip('/')}/rest/api/3/myself",
            auth=(email, api_token),
            timeout=10  # D-discretion: 10s timeout
        )
        if response.status_code == 401:
            return {"ok": False, "error": "invalid_credentials",
                    "message": "Wrong email or API token"}
        response.raise_for_status()
        return {"ok": True}
    except requests.exceptions.ConnectionError:
        return {"ok": False, "error": "unreachable_host",
                "message": "Cannot reach Jira. Check your base URL."}
    except requests.exceptions.Timeout:
        return {"ok": False, "error": "timeout",
                "message": "Jira did not respond within 10 seconds."}
```

**Fernet encryption pattern** — from CONTEXT.md `<specifics>`:
```python
def _get_fernet() -> Fernet:
    key = os.environ["FERNET_KEY"]
    return Fernet(key.encode())

def encrypt_token(api_token: str) -> str:
    return _get_fernet().encrypt(api_token.encode()).decode()

def decrypt_token(api_token_encrypted: str) -> str:
    return _get_fernet().decrypt(api_token_encrypted.encode()).decode()
```

**Save credentials pattern** — adapted from `skills/jira-to-mysql/SKILL.md` `upsert_project` (lines 106-112):
```python
async def test_and_save(self, base_url: str, email: str, api_token: str):
    result = self._test_jira_auth(base_url, email, api_token)
    if not result["ok"]:
        raise ValueError(result)  # caller converts to HTTPException
    encrypted = encrypt_token(api_token)
    upsert_config(base_url, email, encrypted)
    return result
```

**Error handling — 3 cases** (D-12):
```python
# Map to error codes per D-12:
# requests.exceptions.ConnectionError  → "unreachable_host"
# response.status_code == 401          → "invalid_credentials"
# requests.exceptions.Timeout          → "timeout"
```

---

### `backend/models/jira_config.py` (model, CRUD)

**Analog:** `skills/jira-to-mysql/SKILL.md` upsert functions (lines 106-124)

**Core upsert pattern** — adapted from `upsert_project` in SKILL.md:
```python
import mysql.connector
from backend.database import get_db

def upsert_config(base_url: str, email: str, api_token_encrypted: str):
    """Single-row table — upsert on re-configure (replaces any prior row)."""
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO jira_config (base_url, email, api_token_encrypted)
        VALUES (%s, %s, %s)
        ON DUPLICATE KEY UPDATE
            base_url=VALUES(base_url),
            email=VALUES(email),
            api_token_encrypted=VALUES(api_token_encrypted),
            updated_at=CURRENT_TIMESTAMP
    """, (base_url, email, api_token_encrypted))
    conn.commit()
    cur.close()
    conn.close()

def load_config() -> dict | None:
    """Return the saved config row, or None if not yet configured."""
    conn = get_db()
    cur = conn.cursor(dictionary=True)
    cur.execute("SELECT * FROM jira_config ORDER BY id DESC LIMIT 1")
    row = cur.fetchone()
    cur.close()
    conn.close()
    return row
```

---

### `backend/database.py` (utility, CRUD)

**Analog:** `skills/bug-dashboard/SKILL.md` `get_db()` function (lines 28-32) and `skills/jira-to-mysql/SKILL.md` connection (lines 100-103)

**Core pattern** — use `mysql.connector.connect` with env vars:
```python
import mysql.connector
import os

def get_db():
    return mysql.connector.connect(
        host=os.environ.get("DB_HOST", "localhost"),
        database=os.environ.get("DB_NAME", "jira_db"),
        user=os.environ.get("DB_USER", "root"),
        password=os.environ.get("DB_PASSWORD", "")
    )
```

---

### `backend/main.py` (config, request-response)

**Analog:** `skills/bug-dashboard/SKILL.md` Flask app setup (lines 22-26) adapted to FastAPI

**Core pattern** — FastAPI app with CORS (D-07) and router registration (D-05):
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routers import jira

app = FastAPI(title="Jira Bug Summary API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # D-07
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(jira.router)
```

---

### `migrations/001_create_jira_config.sql` (migration, file-I/O)

**Analog:** `skills/jira-to-mysql/SKILL.md` schema block (lines 14-67)

**Core pattern** — follow the same CREATE TABLE conventions as the skill schema:
```sql
-- Run once. Single-row config table.
-- id=1 is always the active config; ON DUPLICATE KEY UPDATE replaces it.
CREATE TABLE IF NOT EXISTS jira_config (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  base_url              VARCHAR(500) NOT NULL,
  email                 VARCHAR(255) NOT NULL,
  api_token_encrypted   TEXT         NOT NULL,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                          ON UPDATE CURRENT_TIMESTAMP
);
```

---

### `frontend/src/components/ConnectionForm.jsx` (component, request-response)

**Analog:** `UI/html/login.html` (layout structure) + `UI/css/login.css` (styles to port)

**Layout structure** — from `UI/html/login.html` lines 14-84, replace "Continue with Atlassian" button with 3-field form:
```jsx
// Two-column hero-grid layout (matching login.html lines 15-30)
// Left: .hero-left — tagline, heading, subtext (keep as-is)
// Right: .login-card — replace CTA anchor with controlled form

// Form fields to render (D-01):
// <input name="base_url"   placeholder="https://yourcompany.atlassian.net" />
// <input name="email"      type="email" />
// <input name="api_token"  type="password" />
// <button type="submit">Connect to Jira</button>
```

**Card structure pattern** (from `UI/html/login.html` lines 32-73):
```jsx
<div className={styles.loginCard}>
  <div className={styles.appIconWrap}>
    {/* SVG lightning bolt — login.html lines 37-40 */}
  </div>
  <h2 className={styles.cardTitle}>JIRA Bug Summary</h2>
  <p className={styles.cardSubtitle}>Connect your Jira workspace.</p>
  {/* Error banner slot — D-11, inline, preserves fields except api_token */}
  {error && <ErrorInline code={error.code} message={error.message} />}
  <form onSubmit={handleSubmit}>
    {/* 3 controlled inputs */}
  </form>
  <div className={styles.securityBadge}>
    {/* security-badge content — login.html lines 57-67 */}
  </div>
</div>
```

**Submit + error flow pattern** (D-11, D-13):
```jsx
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);   // { code, message }
const [fields, setFields] = useState({ base_url: '', email: '', api_token: '' });

async function handleSubmit(e) {
  e.preventDefault();
  setLoading(true);
  setError(null);
  try {
    const res = await fetch('http://localhost:8000/api/jira/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields)
    });
    const data = await res.json();
    if (!res.ok) {
      // D-11: preserve all fields except api_token on error
      setFields(prev => ({ ...prev, api_token: '' }));
      setError(data.detail);   // FastAPI error shape
    } else {
      onSuccess();  // D-10: parent handles success flash + redirect
    }
  } catch {
    setError({ code: 'network_error', message: 'Cannot reach backend.' });
  } finally {
    setLoading(false);
  }
}
```

---

### `frontend/src/components/ConnectionForm.module.css` (config, file-I/O)

**Analog:** `UI/css/login.css` — direct port with CSS Modules class renaming

**Design tokens to preserve** (from `UI/css/login.css`):
```css
/* Color palette — use these exact values */
--color-brand-dark:   #002d1c;
--color-brand-mid:    #1b4332;
--color-brand-hover:  #1f5040;
--color-text-body:    #414944;
--color-text-muted:   #434654;
--color-border:       rgba(193, 200, 194, 0.84);
--color-shadow:       rgba(0, 45, 28, 0.08);
```

**Layout pattern** (from `UI/css/login.css` lines 22-28):
```css
.heroGrid {
  display: grid;
  grid-template-columns: 7fr 5fr;
  gap: 24px;
  max-width: 1200px;
  width: 100%;
  align-items: center;
}
```

**Login card pattern** (from `UI/css/login.css` lines 79-88):
```css
.loginCard {
  background: #ffffff;
  border: 1px solid rgba(193, 200, 194, 0.84);
  border-radius: 8px;
  box-shadow: 0px 40px 80px -20px rgba(0, 45, 28, 0.08);
  padding: 47px 49px 49px;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}
```

**CTA button pattern** (from `UI/css/login.css` lines 133-152) — apply to Submit button:
```css
.ctaBtn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: 100%;
  padding: 16px 24px;
  background: #1b4332;
  border: none;
  border-radius: 12px;
  color: #ffffff;
  font-weight: 500;
  font-size: 16px;
  cursor: pointer;
  transition: background 0.2s, transform 0.15s;
  margin-bottom: 24px;
}
.ctaBtn:hover  { background: #1f5040; transform: translateY(-1px); }
.ctaBtn:active { transform: translateY(0); }
```

**Status banner pattern** — already in `UI/css/login.css` lines 238-263, use for loading/error inline states:
```css
.statusBanner {
  width: 100%;
  font-size: 13px;
  padding: 10px 14px;
  border-radius: 8px;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.statusBanner.loading { background: #f3f4f6; color: #4b5563; }
.statusBanner.success { background: rgba(227,239,234,0.6); color: #1b4332; font-weight: 500; }
.statusBanner.error   { background: #fef2f2; color: #b91c1c; }
```

**Responsive breakpoint** (from `UI/css/login.css` lines 266-285):
```css
@media (max-width: 900px) {
  .heroGrid { grid-template-columns: 1fr; }
  .heroLeft { display: none; }
  .pageWrapper { padding: 40px 24px; padding-top: 80px; }
}
```

---

### `frontend/src/components/SuccessModal.jsx` (component, event-driven)

**Analog:** `UI/html/jira-connection-success.html` + `UI/css/jira-connection-success.css`

**Modal structure pattern** (from `UI/html/jira-connection-success.html` lines 16-46):
```jsx
// Render as overlay on top of ConnectionForm, not a separate page (D-10)
// Auto-redirect to /dashboard after brief flash (~1.5s)
<div className={styles.modalOverlay}>
  <div className={styles.modal} role="dialog" aria-labelledby="modal-title">
    <div className={`${styles.modalIconWrap} ${styles.modalIconSuccess}`}>
      <div className={styles.checkCircle}>
        {/* animated SVG checkmark — success.html lines 27-30 */}
      </div>
    </div>
    <h2 className={styles.modalTitle} id="modal-title">
      Jira Connection Successful
    </h2>
    <p className={styles.modalDesc}>Redirecting to dashboard...</p>
  </div>
</div>
```

**Animation pattern** (from `UI/css/jira-connection-success.css`):
```css
/* Slide-up modal — lines 49-52 */
@keyframes slideUp {
  from { transform: translateY(16px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}
/* Pop-in icon — lines 81-84 */
@keyframes popIn {
  from { transform: scale(0.5); opacity: 0; }
  to   { transform: scale(1);   opacity: 1; }
}
/* Animated SVG checkmark draw — lines 95-98 */
.checkPath {
  stroke-dasharray: 30;
  stroke-dashoffset: 30;
  animation: drawCheck 0.3s ease 0.3s forwards;
}
@keyframes drawCheck { to { stroke-dashoffset: 0; } }
```

**Color values from success CSS:**
```css
.modalIconSuccess { background: #e7f4f0; }    /* mint square */
.checkCircle      { background: #1b4332; }    /* dark green circle */
.modalTitle       { color: #065b41; }
.btnPrimary       { background: #1b4332; }
```

---

### `frontend/src/components/ErrorInline.jsx` (component, event-driven)

**Analog:** `UI/html/jira-connection-failed.html` + `UI/css/jira-connection-failed.css`
**Note:** D-11 and the `<deferred>` block specify inline error on the form, NOT a separate page/modal.

**Inline banner pattern** — use `.status-banner.error` from `UI/css/login.css` lines 254-257, NOT the full modal:
```jsx
// Renders inside ConnectionForm, not as overlay
// Receives: code ("invalid_credentials" | "unreachable_host" | "timeout")
//           message (human-readable string from D-13)
function ErrorInline({ code, message }) {
  return (
    <div className={`${styles.statusBanner} ${styles.error}`} role="alert">
      <ErrorIcon />
      <span>{message}</span>
    </div>
  );
}
```

**Error icon** — broken-link SVG from `UI/html/jira-connection-failed.html` lines 27-30:
```jsx
// Use for "unreachable_host" variant
<svg viewBox="0 0 24 24" fill="none">
  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
        stroke="#e53935" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
        stroke="#e53935" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  <line x1="3" y1="3" x2="21" y2="21" stroke="#e53935" strokeWidth="2" strokeLinecap="round"/>
</svg>
```

**Error color** (from `UI/css/jira-connection-failed.css` line 77):
```css
.modalIconError { background: #fde8e8; }  /* use for error state icon bg */
```

---

### `frontend/src/App.jsx` (component, request-response)

**Analog:** `UI/html/login.html` page-level structure

**Startup verify + routing pattern** (D-14):
```jsx
import { useEffect, useState } from 'react';
import ConnectionForm from './components/ConnectionForm';

function App() {
  const [status, setStatus] = useState('loading'); // 'loading' | 'connected' | 'disconnected'
  const [savedError, setSavedError] = useState(null);

  useEffect(() => {
    fetch('http://localhost:8000/api/jira/status')
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          setStatus('connected');
          // D-14: valid credentials → redirect/show dashboard
          window.location.href = '/dashboard';
        } else {
          setSavedError(data);  // show inline error on form
          setStatus('disconnected');
        }
      })
      .catch(() => setStatus('disconnected'));
  }, []);

  if (status === 'loading') return <LoadingSpinner />;
  return <ConnectionForm initialError={savedError} />;
}
```

---

## Shared Patterns

### MySQL Connection
**Source:** `skills/bug-dashboard/SKILL.md` lines 28-32 + `skills/jira-to-mysql/SKILL.md` lines 100-103
**Apply to:** `backend/database.py`, `backend/models/jira_config.py`
```python
conn = mysql.connector.connect(
    host=os.environ.get("DB_HOST", "localhost"),
    database=os.environ.get("DB_NAME", "jira_db"),
    user=os.environ.get("DB_USER", "root"),
    password=os.environ.get("DB_PASSWORD", "")
)
cur = conn.cursor(dictionary=True)
# ... queries ...
cur.close()
conn.close()
```

### Upsert (ON DUPLICATE KEY UPDATE)
**Source:** `skills/jira-to-mysql/SKILL.md` lines 107-111 (`upsert_project`)
**Apply to:** `backend/models/jira_config.py`
```python
cur.execute("""
    INSERT INTO table (col1, col2)
    VALUES (%s, %s)
    ON DUPLICATE KEY UPDATE col1=VALUES(col1), col2=VALUES(col2)
""", (val1, val2))
conn.commit()
```

### Error Response Shape
**Defined by:** CONTEXT.md D-13
**Apply to:** `backend/routers/jira.py` all error paths
```python
# Success: {"ok": True, ...}
# Failure HTTP 400: {"ok": False, "error": "<code>", "message": "<human text>"}
# Error codes: "invalid_credentials" | "unreachable_host" | "timeout"
raise HTTPException(
    status_code=400,
    detail={"ok": False, "error": error_code, "message": human_message}
)
```

### Design Color Tokens
**Source:** `UI/css/login.css` throughout
**Apply to:** All frontend CSS modules
```css
/* Brand greens */
#002d1c   /* hero headings, darkest brand */
#1b4332   /* primary button background, check circle */
#1f5040   /* button hover */
#065b41   /* modal title text */
/* UI grays */
#414944   /* body text */
#434654   /* muted text, footer */
#6b7280   /* modal description, close button */
/* Backgrounds */
rgba(193, 200, 194, 0.84)   /* card border */
rgba(227, 239, 234, 0.6)    /* success badge bg */
#fde8e8                      /* error icon bg */
#e7f4f0                      /* success icon bg */
```

### Font Stack
**Source:** `UI/html/login.html` lines 6-9 + `UI/css/login.css` line 4
**Apply to:** `frontend/src/index.css` or global stylesheet
```css
/* Google Fonts import */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&family=Hanken+Grotesk&family=Inder&display=swap');

body          { font-family: 'Inter', sans-serif; }
.heroHeading  { font-family: 'Inder', sans-serif; }  /* large display text */
.taglineText  { font-family: 'JetBrains Mono', monospace; }
.heroSubtext  { font-family: 'Hanken Grotesk', sans-serif; }
```

### Modal Animation
**Source:** `UI/css/jira-connection-success.css` lines 49-52, 81-84
**Apply to:** `SuccessModal.jsx` CSS module
```css
@keyframes slideUp {
  from { transform: translateY(16px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}
@keyframes popIn {
  from { transform: scale(0.5); opacity: 0; }
  to   { transform: scale(1);   opacity: 1; }
}
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `backend/.env` | config | file-I/O | Environment config files have no pattern in skills — use standard `KEY=VALUE` format with `FERNET_KEY`, `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` |

---

## Metadata

**Analog search scope:** `skills/jira-to-mysql/`, `skills/bug-dashboard/`, `UI/html/`, `UI/css/`
**Files scanned:** 8 (2 SKILL.md files, 3 HTML files, 3 CSS files)
**No existing source code** — this is a greenfield project
**Pattern extraction date:** 2026-05-11
