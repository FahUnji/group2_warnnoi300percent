# Phase 4: Sprint Report - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 4-sprint-report
**Areas discussed:** Sprint page routing, Sprint data source, Project context, Active sprint detection

---

## Sprint Page Routing

| Option | Description | Selected |
|--------|-------------|----------|
| New /sprint route | SprintPage.jsx at /sprint — matches mockup's full-page layout with sidebar. Cleanest — users navigate from Dashboard sidebar link. | ✓ |
| Tab on /dashboard | Add Sprint tab to existing DashboardPage. Sidebar in mockup suggests separate page. | |

**User's choice:** New /sprint route (Recommended)
**Notes:** Mockup reviewed in full — sidebar with Dashboard/Bug Report/Sprint nav confirms separate page intent.

---

## Sprint Data Source

| Option | Description | Selected |
|--------|-------------|----------|
| Jira Board API | Call GET /rest/agile/1.0/board?projectKeyOrId={key} to find board ID, then GET /rest/agile/1.0/board/{id}/sprint for sprint list with dates + state. Store in new sprints table. | ✓ |
| Derive from sprint_name field | Group bugs by sprint_name string in SQLite. No dates, no real state. Active = most recent sprint_name. | |

**User's choice:** Jira Board API (Recommended)
**Notes:** Mockup shows sprint dates (e.g., "Oct 12 – Oct 26, 2023") and ACTIVE/COMPLETED badge — requires real sprint metadata from Jira, not text parsing.

---

## Project Context

| Option | Description | Selected |
|--------|-------------|----------|
| URL query param | /sprint?project=PROJ_KEY. Dashboard passes project key when navigating to sprint. Bookmarkable, shareable. | ✓ |
| localStorage / React state | Store selected project in localStorage or context. No URL change needed but not bookmarkable. | |

**User's choice:** URL query param (Recommended)
**Notes:** Clean, bookmarkable. Dashboard Sprint link will append `?project={key}`.

---

## Active Sprint Detection

| Option | Description | Selected |
|--------|-------------|----------|
| Fetch on page load + cache in SQLite | GET /api/sprint/{project_key} triggers Board API call, stores sprint metadata in new sprints table. Refresh Data button re-fetches. Active = state='active' from Jira. | ✓ |
| Fetch live on every page load | Always call Jira Board API on mount. No caching. Simple but slow. | |

**User's choice:** Fetch on page load + cache in SQLite (Recommended)
**Notes:** Consistent with Phase 2 sync-and-cache approach. "Refresh Data" button in mockup triggers explicit re-fetch.

---

## Claude's Discretion

- Error and empty states (no sprints found, board not found, token expired)
- CSS module naming for SprintPage
- Whether board ID is stored in DB or discovered fresh on each sync

## Deferred Ideas

- Real export (Word/Excel) — deferred to Phase 5
- Filtering sprints by date range or status — v2 backlog
- Real-time sprint sync / auto-refresh — v2 (AUTO-01)
