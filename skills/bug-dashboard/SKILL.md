---
name: bug-dashboard
description: "Use this skill whenever the user wants to build a web dashboard to display Jira bug or issue data stored in MySQL. Triggers include: 'create a bug dashboard', 'show Jira issues in a UI', 'build a dashboard for bug tracking', 'display MySQL bug data on a webpage', 'make a project overview page', or any request to visualize issue/bug data in a browser interface. Use this skill when the data source is MySQL (populated from Jira) and the output is an interactive web UI. Always use this skill before writing any dashboard HTML/JS/backend code for bug data."
---


# Bug Dashboard UI

Build an interactive web dashboard to display Jira bug/issue data from MySQL.

## Stack

- **Backend**: Python + Flask (serves API endpoints)
- **Frontend**: Single HTML file with Chart.js for charts
- **Data source**: MySQL (`jira_db` schema from `jira-to-mysql` skill)

---

## Backend (Flask API)

```python
# app.py
from flask import Flask, jsonify, request
import mysql.connector

app = Flask(__name__)

def get_db():
    return mysql.connector.connect(
        host="localhost", database="jira_db",
        user="root", password="YOUR_PASSWORD"
    )

@app.route("/api/projects")
def list_projects():
    db = get_db()
    cur = db.cursor(dictionary=True)
    cur.execute("SELECT id, jira_project_key, name FROM project ORDER BY name")
    return jsonify(cur.fetchall())

@app.route("/api/summary")
def summary():
    project_id = request.args.get("project_id")
    db = get_db()
    cur = db.cursor(dictionary=True)

    where = "WHERE project_id = %s" if project_id else ""
    params = (project_id,) if project_id else ()

    # Total bugs
    cur.execute(f"SELECT COUNT(*) AS total FROM issue {where}", params)
    total = cur.fetchone()["total"]

    # By status
    cur.execute(f"""
        SELECT status, COUNT(*) AS count FROM issue {where}
        GROUP BY status ORDER BY count DESC
    """, params)
    by_status = cur.fetchall()

    # By priority
    cur.execute(f"""
        SELECT priority, COUNT(*) AS count FROM issue {where}
        GROUP BY priority ORDER BY FIELD(priority,'Highest','High','Medium','Low','Lowest')
    """, params)
    by_priority = cur.fetchall()

    # By severity
    cur.execute(f"""
        SELECT severity, COUNT(*) AS count FROM issue {where}
        GROUP BY severity
    """, params)
    by_severity = cur.fetchall()

    # By assignee (top 10)
    cur.execute(f"""
        SELECT u.display_name AS assignee, COUNT(*) AS count
        FROM issue i LEFT JOIN user u ON i.assignee_id = u.id
        {where} GROUP BY assignee ORDER BY count DESC LIMIT 10
    """, params)
    by_assignee = cur.fetchall()

    return jsonify({
        "total": total,
        "by_status": by_status,
        "by_priority": by_priority,
        "by_severity": by_severity,
        "by_assignee": by_assignee
    })

@app.route("/api/issues")
def issues():
    project_id = request.args.get("project_id")
    status     = request.args.get("status")
    priority   = request.args.get("priority")

    db = get_db()
    cur = db.cursor(dictionary=True)

    conditions, params = [], []
    if project_id:
        conditions.append("i.project_id = %s"); params.append(project_id)
    if status:
        conditions.append("i.status = %s"); params.append(status)
    if priority:
        conditions.append("i.priority = %s"); params.append(priority)

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    cur.execute(f"""
        SELECT i.jira_issue_key AS issue_key, i.summary,
               i.status, i.priority, i.severity, i.issue_type,
               r.display_name AS reporter,
               a.display_name AS assignee,
               i.created_at, i.updated_at
        FROM issue i
        LEFT JOIN user r ON i.reporter_id = r.id
        LEFT JOIN user a ON i.assignee_id = a.id
        {where}
        ORDER BY i.created_at DESC
        LIMIT 200
    """, params)
    return jsonify(cur.fetchall())

if __name__ == "__main__":
    app.run(debug=True, port=5000)
```

---

