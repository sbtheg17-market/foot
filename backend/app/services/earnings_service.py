"""Earnings summary from completed bookings. Portable Python aggregation."""
from datetime import datetime, timedelta, timezone

from bson import ObjectId

from app.repositories import booking_repository


def _start_of_day_utc(d: datetime) -> datetime:
    return d.replace(hour=0, minute=0, second=0, microsecond=0)


async def _completed_since(provider_id: ObjectId, since: datetime) -> list[dict]:
    return await booking_repository.list_for_provider(
        provider_id,
        statuses=["completed"],
        scheduled_from=since.isoformat(),
        sort_asc=False,
    )


def _sum(bookings: list[dict]) -> tuple[int, int]:
    total = sum(int((b.get("service") or {}).get("price_cents", 0)) for b in bookings)
    return total, len(bookings)


async def get_summary(provider_id: ObjectId) -> dict:
    now = datetime.now(timezone.utc)
    today_start = _start_of_day_utc(now)
    week_start = today_start - timedelta(days=6)
    month_start = today_start - timedelta(days=29)

    # Pull once for the widest window, filter in Python (small dataset).
    month_bookings = await _completed_since(provider_id, month_start)

    def _in(bookings, start: datetime) -> list[dict]:
        return [b for b in bookings if datetime.fromisoformat(b["scheduled_at"]) >= start]

    today = _in(month_bookings, today_start)
    week = _in(month_bookings, week_start)
    month = month_bookings

    today_total, today_count = _sum(today)
    week_total, week_count = _sum(week)
    month_total, month_count = _sum(month)

    return {
        "currency": "USD",
        "today": {"total_cents": today_total, "count": today_count},
        "week": {"total_cents": week_total, "count": week_count},
        "month": {"total_cents": month_total, "count": month_count},
        "recent": [
            {
                "booking_id": str(b["_id"]),
                "client_name": (b.get("client") or {}).get("name", ""),
                "service_name": (b.get("service") or {}).get("name", ""),
                "price_cents": int((b.get("service") or {}).get("price_cents", 0)),
                "scheduled_at": b.get("scheduled_at"),
            }
            for b in month[:8]
        ],
    }


async def week_total_cents(provider_id: ObjectId) -> int:
    now = datetime.now(timezone.utc)
    week_start = _start_of_day_utc(now) - timedelta(days=6)
    bookings = await _completed_since(provider_id, week_start)
    total, _ = _sum(bookings)
    return total
