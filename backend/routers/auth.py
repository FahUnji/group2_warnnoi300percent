import logging
import os
import secrets
import time
import traceback
import urllib.parse

import requests as http
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, RedirectResponse

logger = logging.getLogger(__name__)

from backend.database import count_projects
from backend.models.oauth_token import upsert_oauth_token
from backend.models.session import SESSION_TTL_DAYS, create_session, delete_session
from backend.models.user import load_user, upsert_user
from backend.services.jira_service import _encrypt_token, _decrypt_token

router = APIRouter(prefix="/api/auth", tags=["auth"])

ATLASSIAN_AUTH_URL = "https://auth.atlassian.com/authorize"
ATLASSIAN_TOKEN_URL = "https://auth.atlassian.com/oauth/token"
ATLASSIAN_RESOURCES_URL = "https://api.atlassian.com/oauth/token/accessible-resources"
SCOPES = "read:me read:jira-data read:jira-work offline_access"
STATE_TTL = 600

_pending_states: dict[str, float] = {}


@router.get("/atlassian")
async def atlassian_login():
    client_id = os.environ.get("ATLASSIAN_CLIENT_ID", "")
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")

    if not client_id or client_id == "your_client_id_here":
        return RedirectResponse(f"{frontend_url}/?error=oauth_not_configured")

    redirect_uri = os.environ.get(
        "ATLASSIAN_REDIRECT_URI",
        "http://localhost:8000/api/auth/atlassian/callback",
    )
    state = secrets.token_urlsafe(32)
    _pending_states[state] = time.time()

    params = {
        "audience": "api.atlassian.com",
        "client_id": client_id,
        "scope": SCOPES,
        "redirect_uri": redirect_uri,
        "state": state,
        "response_type": "code",
    }
    url = ATLASSIAN_AUTH_URL + "?" + urllib.parse.urlencode(params)
    return RedirectResponse(url)


@router.get("/atlassian/callback")
async def atlassian_callback(code: str = "", state: str = "", error: str = ""):
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")

    if error:
        return RedirectResponse(
            f"{frontend_url}/?error={urllib.parse.quote(error)}"
        )

    ts = _pending_states.pop(state, None)
    if ts is None or (time.time() - ts) > STATE_TTL:
        return RedirectResponse(f"{frontend_url}/?error=invalid_state")

    client_id = os.environ.get("ATLASSIAN_CLIENT_ID", "")
    client_secret = os.environ.get("ATLASSIAN_CLIENT_SECRET", "")
    redirect_uri = os.environ.get(
        "ATLASSIAN_REDIRECT_URI",
        "http://localhost:8000/api/auth/atlassian/callback",
    )

    # Exchange code for tokens
    try:
        resp = http.post(
            ATLASSIAN_TOKEN_URL,
            json={
                "grant_type": "authorization_code",
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
                "redirect_uri": redirect_uri,
            },
            headers={"Accept": "application/json"},
            timeout=15,
        )
        resp.raise_for_status()
        token_data = resp.json()
    except Exception:
        logger.error("OAuth step 1 (token exchange) failed:\n%s", traceback.format_exc())
        return RedirectResponse(f"{frontend_url}/?error=token_exchange_failed")

    access_token = token_data.get("access_token", "")
    refresh_token = token_data.get("refresh_token", "")
    expires_in = token_data.get("expires_in", 3600)
    expires_at = str(int(time.time()) + int(expires_in))

    # Fetch Atlassian user identity
    try:
        me_resp = http.get(
            "https://api.atlassian.com/me",
            headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
            timeout=10,
        )
        me_resp.raise_for_status()
        me_data = me_resp.json()
    except Exception:
        logger.error("OAuth step 2 (/me fetch) failed:\n%s", traceback.format_exc())
        return RedirectResponse(f"{frontend_url}/?error=token_exchange_failed")

    account_id = me_data.get("account_id", "")
    if not account_id:
        logger.error("OAuth step 2 (/me) returned no account_id. me_data keys: %s", list(me_data.keys()))
        return RedirectResponse(f"{frontend_url}/?error=token_exchange_failed")

    email = me_data.get("email") or me_data.get("emailAddress", "")
    display_name = me_data.get("name") or me_data.get("displayName", "")
    avatar_url = me_data.get("picture") or (me_data.get("avatarUrls") or {}).get("48x48", "")

    # Get accessible Jira Cloud sites
    try:
        res = http.get(
            ATLASSIAN_RESOURCES_URL,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/json",
            },
            timeout=10,
        )
        res.raise_for_status()
        resources = res.json()
    except Exception:
        logger.error("OAuth step 3 (accessible-resources) failed:\n%s", traceback.format_exc())
        return RedirectResponse(f"{frontend_url}/?error=resources_failed")

    if not resources:
        return RedirectResponse(f"{frontend_url}/?error=no_jira_access")

    site = resources[0]
    cloud_id = site["id"]
    site_url = site["url"]
    site_name = site.get("name", "")

    # Persist user + token
    try:
        user_id = upsert_user(account_id, email, display_name, avatar_url)
        access_token_enc = _encrypt_token(access_token)
        refresh_token_enc = _encrypt_token(refresh_token) if refresh_token else ""
        upsert_oauth_token(user_id, access_token_enc, refresh_token_enc, cloud_id, site_url, site_name, expires_at)
        session_id = create_session(user_id)
        project_count = count_projects(user_id)
    except Exception:
        logger.error("OAuth callback DB/session error:\n%s", traceback.format_exc())
        return RedirectResponse(f"{frontend_url}/?error=token_exchange_failed")

    redirect_path = "/dashboard" if project_count > 0 else "/"

    response = RedirectResponse(f"{frontend_url}{redirect_path}")
    response.set_cookie(
        key="session_id",
        value=session_id,
        httponly=True,
        samesite="lax",
        max_age=SESSION_TTL_DAYS * 86400,
        secure=os.environ.get("COOKIE_SECURE", "false").lower() == "true",
    )
    return response


@router.get("/me")
async def auth_me(request: Request):
    session_id = request.cookies.get("session_id")
    if not session_id:
        return {"ok": False, "error": "not_authenticated"}

    from backend.models.session import get_session_user
    user_id = get_session_user(session_id)
    if user_id is None:
        return {"ok": False, "error": "session_expired"}

    user = load_user(user_id)
    if not user:
        return {"ok": False, "error": "not_authenticated"}

    return {
        "ok": True,
        "has_projects": count_projects(user_id) > 0,
        "user": {
            "name": user["display_name"],
            "email": user["email"],
            "avatar": user["avatar_url"],
        },
    }


@router.post("/logout")
async def auth_logout(request: Request):
    session_id = request.cookies.get("session_id")
    if session_id:
        delete_session(session_id)
    response = JSONResponse({"ok": True})
    response.delete_cookie("session_id", samesite="lax")
    return response
