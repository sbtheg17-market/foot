"""Invoice business logic (Checkpoint 5).

Rule: exactly one invoice per completed booking. Idempotent on re-completion.
"""
from datetime import datetime, timezone

from bson import ObjectId

from app.repositories import invoice_repository, user_repository


def _invoice_number(provider_id: ObjectId, seq: int) -> str:
    now = datetime.now(timezone.utc)
    tail = str(provider_id)[-4:]
    return f"OCF-{tail}-{now.strftime('%y%m')}-{seq:04d}"


async def create_from_completed_booking(booking: dict, is_seed: bool = False) -> dict:
    existing = await invoice_repository.get_by_booking(booking["_id"])
    if existing:
        return existing

    provider = await user_repository.get_by_id(booking["provider_id"])
    provider_name = (provider or {}).get("name", "")

    service = booking.get("service") or {}
    price = int(service.get("price_cents", 0))
    line_items = [{
        "description": service.get("name", "Service"),
        "quantity": 1,
        "unit_price_cents": price,
        "total_cents": price,
    }]
    subtotal = price
    tax = 0
    total = subtotal + tax

    seq = (await invoice_repository.count_for_provider(booking["provider_id"])) + 1
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "invoice_number": _invoice_number(booking["provider_id"], seq),
        "provider_id": booking["provider_id"],
        "booking_id": booking["_id"],
        "client": booking.get("client", {}),
        "line_items": line_items,
        "subtotal_cents": subtotal,
        "tax_cents": tax,
        "total_cents": total,
        "currency": service.get("currency", "USD"),
        "issued_at": booking.get("updated_at") or now,
        "status": "issued",
        "provider_name": provider_name,
        "scheduled_at": booking.get("scheduled_at"),
        "is_seed": bool(is_seed or booking.get("is_seed")),
        "created_at": now,
        "updated_at": now,
    }
    inserted_id = await invoice_repository.insert(doc)
    doc["_id"] = inserted_id
    return doc


async def list_invoices(provider_id: ObjectId) -> list[dict]:
    return await invoice_repository.list_for_provider(provider_id)


async def get_invoice(invoice_id: str, provider_id: ObjectId) -> dict | None:
    from fastapi import HTTPException
    try:
        oid = ObjectId(invoice_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Invoice not found")
    doc = await invoice_repository.get_for_provider(oid, provider_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return doc
