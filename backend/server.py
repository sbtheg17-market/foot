"""Foot-Care Marketplace OS — FastAPI + MongoDB backend (Phase 2).

Adds: Emergent Google auth (session cookies, roles), provider self-signup with
Emergent object-storage doc uploads, Stripe checkout at booking time, Twilio SMS
stub on provider Accept, and real Provider Opportunity insights.
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, date, timedelta, timezone
from pathlib import Path
from typing import Annotated, Any, List, Literal, Optional

import requests
import stripe
from dotenv import load_dotenv
from fastapi import (
    APIRouter, Depends, FastAPI, File, Form, Header, HTTPException, Query,
    Request, Response, UploadFile,
)
from fastapi.responses import Response as FastAPIResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from starlette.middleware.cors import CORSMiddleware

from opportunities import compute_opportunities
from sms import booking_accepted_message, booking_requested_message, send_sms
from storage_client import init_storage, upload_provider_doc

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
mongo_client = AsyncIOMotorClient(mongo_url)
db = mongo_client[os.environ["DB_NAME"]]

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY") or "sk_test_emergent"

ADMIN_EMAILS = {
    e.strip().lower()
    for e in os.environ.get("ADMIN_EMAILS", "").split(",")
    if e.strip()
}

app = FastAPI(title="Foot-Care Marketplace OS")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("footcare")


# --- helpers ----------------------------------------------------------------
def _uid() -> str: return str(uuid.uuid4())
def _now_iso() -> str: return datetime.now(timezone.utc).isoformat()

DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
Status = Literal["pending", "approved", "rejected"]
BookingStatus = Literal["requested", "accepted", "declined", "completed"]
Plan = Literal["free", "pro", "premium"]
Role = Literal["client", "provider", "admin"]


# --- models -----------------------------------------------------------------
class WeeklyHours(BaseModel):
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
    commission_rate: float = 0.15
    weekly_hours: WeeklyHours = Field(default_factory=WeeklyHours)
    blocked_dates: List[str] = Field(default_factory=list)
    minimum_lead_hours: int = 4
    travel_zone: TravelZone
    owner_email: Optional[str] = None
    owner_user_id: Optional[str] = None
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
    client_phone: Optional[str] = None
    client_user_id: Optional[str] = None
    provider_id: str
    service_id: str
    start_time: str
    status: BookingStatus = "requested"
    notes: str = ""
    gmv_cents: int
    commission_rate: float
    platform_fee_cents: int
    provider_net_cents: int
    payment_status: Literal["pending", "paid", "cancelled"] = "pending"
    stripe_session_id: Optional[str] = None
    created_at: str = Field(default_factory=_now_iso)


class BookingCreate(BaseModel):
    client_name: str
    client_email: EmailStr
    client_phone: Optional[str] = None
    provider_id: str
    service_id: str
    start_time: str
    notes: str = ""
    origin_url: str  # for Stripe checkout redirect URLs


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


class SearchEvent(BaseModel):
    city: Optional[str] = None
    category: Optional[str] = None
    senior_friendly: Optional[bool] = None
    verified: Optional[bool] = None
    q: Optional[str] = None


class ProviderSignup(BaseModel):
    name: str
    bio: str = ""
    city: str
    categories: List[str] = Field(default_factory=list)
    senior_friendly: bool = False
    weekly_hours: WeeklyHours = Field(default_factory=WeeklyHours)
    minimum_lead_hours: int = 6
    travel_zone: TravelZone
    document_paths: List[str] = Field(default_factory=list)  # already-uploaded storage paths


# --- auth -------------------------------------------------------------------
async def _fetch_session_from_emergent(session_id: str) -> dict:
    r = requests.get(
        "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
        headers={"X-Session-ID": session_id},
        timeout=15,
    )
    if r.status_code != 200:
        raise HTTPException(401, "Session verification failed")
    return r.json()


async def _resolve_user(session_token: Optional[str]) -> Optional[dict]:
    if not session_token:
        return None
    sess = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not sess:
        return None
    exp = sess.get("expires_at")
    if isinstance(exp, str):
        exp = datetime.fromisoformat(exp)
    if exp and exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp and exp < datetime.now(timezone.utc):
        return None
    return await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})


async def current_user(
    request: Request,
    authorization: Optional[str] = Header(None),
) -> Optional[dict]:
    token = request.cookies.get("session_token")
    if not token and authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1]
    return await _resolve_user(token)


async def require_user(user: dict | None = Depends(current_user)) -> dict:
    if not user:
        raise HTTPException(401, "Not authenticated")
    return user


async def require_admin(user: dict = Depends(require_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    return user


@api.post("/auth/session")
async def create_session(payload: dict, response: Response):
    session_id = payload.get("session_id")
    if not session_id:
        raise HTTPException(400, "session_id required")
    data = await _fetch_session_from_emergent(session_id)
    email = data["email"].lower()
    name = data.get("name", "")
    picture = data.get("picture", "")
    session_token = data["session_token"]

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        role = existing["role"]
        # If they became admin later, promote.
        if email in ADMIN_EMAILS and role != "admin":
            role = "admin"
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name or existing.get("name", ""),
                      "picture": picture or existing.get("picture", ""),
                      "role": role, "last_login": _now_iso()}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        role = "admin" if email in ADMIN_EMAILS else "client"
        # If a seeded provider has this owner_email, upgrade the user to 'provider'.
        linked = await db.providers.find_one({"owner_email": email}, {"_id": 0})
        if linked and role != "admin":
            role = "provider"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "role": role,
            "linked_provider_id": linked["id"] if linked else None,
            "created_at": _now_iso(),
            "last_login": _now_iso(),
        })
        if linked and not linked.get("owner_user_id"):
            await db.providers.update_one({"id": linked["id"]}, {"$set": {"owner_user_id": user_id}})

    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": _now_iso(),
    })
    response.set_cookie(
        "session_token", session_token,
        httponly=True, secure=True, samesite="none",
        path="/", max_age=7 * 24 * 60 * 60,
    )
    return {"ok": True}


@api.get("/auth/me")
async def auth_me(user: dict | None = Depends(current_user)) -> dict:
    if not user:
        raise HTTPException(401, "Not authenticated")
    provider = None
    if user.get("linked_provider_id"):
        provider = await db.providers.find_one({"id": user["linked_provider_id"]}, {"_id": 0})
    return {"user": user, "provider": provider}


@api.post("/auth/logout")
async def auth_logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_many({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# --- providers --------------------------------------------------------------
@api.get("/providers")
async def list_providers(
    city: Optional[str] = None,
    category: Optional[str] = None,
    senior_friendly: Optional[bool] = None,
    verified: Optional[bool] = None,
    min_rating: Optional[float] = None,
    q: Optional[str] = None,
    include_all: bool = False,
) -> List[dict]:
    query: dict[str, Any] = {}
    if not include_all:
        query["status"] = "approved"
        query["listing_active"] = True
    if city: query["city"] = {"$regex": f"^{city}$", "$options": "i"}
    if category: query["categories"] = category
    if senior_friendly is not None: query["senior_friendly"] = senior_friendly
    if verified is not None: query["verified"] = verified
    if min_rating is not None: query["rating"] = {"$gte": min_rating}
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"bio": {"$regex": q, "$options": "i"}},
        ]
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
    p = await db.providers.find_one({"id": provider_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Provider not found")
    weekly = p.get("weekly_hours", {})
    blocked = set(p.get("blocked_dates", []))
    min_lead = int(p.get("minimum_lead_hours", 4))
    now = datetime.now(timezone.utc)
    earliest = now + timedelta(hours=min_lead)
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
            if slot_dt < earliest: continue
            iso = slot_dt.isoformat()
            if iso in booked_starts: continue
            slots.append(iso)
        result[d_iso] = slots
    return {"provider_id": provider_id, "slots": result, "minimum_lead_hours": min_lead}


# --- bookings ---------------------------------------------------------------
def _validate_slot(provider: dict, start_iso: str) -> datetime:
    try:
        start_dt = datetime.fromisoformat(start_iso)
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
    return start_dt


@api.post("/bookings")
async def create_booking(payload: BookingCreate, user: dict | None = Depends(current_user)):
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
    start_dt = _validate_slot(provider, payload.start_time)
    conflict = await db.bookings.find_one({
        "provider_id": payload.provider_id,
        "start_time": start_dt.isoformat(),
        "status": {"$in": ["requested", "accepted"]},
        "payment_status": {"$ne": "cancelled"},
    })
    if conflict:
        raise HTTPException(409, "This time slot has already been booked")

    gmv = int(service["price_cents"])
    rate = float(provider.get("commission_rate", 0.15))
    platform_fee = round(gmv * rate)
    net = gmv - platform_fee

    # Look up caller for client_user_id (if signed in) — supplied by dependency

    booking = Booking(
        client_name=payload.client_name,
        client_email=payload.client_email,
        client_phone=payload.client_phone,
        client_user_id=user["user_id"] if user else None,
        provider_id=payload.provider_id,
        service_id=payload.service_id,
        start_time=start_dt.isoformat(),
        notes=payload.notes,
        gmv_cents=gmv,
        commission_rate=rate,
        platform_fee_cents=platform_fee,
        provider_net_cents=net,
    )

    # Create a Stripe Checkout Session for the exact booking amount.
    origin = payload.origin_url.rstrip("/")
    checkout_url = None
    session_id = None
    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product_data": {
                        "name": f"{service['title']} — {provider['name']}",
                        "description": service.get("description", "")[:200] or None,
                    },
                    "unit_amount": gmv,
                },
                "quantity": 1,
            }],
            success_url=f"{origin}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{origin}/payment/cancel?booking_id={booking.id}",
            metadata={
                "booking_id": booking.id,
                "provider_id": provider["id"],
                "service_id": service["id"],
                "commission_rate": str(rate),
            },
        )
        checkout_url = session.url
        session_id = session.id
        booking.stripe_session_id = session_id
    except stripe.error.StripeError as e:  # noqa
        logger.error(f"Stripe error: {e}")
        raise HTTPException(500, "Payment session could not be created")

    await db.bookings.insert_one(booking.model_dump())
    await db.payment_transactions.insert_one({
        "session_id": session_id,
        "booking_id": booking.id,
        "amount": gmv,
        "currency": "usd",
        "status": "initiated",
        "payment_status": "pending",
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    })

    # SMS ack for the client (stubbed)
    await send_sms(
        db,
        to=payload.client_phone,
        body=booking_requested_message(payload.client_name, provider["name"], service["title"]),
        kind="booking_requested",
        booking_id=booking.id,
    )

    return {**booking.model_dump(), "checkout_url": checkout_url}


@api.get("/bookings")
async def list_bookings(
    provider_id: Optional[str] = None,
    client_email: Optional[str] = None,
    status: Optional[BookingStatus] = None,
) -> List[dict]:
    query: dict[str, Any] = {}
    if provider_id: query["provider_id"] = provider_id
    if client_email: query["client_email"] = client_email
    if status: query["status"] = status
    bookings = await db.bookings.find(query, {"_id": 0}).sort("start_time", -1).to_list(500)
    provider_ids = list({b["provider_id"] for b in bookings})
    service_ids = list({b["service_id"] for b in bookings})
    providers = {p["id"]: p for p in await db.providers.find(
        {"id": {"$in": provider_ids}},
        {"_id": 0, "id": 1, "name": 1, "avatar_url": 1, "city": 1},
    ).to_list(500)}
    services = {s["id"]: s for s in await db.services.find(
        {"id": {"$in": service_ids}},
        {"_id": 0, "id": 1, "title": 1, "duration_min": 1},
    ).to_list(500)}
    for b in bookings:
        b["provider"] = providers.get(b["provider_id"])
        b["service"] = services.get(b["service_id"])
    return bookings


@api.patch("/bookings/{booking_id}/status")
async def update_booking_status(booking_id: str, payload: BookingStatusUpdate):
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(404, "Booking not found")
    await db.bookings.update_one({"id": booking_id}, {"$set": {"status": payload.status}})
    updated = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    # Fire SMS on accept.
    if payload.status == "accepted":
        provider = await db.providers.find_one({"id": booking["provider_id"]}, {"_id": 0})
        service = await db.services.find_one({"id": booking["service_id"]}, {"_id": 0})
        if provider and service:
            await send_sms(
                db,
                to=booking.get("client_phone"),
                body=booking_accepted_message(
                    booking["client_name"], provider["name"], service["title"], booking["start_time"],
                ),
                kind="booking_accepted",
                booking_id=booking_id,
            )
    return updated


# --- payments ---------------------------------------------------------------
@api.get("/payments/status/{session_id}")
async def payment_status(session_id: str):
    record = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not record:
        raise HTTPException(404, "Transaction not found")
    if record.get("payment_status") != "paid":
        try:
            s = stripe.checkout.Session.retrieve(session_id)
            if s.payment_status == "paid" or s.status == "complete":
                await db.payment_transactions.update_one(
                    {"session_id": session_id, "payment_status": {"$ne": "paid"}},
                    {"$set": {
                        "status": "completed", "payment_status": "paid",
                        "stripe_payment_intent_id": s.payment_intent,
                        "updated_at": _now_iso(),
                    }},
                )
                await db.bookings.update_one(
                    {"stripe_session_id": session_id},
                    {"$set": {"payment_status": "paid"}},
                )
                record = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        except stripe.error.StripeError as e:  # noqa
            logger.error(f"Stripe status poll error: {e}")
    booking = await db.bookings.find_one({"stripe_session_id": session_id}, {"_id": 0})
    return {
        "session_id": record["session_id"],
        "status": record["status"],
        "payment_status": record["payment_status"],
        "booking": booking,
    }


@api.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig, secret)
    except stripe.error.SignatureVerificationError:
        raise HTTPException(400, "Invalid signature")
    t = event["type"]
    obj = event["data"]["object"]
    if t == "checkout.session.completed":
        await db.payment_transactions.update_one(
            {"session_id": obj["id"], "payment_status": {"$ne": "paid"}},
            {"$set": {
                "status": "completed",
                "payment_status": obj.get("payment_status", "paid"),
                "stripe_payment_intent_id": obj.get("payment_intent"),
                "updated_at": _now_iso(),
            }},
        )
        await db.bookings.update_one(
            {"stripe_session_id": obj["id"]},
            {"$set": {"payment_status": "paid"}},
        )
    elif t == "checkout.session.expired":
        await db.payment_transactions.update_one(
            {"session_id": obj["id"]},
            {"$set": {"status": "expired", "payment_status": "cancelled", "updated_at": _now_iso()}},
        )
        await db.bookings.update_one(
            {"stripe_session_id": obj["id"]},
            {"$set": {"payment_status": "cancelled"}},
        )
    return {"status": "ok"}


# --- provider self-management -----------------------------------------------
@api.get("/provider/{provider_id}/earnings")
async def provider_earnings(provider_id: str):
    p = await db.providers.find_one({"id": provider_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Provider not found")
    bookings = await db.bookings.find({"provider_id": provider_id}, {"_id": 0}).to_list(1000)

    def s(items, k): return sum(int(b.get(k, 0)) for b in items)
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
            "gmv_cents": s(completed, "gmv_cents"),
            "platform_fee_cents": s(completed, "platform_fee_cents"),
            "provider_net_cents": s(completed, "provider_net_cents"),
            "pending_net_cents": s(upcoming, "provider_net_cents"),
        },
    }


@api.get("/provider/{provider_id}/opportunities")
async def provider_opportunities(provider_id: str):
    p = await db.providers.find_one({"id": provider_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Provider not found")
    return {"provider_id": provider_id, "opportunities": await compute_opportunities(db, p)}


@api.patch("/provider/{provider_id}/availability")
async def update_availability(provider_id: str, payload: AvailabilityUpdate):
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


# --- provider self-signup ---------------------------------------------------
@api.post("/provider/upload-doc")
async def upload_doc(file: UploadFile = File(...), user: dict = Depends(require_user)):
    contents = await file.read()
    ext = (file.filename or "doc").rsplit(".", 1)[-1] if "." in (file.filename or "") else "bin"
    try:
        path = upload_provider_doc(user["user_id"], contents, file.content_type or "application/octet-stream", ext)
    except Exception as e:  # noqa
        logger.error(f"Doc upload failed: {e}")
        raise HTTPException(503, "File storage unavailable — please try again")
    await db.uploaded_docs.insert_one({
        "id": _uid(), "user_id": user["user_id"], "path": path,
        "original_filename": file.filename, "content_type": file.content_type,
        "size": len(contents), "created_at": _now_iso(),
    })
    return {"path": path, "size": len(contents)}


@api.post("/provider/self-signup")
async def provider_self_signup(payload: ProviderSignup, user: dict = Depends(require_user)):
    if user.get("linked_provider_id"):
        raise HTTPException(400, "You already have a provider profile")
    provider = Provider(
        name=payload.name,
        bio=payload.bio,
        city=payload.city,
        categories=payload.categories,
        senior_friendly=payload.senior_friendly,
        weekly_hours=payload.weekly_hours,
        minimum_lead_hours=payload.minimum_lead_hours,
        travel_zone=payload.travel_zone,
        documents=payload.document_paths,
        owner_email=user["email"],
        owner_user_id=user["user_id"],
        status="pending",
        listing_active=False,
        verified=False,
        avatar_url=user.get("picture", ""),
    )
    await db.providers.insert_one(provider.model_dump())
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"linked_provider_id": provider.id, "role": "provider"}},
    )
    return {"provider_id": provider.id, "status": "pending"}


# --- analytics --------------------------------------------------------------
@api.post("/analytics/search")
async def track_search(payload: SearchEvent):
    entry = payload.model_dump()
    entry["created_at"] = _now_iso()
    await db.search_events.insert_one(entry)
    return {"ok": True}


# --- admin ------------------------------------------------------------------
@api.get("/admin/providers")
async def admin_list_providers(
    status: Optional[Status] = None, _: dict = Depends(require_admin)
):
    query: dict[str, Any] = {}
    if status:
        query["status"] = status
    return await db.providers.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.patch("/admin/providers/{provider_id}/status")
async def admin_set_provider_status(
    provider_id: str, payload: ProviderStatusUpdate, _: dict = Depends(require_admin)
):
    updates: dict[str, Any] = {"status": payload.status}
    if payload.status == "approved":
        updates["listing_active"] = True
        updates["verified"] = True
    elif payload.status == "rejected":
        updates["listing_active"] = False
        updates["verified"] = False
    res = await db.providers.find_one_and_update(
        {"id": provider_id}, {"$set": updates}, return_document=True, projection={"_id": 0}
    )
    if not res:
        raise HTTPException(404, "Provider not found")
    return res


@api.patch("/admin/providers/{provider_id}/listing-active")
async def admin_toggle_listing(
    provider_id: str, payload: ListingToggle, _: dict = Depends(require_admin)
):
    res = await db.providers.find_one_and_update(
        {"id": provider_id},
        {"$set": {"listing_active": payload.listing_active}},
        return_document=True, projection={"_id": 0},
    )
    if not res:
        raise HTTPException(404, "Provider not found")
    return res


@api.get("/admin/revenue")
async def admin_revenue(
    window: Literal["daily", "weekly"] = "weekly", _: dict = Depends(require_admin),
):
    bookings = await db.bookings.find({}, {"_id": 0}).to_list(5000)
    completed = [b for b in bookings if b["status"] == "completed"]
    total_gmv = sum(int(b.get("gmv_cents", 0)) for b in completed)
    total_fee = sum(int(b.get("platform_fee_cents", 0)) for b in completed)
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
        key = dt.date().isoformat() if window == "daily" else (dt.date() - timedelta(days=dt.weekday())).isoformat()
        if key in buckets:
            buckets[key]["gmv_cents"] += int(b.get("gmv_cents", 0))
            buckets[key]["platform_fee_cents"] += int(b.get("platform_fee_cents", 0))
            buckets[key]["count"] += 1
    return {
        "window": window,
        "totals": {
            "gmv_cents": total_gmv,
            "platform_fee_cents": total_fee,
            "completed_bookings": len(completed),
            "total_bookings": len(bookings),
            "requested_bookings": sum(1 for b in bookings if b["status"] == "requested"),
            "active_providers": await db.providers.count_documents({"status": "approved", "listing_active": True}),
            "pending_providers": await db.providers.count_documents({"status": "pending"}),
        },
        "series": [{"period": k, **v} for k, v in buckets.items()],
    }


# --- health -----------------------------------------------------------------
@api.get("/")
async def root(): return {"service": "foot-care-marketplace-os", "status": "ok"}


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origin_regex=".*",  # reflected origin — needed for cookies across preview
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _startup():
    init_storage()
    if await db.providers.count_documents({}) == 0:
        from seed import seed_all
        await seed_all(db)
        logger.info("Seeded marketplace data")


@app.on_event("shutdown")
async def _shutdown():
    mongo_client.close()
