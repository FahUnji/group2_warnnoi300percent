"""
Export router — generates downloadable .xlsx and .docx reports from local SQLite bug data.

Endpoints:
  GET /api/export/bugs/xlsx?project_key=KEY
  GET /api/export/bugs/docx?project_key=KEY
  GET /api/export/sprint/xlsx?project_key=KEY&sprint_name=NAME
  GET /api/export/sprint/docx?project_key=KEY&sprint_name=NAME

All endpoints return StreamingResponse (binary file download).
No auth dependency — auth is ambient (OAuth token in SQLite), matching all other routers.
Error shape: {"ok": false, "error": "<code>", "message": "<text>"}
"""
import io
import re
from datetime import date

import matplotlib
matplotlib.use('Agg')  # non-interactive backend required for server-side rendering
import matplotlib.pyplot as plt
from docx import Document
from docx.shared import Inches
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from openpyxl import Workbook

from backend.database import get_db
from backend.services.jira_sync_service import _validate_project_key

router = APIRouter(prefix="/api/export", tags=["export"])

_DONE_KEYWORDS = ["done", "closed", "resolved", "won't fix", "wontfix", "duplicate", "fixed"]
_IN_PROGRESS_KEYWORDS = ["progress", "review", "testing", "development", "in dev"]


def _classify_status(status: str) -> str:
    s = (status or "").lower()
    if any(k in s for k in _DONE_KEYWORDS):
        return "done"
    if any(k in s for k in _IN_PROGRESS_KEYWORDS):
        return "inProgress"
    return "todo"


def _classify_priority(priority: str) -> str:
    p = (priority or "").lower()
    if "critical" in p or "blocker" in p:
        return "critical"
    if "high" in p or "major" in p:
        return "high"
    if "medium" in p or "normal" in p or "minor" in p:
        return "medium"
    return "low"


def _compute_stats(rows: list) -> dict:
    status_counts = {"todo": 0, "inProgress": 0, "done": 0}
    priority_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for r in rows:
        status_counts[_classify_status(r["status"])] += 1
        priority_counts[_classify_priority(r["priority"])] += 1
    total = len(rows)
    resolved = status_counts["done"]
    return {
        "total": total,
        "open_count": total - resolved,
        "resolved_count": resolved,
        "status_counts": status_counts,
        "priority_counts": priority_counts,
    }


def _make_donut_chart(status_counts: dict) -> bytes:
    labels = ["To Do", "In Progress", "Done"]
    keys = ["todo", "inProgress", "done"]
    colors = ["#d1d5db", "#f59e0b", "#065b41"]
    values = [status_counts.get(k, 0) for k in keys]
    if sum(values) == 0:
        values = [1, 0, 0]  # prevent empty pie crash
    fig, ax = plt.subplots(figsize=(4, 4))
    ax.pie(values, labels=labels, colors=colors,
           wedgeprops=dict(width=0.5), startangle=90)
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    return buf.read()


def _slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def _display_state(state: str) -> str:
    _MAP = {"released": "Completed", "closed": "Completed", "active": "Active",
            "upcoming": "Upcoming", "archived": "Archived"}
    return _MAP.get((state or "").lower(), (state or "unknown").title())


def _build_xlsx_buf(rows: list, headers: list) -> io.BytesIO:
    wb = Workbook()
    ws = wb.active
    ws.title = "Bugs"
    ws.append(headers)
    for cell in ws[1]:
        cell.font = cell.font.copy(bold=True)
    for row in rows:
        ws.append(list(row))
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


def _add_word_table(doc: Document, headers: list, rows: list) -> None:
    table = doc.add_table(rows=1, cols=len(headers))
    table.style = "Table Grid"
    hdr_cells = table.rows[0].cells
    for i, h in enumerate(headers):
        hdr_cells[i].text = h
        run = hdr_cells[i].paragraphs[0].runs[0]
        run.bold = True
    for row_data in rows:
        row_cells = table.add_row().cells
        for i, val in enumerate(row_data):
            row_cells[i].text = str(val or "")


