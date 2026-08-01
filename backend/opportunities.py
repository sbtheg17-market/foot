"""Opportunity insights for the provider dashboard.

Computes actionable, honest recommendations from real search and booking data
so providers feel the OS is hunting for their next booking.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any


async def compute_opportunities(db, provider: dict) -> list[dict[str, Any]]:
    city = provider.get("city")
    categories = set(provider.get("categories", []))
    weekly = provider.get("weekly_hours", {}) or {}
    senior_friendly = provider.get("senior_friendly", False)
    verified = provider.get("verified", False)

    now = datetime.now(timezone.utc)
    since = (now - timedelta(days=14)).isoformat()

    searches = await db.search_events.find({"created_at": {"$gte": since}}, {"_id": 0}).to_list(2000)
    bookings = await db.bookings.find({}, {"_id": 0}).to_list(2000)

    def by_city(items, *, key: str = "city"):
        return [x for x in items if (x.get(key) or "").lower() == (city or "").lower()]

    local_searches = by_city(searches)
    ideas: list[dict[str, Any]] = []

    # 1. Category demand in your city
    cat_counter: dict[str, int] = {}
    for s in local_searches:
        c = s.get("category")
        if c:
            cat_counter[c] = cat_counter.get(c, 0) + 1
    for cat, n in sorted(cat_counter.items(), key=lambda kv: -kv[1])[:2]:
        already = cat in categories
        ideas.append({
            "id": f"cat-{cat}",
            "tone": "positive" if already else "info",
            "title": f"{n} clients in {city} searched for {cat.replace('-', ' ')}",
            "body": (
                f"You already offer {cat.replace('-', ' ')} — visibility is working for you."
                if already
                else f"Consider adding a {cat.replace('-', ' ')} service to catch this demand."
            ),
            "count": n,
        })

    # 2. Evening demand
    evening_bookings = [b for b in bookings if _hour(b.get("start_time")) is not None and _hour(b["start_time"]) >= 17]
    if bookings:
        pct = round(100 * len(evening_bookings) / max(1, len(bookings)))
        has_evenings = any(len(v) == 2 and int(v[1]) >= 19 for v in weekly.values())
        if pct >= 15 and not has_evenings:
            ideas.append({
                "id": "evening-demand",
                "tone": "warn",
                "title": f"{pct}% of local bookings are in the evening",
                "body": "You don't currently offer slots after 7pm. Adding one weekday evening could unlock these requests.",
                "count": pct,
            })

    # 3. Weekend demand
    weekend_bookings = [b for b in bookings if _weekday(b.get("start_time")) in (5, 6)]
    if bookings:
        pct = round(100 * len(weekend_bookings) / max(1, len(bookings)))
        has_weekend = bool(weekly.get("sat")) or bool(weekly.get("sun"))
        if pct >= 15 and not has_weekend:
            ideas.append({
                "id": "weekend-demand",
                "tone": "warn",
                "title": f"{pct}% of bookings happen on weekends",
                "body": "Your weekends are closed. A Saturday morning window is the easiest add.",
                "count": pct,
            })

    # 4. Senior-friendly interest
    senior_hits = sum(1 for s in local_searches if s.get("senior_friendly"))
    if senior_hits >= 2 and not senior_friendly:
        ideas.append({
            "id": "senior-friendly",
            "tone": "info",
            "title": f"{senior_hits} clients filtered for senior-friendly this week",
            "body": "Marking yourself senior-friendly (if you're comfortable serving older clients) surfaces you to this cohort.",
            "count": senior_hits,
        })

    # 5. Verified filter usage
    verified_hits = sum(1 for s in local_searches if s.get("verified"))
    if verified_hits >= 2 and not verified:
        ideas.append({
            "id": "verified",
            "tone": "warn",
            "title": f"{verified_hits} clients filtered for verified providers",
            "body": "Complete your verification with the admin team to appear in these searches.",
            "count": verified_hits,
        })

    if not ideas:
        ideas.append({
            "id": "steady",
            "tone": "positive",
            "title": "You're set up well",
            "body": "Your hours, services, and city coverage match what clients are searching for. Keep it up.",
            "count": 0,
        })
    return ideas


def _hour(iso: str | None) -> int | None:
    if not iso:
        return None
    try:
        return datetime.fromisoformat(iso).hour
    except Exception:
        return None


def _weekday(iso: str | None) -> int | None:
    if not iso:
        return None
    try:
        return datetime.fromisoformat(iso).weekday()
    except Exception:
        return None
