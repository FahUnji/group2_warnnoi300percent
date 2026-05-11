# Walking Skeleton — Jira Bug Summary Dashboard

**Phase:** 1
**Generated:** 2026-05-11

## Capability Proven End-to-End

A user opens the browser, sees the Jira connection form, fills in base URL + email + API token, clicks "Connect to Jira", the backend validates credentials against the real Jira REST API and stores the encrypted token in MySQL, then the browser displays a success modal and redirects to `/dashboard`.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Backend framework | FastAPI (Python 3.11+) with Uvicorn | Async support, auto-docs at `/docs`, Pydantic validation — per D-04 |
| DB access | `mysql-connector-python` (synchronous, run in thread pool via `asyncio.get_event_loop().run_in_executor`) | Already in skill code; avoids async driver complexity — per D-06 |
| Credential encryption | `cryptography.fernet.Fernet` | Symmetric AES-128-CBC; single `FERNET_KEY` env var — per D-03 |
| Frontend framework | React 18 + Vite (JSX) | Fast HMR, no SSR needed for internal tool, CSS Modules support |
| Styling approach | CSS Modules (hand-ported from `UI/css/` reference files) | No Tailwind/shadcn; exact design fidelity to approved UI spec — per D-09 |
| Dev routing | React on `:3000`, FastAPI on `:8000`, CORS restricted to `http://localhost:3000` | Separate dev servers — per D-07 |
| Config storage | `jira_config` MySQL table (single-row, upsert on re-configure) | Foundation for all future phases — per D-02 |
| Secret management | `.env` file (dev), env vars (prod); `FERNET_KEY` + DB creds only | Fernet key never hardcoded — per D-03, ASVS L1 |
| Directory layout | `backend/` (routers/ services/ models/) + `frontend/` (src/components/ src/pages/) + `migrations/` | Layered backend per D-05; component-per-folder frontend per UI-SPEC |
| Deployment | Local dev — `uvicorn backend.main:app --reload` + `npm run dev` | Phase 1 proves local full-stack; cloud deploy in later milestone |

## Stack Touched in Phase 1

- [x] Project scaffold — `backend/` FastAPI app, `frontend/` Vite+React app, `requirements.txt`, `package.json`
- [x] Routing — `GET /api/jira/status` (auto-verify) + `POST /api/jira/connect` (credential save) + React `/` → `/dashboard` client routes
- [x] Database — real WRITE (`INSERT ... ON DUPLICATE KEY UPDATE` to `jira_config`) + real READ (`SELECT * FROM jira_config LIMIT 1`) on startup verify
- [x] UI — interactive 3-field form wired through `POST /api/jira/connect` with error states, loading state, and success modal
- [x] Deployment — documented local full-stack run commands: `uvicorn backend.main:app --reload --port 8000` + `npm run dev` in `frontend/`

## Out of Scope (Deferred to Later Slices)

- Bug data sync (Phase 2 — SYNC-01 through SYNC-03)
- Dashboard charts and project selector (Phase 3 — PROJ-01, SUMM-01 through CHART-02)
- Sprint report (Phase 4)
- Excel/Word export (Phase 5)
- `jira-connection-failed.html` as a separate page (deferred per CONTEXT.md)
- Project key selection on connection form (Phase 3 — PROJ-01)
- Auto-sync / scheduled refresh (v2 — AUTO-01)
- Actual `/dashboard` page content (stub route only in Phase 1)

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without renegotiating Phase 1's architectural decisions:

- Phase 2: User clicks "Sync" button → backend pulls Jira bugs → stores in MySQL `issue` table → sync timestamp shown
- Phase 3: User sees bug counts by status/priority as charts for a selected project
- Phase 4: User sees active sprint bugs and per-sprint history
- Phase 5: User downloads Excel or Word report of current bug data
