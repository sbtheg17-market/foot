"""Deterministic, dev-only booking seed.

Rules:
 - No real PII. Fake but realistic names, phones (555 010-xxxx), addresses.
 - Idempotent: clearing all `is_seed=True` bookings for the provider, then
   inserting a fresh set relative to `now`.
 - Uses the provider's own services if available; else a fallback catalog.
 - Distribution covers today / upcoming / completed / cancelled / no_show.
"""
from datetime import datetime, timedelta, timezone

from bson import ObjectId

from app.core.constants import BookingStatus
from app.repositories import booking_repository, service_repository


FAKE_CLIENTS = [
    {"name": "Margaret Chen", "phone": "(555) 010-0142", "address": "812 Cedar Ave, Apt 3B", "pincode": "94103"},
    {"name": "Robert Johnson", "phone": "(555) 010-0156", "address": "45 Maple St", "pincode": "94110"},
    {"name": "Priya Patel", "phone": "(555) 010-0189", "address": "1204 Oak Hill Dr", "pincode": "94117"},
    {"name": "James O'Brien", "phone": "(555) 010-0224", "address": "78 Birchwood Ln", "pincode": "94103"},
    {"name": "Susan Lee", "phone": "(555) 010-0257", "address": "3200 Sunset Blvd", "pincode": "94122"},
    {"name": "Michael Rodriguez", "phone": "(555) 010-0281", "address": "56 Willow Ct", "pincode": "94110"},
    {"name": "Elena Volkov", "phone": "(555) 010-0313", "address": "912 Pine St, Unit 12", "pincode": "94108"},
    {"name": "David Kim", "phone": "(555) 010-0347", "address": "425 Elm Ave", "pincode": "94117"},
    {"name": "Ana Garcia", "phone": "(555) 010-0369", "address": "1580 Fillmore St", "pincode": "94115"},
    {"name": "Frank Nakamura", "phone": "(555) 010-0402", "address": "77 Hayes St, Apt 2", "pincode": "94102"},
]

FALLBACK_SERVICES = [
    {"name": "Diabetic Foot Assessment", "duration_minutes": 45, "price_cents": 8500, "currency": "USD"},
    {"name": "Nail Care", "duration_minutes": 30, "price_cents": 6500, "currency": "USD"},
    {"name": "Wound Check", "duration_minutes": 30, "price_cents": 7500, "currency": "USD"},
    {"name": "Callus & Corn Care", "duration_minutes": 45, "price_cents": 9000, "currency": "USD"},
]

# (day_offset, hour, minute, status)
BOOKING_PLAN: list[tuple[int, int, int, str]] = [
    (-14, 10, 0, BookingStatus.COMPLETED.value),
    (-12, 14, 30, BookingStatus.COMPLETED.value),
    (-9, 11, 0, BookingStatus.CANCELLED.value),
    (-7, 15, 0, BookingStatus.COMPLETED.value),
    (-5, 9, 30, BookingStatus.NO_SHOW.value),
    (-3, 13, 0, BookingStatus.COMPLETED.value),
    (-1, 16, 0, BookingStatus.CANCELLED.value),
    (0, 10, 30, BookingStatus.CONFIRMED.value),
    (0, 14, 0, BookingStatus.CONFIRMED.value),
    (1, 9, 0, BookingStatus.ACCEPTED.value),
    (2, 11, 0, BookingStatus.PENDING.value),
    (3, 15, 30, BookingStatus.CONFIRMED.value),
    (5, 10, 0, BookingStatus.ACCEPTED.value),
    (7, 13, 30, BookingStatus.PENDING.value),
]

NOTES = [
    "First-time client. Ground floor access.",
    "Diabetic — please review blood sugar log.",
    "Buzzer at gate: 4212.",
    "Cat in the house, friendly.",
    "Client uses a walker. Slow to answer door.",
    "",
    "",
    "Prefers midday visits.",
    "",
    "Recent hospital discharge. Coordinate with daughter.",
]


