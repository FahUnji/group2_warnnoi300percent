# Jira Bug Summary Dashboard

## What This Is

A web dashboard for QA testers to monitor bug status across multiple Jira projects. Connects to Jira via REST API and presents live summaries of bug counts grouped by status and priority, with project-switching support.

## Core Value

QA testers can instantly see bug health (status + priority breakdown) across any Jira project without navigating Jira directly.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Connect to Jira REST API using API token authentication
- [ ] Manual sync of Jira bug data to MySQL database
- [ ] Fetch bugs (ID, summary, status, priority, sprint, assignee) per Jira project
- [ ] Display bug count grouped by status (Open / In Progress / Closed / etc.)
- [ ] Display bug count grouped by priority (Critical / High / Medium / Low)
- [ ] Summary count cards (total, open, critical)
- [ ] Sprint Bug Report — active sprint bugs + per-sprint history
- [ ] Bug priority chart and bug status chart
- [ ] Allow switching between multiple Jira projects via dropdown
- [ ] Export report to Excel (.xlsx) and Word (.docx)
- [ ] Backend (Python) handles Jira API, MySQL storage, data processing
- [ ] Frontend (React/Node.js) renders dashboard with charts and export buttons

### Out of Scope

- Bug detail views / drill-down into individual tickets — v2, not needed for summary
- User authentication / login — dashboard is internal team tool
- Write operations to Jira (create/edit bugs) — read-only dashboard
- Real-time websocket updates — polling or manual refresh sufficient for v1

## Context

- Team: group2, project codename warnnoi300percent
- Jira access via personal API token (user supplies base URL + token + email)
- Stack: Python backend (FastAPI or Flask) fetches and processes Jira data; React frontend (Node.js) renders dashboard
- Repo: https://github.com/FahUnji/group2_warnnoi300percent

## Constraints

- **Tech Stack**: Python backend + Node.js/React frontend — team decision
- **Data Source**: Jira REST API → manual sync → MySQL — data persists locally after sync
- **Auth**: Jira API token (Basic auth) — no OAuth flow needed for v1

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Python for backend | Handles Jira API + data aggregation cleanly | — Pending |
| React for frontend | Component-based charts, familiar ecosystem | — Pending |
| Read-only dashboard | Scope control — QA needs visibility, not issue management | — Pending |

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
*Last updated: 2026-05-08 after initialization*
