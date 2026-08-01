"""Twilio SMS stub — logs to backend + DB. Swap `send_sms` internals to enable real Twilio later."""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger("footcare.sms")

TWILIO_SID = os.environ.get("TWILIO_ACCOUNT_SID")
TWILIO_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN")
TWILIO_FROM = os.environ.get("TWILIO_PHONE_NUMBER")


async def send_sms(db, *, to: Optional[str], body: str, kind: str, booking_id: Optional[str] = None) -> dict:
    """Send an SMS (or log a stub) and record it to `sms_log` for auditability."""
    live = bool(TWILIO_SID and TWILIO_TOKEN and TWILIO_FROM and to)
    provider_name = "twilio" if live else "stub"

    if live:
        # Real send — kept behind the same interface so the rest of the app doesn't change.
        try:
            from twilio.rest import Client  # noqa: WPS433

            Client(TWILIO_SID, TWILIO_TOKEN).messages.create(
                to=to, from_=TWILIO_FROM, body=body,
            )
            status = "sent"
        except Exception as e:  # noqa: BLE001
            logger.error(f"Twilio send failed: {e}")
            status = "failed"
    else:
        logger.info(f"[SMS STUB] to={to or 'n/a'} kind={kind} body={body!r}")
        status = "stubbed"

    entry = {
        "to": to or "",
        "body": body,
        "kind": kind,
        "booking_id": booking_id,
        "status": status,
        "provider": provider_name,
        "sent_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.sms_log.insert_one(entry)
    return {"status": status, "provider": provider_name}


def booking_accepted_message(client_name: str, provider_name: str, service_title: str, start_iso: str) -> str:
    when = datetime.fromisoformat(start_iso).strftime("%a %b %d, %I:%M %p")
    return (
        f"Hi {client_name}, {provider_name} accepted your SoleCare booking for "
        f"{service_title} on {when}. See you soon!"
    )


def booking_requested_message(client_name: str, provider_name: str, service_title: str) -> str:
    return (
        f"Hi {client_name}, we've sent your request for {service_title} to {provider_name}. "
        "You'll get a confirmation as soon as they accept."
    )