@router.get("/bugs/xlsx")
async def export_bugs_xlsx(project_key: str):
    try:
        _validate_project_key(project_key)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={"ok": False, "error": "invalid_project_key", "message": str(exc)},
        )
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT issue_key, summary, status, priority, assignee, sprint_name"
            " FROM bugs WHERE project_key = ? ORDER BY issue_key ASC",
            (project_key,),
        ).fetchall()
    finally:
        conn.close()
    stats = _compute_stats(rows)
    pc = stats["priority_counts"]
    total = stats["total"]

    def _pct(n: int) -> str:
        return f"{round(n / total * 100)}%" if total else "0%"

    wb = Workbook()
    ws = wb.active
    ws.title = "Bug Report"

    # --- Summary block ---
    ws.append(["Project", project_key])
    ws.append(["Generated", str(date.today())])
    ws.append([])
    ws.append(["Total Bugs", total])
    ws.append(["Open", stats["open_count"]])
    ws.append(["Resolved", stats["resolved_count"]])
    ws.append([])
    ws.append(["Critical", pc["critical"], _pct(pc["critical"])])
    ws.append(["High", pc["high"], _pct(pc["high"])])
    ws.append(["Medium", pc["medium"], _pct(pc["medium"])])
    ws.append(["Low", pc["low"], _pct(pc["low"])])
    ws.append([])
    for row_cells in ws.iter_rows(min_row=1, max_row=ws.max_row, min_col=1, max_col=1):
        for cell in row_cells:
            if cell.value:
                cell.font = cell.font.copy(bold=True)

    # --- Bug table ---
    headers = ["ID", "Summary", "Status", "Priority", "Assignee", "Fix Version"]
    ws.append(headers)
    for cell in ws[ws.max_row]:
        cell.font = cell.font.copy(bold=True)
    for r in rows:
        ws.append([r["issue_key"], r["summary"], r["status"], r["priority"], r["assignee"], r["sprint_name"]])

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    filename = f"{project_key}-bug-report-{date.today()}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/bugs/docx")
async def export_bugs_docx(project_key: str):
    try:
        _validate_project_key(project_key)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={"ok": False, "error": "invalid_project_key", "message": str(exc)},
        )
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT issue_key, summary, status, priority, assignee, sprint_name"
            " FROM bugs WHERE project_key = ? ORDER BY issue_key ASC",
            (project_key,),
        ).fetchall()
    finally:
        conn.close()

    stats = _compute_stats(rows)
    pc = stats["priority_counts"]
    sc = stats["status_counts"]

    doc = Document()
    # 1. Title
    doc.add_heading(f"{project_key} Bug Report", 0)
    # 2. Metadata
    doc.add_paragraph(f"Project: {project_key}")
    doc.add_paragraph(f"Generated: {date.today()}")
    # 3. Summary stats
    doc.add_heading("Summary", level=1)
    doc.add_paragraph(f"Total Bugs: {stats['total']}")
    doc.add_paragraph(f"Open: {stats['open_count']}")
    doc.add_paragraph(f"Resolved: {stats['resolved_count']}")
    doc.add_paragraph(f"Critical: {pc['critical']}")
    doc.add_paragraph(f"High: {pc['high']}")
    doc.add_paragraph(f"Medium: {pc['medium']}")
    doc.add_paragraph(f"Low: {pc['low']}")
    # 4. Donut chart (EXPORT-CHART: server-side matplotlib, wedgeprops width=0.5)
    doc.add_heading("Status Distribution", level=1)
    chart_bytes = _make_donut_chart(sc)
    chart_buf = io.BytesIO(chart_bytes)
    doc.add_picture(chart_buf, width=Inches(4))
    # 5. Bug table
    doc.add_heading("Bugs", level=1)
    headers = ["ID", "Summary", "Status", "Priority", "Assignee", "Fix Version"]
    data_rows = [
        [r["issue_key"], r["summary"], r["status"], r["priority"], r["assignee"], r["sprint_name"]]
        for r in rows
    ]
    _add_word_table(doc, headers, data_rows)

    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    filename = f"{project_key}-bug-report-{date.today()}.docx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/sprint/xlsx")
