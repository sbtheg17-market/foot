"""Availability endpoints (Checkpoint 3). Weekly + travel zone."""
from fastapi import APIRouter, Depends

from app.core.permissions import Permission, require_permission
from app.models.availability import AvailabilityOut, AvailabilityUpdate
from app.services import availability_service

router = APIRouter(prefix="/availability", tags=["availability"])


@router.get("", response_model=AvailabilityOut)
async def get_availability(user: dict = Depends(require_permission(Permission.PROVIDER_READ_SELF))):
    return await availability_service.get_availability(user["_id"])


@router.put("", response_model=AvailabilityOut)
async def update_availability(body: AvailabilityUpdate, user: dict = Depends(require_permission(Permission.PROVIDER_UPDATE_SELF))):
    return await availability_service.update_availability(user["_id"], body)
