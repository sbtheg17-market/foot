"""Raw Mongo access for provider availability. One doc per provider."""
from typing import Optional

from bson import ObjectId

from app.core.constants import Collections
from app.db.mongo import db

_coll = db[Collections.AVAILABILITY]


async def get_for_provider(provider_id: ObjectId) -> Optional[dict]:
    return await _coll.find_one({"provider_id": provider_id})


async def upsert(provider_id: ObjectId, fields: dict) -> dict:
    doc = await _coll.find_one_and_update(
        {"provider_id": provider_id},
        {"$set": fields, "$setOnInsert": {"provider_id": provider_id}},
        upsert=True,
        return_document=True,
    )
    return doc


async def ensure_indexes() -> None:
    await _coll.create_index("provider_id", unique=True)
