import secrets
from datetime import datetime, timedelta, timezone

from backend.database import get_db

SESSION_TTL_DAYS = 7


def create_session(user_id: int) -> str:
    session_id = secrets.token_urlsafe(32)
    expires_at = (
        datetime.now(timezone.utc) + timedelta(days=SESSION_TTL_DAYS)
    ).isoformat()
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO sessions (session_id, user_id, expires_at) VALUES (?, ?, ?)",
            (session_id, user_id, expires_at),
        )
        conn.commit()
    finally:
        conn.close()
    return session_id


def get_session_user(session_id: str) -> int | None:
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT user_id FROM sessions"
            " WHERE session_id = ? AND expires_at > datetime('now')",
            (session_id,),
        ).fetchone()
        return row["user_id"] if row else None
    finally:
        conn.close()


def delete_session(session_id: str) -> None:
    conn = get_db()
    try:
        conn.execute("DELETE FROM sessions WHERE session_id = ?", (session_id,))
        conn.commit()
    finally:
        conn.close()
