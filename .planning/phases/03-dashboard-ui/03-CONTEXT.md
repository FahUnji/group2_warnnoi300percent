# Phase 3: Dashboard UI - Context

**Gathered:** 2026-05-12
**Status:** Ready for planning (updated to match dashboard.html mockup)

<domain>
## Phase Boundary

Replace the Phase 2 raw bug table dashboard with the visual design from `UI/html/dashboard.html`. Delivers: (1) "Active Projects" page — card grid showing all synced projects, each card with inline OPEN BUGS + CRITICAL counts and a color-coded left bar; (2) "Add New Project" connect section at the bottom of the same page. No pie charts. No separate summary cards row. Bug table is REMOVED. All changes go into `DashboardPage.jsx` and a new `DashboardPage.module.css`.

**Reference mockup:** `UI/html/dashboard.html` + `UI/css/dashboard.css` — implement exactly this design in React.

</domain>

<decisions>
## Implementation Decisions

### Chart Library
- **D-01:** **No chart library needed.** Recharts is NOT required. Phase 3 does not have pie charts. Remove recharts from the plan entirely.

### Project Cards (replaces D-02, D-03, D-04 from original)
- **D-02:** Each project card shows **inline stats** — two stat boxes: OPEN BUGS count + CRITICAL count. Computed from `GET /api/bugs/{project_key}` for that card's project. No click-to-select charts mechanism.
- **D-03:** Each card has a **colored left bar** (5px wide): `#dc2626` red if critical count > 0; `#065b41` green if critical = 0.
- **D-04:** Cards use hover animation (`translateY(-2px)` + green shadow). No "active selected" highlight — all cards are equal. Clicking a card saves `sessionStorage('active_project_key')` for continuity but does NOT change page content in Phase 3.

### Data Flow
- **D-05:** On mount: `GET /api/projects` → for each project in parallel: `GET /api/bugs/{project_key}` → compute openCount (status 'open'/'to do') + criticalCount (priority 'critical'/'highest') → render card with stats + bar color. No separate summary row endpoint needed.

### No Summary Cards Row
- **D-06:** **No separate summary cards row.** Stats are inline on each project card. The three-card row (Total/Open/Critical) is NOT built in Phase 3.

### Bug Table
- **D-07:** **Remove the existing raw bug issue table** from DashboardPage. Keep: Sync button, last-synced timestamp. Remove: bug `<table>` element and all table-related state.

### Add New Project Section
- **D-08:** "Add New Project" connect section at the bottom of DashboardPage. Two-panel layout:
  - Left panel (dark #1b4332): Jira icon + "Connect to Jira" title + subtitle.
  - Right panel (white): "Add New Project" heading, description text, project key input field, "Connect" button.
  - On Connect click: extract project key from input (accept raw key like `SAM` or extract from URL like `https://company.atlassian.net/projects/SAM`), POST `/api/sync/{project_key}`, show loading/error/success inline, on success: re-fetch projects and re-fetch bugs for new project, add new card to grid.
  - Input placeholder: `https://your-company.atlassian.net/projects/ABC` (matches mockup).

### CSS
- **D-09:** Create `frontend/src/pages/DashboardPage.module.css`. All new styles use CSS Modules classes. Do NOT use inline styles for new sections. Follow class names and structure from `UI/css/dashboard.css` exactly where possible.

### Claude's Discretion
- Loading state while fetching per-project bug counts (spinner or skeleton)
- Error state per card if bug fetch fails for one project
- Empty state when GET /api/projects returns 0 projects

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Mockup to implement (PRIMARY reference)
- `UI/html/dashboard.html` — exact HTML structure to replicate in React
- `UI/css/dashboard.css` — exact CSS to replicate in CSS Modules
- `UI/css/shared.css` — shared NavBar styles (already in app from Phase 1/2)

### Existing Dashboard Implementation (to modify)
- `frontend/src/pages/DashboardPage.jsx` — current Phase 2 implementation; remove bug table, rewrite content area
- `frontend/src/App.jsx` — routing; no new routes needed for Phase 3

### Phase 2 Context (decisions to carry forward)
- `.planning/phases/02-data-sync/02-CONTEXT.md` — D-01 thru D-11: SQLite, OAuth token auth, bug schema, project flow

### Requirements
- `.planning/REQUIREMENTS.md` — PROJ-01, PROJ-02, SUMM-01, SUMM-02, SUMM-03, CHART-01, CHART-02, UI-01 are the governing requirements
- `.planning/ROADMAP.md` — Phase 3 success criteria

### Existing Backend Endpoints (no changes needed)
- `GET /api/projects` — returns list of synced projects (from `jira_projects` table)
- `GET /api/bugs/{project_key}` — returns full bug list for a project; frontend computes open + critical counts
- `POST /api/sync/{project_key}` — triggers Jira sync; used by "Add New Project" connect button

### Existing Component Patterns
- `frontend/src/components/LoadingSpinner/LoadingSpinner.jsx` — reuse for loading states
- `frontend/src/pages/NoProjectPage.jsx` — reference for fetch pattern + error handling

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DashboardPage.jsx` → `handleSync()` + Sync button: keep unchanged
- `DashboardPage.jsx` → last-synced timestamp block: keep unchanged
- `LoadingSpinner` component: reuse for loading states
- `fetch()` pattern: follow existing fetch pattern in DashboardPage/NoProjectPage

### Established Patterns
- **CSS Modules** (`*.module.css`) for all component styling — do not use inline styles for new sections
- **Color tokens**: `#1b4332` accent, `#065b41` brand green, `#e7f4f0` brand surface, `#f0f2f5` page bg
- **No component library** — no shadcn, no MUI; plain CSS Modules only
- **Inline SVG** for icons (no external icon lib)
- **`fetch()`** with no wrapper

### Integration Points
- `DashboardPage.jsx`: remove `<table>` bug list; add projects grid + connect section
- `frontend/src/pages/DashboardPage.module.css` (create new): CSS Modules for all new sections
- `frontend/package.json`: NO recharts install needed

</code_context>

<specifics>
## Specific Ideas

- Page title: "Active Projects" (h1, 26px bold #065b41). Subtitle: "Currently monitoring {N} project(s)." (14px #6b7280).
- Project grid: CSS grid repeat(3, 1fr), gap 16px, margin-bottom 32px. Responsive: 2 col at 900px, 1 col at 600px.
- Project card: white bg, 1px border #e5e7eb, border-radius 10px, flex row, min-height 160px. Left bar 5px wide. Card content padding 20px 20px 20px 18px.
- Stat boxes: flex row, gap 10px. Each stat-box: #e7f4f0 bg, border-radius 6px, padding 10px 14px. Label 10px uppercase. Value 26px bold (#065b41 normal, #dc2626 if critical).
- Connect section: border-top 4px solid #065b41. Left panel #1b4332 (320px, white text). Right panel white, padding 40px 40px 40px 48px.

</specifics>

<deferred>
## Deferred Ideas

- **Clicking a card navigates to bug detail page** — Phase 4+ (bug-report.html equivalent)
- **Search/filter bugs** — v2 requirement (FILT-01/02/03)
- **Export from dashboard** — Phase 5 (EXPORT-01/02)
- **Sprint view** — Phase 4 (SPRINT-01/02)
- **Pie charts / status+priority breakdown** — deferred from original Phase 3 plan; may be added in Phase 4

</deferred>

---

*Phase: 3-dashboard-ui*
*Context updated: 2026-05-12 — revised to match UI/html/dashboard.html mockup*
