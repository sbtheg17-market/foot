"""Compatibility entrypoint. Supervisor / uvicorn imports `server:app`.

All logic lives in app/. Do not add code here.
"""
from app.main import app  # noqa: F401
