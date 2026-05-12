---
phase: 03-dashboard-ui
plan: 02
subsystem: ui
tags: [react, css-modules, dashboard, data-fetching, parallel-fetch, project-cards, connect-section]

# Dependency graph
requires:
  - phase: 03-01-PLAN.md
    provides: DashboardPage.jsx static layout with stub useEffects and handleConnect; DashboardPage.module.css with all CSS classes
  - phase: 02-data-sync
    provides: GET /api/projects, GET /api/bugs/{key}, POST /api/sync/{key} backend endpoints

provides:
  - DashboardPage.jsx fully wired with real data: /api/projects fetch on mount, parallel /api/bugs/{key} per card, handleConnect POSTing /api/sync/{key}
  - extractProjectKey utility: handles raw keys (SAM) and full Jira URLs (https://...atlassian.net/projects/SAM)
  - handleSync updated to re-fetch active project's bug stats after successful sync

affects: [04-sprint-report, 05-export]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Parallel per-project bug fetch: projects.forEach launches concurrent fetch calls; each resolves independently via setBugStats functional update
    - Functional state update pattern: setBugStats(prev => ({...prev, [key]: {...}})) for race-condition-safe updates
    - extractProjectKey: splits on '/' and takes last segment, then .toUpperCase() for defense-in-depth input normalization
    - Connect state machine: idle ('') → loading → success | error, mapped to CSS Modules class names

key-files:
  created: []
  modified:
    - frontend/src/pages/DashboardPage.jsx

key-decisions:
  - "Parallel bug fetch uses forEach (not Promise.all) so each card updates independently as its fetch resolves — faster perceived loading than waiting for all"
  - "extractProjectKey handles both raw keys and full Atlassian URLs by splitting on '/' and taking the last segment"
  - "handleSync re-fetches only the active project's bug stats (not all projects) for targeted, low-overhead refresh"
  - "setBugStats uses functional updater pattern (prev => ...) to avoid stale closure bugs when multiple parallel fetches resolve"

patterns-established:
  - "Parallel per-project stats: forEach + setBugStats functional update — cards update independently as fetches complete"
  - "extractProjectKey handles URL or raw input: split on '/', take last segment, toUpperCase()"
  - "Connect state machine: {type: '' | 'loading' | 'success' | 'error', message: string} maps to CSS Modules class names"

requirements-completed:
  - PROJ-01
  - PROJ-02
  - SUMM-01
  - SUMM-02
  - SUMM-03
  - CHART-01
  - CHART-02
  - UI-01

# Metrics
duration: 5min
completed: 2026-05-12
---

# Phase 3 Plan 02: Dashboard UI — Data Wiring Summary

**DashboardPage wired with parallel /api/bugs/{key} per card, /api/projects on mount, and full handleConnect flow with URL-aware extractProjectKey**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-12T10:16:00Z
- **Completed:** 2026-05-12T10:21:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Replaced both stub `useEffect` calls with real fetch logic: `/api/projects` on mount (with loadingProjects/projectsError state), and parallel `/api/bugs/{key}` per project (with independent card updates via functional setBugStats)
- Replaced `extractProjectKey` stub with URL-aware implementation: strips Atlassian URL path to extract project key, or normalizes raw key to uppercase
- Replaced `handleConnect` stub with full async flow: POST `/api/sync/{key}`, loading/success/error state machine, re-fetch projects on success
- Updated `handleSync` to re-fetch active project's bug stats after successful sync (updates card stats without full page reload)
- `npm run build` passes with 0 errors (42 modules)

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire project fetch, parallel bug stats, and connect handler into DashboardPage.jsx** — `60b09f6` (feat)

## Files Created/Modified

- `frontend/src/pages/DashboardPage.jsx` — MODIFIED: All four stub implementations replaced with real data-fetching logic; handleSync updated with per-card bug stats refresh

## Decisions Made

- `projects.forEach` used instead of `Promise.all` so each card updates its stats independently as its fetch resolves — better perceived loading performance (cards appear one by one rather than all at once)
- `setBugStats` uses functional updater pattern `prev => ({...prev, [key]: ...})` to prevent stale closure bugs when multiple concurrent fetches resolve
- `extractProjectKey` normalizes input with `split('/').filter(Boolean)` and takes the last segment — handles both `SAM` and full Atlassian URLs without regex

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- `vite: not found` on first build attempt (node_modules not present in worktree). Resolved by running `npm install`. Same issue as Wave 1 — expected worktree isolation behavior.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `DashboardPage.jsx` is fully wired: loads projects from API, shows per-card bug stats, connect form works end-to-end
- Phase 4 (Sprint Report) can build on the same `/api/bugs/{key}` fetch pattern and bugStats state shape
- Card click saves `sessionStorage('active_project_key')` — Phase 4 sprint view can read this to know active project

---
*Phase: 03-dashboard-ui*
*Completed: 2026-05-12*
