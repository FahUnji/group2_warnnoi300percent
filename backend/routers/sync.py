from fastapi import APIRouter, Depends, HTTPException

from backend.database import get_db
from backend.dependencies import get_current_user
from backend.services.jira_sprint_service import JiraSprintService as _JiraSprintService
from backend.services.jira_sync_service import JiraSyncService, _validate_project_key

router = APIRouter(prefix="/api", tags=["sync"])


@router.post("/sync/{project_key}")
async def trigger_sync(
    project_key: str,
    user_id: int = Depends(get_current_user),
):
    try:
        _validate_project_key(project_key)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"ok": False, "error": "invalid_project_key", "message": str(exc)})
    service = JiraSyncService()
    result = await service.sync_bugs(project_key, user_id)
    try:
        await _JiraSprintService().get_sprints(project_key, user_id)
    except Exception:
        pass
    return result


@router.get("/bugs/{project_key}")
async def get_bugs(
    project_key: str,
    user_id: int = Depends(get_current_user),
):
    try:
        _validate_project_key(project_key)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"ok": False, "error": "invalid_project_key", "message": str(exc)})
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT issue_key, summary, status, priority, sprint_name, assignee, synced_at"
            " FROM bugs WHERE project_key = ? AND user_id = ? ORDER BY issue_key ASC",
            (project_key, user_id),
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
async def search_projects(
    q: str = "",
    user_id: int = Depends(get_current_user),
):
    service = JiraSyncService()
    return await service.search_projects(q.strip(), user_id)


@router.get("/projects")
async def list_projects(user_id: int = Depends(get_current_user)):
    service = JiraSyncService()
    return await service.list_projects(user_id)


@router.delete("/projects/{project_key}")
async def delete_project(
    project_key: str,
    user_id: int = Depends(get_current_user),
):
    try:
        _validate_project_key(project_key)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"ok": False, "error": "invalid_project_key", "message": str(exc)})
    conn = get_db()
    try:
        conn.execute(
            "DELETE FROM sprints WHERE project_key = ? AND user_id = ?",
            (project_key, user_id),
        )
        conn.execute(
            "DELETE FROM bugs WHERE project_key = ? AND user_id = ?",
            (project_key, user_id),
        )
        conn.execute(
            "DELETE FROM jira_projects WHERE project_key = ? AND user_id = ?",
            (project_key, user_id),
        )
        conn.commit()
    finally:
        conn.close()
    return {"ok": True}


@router.get("/projects/{project_key}")
async def get_project_meta(
    project_key: str,
    user_id: int = Depends(get_current_user),
):
    try:
        _validate_project_key(project_key)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={"ok": False, "error": "invalid_project_key", "message": str(exc)},
        )
    conn = get_db()
    try:
        proj = conn.execute(
            "SELECT project_key, project_name FROM jira_projects"
            " WHERE project_key = ? AND user_id = ?",
            (project_key, user_id),
        ).fetchone()
        token = conn.execute(
            "SELECT site_name, site_url FROM oauth_tokens WHERE user_id = ? LIMIT 1",
            (user_id,),
        ).fetchone()
    finally:
        conn.close()
    return {
        "ok": True,
        "project_key": project_key,
        "project_name": proj["project_name"] if proj else None,
        "site_name": token["site_name"] if token else None,
        "site_url": token["site_url"] if token else None,
    }


@router.get("/sprints/{project_key}")
async def get_sprints(
    project_key: str,
    user_id: int = Depends(get_current_user),
):
    try:
        _validate_project_key(project_key)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"ok": False, "error": "invalid_project_key", "message": str(exc)})
    service = _JiraSprintService()
    result = await service.get_sprints(project_key, user_id)
    if not result["ok"]:
        raise HTTPException(
            status_code=400,
            detail={"ok": False, "error": result["error"], "message": result["message"]},
        )
    return result
