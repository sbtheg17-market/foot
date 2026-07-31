"""Booking endpoints (Checkpoint 4)."""
from fastapi import APIRouter, Depends, Query

from app.core.permissions import Permission, require_permission
from app.models.booking import BookingOut, BookingStatusUpdate
from app.services import booking_service


router = APIRouter(prefix="/bookings", tags=["bookings"])


@router.get("", response_model=list[BookingOut], response_model_by_alias=False)
async def list_bookings(
    tab: str = Query("upcoming", pattern="^(upcoming|history|all)$"),
    user: dict = Depends(require_permission(Permission.BOOKING_READ_SELF)),
):
    docs = await booking_service.list_bookings(user["_id"], tab=tab)
    return [BookingOut(**d) for d in docs]


@router.get("/{booking_id}", response_model=BookingOut, response_model_by_alias=False)
async def get_booking(
    booking_id: str,
    user: dict = Depends(require_permission(Permission.BOOKING_READ_SELF)),
):
    doc = await booking_service.get_booking(booking_id, user["_id"])
    return BookingOut(**doc)


@router.patch("/{booking_id}/status", response_model=BookingOut, response_model_by_alias=False)
async def update_status(
    booking_id: str,
    body: BookingStatusUpdate,
    user: dict = Depends(require_permission(Permission.BOOKING_UPDATE_SELF)),
):
    doc = await booking_service.update_status(booking_id, user["_id"], body.status, body.reason)
    return BookingOut(**doc)
