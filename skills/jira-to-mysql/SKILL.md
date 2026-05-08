---
name: jira-to-mysql
description: "Use this skill whenever the user wants to pull data from Jira and store it in MySQL. Triggers include: 'sync Jira to MySQL', 'store Jira issues in database', 'pull Jira bugs into MySQL', 'create schema for Jira data', 'fetch Jira project data to database', or any request combining Jira as a source with MySQL/database as a destination. Use this skill for both schema design AND data sync logic. Always use this skill before writing any Jira-to-database code."
---

# Jira → MySQL

Pull issues, projects, and team members from Jira (via MCP) and store them in MySQL.

## Step 1: MySQL Schema

Run this once to set up the database:

```sql
CREATE TABLE project (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  jira_project_key VARCHAR(20)  NOT NULL UNIQUE,
  name             VARCHAR(255) NOT NULL,
  description      TEXT,
  synced_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE user (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  jira_account_id  VARCHAR(100) NOT NULL UNIQUE,
  display_name     VARCHAR(255),
  email            VARCHAR(255),
  avatar_url       VARCHAR(500)
);

CREATE TABLE project_member (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  user_id    INT NOT NULL,
  role       VARCHAR(100),
  FOREIGN KEY (project_id) REFERENCES project(id),
  FOREIGN KEY (user_id)    REFERENCES user(id),
  UNIQUE KEY uq_project_user (project_id, user_id)
);

CREATE TABLE issue (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  jira_issue_key   VARCHAR(50)  NOT NULL UNIQUE,  -- e.g. PROJ-42
  project_id       INT NOT NULL,
  reporter_id      INT,
  assignee_id      INT,
  summary          VARCHAR(1000),
  description      TEXT,
  issue_type       VARCHAR(50),   -- Bug, Task, Story
  status           VARCHAR(50),   -- To Do, In Progress, Done
  priority         VARCHAR(50),   -- Highest, High, Medium, Low, Lowest
  severity         VARCHAR(50),   -- Critical, Major, Minor, Trivial (custom field)
  created_at       TIMESTAMP,
  updated_at       TIMESTAMP,
  resolved_at      TIMESTAMP NULL,
  FOREIGN KEY (project_id)  REFERENCES project(id),
  FOREIGN KEY (reporter_id) REFERENCES user(id),
  FOREIGN KEY (assignee_id) REFERENCES user(id)
);

CREATE TABLE issue_label (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  issue_id INT NOT NULL,
  label    VARCHAR(255),
  FOREIGN KEY (issue_id) REFERENCES issue(id)
);
```

## Step 2: Fetch from Jira via MCP

### Fetch projects
```
MCP tool: list_projects (or search_projects)
→ map to: jira_project_key, name, description
```

### Fetch issues (bugs)
```
MCP tool: search_issues
JQL: project = "PROJ" AND issuetype = Bug ORDER BY created DESC

Fields to request:
  key, summary, description, issuetype, status,
  priority, customfield_10016 (severity),
  reporter, assignee, created, updated, resolutiondate, labels
```

### Fetch project members
```
MCP tool: get_project_members  (or list_project_roles)
→ map to: user table + project_member table
```

## Step 3: Sync Logic (Python)

```python
import mysql.connector
from datetime import datetime

conn = mysql.connector.connect(
    host="localhost", database="jira_db",
    user="root", password="YOUR_PASSWORD"
)
cur = conn.cursor()

def upsert_project(p):
    cur.execute("""
        INSERT INTO project (jira_project_key, name, description)
        VALUES (%s, %s, %s)
        ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description)
    """, (p["key"], p["name"], p.get("description", "")))
    conn.commit()

def upsert_user(u):
    if not u:
        return None
    cur.execute("""
        INSERT INTO user (jira_account_id, display_name, email)
        VALUES (%s, %s, %s)
        ON DUPLICATE KEY UPDATE display_name=VALUES(display_name)
    """, (u["accountId"], u.get("displayName"), u.get("emailAddress")))
    conn.commit()
    cur.execute("SELECT id FROM user WHERE jira_account_id=%s", (u["accountId"],))
    return cur.fetchone()[0]

def upsert_issue(issue, project_db_id):
    f = issue["fields"]
    reporter_id = upsert_user(f.get("reporter"))
    assignee_id = upsert_user(f.get("assignee"))
    severity = (f.get("customfield_10016") or {}).get("value")  # adjust field key
    labels = f.get("labels", [])

    cur.execute("""
        INSERT INTO issue (
            jira_issue_key, project_id, reporter_id, assignee_id,
            summary, description, issue_type, status,
            priority, severity, created_at, updated_at, resolved_at
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        ON DUPLICATE KEY UPDATE
            status=VALUES(status), assignee_id=VALUES(assignee_id),
            priority=VALUES(priority), severity=VALUES(severity),
            updated_at=VALUES(updated_at), resolved_at=VALUES(resolved_at)
    """, (
        issue["key"], project_db_id, reporter_id, assignee_id,
        f.get("summary"), f.get("description"),
        f["issuetype"]["name"], f["status"]["name"],
        (f.get("priority") or {}).get("name"), severity,
        f.get("created"), f.get("updated"), f.get("resolutiondate")
    ))
    conn.commit()

    # sync labels
    cur.execute("SELECT id FROM issue WHERE jira_issue_key=%s", (issue["key"],))
    issue_db_id = cur.fetchone()[0]
    cur.execute("DELETE FROM issue_label WHERE issue_id=%s", (issue_db_id,))
    for label in labels:
        cur.execute("INSERT INTO issue_label (issue_id, label) VALUES (%s,%s)", (issue_db_id, label))
    conn.commit()
```

## Field Mapping Reference

| Jira field | MySQL column | Notes |
|---|---|---|
| `key` | `jira_issue_key` | e.g. PROJ-42 |
| `fields.summary` | `summary` | |
| `fields.status.name` | `status` | To Do / In Progress / Done |
| `fields.priority.name` | `priority` | High / Medium / Low |
| `fields.customfield_XXXXX` | `severity` | Check your Jira config |
| `fields.issuetype.name` | `issue_type` | Bug / Task / Story |
| `fields.reporter.accountId` | `reporter_id` → user table | |
| `fields.assignee.accountId` | `assignee_id` → user table | |

> **Severity field**: Jira stores severity as a custom field. Find yours by calling `get_issue` on any bug and checking `customfield_*` keys, or ask the Jira admin.