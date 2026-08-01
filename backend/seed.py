"""Curated seed data — providers, services, bookings, and search-demand signals.

Includes seeded owner_emails so a demo user can log in as a provider (e.g.
maya@solecare.demo). Also seeds `search_events` so provider opportunity cards
have meaningful data on day one.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def _dollars(x: float) -> int: return int(round(x * 100))
def _iso(dt: datetime) -> str: return dt.astimezone(timezone.utc).isoformat()
def _now() -> datetime: return datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)


PROVIDERS: list[dict[str, Any]] = [
    {
        "id": "prov_maya", "name": "Maya Okonkwo",
        "bio": "Certified reflexologist bringing calm, senior-friendly foot care to your living room. 12+ years serving the Bay Area.",
        "city": "San Francisco", "categories": ["reflexology", "wellness", "senior-care"],
        "senior_friendly": True, "verified": True, "rating": 4.9, "reviews_count": 128,
        "status": "approved", "listing_active": True,
        "avatar_url": "https://images.unsplash.com/photo-1594743795047-2ecc81153a5c?crop=entropy&cs=srgb&fm=jpg&q=85&w=400",
        "cover_url": "https://images.unsplash.com/photo-1567016376408-0226e4d0c1ea?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
        "documents": ["https://example.com/docs/maya-cert.pdf", "https://example.com/docs/maya-insurance.pdf"],
        "plan": "premium", "commission_rate": 0.12,
        "weekly_hours": {"mon": [9, 17], "tue": [9, 17], "wed": [9, 17], "thu": [9, 19], "fri": [9, 19], "sat": [10, 15], "sun": []},
        "blocked_dates": [], "minimum_lead_hours": 4,
        "travel_zone": {"base_city": "San Francisco", "radius_km": 20},
        "owner_email": "maya@solecare.demo",
    },
    {
        "id": "prov_jordan", "name": "Jordan Reyes",
        "bio": "Mobile pedicure specialist. Sterile tools, plant-based products, and a spa-grade experience at your door.",
        "city": "Oakland", "categories": ["pedicure", "spa", "wellness"],
        "senior_friendly": False, "verified": True, "rating": 4.7, "reviews_count": 74,
        "status": "approved", "listing_active": True,
        "avatar_url": "https://images.unsplash.com/photo-1592621385612-4d7129426394?crop=entropy&cs=srgb&fm=jpg&q=85&w=400",
        "cover_url": "https://images.pexels.com/photos/34930123/pexels-photo-34930123.jpeg?auto=compress&cs=tinysrgb&w=1200",
        "documents": ["https://example.com/docs/jordan-license.pdf"],
        "plan": "pro", "commission_rate": 0.15,
        "weekly_hours": {"mon": [], "tue": [11, 19], "wed": [11, 19], "thu": [11, 19], "fri": [11, 20], "sat": [10, 18], "sun": [10, 16]},
        "blocked_dates": [], "minimum_lead_hours": 6,
        "travel_zone": {"base_city": "Oakland", "radius_km": 15},
        "owner_email": "jordan@solecare.demo",
    },
    {
        "id": "prov_alex", "name": "Alex Novak",
        "bio": "Restorative foot therapy for aging clients. Gentle massage, circulation support, and warm compress rituals.",
        "city": "Berkeley", "categories": ["massage", "senior-care", "wellness"],
        "senior_friendly": True, "verified": True, "rating": 4.8, "reviews_count": 51,
        "status": "approved", "listing_active": True,
        "avatar_url": "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?crop=entropy&cs=srgb&fm=jpg&q=85&w=400",
        "cover_url": "https://images.unsplash.com/photo-1741522509407-41cfe73b0b75?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
        "documents": ["https://example.com/docs/alex-cert.pdf", "https://example.com/docs/alex-cpr.pdf", "https://example.com/docs/alex-bg.pdf"],
        "plan": "free", "commission_rate": 0.18,
        "weekly_hours": {"mon": [10, 16], "tue": [10, 16], "wed": [], "thu": [10, 16], "fri": [10, 16], "sat": [], "sun": []},
        "blocked_dates": [], "minimum_lead_hours": 12,
        "travel_zone": {"base_city": "Berkeley", "radius_km": 10},
        "owner_email": "alex@solecare.demo",
    },
    {
        "id": "prov_sana", "name": "Sana Petrova",
        "bio": "Independent nail artist expanding into home visits. Bringing a boutique salon feel to your home.",
        "city": "San Francisco", "categories": ["pedicure", "spa"],
        "senior_friendly": False, "verified": False, "rating": 0, "reviews_count": 0,
        "status": "pending", "listing_active": False,
        "avatar_url": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?crop=entropy&cs=srgb&fm=jpg&q=85&w=400",
        "cover_url": "https://images.unsplash.com/photo-1600334129128-685c5582fd35?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
        "documents": ["https://example.com/docs/sana-portfolio.pdf", "https://example.com/docs/sana-id.pdf"],
        "plan": "free", "commission_rate": 0.18,
        "weekly_hours": {"mon": [10, 18], "tue": [10, 18], "wed": [10, 18], "thu": [10, 18], "fri": [10, 18], "sat": [], "sun": []},
        "blocked_dates": [], "minimum_lead_hours": 6,
        "travel_zone": {"base_city": "San Francisco", "radius_km": 12},
        "owner_email": "sana@solecare.demo",
    },
    {
        "id": "prov_tomas", "name": "Tomás Beltrán",
        "bio": "Physiotherapy background — targeted foot & ankle work for active seniors and post-surgery clients.",
        "city": "San Jose", "categories": ["massage", "senior-care", "recovery"],
        "senior_friendly": True, "verified": False, "rating": 0, "reviews_count": 0,
        "status": "pending", "listing_active": False,
        "avatar_url": "https://images.unsplash.com/photo-1607746882042-944635dfe10e?crop=entropy&cs=srgb&fm=jpg&q=85&w=400",
        "cover_url": "https://images.unsplash.com/photo-1540555700478-4be289fbecef?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
        "documents": ["https://example.com/docs/tomas-license.pdf"],
        "plan": "free", "commission_rate": 0.18,
        "weekly_hours": {"mon": [9, 17], "tue": [9, 17], "wed": [9, 17], "thu": [9, 17], "fri": [9, 17], "sat": [], "sun": []},
        "blocked_dates": [], "minimum_lead_hours": 8,
        "travel_zone": {"base_city": "San Jose", "radius_km": 18},
        "owner_email": "tomas@solecare.demo",
    },
]


SERVICES: list[dict[str, Any]] = [
    {"id": "svc_maya_reflex", "provider_id": "prov_maya", "title": "Reflexology Deep Session", "description": "60-minute reflexology focused on pressure points and circulation.", "duration_min": 60, "price_cents": _dollars(120), "category": "reflexology"},
    {"id": "svc_maya_senior", "provider_id": "prov_maya", "title": "Senior Comfort Visit", "description": "Gentle 45-minute foot care designed for aging feet.", "duration_min": 45, "price_cents": _dollars(85), "category": "senior-care"},
    {"id": "svc_maya_signature", "provider_id": "prov_maya", "title": "Signature Foot Ritual", "description": "90-minute premium experience with warm compress and aroma.", "duration_min": 90, "price_cents": _dollars(180), "category": "wellness"},
    {"id": "svc_jordan_ped", "provider_id": "prov_jordan", "title": "Mobile Spa Pedicure", "description": "Full pedicure with sterile tools and plant-based polish.", "duration_min": 60, "price_cents": _dollars(95), "category": "pedicure"},
    {"id": "svc_jordan_quick", "provider_id": "prov_jordan", "title": "Express Nail Refresh", "description": "30-minute polish + light shaping.", "duration_min": 30, "price_cents": _dollars(55), "category": "pedicure"},
    {"id": "svc_alex_restor", "provider_id": "prov_alex", "title": "Restorative Foot Care", "description": "60-minute gentle massage and circulation support.", "duration_min": 60, "price_cents": _dollars(95), "category": "massage"},
    {"id": "svc_alex_home", "provider_id": "prov_alex", "title": "Home Wellness Visit", "description": "45-minute massage tailored for mobility-limited clients.", "duration_min": 60, "price_cents": _dollars(75), "category": "senior-care"},
]


def _mk(client_name, client_email, provider_id, service_id, price_cents, rate, days, hour, status, phone=""):
    start = _now().replace(hour=hour) + timedelta(days=days)
    fee = round(price_cents * rate)
    return {
        "id": f"bk_{provider_id}_{days:+d}_{hour}",
        "client_name": client_name, "client_email": client_email, "client_phone": phone,
        "client_user_id": None,
        "provider_id": provider_id, "service_id": service_id,
        "start_time": _iso(start), "status": status, "notes": "",
        "gmv_cents": price_cents, "commission_rate": rate,
        "platform_fee_cents": fee, "provider_net_cents": price_cents - fee,
        "payment_status": "paid" if status in ("accepted", "completed") else "pending",
        "stripe_session_id": None,
        "created_at": _iso(_now() - timedelta(days=max(1, abs(days)))),
    }


BOOKINGS: list[dict[str, Any]] = [
    _mk("Priya Shah", "priya@example.com", "prov_maya", "svc_maya_reflex", _dollars(120), 0.12, -9, 11, "completed"),
    _mk("Ellen Wu", "ellen@example.com", "prov_maya", "svc_maya_senior", _dollars(85), 0.12, -4, 14, "completed"),
    _mk("Marcus Fields", "marcus@example.com", "prov_maya", "svc_maya_signature", _dollars(180), 0.12, -2, 18, "completed"),  # evening
    _mk("Rosa Vega", "rosa@example.com", "prov_maya", "svc_maya_reflex", _dollars(120), 0.12, 3, 15, "accepted"),
    _mk("Amit Rao", "amit@example.com", "prov_maya", "svc_maya_senior", _dollars(85), 0.12, 5, 13, "requested"),
    _mk("Hana Kim", "hana@example.com", "prov_jordan", "svc_jordan_ped", _dollars(95), 0.15, -6, 19, "completed"),   # evening
    _mk("Luca Bianchi", "luca@example.com", "prov_jordan", "svc_jordan_quick", _dollars(55), 0.15, -5, 12, "completed"),  # sat/sun likely
    _mk("Nadia Farah", "nadia@example.com", "prov_jordan", "svc_jordan_ped", _dollars(95), 0.15, 4, 16, "requested"),
    _mk("Ellen Wu", "ellen@example.com", "prov_alex", "svc_alex_restor", _dollars(95), 0.18, -10, 11, "completed"),
    _mk("Mira Patel", "mira@example.com", "prov_alex", "svc_alex_home", _dollars(75), 0.18, 6, 10, "requested"),
    _mk("Devon Lee", "devon@example.com", "prov_alex", "svc_alex_restor", _dollars(95), 0.18, -3, 18, "completed"),  # evening — Alex has no evening slots
    _mk("Priya Shah", "priya@example.com", "prov_alex", "svc_alex_home", _dollars(75), 0.18, -8, 11, "completed"),  # sat/sun
]


def _search(days_ago: int, **kw):
    return {**kw, "created_at": _iso(_now() - timedelta(days=days_ago, hours=3))}


# Seeded search demand — used by opportunities engine
SEARCH_EVENTS = [
    _search(1, city="Berkeley", category="massage", senior_friendly=True, verified=True),
    _search(1, city="Berkeley", category="senior-care", senior_friendly=True, verified=True),
    _search(2, city="Berkeley", category="pedicure", senior_friendly=False, verified=False),
    _search(2, city="Berkeley", category="pedicure", senior_friendly=False, verified=True),
    _search(3, city="Berkeley", category="pedicure", senior_friendly=False, verified=False),
    _search(3, city="Berkeley", category="massage", senior_friendly=True, verified=True),
    _search(1, city="San Francisco", category="reflexology", senior_friendly=True, verified=True),
    _search(2, city="San Francisco", category="reflexology", senior_friendly=False, verified=True),
    _search(2, city="San Francisco", category="senior-care", senior_friendly=True, verified=True),
    _search(4, city="Oakland", category="senior-care", senior_friendly=True, verified=True),
    _search(4, city="Oakland", category="senior-care", senior_friendly=True, verified=False),
    _search(5, city="Oakland", category="massage", senior_friendly=False, verified=True),
    _search(6, city="Oakland", category="pedicure", senior_friendly=False, verified=True),
]


async def seed_all(db) -> None:
    await db.providers.delete_many({})
    await db.services.delete_many({})
    await db.bookings.delete_many({})
    await db.search_events.delete_many({})
    if PROVIDERS: await db.providers.insert_many([{**p} for p in PROVIDERS])
    if SERVICES: await db.services.insert_many([{**s} for s in SERVICES])
    if BOOKINGS: await db.bookings.insert_many([{**b} for b in BOOKINGS])
    if SEARCH_EVENTS: await db.search_events.insert_many([{**s} for s in SEARCH_EVENTS])
