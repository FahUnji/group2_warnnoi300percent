"""
jira_config model — single-row table storing Jira connection credentials.
API token is stored encrypted (Fernet). Use upsert_config to save,
load_config to retrieve (returns decrypted token via the service layer).
"""
from backend.database import get_db


def upsert_config(base_url: str, email: str, api_token_encrypted: str) -> None:
    """Replace the single jira_config row (delete-then-insert for SQLite)."""
    conn = get_db()
    try:
        conn.execute("DELETE FROM jira_config")
        conn.execute(
            "INSERT INTO jira_config (base_url, email, api_token_encrypted)"
            " VALUES (?, ?, ?)",
            (base_url, email, api_token_encrypted),
        )
        conn.commit()
    finally:
        conn.close()


def load_config() -> dict | None:
    """Return the saved config row as a dict, or None if not yet configured.
    NOTE: api_token_encrypted is returned as-is — decrypt in the service layer.
    """
    conn = get_db()
    try:
        cur = conn.execute(
            "SELECT * FROM jira_config ORDER BY id DESC LIMIT 1"
        )
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()