async def export_sprint_xlsx(project_key: str, sprint_name: str = ""):
    try:
        _validate_project_key(project_key)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={"ok": False, "error": "invalid_project_key", "message": str(exc)},
        )
    conn = get_db()
    try:
        if sprint_name:
            rows = conn.execute(
                "SELECT issue_key, summary, status, priority, assignee, sprint_name"
                " FROM bugs WHERE project_key = ? AND sprint_name = ? ORDER BY issue_key ASC",
                (project_key, sprint_name),
            ).fetchall()
            sprints_meta_rows = conn.execute(
                "SELECT sprint_name, state, start_date, end_date"
                " FROM sprints WHERE project_key = ? AND sprint_name = ? LIMIT 1",
                (project_key, sprint_name),
            ).fetchall()
        else:
            sprints_meta_rows = conn.execute(
                "SELECT sprint_name, state, start_date, end_date"
                " FROM sprints WHERE project_key = ? ORDER BY sprint_id DESC",
                (project_key,),
            ).fetchall()
            sprint_names = [r["sprint_name"] for r in sprints_meta_rows]
            rows = conn.execute(
                "SELECT issue_key, summary, status, priority, assignee, sprint_name"
                " FROM bugs WHERE project_key = ? ORDER BY sprint_name, issue_key ASC",
                (project_key,),
            ).fetchall()
    finally:
        conn.close()

    # sprint metadata lookup: {sprint_name -> row}
    sprint_meta_by_name = {r["sprint_name"]: r for r in sprints_meta_rows}

    headers = ["ID", "Summary", "Status", "Priority", "Assignee", "Fix Version"]

    if sprint_name:
        data_rows = [
            [r["issue_key"], r["summary"], r["status"], r["priority"], r["assignee"], r["sprint_name"]]
            for r in rows
        ]
        buf = _build_xlsx_buf(data_rows, headers)
        filename = f"{project_key}-{_slugify(sprint_name)}-{date.today()}.xlsx"
    else:
        # One sheet per sprint — order by sprint_id DESC, then unrecognised, then No Sprint
        bugs_by_sprint: dict = {}
        for bug in rows:
            key = bug["sprint_name"] or "No Sprint"
            bugs_by_sprint.setdefault(key, []).append(bug)

        known_set = set(sprint_names)
        unknown = [k for k in bugs_by_sprint if k not in known_set and k != "No Sprint"]
        sheet_order = sprint_names + sorted(unknown) + (["No Sprint"] if "No Sprint" in bugs_by_sprint else [])

        if not sheet_order:
            sheet_order = ["No Data"]
            bugs_by_sprint["No Data"] = []

        wb = Workbook()
        wb.remove(wb.active)  # remove default empty sheet
        for sn in sheet_order:
            sheet_title = re.sub(r'[\\/*?:\[\]]', '-', sn)[:31]
            ws = wb.create_sheet(title=sheet_title)

            # --- Sprint metadata block ---
            meta = sprint_meta_by_name.get(sn)
            ws.append(["Sprint", sn])
            ws.append(["Status", _display_state(meta["state"] if meta else "")])
            ws.append(["Start Date", meta["start_date"] or "N/A" if meta else "N/A"])
            ws.append(["Release Date", meta["end_date"] or "N/A" if meta else "N/A"])
            for row_cells in ws.iter_rows(min_row=1, max_row=4, min_col=1, max_col=1):
                for cell in row_cells:
                    cell.font = cell.font.copy(bold=True)
            ws.append([])  # blank row

            # --- Stats block (always shown, even if all zeros) ---
            sprint_bugs = bugs_by_sprint.get(sn, [])
            stats = _compute_stats(sprint_bugs)
            pc = stats["priority_counts"]
            ws.append(["Total Bugs", stats["total"]])
            ws.append(["Open", stats["open_count"]])
            ws.append(["Resolved", stats["resolved_count"]])
            ws.append(["Critical", pc["critical"]])
            ws.append(["High", pc["high"]])
            ws.append(["Medium", pc["medium"]])
            ws.append(["Low", pc["low"]])
            for row_cells in ws.iter_rows(min_row=6, max_row=12, min_col=1, max_col=1):
                for cell in row_cells:
                    cell.font = cell.font.copy(bold=True)
            ws.append([])  # blank row

            # --- Bug table ---
            ws.append(headers)
            for cell in ws[ws.max_row]:
                cell.font = cell.font.copy(bold=True)
            for bug in sprint_bugs:
                ws.append([bug["issue_key"], bug["summary"], bug["status"],
                            bug["priority"], bug["assignee"], bug["sprint_name"]])

        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        filename = f"{project_key}-all-sprints-{date.today()}.xlsx"

    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/sprint/docx")
