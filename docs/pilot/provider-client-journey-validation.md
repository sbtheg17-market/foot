# Provider–Client Pilot Journey Validation & Release-Readiness Protocol

> **Type:** Repeatable pilot usability & release-readiness protocol + the first executed run.
> **Purpose:** Determine whether a brand-new provider and a client can complete the
> full appointment journey (sign up → return → set up → publish → book → change →
> daily use) without developer assistance, on desktop and a phone-sized viewport.
> **This is a validation and evidence-gathering phase — not a feature build.**

---

## 1. Baseline

| Field | Value |
|---|---|
| Repository | `sbtheg17-market/foot` |
| Baseline `main` SHA | `c647d4da76ad6bcf59d1f4a99d4026a0ef326ba0` (PR #72 — provider status hub progress) |
| Working tree at run start | clean; `main` == `origin/main` |
| Protocol branch | `docs/pilot-provider-client-journey-validation` |
| Run date | 2026-08-29 |
| Prior work recovered | No uncommitted prior-agent pilot artifact existed on any ref (a fresh `main` checkout; no `docs/pilot-*` branch on origin). This document is authored fresh; nothing was overwritten. |

## 2. Environment & safety

- **Runtime:** Node 20, pnpm 10.18.3, single-service deploy bundle
  (`pnpm run build:deploy`) served on `:8080` (`NODE_ENV=production`).
- **Database:** disposable **local PostgreSQL 15** created for this run only
  (`postgresql://postgres:postgres@127.0.0.1:5432/oncallfoot`), schema via
  `pnpm run db:push`, demo data via `pnpm run seed` (idempotent, run twice).
  Additional throwaway databases `oncallfoot_iso` / `oncallfoot_replay` were used
  to re-run concurrency-sensitive suites in isolation.
- **Accounts:** isolated disposable provider/client accounts created at runtime
  (`pilot-provider-*@example.test`, `pilot-client-*@example.test`) plus the seed
  demo accounts. No real users.
- **Browsers:** Playwright — Chromium (desktop) and WebKit/Chromium (iPhone 13 /
  Pixel 5 emulation, incl. 3G throttle).

**Safety statement (binding for this run):**

```text
Managed/production database: NOT ACCESSED.
Production deployment (Railway): NOT PERFORMED / NOT AUTHORIZED.
No production account, provider/client, or booking data was used.
No secrets, tokens, connection strings, or PII are recorded in this document,
  in test fixtures, in screenshots, or in the Graphify graph.
No managed-DB migration was applied or altered.
```

## 3. Evidence classes & severity

Every observation is tagged with an evidence class and, where it is a finding, a severity.

**Evidence class:** `Verified behavior` (asserted directly) · `Observed pilot result`
(seen in this run) · `Hypothesis` · `Known limitation` · `Deferred work`.

**Severity:**

| Level | Meaning |
|---|---|
| `BLOCKER` | Prevents signup, return-after-login/refresh, understanding a legitimate state, becoming bookable, publishing/opening the booking page, receiving/handling a booking, or seeing/resolving a schedule-change request. |
| `HIGH` | Material confusion, wrong scheduling expectation, privacy leak, accessibility failure, or a mobile-only flow failure. |
| `MEDIUM` | Real friction/inconsistency, low likelihood or an easy recovery path. |
| `LOW` | Cosmetic, wording, or internal-only observation. |
| `PASS` | Behaved as a provider/client would expect. |

## 4. Issue triage rules

A finding is fixed **in this phase** only when it is (1) a reproducible `BLOCKER`
or `HIGH`, (2) narrow, (3) restores a specific journey step, (4) independently
testable, (5) needs no managed-DB access / deployment / new feature system, and
(6) is not bundled with unrelated changes. Product fixes go in a **separate** focused
branch/PR — never inside this documentation PR. All other findings are recorded here
and in `docs/TODO-LEDGER.md` / `docs/NEXT-STEPS.md`.

## 5. Release-readiness gate

The journey is "release-ready for a wider pilot" when, on a clean device:

1. A new provider signs up, returns after logout/refresh, and always sees a truthful
   state with one clear next action. **(Met — verified.)**
2. The provider can complete profile → service → territory → availability →
   emergency opening → time off → publish, following server-derived next actions.
   **(Met — with the admin-approval gate below, which is by design.)**
3. A client can understand the public page, confirm eligibility, find a valid slot,
   book, and change the appointment through the consent-first flow. **(Met.)**
4. Time off produces no bookable slots; emergency openings add truthful extra slots.
   **(Met — verified in isolation.)**
5. The journey works at 390×844 and passes jsdom-level accessibility checks.
   **(Met — mobile emulation 9/9; a11y subset 33/33.)**
6. No `BLOCKER` / `HIGH` finding is open. **(Met — 0 blockers, 0 high.)**

Outstanding before **production** promotion (unchanged, separate gates): apply the
frozen Gate-B migrations to the managed DB, deploy, and re-run this protocol on
production. Those are explicitly **out of scope** here.

---

## 6. Script A — Provider journey

Fresh isolated provider (`pilot-provider-*@example.test`). Steps validated at the API
layer on the disposable stack; the publish→book→change→no-show→escalation portion is
additionally validated in a **real desktop browser** and at **390×844** via the
repository smoke scripts (§8).

| # | Step | Expected | Observed | Desktop | 390×844 | Severity | Evidence |
|---|---|---|---|---|---|---|---|
| 1 | Sign up as provider | Account + provider role, session issued | `role=provider`, token issued | PASS | PASS | PASS | `POST /auth/register`; smoke `register` steps |
| 2 | Initial route correct | Lands in application/status flow | `status=draft`, `nextAction=resume_draft` | PASS | PASS | PASS | `GET /providers/application/status` |
| 3–4 | Logout then log back in | New session works | Re-login issues fresh token | PASS | PASS | PASS | `POST /auth/login` |
| 5–6 | Refresh application-status route | Resolves to a truthful state, **not** a generic error | `draft` + `resume_draft`, no error | PASS | PASS | PASS | `GET /providers/application/status`; `test:return-path-drift` 11/11 |
| 7 | Read Status Hub progress | Current state, one next action, completed/remaining | `milestonesCompleted 1/9`, `nextAction=continue_onboarding` (server-derived) | PASS | PASS (CTA above fold — PR #72) | PASS | `GET /providers/me/activation-status`; `test:activation-status` 11/11 |
| 8 | Complete profile | Saved; profile marked complete | `title/bio/city` saved; `profileComplete=true` | PASS | PASS | PASS | `PATCH /providers/application` |
| 9 | Create & activate a service | Service created | `201`; `servicesComplete=true` | PASS | PASS | PASS | `POST /providers/application/services` |
| 10 | Define service area / territory | Config + FSA coverage | CA/ON + `L2R/L2T/L6H` prefixes | PASS | PASS | PASS | `PUT /providers/me/service-area`; `test:service-area` 30/30 |
| 11 | Set weekly availability | Slots saved | Mon/Wed/Fri 09:00–17:00 (pre-approval route) | PASS | PASS | PASS | `PUT /providers/application/availability` |
| 12 | Create an Emergency Opening | One-off extra window | `201`; surfaces as urgent slots | PASS | PASS | PASS | `POST …/emergency-openings`; `test:emergency-openings` 10/10 |
| 13 | Create a Time Off / Vacation Range | Range blocks days | `201`; days become unbookable | PASS | PASS | PASS | `POST …/blocked-ranges`; `test:vacation-ranges` 11/11 |
| 14 | Conflict behaviour explained | Mutual exclusion is clear & safe | `409`: "…emergency openings and time off cannot overlap. Delete it first." | PASS | PASS | PASS | blocked-range vs opening 409 |
| 15 | Publish booking page | Public page live, immutable slug | Published; slug `…`, path `/book/…` | PASS | PASS | PASS | `POST /providers/me/booking-page/publish`; `test:booking-page` 17/17 |
| 16–17 | Preview + copy/share URL | Public page reachable, shareable | Public `GET` `200` | PASS | PASS | PASS | `GET /booking-pages/:slug`; smoke |
| 18 | Printable QR handout | QR card renders | QR/share card present | PASS | PASS | PASS | smoke `real-browser` share card |
| 19 | Return to dashboard | Next action + readiness, no dead end, responsive | Dashboard renders; next-action + readiness cards; no overflow | PASS | PASS | PASS | `GET /providers/me/dashboard`; `test:provider-dashboard` 17/17 |
| 20 | Pending-reschedule surfacing | Dashboard card + nav badge + deep link | `pendingReschedules {count,nextRequest}`; proposals visible; `?tab=rescheduled` deep link | PASS | PASS | PASS | provider dashboard + proposals list |

**Admin-approval gate (by design, `Verified behavior`).** A brand-new provider stays
in `draft`/`under_review` and becomes **bookable only after an admin approves the
application _and_ the verification** (`POST /admin/provider-applications/:id/approve`
+ `PATCH /admin/verification/docs/:id {status:"approved", updateProviderStatus:"approved"}`).
This is the intended trust/verification boundary for in-home care, not a defect. It
does mean the answer to "can a brand-new provider become bookable *without any
assistance*?" is **No — one admin approval step is required**; everything else is
self-serve.

## 7. Script B — Client journey

Fresh isolated client (`pilot-client-*@example.test`) booking the Script-A provider.

| # | Step | Expected | Observed | Desktop | 390×844 | Severity | Evidence |
|---|---|---|---|---|---|---|---|
| 1 | Open public page unauthenticated | Loads for anyone | `200` | PASS | PASS | PASS | `GET /booking-pages/:slug` |
| 2 | Public content clear & privacy-safe | No private data | Title/bio/services/hours + **public** service-area summary; **no** raw FSA list, **no** addresses, **no** `reviewerNotes` | PASS | PASS | PASS | public payload inspection |
| 3 | View services | Accurate | 1 service, price/duration shown | PASS | PASS | PASS | public payload |
| 4 | Service-area eligibility | Eligible in-area, ineligible out-of-area | `L2R → eligible/fsa_match`; `K1A → ineligible/fsa_not_covered` | PASS | PASS | PASS | `POST …/service-area-check`; smoke asserts invalid FSA rejected |
| 5 | Weekly availability | Real slots | 15 slots on a normal working day | PASS | PASS | PASS | `GET /providers/:id/slots` |
| 6 | Emergency-opening availability | Extra valid slot appears | 3 slots incl. `urgentOnly=true` on the opening date | PASS | PASS | PASS | slots on opening date (isolated) |
| 7 | Time-off dates | No selectable slots | **0** slots on a blocked day (control day = 15) | PASS | PASS | PASS | slots on blocked date (isolated) |
| 8 | Book a valid slot | Booking created | Booking `requested`, `source=qr-card` | PASS | PASS | PASS | `POST /bookings`; smoke touch-booking |
| 9 | Booking confirmation | Truthful state; provider can accept | Provider `confirmed` | PASS | PASS | PASS | `PATCH /bookings/:id/status` |
| 10 | Client requests a change | Client reschedules **directly** (their own time) | `rescheduled` → provider reconfirms | PASS | PASS | PASS | `PATCH /bookings/:id/status` (rescheduled) |
| 11 | Provider sees the request | Provider-initiated proposal visible to client | Proposal `pending`; visible to both parties | PASS | PASS | PASS | `POST /bookings/:id/reschedule-requests`; `GET …/reschedule-requests` |
| 12 | Consent-first accept/decline | Nothing moves without consent | Provider proposal stays `pending`; booking time unchanged; client **declines** → original kept | PASS | PASS | PASS | `POST /reschedule-requests/:id/decline`; `test:proposals` 17/17 |
| 13 | Client sees truthful state | Correct status after resolution | `pending`/`declined` shown with honest status | PASS | PASS | PASS | `GET …/reschedule-requests` |
| 14 | Cancellation / no-show (safe flow) | Honest preview; no-show + escalation | Cancel preview `outcome=free`, 24h notice; no-show marked; escalation ticket opened & admin-visible | PASS | PASS | PASS | `GET …/cancellation-preview`; smoke no-show + escalation; `test:cancellation` 22/22 |

**Consent model (`Verified behavior`).** Clients change *their own* appointment time
directly. A provider cannot unilaterally move a client's confirmed appointment — the
provider **proposes**, and the client accepts/declines. Attempting the proposal
endpoint as a client returns a friendly `403`: "Clients reschedule directly from the
booking — pick a new time from the reschedule screen." This is truthful and
non-manipulative.

---

## 8. Automated test coverage (this run)

All results are honest, disposable-PostgreSQL-only. Concurrency-sensitive suites were
re-run in isolation where a shared-DB run was polluted (see §9).

### Build / static gates

| Check | Result |
|---|---|
| `pnpm run typecheck` | PASS |
| `pnpm run build` | PASS |
| `pnpm run build:deploy` (Railway parity) | PASS |
| `git diff --check` | PASS (clean) |
| `scripts/secret-scan.sh` | PASS (clean) |
| Health `/api/healthz` + seeded login | PASS (200 / 200) |

### Web (Vitest / jsdom)

| Suite | Result |
|---|---|
| `@workspace/web test` | **240/240 PASS** |
| `@workspace/web test:a11y` (axe + a11y subset) | **33/33 PASS** |
| `@workspace/web test:tz` (marketplace TZ + DST) | **10/10 PASS** |

### API — unit

| Suite | Result |
|---|---|
| `test` (booking state machine + reschedule policy incl. DST math) | **70/70 PASS** |

### API — scripted integration (server + disposable PG)

Full CI `api-tests` list — **26/27 PASS** on a shared DB; the single non-pass was a
concurrency artifact, **14/14 PASS in isolation** (see §9):

`test:reviews 7 · test:care-history 4 · test:role-state 2 · test:provider-application 8 ·
test:provider-resubmission 11 · test:provider-status 9 · test:availability 3 ·
test:onboarding 23 · test:provider-history 11 · test:provider-notifications 12 ·
test:reviewer-decisions 14 · test:provider-readiness 14 · test:first-booking 8 ·
test:client-retention 8 · test:marketplace-events 12 · test:booking-page 17 ·
test:service-area 30 · test:cancellation 22 · test:provider-dashboard 17 ·
test:registration 15 · test:verification 13 · test:activation-status 11 ·
test:return-path-drift 11 · test:route-read-drift 19 · test:pilot-metrics 14 ·
test:vacation-ranges 11` — all PASS.
`test:lifecycle` — **14/14 PASS in isolation** (FAILED only under the shared-DB
concurrent run; §9).

### API — authorization / concurrency (disposable PG)

`test:authorization 7 · test:integration (concurrency) 16 · test:pressure 13 ·
test:rescheduling 12 · test:proposals 17` — **all PASS**.

### API — unscripted (fresh DB)

`availability-enforced-booking 6 · payments-foundation 6 · listing-preview.integration 9 ·
prevented-booking-events.integration 9 · replay-safety-controls 27` — **all PASS**.
`prevented-booking-replay.integration` — run on its own booking-free DB — **PASS**.

### Browser smokes

| Smoke | Result |
|---|---|
| `smoke:real-browser` (desktop Chromium) — publish → eligibility → book → accept → propose → decline → cancel (honest dialog) → no-show → escalation → support link | **13/13 PASS** |
| `smoke:mobile-emulation` (iPhone 13 WebKit + Pixel 5 Chromium; deep link `?source=`; PST device still shows Toronto times; touch booking; provider portal; 3G throttle < 3s) | **9/9 PASS** |

### Classification of areas

| Area | Classification |
|---|---|
| Registration / login / logout / role & session state | PASS |
| Application-status / activation / readiness (incl. drift-safety) | PASS |
| Status Hub progress + next action | PASS |
| Provider profile / services / service area / travel buffer | PASS |
| Weekly availability / Emergency Openings / Vacation Ranges | PASS |
| Public booking page + slot generation & enforcement | PASS |
| Booking creation / source attribution | PASS |
| Rescheduling (direct + consent-first proposals) | PASS |
| Cancellation / no-show / support escalation | PASS |
| Provider dashboard + pending-reschedule badge / deep link | PASS |
| Printable QR handout | PASS |
| Web accessibility (jsdom level) | PASS |
| Mobile emulation (390-class) | PASS |
| Native hardware devices | NOT RUN — no simulator/device in this environment (see `docs/native-device-checklist.md`) |
| Managed-DB catalog verification / production journey | NOT RUN — out of scope / not authorized |

---

## 9. Test-isolation note (why one suite "failed" then passed)

The first scripted run was executed **while the manual API journey was still creating
bookings on the same database and server**. Several suites (`test:service-area`,
`test:vacation-ranges`, etc.) create/delete/reset provider data and slot-pool
positions as part of setup/teardown. This shared-DB concurrency:

- transiently emptied the pilot provider's emergency-opening / blocked-range lists
  mid-journey (they were re-created and **re-verified correct in isolation**: emergency
  opening → 3 urgent slots; time off → 0 slots; control day → 15 slots); and
- caused `test:lifecycle` subtest 2 ("lock-amplified deterministic race") to see 2
  winners instead of 1.

Re-running `test:lifecycle` on a **fresh isolated database with no concurrent
activity** produced **14/14 PASS**. This is a documented property of the
concurrency/slot-pool-sensitive suites (they require a booking-free DB — the same
reason CI gives the replay/DLQ suite its own runner). **No product defect** is implied.

---

## 10. Findings

**Blockers: 0. High: 0.**

| ID | Severity | Class | Finding | Disposition |
|---|---|---|---|---|
| M-1 | MEDIUM | Observed pilot result | The activation hub can surface `nextAction = configure_service_area` once the **application** is approved while **verification** is still `under_review`; but `PUT /providers/me/service-area` requires full approval (application **and** verification) and returns `403` in that window. In the normal admin flow both are approved together, so this is a transient, admin-controlled state — but a provider guided there mid-window would hit a dead-end. | **Deferred (backlog).** Narrow future fix: make the hub's next action reflect verification state until both are approved. Not a blocker; no code change this phase. |
| L-1 | LOW | Observed pilot result | Provider-submitted verification `notes` are stored in the document's `reviewerNotes` column (visible only in the admin queue). No exposure to the provider was observed; this is field-name reuse, not a leak. | Deferred (backlog); watch during managed-DB gate. |
| L-2 | LOW | Known limitation | Weekly availability uses two routes by state: `PUT /providers/application/availability` (draft/rejected, pre-approval) vs `PUT /providers/me/availability` (approved). The web UI selects the correct one; an API-only integrator could be briefly confused (approved-only route returns `403` for a draft). | Documented here; no change. |

No privacy leaks, accessibility failures, or mobile-only failures were found.

## 11. Recommended next build (evidence-based)

The end-to-end journey is **consistently successful** on desktop and 390×844 with
0 blockers / 0 high findings. The next work should therefore **not** be another
provider feature. In priority order:

1. **Complete the managed-DB release gate** (`docs/managed-db-release-gate.md`):
   backup/restore ownership + evidence, then an authorized read-only managed catalog
   verification. This is the real blocker to a production pilot.
2. **Apply the frozen Gate-B migrations** to the managed DB, **deploy**, and **re-run
   this exact protocol on production** with a brand-new provider and client.
3. Only after the journey is consistently successful on production: begin public-page
   **SEO foundation** (preserve slugs/canonical/OG; keep public content crawlable;
   never expose private setup/notes) and truthful sharing/outreach — each as its own
   separately scoped task.
4. If pilot evidence shows real friction, the smallest candidate fixes are **M-1**
   (hub next-action vs. verification state) and a client-facing preview of exception
   days — both demand-gated, not speculative.

Do **not**, in the meantime, build payments, reminders, marketplace ranking, CRM,
organization/workspace management, recurring time off, or social/outreach automation.

## 12. Graphify continuity (this run)

- **Status:** AVAILABLE and refreshed at baseline `c647d4d`.
- **Mode:** code-only local AST extraction (`--code-only` equivalent via the graphify
  Python API); **no** LLM, **no** managed-DB introspection, **no** external services,
  `.graphifyignore` honored (no `.env`, secrets, runtime DB, logs, caches, or
  screenshots indexed).
- **Artifacts:** `graphify-out/{graph.json, GRAPH_REPORT.md, graph.html, manifest.json}`
  — **4,796 nodes / 8,709 edges / 379 communities**.
- **Queries used & source-verified:** provider signup → role/application/readiness →
  dashboard; client public page → slot eligibility → booking → provider reschedule;
  provider availability relationships (weekly hours, emergency openings, blocked
  ranges, travel buffers, slot generation). Results cite real source
  (`artifacts/web/src/pages/portal/dashboard.tsx`,
  `artifacts/mobile/app/provider/application-status.tsx`, …) and were verified against
  the tree before being trusted. SQL migration artifacts are not parsed (optional
  `tree_sitter_sql` not installed) — acceptable; the code graph is TS/JS.

## 13. Cross-vertical note

The first vertical is mobile foot care, but this protocol uses vertical-neutral terms —
**provider, client, service, service territory, availability, booking page, appointment,
schedule exception, application, readiness, next action** — so the same protocol can
validate future provider-based verticals without change. No vertical-specific
assumption was hard-coded into any artifact this phase.

---

## Addendum — 2026-08-29: Finding M-1 CLOSED

Pilot finding **M-1** (MEDIUM — the activation hub could emit
`nextAction = configure_service_area` while the application was approved but
verification was still `under_review`, sending the provider into a `403`) was
fixed in the follow-up product PR `fix: align provider next action with
verification gate` (branch `fix/activation-next-action-verification-gate`).

- Root cause: `deriveActivationNextAction` branched on `applicationStatus`
  alone; every setup destination it emitted is behind the approved-provider
  boundary (application **and** verification approved — `requireApprovedProvider`,
  mirrored by the C1 `approved` milestone), which the derivation never consulted.
- Fix (server source of truth): an approved application that has not passed the
  full gate now resolves to `wait_for_review` (verification decision pending)
  or `review_update_needed` (verification rejected — resubmission is the
  accessible recovery path). The activation checklist's approved-only deep
  links now key on the server-derived `approved` milestone for the same reason,
  and the `review_update_needed` CTA anchor target exists in both producing
  states.
- Invariant now enforced and regression-tested (table-driven, real routes):
  *every server-derived provider `nextAction` resolves to a destination the
  provider is authorized to use in the same lifecycle state.*
- Evidence: `test:activation-status` 13/13 (two new tests: gate alignment with
  a live `403` probe, and the lifecycle-state × route-eligibility table); web
  suite 242/242 with two new hub tests (wait state without setup CTA + locked
  checklist at 390-class widths; accessible update path incl. axe scan); drift
  suites (`test:return-path-drift` 11, `test:route-read-drift` 19) unchanged
  and green. Managed DB not accessed; production not deployed.

L-1 and L-2 remain LOW/deferred as recorded in §10.
