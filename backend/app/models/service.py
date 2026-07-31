"""Service catalog models (Checkpoint 2)."""
from typing import Optional

from pydantic import BaseModel, Field

from app.core.constants import DEFAULT_CURRENCY
from app.models.common import PyObjectId


class ServiceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = ""
    category: Optional[str] = None
    duration_minutes: int = Field(ge=5, le=480)
    price_cents: int = Field(ge=0)
    currency: str = DEFAULT_CURRENCY
    active: bool = True
    display_order: int = 0


class ServiceUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    description: Optional[str] = None
    category: Optional[str] = None
    duration_minutes: Optional[int] = Field(default=None, ge=5, le=480)
    price_cents: Optional[int] = Field(default=None, ge=0)
    currency: Optional[str] = None
    active: Optional[bool] = None
    display_order: Optional[int] = None


class ServiceOut(BaseModel):
    id: PyObjectId = Field(alias="_id")
    provider_id: PyObjectId
    name: str
    description: str = ""
    category: Optional[str] = None
    duration_minutes: int
    price_cents: int
    currency: str
    active: bool
    display_order: int = 0
    created_at: str
    updated_at: str

    model_config = {"populate_by_name": True}


def service_to_out(doc: dict) -> ServiceOut:
    return ServiceOut(**doc)
