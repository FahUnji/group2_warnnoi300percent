"""
jira_config model — single-row table storing Jira connection credentials.
API token is stored encrypted (Fernet). Use upsert_config to save,
load_config to retrieve (returns decrypted token via the service layer).
"""
from backend.database import get_db


def upsert_config(base_url: str, email: str, api_token_encrypted: str) -> None:
    """Insert or replace the single jira_config row."""
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO jira_config (base_url, email, api_token_encrypted)
        VALUES (%s, %s, %s)
        ON DUPLICATE KEY UPDATE
            base_url            = VALUES(base_url),
            email               = VALUES(email),
            api_token_encrypted = VALUES(api_token_encrypted),
            updated_at          = CURRENT_TIMESTAMP
        """,
        (base_url, email, api_token_encrypted),
    )
    conn.commit()
    cur.close()
    conn.close()


def load_config() -> dict | None:
    """Return the saved config row as a dict, or None if not yet configured.
    NOTE: api_token_encrypted is returned as-is — decrypt in the service layer.
    """
    conn = get_db()
    cur = conn.cursor(dictionary=True)
    cur.execute("SELECT * FROM jira_config ORDER BY id DESC LIMIT 1")
    row = cur.fetchone()
    cur.close()
    conn.close()
    return row
