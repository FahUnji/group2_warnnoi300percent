---
name: report-exporter
description: "Use this skill whenever the user wants to export bug or issue data from MySQL into Excel, Word, or PowerPoint. Triggers include: 'export report to Excel', 'generate Word report from bugs', 'create PowerPoint from issue data', 'export dashboard data', 'download bug report', 'export to xlsx/docx/pptx', or any request where MySQL bug data needs to become an Office file. Use this skill for ALL three formats — always let the user choose the format unless they've already specified. Always use this skill before writing any export endpoint or file-generation code."
---

# Report Exporter (Excel / Word / PowerPoint)

Export Jira bug data from MySQL into Office files. Supports Excel (.xlsx), Word (.docx), and PowerPoint (.pptx).

## Flask Export Endpoint

Add this to `app.py` from the `bug-dashboard` skill:

```python
from flask import send_file
import tempfile, os

@app.route("/api/export")
def export_report():
    fmt        = request.args.get("format", "excel")   # excel | word | pptx
    project_id = request.args.get("project_id")

    db  = get_db()
    cur = db.cursor(dictionary=True)

    where  = "WHERE i.project_id = %s" if project_id else ""
    params = (project_id,) if project_id else ()

    cur.execute(f"""
        SELECT i.jira_issue_key, i.summary, i.status, i.priority,
               i.severity, i.issue_type,
               r.display_name AS reporter,
               a.display_name AS assignee,
               i.created_at, i.updated_at, i.resolved_at
        FROM issue i
        LEFT JOIN user r ON i.reporter_id = r.id
        LEFT JOIN user a ON i.assignee_id = a.id
        {where} ORDER BY i.created_at DESC
    """, params)
    issues = cur.fetchall()

    cur.execute(f"""
        SELECT status, COUNT(*) AS count FROM issue {where}
        GROUP BY status
    """, params)
    by_status = cur.fetchall()

    cur.execute(f"""
        SELECT priority, COUNT(*) AS count FROM issue {where}
        GROUP BY priority ORDER BY FIELD(priority,'Highest','High','Medium','Low','Lowest')
    """, params)
    by_priority = cur.fetchall()

    cur.execute(f"""
        SELECT severity, COUNT(*) AS count FROM issue {where}
        GROUP BY severity
    """, params)
    by_severity = cur.fetchall()

    project_name = "All Projects"
    if project_id:
        cur.execute("SELECT name FROM project WHERE id=%s", (project_id,))
        row = cur.fetchone()
        if row: project_name = row["name"]

    if fmt == "excel":
        return export_excel(issues, by_status, by_priority, by_severity, project_name)
    elif fmt == "word":
        return export_word(issues, by_status, by_priority, project_name)
    elif fmt == "pptx":
        return export_pptx(issues, by_status, by_priority, by_severity, project_name)
    else:
        return jsonify({"error": "format must be excel, word, or pptx"}), 400
```

---

## Excel Export

```python
# pip install openpyxl --break-system-packages
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

def export_excel(issues, by_status, by_priority, by_severity, project_name):
    wb = Workbook()

    # ── Sheet 1: Summary ──────────────────────────────────────────
    ws = wb.active
    ws.title = "Summary"

    title_font  = Font(bold=True, size=14, color="FFFFFF")
    header_fill = PatternFill("solid", start_color="0052CC")
    header_font = Font(bold=True, color="FFFFFF")

    ws.merge_cells("A1:C1")
    ws["A1"] = f"Bug Report — {project_name}"
    ws["A1"].font = Font(bold=True, size=16)

    ws["A3"] = "Total Issues"
    ws["B3"] = len(issues)
    ws["B3"].font = Font(bold=True, size=14, color="0052CC")

    for col, label in enumerate(["Category", "Value", "Count"], 1):
        c = ws.cell(row=5, column=col, value=label)
        c.font = header_font; c.fill = header_fill

    row = 6
    for s in by_status:
        ws.cell(row=row, column=1, value="Status")
        ws.cell(row=row, column=2, value=s["status"])
        ws.cell(row=row, column=3, value=s["count"])
        row += 1
    for p in by_priority:
        ws.cell(row=row, column=1, value="Priority")
        ws.cell(row=row, column=2, value=p["priority"])
        ws.cell(row=row, column=3, value=p["count"])
        row += 1
    for s in by_severity:
        ws.cell(row=row, column=1, value="Severity")
        ws.cell(row=row, column=2, value=s["severity"] or "N/A")
        ws.cell(row=row, column=3, value=s["count"])
        row += 1

    ws.column_dimensions["A"].width = 14
    ws.column_dimensions["B"].width = 20
    ws.column_dimensions["C"].width = 10

    # ── Sheet 2: Issues ───────────────────────────────────────────
    wi = wb.create_sheet("Issues")
    headers = ["Key","Summary","Status","Priority","Severity",
               "Type","Reporter","Assignee","Created","Resolved"]
    for col, h in enumerate(headers, 1):
        c = wi.cell(row=1, column=col, value=h)
        c.font = header_font; c.fill = header_fill
        c.alignment = Alignment(horizontal="center")

    PRIORITY_COLORS = {
        "Highest": "FFCCCC", "High": "FFE0E0",
        "Medium": "FFF3CD", "Low": "E0F0E0", "Lowest": "D4EDDA"
    }

    for row, i in enumerate(issues, 2):
        vals = [
            i["jira_issue_key"], i["summary"], i["status"],
            i["priority"], i["severity"] or "N/A", i["issue_type"],
            i["reporter"] or "", i["assignee"] or "Unassigned",
            str(i["created_at"])[:10] if i["created_at"] else "",
            str(i["resolved_at"])[:10] if i["resolved_at"] else ""
        ]
        for col, val in enumerate(vals, 1):
            cell = wi.cell(row=row, column=col, value=val)
            if col == 4 and i["priority"] in PRIORITY_COLORS:
                cell.fill = PatternFill("solid", start_color=PRIORITY_COLORS[i["priority"]])

    col_widths = [12, 50, 14, 12, 12, 10, 18, 18, 12, 12]
    for col, w in enumerate(col_widths, 1):
        wi.column_dimensions[get_column_letter(col)].width = w

    wi.freeze_panes = "A2"

    tmp = tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False)
    wb.save(tmp.name)
    return send_file(tmp.name, as_attachment=True,
                     download_name=f"bug_report_{project_name}.xlsx",
                     mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
```

