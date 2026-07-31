"""Service catalog business logic (Checkpoint 2).

Ownership rule: every op scopes by provider_id == current_user._id.
Admin/global reads live behind separate permissions and will be added
when the admin router lands (§3 §18 of the marketplace plan).
"""
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException

from app.models.service import ServiceCreate, ServiceUpdate
from app.repositories import service_repository


def _to_object_id(id_str: str) -> ObjectId:
    try:
        return ObjectId(id_str)
    except Exception:
        raise HTTPException(status_code=404, detail="Service not found")


async def list_services(provider_id: ObjectId) -> list[dict]:
    return await service_repository.list_for_provider(provider_id)


async def get_service(service_id: str, provider_id: ObjectId) -> dict:
    doc = await service_repository.get_for_provider(_to_object_id(service_id), provider_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Service not found")
    return doc


async def create_service(body: ServiceCreate, provider_id: ObjectId) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "provider_id": provider_id,
        "name": body.name.strip(),
        "description": (body.description or "").strip(),
        "category": (body.category or None),
        "duration_minutes": body.duration_minutes,
        "price_cents": body.price_cents,
        "currency": (body.currency or "USD").upper(),
        "active": body.active,
        "display_order": body.display_order,
        "deleted_at": None,
        "created_at": now,
        "updated_at": now,
    }
    inserted_id = await service_repository.insert(doc)
    doc["_id"] = inserted_id
    return doc


async def update_service(service_id: str, body: ServiceUpdate, provider_id: ObjectId) -> dict:
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None or k == "category"}
    if "name" in updates and updates["name"]:
        updates["name"] = updates["name"].strip()
    if "description" in updates and updates["description"] is not None:
        updates["description"] = updates["description"].strip()
    if "currency" in updates and updates["currency"]:
        updates["currency"] = updates["currency"].upper()

    if not updates:
        return await get_service(service_id, provider_id)

    doc = await service_repository.update_fields(_to_object_id(service_id), provider_id, updates)
    if not doc:
        raise HTTPException(status_code=404, detail="Service not found")
    return doc


async def toggle_service(service_id: str, provider_id: ObjectId) -> dict:
    current = await get_service(service_id, provider_id)
    return await update_service(service_id, ServiceUpdate(active=not current.get("active", True)), provider_id)


async def delete_service(service_id: str, provider_id: ObjectId) -> None:
    ok = await service_repository.soft_delete(_to_object_id(service_id), provider_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Service not found")


async def count_active(provider_id: ObjectId) -> int:
    return await service_repository.count_active_for_provider(provider_id)
