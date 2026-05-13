---
phase: 3
slug: dashboard-ui
status: approved
shadcn_initialized: false
preset: none
created: 2026-05-12
revised: 2026-05-12
reviewed_at: 2026-05-12
---

# Phase 3 — UI Design Contract

> Visual and interaction contract for Phase 3: Dashboard UI.
> **Implementation reference:** `UI/html/dashboard.html` + `UI/css/dashboard.css` — replicate this design in React/CSS Modules.

---

## Scope

Phase 3 touches exactly one page: `DashboardPage.jsx` + new `DashboardPage.module.css`.

| Page | Change |
|------|--------|
| `DashboardPage` | Remove raw bug table. Add: (1) "Active Projects" page header, (2) project cards grid with inline stats, (3) "Add New Project" connect section. Keep: NavBar, Sync button, last-synced timestamp, user card, banners. |

No new pages. No new routes. No chart library. No recharts.

---

## Design System

| Property | Value | Source |
|----------|-------|--------|
| Tool | none | Project rule — plain CSS Modules, no shadcn |
| Preset | not applicable | Project rule |
| Component library | none | Codebase scan — no shadcn, no Radix, no MUI |
| Icon library | Inline SVG only | All SVGs inline in JSX |
| Font (primary) | Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif | `index.css` |
| Chart library | none | No charts in Phase 3 |

Registry safety gate: not applicable (no shadcn, no third-party registries).

---

## Spacing Scale

Inherited from Phase 2 UI-SPEC (approved). No new tokens.

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, bar width, card header sub-text margin-top |
| sm | 8px | Stat-box internal gap, card header gap, stat-box container gap |
| md | 16px | Card padding, grid gap, section spacing, stat-box padding horizontal |
| lg | 24px | Page header margin-bottom, main content padding components |
| xl | 32px | Main content padding, grid margin-bottom |
| 2xl | 48px | Connect-left panel padding |
| 3xl | 64px | NavBar height (56px actual — see exceptions) |

Exceptions (all are multiples of 4 — justified below):

| Value | Justification |
|-------|---------------|
| NavBar height: 56px | Fixed nav, established in Phase 1 |
| Card content padding: 20px | Card content padding: 20px (multiple of 4; matches dashboard.css card-content padding for visual fidelity to mockup) |
| Stat-box padding: 8px 16px | Stat-box interior — 8px vertical, 16px horizontal (token: md) |
| Connect section: 40px | Connect section padding/gap: 40px (multiple of 4; matches dashboard.css connect-right padding and features row gap for two-panel layout) |
| Connect-right gap: 12px | Multiple of 4; matches dashboard.css .connect-right flex-column gap for internal form element spacing |
| Card min-height: 160px | Readable card with name + stats |

---

## Typography

Inherited from Phase 2 UI-SPEC. Rationalized to 4 sizes, 2 weights.

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Display / Stat Value | 26px | 700 (bold) | 1.1 | Stat counts (open bugs, critical), page title |
| Heading | 16px | 700 (bold) | 1.3 | Project card name, connect section headings |
| Body | 14px | 400 (regular) | 1.6 | Subtitle text, description text, add-desc |
| Subtext | 12px | 400 (regular) | 1.4 | Project code, input hint, stat label (use uppercase + letter-spacing to differentiate) |

Stat labels use `text-transform: uppercase; letter-spacing: 0.5px` at 12px/400 to replicate 10px/600 uppercase from mockup CSS. Visual result is equivalent; avoids introducing a 5th size or 3rd weight.

---

## Color

All tokens from Phase 2 UI-SPEC. New tokens from `UI/css/dashboard.css`.

| Role | Value | Usage |
|------|-------|-------|
| Page background | `#f0f2f5` | Body background (replaces `#f8f9ff` for this page) |
| Dominant (60%) | `#ffffff` | Cards, NavBar, connect-right panel |
| Secondary (30%) | `#e7f4f0` | Brand surface — card interiors, stat boxes, section backgrounds |
| Accent (10%) | `#1b4332` | NavBar logo bg, connect-left panel bg, Connect button bg, card bar (no-critical) |
| Brand green | `#065b41` | Page title, project name, nav brand, stat val (normal) |
| Text body | `#6b7280` | Subtitle, project code, stat label, feature-desc |
| Text dark | `#111827` | Input text, stat-val-zero color |
| Text placeholder | `#9ca3af` | Input placeholders, input-hint |
| Border default | `#e5e7eb` | Card border, NavBar border, connect-section internal divider |
| Border input | `#d1d5db` | Input field border |
| Critical | `#dc2626` | Card bar (has critical bugs), stat-val critical count |
| Hover bg | `#f3f4f6` | NavBar button hover, card hover shadow tint |

