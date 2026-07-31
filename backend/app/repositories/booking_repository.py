"""Raw Mongo access for bookings. No business logic."""
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId

from app.core.constants import Collections
from app.db.mongo import db

_coll = db[Collections.BOOKINGS]


async def list_for_provider(
    provider_id: ObjectId,
    statuses: Optional[list[str]] = None,
    sort_asc: bool = True,
    scheduled_from: Optional[str] = None,
) -> list[dict]:
    q: dict = {"provider_id": provider_id}
    if statuses:
        q["status"] = {"$in": statuses}
    if scheduled_from:
        q["scheduled_at"] = {"$gte": scheduled_from}
    cursor = _coll.find(q).sort("scheduled_at", 1 if sort_asc else -1)
    return await cursor.to_list(length=500)


async def count(provider_id: ObjectId, statuses: list[str], scheduled_from: str) -> int:
    return await _coll.count_documents({
        "provider_id": provider_id,
        "status": {"$in": statuses},
        "scheduled_at": {"$gte": scheduled_from},
    })


async def get_for_provider(booking_id: ObjectId, provider_id: ObjectId) -> Optional[dict]:
    return await _coll.find_one({"_id": booking_id, "provider_id": provider_id})


async def update_status(
    booking_id: ObjectId, provider_id: ObjectId, status: str, entry: dict
) -> Optional[dict]:
    now = datetime.now(timezone.utc).isoformat()
    return await _coll.find_one_and_update(
        {"_id": booking_id, "provider_id": provider_id},
        {
            "$set": {"status": status, "updated_at": now},
            "$push": {"status_history": entry},
        },
        return_document=True,
    )


async def insert_many(docs: list[dict]) -> list[ObjectId]:
    if not docs:
        return []
    result = await _coll.insert_many(docs)
    return result.inserted_ids


async def delete_seeded(provider_id: ObjectId) -> int:
    result = await _coll.delete_many({"provider_id": provider_id, "is_seed": True})
    return result.deleted_count


async def ensure_indexes() -> None:
    await _coll.create_index("provider_id")
    await _coll.create_index([("provider_id", 1), ("status", 1)])
    await _coll.create_index([("provider_id", 1), ("scheduled_at", 1)])
