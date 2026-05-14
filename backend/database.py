import os
import sqlite3

DB_PATH = os.environ.get(
    "DB_PATH", os.path.join(os.path.dirname(__file__), "jira.db")
)


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = get_db()
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id                    INTEGER PRIMARY KEY AUTOINCREMENT,
                atlassian_account_id  TEXT    NOT NULL UNIQUE,
                email                 TEXT,
                display_name          TEXT,
                avatar_url            TEXT,
                created_at            TEXT    DEFAULT (datetime('now'))
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id  TEXT    NOT NULL UNIQUE,
                user_id     INTEGER NOT NULL REFERENCES users(id),
                expires_at  TEXT    NOT NULL,
                created_at  TEXT    DEFAULT (datetime('now'))
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS oauth_tokens (
                id                INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id           INTEGER NOT NULL REFERENCES users(id),
                access_token_enc  TEXT    NOT NULL,
                refresh_token_enc TEXT,
                cloud_id          TEXT    NOT NULL,
                site_url          TEXT    NOT NULL,
                site_name         TEXT,
                expires_at        TEXT,
                updated_at        TEXT    DEFAULT (datetime('now')),
                UNIQUE (user_id)
            )
        """)
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
            CREATE TABLE IF NOT EXISTS jira_projects (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id      INTEGER NOT NULL REFERENCES users(id),
                project_key  TEXT    NOT NULL,
                project_url  TEXT    NOT NULL DEFAULT '',
                project_name TEXT,
                added_at     TEXT    DEFAULT (datetime('now')),
                UNIQUE (user_id, project_key)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS bugs (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id     INTEGER NOT NULL REFERENCES users(id),
                issue_id    INTEGER NOT NULL,
                issue_key   TEXT    NOT NULL,
                project_key TEXT    NOT NULL,
                summary     TEXT,
                status      TEXT,
                priority    TEXT,
                sprint_name TEXT,
                sprint_id   INTEGER,
                assignee    TEXT,
                synced_at   TEXT    NOT NULL,
                UNIQUE (user_id, issue_id, project_key)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS sprints (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id     INTEGER NOT NULL REFERENCES users(id),
                sprint_id   INTEGER NOT NULL,
                sprint_name TEXT    NOT NULL,
                state       TEXT    NOT NULL,
                start_date  TEXT,
                end_date    TEXT,
                project_key TEXT    NOT NULL,
                synced_at   TEXT    DEFAULT (datetime('now')),
                UNIQUE (user_id, sprint_id, project_key)
            )
        """)
        conn.commit()
    finally:
        conn.close()


def count_projects(user_id: int) -> int:
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT COUNT(*) FROM jira_projects WHERE user_id = ?", (user_id,)
        ).fetchone()
        return row[0] if row else 0
    finally:
        conn.close()
