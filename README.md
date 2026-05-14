# Jira Bug Summary Dashboard

---

## Hook

> **"Your QA team shouldn't need to navigate 5 Jira screens just to answer: how many critical bugs are still open?"**

Jira is powerful — but it's built for project managers, not QA health checks. Getting a clear picture of bug status, priority breakdown, and sprint progress means clicking through filters, switching boards, and exporting raw data manually. Every time.

**Jira Bug Summary Dashboard** gives QA testers one screen with everything they need — charts, counts, sprint cards — and lets them export it to Excel or Word in one click.

---

## Problem Statement

QA teams working with Jira face a recurring friction:

- **Scattered information** — bug status, priority, and sprint assignment live in different Jira views
- **No quick summary** — there is no single screen showing total open bugs, critical count, and sprint progress at a glance
- **Manual reporting** — generating a bug report for a stakeholder means exporting raw CSVs and formatting them by hand
- **Multi-project overhead** — teams managing several projects must switch context repeatedly to get the same basic metrics per project

### Who it's for
QA testers and QA leads who need a fast, readable view of bug health across one or more Jira projects — without Jira admin access or report-building skills.

### What it solves
| Pain | Solution |
|------|----------|
| Can't see bug priority + status in one view | Dashboard with donut charts — priority and status side by side |
| No quick open/critical count per project | Project cards on dashboard show open + critical count at a glance |
| Sprint bug tracking requires multiple Jira screens | Sprint page shows per-sprint cards with severity breakdown |
| Sharing reports requires manual formatting | One-click export to Excel or Word — charts and tables included |

---

A web dashboard for QA testers to view bug health (status + priority breakdown) across any Jira project — without navigating Jira directly. Supports Excel and Word export.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, React Router v6, CSS Modules |
| Backend | Python 3, FastAPI, uvicorn |
| Database | SQLite (local file `backend/jira.db`) |
| Auth | Atlassian OAuth 2.0 (3LO) |
| Export | openpyxl (xlsx), python-docx + matplotlib (docx) |
| Infrastructure | Docker, docker-compose |

---

## Project Structure

```
group2_warnnoi300percent/
├── backend/
│   ├── main.py                          # FastAPI app entry point, CORS, middleware
│   ├── database.py                      # SQLite init + get_db()
│   ├── .env                             # FERNET_KEY, JIRA_CLIENT_ID, JIRA_CLIENT_SECRET
│   ├── .env.example                     # Template for .env
│   ├── requirements.txt
│   ├── models/
│   │   ├── jira_config.py               # JiraConfig SQLite model (project credentials)
│   │   └── oauth_token.py               # OAuthToken model (encrypted access token)
│   ├── routers/
│   │   ├── auth.py                      # OAuth 2.0 flow: /auth/login, /auth/callback, /auth/user
│   │   ├── jira.py                      # Jira API proxy: projects, bugs, sprints
│   │   ├── sync.py                      # Manual sync trigger: /sync/{project_key}
│   │   └── export.py                    # Export endpoints: xlsx + docx for bugs and sprints
│   └── services/
│       ├── jira_service.py              # Bug/project fetching from Jira REST API
│       ├── jira_sprint_service.py       # Sprint data fetching and aggregation
│       └── jira_sync_service.py         # Sync logic: fetch from Jira → write to SQLite
├── frontend/
│   ├── src/
│   │   ├── App.jsx                      # Router: all page routes defined here
│   │   ├── pages/
│   │   │   ├── ConnectionPage.jsx       # Jira OAuth connect / re-connect screen
│   │   │   ├── DashboardPage.jsx        # Project cards, add/remove projects
│   │   │   ├── BugReportPage.jsx        # Bug charts, stats, bug list, export
│   │   │   └── SprintPage.jsx           # Sprint cards, severity grid, export
│   │   └── components/
│   │       ├── Navbar/                  # Top navigation bar (shared across all pages)
│   │       ├── Sidebar/                 # Left nav sidebar with animations (Bug/Sprint pages)
│   │       ├── ConnectionForm/          # Jira OAuth connection form
│   │       ├── LoadingSpinner/          # Loading indicator
│   │       ├── StatusBanner/            # Success/error banner
│   │       └── SuccessModal/            # Modal for successful actions
│   ├── index.html
│   └── package.json
└── docker-compose.yml
```

---

## Pages

### ConnectionPage `/`
Connect to Jira via OAuth 2.0. User authorizes via Atlassian consent screen. Access token + cloud ID stored encrypted in SQLite.

### DashboardPage `/dashboard`
- Lists all synced Jira projects as cards
- Each card shows open bug count + critical bug count
- Search and add new projects (debounced 300ms, fetches live from Jira)
- Remove project via 3-dot kebab menu

### BugReportPage `/bug-report?project=KEY`
- Priority donut chart (Critical / High / Medium / Low)
- Status donut chart (Open / In Progress / Resolved / etc.)
- Stat cards: Total / Open / Resolved
- Full bug list table
- Export as Excel (.xlsx) or Word (.docx)

### SprintPage `/sprint?project=KEY`
- Per-sprint cards: state badge (Active / Completed / Upcoming / Archived), date range, stats
- Severity distribution grid per sprint
- Bug list per sprint
- Export as Excel (.xlsx) or Word (.docx)

---

