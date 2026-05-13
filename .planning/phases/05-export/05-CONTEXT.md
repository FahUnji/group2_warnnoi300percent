# Phase 05 — Export: Context & Decisions

**Phase goal:** Users can download bug report and sprint report as Excel (.xlsx) and Word (.docx).

---

## Decisions

### EXPORT-SCOPE: Both pages export
- BugReportPage: export all bugs for selected project
- SprintPage: export bugs filtered by selected fix version
- Both pages export to .xlsx AND .docx
- Export stubs already present on both pages (onClick handlers are no-ops)

### EXPORT-EXCEL: Single sheet, raw bug table
Format: one sheet with bug rows
Columns: `ID | Summary | Status | Priority | Assignee | Fix Version`
No pivot table, no summary sheet — raw data only so user can filter/sort in Excel.
Applies to both BugReportPage and SprintPage exports.

### EXPORT-WORD-BUGREPORT: Full document with donut chart
Structure (in order):
1. Title (project name + "Bug Report")
2. Metadata (project key, date generated)
3. Summary stats section (total, by status, by priority — counts)
4. Donut/pie chart (bug status distribution, server-side via matplotlib)
5. Bug table (all bugs: ID, Summary, Status, Priority, Assignee, Fix Version)

### EXPORT-WORD-SPRINT: Full document, no chart
Structure (in order):
1. Title (project name + sprint/fix version name + "Sprint Report")
2. Metadata (project key, fix version name, state, dates, date generated)
3. Fix version info (name, state, start date, release date, progress %)
4. Summary stats section (total bugs, by status, by priority)
5. Bug table (bugs in that fix version: ID, Summary, Status, Priority, Assignee)
No donut chart — Sprint context is release/version-centric, not status-chart-centric.

### EXPORT-CHART: Server-side matplotlib generation
Donut chart generated server-side using matplotlib (not captured from browser canvas).
Rationale: clean separation — backend has bug data, generates chart independently.
Chart type: pie chart styled as donut (add `wedgeprops=dict(width=0.5)`).
Embedded in Word doc as PNG via `python-docx` `add_picture`.
Adds `matplotlib` to `requirements.txt`.

### EXPORT-FILENAME: Descriptive with project + date
Bug Report:
- Excel: `{PROJECT}-bug-report-{YYYY-MM-DD}.xlsx`
- Word: `{PROJECT}-bug-report-{YYYY-MM-DD}.docx`

Sprint:
- Excel: `{PROJECT}-{sprint-name}-{YYYY-MM-DD}.xlsx`
- Word: `{PROJECT}-{sprint-name}-{YYYY-MM-DD}.docx`

`sprint-name` = fix version name, slugified (spaces → hyphens, lowercase).

### EXPORT-BACKEND: New router + dependencies
New file: `backend/routers/export.py`
Registered in `backend/main.py` (same pattern as existing routers).

Endpoints:
- `GET /api/export/bugs/xlsx?project_key={KEY}` → StreamingResponse, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
- `GET /api/export/bugs/docx?project_key={KEY}` → StreamingResponse, application/vnd.openxmlformats-officedocument.wordprocessingml.document
- `GET /api/export/sprint/xlsx?project_key={KEY}&sprint_name={NAME}` → StreamingResponse
- `GET /api/export/sprint/docx?project_key={KEY}&sprint_name={NAME}` → StreamingResponse

All endpoints: require auth (same `get_current_user` dependency as other routers).
Data source: SQLite (same `get_db` + bug queries used by existing endpoints).

New dependencies in `requirements.txt`:
- `openpyxl` — Excel generation
- `python-docx` — Word generation
- `matplotlib` — Chart generation for Word export

### EXPORT-FRONTEND: Wire existing stubs
BugReportPage and SprintPage already have export dropdowns with Word/Excel items.
onClick handlers currently just call `setExportOpen(false)`.
Wire to fetch the appropriate endpoint → trigger browser download.
Pattern: `fetch(url) → blob → URL.createObjectURL → <a>.click()`.
Show loading state on button while fetch in progress.

---

## Constraints (carried from prior phases)

- No npm install on WSL NTFS `/mnt/` paths — use Docker
- `use_worktrees=false` permanent
- CRLF diffs in `.planning/*.md` — never stage
- FastAPI error format: `err.detail?.message` not `err.message`
- Auth: all export endpoints behind JWT auth (same as existing endpoints)

---

## Requirements Mapping

| Decision | REQ-ID |
|----------|--------|
| .xlsx export both pages | EXPORT-01 |
| .docx export both pages | EXPORT-02 |
