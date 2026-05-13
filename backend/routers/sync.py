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
from fastapi import APIRouter, HTTPException

from backend.database import get_db
from backend.services.jira_sprint_service import JiraSprintService as _JiraSprintService
from backend.services.jira_sync_service import JiraSyncService, _validate_project_key

router = APIRouter(prefix="/api", tags=["sync"])


@router.post("/sync/{project_key}")
async def trigger_sync(project_key: str):
    """
    Fetch all Bug-type issues for project_key from Jira, upsert into bugs table.
    Also syncs sprint metadata so the Sprint page reflects fresh data.

    Success: HTTP 200, {"ok": true, "synced": N, "project_key": "...", "synced_at": "..."}
    Failure: HTTP 400, {"ok": false, "error": "<code>", "message": "<human text>"}
    """
    try:
        _validate_project_key(project_key)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"ok": False, "error": "invalid_project_key", "message": str(exc)})
    service = JiraSyncService()
    result = await service.sync_bugs(project_key)
    # Sync sprint metadata alongside bugs; errors are non-fatal for the bug sync response
    try:
        await _JiraSprintService().get_sprints(project_key)
    except Exception:
        pass
    return result


@router.get("/bugs/{project_key}")
async def get_bugs(project_key: str):
    """
    Return all bugs stored in SQLite for project_key.

    Success: HTTP 200, {"ok": true, "bugs": [...], "total": N}
    """
    try:
        _validate_project_key(project_key)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"ok": False, "error": "invalid_project_key", "message": str(exc)})
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


@router.delete("/projects/{project_key}")
async def delete_project(project_key: str):
    """
    Remove a synced project and all its bugs from local SQLite.

    Success: HTTP 200, {"ok": true}
    """
    try:
        _validate_project_key(project_key)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"ok": False, "error": "invalid_project_key", "message": str(exc)})
    conn = get_db()
    try:
        conn.execute("DELETE FROM sprints WHERE project_key = ?", (project_key,))
        conn.execute("DELETE FROM bugs WHERE project_key = ?", (project_key,))
        conn.execute("DELETE FROM jira_projects WHERE project_key = ?", (project_key,))
        conn.commit()
    finally:
        conn.close()
    return {"ok": True}


@router.get("/sprints/{project_key}")
async def get_sprints(project_key: str):
    """
    Fetch sprint list for project_key from Jira Board API, upsert into sprints table,
    and return combined sprint list with bug counts from bugs table.

    Success: HTTP 200, {"ok": true, "sprints": [...], "synced_at": "..."}
      Each sprint: {sprint_id, sprint_name, state, start_date, end_date,
                    found, resolved, critical, high, medium, low}
    Failure: HTTP 400, {"ok": false, "error": "<code>", "message": "<human text>"}
    Error codes: not_configured | unreachable_host | timeout | invalid_credentials | forbidden | api_error
    """
    try:
        _validate_project_key(project_key)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"ok": False, "error": "invalid_project_key", "message": str(exc)})
    service = _JiraSprintService()
    result = await service.get_sprints(project_key)
    if not result["ok"]:
        raise HTTPException(
            status_code=400,
            detail={"ok": False, "error": result["error"], "message": result["message"]},
        )
    return result
