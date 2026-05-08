# Jira Bug Dashboard

## Goal
A 1-week sprint to build a web dashboard where QA testers can instantly see bug health across any Jira project — without opening Jira.
 
## Tech Stack
- Frontend — React (Node.js)
- Backend — Python
- Database - MySQL 8

## Must Have Features
- **Jira Auth** — API token only, no own login. Show clear error if access is denied.
- **Manual Sync** — button in UI to sync bug data from Jira into MySQL.
- **Project Switcher** — user can access multiple projects via a project list page.
- **Bug Summary Report** — total, open, resolved counts + charts by priority and status.
- **Sprint Report** — total, open, resolved per sprint; bug count by priority in a collapsible section for each sprint.
- **Export** — download report as Excel (.xlsx) or Word (.docx).
- **Responsive** — works on mobile, tablet, and desktop.
 
## Could Have Features
- Filter by reporter
 
## Won't Have (this sprint)
- Bug detail view
- Tracking history & activity
 
## Edge Cases