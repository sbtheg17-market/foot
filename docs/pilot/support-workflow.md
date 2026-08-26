# Support workflow — Southern Ontario pilot

**Date:** 2026-08-26 · **Status: implemented and tested** (contact path live,
escalation drill performed). The #13 support system (escalations, admin
mediation/correction/suspension) is the machinery; this document is the
operational path around it for the pilot.

## Contact path (env-configured, placeholder fallback)

Resolution order (server-authoritative, `GET /api/support/contact`,
`artifacts/api-server/src/lib/support-contact.ts`):

1. `SUPPORT_CONTACT_URL` — full http(s) link (form/help desk). Wins if set.
2. `SUPPORT_CONTACT_EMAIL` — rendered as `mailto:`.
3. Neither set → **pilot placeholder `support@foot.app`**, flagged
   `isPlaceholder: true` so an unconfigured deploy is visible.

Invalid values **throw** (`InvalidSupportContactError`) — never a silent
fallback (same posture as `CANCELLATION_NOTICE_HOURS`).

Surfaces (both verified in the real-browser smoke test):

- Public booking page footer — `data-testid="public-booking-support-link"`.
- Provider portal footer (every portal page) — `data-testid="provider-portal-support-link"`.

**Operator action before day 1:** set `SUPPORT_CONTACT_EMAIL` to the real
pilot inbox. Live-verified during the rotation drill: with
`SUPPORT_CONTACT_EMAIL=pilot-support@example.com` the endpoint returned that
address with `isPlaceholder: false`.

## SLA and ownership (pilot)

| Item | Value |
|---|---|
| Response time SLA | **24 hours** (business days), best-effort same-day during weeks 2–4 |
| Escalation owner | **Repository operator** (pilot runner) — single owner for disputes, corrections, suspensions |
| Tooling | Support email inbox + the support-role API (below). No dashboard UI (by design, #13) |

## How providers contact support

1. Tap **"Need help?"** in the portal footer (any portal page) → email opens.
2. For a specific finished booking, open it and use the escalation path —
   or include the booking number in the email.
3. Expect a reply within 24 hours.

## How clients contact support

1. Tap **"Need help?"** in the booking page footer → email opens.
2. For a completed/cancelled/no-show booking: open **My bookings → the
   booking → "Ask for help with this booking"** — this files a structured
   escalation tied to the booking (idempotent; re-taps never duplicate).

## Escalation handling (operator runbook)

```bash
# 1. Sign in as the support/admin account, note the booking id from the email/ticket.
TOKEN=$(curl -s -X POST $BASE/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"<admin>","password":"<password>"}' | jq -r .token)

# 2. Full picture: tickets + append-only outcome history (audit-logged).
curl -s $BASE/api/support/bookings/<bookingId>/escalations -H "Authorization: Bearer $TOKEN"

# 3. Work it: status, mediation note, optional outcome correction, optional suspension.
curl -s -X PATCH $BASE/api/support/escalations/<ticketId> \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"status":"in_progress","resolutionNote":"Called both parties …"}'

# 4. Resolve.
curl -s -X PATCH $BASE/api/support/escalations/<ticketId> \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"status":"resolved","resolutionNote":"Outcome: …"}'
```

Corrections (`{"correction":{"status":"completed","reason":"…"}}`) apply only
to disputed cancelled/no-show outcomes and append a `support_corrected`
history row — the original outcome is never erased. Suspension
(`{"suspendUserId":N}`) uses the existing `users.is_active` mechanism and only
for a party to the linked booking. Privacy rules from #13 hold: free-text
reasons and actor ids stay support/admin-only.

## Test evidence — 2026-08-26

- Client escalated a no-show booking from the booking-detail UI → ticket #1
  created (`open`), linked to the booking.
- Admin retrieved it via `GET /api/support/bookings/:id/escalations` with the
  full outcome history (access audit-logged).
- Contact endpoint verified in placeholder mode AND with a live
  `SUPPORT_CONTACT_EMAIL` override.
- Escalation lifecycle (open → in_progress → resolved, correction,
  suspension) remains covered by the 22-test `test:cancellation` CI suite.

## Deferred (unchanged)

Escalation email/push notifications to support (inbox signal), SLAs/queues/
assignment tooling, dedicated support dashboard UI.
