"""Booking models (Checkpoint 4).

Booking is the marketplace lifecycle unit. Client + service are snapshotted
so future edits to the service catalog or client profile don't rewrite history.
"""
from typing import List, Optional

from pydantic import BaseModel, Field

from app.models.common import PyObjectId


class ClientSnapshot(BaseModel):
    name: str
    phone: str = ""
    address: str = ""
    pincode: str = ""


class ServiceSnapshot(BaseModel):
    service_id: Optional[str] = None
    name: str
    duration_minutes: int
    price_cents: int
    currency: str = "USD"


class StatusHistoryEntry(BaseModel):
    status: str
    at: str
    reason: Optional[str] = None


class BookingOut(BaseModel):
    id: PyObjectId = Field(alias="_id")
    provider_id: PyObjectId
    client: ClientSnapshot
    service: ServiceSnapshot
    scheduled_at: str
    status: str
    notes: str = ""
    status_history: List[StatusHistoryEntry] = []
    created_at: str
    updated_at: str

    model_config = {"populate_by_name": True}


class BookingStatusUpdate(BaseModel):
    status: str
    reason: Optional[str] = None