---

## Word Export

```python
# pip install python-docx --break-system-packages
from docx import Document as DocxDoc
from docx.shared import Pt, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH

def export_word(issues, by_status, by_priority, project_name):
    doc = DocxDoc()

    # Title
    title = doc.add_heading(f"Bug Report — {project_name}", 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER

    from datetime import date
    doc.add_paragraph(f"Generated: {date.today()}").alignment = WD_ALIGN_PARAGRAPH.CENTER

    doc.add_heading("Summary", level=1)
    p = doc.add_paragraph()
    p.add_run(f"Total issues: {len(issues)}  |  ")
    for s in by_status:
        p.add_run(f"{s['status']}: {s['count']}  ")

    doc.add_heading("Issues by Priority", level=2)
    for item in by_priority:
        doc.add_paragraph(f"{item['priority']}: {item['count']} issues",
                          style="List Bullet")

    doc.add_heading("Issue Details", level=1)
    table = doc.add_table(rows=1, cols=6)
    table.style = "Table Grid"
    hdr = table.rows[0].cells
    for i, h in enumerate(["Key","Summary","Status","Priority","Severity","Assignee"]):
        hdr[i].text = h
        hdr[i].paragraphs[0].runs[0].font.bold = True

    for issue in issues:
        row = table.add_row().cells
        row[0].text = issue["jira_issue_key"] or ""
        row[1].text = (issue["summary"] or "")[:80]
        row[2].text = issue["status"] or ""
        row[3].text = issue["priority"] or ""
        row[4].text = issue["severity"] or "N/A"
        row[5].text = issue["assignee"] or "Unassigned"

    tmp = tempfile.NamedTemporaryFile(suffix=".docx", delete=False)
    doc.save(tmp.name)
    return send_file(tmp.name, as_attachment=True,
                     download_name=f"bug_report_{project_name}.docx",
                     mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
```

---

## PowerPoint Export

