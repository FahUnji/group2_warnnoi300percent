---
phase: 01-jira-connection
reviewed: 2026-05-11T09:10:00Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - backend/main.py
  - backend/database.py
  - backend/models/jira_config.py
  - backend/routers/jira.py
  - backend/services/jira_service.py
  - migrations/001_create_jira_config.sql
  - frontend/src/App.jsx
  - frontend/src/pages/ConnectionPage.jsx
  - frontend/src/pages/ConnectionPage.module.css
  - frontend/src/pages/DashboardPage.jsx
  - frontend/src/main.jsx
  - frontend/src/index.css
  - frontend/src/components/ConnectionForm/ConnectionForm.jsx
  - frontend/src/components/ConnectionForm/ConnectionForm.module.css
  - frontend/src/components/StatusBanner/StatusBanner.jsx
  - frontend/src/components/StatusBanner/StatusBanner.module.css
  - frontend/src/components/SuccessModal/SuccessModal.jsx
  - frontend/src/components/SuccessModal/SuccessModal.module.css
  - frontend/src/components/LoadingSpinner/LoadingSpinner.jsx
  - frontend/src/components/LoadingSpinner/LoadingSpinner.module.css
  - frontend/vite.config.js
  - frontend/package.json
  - frontend/index.html
  - backend/requirements.txt
  - backend/.env.example
findings:
  critical: 5
  warning: 6
  info: 3
  total: 14
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-05-11T09:10:00Z
**Depth:** standard
**Files Reviewed:** 24
**Status:** issues_found

## Summary

Phase 1 implements Jira credential collection, a Basic Auth test against `/rest/api/3/myself`, Fernet-at-rest encryption, and MySQL persistence. The overall architecture is sound and the security intent is correct. However, there are five critical defects that will either crash the server on startup, silently corrupt DB state, leak credentials, or leave an open SSRF attack surface. Six warnings address robustness gaps that are likely to surface in QA. Three info items address minor quality issues.

---

## Critical Issues

### CR-01: FERNET_KEY KeyError crashes the entire server on startup, not at call time

**File:** `backend/services/jira_service.py:23`

**Issue:** The module-level docstring says "Missing key raises KeyError at call time — no silent default," but `_get_fernet()` is called from `_encrypt_token` and `_decrypt_token`, which are themselves called from `test_and_save` and `verify_saved_credentials` inside request handlers. A missing `FERNET_KEY` will propagate an unhandled `KeyError` (not an `HTTPException`) all the way up to FastAPI, which will return an unformatted HTTP 500 to the client. More critically: if `os.environ["FERNET_KEY"]` raises at import time in any code path that runs during module load, the entire worker process aborts. The current arrangement gives no startup-time validation, so the failure is invisible until the first real request.

Additionally, `Fernet(key.encode())` will raise `ValueError` if `FERNET_KEY` is set but is not a valid 32-byte URL-safe base64 key — this too propagates as an unhandled 500.

**Fix:** Validate the key at application startup in `main.py` and fail fast with a clear message:

```python
# backend/main.py — after load_dotenv, before app definition
import os
from cryptography.fernet import Fernet

_fernet_key = os.environ.get("FERNET_KEY")
if not _fernet_key:
    raise RuntimeError("FERNET_KEY environment variable is not set. Cannot start.")
try:
    Fernet(_fernet_key.encode())
except Exception as exc:
    raise RuntimeError(f"FERNET_KEY is invalid: {exc}") from exc
```

Within `jira_service.py`, wrap `_get_fernet()` calls in a try/except that converts `KeyError`/`ValueError` into `HTTPException(500)` with a safe message (no key details).

---

### CR-02: Database connection leak on any exception in `upsert_config` and `load_config`

**File:** `backend/models/jira_config.py:11-27` and `backend/models/jira_config.py:30-40`

**Issue:** Both `upsert_config` and `load_config` call `get_db()` and then manually call `cur.close()` / `conn.close()` at the end of the happy path. If `cur.execute(...)`, `conn.commit()`, or `cur.fetchone()` raises any exception (DB connection dropped, MySQL error, network timeout, etc.), execution jumps to the caller without closing the cursor or connection. Under the default `mysql-connector-python` configuration, each leaked connection remains open until the server process exits or the MySQL `wait_timeout` fires. Under sustained error conditions this will exhaust the MySQL connection pool and bring the service down.

**Fix:** Use `try/finally` (or a context manager) for both cursor and connection:

