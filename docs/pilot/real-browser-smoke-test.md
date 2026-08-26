# Real-browser smoke test — pilot readiness

**Implemented:** 2026-08-26 · **Tooling:** Playwright **1.62.1** (library, not test-runner) —
chosen over Puppeteer for its bundled WebKit (shared with the mobile-emulation script).
**CI status: NOT RUN — on-demand only** (operator decision 2026-08-26; not CI-gated).

## How to run

```bash
# One-time: browsers + host deps
pnpm --filter @workspace/scripts exec playwright install-deps chromium webkit
pnpm --filter @workspace/scripts exec playwright install chromium webkit

# Seeded scratch DB + built single-service bundle on :8080
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/oncallfoot" JWT_SECRET="local-dev-secret"
pnpm run db:push && pnpm run seed && pnpm run build:deploy
PORT=8080 NODE_ENV=production pnpm run start &

pnpm run smoke:real-browser        # scripts/src/pilot/smoke-real-browser.ts
```

`DATABASE_URL` is required: one fixture booking is backdated directly so the
#13 no-show time-passed rule can fire. **Never point this at a managed
database or production host.**

## Flow covered (one continuous scenario, real Chromium)

provider publishes booking page (idempotent API setup: ON service area,
St. Catharines–Oakville FSA prefixes L2R/L2T/L6H/L6J/M5V, publish) → client
opens `/book/:slug` → support footer renders → **invalid FSA (K1A) rejected**
→ client signs in → **valid FSA (L2R) → service → real slot → booking
confirmed with `source=qr-card` attribution** → provider sees + accepts it in
the portal → provider **proposes** a reschedule (consent-first; confirmed time
verified unchanged) → client **declines** the proposal → client **cancels**
via the honest policy dialog (server preview copy + category asserted) →
provider marks a separate past-due booking **no-show** via the portal dialog →
client **escalates** it; admin sees the ticket through the support API →
portal support link asserted.

## Results — 2026-08-26

| Field | Value |
|---|---|
| Browser | Chromium **151.0.7922.34** (Playwright 1.62.1), headless, desktop viewport |
| Host | Linux arm64 container, local PostgreSQL 15 (disposable, seeded) |
| Steps | **13/13 PASS** |
| Re-run | second consecutive run on the same database: **13/13 PASS** (idempotent) |

Step log (final run): server healthz · publish setup (`slug=sarah-chen`) ·
public page + support footer (`mailto:support@foot.app`) · invalid FSA
ineligible · UI login · booking created `source=qr-card` · provider accept →
`confirmed` · proposal created, time unchanged · proposal declined · cancel →
`client_cancelled_early` with dialog copy "Cancelling now is free — you are
within the notice window." · no-show recorded after backdate · escalation
ticket #1 open + admin-visible · portal support link.

## Issues found / resolved / deferred

- **Found + resolved (script fixtures, no product change):** (1) re-running
  setup returned 409 for already-covered FSA prefixes — now tolerated as the
  idempotent case; (2) a cancelled booking frees its slot, so a rebooked
  instant matched the OLD cancelled row — lookup now takes the newest booking
  at the instant.
- **Product issues found: none.**
- **Deferred:** running this smoke in CI (operator decision — on-demand only);
  cross-browser desktop matrix (Firefox) — not pilot-blocking.

## Verdict

**PASS** — the pilot-critical booking, rescheduling-consent, cancellation,
no-show, and escalation flows work end-to-end in a real browser.
