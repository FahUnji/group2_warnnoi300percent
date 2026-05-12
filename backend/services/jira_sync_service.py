"""
JiraSyncService — fetches Bug-type issues from Jira Cloud API and upserts into SQLite.

Security notes (ASVS L1):
- access_token is decrypted in-memory only; never logged, never returned in API responses.
- All SQL uses sqlite3 '?' parameterized queries — no f-strings in SQL statements.
- Jira API errors are mapped to safe error codes; cloud_id and token are never leaked.
- HTTP calls use explicit timeout=(5, 30) to prevent indefinite hang on large result sets.
"""
import asyncio
from datetime import datetime, timezone

import requests
from fastapi import HTTPException

from backend.database import get_db
from backend.models.oauth_token import load_oauth_token
from backend.services.jira_service import _decrypt_token


def _get_auth_headers() -> tuple[str, str, str]:
    """
    Load OAuth token from DB and return (access_token, cloud_id, base_url).
    Raises HTTPException(400) if no token is stored.
    access_token is plaintext — caller must not log it.
    """
    row = load_oauth_token()
    if row is None:
        raise HTTPException(
            status_code=400,
            detail={"ok": False, "error": "not_configured", "message": "No OAuth token found. Please connect to Jira first."},
        )
    access_token = _decrypt_token(row["access_token_enc"])
    cloud_id = row["cloud_id"]
    base_url = f"https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3/"
    return access_token, cloud_id, base_url


def _fetch_bugs(project_key: str) -> dict:
    """
    Blocking function: call Jira search API for Bug-type issues.
    Returns {"ok": True, "issues": [...]} or {"ok": False, "error": ..., "message": ...}.
    Never logs or returns access_token or cloud_id.
    """
    try:
        access_token, cloud_id, _base_url = _get_auth_headers()
    except HTTPException as exc:
        return {"ok": False, "error": exc.detail["error"], "message": exc.detail["message"]}

    url = f"https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3/search"
    jql = f"project = {project_key} AND issuetype = Bug ORDER BY created DESC"
    params = {
        "jql": jql,
        "maxResults": 1000,
        "fields": "summary,status,priority,assignee,customfield_10020",
    }
    try:
        response = requests.get(
            url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/json",
            },
            params=params,
            timeout=(5, 30),
            verify=True,
        )
        response.raise_for_status()
        data = response.json()
        return {"ok": True, "issues": data.get("issues", [])}
    except requests.exceptions.ConnectionError:
        return {"ok": False, "error": "unreachable_host", "message": "Cannot reach Jira API. Check your network connection."}
    except requests.exceptions.Timeout:
        return {"ok": False, "error": "timeout", "message": "Jira API did not respond in time. Try again."}
    except requests.exceptions.HTTPError as exc:
        status = exc.response.status_code if exc.response is not None else 0
        if status == 401:
            return {"ok": False, "error": "invalid_credentials", "message": "OAuth token is expired or invalid. Please reconnect."}
        if status == 403:
            return {"ok": False, "error": "forbidden", "message": "Access denied. Check your Jira OAuth scopes."}
        # Do NOT include cloud_id or token in error message
        return {"ok": False, "error": "api_error", "message": f"Jira API returned HTTP {status}."}
    except requests.exceptions.RequestException:
        return {"ok": False, "error": "unreachable_host", "message": "Cannot reach Jira API. Check your network connection."}


