"""Raw Mongo access for invoices. No business logic."""
from typing import Optional

from bson import ObjectId

from app.core.constants import Collections
from app.db.mongo import db

_coll = db[Collections.INVOICES]


async def list_for_provider(provider_id: ObjectId) -> list[dict]:
    return await _coll.find({"provider_id": provider_id}).sort("issued_at", -1).to_list(length=500)


async def get_for_provider(invoice_id: ObjectId, provider_id: ObjectId) -> Optional[dict]:
    return await _coll.find_one({"_id": invoice_id, "provider_id": provider_id})


async def get_by_booking(booking_id: ObjectId) -> Optional[dict]:
    return await _coll.find_one({"booking_id": booking_id})


async def count_for_provider(provider_id: ObjectId) -> int:
    return await _coll.count_documents({"provider_id": provider_id})


async def insert(doc: dict) -> ObjectId:
    result = await _coll.insert_one(doc)
    return result.inserted_id


async def delete_seeded(provider_id: ObjectId) -> int:
    result = await _coll.delete_many({"provider_id": provider_id, "is_seed": True})
    return result.deleted_count


async def ensure_indexes() -> None:
    await _coll.create_index("provider_id")
    await _coll.create_index("booking_id", unique=True)
    await _coll.create_index([("provider_id", 1), ("issued_at", -1)])
