"""
Jira router — exposes two endpoints for the React frontend:

  POST /api/jira/connect  — test credentials + save if valid (D-02, D-03, JIRA-02, JIRA-03)
  GET  /api/jira/status   — verify saved credentials on app load (D-14, JIRA-02, JIRA-03)

Error response shape (D-13):
  HTTP 400: {"ok": false, "error": "<code>", "message": "<human text>"}
  Codes: invalid_credentials | unreachable_host | timeout | not_configured
"""
import ipaddress
import urllib.parse

from fastapi import APIRouter, Depends
from pydantic import BaseModel, field_validator

from backend.dependencies import get_current_user
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
        # CR-03: https-only — http:// allows SSRF to internal services
        if not v.startswith("https://"):
            raise ValueError("base_url must start with https://")
        if len(v) > 500:
            raise ValueError("base_url must be 500 characters or fewer")
        # CR-03: Reject IP literals pointing at private/loopback ranges
        host = urllib.parse.urlparse(v).hostname or ""
        try:
            addr = ipaddress.ip_address(host)
        except ValueError:
            pass  # hostname — not an IP, acceptable
        else:
            if addr.is_private or addr.is_loopback or addr.is_link_local:
                raise ValueError("base_url must not point to a private or internal address")
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
        # CR-05: Jira tokens are fixed-length (<256 chars); reject oversized payloads
        if len(v) > 500:
            raise ValueError("api_token must be 500 characters or fewer")
        return v


@router.post("/connect")
async def connect_jira(
    payload: JiraConfigRequest,
    user_id: int = Depends(get_current_user),
):
    service = JiraService()
    result = await service.test_and_save(
        payload.base_url, payload.email, payload.api_token, user_id
    )
    return result


@router.get("/status")
async def jira_status(_: int = Depends(get_current_user)):
    service = JiraService()
    return await service.verify_saved_credentials()


@router.get("/me")
async def jira_me(_: int = Depends(get_current_user)):
    service = JiraService()
    return await service.get_current_user()