## Frontend (dashboard.html)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Bug Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: sans-serif; background: #f5f5f5; color: #333; }
    header { background: #0052CC; color: #fff; padding: 16px 24px;
             display: flex; align-items: center; gap: 16px; }
    header h1 { font-size: 20px; font-weight: 600; }
    select { padding: 6px 10px; border-radius: 6px; border: none; font-size: 14px; }
    .stats { display: flex; gap: 16px; padding: 20px 24px; flex-wrap: wrap; }
    .stat-card { background: #fff; border-radius: 10px; padding: 16px 24px;
                 min-width: 140px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
    .stat-card .num { font-size: 32px; font-weight: 700; color: #0052CC; }
    .stat-card .label { font-size: 13px; color: #666; margin-top: 4px; }
    .charts { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px,1fr));
              gap: 16px; padding: 0 24px 24px; }
    .chart-card { background: #fff; border-radius: 10px; padding: 20px;
                  box-shadow: 0 1px 4px rgba(0,0,0,.08); }
    .chart-card h3 { font-size: 14px; font-weight: 600; margin-bottom: 12px; color: #444; }
    .table-wrap { background: #fff; margin: 0 24px 24px; border-radius: 10px;
                  box-shadow: 0 1px 4px rgba(0,0,0,.08); overflow: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #f0f4ff; text-align: left; padding: 10px 14px;
         font-weight: 600; color: #444; border-bottom: 1px solid #e0e0e0; }
    td { padding: 9px 14px; border-bottom: 1px solid #f0f0f0; }
    tr:hover td { background: #f8f9ff; }
    .badge { padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
    .badge.High,.badge.Highest { background:#ffe0e0; color:#c00; }
    .badge.Medium { background:#fff3cd; color:#856404; }
    .badge.Low,.badge.Lowest { background:#e0f0e0; color:#2d6a2d; }
    .export-bar { padding: 0 24px 20px; display: flex; gap: 10px; }
    .export-bar button { padding: 8px 18px; border-radius: 6px; border: none;
                         font-size: 13px; font-weight: 600; cursor: pointer; }
    .btn-excel { background: #217346; color: #fff; }
    .btn-word  { background: #2b579a; color: #fff; }
    .btn-pptx  { background: #d24726; color: #fff; }
  </style>
</head>
<body>
<header>
  <h1>🐛 Bug Dashboard</h1>
  <select id="projectSelect" onchange="loadData()">
    <option value="">All Projects</option>
  </select>
</header>

<div class="stats" id="stats"></div>

<div class="charts">
  <div class="chart-card"><h3>By Status</h3><canvas id="statusChart"></canvas></div>
  <div class="chart-card"><h3>By Priority</h3><canvas id="priorityChart"></canvas></div>
  <div class="chart-card"><h3>By Severity</h3><canvas id="severityChart"></canvas></div>
  <div class="chart-card"><h3>Top Assignees</h3><canvas id="assigneeChart"></canvas></div>
</div>

<div class="export-bar">
  <button class="btn-excel" onclick="exportReport('excel')">⬇ Export Excel</button>
  <button class="btn-word"  onclick="exportReport('word')">⬇ Export Word</button>
  <button class="btn-pptx"  onclick="exportReport('pptx')">⬇ Export PowerPoint</button>
</div>

<div class="table-wrap">
  <table id="issueTable">
    <thead><tr>
      <th>Key</th><th>Summary</th><th>Status</th>
      <th>Priority</th><th>Severity</th><th>Assignee</th><th>Created</th>
    </tr></thead>
    <tbody></tbody>
  </table>
</div>

<script>
let charts = {};

async function init() {
  const res = await fetch('/api/projects');
  const projects = await res.json();
  const sel = document.getElementById('projectSelect');
  projects.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id; opt.textContent = p.name;
    sel.appendChild(opt);
  });
  loadData();
}

async function loadData() {
  const pid = document.getElementById('projectSelect').value;
  const q = pid ? `?project_id=${pid}` : '';
  const [summary, issues] = await Promise.all([
    fetch(`/api/summary${q}`).then(r => r.json()),
    fetch(`/api/issues${q}`).then(r => r.json())
  ]);
  renderStats(summary);
  renderCharts(summary);
  renderTable(issues);
}

function renderStats(s) {
  document.getElementById('stats').innerHTML = `
    <div class="stat-card"><div class="num">${s.total}</div><div class="label">Total Issues</div></div>
    <div class="stat-card"><div class="num">${s.by_status.find(x=>x.status==='In Progress')?.count||0}</div><div class="label">In Progress</div></div>
    <div class="stat-card"><div class="num">${s.by_priority.find(x=>x.priority==='High'||x.priority==='Highest')?.count||0}</div><div class="label">High Priority</div></div>
    <div class="stat-card"><div class="num">${s.by_status.find(x=>x.status==='Done')?.count||0}</div><div class="label">Resolved</div></div>
  `;
}

const COLORS = ['#0052CC','#36B37E','#FF5630','#FFAB00','#6554C0','#00B8D9','#FF8B00'];

function makeChart(id, type, labels, data) {
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(document.getElementById(id), {
    type, data: {
      labels,
      datasets: [{ data, backgroundColor: COLORS, borderWidth: 0 }]
    },
    options: { plugins: { legend: { position: 'right' } }, maintainAspectRatio: true }
  });
}

function renderCharts(s) {
  makeChart('statusChart',   'doughnut', s.by_status.map(x=>x.status),    s.by_status.map(x=>x.count));
  makeChart('priorityChart', 'bar',      s.by_priority.map(x=>x.priority), s.by_priority.map(x=>x.count));
  makeChart('severityChart', 'doughnut', s.by_severity.map(x=>x.severity||'N/A'), s.by_severity.map(x=>x.count));
  makeChart('assigneeChart', 'bar',      s.by_assignee.map(x=>x.assignee||'Unassigned'), s.by_assignee.map(x=>x.count));
}

function renderTable(issues) {
  document.querySelector('#issueTable tbody').innerHTML = issues.map(i => `
    <tr>
      <td><a href="#" style="color:#0052CC">${i.issue_key}</a></td>
      <td>${i.summary||''}</td>
      <td>${i.status||''}</td>
      <td><span class="badge ${i.priority}">${i.priority||''}</span></td>
      <td>${i.severity||'-'}</td>
      <td>${i.assignee||'Unassigned'}</td>
      <td>${i.created_at?.slice(0,10)||''}</td>
    </tr>`).join('');
}

function exportReport(format) {
  const pid = document.getElementById('projectSelect').value;
  window.location = `/api/export?format=${format}${pid?'&project_id='+pid:''}`;
}

init();
</script>
</body>
</html>
```

---

## Running

```bash
pip install flask mysql-connector-python --break-system-packages
python app.py
# open http://localhost:5000
```