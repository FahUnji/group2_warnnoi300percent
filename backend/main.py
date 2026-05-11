"""
FastAPI application entry point.

Start with:
    uvicorn backend.main:app --reload --port 8000
"""
import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

from backend.routers import jira  # noqa: E402 — import after load_dotenv

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

app.include_router(jira.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
