"""
JiraSprintService — fetches Jira release (fix version) data and aggregates bug counts.

Security: access_token never logged or returned. SQL uses parameterized queries only.
"""
import asyncio
from datetime import date, datetime, timezone

import requests
from fastapi import HTTPException

from backend.database import get_db
from backend.services.jira_sync_service import _get_auth_headers


def _fetch_versions(project_key: str, access_token: str, cloud_id: str) -> dict:
    """
    GET /rest/api/3/project/{project_key}/versions
    Returns {"ok": True, "versions": [...]} or {"ok": False, "error": ..., "message": ...}
    Each version: {id, name, released, archived, releaseDate, startDate}
    """
    url = f"https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3/project/{project_key}/versions"
    headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/json"}
    try:
        resp = requests.get(url, headers=headers, timeout=(5, 15), verify=True)
        resp.raise_for_status()
        versions = resp.json()
        if not isinstance(versions, list):
            versions = versions.get("values", [])
        return {"ok": True, "versions": versions}
    except requests.exceptions.ConnectionError:
        return {
            "ok": False,
            "error": "unreachable_host",
            "message": "Cannot reach Jira API. Check your network connection.",
        }
    except requests.exceptions.Timeout:
        return {
            "ok": False,
            "error": "timeout",
            "message": "Jira API did not respond in time. Try again.",
        }
    except requests.exceptions.HTTPError as exc:
        status = exc.response.status_code if exc.response is not None else 0
        if status == 401:
            return {
                "ok": False,
                "error": "invalid_credentials",
                "message": "OAuth token is expired or invalid. Please reconnect.",
            }
        if status == 403:
            return {
                "ok": False,
                "error": "forbidden",
                "message": "Access denied. Check your Jira OAuth scopes.",
            }
        return {"ok": False, "error": "api_error", "message": f"Jira API returned HTTP {status}."}
    except requests.exceptions.RequestException:
        return {"ok": False, "error": "unreachable_host", "message": "Cannot reach Jira API."}


def _version_state(v: dict) -> str:
    if v.get("archived"):
        return "archived"
    if v.get("released"):
        return "released"
    start = v.get("startDate")
    if start:
        try:
            if date.fromisoformat(start) <= date.today():
                return "active"
        except ValueError:
            pass
    return "upcoming"


def _upsert_sprints(project_key: str, versions: list, synced_at: str) -> None:
    """
    Upsert versions into the sprints table (reused for releases).
    sprint_id = version id, sprint_name = version name, state = released/unreleased/archived.
    Uses parameterized queries only.
    """
    conn = get_db()
    try:
        conn.execute("DELETE FROM sprints WHERE project_key = ?", (project_key,))
        for v in versions:
            conn.execute(
                "INSERT INTO sprints (sprint_id, sprint_name, state, start_date, end_date, project_key, synced_at)"
                " VALUES (?, ?, ?, ?, ?, ?, ?)"
                " ON CONFLICT(sprint_id, project_key) DO UPDATE SET"
                "   sprint_name = excluded.sprint_name,"
                "   state       = excluded.state,"
                "   start_date  = excluded.start_date,"
                "   end_date    = excluded.end_date,"
                "   synced_at   = excluded.synced_at",
                (
                    int(v["id"]),
                    v.get("name", ""),
                    _version_state(v),
                    v.get("startDate"),
                    v.get("releaseDate"),
                    project_key,
                    synced_at,
                ),
            )
        conn.commit()
    finally:
        conn.close()


def _get_sprint_stats(project_key: str) -> list:
    """
    Aggregate bug counts per release (sprint_name) from bugs table.
    Joins with sprints table on (sprint_name, project_key).
    """
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT s.sprint_id, s.sprint_name, s.state, s.start_date, s.end_date,"
            "  COUNT(b.id) AS found,"
            "  SUM(CASE WHEN LOWER(b.status) IN ('done','resolved','closed') THEN 1 ELSE 0 END) AS resolved,"
            "  SUM(CASE WHEN LOWER(b.priority) = 'critical' THEN 1 ELSE 0 END) AS critical,"
            "  SUM(CASE WHEN LOWER(b.priority) IN ('high','highest') THEN 1 ELSE 0 END) AS high,"
            "  SUM(CASE WHEN LOWER(b.priority) = 'medium' THEN 1 ELSE 0 END) AS medium,"
            "  SUM(CASE WHEN LOWER(b.priority) IN ('low','lowest') THEN 1 ELSE 0 END) AS low"
            " FROM sprints s"
            " LEFT JOIN bugs b ON b.sprint_name = s.sprint_name AND b.project_key = s.project_key"
            " WHERE s.project_key = ?"
            " GROUP BY s.sprint_id"
            " ORDER BY s.sprint_id DESC",
            (project_key,),
        ).fetchall()
    finally:
        conn.close()

    return [
        {
            "sprint_id":   r["sprint_id"],
            "sprint_name": r["sprint_name"],
            "state":       r["state"],
            "start_date":  r["start_date"],
            "end_date":    r["end_date"],
            "found":       r["found"] or 0,
            "resolved":    r["resolved"] or 0,
            "critical":    r["critical"] or 0,
            "high":        r["high"] or 0,
            "medium":      r["medium"] or 0,
            "low":         r["low"] or 0,
        }
        for r in rows
    ]


def _fetch_sprints_and_store(project_key: str) -> dict:
    """
    Orchestrates: get auth -> fetch Jira versions -> upsert -> return stats.
    Falls back to cached DB data if Jira API is unreachable or fails.
    Returns {"ok": True, "sprints": [...], "synced_at": "...", "stale": bool} or {"ok": False, ...}
    """
    try:
        access_token, cloud_id, _ = _get_auth_headers()
    except HTTPException as exc:
        cached = _get_sprint_stats(project_key)
        if cached:
            return {"ok": True, "sprints": cached, "synced_at": None, "stale": True}
        detail = exc.detail if isinstance(exc.detail, dict) else {}
        return {
            "ok": False,
            "error": detail.get("error", "not_configured"),
            "message": detail.get("message", "Jira is not configured."),
        }
    except Exception:
        cached = _get_sprint_stats(project_key)
        if cached:
            return {"ok": True, "sprints": cached, "synced_at": None, "stale": True}
        return {"ok": False, "error": "auth_error", "message": "Authentication failed."}

    version_result = _fetch_versions(project_key, access_token, cloud_id)
    if not version_result["ok"]:
        cached = _get_sprint_stats(project_key)
        if cached:
            return {"ok": True, "sprints": cached, "synced_at": None, "stale": True}
        return version_result

    versions = version_result["versions"]
    if not versions:
        return {"ok": True, "sprints": [], "synced_at": None, "stale": False}

    synced_at = datetime.now(timezone.utc).isoformat()
    _upsert_sprints(project_key, versions, synced_at)

    stats = _get_sprint_stats(project_key)
    return {"ok": True, "sprints": stats, "synced_at": synced_at, "stale": False}


class JiraSprintService:
    async def get_sprints(self, project_key: str) -> dict:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, _fetch_sprints_and_store, project_key)
