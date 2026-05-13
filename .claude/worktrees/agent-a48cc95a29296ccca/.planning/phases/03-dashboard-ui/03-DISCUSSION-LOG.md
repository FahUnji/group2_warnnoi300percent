# Phase 3: Dashboard UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-12
**Phase:** 3-dashboard-ui
**Areas discussed:** Chart library, Chart type, Project switcher, Bug table

---

## Chart Library

| Option | Description | Selected |
|--------|-------------|----------|
| Recharts | React-native SVG charts, ~180KB gzipped, simple API | ✓ |
| Chart.js + react-chartjs-2 | Canvas-based, heavier setup, more chart variety | |
| Custom CSS/SVG bars (no dependency) | Zero bundle cost, more code to write | |

**User's choice:** Recharts
**Notes:** No chart library was installed before this phase. Recharts selected for React-native API and clean integration.

---

## Chart Type

| Option | Description | Selected |
|--------|-------------|----------|
| Bar chart for both | Easy to read exact counts for status and priority | |
| Pie chart for both | Shows proportions; good fit for 4-value priority | ✓ |
| Bar for status, Pie for priority | Status → bar (many values), priority → pie (4 values) | |

**User's choice:** Pie chart for both
**Notes:** Both status and priority breakdowns will use PieChart from Recharts.

---

## Project Switcher

| Option | Description | Selected |
|--------|-------------|----------|
| Dropdown in dashboard header | Select dropdown stays on dashboard page | |
| Link back to NoProjectPage | "Switch Project" button redirects | |
| Project card grid | Each synced project shown as a clickable card; click to select; charts update below | ✓ |

**User's choice:** Project card grid (user clarified via freeform: "the project will displays in each card and user can select added project")
**Notes:** User described the UX as: Connect Jira → Already Have Project → Dashboard shows project cards. Each card = one synced project. Clicking a card selects it as active project; summary cards + charts below update accordingly.

---

## Bug Table

| Option | Description | Selected |
|--------|-------------|----------|
| Keep the bug table below charts | Charts at top, raw issue list below | |
| Remove the bug table | Dashboard shows only project cards + summary + charts | ✓ |

**User's choice:** Remove the bug table
**Notes:** Phase 3 replaces the Phase 2 raw issue table with proper visual summaries. Cleaner dashboard experience.

---

## Claude's Discretion

- Pie chart color scheme for status/priority slices
- Card layout spacing and responsive behavior
- Pie chart legend placement (beside or below)
- Empty state when no bugs for selected project

## Deferred Ideas

- Bug detail drill-down — v2 out of scope
- Search/filter — v2 requirements (FILT-01/02/03)
- Export — Phase 5
- Sprint view — Phase 4
