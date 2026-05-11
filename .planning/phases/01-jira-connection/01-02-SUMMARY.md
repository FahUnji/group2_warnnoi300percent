---
phase: 01-jira-connection
plan: 02
subsystem: api
tags: [fastapi, pydantic, requests, cryptography, fernet, python, jira-rest-api]

# Dependency graph
requires:
  - phase: 01-jira-connection/plan-01
    provides: "FastAPI app scaffold, get_db(), upsert_config(), load_config(), stub jira.py router"
provides:
  - "backend/services/jira_service.py — JiraService with test_and_save() and verify_saved_credentials()"
  - "backend/routers/jira.py — full POST /api/jira/connect and GET /api/jira/status endpoints"
  - "Fernet encryption of api_token before any DB write (D-03)"
  - "3 distinguished error codes: invalid_credentials, unreachable_host, timeout (D-12)"
  - "D-13 error shape: {ok: false, error: <code>, message: <human text>} HTTP 400"
  - "GET /status always returns 200 with ok flag — never raises (D-14)"
affects:
  - 01-jira-connection/plan-03 (frontend calls /api/jira/connect and /api/jira/status)
  - all-subsequent-phases (every Jira API call authenticates via saved jira_config credentials)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "JiraService class pattern: async wrapper methods using run_in_executor over sync requests/DB calls (D-06)"
    - "Fernet encryption at service boundary: encrypt before DB write, decrypt before Jira call (D-03)"
    - "Error mapping pattern: catch requests.exceptions.* and map to 3 safe error codes only (D-12, T-02-02)"
    - "D-13 error shape: HTTPException(400, detail={ok: False, error: code, message: text})"
    - "GET /status never raises HTTPException — always returns dict with ok flag (D-14)"
    - "Pydantic @field_validator on all 3 input fields — base_url, email, api_token (ASVS L1, T-02-01)"

key-files:
  created:
    - backend/services/jira_service.py
  modified:
    - backend/routers/jira.py

key-decisions:
  - "FERNET_KEY sourced via os.environ['FERNET_KEY'] — KeyError if unset, no silent default (D-03, T-02-05)"
  - "GET /status returns dict not HTTPException — ensures always-200 for auto-verify flow on React app load (D-14)"
  - "requests.exceptions.RequestException catch-all maps to unreachable_host — prevents internal error leakage (T-02-02)"
  - "base_url validated: must start with http/https, max 500 chars — partial SSRF mitigation (T-02-04)"
  - "verify_saved_credentials() catches Fernet decryption failure as not_configured — handles corrupted DB rows gracefully"

patterns-established:
  - "Service method pattern: async test_and_save() wraps sync calls via run_in_executor"
  - "Error propagation: service raises HTTPException; router returns it transparently"
  - "Status endpoint pattern: always-200, ok flag in body distinguishes success from failure"

requirements-completed:
  - JIRA-02
  - JIRA-03

# Metrics
duration: 5min
completed: 2026-05-11
---

# Phase 01 Plan 02: Jira Connection Service and Router Summary

**JiraService with Fernet-encrypted credential storage, Basic Auth against /rest/api/3/myself with 3-way error discrimination (invalid_credentials/unreachable_host/timeout), wired to POST /api/jira/connect and GET /api/jira/status FastAPI endpoints**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-11T09:00:00Z
- **Completed:** 2026-05-11T09:05:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created JiraService with test_and_save() — tests credentials via GET /rest/api/3/myself with 10s timeout, encrypts api_token with Fernet before upsert_config() DB write (D-03)
- Created JiraService.verify_saved_credentials() — loads saved config, decrypts token, re-verifies against Jira; returns not_configured if DB empty or decryption fails
- Replaced Plan 01 stub router with full implementation: POST /api/jira/connect (validates input, calls service, raises HTTP 400 on failure), GET /api/jira/status (always returns 200 with ok flag per D-14)
- All 3 Jira failure modes distinguished: invalid_credentials (401), unreachable_host (ConnectionError + catch-all), timeout (Timeout exception) — no stack traces leaked (T-02-02)
- Pydantic @field_validator applied to all 3 input fields with length limits for ASVS L1 compliance (T-02-01)

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement JiraService with Fernet encryption and Jira auth** - `13ff595` (feat)
2. **Task 2: Replace stub router with full POST /connect and GET /status endpoints** - `073c99e` (feat)

## Files Created/Modified

- `backend/services/jira_service.py` - NEW: JiraService class, _get_fernet(), _encrypt_token(), _decrypt_token(), _test_jira_auth() with 3-way error mapping, async test_and_save(), async verify_saved_credentials()
- `backend/routers/jira.py` - REPLACED: Full router with JiraConfigRequest Pydantic model (@field_validator on all 3 fields), POST /connect, GET /status (always-200)

## Decisions Made

- `GET /status` returns a dict (never raises HTTPException) so React app always gets HTTP 200 on app load — the ok flag in the body distinguishes connected vs not_configured (D-14)
- `requests.exceptions.RequestException` catch-all maps to unreachable_host error code (not a new code) — prevents leakage of unexpected error details while keeping error count at exactly 3 (D-12)
- Fernet decryption failure in verify_saved_credentials() maps to not_configured — handles DB row corruption gracefully without a new error code
- base_url stripped of trailing slash before appending /rest/api/3/myself — prevents double-slash URL construction

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — all files created cleanly on first attempt. python command not found in shell (used python3 instead) — this is an environment note, not a code issue.

## User Setup Required

None - no additional external service configuration required beyond what Plan 01 established. The FERNET_KEY env var documented in backend/.env.example is required before starting the backend.

## Threat Surface

No new trust boundaries introduced beyond those in the plan's threat model. All STRIDE mitigations applied as specified (T-02-01 through T-02-06). T-02-04 (SSRF) accepted per plan — base_url validated to start with http/https to prevent file:// and other schemes.

## Next Phase Readiness

- Plan 03 (React frontend) can immediately call POST /api/jira/connect and GET /api/jira/status
- Backend enforces D-13 error shape so frontend error handling can be written against a stable contract
- Encrypted credentials saved to jira_config table ready for all subsequent phases that make Jira API calls

---
*Phase: 01-jira-connection*
*Completed: 2026-05-11*

## Self-Check: PASSED

Files confirmed present:
- backend/services/jira_service.py: FOUND
- backend/routers/jira.py: FOUND (stub replaced)
- .planning/phases/01-jira-connection/01-02-SUMMARY.md: this file

Commits confirmed:
- 13ff595: feat(01-02): implement JiraService — FOUND
- 073c99e: feat(01-02): replace stub router — FOUND
