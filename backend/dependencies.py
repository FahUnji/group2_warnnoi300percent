from fastapi import HTTPException, Request

from backend.models.session import get_session_user


def get_current_user(request: Request) -> int:
    session_id = request.cookies.get("session_id")
    if not session_id:
        raise HTTPException(
            status_code=401,
            detail={"ok": False, "error": "not_authenticated", "message": "Login required."},
        )
    user_id = get_session_user(session_id)
    if user_id is None:
        raise HTTPException(
            status_code=401,
            detail={"ok": False, "error": "session_expired", "message": "Session expired. Please log in again."},
        )
    return user_id
