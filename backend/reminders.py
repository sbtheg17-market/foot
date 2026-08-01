"""Reminder job — sends 24h-before reminders to clients (email + SMS) for accepted+paid bookings."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from emails import reminder_html, send_email
from sms import booking_reminder_message, send_sms

logger = logging.getLogger("footcare.reminders")


async def process_reminders(db) -> dict:
    """Find bookings starting in ~24h that haven't been reminded yet, and notify."""
    now = datetime.now(timezone.utc)
    window_start = now + timedelta(hours=20)
    window_end = now + timedelta(hours=28)

    bookings = await db.bookings.find(
        {
            "status": "accepted",
            "payment_status": "paid",
            "reminder_sent_at": {"$exists": False},
        },
        {"_id": 0},
    ).to_list(500)

    sent = 0
    skipped = 0
    for b in bookings:
        try:
            start = datetime.fromisoformat(b["start_time"])
            if start.tzinfo is None:
                start = start.replace(tzinfo=timezone.utc)
        except Exception:
            skipped += 1
            continue
        if not (window_start <= start <= window_end):
            continue

        provider = await db.providers.find_one({"id": b["provider_id"]}, {"_id": 0})
        service = await db.services.find_one({"id": b["service_id"]}, {"_id": 0})
        if not provider or not service:
            skipped += 1
            continue

        # Email
        await send_email(
            to=b["client_email"],
            subject=f"Reminder: {service['title']} tomorrow with {provider['name']}",
            html=reminder_html(
                b["client_name"], provider["name"], service["title"], b["start_time"], provider["city"],
            ),
        )
        # SMS (respects SMS_MODE)
        await send_sms(
            db,
            to=b.get("client_phone"),
            body=booking_reminder_message(
                b["client_name"], provider["name"], service["title"], b["start_time"],
            ),
            kind="booking_reminder",
            booking_id=b["id"],
        )
        await db.bookings.update_one(
            {"id": b["id"]},
            {"$set": {"reminder_sent_at": now.isoformat()}},
        )
        sent += 1

    return {"sent": sent, "skipped": skipped, "candidates": len(bookings)}
