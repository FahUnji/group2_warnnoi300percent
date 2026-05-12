# Phase 2: Data Sync - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-12
**Phase:** 02-data-sync
**Areas discussed:** SQLite vs MySQL, Jira API approach, Project selection flow, Sprint field handling

---

## SQLite vs MySQL

| Option | Description | Selected |
|--------|-------------|----------|
| Stay with SQLite | Already running in Docker, zero extra setup, suitable for low-write QA dashboard | ✓ |
| Switch to MySQL | Matches original requirements text; requires new Docker container, driver changes, rewrite of database.py | |

**User's choice:** Stay with SQLite
**Notes:** Requirements.md references to MySQL are incorrect — SQLite is the authoritative choice.

---

## Jira API Approach

### Auth method

| Option | Description | Selected |
|--------|-------------|----------|
| OAuth token (cloud_id path) | Use access_token + cloud_id from oauth_tokens table; consistent with Phase 1 | ✓ |
| Basic Auth (email + API token) | Re-use jira_config table; contradicts OAuth migration from Phase 1 | |

**User's choice:** OAuth token (cloud_id path)

### Service design

| Option | Description | Selected |
|--------|-------------|----------|
| New JiraSyncService | Single responsibility: data fetch + DB write; file: backend/services/jira_sync_service.py | ✓ |
| Extend JiraService | Add sync methods to existing class; mixes auth and data concerns | |

**User's choice:** New JiraSyncService
**Notes:** No further clarifications.

---

## Project Selection Flow

### First-time project setup

| Option | Description | Selected |
|--------|-------------|----------|
| Add a project on NoProjectPage | Show Jira project list from API; user picks; save to jira_projects; auto-sync | ✓ |
| Hardcode one project for Phase 2 | Skip project selection UI; project_key from config/env | |

**User's choice:** Add a project on NoProjectPage

### After project picked

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-sync then redirect to Dashboard | Picking project triggers immediate sync + spinner + redirect | ✓ |
| Save project then show sync button on Dashboard | Two-step: save project, user manually triggers sync | |

**User's choice:** Auto-sync then redirect to Dashboard
**Notes:** Dashboard also has a sync button for subsequent syncs.

---

## Sprint Field Handling

### Sprint storage strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Parse and store sprint name as TEXT | Extract customfield_10020[0]["name"]; store as sprint_name TEXT; null if none | ✓ |
| Store raw JSON | Store full customfield_10020 value; parse at query time | |
| Skip sprint for Phase 2, add in Phase 4 | Omit from schema; requires migration + re-sync later | |

**User's choice:** Parse and store sprint name as TEXT

### Bug table schema

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal schema (SYNC-02 fields only) | issue_id, issue_key, summary, status, priority, sprint_name, assignee, project_key, synced_at | ✓ |
| Extended schema (labels, reporter, created_date) | Future-proof but adds unused columns | |

**User's choice:** Minimal schema per SYNC-02

---

## Claude's Discretion

None — all areas had clear user selections.

## Deferred Ideas

- Pagination for large projects (>1000 bugs) — maxResults=1000 sufficient for Phase 2
- Auto-sync / cron — v2 requirement, out of scope for all v1 phases
- Sync error recovery with retry logic — Phase 2 shows error banner only
- Multi-project sync UI — Phase 3 (PROJ-01)
