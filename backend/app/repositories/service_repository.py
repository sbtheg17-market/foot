"""Raw Mongo access for services. No business logic.

Soft-delete via `deleted_at`. All list ops filter it out unless explicit.
"""
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId

from app.core.constants import Collections
from app.db.mongo import db

_coll = db[Collections.SERVICES]


async def list_for_provider(provider_id: ObjectId, include_deleted: bool = False) -> list[dict]:
    query: dict = {"provider_id": provider_id}
    if not include_deleted:
        query["deleted_at"] = None
    cursor = _coll.find(query).sort([("display_order", 1), ("created_at", -1)])
    return await cursor.to_list(length=500)


async def get_for_provider(service_id: ObjectId, provider_id: ObjectId) -> Optional[dict]:
    return await _coll.find_one({"_id": service_id, "provider_id": provider_id, "deleted_at": None})


async def count_active_for_provider(provider_id: ObjectId) -> int:
    return await _coll.count_documents({"provider_id": provider_id, "deleted_at": None, "active": True})


async def insert(doc: dict) -> ObjectId:
    result = await _coll.insert_one(doc)
    return result.inserted_id


async def update_fields(service_id: ObjectId, provider_id: ObjectId, fields: dict) -> Optional[dict]:
    fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await _coll.find_one_and_update(
        {"_id": service_id, "provider_id": provider_id, "deleted_at": None},
        {"$set": fields},
        return_document=True,
    )
    return result


async def soft_delete(service_id: ObjectId, provider_id: ObjectId) -> bool:
    now = datetime.now(timezone.utc).isoformat()
    result = await _coll.update_one(
        {"_id": service_id, "provider_id": provider_id, "deleted_at": None},
        {"$set": {"deleted_at": now, "updated_at": now}},
    )
    return result.modified_count > 0


async def ensure_indexes() -> None:
    await _coll.create_index("provider_id")
    await _coll.create_index([("provider_id", 1), ("deleted_at", 1)])
