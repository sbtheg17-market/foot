"""Developer / demo utilities. Auth-required but scoped to the current provider.

Kept intentionally light: this is for demo data, not real ops.
"""
from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_user
from app.services import seed_service


router = APIRouter(prefix="/dev", tags=["dev"])


@router.post("/seed-bookings")
async def seed_bookings(user: dict = Depends(get_current_user)):
    count = await seed_service.seed_bookings_for_provider(user)
    return {"seeded": count}


@router.delete("/seed-bookings")
async def clear_seed(user: dict = Depends(get_current_user)):
    count = await seed_service.clear_seeded_bookings(user["_id"])
    return {"cleared": count}
