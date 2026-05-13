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
        conn.execute("""
            CREATE TABLE IF NOT EXISTS jira_projects (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                project_key TEXT    NOT NULL UNIQUE,
                project_url TEXT    NOT NULL,
                added_at    TEXT    DEFAULT (datetime('now'))
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS bugs (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                issue_id    INTEGER NOT NULL,
                issue_key   TEXT    NOT NULL,
                project_key TEXT    NOT NULL,
                summary     TEXT,
                status      TEXT,
                priority    TEXT,
                sprint_name TEXT,
                assignee    TEXT,
                synced_at   TEXT    NOT NULL,
                UNIQUE (issue_id, project_key)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS sprints (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                sprint_id   INTEGER NOT NULL,
                sprint_name TEXT    NOT NULL,
                state       TEXT    NOT NULL,
                start_date  TEXT,
                end_date    TEXT,
                project_key TEXT    NOT NULL,
                synced_at   TEXT    DEFAULT (datetime('now')),
                UNIQUE (sprint_id, project_key)
            )
        """)
        conn.commit()
        # Migration: add project_name column if not present
        try:
            conn.execute("ALTER TABLE jira_projects ADD COLUMN project_name TEXT")
            conn.commit()
        except sqlite3.OperationalError:
            pass  # already exists
        # Migration: add synced_at column to sprints if not present
        try:
            conn.execute("ALTER TABLE sprints ADD COLUMN synced_at TEXT")
            conn.commit()
        except sqlite3.OperationalError:
            pass  # already exists
    finally:
        conn.close()


def count_projects() -> int:
    """Return number of connected Jira projects."""
    conn = get_db()
    try:
        row = conn.execute("SELECT COUNT(*) FROM jira_projects").fetchone()
        return row[0] if row else 0
    finally:
        conn.close()
