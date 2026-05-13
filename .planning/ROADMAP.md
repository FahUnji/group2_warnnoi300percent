# Roadmap: Jira Bug Summary Dashboard

## Overview

Five vertical slices deliver the complete dashboard: first the Jira connection is proven, then data is persisted locally, then the core UI is visible, then the sprint report completes the dashboard, and finally export rounds out the feature set. Each phase is independently verifiable — a QA tester can confirm what changed before the next phase begins.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Jira Connection** - Authenticate to Jira REST API and confirm a live connection
- [x] **Phase 2: Data Sync** - Pull bug data from Jira and persist it in SQLite
- [x] **Phase 3: Dashboard UI** - Display bug summaries and charts with project switching
- [ ] **Phase 4: Sprint Report** - Add active-sprint view and per-sprint history
- [ ] **Phase 5: Export** - Generate downloadable Excel and Word reports

## Phase Details

### Phase 1: Jira Connection
**Goal**: The backend can authenticate to Jira and fetch data from it
**Mode**: mvp
**Depends on**: Nothing (first phase)
**Requirements**: JIRA-01, JIRA-02, JIRA-03
**Success Criteria** (what must be TRUE):
  1. Running the backend reads Jira credentials from environment variables or config file without hardcoding
  2. The backend successfully authenticates to the Jira REST API using Basic Auth (email + API token)
  3. A valid connection produces a success response; invalid credentials surface a clear error message
**Plans**: 3 plans

Plans:
- [x] 01-PLAN-01.md — Backend scaffold: FastAPI app, database utility, jira_config model, SQL migration
- [x] 01-PLAN-02.md — Jira service: Fernet encryption, /rest/api/3/myself auth, POST /connect + GET /status endpoints
- [x] 01-PLAN-03.md — React frontend: Vite scaffold, ConnectionForm, StatusBanner, SuccessModal, LoadingSpinner, routing

### Phase 2: Data Sync
**Goal**: Bug data from Jira is stored in SQLite and available to the backend
**Mode**: mvp
**Depends on**: Phase 1
**Requirements**: SYNC-01, SYNC-02, SYNC-03
**Success Criteria** (what must be TRUE):
  1. User can trigger a manual sync via a UI button that calls the backend
  2. After sync, the SQLite database contains bug records with ID, summary, status, priority, sprint, and assignee fields
  3. Each sync run records a timestamp in the database
  4. The dashboard displays the timestamp of the most recent sync
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md — Backend sync layer: bugs table migration, JiraSyncService (OAuth + Jira Cloud API), POST /api/sync/{project_key} + GET /api/projects endpoints, router registration
- [x] 02-02-PLAN.md — Frontend sync UI: NoProjectPage project picker (replaces URL input) with auto-sync, DashboardPage Sync Now button + LastSyncedTimestamp

### Phase 3: Dashboard UI
**Goal**: QA testers can see bug summaries and charts for a selected project
**Mode**: mvp
**Depends on**: Phase 2
**Requirements**: PROJ-01, PROJ-02, SUMM-01, SUMM-02, SUMM-03, CHART-01, CHART-02, UI-01
**Success Criteria** (what must be TRUE):
  1. User sees all synced projects as cards in a grid — each card shows OPEN BUGS count and CRITICAL count with a color-coded left bar
  2. User can add a new project by entering a Jira project key and clicking Connect Project
  3. Bug counts are grouped by status (open/to do) and priority (critical/highest) inline on each card
  4. Priority and status data is visually represented on each card via labeled stat boxes (CHART-01/CHART-02 partial — full charts deferred to Phase 4)
  5. Dashboard is responsive: 3-col at 900px+, 2-col at 900px, 1-col at 600px
**Plans**: 2 plans

Plans:
- [x] 03-01-PLAN.md — CSS Module + static structure: create DashboardPage.module.css, rewrite DashboardPage.jsx with new layout (remove bug table, add PageHeader + ProjectsGrid + ConnectSection)
- [x] 03-02-PLAN.md — Data flow: wire /api/projects fetch, parallel /api/bugs/{key} stats, handleConnect, handleSync card-stat update

### Phase 4: Sprint Report
**Goal**: QA testers can see active-sprint bugs and historical per-sprint trends
**Mode**: mvp
**Depends on**: Phase 3
**Requirements**: SPRINT-01, SPRINT-02
**Success Criteria** (what must be TRUE):
  1. Dashboard shows the list of bugs assigned to the current active sprint
  2. Dashboard shows per-sprint history with bugs opened and closed per sprint
**Plans**: TBD
**UI hint**: yes

### Phase 5: Export
**Goal**: Users can download the current bug report as Excel or Word
**Mode**: mvp
**Depends on**: Phase 4
**Requirements**: EXPORT-01, EXPORT-02
**Success Criteria** (what must be TRUE):
  1. User can click an export button and download a .xlsx file containing the current bug report data
  2. User can click an export button and download a .docx file containing the current bug report data
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Jira Connection | 3/3 | Complete | 2026-05-12 |
| 2. Data Sync | 2/2 | Complete | 2026-05-12 |
| 3. Dashboard UI | 2/2 | Complete | 2026-05-13 |
| 4. Sprint Report | 0/TBD | Not started | - |
| 5. Export | 0/TBD | Not started | - |