```python
# pip install python-pptx --break-system-packages
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor as PptxRGB
from pptx.enum.text import PP_ALIGN

def export_pptx(issues, by_status, by_priority, by_severity, project_name):
    prs = Presentation()
    prs.slide_width  = Inches(13.33)
    prs.slide_height = Inches(7.5)

    blank = prs.slide_layouts[6]  # blank layout

    def add_textbox(slide, text, x, y, w, h, size=18, bold=False, color=None):
        txBox = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
        tf = txBox.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        run = p.add_run()
        run.text = text
        run.font.size = Pt(size)
        run.font.bold = bold
        if color:
            run.font.color.rgb = PptxRGB(*color)
        return txBox

    # ── Slide 1: Title ────────────────────────────────────────────
    s1 = prs.slides.add_slide(blank)
    bg = s1.shapes.add_shape(1, 0, 0, prs.slide_width, prs.slide_height)
    bg.fill.solid(); bg.fill.fore_color.rgb = PptxRGB(0, 82, 204)
    bg.line.fill.background()
    add_textbox(s1, f"Bug Report", 1, 2, 11, 1, size=40, bold=True, color=(255,255,255))
    add_textbox(s1, project_name, 1, 3.2, 11, 0.8, size=24, color=(200,220,255))
    from datetime import date
    add_textbox(s1, str(date.today()), 1, 4.2, 6, 0.5, size=16, color=(180,200,240))

    # ── Slide 2: Summary stats ────────────────────────────────────
    s2 = prs.slides.add_slide(blank)
    add_textbox(s2, "Summary", 0.5, 0.3, 12, 0.8, size=28, bold=True, color=(0,82,204))

    stat_items = [
        (f"{len(issues)}", "Total Issues", (0,82,204)),
        (f"{next((x['count'] for x in by_status if x['status']=='In Progress'),0)}", "In Progress", (255,171,0)),
        (f"{next((x['count'] for x in by_priority if x['priority'] in ('High','Highest')),0)}", "High Priority", (255,86,48)),
        (f"{next((x['count'] for x in by_status if x['status']=='Done'),0)}", "Resolved", (54,179,126)),
    ]
    for i, (num, label, color) in enumerate(stat_items):
        x = 0.5 + i * 3.1
        box = s2.shapes.add_shape(1, Inches(x), Inches(1.4), Inches(2.8), Inches(1.8))
        box.fill.solid(); box.fill.fore_color.rgb = PptxRGB(*color)
        box.line.fill.background()
        add_textbox(s2, num,   x+0.1, 1.5, 2.6, 0.9, size=36, bold=True, color=(255,255,255))
        add_textbox(s2, label, x+0.1, 2.4, 2.6, 0.5, size=13, color=(255,255,255))

    # By status list
    add_textbox(s2, "By Status", 0.5, 3.5, 6, 0.5, size=16, bold=True)
    for j, s in enumerate(by_status):
        add_textbox(s2, f"• {s['status']}: {s['count']}", 0.5, 4.0+j*0.4, 5, 0.4, size=13)

    # By priority list
    add_textbox(s2, "By Priority", 6.5, 3.5, 6, 0.5, size=16, bold=True)
    for j, p in enumerate(by_priority):
        add_textbox(s2, f"• {p['priority']}: {p['count']}", 6.5, 4.0+j*0.4, 5, 0.4, size=13)

    # ── Slide 3: Issue table (top 20) ─────────────────────────────
    s3 = prs.slides.add_slide(blank)
    add_textbox(s3, "Issue Details (Top 20)", 0.5, 0.3, 12, 0.7, size=24, bold=True, color=(0,82,204))

    cols = ["Key","Summary","Status","Priority","Severity","Assignee"]
    col_w = [1.2, 4.5, 1.4, 1.2, 1.2, 1.5]
    header_y = 1.2

    for ci, (col, w) in enumerate(zip(cols, col_w)):
        x = 0.4 + sum(col_w[:ci])
        hbox = s3.shapes.add_shape(1, Inches(x), Inches(header_y), Inches(w), Inches(0.4))
        hbox.fill.solid(); hbox.fill.fore_color.rgb = PptxRGB(0, 82, 204)
        hbox.line.fill.background()
        add_textbox(s3, col, x+0.05, header_y+0.02, w-0.1, 0.35, size=11, bold=True, color=(255,255,255))

    for ri, issue in enumerate(issues[:20]):
        y = header_y + 0.4 + ri * 0.27
        vals = [
            issue["jira_issue_key"] or "",
            (issue["summary"] or "")[:45],
            issue["status"] or "",
            issue["priority"] or "",
            issue["severity"] or "N/A",
            issue["assignee"] or "Unassigned"
        ]
        fill = (245,245,255) if ri % 2 == 0 else (255,255,255)
        for ci, (val, w) in enumerate(zip(vals, col_w)):
            x = 0.4 + sum(col_w[:ci])
            rbox = s3.shapes.add_shape(1, Inches(x), Inches(y), Inches(w), Inches(0.26))
            rbox.fill.solid(); rbox.fill.fore_color.rgb = PptxRGB(*fill)
            rbox.line.color.rgb = PptxRGB(220, 220, 220)
            add_textbox(s3, val, x+0.05, y+0.02, w-0.1, 0.22, size=9)

    tmp = tempfile.NamedTemporaryFile(suffix=".pptx", delete=False)
    prs.save(tmp.name)
    return send_file(tmp.name, as_attachment=True,
                     download_name=f"bug_report_{project_name}.pptx",
                     mimetype="application/vnd.openxmlformats-officedocument.presentationml.presentation")
```

---

## Install dependencies

```bash
pip install openpyxl python-docx python-pptx --break-system-packages
```

## Output Checklist

- [ ] Excel: summary sheet + issues sheet, color-coded priority
- [ ] Word: title, summary stats, issues table
- [ ] PowerPoint: title slide, summary stats slide, issue detail slide
- [ ] ไฟล์ชื่อตาม project ที่เลือก
- [ ] ทุก format ใช้ข้อมูลเดียวกันจาก `/api/export` endpoint