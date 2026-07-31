"""Provider dashboard summary — powered by summary_service."""
from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_user
from app.services import summary_service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/provider-summary")
async def provider_summary(user: dict = Depends(get_current_user)):
    return await summary_service.build_provider_summary(user)
