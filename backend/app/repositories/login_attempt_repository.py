"""Raw Mongo access for login_attempts. No business logic."""
from datetime import datetime, timezone
from typing import Optional

from app.core.constants import Collections
from app.db.mongo import db

_coll = db[Collections.LOGIN_ATTEMPTS]


async def get(identifier: str) -> Optional[dict]:
    return await _coll.find_one({"identifier": identifier})


async def increment_failure(identifier: str) -> None:
    await _coll.update_one(
        {"identifier": identifier},
        {"$inc": {"count": 1}, "$set": {"last_attempt": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )


async def clear(identifier: str) -> None:
    await _coll.delete_one({"identifier": identifier})


async def ensure_indexes() -> None:
    await _coll.create_index("identifier")
