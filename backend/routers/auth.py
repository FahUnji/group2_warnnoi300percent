import os
import secrets
import time
import urllib.parse

import requests as http
from fastapi import APIRouter
from fastapi.responses import RedirectResponse

from backend.models.oauth_token import upsert_oauth_token
from backend.services.jira_service import _encrypt_token

router = APIRouter(prefix="/api/auth", tags=["auth"])

ATLASSIAN_AUTH_URL = "https://auth.atlassian.com/authorize"
ATLASSIAN_TOKEN_URL = "https://auth.atlassian.com/oauth/token"
ATLASSIAN_RESOURCES_URL = "https://api.atlassian.com/oauth/token/accessible-resources"
SCOPES = "read:jira-data read:jira-work offline_access"
STATE_TTL = 600  # seconds

# state → issued_at timestamp (in-memory, single-process dev store)
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
        "prompt": "consent",
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

    # CSRF — validate state
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
        return RedirectResponse(f"{frontend_url}/?error=token_exchange_failed")

    access_token = token_data.get("access_token", "")
    refresh_token = token_data.get("refresh_token", "")
    expires_in = token_data.get("expires_in", 3600)
    expires_at = str(int(time.time()) + int(expires_in))

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
        return RedirectResponse(f"{frontend_url}/?error=resources_failed")

    if not resources:
        return RedirectResponse(f"{frontend_url}/?error=no_jira_access")

    # Use first site
    site = resources[0]
    cloud_id = site["id"]
    site_url = site["url"]
    site_name = site.get("name", "")

    # Encrypt and persist
    access_token_enc = _encrypt_token(access_token)
    refresh_token_enc = _encrypt_token(refresh_token) if refresh_token else ""
    upsert_oauth_token(
        access_token_enc, refresh_token_enc, cloud_id, site_url, site_name, expires_at
    )

    return RedirectResponse(f"{frontend_url}/dashboard")
