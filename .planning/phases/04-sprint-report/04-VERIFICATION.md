---
phase: 04-sprint-report
verified: 2026-05-13T07:30:00Z
status: gaps_found
score: 9/12 must-haves verified
overrides_applied: 0
re_verification: false
gaps:
  - truth: "Dashboard sidebar shows a Sprint nav link that passes the active project key in the URL"
    status: failed
    reason: "Commit aade1e1 ('Excecute, run ui phase 4') stripped 54 lines from DashboardPage.jsx, removing the sidebar aside and Sprint link that commit 59c7e42 had added. The current DashboardPage has no sidebar, no layout wrapper, and no Sprint link. Zero matches for 'sprint', '/sprint?project=', 'sidebar', or 'sidebarNav' in DashboardPage.jsx."
    artifacts:
      - path: "frontend/src/pages/DashboardPage.jsx"
        issue: "Sidebar and Sprint nav link were removed by a subsequent commit. No reference to styles.sidebar, styles.sidebarNav, or /sprint?project= exists in the file."
    missing:
      - "Restore sidebar aside with Dashboard (active), Bug Report (disabled), and Sprint nav links inside the projects.length > 0 branch of DashboardPage.jsx"
      - "Sprint link must pass /sprint?project={projects[0].key} (per D-07)"
      - "Wrap projects branch main content in <div className={styles.layout}> flex wrapper alongside sidebar"

  - truth: "Clicking the Sprint sidebar link on DashboardPage navigates to /sprint?project={key}"
    status: failed
    reason: "Derived from the same root cause as above — no Sprint sidebar link exists in DashboardPage.jsx to click."
    artifacts:
      - path: "frontend/src/pages/DashboardPage.jsx"
        issue: "No Sprint link present. Project card onClick navigates to /bug-report, not /sprint."
    missing:
      - "Same fix as above — restore sidebar Sprint link"

  - truth: "Sprint JOIN bug counts on sprint_id (not sprint_name) — WR-06 fix applied"
    status: failed
    reason: "Commit f59f864 (WR-06 fix) changed the LEFT JOIN to use sprint_id. Commit c045b02 performed a full-file rewrite of jira_sprint_service.py that silently reverted this fix. Current _get_sprint_stats() at line 196 joins on b.sprint_name = s.sprint_name. This means sprint bug counts break when Jira sprint names have trailing spaces or case differences between Board API and issue fields — the exact fragility the code review flagged."
    artifacts:
      - path: "backend/services/jira_sprint_service.py"
        issue: "Line 196: LEFT JOIN uses sprint_name string match, not sprint_id. WR-06 fix was silently reverted by commit c045b02."
    missing:
      - "Change LEFT JOIN condition from: b.sprint_name = s.sprint_name AND b.project_key = s.project_key"
      - "To: b.sprint_id = s.sprint_id AND b.project_key = s.project_key"
      - "Requires bugs.sprint_id to be populated by jira_sync_service.py (WR-06 also added that — verify it survived c045b02)"
---

# Phase 4: Sprint Report Verification Report

**Phase Goal:** QA testers can see active-sprint bugs and historical per-sprint trends — Sprint page shows active and completed sprints with bug counts, severity breakdown, and progress; sprint data syncs from Jira Board API.
**Verified:** 2026-05-13T07:30:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can navigate to /sprint?project=PROJ_KEY and see a full sprint page | VERIFIED | App.jsx line 13: `<Route path="/sprint" element={<SprintPage />} />`. SprintPage.jsx 565 lines, full mockup-faithful UI. |
| 2 | Active sprint card is auto-expanded on load; completed sprints collapsed | VERIFIED | SprintPage.jsx lines 84-87: `setExpandedIds(new Set(sorted.filter(s => s.state === 'active').map(s => s.sprint_id)))` on data load. |
| 3 | Each sprint card shows Found count, Resolved count, and progress percentage | VERIFIED | SprintPage.jsx lines 479-500: statMini blocks for Found/Resolved; calcProgress() renders % in progressLabels. |
| 4 | Expanding a sprint card shows Critical/High/Medium/Low severity breakdown | VERIFIED | SprintPage.jsx lines 519-548: severityCards section with four severityItem divs. _get_sprint_stats() returns all four fields. |
| 5 | Export Report dropdown opens and closes without performing a real export | VERIFIED | SprintPage.jsx lines 381, 399: both export buttons call `setExportOpen(false)` only — no fetch, no download. |
| 6 | Refresh Data button re-fetches sprint data from the backend | VERIFIED | SprintPage.jsx line 415: `onClick={fetchSprints}`. fetchSprints() calls POST /api/sync then GET /api/sprints. |
| 7 | Sidebar shows Dashboard / Bug Report / Sprint links; Sprint is highlighted active | VERIFIED | SprintPage.jsx lines 319-349: three nav links; Sprint uses `styles.navLinkActive`; Bug Report has aria-disabled. |
| 8 | Page subtitle shows: {project_name} · {N} sprints · Last synced X min ago | VERIFIED | SprintPage.jsx line 360: `{projectName || projectKey} · {sprints.length} sprints · Last synced {formatSyncedAgo(syncedAt)}` |
| 9 | Navigating to /sprint?project=PROJ_KEY renders SprintPage (not a 404/redirect) | VERIFIED | App.jsx: Route wired before wildcard. SprintPage imported and used. |
| 10 | Dashboard sidebar shows a Sprint nav link that passes the active project key | FAILED | DashboardPage.jsx has NO sidebar. Commit aade1e1 removed 54 lines including the entire sidebar aside and Sprint link added by commit 59c7e42. Zero matches for 'sprint' or 'sidebar' in current DashboardPage.jsx. |
| 11 | Clicking the Sprint sidebar link on DashboardPage navigates to /sprint?project={key} | FAILED | Derived failure — no Sprint link exists to click in DashboardPage. |
| 12 | Graceful fallback when Jira unreachable: stale data banner shown | VERIFIED | _fetch_sprints_and_store() returns stale:true on all Jira failure paths (lines 234, 244, 251, 258). SprintPage.jsx lines 427-430: staleBanner shown when stale===true, independent of error state (CR-03 fix applied). |