## API Endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/login` | Redirect to Atlassian OAuth consent screen |
| GET | `/auth/callback` | OAuth callback — store token + cloud_id |
| GET | `/auth/user` | Return connected user info (name, email, avatar) |
| POST | `/auth/logout` | Clear stored credentials |

### Jira
| Method | Path | Description |
|--------|------|-------------|
| GET | `/jira/projects` | Search Jira projects (live API, `?query=`) |
| GET | `/jira/bugs/{project_key}` | Get synced bugs for a project |
| GET | `/jira/sprints/{project_key}` | Get sprint data for a project |
| GET | `/jira/saved-projects` | List locally saved projects |
| DELETE | `/jira/saved-projects/{project_key}` | Remove a saved project |

### Sync
| Method | Path | Description |
|--------|------|-------------|
| POST | `/sync/{project_key}` | Trigger manual sync: fetch bugs from Jira → SQLite |

### Export
| Method | Path | Description |
|--------|------|-------------|
| GET | `/export/bugs/xlsx?project_key=` | Bug report as Excel file |
| GET | `/export/bugs/docx?project_key=` | Bug report as Word file (charts + tables) |
| GET | `/export/sprint/xlsx?project_key=` | Sprint report as Excel (one sheet per sprint) |
| GET | `/export/sprint/docx?project_key=` | Sprint report as Word (colored cards per sprint) |

### Health
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Returns `{"status": "ok"}` |

---

## Setup & Running

### Prerequisites
- Docker + docker-compose
- Atlassian OAuth 2.0 app credentials (Client ID + Secret)

### 1. Configure environment

Copy `backend/.env.example` to `backend/.env` and fill in:

```env
FERNET_KEY=<generated Fernet key>
JIRA_CLIENT_ID=<Atlassian OAuth Client ID>
JIRA_CLIENT_SECRET=<Atlassian OAuth Client Secret>
JIRA_REDIRECT_URI=http://localhost:3000/auth/callback
```

Generate a Fernet key:
```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### 2. Start containers

```bash
docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend API docs: http://localhost:8000/docs

### 3. Restart containers after code changes

```bash
# From WSL (Docker CLI not in WSL path — use powershell)
powershell.exe -Command "docker restart group2_warnnoi300percent-backend-1"
powershell.exe -Command "docker restart group2_warnnoi300percent-frontend-1"
```

> **Note:** uvicorn `--reload` does NOT detect `.py` file changes on WSL NTFS mounts. Always restart the backend container after editing Python files.

---

## Security

| Control | Implementation |
|---------|---------------|
| OAuth tokens encrypted at rest | Fernet symmetric encryption (`cryptography` lib) |
| FERNET_KEY validation on startup | `main.py` fails fast if key missing or invalid |
| CORS restricted | Only `http://localhost:3000` allowed |
| Request body size limit | 65 536 bytes max — rejects oversized payloads (HTTP 413) |
| No Basic Auth / raw API tokens | OAuth 2.0 only — credentials never entered manually |
| SQL injection prevention | All DB queries use parameterized statements |

---

## Export File Details

### Bug Report Excel (`.xlsx`)
- Summary stats block (Total / Open / Resolved)
- Full bug table with columns: ID, Summary, Status, Priority, Assignee, Sprint

### Bug Report Word (`.docx`)
- Title + project metadata
- 3-column stats table (Total / Open / Resolved)
- Side-by-side donut charts: Priority breakdown + Status breakdown (matplotlib, server-side render)
- Legend tables with counts + percentages
- Full bug list table

### Sprint Excel (`.xlsx`)
- One sheet per sprint
- Sprint metadata (name, state, dates)
- Bug table per sprint

### Sprint Word (`.docx`)
- One card section per sprint
- Card header: sprint name (dark green) + state badge (color by state)
- Date range row
- Stats row: Total / Resolved / Open / Progress
- Severity distribution grid: Critical / High / Medium / Low (tinted backgrounds + colored values)
- Bug list table

---

## Key Technical Decisions

| Decision | Reason |
|----------|--------|
| SQLite over remote DB | Local-only dashboard, no multi-user concurrency needed |
| Manual sync (not auto) | Privacy by default — sync only when user explicitly requests |
| Debounced project search (300ms) | Avoid hammering Jira API on every keystroke |
| CSS Modules | Scoped styles, no class name collisions between pages |
| Sidebar animation skip on sidebar↔sidebar nav | `document.referrer` check in `useState` initializer — no flash when switching Bug↔Sprint |
| Server-side chart rendering (matplotlib Agg) | Word files need embedded images — no browser canvas available server-side |
| Cell background via XML (`w:shd`) | python-docx has no native cell background color API |

---

## Known Limitations (v1)

- No auto-sync / scheduled refresh
- No filtering by assignee, date range, or keyword (v2)
- Export buffers entire file in memory — may be slow for very large projects
- `document.referrer` for animation skip is unreliable in private browsing or with CSP

---

## Branch History

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready code |
| `export-phase-5` | Phase 5 export feature + all UI polish |
| `sprint-report-phase-4` | Phase 4 sprint report |
| `dashboard-phase-3` | Phase 3 dashboard UI |
| `back-end-phase-2` | Phase 2 data sync |
| `front-end-phase-1` | Phase 1 Jira OAuth connection |