def _status_history(final_status: str, created_iso: str, updated_iso: str) -> list[dict]:
    chain: list[str] = [BookingStatus.PENDING.value]
    if final_status == BookingStatus.PENDING.value:
        pass
    elif final_status == BookingStatus.ACCEPTED.value:
        chain += [BookingStatus.ACCEPTED.value]
    elif final_status == BookingStatus.CONFIRMED.value:
        chain += [BookingStatus.ACCEPTED.value, BookingStatus.CONFIRMED.value]
    elif final_status == BookingStatus.COMPLETED.value:
        chain += [
            BookingStatus.ACCEPTED.value,
            BookingStatus.CONFIRMED.value,
            BookingStatus.COMPLETED.value,
        ]
    elif final_status == BookingStatus.NO_SHOW.value:
        chain += [
            BookingStatus.ACCEPTED.value,
            BookingStatus.CONFIRMED.value,
            BookingStatus.NO_SHOW.value,
        ]
    elif final_status == BookingStatus.CANCELLED.value:
        chain += [BookingStatus.CANCELLED.value]

    return [{"status": s, "at": created_iso if i == 0 else updated_iso} for i, s in enumerate(chain)]


async def _provider_services(provider_id: ObjectId) -> list[dict]:
    docs = await service_repository.list_for_provider(provider_id)
    real = [
        {
            "service_id": str(d["_id"]),
            "name": d["name"],
            "duration_minutes": d["duration_minutes"],
            "price_cents": d["price_cents"],
            "currency": d.get("currency") or "USD",
        }
        for d in docs
        if d.get("active", True)
    ]
    return real if real else [{"service_id": None, **s} for s in FALLBACK_SERVICES]


async def seed_bookings_for_provider(user: dict) -> int:
    provider_id: ObjectId = user["_id"]
    await booking_repository.delete_seeded(provider_id)

    services = await _provider_services(provider_id)
    now = datetime.now(timezone.utc)
    docs: list[dict] = []

    for i, (day_offset, hour, minute, status) in enumerate(BOOKING_PLAN):
        client = FAKE_CLIENTS[i % len(FAKE_CLIENTS)]
        service = services[i % len(services)]
        scheduled = (now + timedelta(days=day_offset)).replace(hour=hour, minute=minute, second=0, microsecond=0)
        created = scheduled - timedelta(days=max(2, abs(day_offset) // 2))
        updated = scheduled if day_offset <= 0 else created + timedelta(hours=6)
        created_iso = created.isoformat()
        updated_iso = updated.isoformat()

        docs.append({
            "provider_id": provider_id,
            "client": client,
            "service": {
                "service_id": service.get("service_id"),
                "name": service["name"],
                "duration_minutes": service["duration_minutes"],
                "price_cents": service["price_cents"],
                "currency": service.get("currency") or "USD",
            },
            "scheduled_at": scheduled.isoformat(),
            "status": status,
            "notes": NOTES[i % len(NOTES)],
            "status_history": _status_history(status, created_iso, updated_iso),
            "is_seed": True,
            "created_at": created_iso,
            "updated_at": updated_iso,
        })

    inserted = await booking_repository.insert_many(docs)

    # Demo boost: patch the first confirmed-today booking to be ~45 min from now
    # so the Home "next visit" banner always demos convincingly right after seed.
    now_plus_45 = (now + timedelta(minutes=45)).isoformat()
    for doc in docs:
        if doc["status"] == "confirmed":
            sched = datetime.fromisoformat(doc["scheduled_at"])
            if sched.date() == now.date():
                await booking_repository.update_status(
                    doc["_id"], provider_id, "confirmed",
                    {"status": "confirmed", "at": now.isoformat(), "reason": "demo_slot_adjust"},
                )
                await booking_repository._coll.update_one(
                    {"_id": doc["_id"]}, {"$set": {"scheduled_at": now_plus_45}}
                )
                break

    return len(inserted)


async def clear_seeded_bookings(provider_id: ObjectId) -> int:
    return await booking_repository.delete_seeded(provider_id)