```python
def upsert_config(base_url: str, email: str, api_token_encrypted: str) -> None:
    conn = get_db()
    try:
        cur = conn.cursor()
        try:
            cur.execute(
                """
                INSERT INTO jira_config (base_url, email, api_token_encrypted)
                VALUES (%s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    base_url            = VALUES(base_url),
                    email               = VALUES(email),
                    api_token_encrypted = VALUES(api_token_encrypted),
                    updated_at          = CURRENT_TIMESTAMP
                """,
                (base_url, email, api_token_encrypted),
            )
            conn.commit()
        finally:
            cur.close()
    finally:
        conn.close()
```

Apply the same `try/finally` pattern to `load_config`.

---

### CR-03: SSRF — `base_url` validator allows `http://` scheme and any internal host

**File:** `backend/routers/jira.py:28-34`

**Issue:** The `base_url_must_be_https` validator name is misleading: it actually accepts `http://` URLs as valid (line 30: `if not v.startswith("http://") and not v.startswith("https://")`). This means an attacker (or misconfigured client) can submit `http://169.254.169.254/` (AWS metadata), `http://localhost/admin`, or any internal service URL. The backend will faithfully make a GET request to that address with Basic Auth headers attached. This is a Server-Side Request Forgery (SSRF) vulnerability.

For a tool that is explicitly connecting to Jira Cloud, only `https://` is legitimate. Even for self-hosted Jira, `http://` to internal hosts is a SSRF risk.

**Fix:** Enforce `https://` only, and additionally validate that the host is not a loopback/link-local/private address:

```python
@field_validator("base_url")
@classmethod
def base_url_must_be_https(cls, v: str) -> str:
    v = v.strip()
    if not v.startswith("https://"):
        raise ValueError("base_url must start with https://")
    if len(v) > 500:
        raise ValueError("base_url must be 500 characters or fewer")
    # Reject obvious SSRF targets
    import urllib.parse, ipaddress
    host = urllib.parse.urlparse(v).hostname or ""
    try:
        addr = ipaddress.ip_address(host)
        if addr.is_private or addr.is_loopback or addr.is_link_local:
            raise ValueError("base_url must not point to a private/internal address")
    except ValueError:
        pass  # hostname, not IP — acceptable
    return v
```

---

### CR-04: `load_config` uses `SELECT *` and `ORDER BY id DESC` — the upsert logic never actually deduplicates rows

**File:** `backend/models/jira_config.py:36` and `migrations/001_create_jira_config.sql:10-18`

**Issue:** The SQL migration does not define a `UNIQUE` constraint on any column of `jira_config`. The `ON DUPLICATE KEY UPDATE` clause in `upsert_config` fires only when a duplicate key violation occurs. With only an `AUTO_INCREMENT PRIMARY KEY`, every `INSERT` gets a new `id` — there is no duplicate key. The intended "single-row config table" design silently inserts a new row on every save instead of updating the existing one.

`load_config` papers over this with `ORDER BY id DESC LIMIT 1` (reading the newest row), but:
1. Old rows accumulate indefinitely, holding encrypted tokens for superseded credentials.
2. The `ON DUPLICATE KEY UPDATE` block is dead code — it never executes.
3. Old plaintext-equivalent rows remain in the DB even after a credential rotation.

**Fix:** Add a sentinel unique constraint to the migration so ON DUPLICATE KEY UPDATE actually fires:

```sql
CREATE TABLE IF NOT EXISTS jira_config (
  id                    INT           NOT NULL DEFAULT 1,   -- always 1
  base_url              VARCHAR(500)  NOT NULL,
  email                 VARCHAR(255)  NOT NULL,
  api_token_encrypted   TEXT          NOT NULL,
  created_at            TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
                          ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);
```

Because `id` is now the PK with a fixed value of 1, the first insert creates the row; subsequent inserts hit a duplicate PK and trigger the `ON DUPLICATE KEY UPDATE` branch. Remove `AUTO_INCREMENT`. Old rows from the current broken schema must be cleaned up before the fix is applied.

---

### CR-05: API token length is unbounded — no maximum enforced before encryption

**File:** `backend/routers/jira.py:46-52`

**Issue:** The `api_token_must_be_present` validator checks only that the token is non-empty after stripping. There is no upper-bound length check. An attacker can submit an arbitrarily large payload (e.g., 100 MB JSON) that the backend will accept, pass to Fernet for encryption, and then attempt to write to the `api_token_encrypted TEXT` column. While FastAPI's default request size limit provides a partial backstop, it is not explicitly configured here. Fernet encryption of a huge payload will also consume proportional memory synchronously in the event-loop executor thread, creating a potential denial-of-service vector.

Jira API tokens are fixed-length strings (under 256 characters). Enforcing a tight maximum is both correct and a defense-in-depth measure.

**Fix:**

