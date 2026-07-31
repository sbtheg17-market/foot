"""Booking business logic + state machine (Checkpoint 4).

Valid transitions:
    pending    -> accepted | cancelled
    accepted   -> confirmed | cancelled
    confirmed  -> completed | cancelled | no_show
    completed / cancelled / no_show -> (terminal)

Ownership is enforced by scoping every query with provider_id = current user.
"""
from datetime import datetime, timedelta, timezone

from bson import ObjectId
from fastapi import HTTPException

from app.core.constants import BookingStatus
from app.repositories import booking_repository


_TRANSITIONS: dict[str, set[str]] = {
    BookingStatus.PENDING.value: {BookingStatus.ACCEPTED.value, BookingStatus.CANCELLED.value},
    BookingStatus.ACCEPTED.value: {BookingStatus.CONFIRMED.value, BookingStatus.CANCELLED.value},
    BookingStatus.CONFIRMED.value: {
        BookingStatus.COMPLETED.value,
        BookingStatus.CANCELLED.value,
        BookingStatus.NO_SHOW.value,
    },
    BookingStatus.COMPLETED.value: set(),
    BookingStatus.CANCELLED.value: set(),
    BookingStatus.NO_SHOW.value: set(),
}

_UPCOMING = [BookingStatus.PENDING.value, BookingStatus.ACCEPTED.value, BookingStatus.CONFIRMED.value]
_HISTORY = [BookingStatus.COMPLETED.value, BookingStatus.CANCELLED.value, BookingStatus.NO_SHOW.value]


def _to_object_id(id_str: str) -> ObjectId:
    try:
        return ObjectId(id_str)
    except Exception:
        raise HTTPException(status_code=404, detail="Booking not found")


async def list_bookings(provider_id: ObjectId, tab: str = "upcoming") -> list[dict]:
    if tab == "upcoming":
        return await booking_repository.list_for_provider(provider_id, statuses=_UPCOMING, sort_asc=True)
    if tab == "history":
        return await booking_repository.list_for_provider(provider_id, statuses=_HISTORY, sort_asc=False)
    return await booking_repository.list_for_provider(provider_id, sort_asc=False)


async def get_booking(booking_id: str, provider_id: ObjectId) -> dict:
    doc = await booking_repository.get_for_provider(_to_object_id(booking_id), provider_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Booking not found")
    return doc


async def update_status(booking_id: str, provider_id: ObjectId, target: str, reason: str | None) -> dict:
    doc = await get_booking(booking_id, provider_id)
    current = doc.get("status", BookingStatus.PENDING.value)
    if target == current:
        return doc
    allowed = _TRANSITIONS.get(current, set())
    if target not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot move booking from '{current}' to '{target}'",
        )
    now = datetime.now(timezone.utc).isoformat()
    entry = {"status": target, "at": now}
    if reason:
        entry["reason"] = reason
    updated = await booking_repository.update_status(_to_object_id(booking_id), provider_id, target, entry)
    if not updated:
        raise HTTPException(status_code=404, detail="Booking not found")
    return updated


async def count_upcoming(provider_id: ObjectId) -> int:
    now = datetime.now(timezone.utc).isoformat()
    return await booking_repository.count(provider_id, _UPCOMING, now)


async def get_next_confirmed(provider_id: ObjectId) -> dict | None:
    """Earliest confirmed booking scheduled from ~1h ago onwards.
    The 1h lookback covers 'currently in progress' visits so the Home banner
    can still surface them until they're marked completed."""
    from_iso = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    return await booking_repository.find_next_confirmed(provider_id, from_iso)
