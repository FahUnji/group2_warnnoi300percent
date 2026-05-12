"""
FastAPI application entry point.

Start with:
    uvicorn backend.main:app --reload --port 8000
"""
import os

from cryptography.fernet import Fernet
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

# CR-01: Fail fast on missing/invalid FERNET_KEY — do not wait until first request
_fernet_key = os.environ.get("FERNET_KEY")
if not _fernet_key:
    raise RuntimeError("FERNET_KEY environment variable is not set. Cannot start.")
try:
    Fernet(_fernet_key.encode())
except Exception as exc:
    raise RuntimeError(f"FERNET_KEY is invalid: {exc}") from exc

from backend.database import init_db  # noqa: E402
from backend.routers import jira, auth, sync  # noqa: E402 — import after load_dotenv

init_db()

app = FastAPI(
    title="Jira Bug Summary API",
    description="Backend for the Jira Bug Summary Dashboard",
    version="0.1.0",
)

# CORS — only allow the React dev server (D-07, ASVS L1 CORS policy)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Accept"],
)


# CR-05: Reject oversized request bodies — API tokens are never large
@app.middleware("http")
async def limit_body_size(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > 65_536:
        return JSONResponse(status_code=413, content={"ok": False, "error": "payload_too_large"})
    return await call_next(request)


app.include_router(jira.router)
app.include_router(auth.router)
app.include_router(sync.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
