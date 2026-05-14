"""
JiraSyncService — fetches Bug-type issues from Jira Cloud API and upserts into SQLite.

Security notes (ASVS L1):
- access_token is decrypted in-memory only; never logged, never returned in API responses.
- All SQL uses sqlite3 '?' parameterized queries — no f-strings in SQL statements.
- Jira API errors are mapped to safe error codes; cloud_id and token are never leaked.
- HTTP calls use explicit timeout=(5, 30) to prevent indefinite hang on large result sets.
- project_key is validated against _PROJECT_KEY_RE before use in JQL to prevent injection.
"""
import asyncio
import re
from datetime import datetime, timezone

import requests
from fastapi import HTTPException

from backend.database import get_db
from backend.models.oauth_token import load_oauth_token
from backend.services.jira_service import _decrypt_token

_PROJECT_KEY_RE = re.compile(r'^[A-Z][A-Z0-9_]{0,9}$')


def _validate_project_key(project_key: str) -> None:
    if not _PROJECT_KEY_RE.match(project_key):
        raise ValueError(f"Invalid project key: {project_key!r}")


def _get_auth_headers(user_id: int) -> tuple[str, str, str]:
    """
    Load OAuth token for user_id and return (access_token, cloud_id, base_url).
    Raises HTTPException(400) if no token is stored.
    access_token is plaintext — caller must not log it.
    """
    row = load_oauth_token(user_id)
    if row is None:
        raise HTTPException(
            status_code=400,
            detail={"ok": False, "error": "not_configured", "message": "No OAuth token found. Please connect to Jira first."},
        )
    access_token = _decrypt_token(row["access_token_enc"])
    cloud_id = row["cloud_id"]
    base_url = f"https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3/"
    return access_token, cloud_id, base_url


_PAGE_SIZE = 100


def _jira_search(url: str, access_token: str, jql: str) -> dict:
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    all_issues: list = []
    next_page_token: str | None = None

    while True:
        payload: dict = {
            "jql": jql,
            "maxResults": _PAGE_SIZE,
            "fields": ["summary", "status", "priority", "assignee", "fixVersions"],
        }
        if next_page_token:
            payload["nextPageToken"] = next_page_token

        try:
            response = requests.post(url, headers=headers, json=payload, timeout=(5, 30), verify=True)
            response.raise_for_status()
            data = response.json()
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
            return {"ok": False, "error": "api_error", "message": f"Jira API returned HTTP {status}."}
        except requests.exceptions.RequestException:
            return {"ok": False, "error": "unreachable_host", "message": "Cannot reach Jira API. Check your network connection."}

        page = data.get("issues", [])
        all_issues.extend(page)
        next_page_token = data.get("nextPageToken")
        if not page or not next_page_token:
            break

    return {"ok": True, "issues": all_issues}


def _fetch_bugs(project_key: str, user_id: int) -> dict:
    try:
        _validate_project_key(project_key)
    except ValueError as exc:
        return {"ok": False, "error": "invalid_project_key", "message": str(exc)}

    try:
        access_token, cloud_id, _base_url = _get_auth_headers(user_id)
    except HTTPException as exc:
        return {"ok": False, "error": exc.detail["error"], "message": exc.detail["message"]}

    url = f"https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3/search/jql"
    return _jira_search(
        url,
        access_token,
        f'project = {project_key} AND issuetype in (Bug, "Bug Task") ORDER BY created DESC',
    )


def _store_bugs(project_key: str, issues: list, synced_at: str, user_id: int) -> int:
    rows = []
    for issue in issues:
        fields = issue.get("fields", {})
        fix_versions = fields.get("fixVersions") or []
        sprint_name = fix_versions[0].get("name") if fix_versions else None
        sprint_id = int(fix_versions[0].get("id", 0)) if fix_versions else None
        assignee_field = fields.get("assignee")
        assignee = assignee_field.get("displayName") if assignee_field else None
        status_field = fields.get("status", {})
        priority_field = fields.get("priority", {})
        rows.append((
            user_id,
            issue.get("id"),
            issue.get("key", ""),
            project_key,
            fields.get("summary"),
            status_field.get("name") if status_field else None,
            priority_field.get("name") if priority_field else None,
            sprint_name,
            sprint_id,
            assignee,
            synced_at,
        ))

    rows = [
        (r[0], int(r[1]) if r[1] is not None else None, *r[2:])
        for r in rows
    ]

    conn = get_db()
    try:
        conn.execute(
            "DELETE FROM bugs WHERE project_key = ? AND user_id = ?",
            (project_key, user_id),
        )
        conn.executemany(
            "INSERT INTO bugs"
            " (user_id, issue_id, issue_key, project_key, summary, status, priority, sprint_name, sprint_id, assignee, synced_at)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            rows,
        )
        conn.commit()
        return len(rows)
    finally:
        conn.close()


