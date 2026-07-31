"""Mongo client singleton. All repositories import `db` from here."""
from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import settings

client: AsyncIOMotorClient = AsyncIOMotorClient(settings.MONGO_URL)
db = client[settings.DB_NAME]


def close_client() -> None:
    client.close()
