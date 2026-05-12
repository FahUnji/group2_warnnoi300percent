# Phase 3: Dashboard UI - Context

**Gathered:** 2026-05-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the Phase 2 raw bug table dashboard with a proper visual dashboard. Delivers: (1) project cards grid at the top — one card per synced project, click to select active project; (2) three summary cards (total bugs, open, critical) for the selected project; (3) two pie charts (status breakdown, priority breakdown) for the selected project. Bug table is REMOVED. No new pages or routes — all changes go into `DashboardPage.jsx`.

</domain>

<decisions>
## Implementation Decisions

### Chart Library
- **D-01:** Use **Recharts** for all charts. Install via `npm install recharts`. Use `<PieChart>` + `<Pie>` + `<Cell>` components. No other chart library needed.

### Chart Types
- **D-02:** Both status breakdown and priority breakdown render as **pie charts**. One pie for status (Open/In Progress/Closed/etc.), one pie for priority (Critical/High/Medium/Low).

### Project Switcher
- **D-03:** Dashboard top section shows a **card grid of all synced projects**. Each project has its own card showing the project name (and optionally the project key). Clicking a card sets it as the active project — the summary cards and charts below update immediately to show that project's data. No redirect to NoProjectPage for switching.
- **D-04:** The active project card is highlighted with the accent color (`#1b4332` background or border). Only one project can be active at a time.
- **D-05:** Projects available in the grid come from calling `GET /api/projects` (already exists from Phase 2 — returns list of synced `jira_projects` rows). projectKey is stored in `sessionStorage('active_project_key')` — pre-select that project on mount.

### Summary Cards
- **D-06:** Three summary cards displayed as a row below the project grid: **Total Bugs**, **Open Bugs**, **Critical Bugs**. Counts are computed on the frontend from the bug list returned by `GET /api/bugs/{project_key}`. No new backend endpoint needed for summaries.

### Bug Table
- **D-07:** **Remove the existing raw bug issue table** from DashboardPage. Phase 3 replaces it with the chart + summary card layout. The Sync button and last-synced timestamp line are kept.

### Data Flow
- **D-08:** On project card click: fetch `GET /api/bugs/{project_key}` → compute summary counts → compute status/priority distributions → render cards + charts. Same endpoint used in Phase 2, no backend changes needed.

### Claude's Discretion
- Pie chart color scheme for slices — use the established color tokens where possible (red for Critical, etc.) but Claude can pick a tasteful palette
- Exact card layout spacing and responsive behavior within the established CSS Modules + color token system
- Whether to show a legend beside or below each pie chart
- Empty state when no bugs exist for the selected project

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Dashboard Implementation (to modify)
- `frontend/src/pages/DashboardPage.jsx` — current Phase 2 implementation; remove bug table, add project grid + summary cards + pie charts
- `frontend/src/App.jsx` — routing; no new routes needed for Phase 3

### Phase 2 Context (decisions to carry forward)
- `.planning/phases/02-data-sync/02-CONTEXT.md` — D-01 thru D-11: SQLite, OAuth token auth, bug schema, project flow
- `.planning/phases/02-data-sync/02-UI-SPEC.md` — color tokens, typography scale, spacing scale, design system rules

### Requirements
- `.planning/REQUIREMENTS.md` — PROJ-01, PROJ-02, SUMM-01, SUMM-02, SUMM-03, CHART-01, CHART-02, UI-01 are the governing requirements
- `.planning/ROADMAP.md` — Phase 3 success criteria

### Existing Backend Endpoints (no changes needed)
- `GET /api/projects` — returns list of synced projects (from `jira_projects` table)
- `GET /api/bugs/{project_key}` — returns full bug list for a project; frontend aggregates for charts

### Existing Component Patterns
- `frontend/src/components/LoadingSpinner/LoadingSpinner.jsx` — reuse for loading states
- `frontend/src/pages/NoProjectPage.jsx` — reference for project card styling pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DashboardPage.jsx` → `handleSync()` + Sync button: keep unchanged
- `DashboardPage.jsx` → last-synced timestamp block: keep unchanged
- `DashboardPage.jsx` → `statusColor()` + `priorityColor()` helpers: reuse for pie chart slice colors
- `LoadingSpinner` component: reuse for loading states when fetching bug data
- `sessionStorage('active_project_key')`: already set by NoProjectPage — read on mount to pre-select project card

### Established Patterns
- **CSS Modules** (`*.module.css`) for all component styling — do not use inline styles for new components
- **Color tokens from UI-SPEC** — use `#1b4332` accent, `#f8f9ff` secondary bg, `#002d1c` text primary, `#c3c6d6` borders
- **No component library** — no shadcn, no MUI; plain CSS + Recharts only
- **Inline SVG** for icons (no external icon lib)
- **`fetch()`** with no wrapper — follow existing fetch pattern in DashboardPage

### Integration Points
- `DashboardPage.jsx`: remove `<table>` bug list; add project grid + summary cards + pie charts above sync controls
- `frontend/package.json`: add `recharts` dependency
- `frontend/src/pages/DashboardPage.module.css` (create if not exists): CSS Modules styles for new dashboard sections

</code_context>

<specifics>
## Specific Ideas

- Project cards: shown as a card grid at the top of the page. Each card shows project name + project key. Active card highlighted with `#1b4332` border or background tint.
- Summary cards: 3 cards in a row — "Total Bugs", "Open Bugs", "Critical Bugs" with large count numbers.
- Charts: two side-by-side pie charts. Left: "By Status". Right: "By Priority".
- On mount: read `sessionStorage('active_project_key')`, find matching project card, auto-select it, load its bugs.

</specifics>

<deferred>
## Deferred Ideas

- **Drill-down into individual bug details** — v2, out of scope (PROJECT.md Out of Scope)
- **Search/filter bugs** — v2 requirement (FILT-01/02/03), Phase 4+
- **Export from dashboard** — Phase 5 (EXPORT-01/02)
- **Sprint view** — Phase 4 (SPRINT-01/02)

</deferred>

---

*Phase: 3-dashboard-ui*
*Context gathered: 2026-05-12*
