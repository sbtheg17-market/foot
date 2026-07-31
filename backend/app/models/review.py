"""Review models (Checkpoint 6). Read-only for providers today.

Client-side review creation lands with the client portal (out of scope).
`is_verified=True` means the review was tied to a real OnCall Foot booking.
"""
from typing import Optional

from pydantic import BaseModel, Field

from app.models.common import PyObjectId


class ReviewOut(BaseModel):
    id: PyObjectId = Field(alias="_id")
    provider_id: PyObjectId
    booking_id: Optional[PyObjectId] = None
    client_name: str
    rating: int = Field(ge=1, le=5)
    comment: str = ""
    is_verified: bool = True
    created_at: str

    model_config = {"populate_by_name": True}


class ReviewSummary(BaseModel):
    average: float
    count: int
    breakdown: dict[int, int]
