# Monitoring setup — Southern Ontario pilot

**Date:** 2026-08-26 · **Status: local health verification PASS · external
alerting BLOCKED — requires external accounts** (operator decision 2026-08-26:
document procedures, verify locally; manual daily check is acceptable at
5-provider scale).

## What exists in the product today

| Signal | Where | Verified |
|---|---|---|
| API liveness | `GET /api/healthz` → `{"status":"ok"}` (no DB dependency) | PASS — 2026-08-26, local built bundle |
| Web app | `GET /` serves the SPA (single-service bundle) | PASS — smoke test |
| Booking pages | `GET /book/:slug` (SPA route) + `GET /api/booking-pages/:slug` | PASS — smoke test |
| Structured logs | pino JSON on stdout (request logs, support-access audit lines) | PASS — inspected during drills |
| DB health | any authenticated API read exercises the pool; `pg_isready` for direct checks | PASS — local |

No error-tracking SDK (Sentry etc.) is installed — adding one is a dependency
decision for the operator (procedure below).

## Manual daily check (pilot fallback — ~2 minutes)

1. `curl -fsS $BASE/api/healthz` → expect `{"status":"ok"}`.
2. Open one provider's `/book/:slug` — page renders, eligibility check works.
3. Sign in as the admin account → confirm bookings list loads.
4. Skim the platform log stream for `level:50` (error) lines.
5. Check the support inbox for new escalations (24 h SLA).

## Uptime monitoring — setup procedure (UptimeRobot, free tier)

1. Create an account at uptimerobot.com (**BLOCKED here: needs an account**).
2. Add three HTTP(S) monitors, 5-minute interval:
   - `https://<pilot-host>/api/healthz` — keyword monitor for `"status":"ok"`.
   - `https://<pilot-host>/` — HTTP 200.
   - `https://<pilot-host>/book/<busiest-provider-slug>` — HTTP 200.
3. Alert contacts: pilot operator email + SMS on failure and recovery.
4. Escalation: 2 consecutive failures = incident P1 per
   `docs/pilot/incident-response-runbook.md`.

## Error tracking — setup procedure (Sentry, free tier)

1. Create a Sentry project (Node + React) (**BLOCKED here: needs an account/DSN**).
2. API: add `@sentry/node`, initialize in `artifacts/api-server/src/index.ts`
   from `SENTRY_DSN` env (skip init when unset), attach the Express error
   handler AFTER routes; scrub PII (addresses, phones, free-text reasons) via
   `beforeSend`.
3. Web: add `@sentry/react` gated on a `VITE_SENTRY_DSN` build variable.
4. Alert rule: any new issue → email the operator. Booking-failure signature
   to watch: 5xx on `POST /api/bookings` or `PATCH /api/bookings/:id/status`.
5. This is a dependency addition — land it through a scoped PR, not ad hoc.

## Database monitoring (managed host)

Use the platform's built-in metrics (Railway: CPU/memory/disk + Postgres
metrics). Alert thresholds for the pilot: disk >80%, sustained CPU >80%,
connection count near the plan limit. The managed database was **not
accessed** in this session.

## Status classification

- Local health endpoints: **PASS**
- Documented procedures (uptime, errors, DB): **PASS (documented)**
- External alerting live: **BLOCKED — external accounts required**
- For the pilot: manual daily check above is the accepted interim.
