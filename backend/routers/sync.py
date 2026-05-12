"""
Sync router — exposes two endpoints:

  POST /api/sync/{project_key}  — fetch all Bug-type issues for project, upsert into bugs table (SYNC-01, SYNC-02, SYNC-03)
  GET  /api/projects            — list accessible Jira projects for the project picker (D-05)

Error response shape:
  HTTP 400: {"ok": false, "error": "<code>", "message": "<human text>"}
  Codes: not_configured | unreachable_host | timeout | invalid_credentials | forbidden | api_error

Security: project_key is passed as a path parameter (string only). It is used in a JQL
query string but is NOT interpolated into a SQL statement — SQL uses parameterized queries
in JiraSyncService._store_bugs. The JQL string is passed as a query param value, not
concatenated into a URL path in an unsafe way.
"""
from fastapi import APIRouter

from backend.database import get_db
from backend.services.jira_sync_service import JiraSyncService

router = APIRouter(prefix="/api", tags=["sync"])


@router.post("/sync/{project_key}")
async def trigger_sync(project_key: str):
    """
    Fetch all Bug-type issues for project_key from Jira, upsert into bugs table.

    Success: HTTP 200, {"ok": true, "synced": N, "project_key": "...", "synced_at": "..."}
    Failure: HTTP 400, {"ok": false, "error": "<code>", "message": "<human text>"}
    """
    service = JiraSyncService()
    return await service.sync_bugs(project_key)


@router.get("/bugs/{project_key}")
async def get_bugs(project_key: str):
    """
    Return all bugs stored in SQLite for project_key.

    Success: HTTP 200, {"ok": true, "bugs": [...], "total": N}
    """
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT issue_key, summary, status, priority, sprint_name, assignee, synced_at"
            " FROM bugs WHERE project_key = ? ORDER BY issue_key ASC",
            (project_key,),
        ).fetchall()
    finally:
        conn.close()
    bugs = [
        {
            "issue_key": r["issue_key"],
            "summary": r["summary"],
            "status": r["status"],
            "priority": r["priority"],
            "sprint_name": r["sprint_name"],
            "assignee": r["assignee"],
            "synced_at": r["synced_at"],
        }
        for r in rows
    ]
    return {"ok": True, "bugs": bugs, "total": len(bugs)}


@router.get("/projects/search")
async def search_projects(q: str = ""):
    """
    Search accessible Jira projects by name or key for the project picker.
    Empty query returns all accessible projects (up to 20).

    Success: HTTP 200, {"ok": true, "projects": [{"key": "PROJ", "name": "My Project"}, ...]}
    """
    service = JiraSyncService()
    return await service.search_projects(q.strip())


@router.get("/projects")
async def list_projects():
    """
    Return list of accessible Jira projects for the frontend project picker.

    Success: HTTP 200, {"ok": true, "projects": [{"key": "PROJ", "name": "My Project"}, ...]}
    Failure: HTTP 400, {"ok": false, "error": "<code>", "message": "<human text>"}
    """
    service = JiraSyncService()
    return await service.list_projects()