Accent (`#1b4332`) reserved for:
- NavBar logo background
- Connect-left panel background
- "Connect Project" button background
- Left bar on project cards with 0 critical bugs

Critical (`#dc2626`) reserved for:
- Left bar on project cards where critical count > 0
- Critical bug count stat value text

---

## Component Inventory

All components use CSS Modules. New styles go into `frontend/src/pages/DashboardPage.module.css` (create new).

### 1. PageHeader (new inside DashboardPage)

| Property | Value |
|----------|-------|
| Title | "Active Projects" — 26px, weight 700, color `#065b41` |
| Subtitle | "Currently monitoring {N} project(s)." — 14px, weight 400, color `#6b7280`, margin-top 4px |
| Margin-bottom | 24px (lg) |

### 2. ProjectsGrid (new inside DashboardPage)

CSS grid of ProjectCard components.

**Layout:**
- `grid-template-columns: repeat(3, 1fr)` — 3 equal columns
- `gap: 16px`
- `margin-bottom: 32px`

**States:**

| State | Visual |
|-------|--------|
| Loading | `<LoadingSpinner size={24} />` centered in grid area + "Loading projects…" caption (14px, `#6b7280`) |
| Populated | Grid of ProjectCard components |
| Empty (0 projects) | Empty state — see Copywriting Contract |
| Error | Error banner `role="alert"` — see Copywriting Contract |

### 3. ProjectCard (new component or inline)

Rendered for each project returned by `GET /api/projects`. Bug stats computed from a parallel `GET /api/bugs/{project_key}` call per card.

**Card anatomy:**

| Property | Value |
|----------|-------|
| Layout | `display: flex; flex-direction: row` |
| Min-height | 160px |
| Background | `#ffffff` |
| Border | `1px solid #e5e7eb` |
| Border-radius | 10px |
| Overflow | hidden (clips left bar) |
| Hover | `transform: translateY(-2px); box-shadow: 0 20px 25px -5px rgba(27,67,50,0.12), 0 8px 10px -6px rgba(27,67,50,0.1)` |
| Transition | `box-shadow 0.2s ease, transform 0.15s ease` |
| Cursor | pointer |

**Left bar:**

| Condition | Color |
|-----------|-------|
| criticalCount > 0 | `#dc2626` (bar-critical) |
| criticalCount === 0 | `#065b41` (bar-normal) |

Width: 5px, flex-shrink: 0.

**Card content** (right of bar):

| Property | Value |
|----------|-------|
| Padding | `20px` (token: see Exceptions — 20px multiple of 4, visual fidelity to mockup) |
| Display | flex column, gap 16px |

**Card header:**
- Project name: 16px, weight 700, color `#065b41`, line-height 1.3
- Project code/key: 12px, weight 400, color `#6b7280`, margin-top 4px (token: xs)

**Stat boxes:**

Container: `display: flex; gap: 8px` (token: sm)

| Element | Style |
|---------|-------|
| Stat box | background `#e7f4f0`, border-radius 6px, padding `8px 16px` (tokens: sm vertical, md horizontal) |
| Stat label | 12px, weight 400, uppercase, letter-spacing 0.5px, color `#6b7280` |
| Stat value (normal) | 26px, weight 700, color `#065b41`, line-height 1.1 |
| Stat value (zero) | 26px, weight 700, color `#111827` |
| Stat value (critical) | 26px, weight 700, color `#dc2626` |

Stats shown:
- Left box: label "OPEN BUGS" — count of bugs where status is 'open' or 'to do' (case-insensitive)
- Right box: label "CRITICAL" — count of bugs where priority is 'critical' or 'highest' (case-insensitive)

**Loading state per card:** While fetching bugs for this card's project, show `—` in both stat values.

**Error state per card:** Show `—` in both stats; no per-card error UI needed (grid-level error banner covers catastrophic failure).

