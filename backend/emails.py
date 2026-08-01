"""Resend-powered transactional emails via Emergent managed integration."""
from __future__ import annotations

import logging
import os
from datetime import datetime
from typing import Optional

import httpx

logger = logging.getLogger("footcare.email")

# Hardcoded constant — never move to env (playbook contract).
EMAIL_BASE_URL = "https://integrations.emergentagent.com"


def _key() -> Optional[str]:
    return os.environ.get("EMERGENT_EMAIL_KEY")


def _from_name() -> str:
    return os.environ.get("EMAIL_FROM_NAME", "SoleCare")


async def send_email(*, to: str, subject: str, html: str, reply_to: Optional[str] = None) -> dict:
    key = _key()
    if not key or not to:
        logger.info(f"[EMAIL SKIP] to={to} subject={subject!r}")
        return {"status": "skipped"}
    payload = {"to": [to], "subject": subject, "html": html, "from_name": _from_name()}
    if reply_to:
        payload["contact_email"] = reply_to
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": key},
                json=payload,
            )
        resp.raise_for_status()
        data = resp.json() if resp.content else {}
        return {"status": "sent", "id": data.get("id")}
    except httpx.HTTPStatusError as e:
        logger.error(f"Email send failed: {e.response.status_code} {e.response.text}")
        return {"status": "failed", "code": e.response.status_code}
    except Exception as e:  # noqa: BLE001
        logger.error(f"Email send error: {e}")
        return {"status": "failed"}


def _fmt_when(iso: str) -> str:
    return datetime.fromisoformat(iso).strftime("%A %B %d, %Y at %I:%M %p")


def reminder_html(client_name: str, provider_name: str, service_title: str, start_iso: str, city: str) -> str:
    when = _fmt_when(start_iso)
    return f"""
<!doctype html>
<html><body style="font-family: -apple-system, Helvetica, Arial, sans-serif; background:#f9fbf9; margin:0; padding:32px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:20px;border:1px solid #e5eae4;padding:32px;">
        <tr><td>
          <div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#2C4C3B;font-weight:600;">Friendly reminder</div>
          <h1 style="font-family:'Outfit',sans-serif;font-size:24px;color:#111827;margin:8px 0 16px;">Your visit is tomorrow</h1>
          <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 16px;">Hi {client_name},</p>
          <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 20px;">
            This is a gentle reminder that your <strong>{service_title}</strong> with
            <strong>{provider_name}</strong> is scheduled for <strong>{when}</strong> in {city}.
          </p>
          <div style="background:#f2f5f0;border-radius:14px;padding:16px;font-size:14px;color:#111827;">
            <div><strong>Provider:</strong> {provider_name}</div>
            <div><strong>Service:</strong> {service_title}</div>
            <div><strong>When:</strong> {when}</div>
            <div><strong>Where:</strong> {city} (at your address)</div>
          </div>
          <p style="font-size:13px;color:#6b7280;margin:20px 0 0;">Need to reschedule? Just reply to this email and we'll help.</p>
        </td></tr>
      </table>
      <div style="font-size:12px;color:#9ca3af;margin-top:16px;">SoleCare · calm care at your door</div>
    </td></tr>
  </table>
</body></html>
""".strip()


def review_request_html(client_name: str, provider_name: str, review_url: str) -> str:
    return f"""
<!doctype html>
<html><body style="font-family: -apple-system, Helvetica, Arial, sans-serif;background:#f9fbf9;padding:32px 0;">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" align="center" style="background:#fff;border-radius:20px;border:1px solid #e5eae4;padding:32px;">
    <tr><td>
      <h1 style="font-family:'Outfit',sans-serif;font-size:22px;color:#111827;margin:0 0 12px;">How was your visit, {client_name}?</h1>
      <p style="font-size:15px;color:#374151;line-height:1.6;">
        We'd love to hear about your session with <strong>{provider_name}</strong>. A quick rating helps other clients find the right provider.
      </p>
      <a href="{review_url}" style="display:inline-block;margin-top:16px;background:#2C4C3B;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600;font-size:14px;">Leave a review</a>
    </td></tr>
  </table>
</body></html>
""".strip()
