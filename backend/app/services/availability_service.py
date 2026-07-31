"""Availability + travel zone business logic."""
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException

from app.models.availability import (
    AvailabilityUpdate,
    default_travel,
    default_weekly,
)
from app.repositories import availability_repository


def _normalize_doc(doc: dict | None) -> dict:
    if not doc:
        return {
            "weekly": default_weekly().model_dump(),
            "travel": default_travel().model_dump(),
            "updated_at": None,
        }
    return {
        "weekly": doc.get("weekly") or default_weekly().model_dump(),
        "travel": doc.get("travel") or default_travel().model_dump(),
        "updated_at": doc.get("updated_at"),
    }


async def get_availability(provider_id: ObjectId) -> dict:
    doc = await availability_repository.get_for_provider(provider_id)
    return _normalize_doc(doc)


async def update_availability(provider_id: ObjectId, body: AvailabilityUpdate) -> dict:
    updates: dict = {}
    if body.weekly is not None:
        weekly = body.weekly.model_dump()
        # cheap semantic check: start < end for every slot
        for day, slots in weekly.items():
            for i, slot in enumerate(slots):
                if slot["start"] >= slot["end"]:
                    raise HTTPException(status_code=422, detail=f"{day} slot {i + 1}: end must be after start")
        updates["weekly"] = weekly
    if body.travel is not None:
        travel = body.travel.model_dump()
        travel["pincodes"] = [p.strip() for p in travel.get("pincodes", []) if p.strip()]
        updates["travel"] = travel
    if not updates:
        return await get_availability(provider_id)
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    doc = await availability_repository.upsert(provider_id, updates)
    return _normalize_doc(doc)


def has_weekly_slots(availability: dict) -> bool:
    weekly = availability.get("weekly") or {}
    return any(len(weekly.get(day, [])) > 0 for day in ("mon", "tue", "wed", "thu", "fri", "sat", "sun"))


def has_travel_zone(availability: dict) -> bool:
    travel = availability.get("travel") or {}
    mode = travel.get("mode", "radius")
    if mode == "radius":
        return (travel.get("radius_km") or 0) > 0
    return len([p for p in (travel.get("pincodes") or []) if p]) > 0
