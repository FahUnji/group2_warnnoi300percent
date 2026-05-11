import os
import sqlite3

DB_PATH = os.environ.get(
    "DB_PATH", os.path.join(os.path.dirname(__file__), "jira.db")
)


def get_db() -> sqlite3.Connection:
    """Return a new SQLite connection. Caller must close after use."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Create tables if they don't exist. Called once on app startup."""
    conn = get_db()
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS jira_config (
                id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                base_url            TEXT    NOT NULL,
                email               TEXT    NOT NULL,
                api_token_encrypted TEXT    NOT NULL,
                updated_at          TEXT    DEFAULT (datetime('now'))
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS oauth_tokens (
                id                INTEGER PRIMARY KEY AUTOINCREMENT,
                access_token_enc  TEXT NOT NULL,
                refresh_token_enc TEXT,
                cloud_id          TEXT NOT NULL,
                site_url          TEXT NOT NULL,
                site_name         TEXT,
                expires_at        TEXT,
                updated_at        TEXT DEFAULT (datetime('now'))
            )
        """)
        conn.commit()
    finally:
        conn.close()
