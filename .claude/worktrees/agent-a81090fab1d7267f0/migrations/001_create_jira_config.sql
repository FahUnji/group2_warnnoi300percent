-- Migration 001: Create jira_config table (SQLite)
-- Not required — init_db() in database.py runs this automatically on startup.
-- Kept for reference only.

CREATE TABLE IF NOT EXISTS jira_config (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    base_url            TEXT    NOT NULL,
    email               TEXT    NOT NULL,
    api_token_encrypted TEXT    NOT NULL,
    updated_at          TEXT    DEFAULT (datetime('now'))
);
