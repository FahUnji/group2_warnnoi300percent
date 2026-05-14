from backend.database import get_db


def upsert_user(
    atlassian_account_id: str,
    email: str,
    display_name: str,
    avatar_url: str,
) -> int:
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO users (atlassian_account_id, email, display_name, avatar_url)"
            " VALUES (?, ?, ?, ?)"
            " ON CONFLICT(atlassian_account_id) DO UPDATE SET"
            "   email        = excluded.email,"
            "   display_name = excluded.display_name,"
            "   avatar_url   = excluded.avatar_url",
            (atlassian_account_id, email, display_name, avatar_url),
        )
        conn.commit()
        row = conn.execute(
            "SELECT id FROM users WHERE atlassian_account_id = ?",
            (atlassian_account_id,),
        ).fetchone()
        return row["id"]
    finally:
        conn.close()


def load_user(user_id: int) -> dict | None:
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT * FROM users WHERE id = ?", (user_id,)
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()
