from backend.database import get_db


def upsert_oauth_token(
    user_id: int,
    access_token_enc: str,
    refresh_token_enc: str,
    cloud_id: str,
    site_url: str,
    site_name: str,
    expires_at: str,
) -> None:
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO oauth_tokens"
            " (user_id, access_token_enc, refresh_token_enc, cloud_id, site_url, site_name, expires_at)"
            " VALUES (?, ?, ?, ?, ?, ?, ?)"
            " ON CONFLICT(user_id) DO UPDATE SET"
            "   access_token_enc  = excluded.access_token_enc,"
            "   refresh_token_enc = excluded.refresh_token_enc,"
            "   cloud_id          = excluded.cloud_id,"
            "   site_url          = excluded.site_url,"
            "   site_name         = excluded.site_name,"
            "   expires_at        = excluded.expires_at,"
            "   updated_at        = datetime('now')",
            (user_id, access_token_enc, refresh_token_enc, cloud_id, site_url, site_name, expires_at),
        )
        conn.commit()
    finally:
        conn.close()


def load_oauth_token(user_id: int) -> dict | None:
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT * FROM oauth_tokens WHERE user_id = ?", (user_id,)
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def delete_oauth_token(user_id: int) -> None:
    conn = get_db()
    try:
        conn.execute("DELETE FROM oauth_tokens WHERE user_id = ?", (user_id,))
        conn.commit()
    finally:
        conn.close()