```python
@field_validator("api_token")
@classmethod
def api_token_must_be_present(cls, v: str) -> str:
    v = v.strip()
    if not v:
        raise ValueError("api_token must not be empty")
    if len(v) > 500:
        raise ValueError("api_token must be 500 characters or fewer")
    return v
```

Also add to `main.py`:
```python
# Limit request body to 64 KB — tokens are never large
from fastapi import Request
from fastapi.responses import JSONResponse

@app.middleware("http")
async def limit_body_size(request: Request, call_next):
    if request.headers.get("content-length"):
        if int(request.headers["content-length"]) > 65_536:
            return JSONResponse(status_code=413, content={"ok": False, "error": "payload_too_large"})
    return await call_next(request)
```

---

## Warnings

### WR-01: `asyncio.get_event_loop()` is deprecated in Python 3.10+ and will fail in some async contexts

**File:** `backend/services/jira_service.py:97` and `backend/services/jira_service.py:118`

**Issue:** `asyncio.get_event_loop()` is deprecated since Python 3.10 and raises a `DeprecationWarning` (and in some contexts a `RuntimeError`) when called from a coroutine that is running inside a running loop without an explicit loop set. The correct idiom inside an `async def` function is `asyncio.get_running_loop()`, which always returns the currently running loop without creating a new one.

**Fix:**

```python
# Replace both occurrences
loop = asyncio.get_running_loop()
```

---

### WR-02: `jira_status` endpoint always returns HTTP 200 even for errors — clients cannot distinguish network failure from "not configured"

**File:** `backend/routers/jira.py:71-81`

**Issue:** The docstring says "This endpoint never raises — always returns 200 with ok flag." This is intentional per D-14, but the frontend `App.jsx` (line 32) catches network/fetch errors with `.catch(() => setVerifyStatus('disconnected'))`. When the backend is unreachable, the frontend silently treats it the same as "not configured" and shows the connection form without any indication that there was a backend connectivity problem. This is acceptable UX but the `catch` block discards the error entirely, giving the user no feedback if the backend is simply down.

**Fix:** In `App.jsx`, surface the catch as an error state rather than silently swallowing it:

```jsx
.catch(() => {
  setSavedError({ error: 'network_error', message: 'Cannot reach backend. Is the server running?' });
  setVerifyStatus('disconnected');
});
```

---

### WR-03: `requests` library used synchronously inside `run_in_executor` — no SSL certificate verification control

**File:** `backend/services/jira_service.py:49-55`

**Issue:** `requests.get(...)` is called with `verify=True` (the default), which is correct for Jira Cloud. However, there is no explicit `verify=True` in the call, making it invisible to a future maintainer who might add `verify=False` to "fix" a self-signed cert issue, which would silently disable certificate validation and expose credentials to MITM attacks.

Additionally, `requests` does not enforce a `connect_timeout` separately from a `read_timeout`. The single `timeout=10` applies as `(connect_timeout, read_timeout)` only when a tuple is passed; a scalar means each phase can individually take up to 10 seconds, meaning the total worst-case hang is up to 20 seconds (10 connect + 10 read).

**Fix:**

```python
response = requests.get(
    url,
    auth=(email, api_token),
    timeout=(5, 10),  # (connect_timeout_s, read_timeout_s)
    headers={"Accept": "application/json"},
    verify=True,      # explicit: always validate TLS certificate
)
```

---

### WR-04: Non-200, non-401 Jira HTTP responses are silently swallowed as `unreachable_host`

**File:** `backend/services/jira_service.py:56-82`

**Issue:** The logic is: 401 → `invalid_credentials`; then `response.raise_for_status()` which raises `requests.exceptions.HTTPError` for 4xx/5xx responses other than 401. That exception is caught by the blanket `except requests.exceptions.RequestException` at line 76, which maps it to `unreachable_host`. So a 403 (valid credentials, insufficient Jira permissions), 404 (wrong base URL path), or 503 (Jira maintenance) all silently appear to the user as "cannot reach Jira at that URL." This will confuse users who have valid credentials but hit a 403 (common when the Jira account lacks the API access scope).

**Fix:** Handle `HTTPError` explicitly before the catch-all:

```python
except requests.exceptions.HTTPError as exc:
    status = exc.response.status_code if exc.response is not None else 0
    if status == 403:
        return {
            "ok": False,
            "error": "forbidden",
            "message": "Connected to Jira but access was denied. Check that your account has API access.",
        }
    return {
        "ok": False,
        "error": "unreachable_host",
        "message": f"Jira returned an unexpected error (HTTP {status}). Check the base URL.",
    }
```

---

### WR-05: `initialError` passed as prop is never reset when the user starts typing — stale error lingers

