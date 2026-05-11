"""
Jira router — exposes two endpoints for the React frontend:

  POST /api/jira/connect  — test credentials + save if valid (D-02, D-03, JIRA-02, JIRA-03)
  GET  /api/jira/status   — verify saved credentials on app load (D-14, JIRA-02, JIRA-03)

Error response shape (D-13):
  HTTP 400: {"ok": false, "error": "<code>", "message": "<human text>"}
  Codes: invalid_credentials | unreachable_host | timeout | not_configured
"""
from fastapi import APIRouter
from pydantic import BaseModel, field_validator

from backend.services.jira_service import JiraService

router = APIRouter(prefix="/api/jira", tags=["jira"])


class JiraConfigRequest(BaseModel):
    """Request body for POST /api/jira/connect (D-01: exactly 3 fields)."""

    base_url: str
    email: str
    api_token: str

    @field_validator("base_url")
    @classmethod
    def base_url_must_be_https(cls, v: str) -> str:
        v = v.strip()
        if not v.startswith("http://") and not v.startswith("https://"):
            raise ValueError("base_url must start with http:// or https://")
        if len(v) > 500:
            raise ValueError("base_url must be 500 characters or fewer")
        return v

    @field_validator("email")
    @classmethod
    def email_must_be_present(cls, v: str) -> str:
        v = v.strip()
        if not v or "@" not in v:
            raise ValueError("email must be a valid email address")
        if len(v) > 255:
            raise ValueError("email must be 255 characters or fewer")
        return v

    @field_validator("api_token")
    @classmethod
    def api_token_must_be_present(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("api_token must not be empty")
        return v


@router.post("/connect")
async def connect_jira(payload: JiraConfigRequest):
    """
    Test Jira credentials and persist them if valid.

    Success: HTTP 200, {"ok": true, "message": "Connected successfully"}
    Failure: HTTP 400, {"ok": false, "error": "<code>", "message": "<human text>"}
    """
    service = JiraService()
    # JiraService.test_and_save raises HTTPException(400) on failure
    result = await service.test_and_save(
        payload.base_url, payload.email, payload.api_token
    )
    return result


@router.get("/status")
async def jira_status():
    """
    Verify saved Jira credentials (called on React app load — D-14).

    Returns {"ok": true} if saved credentials are valid.
    Returns {"ok": false, "error": "<code>", "message": "<text>"} otherwise.
    This endpoint never raises — always returns 200 with ok flag.
    """
    service = JiraService()
    return await service.verify_saved_credentials()
