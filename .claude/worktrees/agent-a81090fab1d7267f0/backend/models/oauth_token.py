from backend.database import get_db


def upsert_oauth_token(
    access_token_enc: str,
    refresh_token_enc: str,
    cloud_id: str,
    site_url: str,
    site_name: str,
    expires_at: str,
) -> None:
    conn = get_db()
    try:
        conn.execute("DELETE FROM oauth_tokens")
        conn.execute(
            "INSERT INTO oauth_tokens"
            " (access_token_enc, refresh_token_enc, cloud_id, site_url, site_name, expires_at)"
            " VALUES (?, ?, ?, ?, ?, ?)",
            (access_token_enc, refresh_token_enc, cloud_id, site_url, site_name, expires_at),
        )
        conn.commit()
    finally:
        conn.close()


def load_oauth_token() -> dict | None:
    conn = get_db()
    try:
        cur = conn.execute("SELECT * FROM oauth_tokens ORDER BY id DESC LIMIT 1")
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def delete_oauth_token() -> None:
    conn = get_db()
    try:
        conn.execute("DELETE FROM oauth_tokens")
        conn.commit()
    finally:
        conn.close()