**File:** `frontend/src/components/ConnectionForm/ConnectionForm.jsx:18`

**Issue:** `initialError` is used to seed the `error` state on mount. When the user begins editing any field, `handleChange` updates `fields` but never clears `error`. The error banner from the startup-verify failure (e.g., "Invalid credentials from last session") will remain visible while the user is typing new credentials, giving a confusing mixed-state UX. The `handleSubmit` function does call `setError(null)` before the fetch, but there is no clearance on field change.

**Fix:**

```jsx
function handleChange(e) {
  const { name, value } = e.target;
  setFields((prev) => ({ ...prev, [name]: value }));
  if (error) setError(null);  // clear stale error as soon as user edits
}
```

---

### WR-06: Footer links use bare `href="#"` — navigates to top of page, breaking back-button behavior

**File:** `frontend/src/pages/ConnectionPage.jsx:28-33`

**Issue:** All four footer links (`Privacy Policy`, `Terms of Service`, `Security`, `Status`) use `href="#"`. Clicking any of them performs a scroll-to-top navigation, adds a history entry, and changes the URL hash. On a SPA using `react-router-dom`, this can interact unexpectedly with the router's history stack and break the back button. While these pages are placeholder-only in Phase 1, the pattern will cause real issues when a user navigates away and presses Back.

**Fix:** Use `href="#" onClick={(e) => e.preventDefault()}` for placeholder links, or replace with `<button>` styled as a link, until real URLs are known:

```jsx
<a href="#" onClick={(e) => e.preventDefault()}>Privacy Policy</a>
```

---

## Info

### IN-01: `DB_USER` defaults to `root` — production-unsafe default in `database.py`

**File:** `backend/database.py:11`

**Issue:** `os.environ.get("DB_USER", "root")` uses `root` as the fallback when `DB_USER` is not set. If the `.env` file is missing or misconfigured in a deployment, the backend silently connects as the MySQL root user. This is a misconfiguration risk, not a vulnerability in the code itself (since the real password would also need to match), but the default promotes a bad habit.

**Fix:** Use `None` as the default and fail clearly if required env vars are absent:

```python
def get_db():
    host = os.environ.get("DB_HOST", "localhost")
    database = os.environ.get("DB_NAME") or "jira_db"
    user = os.environ.get("DB_USER")
    password = os.environ.get("DB_PASSWORD")
    if not user:
        raise RuntimeError("DB_USER environment variable is required")
    return mysql.connector.connect(host=host, database=database, user=user, password=password)
```

---

### IN-02: `autoComplete="current-password"` on the API token field is semantically incorrect

**File:** `frontend/src/components/ConnectionForm/ConnectionForm.jsx:125`

**Issue:** The `api_token` input uses `autoComplete="current-password"`. This causes browsers to offer stored passwords for the site domain and to prompt to save the value in the password manager after submit. Jira API tokens are not passwords and should not be stored in the browser password manager. The correct autocomplete hint is `"off"` or `"one-time-code"` (the latter is semantically closer and suppresses most save prompts without disabling autocomplete entirely).

**Fix:**

```jsx
<input
  ...
  autoComplete="off"
  ...
/>
```

---

### IN-03: Vite dev proxy and hardcoded `API_BASE` coexist — double-routing risk

**File:** `frontend/src/App.jsx:7` and `frontend/vite.config.js:9-13`

**Issue:** `vite.config.js` sets up a proxy that forwards `/api/*` requests from the Vite dev server (port 3000) to `http://localhost:8000`. Simultaneously, `App.jsx` hardcodes `API_BASE = 'http://localhost:8000'` and all fetch calls use that absolute origin directly (e.g., `fetch('http://localhost:8000/api/jira/status')`). Because the fetch uses an absolute URL with the origin `http://localhost:8000`, the Vite proxy is bypassed entirely. The proxy config is therefore dead code in the current implementation.

This also means the CORS `allow_origins: ["http://localhost:3000"]` restriction in `main.py` is being exercised on every request (the browser sends an Origin header with the absolute URL fetch), which is correct — but the proxy configuration gives a false sense of redundancy that does not actually exist.

**Fix:** Either remove the Vite proxy (it does nothing) and keep the absolute `API_BASE`, or switch to relative API paths (`/api/jira/status`) and rely on the proxy — but do not maintain both simultaneously:

```js
// Option A: remove proxy from vite.config.js entirely (preferred — explicit is clearer)
// Option B: use relative paths in App.jsx and ConnectionForm.jsx
const API_BASE = '';  // empty string — paths like /api/jira/connect are relative to origin
```

---

_Reviewed: 2026-05-11T09:10:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
