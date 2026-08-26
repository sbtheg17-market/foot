# Incident response runbook — Southern Ontario pilot

**Date:** 2026-08-26 · **Status: documented and reviewed.** Escalation owner
and single responder: **repository operator** (pilot runner).

## Severity levels

| Level | Definition | Examples | Response target |
|---|---|---|---|
| **P0** | Platform down or data at risk | API/web unreachable; database loss/corruption; suspected credential leak | Immediately; work continuously until mitigated |
| **P1** | Core pilot flow broken for everyone | Booking creation failing; booking pages 404 for all providers; sign-in broken | Within 4 h; fix or mitigate same day |
| **P2** | Degraded or single-party issue | One provider's page broken; reschedule/cancel errors for one booking; slow (but working) pages | Within 24 h (support SLA) |
| **P3** | Cosmetic / question / feature request | Layout glitch; copy issue; "how do I…" | Within 24 h reply; batch fixes |

## Response procedure

**P0**
1. Confirm scope: `curl -fsS $BASE/api/healthz`; open `/` and one `/book/:slug`.
2. Check platform status + service logs (`level:50` pino lines).
3. Restart the service if crashed; if data is implicated, **stop writes first**,
   then follow `docs/pilot/backup-restore-verification.md`.
4. Suspected secret leak → rotate immediately per
   `docs/pilot/secret-rotation-procedure.md`.
5. Notify all 5 providers (template below) within 30 min of confirming.
6. Post-incident review within 48 h (template below).

**P1**
1. Reproduce with the on-demand smoke: `pnpm run smoke:real-browser` against a
   local build at the failing SHA — it walks the whole pilot-critical flow.
2. Identify the breaking change (`git log` since last-known-good); fix through
   a scoped PR with green CI, or roll the deployment back to the previous SHA.
3. Notify affected providers if user-visible > 1 h.

**P2** — acknowledge within the 24 h SLA, work it through the support workflow
(`docs/pilot/support-workflow.md`); disputes about outcomes use the #13
support API (mediation note, correction, suspension).

**P3** — reply within SLA; collect into the pilot feedback list for week 5.

## Communication plan

- **Who:** the 5 pilot providers (email/text list held by the operator).
  Clients are reached through their provider unless directly affected
  (e.g. a booking recorded wrong → contact the client directly).
- **Provider outage template (P0/P1):**
  > Subject: [Foot pilot] Service issue — we're on it
  > Hi — the booking system is currently having an issue ({one line}). Your
  > existing appointments are safe. Please take bookings by text/phone in the
  > meantime. I'll update you within {time}. — {operator}
- **Resolution template:**
  > Subject: [Foot pilot] Resolved
  > The issue from {time} is fixed ({one-line cause}). Anything booked by
  > text during the outage: reply and I'll enter it for you. Thanks for your
  > patience. — {operator}

## Post-incident review template

```
Incident: <one line>            Severity: P_
Detected: <when/how>            Resolved: <when>
User impact: <who/what/how long>
Timeline: <detect → mitigate → resolve bullets>
Root cause: <honest, specific>
What went well / what didn't:
Follow-ups: <dated ledger entries in docs/TODO-LEDGER.md>
```

## Contacts

| Role | Who |
|---|---|
| Incident owner / support | Repository operator (pilot support inbox — `SUPPORT_CONTACT_EMAIL`) |
| Hosting status | Railway status page (or current host's) |
| Escalation beyond operator | none during pilot (single-operator model — accepted risk at this scale) |