def _store_bugs(project_key: str, issues: list, synced_at: str) -> int:
    """
    Blocking function: DELETE existing bugs for project_key then batch-insert new ones.
    Uses parameterized queries only (sqlite3 '?' placeholders).
    Returns count of inserted rows.
    """
    rows = []
    for issue in issues:
        fields = issue.get("fields", {})
        sprint_raw = fields.get("customfield_10020")
        sprint_name = sprint_raw[0]["name"] if sprint_raw else None
        assignee_field = fields.get("assignee")
        assignee = assignee_field.get("displayName") if assignee_field else None
        status_field = fields.get("status", {})
        priority_field = fields.get("priority", {})
        rows.append((
            issue.get("id"),          # issue_id (Jira numeric ID as string — cast to int below)
            issue.get("key", ""),     # issue_key e.g. PROJ-123
            project_key,
            fields.get("summary"),
            status_field.get("name") if status_field else None,
            priority_field.get("name") if priority_field else None,
            sprint_name,
            assignee,
            synced_at,
        ))

    # Cast issue_id to int (Jira returns it as a string in issue["id"])
    rows = [
        (int(r[0]) if r[0] is not None else None, *r[1:])
        for r in rows
    ]

    conn = get_db()
    try:
        # Parameterized DELETE — project_key bound via '?' placeholder
        conn.execute("DELETE FROM bugs WHERE project_key = ?", (project_key,))
        conn.executemany(
            "INSERT INTO bugs"
            " (issue_id, issue_key, project_key, summary, status, priority, sprint_name, assignee, synced_at)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            rows,
        )
        conn.commit()
        return len(rows)
    finally:
        conn.close()


def _fetch_projects() -> dict:
    """
    Blocking function: call GET /rest/api/3/project to list accessible projects.
    Returns {"ok": True, "projects": [{key, name}, ...]} or {"ok": False, ...}.
    """
    try:
        access_token, cloud_id, _base_url = _get_auth_headers()
    except HTTPException as exc:
        return {"ok": False, "error": exc.detail["error"], "message": exc.detail["message"]}

    url = f"https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3/project"
    try:
        response = requests.get(
            url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/json",
            },
            timeout=(5, 15),
            verify=True,
        )
        response.raise_for_status()
        data = response.json()
        projects = [{"key": p["key"], "name": p["name"]} for p in data]
        return {"ok": True, "projects": projects}
    except requests.exceptions.ConnectionError:
        return {"ok": False, "error": "unreachable_host", "message": "Cannot reach Jira API."}
    except requests.exceptions.Timeout:
        return {"ok": False, "error": "timeout", "message": "Jira API timed out."}
    except requests.exceptions.HTTPError as exc:
        status = exc.response.status_code if exc.response is not None else 0
        return {"ok": False, "error": "api_error", "message": f"Jira API returned HTTP {status}."}
    except requests.exceptions.RequestException:
        return {"ok": False, "error": "unreachable_host", "message": "Cannot reach Jira API."}


class JiraSyncService:
    """Service layer for Jira data sync: fetch bugs and project list."""

    async def sync_bugs(self, project_key: str) -> dict:
        """
        Fetch all Bug-type issues for project_key from Jira, upsert into bugs table.
        Raises HTTPException(400) on any failure.
        Returns {"ok": True, "synced": N, "project_key": ..., "synced_at": ...} on success.
        """
        loop = asyncio.get_running_loop()

        # Step 1: Fetch bugs from Jira (blocking HTTP)
        fetch_result = await loop.run_in_executor(None, _fetch_bugs, project_key)
        if not fetch_result["ok"]:
            raise HTTPException(
                status_code=400,
                detail={"ok": False, "error": fetch_result["error"], "message": fetch_result["message"]},
            )

        # Step 2: Store in SQLite (blocking DB write)
        synced_at = datetime.now(timezone.utc).isoformat()
        issues = fetch_result["issues"]
        count = await loop.run_in_executor(None, _store_bugs, project_key, issues, synced_at)

        return {
            "ok": True,
            "synced": count,
            "project_key": project_key,
            "synced_at": synced_at,
        }

    async def list_projects(self) -> dict:
        """
        Fetch list of accessible Jira projects.
        Raises HTTPException(400) on failure.
        Returns {"ok": True, "projects": [{key, name}, ...]} on success.
        """
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(None, _fetch_projects)
        if not result["ok"]:
            raise HTTPException(
                status_code=400,
                detail={"ok": False, "error": result["error"], "message": result["message"]},
            )
        return result
