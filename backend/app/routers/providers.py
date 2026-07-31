"""Provider profile / onboarding endpoints."""
from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_user
from app.models.provider import OnboardingInput
from app.models.user import UserOut, user_to_out
from app.services import provider_service

router = APIRouter(prefix="/providers", tags=["providers"])


@router.put("/me", response_model=UserOut, response_model_by_alias=False)
async def update_profile(body: OnboardingInput, user: dict = Depends(get_current_user)):
    updated = await provider_service.complete_onboarding(user, body)
    return user_to_out(updated)
