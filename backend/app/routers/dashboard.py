"""Provider dashboard summary — light aggregates for the home screen."""
from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_user
from app.services import catalog_service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/provider-summary")
async def provider_summary(user: dict = Depends(get_current_user)):
    active_services = await catalog_service.count_active(user["_id"])
    return {
        "active_services": active_services,
        # placeholders so the frontend contract is stable
        "upcoming_bookings": 0,
        "earnings_week_cents": 0,
        "currency": "USD",
    }
