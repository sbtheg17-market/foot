"""Curated seed data for the Foot-Care Marketplace OS.

Handoff intent: preserve behavior of the original repo's marketplace.ts —
three signature providers (Maya, Jordan, Alex) with realistic pricing,
availability, travel zones, plan tiers, and a mix of booking states so
providers see meaningful earnings and admins have a queue to work.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any


DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def _dollars(x: float) -> int:
    return int(round(x * 100))


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)


PROVIDERS: list[dict[str, Any]] = [
    {
        "id": "prov_maya",
        "name": "Maya Okonkwo",
        "bio": "Certified reflexologist bringing calm, senior-friendly foot care to your living room. 12+ years serving the Bay Area.",
        "city": "San Francisco",
        "categories": ["reflexology", "wellness", "senior-care"],
        "senior_friendly": True,
        "verified": True,
        "rating": 4.9,
        "reviews_count": 128,
        "status": "approved",
        "listing_active": True,
        "avatar_url": "https://images.unsplash.com/photo-1594743795047-2ecc81153a5c?crop=entropy&cs=srgb&fm=jpg&q=85&w=400",
        "cover_url": "https://images.unsplash.com/photo-1567016376408-0226e4d0c1ea?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
        "documents": ["https://example.com/docs/maya-cert.pdf", "https://example.com/docs/maya-insurance.pdf"],
        "plan": "premium",
        "commission_rate": 0.12,
        "weekly_hours": {
            "mon": [9, 17],
            "tue": [9, 17],
            "wed": [9, 17],
            "thu": [9, 19],
            "fri": [9, 19],
            "sat": [10, 15],
            "sun": [],
        },
        "blocked_dates": [],
        "minimum_lead_hours": 4,
        "travel_zone": {"base_city": "San Francisco", "radius_km": 20},
    },
    {
        "id": "prov_jordan",
        "name": "Jordan Reyes",
        "bio": "Mobile pedicure specialist. Sterile tools, plant-based products, and a spa-grade experience at your door.",
        "city": "Oakland",
        "categories": ["pedicure", "spa", "wellness"],
        "senior_friendly": False,
        "verified": True,
        "rating": 4.7,
        "reviews_count": 74,
        "status": "approved",
        "listing_active": True,
        "avatar_url": "https://images.unsplash.com/photo-1592621385612-4d7129426394?crop=entropy&cs=srgb&fm=jpg&q=85&w=400",
        "cover_url": "https://images.pexels.com/photos/34930123/pexels-photo-34930123.jpeg?auto=compress&cs=tinysrgb&w=1200",
        "documents": ["https://example.com/docs/jordan-license.pdf"],
        "plan": "pro",
        "commission_rate": 0.15,
        "weekly_hours": {
            "mon": [],
            "tue": [11, 19],
            "wed": [11, 19],
            "thu": [11, 19],
            "fri": [11, 20],
            "sat": [10, 18],
            "sun": [10, 16],
        },
        "blocked_dates": [],
        "minimum_lead_hours": 6,
        "travel_zone": {"base_city": "Oakland", "radius_km": 15},
    },
    {
        "id": "prov_alex",
        "name": "Alex Novak",
        "bio": "Restorative foot therapy for aging clients. Gentle massage, circulation support, and warm compress rituals.",
        "city": "Berkeley",
        "categories": ["massage", "senior-care", "wellness"],
        "senior_friendly": True,
        "verified": True,
        "rating": 4.8,
        "reviews_count": 51,
        "status": "approved",
        "listing_active": True,
        "avatar_url": "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?crop=entropy&cs=srgb&fm=jpg&q=85&w=400",
        "cover_url": "https://images.unsplash.com/photo-1741522509407-41cfe73b0b75?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
        "documents": [
            "https://example.com/docs/alex-cert.pdf",
            "https://example.com/docs/alex-cpr.pdf",
            "https://example.com/docs/alex-bg.pdf",
        ],
        "plan": "free",
        "commission_rate": 0.18,
        "weekly_hours": {
            "mon": [10, 16],
            "tue": [10, 16],
            "wed": [],
            "thu": [10, 16],
            "fri": [10, 16],
            "sat": [],
            "sun": [],
        },
        "blocked_dates": [],
        "minimum_lead_hours": 12,
        "travel_zone": {"base_city": "Berkeley", "radius_km": 10},
    },
    # Admin queue candidates
    {
        "id": "prov_sana",
        "name": "Sana Petrova",
        "bio": "Independent nail artist expanding into home visits. Bringing a boutique salon feel to your home.",
        "city": "San Francisco",
        "categories": ["pedicure", "spa"],
        "senior_friendly": False,
        "verified": False,
        "rating": 0,
        "reviews_count": 0,
        "status": "pending",
        "listing_active": False,
        "avatar_url": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?crop=entropy&cs=srgb&fm=jpg&q=85&w=400",
        "cover_url": "https://images.unsplash.com/photo-1600334129128-685c5582fd35?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
        "documents": ["https://example.com/docs/sana-portfolio.pdf", "https://example.com/docs/sana-id.pdf"],
        "plan": "free",
        "commission_rate": 0.18,
        "weekly_hours": {"mon": [10, 18], "tue": [10, 18], "wed": [10, 18], "thu": [10, 18], "fri": [10, 18], "sat": [], "sun": []},
        "blocked_dates": [],
        "minimum_lead_hours": 6,
        "travel_zone": {"base_city": "San Francisco", "radius_km": 12},
    },
    {
        "id": "prov_tomas",
        "name": "Tomás Beltrán",
        "bio": "Physiotherapy background — targeted foot & ankle work for active seniors and post-surgery clients.",
        "city": "San Jose",
        "categories": ["massage", "senior-care", "recovery"],
        "senior_friendly": True,
        "verified": False,
        "rating": 0,
        "reviews_count": 0,
        "status": "pending",
        "listing_active": False,
        "avatar_url": "https://images.unsplash.com/photo-1607746882042-944635dfe10e?crop=entropy&cs=srgb&fm=jpg&q=85&w=400",
        "cover_url": "https://images.unsplash.com/photo-1540555700478-4be289fbecef?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
        "documents": ["https://example.com/docs/tomas-license.pdf"],
        "plan": "free",
        "commission_rate": 0.18,
        "weekly_hours": {"mon": [9, 17], "tue": [9, 17], "wed": [9, 17], "thu": [9, 17], "fri": [9, 17], "sat": [], "sun": []},
        "blocked_dates": [],
        "minimum_lead_hours": 8,
        "travel_zone": {"base_city": "San Jose", "radius_km": 18},
    },
]


SERVICES: list[dict[str, Any]] = [
    # Maya
    {"id": "svc_maya_reflex", "provider_id": "prov_maya", "title": "Reflexology Deep Session", "description": "60-minute reflexology focused on pressure points and circulation.", "duration_min": 60, "price_cents": _dollars(120), "category": "reflexology"},
    {"id": "svc_maya_senior", "provider_id": "prov_maya", "title": "Senior Comfort Visit", "description": "Gentle 45-minute foot care designed for aging feet.", "duration_min": 45, "price_cents": _dollars(85), "category": "senior-care"},
    {"id": "svc_maya_signature", "provider_id": "prov_maya", "title": "Signature Foot Ritual", "description": "90-minute premium experience with warm compress and aroma.", "duration_min": 90, "price_cents": _dollars(180), "category": "wellness"},
    # Jordan
    {"id": "svc_jordan_ped", "provider_id": "prov_jordan", "title": "Mobile Spa Pedicure", "description": "Full pedicure with sterile tools and plant-based polish.", "duration_min": 60, "price_cents": _dollars(95), "category": "pedicure"},
    {"id": "svc_jordan_quick", "provider_id": "prov_jordan", "title": "Express Nail Refresh", "description": "30-minute polish + light shaping.", "duration_min": 30, "price_cents": _dollars(55), "category": "pedicure"},
    # Alex
    {"id": "svc_alex_restor", "provider_id": "prov_alex", "title": "Restorative Foot Care", "description": "60-minute gentle massage and circulation support.", "duration_min": 60, "price_cents": _dollars(95), "category": "massage"},
    {"id": "svc_alex_home", "provider_id": "prov_alex", "title": "Home Wellness Visit", "description": "45-minute massage tailored for mobility-limited clients.", "duration_min": 45, "price_cents": _dollars(75), "category": "senior-care"},
]


def _make_booking(
    *,
    client_name: str,
    client_email: str,
    provider_id: str,
    service_id: str,
    price_cents: int,
    commission_rate: float,
    start_offset_days: int,
    hour: int,
    status: str,
) -> dict[str, Any]:
    start = _now().replace(hour=hour) + timedelta(days=start_offset_days)
    platform_fee = round(price_cents * commission_rate)
    return {
        "id": f"bk_{provider_id}_{start_offset_days:+d}_{hour}",
        "client_name": client_name,
        "client_email": client_email,
        "provider_id": provider_id,
        "service_id": service_id,
        "start_time": _iso(start),
        "status": status,
        "notes": "",
        "gmv_cents": price_cents,
        "commission_rate": commission_rate,
        "platform_fee_cents": platform_fee,
        "provider_net_cents": price_cents - platform_fee,
        "created_at": _iso(_now() - timedelta(days=max(1, abs(start_offset_days)))),
    }


BOOKINGS: list[dict[str, Any]] = [
    # Maya — completed + upcoming + requested
    _make_booking(client_name="Priya Shah", client_email="priya@example.com", provider_id="prov_maya", service_id="svc_maya_reflex", price_cents=_dollars(120), commission_rate=0.12, start_offset_days=-9, hour=11, status="completed"),
    _make_booking(client_name="Ellen Wu", client_email="ellen@example.com", provider_id="prov_maya", service_id="svc_maya_senior", price_cents=_dollars(85), commission_rate=0.12, start_offset_days=-4, hour=14, status="completed"),
    _make_booking(client_name="Marcus Fields", client_email="marcus@example.com", provider_id="prov_maya", service_id="svc_maya_signature", price_cents=_dollars(180), commission_rate=0.12, start_offset_days=-2, hour=10, status="completed"),
    _make_booking(client_name="Rosa Vega", client_email="rosa@example.com", provider_id="prov_maya", service_id="svc_maya_reflex", price_cents=_dollars(120), commission_rate=0.12, start_offset_days=3, hour=15, status="accepted"),
    _make_booking(client_name="Amit Rao", client_email="amit@example.com", provider_id="prov_maya", service_id="svc_maya_senior", price_cents=_dollars(85), commission_rate=0.12, start_offset_days=5, hour=13, status="requested"),
    # Jordan
    _make_booking(client_name="Hana Kim", client_email="hana@example.com", provider_id="prov_jordan", service_id="svc_jordan_ped", price_cents=_dollars(95), commission_rate=0.15, start_offset_days=-6, hour=12, status="completed"),
    _make_booking(client_name="Luca Bianchi", client_email="luca@example.com", provider_id="prov_jordan", service_id="svc_jordan_quick", price_cents=_dollars(55), commission_rate=0.15, start_offset_days=-1, hour=13, status="completed"),
    _make_booking(client_name="Nadia Farah", client_email="nadia@example.com", provider_id="prov_jordan", service_id="svc_jordan_ped", price_cents=_dollars(95), commission_rate=0.15, start_offset_days=4, hour=16, status="requested"),
    # Alex
    _make_booking(client_name="Ellen Wu", client_email="ellen@example.com", provider_id="prov_alex", service_id="svc_alex_restor", price_cents=_dollars(95), commission_rate=0.18, start_offset_days=-10, hour=11, status="completed"),
    _make_booking(client_name="Mira Patel", client_email="mira@example.com", provider_id="prov_alex", service_id="svc_alex_home", price_cents=_dollars(75), commission_rate=0.18, start_offset_days=6, hour=10, status="requested"),
]


async def seed_all(db) -> None:
    await db.providers.delete_many({})
    await db.services.delete_many({})
    await db.bookings.delete_many({})
    if PROVIDERS:
        await db.providers.insert_many([{**p} for p in PROVIDERS])
    if SERVICES:
        await db.services.insert_many([{**s} for s in SERVICES])
    if BOOKINGS:
        await db.bookings.insert_many([{**b} for b in BOOKINGS])
