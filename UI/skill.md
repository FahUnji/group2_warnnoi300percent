# JIRA Bug Summary — Project Logic

## Overview
A JIRA bug tracking dashboard that authenticates via Atlassian OAuth 2.0 and visualises project bug data. Built with vanilla HTML/CSS/JS on the frontend and Express.js on the backend.

---

## Page Flow

```
login.html  →  (OAuth)  →  dashboard.html  →  (click Manao Meal card)  →  bug-report.html
                                ↓
                          no-project.html  (if no project connected)
                          sprint.html      (sprint view via sidebar)
```

---

## Backend — `server.js`

| Route | Method | Purpose |
|---|---|---|
| `/` | GET | Redirect to `/UI/login.html` |
| `/auth/start` | POST | Generate Atlassian OAuth URL with random `state` param, return to client |
| `/auth/callback` | GET | Receive OAuth code, exchange for token, fetch Jira site info, redirect to dashboard |
| `/UI/*` | static | Serve all HTML/CSS/JS/assets |

**Auth flow:**
1. Client calls `POST /auth/start` → server generates `state`, builds Atlassian authorize URL, responds with `{ authUrl }`.
2. Browser opens `authUrl` → user logs in on Atlassian.
3. Atlassian redirects to `GET /auth/callback?code=...&state=...`.
4. Server validates `state`, exchanges `code` for access token, fetches accessible Jira resources, redirects to dashboard with `?connected=1&site=...&url=...`.

**Environment variables** (`.env`):
- `ATLASSIAN_CLIENT_ID`
- `ATLASSIAN_CLIENT_SECRET`
- `REDIRECT_URI` (default: `http://localhost:3000/auth/callback`)
- `APP_URL` (default: `http://localhost:3000/UI/login.html`)

---

## Pages

### `login.html`
- Hero split layout: left branding copy, right login card.
- "Continue with Atlassian" button calls `POST /auth/start` and opens the returned `authUrl`.

### `dashboard.html`
- Lists active projects as clickable cards in a grid.
- **Manao Meal card** (PRJ-009) links to `bug-report.html`.
- Bottom section: "Connect to Jira" form — enter a Jira project URL and click Connect.
- Each card shows Open Bugs count and Critical count; a coloured left bar indicates severity (`bar-critical` = red, `bar-normal` = neutral).

### `no-project.html`
- Shown when no Jira project is connected yet.
- Provides a Jira URL input to connect a project.

### `sprint.html`
- Sprint-level view of bugs/tasks.
- Shares the same topnav and sidebar pattern as `bug-report.html`.

### `bug-report.html`
- Main analytics view for a project (currently scoped to Manao Meal).
- **Sidebar** navigation: Dashboard, Bug Report, Sprint.
- **Stat cards row**: Total Bugs (1,284), Open Bugs, Resolved.
- **Charts row**: two chart cards side by side.

---

## Bug Report Charts

### Bugs by Priority (donut)
- SVG viewBox `240×240`, radius `104`, `stroke-width="28"`.
- Four arcs using `stroke-dasharray` to draw segments: Critical, High, Medium, Low.
- Each arc has `class="donut-arc"` for CSS hover (stroke widens to `34` on hover).
- `onmouseenter` calls `showDonutTip(event, label, pct, color)` → shows `#donutTip`.
- `onmouseleave` calls `hideDonutTip()`.
- Center overlay shows total bug count ("1,284") and label ("Total Bugs").

### Status Distribution (donut)
- SVG viewBox `192×192`, rendered at `160×160`, radius `80`, `stroke-width="16"`.
- Single arc (100% Done, colour `#065b41`).
- Has `class="donut-arc"` — CSS hover widens stroke to `22` (scoped via `.chart-status .donut-arc:hover`).
- `onmouseenter` calls `showDonutTip(event, 'Done', '100%', '#065b41', 'statusDonutTip')`.
- Has its own tooltip element `#statusDonutTip`.
- Center shows "100%" and "Done".

---

## JS — `bug-report.js`

```
showDonutTip(event, label, pct, color, tipId?)
  → finds tip element by tipId (default: "donutTip")
  → sets text, border colour, adds "visible" class
  → calls moveTip, attaches mousemove listener

hideDonutTip(tipId?)
  → removes "visible" class from tip element

moveTip(event, tip?)
  → positions tip at (clientX + 14, clientY - 10)

toggleExportMenu(event)
  → toggles "open" class on #exportMenu

closeExportMenu()
  → removes "open" class from #exportMenu
  → wired to document click to auto-close
```

---

## CSS Architecture

Each page has a dedicated CSS file (`login.css`, `dashboard.css`, `bug-report.css`, `sprint.css`, `no-project.css`).

Shared patterns across pages:
- `.topnav` — fixed top bar, 64px height
- `.sidebar` — 220px sticky left panel (bug-report & sprint)
- `.main-content` — flex:1, scrollable
- `.donut-arc` / `.donut-tooltip` — chart interaction styles
- Brand colours: `#065b41` (dark green), `#1b4332` (deeper green), `#e7f4f0` (light green tint)

---

## File Structure

```
group2_warnnoi300percent/
├── server.js              # Express backend + Atlassian OAuth
├── .env                   # Secrets (not committed)
├── .env.example           # Template
└── UI/
    ├── html/
    │   ├── login.html
    │   ├── dashboard.html
    │   ├── no-project.html
    │   ├── sprint.html
    │   └── bug-report.html
    ├── css/
    │   ├── login.css
    │   ├── dashboard.css
    │   ├── no-project.css
    │   ├── sprint.css
    │   └── bug-report.css
    └── js/
        ├── login.js
        ├── dashboard.js
        ├── no-project.js
        ├── sprint.js
        └── bug-report.js
```
