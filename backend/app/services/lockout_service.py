"""Brute-force lockout policy: 5 fails per identifier within LOCKOUT_MINUTES."""
from datetime import datetime, timezone, timedelta

from fastapi import HTTPException

from app.core.config import settings
from app.repositories import login_attempt_repository


async def check_lockout(identifier: str) -> None:
    rec = await login_attempt_repository.get(identifier)
    if rec and rec.get("count", 0) >= settings.LOCKOUT_ATTEMPTS:
        locked_at = datetime.fromisoformat(rec["last_attempt"])
        if datetime.now(timezone.utc) - locked_at < timedelta(minutes=settings.LOCKOUT_MINUTES):
            raise HTTPException(status_code=429, detail=f"Too many failed attempts. Try again in {settings.LOCKOUT_MINUTES} minutes.")
        await login_attempt_repository.clear(identifier)


async def record_failure(identifier: str) -> None:
    await login_attempt_repository.increment_failure(identifier)


async def clear(identifier: str) -> None:
    await login_attempt_repository.clear(identifier)
