"""Stub — replaced in Plan 02 with full Jira router."""
from fastapi import APIRouter

router = APIRouter(prefix="/api/jira", tags=["jira"])


@router.get("/status")
async def jira_status():
    """Stub: returns not_configured until Plan 02 wires the service."""
    return {"ok": False, "error": "not_configured", "message": "Backend setup in progress."}
