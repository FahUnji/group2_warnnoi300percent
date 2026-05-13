# Jira Bug Summary Dashboard

## What This Is

A web dashboard for QA testers to monitor bug status across multiple Jira projects. Connects to Jira via OAuth 2.0 and presents live summaries of bug counts grouped by status and priority, with multi-project support and per-project sync.

## Core Value

QA testers can instantly see bug health (status + priority breakdown) across any Jira project without navigating Jira directly.

## Requirements

### Validated (Phases 1–3 partial)

- [x] Connect to Jira via Atlassian OAuth 2.0 (3LO) — user authorizes via Atlassian consent screen
- [x] Sync Jira bug data to local SQLite on project selection
- [x] Fetch bugs (ID, summary, status, priority, sprint, assignee) per Jira project
- [x] Project search-and-select — debounced live search, privacy-by-default (no auto-load on mount)
- [x] Dashboard shows synced projects as cards with open bug count and critical count
- [x] Remove project via kebab menu; redirect to no-project page when all removed

### Active (Remaining)

- [ ] Display bug count grouped by status (Open / In Progress / Closed / etc.)
- [ ] Display bug count grouped by priority (Critical / High / Medium / Low)
- [ ] Summary count cards (total, open, critical)
- [ ] Sprint Bug Report — active sprint bugs + per-sprint history
- [ ] Bug priority chart and bug status chart
- [ ] Export report to Excel (.xlsx) and Word (.docx)
- [ ] Responsive layout (mobile, tablet, desktop)

### Out of Scope

- Bug detail views / drill-down into individual tickets — v2, not needed for summary
- User authentication / login — dashboard is internal team tool
- Write operations to Jira (create/edit bugs) — read-only dashboard
- Real-time websocket updates — manual sync sufficient for v1
- Basic Auth / API token entry form — replaced by OAuth 2.0 flow

## Context

- Team: group2, project codename warnnoi300percent
- Jira access via Atlassian OAuth 2.0 (3LO) — access token + cloud_id stored encrypted in SQLite
- Stack: Python backend (FastAPI) handles Jira OAuth + sync + REST API; React frontend renders dashboard
- Repo: https://github.com/FahUnji/group2_warnnoi300percent

## Constraints

- **Tech Stack**: Python backend (FastAPI) + Node.js/React frontend — team decision
- **Data Source**: Jira REST API → sync on project select → SQLite — data persists locally after sync
- **Auth**: Atlassian OAuth 2.0 (3LO) — access token encrypted at rest, never logged or returned in API responses

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Python + FastAPI for backend | Handles Jira API + async well, clean type hints | Phase 1 |
| React for frontend | Component-based charts, familiar ecosystem | Phase 1 |
| Atlassian OAuth 2.0 (3LO) instead of Basic Auth | Secure, no credential storage on client, Atlassian recommended | Phase 1 |
| SQLite instead of MySQL | Zero infra setup, sufficient for team-internal tool, easier local dev | Phase 2 |
| Sync triggered on project select, not manual button | Simpler UX — one action adds + syncs the project | Phase 2 |
| Search-before-show for project picker | Privacy by default — no auto-load of full project list on mount | Phase 3 |
| Kebab menu for project removal | Non-destructive placement — delete is intentional action, not accidental | Phase 3 |
| Read-only dashboard | Scope control — QA needs visibility, not issue management | Phase 1 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-12 — corrected auth (OAuth 2.0 not Basic Auth), storage (SQLite not MySQL), project flow (search-and-select + remove); reflected Phases 1–2 done and Phase 3 partial*
