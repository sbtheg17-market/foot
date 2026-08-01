"""Foot-Care Marketplace OS — FastAPI + MongoDB backend.

Preserves the domain model from the sbnem01foot2/foot handoff:
- Providers with status (pending/approved/rejected), listing_active, verification, plan tier
- Services with pricing and duration
- Availability: weekly_hours, blocked_dates, minimum_lead_hours, travel_zone
- Bookings: requested -> accepted/declined -> completed with commission math
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, date, timedelta, timezone
from pathlib import Path
from typing import Annotated, Any, List, Literal, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# --- Mongo -------------------------------------------------------------------
mongo_url = os.environ["MONGO_URL"]
mongo_client = AsyncIOMotorClient(mongo_url)
db = mongo_client[os.environ["DB_NAME"]]

# --- App ---------------------------------------------------------------------
app = FastAPI(title="Foot-Care Marketplace OS")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("footcare")


# --- Helpers -----------------------------------------------------------------
def _uid() -> str:
    return str(uuid.uuid4())


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

Status = Literal["pending", "approved", "rejected"]
BookingStatus = Literal["requested", "accepted", "declined", "completed"]
Plan = Literal["free", "pro", "premium"]


# --- Models ------------------------------------------------------------------
class WeeklyHours(BaseModel):
    """Per-day open windows: e.g. {'mon': [9, 17]} → 9am-5pm, [] = closed."""

    model_config = ConfigDict(extra="ignore")
    mon: List[int] = Field(default_factory=list)
    tue: List[int] = Field(default_factory=list)
    wed: List[int] = Field(default_factory=list)
    thu: List[int] = Field(default_factory=list)
    fri: List[int] = Field(default_factory=list)
    sat: List[int] = Field(default_factory=list)
    sun: List[int] = Field(default_factory=list)


class TravelZone(BaseModel):
    model_config = ConfigDict(extra="ignore")
    base_city: str
    radius_km: int = 15


class Provider(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uid)
    name: str
    bio: str = ""
    city: str
    categories: List[str] = Field(default_factory=list)
    senior_friendly: bool = False
    verified: bool = False
    rating: float = 5.0
    reviews_count: int = 0
    status: Status = "pending"
    listing_active: bool = False
    avatar_url: str = ""
    cover_url: str = ""
    documents: List[str] = Field(default_factory=list)
    plan: Plan = "free"
    commission_rate: float = 0.15  # platform's cut
    weekly_hours: WeeklyHours = Field(default_factory=WeeklyHours)
    blocked_dates: List[str] = Field(default_factory=list)  # ISO date strings
    minimum_lead_hours: int = 4
    travel_zone: TravelZone
    created_at: str = Field(default_factory=_now_iso)


class Service(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uid)
    provider_id: str
    title: str
    description: str = ""
    duration_min: int
    price_cents: int
    category: str


class Booking(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_uid)
    client_name: str
    client_email: EmailStr
    provider_id: str
    service_id: str
    start_time: str  # ISO datetime
    status: BookingStatus = "requested"
    notes: str = ""
    gmv_cents: int
    commission_rate: float
    platform_fee_cents: int
    provider_net_cents: int
    created_at: str = Field(default_factory=_now_iso)


# --- Input models ------------------------------------------------------------
class BookingCreate(BaseModel):
    client_name: str
    client_email: EmailStr
    provider_id: str
    service_id: str
    start_time: str  # ISO
    notes: str = ""


class BookingStatusUpdate(BaseModel):
    status: BookingStatus


class AvailabilityUpdate(BaseModel):
    weekly_hours: Optional[WeeklyHours] = None
    blocked_dates: Optional[List[str]] = None
    minimum_lead_hours: Optional[int] = None
    travel_zone: Optional[TravelZone] = None


class ProviderStatusUpdate(BaseModel):
    status: Status


class ListingToggle(BaseModel):
    listing_active: bool


# --- Public: providers -------------------------------------------------------
@api.get("/providers")
async def list_providers(
    city: Optional[str] = None,
    category: Optional[str] = None,
    senior_friendly: Optional[bool] = None,
    verified: Optional[bool] = None,
    min_rating: Optional[float] = None,
    q: Optional[str] = None,
    include_all: bool = False,  # for admin
) -> List[dict]:
    query: dict[str, Any] = {}
    if not include_all:
        query["status"] = "approved"
        query["listing_active"] = True
    if city:
        query["city"] = {"$regex": f"^{city}$", "$options": "i"}
    if category:
        query["categories"] = category
    if senior_friendly is not None:
        query["senior_friendly"] = senior_friendly
    if verified is not None:
        query["verified"] = verified
    if min_rating is not None:
        query["rating"] = {"$gte": min_rating}
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"bio": {"$regex": q, "$options": "i"}},
        ]
    # Sort: premium first, then pro, then rating
    plan_order = {"premium": 0, "pro": 1, "free": 2}
    providers = await db.providers.find(query, {"_id": 0}).to_list(500)
    providers.sort(key=lambda p: (plan_order.get(p.get("plan", "free"), 2), -p.get("rating", 0)))
    return providers


@api.get("/providers/{provider_id}")
async def get_provider(provider_id: str) -> dict:
    p = await db.providers.find_one({"id": provider_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Provider not found")
    return p


@api.get("/providers/{provider_id}/services")
async def list_services(provider_id: str) -> List[dict]:
    return await db.services.find({"provider_id": provider_id}, {"_id": 0}).to_list(200)


@api.get("/providers/{provider_id}/availability")
async def get_availability(provider_id: str, days: int = 14) -> dict:
    """Return available slots for the next `days` days, respecting rules.

    Slot granularity: hour-aligned within each open window.
    """
    p = await db.providers.find_one({"id": provider_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Provider not found")

    weekly = p.get("weekly_hours", {})
    blocked = set(p.get("blocked_dates", []))
    min_lead = int(p.get("minimum_lead_hours", 4))

    now = datetime.now(timezone.utc)
    earliest = now + timedelta(hours=min_lead)

    # Existing bookings that would conflict (accepted or requested block the slot)
    existing = await db.bookings.find(
        {"provider_id": provider_id, "status": {"$in": ["requested", "accepted"]}},
        {"_id": 0, "start_time": 1},
    ).to_list(500)
    booked_starts = {b["start_time"] for b in existing}

    result: dict[str, List[str]] = {}
    today = now.date()
    for offset in range(days):
        d = today + timedelta(days=offset)
        d_iso = d.isoformat()
        if d_iso in blocked:
            result[d_iso] = []
            continue
        day_key = DAY_KEYS[d.weekday()]
        window = weekly.get(day_key, [])
        if not window or len(window) != 2:
            result[d_iso] = []
            continue
        start_h, end_h = int(window[0]), int(window[1])
        slots: List[str] = []
        for hour in range(start_h, end_h):
            slot_dt = datetime(d.year, d.month, d.day, hour, 0, tzinfo=timezone.utc)
            if slot_dt < earliest:
                continue
            iso = slot_dt.isoformat()
            if iso in booked_starts:
                continue
            slots.append(iso)
        result[d_iso] = slots
    return {"provider_id": provider_id, "slots": result, "minimum_lead_hours": min_lead}


# --- Bookings ----------------------------------------------------------------
@api.post("/bookings", response_model=Booking)
async def create_booking(payload: BookingCreate) -> Booking:
    provider = await db.providers.find_one({"id": payload.provider_id}, {"_id": 0})
    if not provider:
        raise HTTPException(404, "Provider not found")
    if provider.get("status") != "approved" or not provider.get("listing_active"):
        raise HTTPException(400, "Provider is not currently accepting bookings")
    service = await db.services.find_one(
        {"id": payload.service_id, "provider_id": payload.provider_id}, {"_id": 0}
    )
    if not service:
        raise HTTPException(404, "Service not found for this provider")

    # Validate slot rules
    try:
        start_dt = datetime.fromisoformat(payload.start_time)
    except ValueError:
        raise HTTPException(400, "Invalid start_time format")
    if start_dt.tzinfo is None:
        start_dt = start_dt.replace(tzinfo=timezone.utc)

    min_lead = int(provider.get("minimum_lead_hours", 4))
    if start_dt < datetime.now(timezone.utc) + timedelta(hours=min_lead):
        raise HTTPException(400, f"Start time must be at least {min_lead}h from now")
    if start_dt.date().isoformat() in set(provider.get("blocked_dates", [])):
        raise HTTPException(400, "Provider is not available on this date")

    day_key = DAY_KEYS[start_dt.weekday()]
    window = provider.get("weekly_hours", {}).get(day_key, [])
    if len(window) != 2 or not (int(window[0]) <= start_dt.hour < int(window[1])):
        raise HTTPException(400, "Provider is not available at this time")

    # Prevent double-book
    conflict = await db.bookings.find_one(
        {
            "provider_id": payload.provider_id,
            "start_time": start_dt.isoformat(),
            "status": {"$in": ["requested", "accepted"]},
        }
    )
    if conflict:
        raise HTTPException(409, "This time slot has already been booked")

    gmv = int(service["price_cents"])
    rate = float(provider.get("commission_rate", 0.15))
    platform_fee = round(gmv * rate)
    net = gmv - platform_fee

    booking = Booking(
        client_name=payload.client_name,
        client_email=payload.client_email,
        provider_id=payload.provider_id,
        service_id=payload.service_id,
        start_time=start_dt.isoformat(),
        notes=payload.notes,
        gmv_cents=gmv,
        commission_rate=rate,
        platform_fee_cents=platform_fee,
        provider_net_cents=net,
    )
    await db.bookings.insert_one(booking.model_dump())
    return booking


@api.get("/bookings")
async def list_bookings(
    provider_id: Optional[str] = None,
    client_email: Optional[str] = None,
    status: Optional[BookingStatus] = None,
) -> List[dict]:
    query: dict[str, Any] = {}
    if provider_id:
        query["provider_id"] = provider_id
    if client_email:
        query["client_email"] = client_email
    if status:
        query["status"] = status
    bookings = await db.bookings.find(query, {"_id": 0}).sort("start_time", -1).to_list(500)
    # Enrich with provider name + service title (for cards)
    provider_ids = list({b["provider_id"] for b in bookings})
    service_ids = list({b["service_id"] for b in bookings})
    providers = {
        p["id"]: p
        for p in await db.providers.find(
            {"id": {"$in": provider_ids}}, {"_id": 0, "id": 1, "name": 1, "avatar_url": 1, "city": 1}
        ).to_list(500)
    }
    services = {
        s["id"]: s
        for s in await db.services.find(
            {"id": {"$in": service_ids}}, {"_id": 0, "id": 1, "title": 1, "duration_min": 1}
        ).to_list(500)
    }
    for b in bookings:
        b["provider"] = providers.get(b["provider_id"])
        b["service"] = services.get(b["service_id"])
    return bookings


@api.patch("/bookings/{booking_id}/status")
async def update_booking_status(booking_id: str, payload: BookingStatusUpdate) -> dict:
    res = await db.bookings.find_one_and_update(
        {"id": booking_id},
        {"$set": {"status": payload.status}},
        return_document=True,
        projection={"_id": 0},
    )
    if not res:
        raise HTTPException(404, "Booking not found")
    return res


# --- Provider self-management ------------------------------------------------
@api.get("/provider/{provider_id}/earnings")
async def provider_earnings(provider_id: str) -> dict:
    p = await db.providers.find_one({"id": provider_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Provider not found")
    bookings = await db.bookings.find({"provider_id": provider_id}, {"_id": 0}).to_list(1000)

    def sum_field(items: list, field: str) -> int:
        return sum(int(b.get(field, 0)) for b in items)

    completed = [b for b in bookings if b["status"] == "completed"]
    upcoming = [b for b in bookings if b["status"] == "accepted"]

    return {
        "provider_id": provider_id,
        "plan": p.get("plan", "free"),
        "commission_rate": p.get("commission_rate", 0.15),
        "totals": {
            "completed_count": len(completed),
            "upcoming_count": len(upcoming),
            "requested_count": sum(1 for b in bookings if b["status"] == "requested"),
            "gmv_cents": sum_field(completed, "gmv_cents"),
            "platform_fee_cents": sum_field(completed, "platform_fee_cents"),
            "provider_net_cents": sum_field(completed, "provider_net_cents"),
            "pending_net_cents": sum_field(upcoming, "provider_net_cents"),
        },
    }


@api.patch("/provider/{provider_id}/availability")
async def update_availability(provider_id: str, payload: AvailabilityUpdate) -> dict:
    updates: dict[str, Any] = {}
    if payload.weekly_hours is not None:
        updates["weekly_hours"] = payload.weekly_hours.model_dump()
    if payload.blocked_dates is not None:
        updates["blocked_dates"] = payload.blocked_dates
    if payload.minimum_lead_hours is not None:
        updates["minimum_lead_hours"] = payload.minimum_lead_hours
    if payload.travel_zone is not None:
        updates["travel_zone"] = payload.travel_zone.model_dump()
    if not updates:
        raise HTTPException(400, "No fields to update")
    res = await db.providers.find_one_and_update(
        {"id": provider_id}, {"$set": updates}, return_document=True, projection={"_id": 0}
    )
    if not res:
        raise HTTPException(404, "Provider not found")
    return res


# --- Admin -------------------------------------------------------------------
@api.get("/admin/providers")
async def admin_list_providers(status: Optional[Status] = None) -> List[dict]:
    query: dict[str, Any] = {}
    if status:
        query["status"] = status
    return await db.providers.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.patch("/admin/providers/{provider_id}/status")
async def admin_set_provider_status(provider_id: str, payload: ProviderStatusUpdate) -> dict:
    updates: dict[str, Any] = {"status": payload.status}
    # Approving activates the listing by default; rejecting deactivates it.
    if payload.status == "approved":
        updates["listing_active"] = True
        updates["verified"] = True
    elif payload.status == "rejected":
        updates["listing_active"] = False
    res = await db.providers.find_one_and_update(
        {"id": provider_id}, {"$set": updates}, return_document=True, projection={"_id": 0}
    )
    if not res:
        raise HTTPException(404, "Provider not found")
    return res


@api.patch("/admin/providers/{provider_id}/listing-active")
async def admin_toggle_listing(provider_id: str, payload: ListingToggle) -> dict:
    res = await db.providers.find_one_and_update(
        {"id": provider_id},
        {"$set": {"listing_active": payload.listing_active}},
        return_document=True,
        projection={"_id": 0},
    )
    if not res:
        raise HTTPException(404, "Provider not found")
    return res


@api.get("/admin/revenue")
async def admin_revenue(window: Literal["daily", "weekly"] = "weekly") -> dict:
    """Platform revenue overview aggregated by day or week."""
    bookings = await db.bookings.find({}, {"_id": 0}).to_list(5000)
    completed = [b for b in bookings if b["status"] == "completed"]

    total_gmv = sum(int(b.get("gmv_cents", 0)) for b in completed)
    total_fee = sum(int(b.get("platform_fee_cents", 0)) for b in completed)

    # Build buckets over last 8 weeks or 14 days
    now = datetime.now(timezone.utc)
    buckets: dict[str, dict[str, int]] = {}
    if window == "daily":
        for i in range(13, -1, -1):
            d = (now - timedelta(days=i)).date().isoformat()
            buckets[d] = {"gmv_cents": 0, "platform_fee_cents": 0, "count": 0}
    else:
        for i in range(7, -1, -1):
            week_start = (now - timedelta(days=now.weekday() + 7 * i)).date()
            buckets[week_start.isoformat()] = {"gmv_cents": 0, "platform_fee_cents": 0, "count": 0}

    for b in completed:
        try:
            dt = datetime.fromisoformat(b["start_time"])
        except Exception:
            continue
        if window == "daily":
            key = dt.date().isoformat()
        else:
            week_start = (dt.date() - timedelta(days=dt.weekday())).isoformat()
            key = week_start
        if key in buckets:
            buckets[key]["gmv_cents"] += int(b.get("gmv_cents", 0))
            buckets[key]["platform_fee_cents"] += int(b.get("platform_fee_cents", 0))
            buckets[key]["count"] += 1

    series = [{"period": k, **v} for k, v in buckets.items()]

    return {
        "window": window,
        "totals": {
            "gmv_cents": total_gmv,
            "platform_fee_cents": total_fee,
            "completed_bookings": len(completed),
            "total_bookings": len(bookings),
            "requested_bookings": sum(1 for b in bookings if b["status"] == "requested"),
            "active_providers": await db.providers.count_documents(
                {"status": "approved", "listing_active": True}
            ),
            "pending_providers": await db.providers.count_documents({"status": "pending"}),
        },
        "series": series,
    }


# --- Health ------------------------------------------------------------------
@api.get("/")
async def root() -> dict:
    return {"service": "foot-care-marketplace-os", "status": "ok"}


# --- Bootstrap ---------------------------------------------------------------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _startup() -> None:
    # Auto-seed on first run so the marketplace is never empty.
    if await db.providers.count_documents({}) == 0:
        from seed import seed_all  # local import keeps module import cheap

        await seed_all(db)
        logger.info("Seeded marketplace data")


@app.on_event("shutdown")
async def _shutdown() -> None:
    mongo_client.close()