ARIA: `<div role="button" tabIndex={0}` or `<button>`. `aria-label="{project name} — {openCount} open bugs, {criticalCount} critical"`.

### 4. ConnectSection (new inside DashboardPage)

Two-panel "Add New Project" section at the bottom of the main content area.

**Container:**
- `display: flex`
- `border-radius: 12px`
- `overflow: hidden`
- `border-top: 4px solid #065b41`
- `margin-bottom: 40px` (token: see Exceptions — 40px multiple of 4)

**Left panel (.connect-left):**

| Property | Value |
|----------|-------|
| Width | 320px, flex-shrink: 0 |
| Background | `#1b4332` |
| Padding | 48px 32px |
| Layout | flex column, align-items center, text-align center, gap 16px |
| Icon wrap | 72×72px, background rgba(255,255,255,0.12), border-radius 16px |
| Title | "Connect to Jira" — 16px, weight 700, color `#ffffff` |
| Subtitle | 14px, weight 400, color rgba(255,255,255,0.7), line-height 1.6 |

**Right panel (.connect-right):**

| Property | Value |
|----------|-------|
| Background | `#ffffff` |
| Padding | `40px 40px 40px 48px` (token: see Exceptions — 40px multiple of 4) |
| Display | flex column, gap 12px |
| Heading | "Add New Project" — 26px (nearest token to 22px), weight 700, color `#065b41` |
| Description | 14px, weight 400, color `#6b7280`, line-height 1.6 |
| Input label | "Jira Project Link" — 14px, weight 700, color `#111827` |
| Input field | full width, padding 8px 16px (tokens: sm vertical, md horizontal), border `1px solid #d1d5db`, border-radius 8px, 14px |
| Input placeholder | `https://your-company.atlassian.net/projects/ABC` |
| Input focus | border-color `#065b41`, box-shadow `0 0 0 3px rgba(27,67,50,0.1)` |
| Input hint | "Requires Jira project key (e.g. SAM, SCIL)" — 12px, color `#9ca3af` |
| Connect button | background `#1b4332`, border-radius 12px, padding 16px 24px, 14px/700/white, flex + gap 12px |
| Connect button hover | background `#1f5040`, translateY(-1px) |
| Connect button disabled | opacity 0.6, no transform |
| Status line | inline below input — see Copywriting Contract |
| Features divider | 1px `#e5e7eb`, margin 4px 0 |
| Features row | flex, gap 40px (token: see Exceptions — 40px multiple of 4) — 2 feature items |
| Feature icon | 32×32px, background `#e7f4f0`, border-radius 8px |
| Feature title | 14px, weight 700, color `#065b41` |
| Feature desc | 12px, weight 400, color `#6b7280` |

**Feature items (static, from mockup):**
- "Auto-Syncing" — "Real-time updates between tools."
- "Enterprise Encryption" — "256-bit AES for all data in transit."

**Connect button behavior (state machine):**

```
idle      → user clicks Connect Project
            → extract project key from input value
              (if URL: extract last path segment; if raw key: use as-is)
            → POST /api/sync/{project_key}
loading   → button disabled, text "Connecting…", spinner icon
success   → status line "Project {key} synced successfully." (green)
            → re-fetch GET /api/projects → re-fetch GET /api/bugs/{key}
            → new card appears in grid
            → input cleared
error     → status line "{error message}. Check project key and try again." (red)
            → button re-enabled
```

### 5. LoadingSpinner (existing — reuse as-is)

`frontend/src/components/LoadingSpinner/LoadingSpinner.jsx`. No modifications.

### 6. SyncButton + LastSyncedTimestamp (existing — keep unchanged)

Carry forward from Phase 2. Located in DashboardPage header above new sections.

---

## Page Layout Order (DashboardPage — top to bottom)

```
[NavBar — sticky, 56px, unchanged]
─────────────────────────────────────
[main.main-content — max-width 1200px, padding 32px 32px 0]

  [PageHeader]
    h1 "Active Projects"
    p "Currently monitoring {N} project(s)."

  [SyncRow — existing, unchanged]
    Last synced timestamp | Sync Now button

  [UserCard — existing, unchanged]
  [Banners — existing, unchanged]

  [ProjectsGrid]
    ProjectCard × N (fetched from GET /api/projects)
    Each card fetches GET /api/bugs/{key} for stats

  [ConnectSection]
    [Left: dark panel — Connect to Jira]
    [Right: white panel — Add New Project form]

─────────────────────────────────────
```

