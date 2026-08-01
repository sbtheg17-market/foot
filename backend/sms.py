"""Twilio SMS layer with env-driven toggle.

SMS_MODE=stub (default) — logs to backend + `sms_log` collection, no real send.
SMS_MODE=live           — uses Twilio SDK with TWILIO_ACCOUNT_SID/TOKEN/PHONE_NUMBER.

The interface (send_sms + message templates) is stable so switching modes
never touches the rest of the app.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger("footcare.sms")


def _mode() -> str:
    return os.environ.get("SMS_MODE", "stub").lower()


def _twilio_ready() -> bool:
    return all(os.environ.get(k) for k in ("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"))


async def send_sms(db, *, to: Optional[str], body: str, kind: str, booking_id: Optional[str] = None) -> dict:
    """Send SMS (real or stubbed) and record it to sms_log for auditability."""
    live = _mode() == "live" and _twilio_ready() and to
    provider_name = "twilio" if live else "stub"

    if live:
        try:
            from twilio.rest import Client  # noqa: WPS433

            Client(os.environ["TWILIO_ACCOUNT_SID"], os.environ["TWILIO_AUTH_TOKEN"]).messages.create(
                to=to,
                from_=os.environ["TWILIO_PHONE_NUMBER"],
                body=body,
            )
            status = "sent"
        except Exception as e:  # noqa: BLE001
            logger.error(f"Twilio send failed: {e}")
            status = "failed"
    else:
        logger.info(f"[SMS {_mode()}] to={to or 'n/a'} kind={kind} body={body!r}")
        status = "stubbed" if _mode() == "stub" else "skipped"

    await db.sms_log.insert_one({
        "to": to or "",
        "body": body,
        "kind": kind,
        "booking_id": booking_id,
        "status": status,
        "provider": provider_name,
        "mode": _mode(),
        "sent_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"status": status, "provider": provider_name, "mode": _mode()}


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


def booking_reminder_message(client_name: str, provider_name: str, service_title: str, start_iso: str) -> str:
    when = datetime.fromisoformat(start_iso).strftime("%A %b %d at %I:%M %p")
    return (
        f"Hi {client_name}, a friendly reminder that your {service_title} with "
        f"{provider_name} is {when}. Reply to reschedule."
    )
