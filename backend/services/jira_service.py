"""
JiraService — authentication, encryption, and credential management.

Security notes (ASVS L1):
- FERNET_KEY is sourced exclusively from os.environ["FERNET_KEY"].
  Missing key raises KeyError at call time — no silent default.
- api_token is encrypted before any DB write; never logged, never returned.
- Jira API call uses requests with explicit timeout=10 to prevent indefinite hang.
- Exception details (stack traces) are caught and mapped to safe error codes only.
"""
import asyncio
import os

import requests
from cryptography.fernet import Fernet
from fastapi import HTTPException

from backend.models.jira_config import load_config, upsert_config


def _get_fernet() -> Fernet:
    """Load Fernet cipher from FERNET_KEY env var. Raises KeyError if unset."""
    key = os.environ["FERNET_KEY"]
    return Fernet(key.encode())


def _encrypt_token(api_token: str) -> str:
    """Encrypt api_token with Fernet. Returns URL-safe base64 string."""
    return _get_fernet().encrypt(api_token.encode()).decode()


def _decrypt_token(api_token_encrypted: str) -> str:
    """Decrypt an encrypted api_token. Returns plaintext string."""
    return _get_fernet().decrypt(api_token_encrypted.encode()).decode()


def _test_jira_auth(base_url: str, email: str, api_token: str) -> dict:
    """
    Call GET /rest/api/3/myself on the Jira instance.
    Returns {"ok": True} on success.
    Returns {"ok": False, "error": <code>, "message": <human text>} on failure.

    Error codes (D-12):
      invalid_credentials — Jira returned 401
      unreachable_host    — DNS failure or connection refused
      timeout             — no response within 10 seconds
    """
    url = f"{base_url.rstrip('/')}/rest/api/3/myself"
    try:
        response = requests.get(
            url,
            auth=(email, api_token),
            timeout=10,  # Claude's discretion: 10s per CONTEXT.md
            headers={"Accept": "application/json"},
        )
        if response.status_code == 401:
            return {
                "ok": False,
                "error": "invalid_credentials",
                "message": "Invalid email or API token. Please check your credentials and try again.",
            }
        response.raise_for_status()
        return {"ok": True}
    except requests.exceptions.ConnectionError:
        return {
            "ok": False,
            "error": "unreachable_host",
            "message": "Cannot reach Jira at that URL. Check the base URL and your network connection.",
        }
    except requests.exceptions.Timeout:
        return {
            "ok": False,
            "error": "timeout",
            "message": "Connection timed out. Jira did not respond in time — try again in a moment.",
        }
    except requests.exceptions.RequestException:
        # Catch-all for unexpected HTTP errors — do not leak details
        return {
            "ok": False,
            "error": "unreachable_host",
            "message": "Cannot reach Jira at that URL. Check the base URL and your network connection.",
        }


class JiraService:
    """Service layer for Jira authentication and credential management."""

    async def test_and_save(
        self, base_url: str, email: str, api_token: str
    ) -> dict:
        """
        Test Jira credentials, then encrypt and persist them if valid.

        Raises HTTPException(400) with D-13 error shape on failure.
        Returns {"ok": True, "message": "Connected successfully"} on success.
        """
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None, _test_jira_auth, base_url, email, api_token
        )
        if not result["ok"]:
            raise HTTPException(
                status_code=400,
                detail={"ok": False, "error": result["error"], "message": result["message"]},
            )
        # Credentials valid — encrypt and persist (D-03)
        encrypted = _encrypt_token(api_token)
        await loop.run_in_executor(None, upsert_config, base_url, email, encrypted)
        return {"ok": True, "message": "Connected successfully"}

    async def verify_saved_credentials(self) -> dict:
        """
        Load saved credentials from DB and re-verify against Jira.

        Used on app load (D-14): if valid → {"ok": True}; if not → {"ok": False, ...}.
        Returns {"ok": False, "error": "not_configured", ...} if no saved credentials.
        """
        loop = asyncio.get_event_loop()
        config = await loop.run_in_executor(None, load_config)
        if config is None:
            return {
                "ok": False,
                "error": "not_configured",
                "message": "No Jira connection configured. Please enter your credentials.",
            }
        try:
            api_token = _decrypt_token(config["api_token_encrypted"])
        except Exception:
            # Corrupted/invalid Fernet token — treat as not configured
            return {
                "ok": False,
                "error": "not_configured",
                "message": "Saved credentials could not be decrypted. Please reconnect.",
            }
        result = await loop.run_in_executor(
            None, _test_jira_auth, config["base_url"], config["email"], api_token
        )
        return result
