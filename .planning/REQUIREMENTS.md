# Requirements: Jira Bug Summary Dashboard

**Defined:** 2026-05-08
**Core Value:** QA testers can instantly see bug health (status + priority breakdown) across any Jira project without navigating Jira directly.

## v1 Requirements

### Jira Authentication

- [x] **JIRA-01**: System connects to Jira via Atlassian OAuth 2.0 (3LO) — user authorizes via Atlassian consent screen; access token + cloud_id stored encrypted in SQLite
- [x] **JIRA-02**: System authenticates Jira REST API calls using OAuth Bearer token (not Basic Auth)
- [x] **JIRA-03**: System validates Jira connection and shows clear error if token is invalid or expired

### Data Sync

- [x] **SYNC-01**: Sync is triggered automatically when user selects a project — fetches all Bug-type issues and stores them locally
- [x] **SYNC-02**: Sync fetches all issues of type "Bug" and "Bug Task" for the selected project (fields: ID, summary, status, priority, sprint, assignee)
- [x] **SYNC-03**: Synced bug records are stored in SQLite with a sync timestamp

### Project Selection

- [x] **PROJ-01**: User searches for Jira projects via debounced search input (300ms); results load from live Jira API only after typing — no auto-load on mount (privacy by default)
- [x] **PROJ-02**: Dashboard shows all synced projects as cards; each card displays open bug count and critical bug count
- [x] **PROJ-03**: User can remove a project from the dashboard via 3-dot kebab menu → Remove project; when last project is removed, user is redirected to the no-project page

### Bug Summary Report

- [ ] **SUMM-01**: Dashboard displays bug count grouped by status (Open, In Progress, Closed, etc.)
- [ ] **SUMM-02**: Dashboard displays bug count grouped by priority (Critical, High, Medium, Low)
- [ ] **SUMM-03**: Dashboard displays summary count cards (total bugs, open count, resolved count)

### Sprint Report

- [ ] **SPRINT-01**: Dashboard shows bugs assigned to the current active sprint
- [ ] **SPRINT-02**: Dashboard shows per-sprint history — total, open, resolved counts with bug count by priority in a collapsible section per sprint

### Charts

- [ ] **CHART-01**: Bug priority breakdown rendered as visual chart (bar or pie)
- [ ] **CHART-02**: Bug status breakdown rendered as visual chart (bar or pie)

### Export

- [ ] **EXPORT-01**: User can export current bug report to Excel (.xlsx)
- [ ] **EXPORT-02**: User can export current bug report to Word (.docx)

### UI

- [ ] **UI-01**: Dashboard is responsive and usable on mobile, tablet, and desktop

## v2 Requirements

### Automation

- **AUTO-01**: Scheduled auto-sync (cron) to keep local SQLite data fresh without manual trigger
- **AUTO-02**: Email notification when critical bug count exceeds threshold

### Advanced Filtering

- **FILT-01**: Filter bugs by assignee
- **FILT-02**: Filter bugs by date range
- **FILT-03**: Search bugs by keyword

## Out of Scope

| Feature | Reason |
|---------|--------|
| Write to Jira (create/edit bugs) | Read-only dashboard — not a Jira replacement |
| Real-time websocket updates | Manual sync sufficient for v1 |
| Mobile app | Web dashboard only |
| Last sync timestamp display (SYNC-04) | Removed from spec — not needed for v1 |
| Basic Auth / API token entry form | Replaced by OAuth 2.0 flow — no manual credential entry |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| JIRA-01 | Phase 1 | Done |
| JIRA-02 | Phase 1 | Done |
| JIRA-03 | Phase 1 | Done |
| SYNC-01 | Phase 2 | Done |
| SYNC-02 | Phase 2 | Done |
| SYNC-03 | Phase 2 | Done |
| PROJ-01 | Phase 3 | Done |
| PROJ-02 | Phase 3 | Done |
| PROJ-03 | Phase 3 | Done |
| SUMM-01 | Phase 3 | Pending |
| SUMM-02 | Phase 3 | Pending |
| SUMM-03 | Phase 3 | Pending |
| SPRINT-01 | Phase 4 | Pending |
| SPRINT-02 | Phase 4 | Pending |
| CHART-01 | Phase 3 | Pending |
| CHART-02 | Phase 3 | Pending |
| EXPORT-01 | Phase 5 | Pending |
| EXPORT-02 | Phase 5 | Pending |
| UI-01 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 19 total (PROJ-03 added)
- Mapped to phases: 19
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-08*
*Last updated: 2026-05-12 — corrected auth (OAuth not Basic Auth), storage (SQLite not MySQL), project flow (search-and-select + remove); marked Phases 1–2 and PROJ-01/02/03 done*
