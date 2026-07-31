"""Raw Mongo access for users. No business logic."""
from typing import Optional

from bson import ObjectId

from app.core.constants import Collections
from app.db.mongo import db

_coll = db[Collections.USERS]


async def get_by_email(email: str) -> Optional[dict]:
    return await _coll.find_one({"email": email})


async def get_by_id(user_id: ObjectId) -> Optional[dict]:
    return await _coll.find_one({"_id": user_id})


async def insert(doc: dict) -> ObjectId:
    result = await _coll.insert_one(doc)
    return result.inserted_id


async def update_fields(user_id: ObjectId, fields: dict) -> None:
    await _coll.update_one({"_id": user_id}, {"$set": fields})


async def ensure_indexes() -> None:
    await _coll.create_index("email", unique=True)