def _fetch_project_name(project_key: str, user_id: int) -> str:
    try:
        access_token, cloud_id, _ = _get_auth_headers(user_id)
    except HTTPException:
        return project_key
    url = f"https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3/project/{project_key}"
    try:
        resp = requests.get(
            url,
            headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
            timeout=(5, 10),
            verify=True,
        )
        resp.raise_for_status()
        return resp.json().get("name", project_key)
    except Exception:
        return project_key


def _upsert_project(project_key: str, project_name: str, user_id: int) -> None:
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO jira_projects (user_id, project_key, project_url, project_name)"
            " VALUES (?, ?, '', ?)"
            " ON CONFLICT(user_id, project_key) DO UPDATE SET project_name = excluded.project_name",
            (user_id, project_key, project_name),
        )
        conn.commit()
    finally:
        conn.close()


def _list_synced_projects(user_id: int) -> dict:
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT project_key, project_name FROM jira_projects"
            " WHERE user_id = ? ORDER BY added_at ASC",
            (user_id,),
        ).fetchall()
    finally:
        conn.close()
    return {
        "ok": True,
        "projects": [
            {"key": r["project_key"], "name": r["project_name"] or r["project_key"]}
            for r in rows
        ],
    }


def _search_jira_projects(query: str, user_id: int) -> dict:
    try:
        access_token, cloud_id, _ = _get_auth_headers(user_id)
    except HTTPException as exc:
        return {"ok": False, "error": exc.detail["error"], "message": exc.detail["message"]}
    url = f"https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3/project/search"
    params: dict = {"maxResults": 20}
    if query:
        params["query"] = query
    try:
        resp = requests.get(
            url,
            headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
            params=params,
            timeout=(5, 10),
            verify=True,
        )
        resp.raise_for_status()
        data = resp.json()
        projects = [
            {"key": p["key"], "name": p["name"]}
            for p in data.get("values", [])
        ]
        return {"ok": True, "projects": projects}
    except requests.exceptions.HTTPError as exc:
        status = exc.response.status_code if exc.response is not None else 0
        if status == 401:
            return {"ok": False, "error": "invalid_credentials", "message": "OAuth token is expired or invalid."}
        return {"ok": False, "error": "api_error", "message": f"Jira API returned HTTP {status}."}
    except Exception:
        return {"ok": False, "error": "unreachable_host", "message": "Cannot reach Jira API."}


class JiraSyncService:

    async def sync_bugs(self, project_key: str, user_id: int) -> dict:
        loop = asyncio.get_running_loop()

        fetch_result = await loop.run_in_executor(None, _fetch_bugs, project_key, user_id)
        if not fetch_result["ok"]:
            raise HTTPException(
                status_code=400,
                detail={"ok": False, "error": fetch_result["error"], "message": fetch_result["message"]},
            )

        synced_at = datetime.now(timezone.utc).isoformat()
        issues = fetch_result["issues"]
        count = await loop.run_in_executor(None, _store_bugs, project_key, issues, synced_at, user_id)

        project_name = await loop.run_in_executor(None, _fetch_project_name, project_key, user_id)
        await loop.run_in_executor(None, _upsert_project, project_key, project_name, user_id)

        return {
            "ok": True,
            "synced": count,
            "project_key": project_key,
            "synced_at": synced_at,
        }

    async def list_projects(self, user_id: int) -> dict:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, _list_synced_projects, user_id)

    async def search_projects(self, query: str, user_id: int) -> dict:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, _search_jira_projects, query, user_id)
