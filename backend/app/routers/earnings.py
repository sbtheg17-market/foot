"""Earnings endpoints (Checkpoint 5)."""
from fastapi import APIRouter, Depends

from app.core.permissions import Permission, require_permission
from app.services import earnings_service


router = APIRouter(prefix="/earnings", tags=["earnings"])


@router.get("/summary")
async def summary(user: dict = Depends(require_permission(Permission.INVOICE_READ_SELF))):
    return await earnings_service.get_summary(user["_id"])
