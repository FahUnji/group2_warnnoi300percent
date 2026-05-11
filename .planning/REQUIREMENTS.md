# Requirements: Jira Bug Summary Dashboard

**Defined:** 2026-05-08
**Core Value:** QA testers can instantly see bug health (status + priority breakdown) across any Jira project without navigating Jira directly.

## v1 Requirements

### Jira Authentication

- [ ] **JIRA-01**: System reads Jira connection config (base URL, email, API token) from environment variables or config file
- [ ] **JIRA-02**: System authenticates to Jira REST API using Basic Auth (email + API token)
- [ ] **JIRA-03**: System validates Jira connection and shows clear error if credentials are invalid

### Data Sync

- [ ] **SYNC-01**: User can trigger manual sync of bug data from Jira to MySQL via button
- [ ] **SYNC-02**: Sync fetches all issues of type "Bug" for the selected project (fields: ID, summary, status, priority, sprint, assignee)
- [ ] **SYNC-03**: Synced bug records are stored in MySQL with a sync timestamp

### Project Selection

- [ ] **PROJ-01**: User can select from multiple Jira projects via a project list page
- [ ] **PROJ-02**: Dashboard data refreshes when project selection changes

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

- **AUTO-01**: Scheduled auto-sync (cron) to keep MySQL data fresh without manual trigger
- **AUTO-02**: Email notification when critical bug count exceeds threshold

### Advanced Filtering

- **FILT-01**: Filter bugs by assignee
- **FILT-02**: Filter bugs by date range
- **FILT-03**: Search bugs by keyword

## Out of Scope

| Feature | Reason |
|---------|--------|
| Write to Jira (create/edit bugs) | Read-only dashboard — not a Jira replacement |
| Dashboard user login/auth | Internal QA tool — no auth needed for v1 |
| Real-time websocket updates | Manual sync sufficient for v1 |
| Mobile app | Web dashboard only |
| Last sync timestamp display (SYNC-04) | Removed from spec — not needed for v1 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| JIRA-01 | Phase 1 | Pending |
| JIRA-02 | Phase 1 | Pending |
| JIRA-03 | Phase 1 | Pending |
| SYNC-01 | Phase 2 | Pending |
| SYNC-02 | Phase 2 | Pending |
| SYNC-03 | Phase 2 | Pending |
| PROJ-01 | Phase 3 | Pending |
| PROJ-02 | Phase 3 | Pending |
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
- v1 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-08*
*Last updated: 2026-05-08 after roadmap creation — traceability confirmed*
