"""Raw Mongo access for reviews."""
from bson import ObjectId

from app.core.constants import Collections
from app.db.mongo import db

_coll = db[Collections.REVIEWS]


async def list_for_provider(provider_id: ObjectId) -> list[dict]:
    return await _coll.find({"provider_id": provider_id}).sort("created_at", -1).to_list(length=500)


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
    await _coll.create_index([("provider_id", 1), ("created_at", -1)])