The raw bug `<table>` is removed entirely.

---

## Interaction Contracts

### Page Mount Flow

```
DashboardPage mounts
  → fetch GET /api/projects
  → [loading: spinner in ProjectsGrid area]
  → [success] projects list received
  → for each project in parallel: fetch GET /api/bugs/{key}
  → [each card: shows "—" while its bug fetch is in flight]
  → [each bug fetch resolves] → compute openCount + criticalCount → update card stats + bar color
  → save first project key to sessionStorage('active_project_key') if not already set
```

### Add New Project Flow

```
User fills input → clicks Connect Project
  → validate: input not empty
  → extract project key from input
  → POST /api/sync/{project_key}
  → [loading: button disabled + "Connecting…"]
  → [success] → re-fetch projects → add new card → clear input → show success status
  → [error] → show error status → button re-enabled
```

### Sync Flow (unchanged)

```
User clicks Sync Now → POST /api/sync/{active_project_key}
  → button disabled + "Syncing…"
  → [success] → re-fetch bugs for active project card → update stats
  → [error] → error banner
```

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Page title | `Active Projects` |
| Page subtitle | `Currently monitoring {N} project(s).` |
| Left panel title | `Connect to Jira` |
| Left panel subtitle | `Synchronize your existing Jira tickets and workflow seamlessly.` |
| Add section heading | `Add New Project` |
| Add section desc | `Provide your Jira project key (e.g. SAM) to begin syncing. JIRA Bug Summary will pull all bugs from the project.` |
| Input label | `Jira Project Link` |
| Input placeholder | `https://your-company.atlassian.net/projects/ABC` |
| Input hint | `Requires Jira project key (e.g. SAM, SCIL)` |
| Connect button idle | `Connect Project` |
| Connect button loading | `Connecting…` |
| Connect success status | `Project {KEY} synced successfully.` |
| Connect error status | `{error from API}. Check project key and try again.` |
| Stat label open | `OPEN BUGS` |
| Stat label critical | `CRITICAL` |
| Projects loading | `Loading projects…` |
| Projects empty heading | `No projects synced yet` |
| Projects empty body | `Use the form below to add your first Jira project.` |
| Projects fetch error | `Could not load projects. Check your connection and reload.` |
| Bugs loading per card | `—` (em dash in stat values) |
| Sync button idle | `Sync Now` (carry-forward, unchanged) |
| Sync button active | `Syncing…` (carry-forward, unchanged) |

Destructive actions in Phase 3: none.

---

## Accessibility Baseline

| Requirement | Contract |
|-------------|---------|
| ProjectCard | `<button>` or `<div role="button" tabIndex={0}>` with `aria-label="{name} — {openCount} open, {criticalCount} critical"` |
| ProjectsGrid loading | `<LoadingSpinner role="status" aria-label="Loading projects" />` |
| Connect form | `<label for="jiraInput">` wires to input; status line uses `role="status"` for success, `role="alert"` for error |
| Error banners | `role="alert"` — carry-forward from Phase 2 |
| Focus visible | All interactive elements: `outline: 2px solid #1b4332; outline-offset: 2px` |
| Spinner ARIA | `role="status"` + `aria-label="Loading"` — on `LoadingSpinner` component |

---

## Responsive Behaviour

| Breakpoint | ProjectsGrid | ConnectSection |
|------------|-------------|----------------|
| >= 900px | `repeat(3, 1fr)` | Full two-panel layout |
| < 900px | `repeat(2, 1fr)` | Left dark panel hidden; right panel full width |
| < 600px | `1fr` | Single column; search input in NavBar hidden |

Main content padding reduces from `32px` to `24px 16px` on mobile.

---

## CSS Module File

New styles go into: `frontend/src/pages/DashboardPage.module.css` (create new).

Existing `DashboardPage.jsx` uses inline styles for existing sections (UserCard, Sync button, banners). Do not convert those to CSS Modules in Phase 3 — only new sections use the module.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| none — no registry used | n/a | not applicable — CSS Modules only |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