**Score:** 9/12 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/services/jira_sprint_service.py` | Board API discovery, sprint fetch, SQLite upsert, bug count aggregation | VERIFIED | 272 lines. All 5 functions present: _fetch_board_id, _fetch_sprint_list, _upsert_sprints, _get_sprint_stats, _fetch_sprints_and_store. JiraSprintService async wrapper at line 268. |
| `backend/database.py` | sprints table migration | VERIFIED | Lines 66-77: `CREATE TABLE IF NOT EXISTS sprints` with sprint_id, sprint_name, state, start_date, end_date, project_key, synced_at. UNIQUE(sprint_id, project_key) constraint present. |
| `backend/routers/sync.py` | GET /api/sprints/{project_key} endpoint | VERIFIED | Line 129: `@router.get("/sprints/{project_key}")`. JiraSprintService imported at line 19. Project key validation at line 142. |
| `frontend/src/pages/SprintPage.jsx` | Full sprint page (min 200 lines) | VERIFIED | 565 lines. Collapsible sprint cards, severity breakdown, export stubs, pagination, stale banner, error banner, useSearchParams. |
| `frontend/src/pages/SprintPage.module.css` | CSS module with .sprintCard | VERIFIED | 576 lines. Contains .sprintCard, .barActive, .barDone, .badgeActive, .badgeDone, .progressFill, .staleBanner. Brand colors present. |
| `frontend/src/App.jsx` | /sprint route wired to SprintPage | VERIFIED | Line 5: `import SprintPage`. Line 13: `<Route path="/sprint" element={<SprintPage />} />`. |
| `frontend/src/pages/DashboardPage.jsx` | Sprint link in sidebar with project key query param | FAILED | MISSING. Sidebar was added in commit 59c7e42 then stripped by commit aade1e1. Current file has no sidebar, no Sprint link. 692 lines with zero matches for 'sprint', 'sidebar', or '/sprint?project='. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `frontend/src/pages/SprintPage.jsx` | `/api/sprints/{project_key}` | fetch on mount and Refresh Data | WIRED | Line 66: `fetch('/api/sprints/${encodeURIComponent(projectKey)}')`. Called in fetchSprints() which runs on mount (useEffect line 99) and on button click (line 415). |
| `backend/routers/sync.py` | `backend/services/jira_sprint_service.py` | import and call | WIRED | Line 19: import. Line 42: fire-and-forget call in trigger_sync. Line 145: direct call in get_sprints endpoint. |
| `backend/database.py` | sprints table | init_db() migration block | WIRED | Lines 66-77: CREATE TABLE IF NOT EXISTS sprints inside init_db(). |
| `frontend/src/App.jsx` | `frontend/src/pages/SprintPage.jsx` | Route path=/sprint | WIRED | Line 5: import SprintPage. Line 13: Route element={<SprintPage />}. |
| `frontend/src/pages/DashboardPage.jsx` | `/sprint?project={selectedProjectKey}` | sidebar nav link | NOT_WIRED | Sidebar was removed. No href to /sprint in DashboardPage.jsx. DashboardPage.module.css still has sidebar CSS classes but they are orphaned — not referenced by any JSX. |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `SprintPage.jsx` | `sprints` | GET /api/sprints/{project_key} | Yes — `_get_sprint_stats()` aggregates from SQLite `sprints` JOIN `bugs` tables; `_fetch_sprints_and_store()` upserts fresh Board API data | FLOWING |
| `SprintPage.jsx` | `stale` | `data.stale` from API response | Yes — set to true on all Jira failure paths in `_fetch_sprints_and_store` | FLOWING |
| `jira_sprint_service.py` `_get_sprint_stats` | Bug count aggregation | LEFT JOIN bugs on sprint_name | FRAGILE — joins on string match (sprint_name), not sprint_id (WR-06 fix was silently reverted by commit c045b02). Will produce empty/incorrect counts if Jira sprint names differ from Board API sprint names. | WARNING |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| GET /api/sprints route registered | `grep "@router.get.*sprints" backend/routers/sync.py` | `@router.get("/sprints/{project_key}")` at line 129 | PASS |
| SprintPage fetch uses encodeURIComponent | `grep "encodeURIComponent" frontend/src/pages/SprintPage.jsx` | Line 65: `/api/sync/`, line 66: `/api/sprints/` both use encodeURIComponent | PASS |
| App.jsx /sprint route | `grep "path.*sprint" frontend/src/App.jsx` | `path="/sprint"` at line 13 | PASS |
| Dashboard Sprint link | `grep "sprint" frontend/src/pages/DashboardPage.jsx` | 0 matches | FAIL |
| sprint_id join (WR-06) | `grep "JOIN.*sprint_id" backend/services/jira_sprint_service.py` | 0 matches — join uses sprint_name (WR-06 reverted) | FAIL |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SPRINT-01 | 04-01, 04-02 | Dashboard shows bugs assigned to the current active sprint | PARTIAL | SprintPage shows active sprint (auto-expanded with bug counts). Sprint page is reachable via direct URL. BUT Dashboard sidebar Sprint link missing — no in-app navigation path from Dashboard to Sprint page. |
| SPRINT-02 | 04-01, 04-02 | Dashboard shows per-sprint history — total, open, resolved counts with bug count by priority | PARTIAL | SprintPage shows per-sprint history with found/resolved/critical/high/medium/low counts. Reachable via direct URL. Same navigation gap as SPRINT-01. |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `frontend/src/pages/DashboardPage.module.css` | 1158-1248 | Dead CSS — `.sidebar`, `.sidebarNav`, `.sidebarNavLink`, `.sidebarNavLinkActive` defined but no JSX references them | Warning | CSS bloat; orphaned styles will cause confusion. No functional impact. |
| `backend/services/jira_sprint_service.py` | 196 | WR-06 regression — `LEFT JOIN bugs b ON b.sprint_name = s.sprint_name` (string match reverted from sprint_id join) | Warning | Sprint bug counts may be 0 or incorrect if sprint name strings differ between bugs.sprint_name and sprints.sprint_name (e.g. trailing whitespace, Jira API format differences). Non-blocking for page render but produces inaccurate data. |

---

## Human Verification Required

### 1. Sprint page data accuracy end-to-end

**Test:** With a real Jira OAuth token configured, sync a project, navigate to `/sprint?project=KEY`. Confirm sprint cards show non-zero bug counts matching Jira sprint data.
**Expected:** Found/Resolved counts match bugs table GROUP BY sprint. Active sprint auto-expanded.
**Why human:** Requires live Jira credentials and real data. SQL join fragility (sprint_name) may produce zeros — human must compare against Jira.

### 2. Dashboard to Sprint navigation path is broken

**Test:** Log into the dashboard, view a project. Look for a Sprint navigation link in the sidebar.
**Expected:** A sidebar with "Sprint" link should be visible, navigating to /sprint?project=KEY.
**Why human:** This is a confirmed code gap (no sidebar in DashboardPage.jsx), but the human should confirm the regression is visible in the running UI — not just a lint failure.

---

## Gaps Summary

**Root cause:** Commit `aade1e1` ("Excecute, run ui phase 4", 2026-05-13 12:34) performed a partial rewrite of `DashboardPage.jsx` that stripped 54 lines including the entire sidebar structure and Sprint nav link. This sidebar had been correctly added by commit `59c7e42` (feat(04-02): add Sprint sidebar link to DashboardPage) and then fixed by commit `171796b` (WR-03 fix). The later overwriting commit silently destroyed this work.

**Secondary regression:** Commit `c045b02` ("fix(sprint): show completed+active sprints and fix sync reliability", 2026-05-13 13:05) performed a full file rewrite of `jira_sprint_service.py` that silently reverted the WR-06 fix. The approved fix changed the LEFT JOIN from sprint_name string match to sprint_id integer join. The full rewrite re-introduced the old sprint_name join.

**Gap 1 (BLOCKER):** Dashboard has no Sprint sidebar link. Users cannot navigate from the dashboard to the sprint page through the UI. They must know to manually type `/sprint?project=KEY`. This breaks the phase plan's must_have from 04-02-PLAN.md ("Dashboard sidebar shows a Sprint nav link that passes the active project key in the URL").

**Gap 2 (WARNING):** Sprint bug count aggregation joins on sprint_name string, not sprint_id. The code review explicitly flagged this as fragile and the fix (WR-06) was committed. The fix was then silently reverted by a full-file overwrite. Bug counts will be zero or incorrect when sprint_name strings differ.

**What works correctly:**
- Sprint page full UI (SprintPage.jsx, SprintPage.module.css) — all must-haves met
- Backend sprint service (jira_sprint_service.py) — Board API, upsert, fallback
- GET /api/sprints/{project_key} endpoint — wired and handles errors
- Stale data fallback with banner — backend returns stale:true, frontend shows staleBanner
- /sprint route in App.jsx — navigating directly to URL works
- sprints table migration in database.py — schema correct with UNIQUE constraint

---

_Verified: 2026-05-13T07:30:00Z_
_Verifier: Claude (gsd-verifier)_