async def export_sprint_docx(project_key: str, sprint_name: str = ""):
    try:
        _validate_project_key(project_key)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={"ok": False, "error": "invalid_project_key", "message": str(exc)},
        )
    conn = get_db()
    try:
        if sprint_name:
            sprints_meta = conn.execute(
                "SELECT sprint_id, sprint_name, state, start_date, end_date"
                " FROM sprints WHERE project_key = ? AND sprint_name = ? LIMIT 1",
                (project_key, sprint_name),
            ).fetchall()
            all_bugs = conn.execute(
                "SELECT issue_key, summary, status, priority, assignee, sprint_name"
                " FROM bugs WHERE project_key = ? AND sprint_name = ? ORDER BY issue_key ASC",
                (project_key, sprint_name),
            ).fetchall()
        else:
            sprints_meta = conn.execute(
                "SELECT sprint_id, sprint_name, state, start_date, end_date"
                " FROM sprints WHERE project_key = ? ORDER BY sprint_id DESC",
                (project_key,),
            ).fetchall()
            all_bugs = conn.execute(
                "SELECT issue_key, summary, status, priority, assignee, sprint_name"
                " FROM bugs WHERE project_key = ? ORDER BY sprint_name, issue_key ASC",
                (project_key,),
            ).fetchall()
    finally:
        conn.close()

    doc = Document()
    headers = ["ID", "Summary", "Status", "Priority", "Assignee", "Fix Version"]

    if sprint_name:
        # Single sprint report
        sprint_meta = sprints_meta[0] if sprints_meta else None
        stats = _compute_stats(all_bugs)
        pc = stats["priority_counts"]
        total = stats["total"]
        progress_pct = round((stats["resolved_count"] / total) * 100) if total > 0 else 0
        doc.add_heading(f"{project_key} - {sprint_name} Sprint Report", 0)
        doc.add_paragraph(f"Project: {project_key}")
        doc.add_paragraph(f"Fix Version: {sprint_name}")
        doc.add_paragraph(f"Generated: {date.today()}")
        doc.add_heading("Fix Version Info", level=1)
        doc.add_paragraph(f"Name: {sprint_name}")
        doc.add_paragraph(f"State: {_display_state(sprint_meta['state'] if sprint_meta else '')}")
        doc.add_paragraph(f"Start Date: {sprint_meta['start_date'] or 'N/A' if sprint_meta else 'N/A'}")
        doc.add_paragraph(f"Release Date: {sprint_meta['end_date'] or 'N/A' if sprint_meta else 'N/A'}")
        doc.add_paragraph(f"Progress: {progress_pct}%")
        doc.add_heading("Summary", level=1)
        doc.add_paragraph(f"Total Bugs: {total}")
        doc.add_paragraph(f"Open: {stats['open_count']}")
        doc.add_paragraph(f"Resolved: {stats['resolved_count']}")
        doc.add_paragraph(f"Critical: {pc['critical']}")
        doc.add_paragraph(f"High: {pc['high']}")
        doc.add_paragraph(f"Medium: {pc['medium']}")
        doc.add_paragraph(f"Low: {pc['low']}")
        doc.add_heading("Bugs", level=1)
        data_rows = [
            [r["issue_key"], r["summary"], r["status"], r["priority"], r["assignee"], r["sprint_name"]]
            for r in all_bugs
        ]
        _add_word_table(doc, headers, data_rows)
        filename = f"{project_key}-{_slugify(sprint_name)}-{date.today()}.docx"
    else:
        # All sprints report — one section per sprint
        bugs_by_sprint: dict = {}
        for bug in all_bugs:
            key = bug["sprint_name"] or "No Sprint"
            bugs_by_sprint.setdefault(key, []).append(bug)

        overall_stats = _compute_stats(all_bugs)
        doc.add_heading(f"{project_key} - All Sprints Report", 0)
        doc.add_paragraph(f"Project: {project_key}")
        doc.add_paragraph(f"Generated: {date.today()}")
        doc.add_paragraph(f"Total Sprints: {len(sprints_meta)}")
        doc.add_paragraph(f"Total Bugs: {overall_stats['total']}")

        for sm in sprints_meta:
            sn = sm["sprint_name"]
            sprint_bugs = bugs_by_sprint.get(sn, [])
            stats = _compute_stats(sprint_bugs)
            total = stats["total"]
            pc = stats["priority_counts"]
            progress_pct = round((stats["resolved_count"] / total) * 100) if total > 0 else 0

            doc.add_heading(sn, level=1)
            doc.add_paragraph(f"State: {_display_state(sm['state'])}")
            doc.add_paragraph(f"Start Date: {sm['start_date'] or 'N/A'}")
            doc.add_paragraph(f"Release Date: {sm['end_date'] or 'N/A'}")
            doc.add_paragraph(f"Progress: {progress_pct}%")
            doc.add_heading("Summary", level=2)
            doc.add_paragraph(f"Total Bugs: {total}")
            doc.add_paragraph(f"Open: {stats['open_count']}")
            doc.add_paragraph(f"Resolved: {stats['resolved_count']}")
            doc.add_paragraph(f"Critical: {pc['critical']}")
            doc.add_paragraph(f"High: {pc['high']}")
            doc.add_paragraph(f"Medium: {pc['medium']}")
            doc.add_paragraph(f"Low: {pc['low']}")
            if sprint_bugs:
                doc.add_heading("Bugs", level=2)
                data_rows = [
                    [r["issue_key"], r["summary"], r["status"], r["priority"], r["assignee"], r["sprint_name"]]
                    for r in sprint_bugs
                ]
                _add_word_table(doc, headers, data_rows)
            else:
                doc.add_paragraph("No bugs recorded for this sprint.")

        filename = f"{project_key}-all-sprints-{date.today()}.docx"

    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
