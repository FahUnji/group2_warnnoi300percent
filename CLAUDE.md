# Jira Bug Summary Dashboard

## Project Context

See `.planning/PROJECT.md` for full project context.

**Core value:** QA testers can instantly see bug health (status + priority breakdown) across any Jira project without navigating Jira directly.

**Stack:** Python backend (FastAPI/Flask) + React frontend (Node.js) + MySQL

## GSD Workflow

This project uses the GSD workflow. Always check `.planning/STATE.md` for current phase and active plans.

### Phase Execution Order
1. Jira Connection — backend auth + Jira REST API
2. Data Sync — manual sync Jira → MySQL
3. Dashboard UI — charts + project switcher
4. Sprint Report — active sprint + history
5. Export — Excel (.xlsx) + Word (.docx)

### Commands
- `/gsd-plan-phase [N]` — plan next phase
- `/gsd-execute-phase [N]` — execute a phase
- `/gsd-progress` — check current status
- `/gsd-discuss-phase [N]` — discuss approach before planning

### Rules
- Always read `.planning/STATE.md` at session start
- Commit artifacts after each phase
- Map every task to a requirement from `.planning/REQUIREMENTS.md`
- Never skip plan-check or verifier steps (both enabled in config)

## Key Files

| File | Purpose |
|------|---------|
| `.planning/PROJECT.md` | Project context and requirements |
| `.planning/ROADMAP.md` | Phase breakdown |
| `.planning/REQUIREMENTS.md` | 18 v1 requirements with REQ-IDs |
| `.planning/STATE.md` | Current phase and progress |
| `.planning/config.json` | Workflow settings |
