# Pilot Readiness Report — Southern Ontario Controlled Pilot

**Date:** 2026-08-26 · **Branch:** `feat/pilot-readiness` · **Baseline main:** `1c81695b44d898105b9b4bc3e011ebcc2d7a7079`
**Scope authority:** operator pilot-readiness authorization (2026-08-26), with the four
configuration decisions recorded below.

## Pilot model (operator-defined)

| Parameter | Value |
|---|---|
| Providers | 5 mobile foot-care providers |
| Geography | Southern Ontario corridor: St. Catharines → Oakville (FSA prefixes L2x/L6x, plus M-prefix reach) |
| Services | Routine Nail Care ($60–80, 30–45 min), Callus Debridement ($50–70, 30 min), Diabetic Foot Check ($70–90, 30–45 min), Thick Nail Reduction ($70–90, 45 min), Fungal Nail Assessment ($50–60, 30 min). Excluded: complex wound care, orthotics, painful procedures, multi-visit packages. |
| Pricing | Free pilot for providers (they keep 100%). Clients pay cash/e-transfer — **no payment infrastructure** (unchanged, deferred). |
| Duration | 2–5 weeks (wk 1 onboarding · wk 2–4 active · wk 5 wrap-up) |

### Success metrics (to be measured during the pilot)

Primary: ≥80% provider activation (4/5) · ≥3 providers share links · ≥15 client
bookings · ≥85% completion · ≤20% cancellation · ≤10% no-show · ≤3 support
escalations · ≥3/5 retention intent.
Secondary: source attribution mix (`bookings.source`), time-to-first-booking,
repeat bookings, eligibility pass/fail rate, travel-buffer impact.

## Configuration decisions (operator, 2026-08-26)

1. **Support contact:** env-configured (`SUPPORT_CONTACT_URL` > `SUPPORT_CONTACT_EMAIL` >
   documented placeholder `support@foot.app`); invalid values throw.
2. **Monitoring:** document procedures + verify local health endpoints only;
   external alerting **BLOCKED — requires external accounts**; manual daily check for the pilot.
3. **Native devices:** Playwright emulation now + manual hardware script for the operator;
   report **emulation-PASS / hardware-DEFERRED**.
4. **Real-browser smoke:** on-demand script (`pnpm run smoke:real-browser`), **not CI-gated**.

## Readiness checklist — status

| Item | Status | Evidence |
|---|---|---|
| #11 Public booking pages | **PASS** (merged) | main `58aa915`/PR #48; exercised end-to-end by the smoke test below |
| #12 Service-area + travel buffer | **PASS** (merged) | main `a0083e7`+`a3121c5` (PRs #49/#50); FSA eligibility exercised below |
| #13 Cancellation/no-show + support | **PASS** (merged) | main `1c81695` (PR #52); cancel/no-show/escalation exercised below |
| Real-browser smoke test | **PASS** (implemented + run) | `docs/pilot/real-browser-smoke-test.md` — Chromium 151.0.7922.34, 13/13 steps, run twice (idempotent) |
| Native-device validation | **PASS (emulation) / DEFERRED (hardware)** | `docs/pilot/native-device-validation-report.md` — iPhone 13 (WebKit 26.5) 4/4, Pixel 5 (Chromium 151) 5/5 incl. 3G throttle; physical devices via `docs/pilot/native-device-hardware-test-script.md` |
| Support contact path | **PASS** | `docs/pilot/support-workflow.md` — env-configured link live on booking page + portal; test escalation ticket created and admin-visible |
| Monitoring / alerts | **PASS (local) / BLOCKED (external)** | `docs/pilot/monitoring-setup.md` — `/api/healthz` verified; UptimeRobot/Sentry procedures documented; accounts required |
| Backup/restore | **PASS** | `docs/pilot/backup-restore-verification.md` — dump 181 ms, restore 659 ms, integrity match; RTO/RPO recorded |
| Secret rotation | **PASS** | `docs/pilot/secret-rotation-procedure.md` — JWT_SECRET live rotation drill: old token 401, new login 200 |
| Incident response | **PASS (documented)** | `docs/pilot/incident-response-runbook.md` — P0–P3, comms templates, post-incident template |
| Provider onboarding package | **PASS (documented)** | `docs/pilot/provider-onboarding.md`, `provider-setup-checklist.md`, `provider-faq.md` |

## Validation summary (this branch, disposable local PostgreSQL 15)

| Check | Result |
|---|---|
| `pnpm run typecheck` | PASS |
| `pnpm run build` | PASS |
| `pnpm run build:deploy` | PASS |
| `pnpm test` (root) | PASS — api-server 132/132 (incl. 6 new support-contact tests), web 108/108 (incl. 5 new support-link tests) |
| Real-browser smoke (`pnpm run smoke:real-browser`) | PASS 13/13 (×2 runs) |
| Mobile emulation (`pnpm run smoke:mobile-emulation`) | PASS 9/9 |
| Backup/restore drill | PASS (integrity match) |
| Secret rotation drill | PASS |
| `git diff --check` | PASS |
| Secret scan | PASS |
| External uptime/error alerting | BLOCKED — external accounts |
| Physical-device hardware run | DEFERRED — operator script provided |
| CI (16 jobs) | see PR checks (run on push) |

## Go / no-go

**GO for a controlled 5-provider pilot**, with these operator actions before day 1:

1. Set `SUPPORT_CONTACT_EMAIL` (or `SUPPORT_CONTACT_URL`) on the deployment — the
   placeholder is flagged `isPlaceholder: true` until then.
2. Run the hardware test script on one real iPhone and one real Android
   (`docs/pilot/native-device-hardware-test-script.md`) and date-stamp the report.
3. Create the UptimeRobot (or equivalent) monitor per `docs/pilot/monitoring-setup.md`,
   or commit to the documented manual daily check.
4. Confirm the managed-database backup schedule per
   `docs/pilot/backup-restore-verification.md` (managed DB was NOT accessed in this session).

Production deployment remains **NOT AUTHORIZED** and is a separate gate
(`docs/managed-db-release-gate.md`).
