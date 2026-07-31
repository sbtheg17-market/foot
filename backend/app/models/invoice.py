"""Invoice models (Checkpoint 5). Invoices are generated from completed bookings.

Snapshotting rule: client, provider name and line-items are frozen at issue-time
so future edits to the service catalog / provider profile don't rewrite history.
"""
from typing import List, Optional

from pydantic import BaseModel, Field

from app.models.booking import ClientSnapshot
from app.models.common import PyObjectId


class LineItem(BaseModel):
    description: str
    quantity: int = 1
    unit_price_cents: int
    total_cents: int


class InvoiceOut(BaseModel):
    id: PyObjectId = Field(alias="_id")
    invoice_number: str
    provider_id: PyObjectId
    booking_id: PyObjectId
    client: ClientSnapshot
    line_items: List[LineItem]
    subtotal_cents: int
    tax_cents: int
    total_cents: int
    currency: str = "USD"
    issued_at: str
    status: str = "issued"
    provider_name: str = ""
    scheduled_at: Optional[str] = None
    created_at: str
    updated_at: str

    model_config = {"populate_by_name": True}
