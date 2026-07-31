"""Provider dashboard summary composer: profile completion + verification hint."""
from bson import ObjectId

from app.services import availability_service, catalog_service

from app.core.constants import DEFAULT_CURRENCY


# Ordered so the checklist shows the natural progression the provider follows.
_COMPLETION_STEPS = [
    ("photo", "Add a profile photo", "/provider/profile"),
    ("bio", "Write a short bio", "/provider/profile"),
    ("certifications", "Add a certification", "/provider/profile"),
    ("service", "Publish a service", "/provider/services"),
    ("availability", "Set weekly availability", "/provider/availability"),
    ("travel", "Choose a travel zone", "/provider/availability"),
]


def _step_complete(key: str, user: dict, active_services: int, has_availability: bool, has_travel: bool) -> bool:
    if key == "photo":
        return bool(user.get("photo"))
    if key == "bio":
        return bool((user.get("bio") or "").strip())
    if key == "certifications":
        return len(user.get("certifications") or []) > 0
    if key == "service":
        return active_services > 0
    if key == "availability":
        return has_availability
    if key == "travel":
        return has_travel
    return False


async def build_provider_summary(user: dict) -> dict:
    provider_id: ObjectId = user["_id"]
    active_services = await catalog_service.count_active(provider_id)
    availability = await availability_service.get_availability(provider_id)
    has_availability = availability_service.has_weekly_slots(availability)
    has_travel = availability_service.has_travel_zone(availability)

    done = 0
    missing: list[dict] = []
    for key, label, route in _COMPLETION_STEPS:
        if _step_complete(key, user, active_services, has_availability, has_travel):
            done += 1
        else:
            missing.append({"key": key, "label": label, "route": route})

    total = len(_COMPLETION_STEPS)
    percent = int(round(done / total * 100))

    return {
        "active_services": active_services,
        "upcoming_bookings": 0,
        "earnings_week_cents": 0,
        "currency": DEFAULT_CURRENCY,
        "verification_status": user.get("verification_status") or "draft",
        "has_availability": has_availability,
        "has_travel_zone": has_travel,
        "profile_completion": {
            "percent": percent,
            "done": done,
            "total": total,
            "missing": missing,
        },
    }
