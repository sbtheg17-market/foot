"""Review endpoints (Checkpoint 6)."""
from fastapi import APIRouter, Depends

from app.core.permissions import Permission, require_permission
from app.models.review import ReviewOut, ReviewSummary
from app.services import review_service


router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.get("", response_model=list[ReviewOut], response_model_by_alias=False)
async def list_reviews(user: dict = Depends(require_permission(Permission.REVIEW_READ_SELF))):
    docs = await review_service.list_reviews(user["_id"])
    return [ReviewOut(**d) for d in docs]


@router.get("/summary", response_model=ReviewSummary)
async def review_summary(user: dict = Depends(require_permission(Permission.REVIEW_READ_SELF))):
    return await review_service.get_summary(user["_id"])
