# Roadmap #13 — Cancellation/no-show policy and minimal support workflow (continuity draft)

**Created:** 2026-08-26 · **Status:** continuity draft — NOT implemented.
**Baseline `main`:** `a3121c5accb2bdb9ebe071f09b595aab1927fc1b` (#12 completion, PR #50).
**#12 merge SHAs:** `a0083e7` (PR #49, feature) + `a3121c5` (PR #50, completion).
This document is the primary spec for the next Neo session. It authorizes no
code, schema, migration, or behavior change by itself.

---

## 1. Mission

Bookings today can be cancelled and marked no-show, but there is no clear,
enforced policy around *when*, *by whom*, *with what notice*, or *what happens
next* — and no path for a client or provider to get help when something goes
wrong. #13 defines and enforces a calm, fair cancellation/no-show policy plus
a minimal in-app support workflow, so providers stop losing time to late
cancellations and clients always understand the rules before they book. It
builds directly on #12's server-authoritative posture (the server decides;
the UI presents) and is a prerequisite for a controlled pilot with real users,
where disputes and no-shows are inevitable.

## 2. Scope

**#13 must implement:**

- A centrally managed cancellation policy (notice window, who may cancel,
  allowed booking states) enforced server-side on every cancellation path.
- Distinct, auditable cancellation categories (e.g. client-cancelled in time,
  client-cancelled late, provider-cancelled, cancelled-by-support).
- Provider-only no-show marking with clear state gating (existing rule:
  from `confirmed` only, never by clients) plus a client-visible outcome and
  an appeal/escalation path.
- Append-only cancellation/no-show history, owner-scoped, consistent with the
  existing rescheduling-history pattern.
- A minimal support workflow reusing the existing `support_tickets` /
  `support_messages` tables: escalate a cancellation/no-show dispute from the
  booking into a ticket that references the booking; admin can resolve and,
  where policy allows, correct a booking outcome with a recorded reason.
- Client- and provider-facing policy display before booking and before
  cancelling (plain language, marketplace timezone).
- Web + mobile parity, OpenAPI/client regeneration, tests, CI wiring, docs,
  ledger and continuity updates. Additive-only schema changes with a frozen
  migration artifact, tested against disposable PostgreSQL only.

**Explicitly out of scope (do not build):**

- Payments, refunds, payouts, cancellation fees, deposits, penalties with
  money movement (fee *fields/flags* may be recorded as policy metadata only
  if needed, with zero money behavior).
- Reminder/notification delivery guarantees, email/SMS.
- Routing, geocoding, maps, coordinates, radius/polygons.
- Marketplace discovery/ranking changes; extensibility frameworks.
- Automated no-show detection; provider reliability scoring.
- Changes to consent-first rescheduling semantics or the #12
  service-area/buffer behavior.

## 3. Product requirements

- **Cancellation policy states.** A booking cancellation must resolve to a
  policy outcome the server computes: within-notice (free), late (recorded as
  late; no fee is charged — fees are deferred), or provider-cancelled
  (never penalizes the client). The notice window is centrally managed
  (suggested default: 24 hours; environment override, same posture as the
  #12 buffer — validated, never a silent fallback).
- **No-show states.** Only the provider can mark a no-show, only from
  `confirmed`, only after the scheduled time has passed (new server rule —
  today the time check is missing). The client sees the outcome with calm
  copy and a visible "this seems wrong" escalation action.
- **Client-visible behavior.** Clients see the cancellation policy before
  booking (public booking page and marketplace modal), see the exact
  consequence *before* confirming a cancellation ("free until…", "this is a
  late cancellation"), and see their history states honestly. Clients can
  escalate a disputed no-show or a provider cancellation to support.
- **Provider-visible behavior.** Providers see the same policy, get a
  required structured reason when cancelling (client keeps their slot dignity:
  reason category is shared, free-text stays support/admin-visible per
  privacy rules), and can mark/undo nothing silently — every action is
  recorded.
- **Support escalation path.** From a cancelled/no-show booking, either party
  can open an escalation. It creates a support ticket linked to the booking,
  pre-filled with safe booking facts. Admin resolves in the existing admin
  support screens; resolution can (a) keep the outcome, or (b) correct it
  (e.g. no-show → completed or cancelled-by-support) with a mandatory reason,
  recorded in history. Corrections re-run review-eligibility rules; they never
  invent new bookings or times.
- **Minimal support workflow.** No SLAs, queues, assignments, or categories
  beyond a booking-dispute type. Open → in_progress → resolved, as today.
- **Privacy boundaries.** Never expose across parties: care notes, private
  free-text reasons beyond the allowlisted category, addresses beyond what a
  party already sees, user identifiers, admin notes, or technical errors.
  Public pages never show cancellation/no-show counts or history.
- **Integration.** Cancellation resolves any pending reschedule proposals
  (already true — preserve it). A cancelled booking frees the slot and the
  #12 travel buffer immediately. No-show never applies to `rescheduled`
  bookings (preserve the existing gate). State-machine transitions stay
  server-authoritative; no new booking engine.

## 4. Data model sketch (additive only — no schema/migrations in this PR)

- `bookings`: additive columns for cancellation category (allowlisted enum-like
  text) and no-show marking metadata (marked-by, marked-at) if not derivable;
  reuse existing `cancelled_by` / `cancellation_reason`.
- `booking_outcome_history` (new, append-only): booking id, actor, action
  (cancelled/no_show/support_corrected), category, safe reason snapshot,
  created_at — mirroring the rescheduling-history pattern.
- Support escalation reference: additive `support_tickets.booking_id`
  (nullable FK) or a small link table — pick whichever is least invasive.
- Central policy values (notice window) live in application config, not
  schema, exactly like `TRAVEL_SETUP_BUFFER_MINUTES`.

## 5. API sketch (high-level; final shapes go through OpenAPI)

- `POST /bookings/:id/cancel` — client or provider; server computes the
  policy outcome; structured reason category required for providers.
  (Alternatively extend the existing `PATCH /bookings/:id/status` —
  decide in-session; do not build both.)
- `GET /bookings/:id/cancellation-preview` — what would happen right now
  (free/late/blocked), for honest confirm dialogs.
- `PATCH /bookings/:id/status` (`no_show`) — keep, add the time-passed rule.
- `GET /bookings/:id/outcome-history` — owner-scoped, append-only.
- `POST /bookings/:id/escalations` — create the linked support ticket;
  `GET` via existing support routes.
- Admin: resolve via existing ticket routes + a scoped
  `POST /admin/bookings/:id/outcome-correction` with mandatory reason.
- Public: cancellation policy summary included in the existing public
  booking-page/provider payloads (safe fields only).

## 6. UX notes

- **Clients** see the policy on `/book/:providerSlug` (near the confirm CTA)
  and in the marketplace/mobile booking modal; the cancel flow shows the
  computed consequence before the destructive confirm (existing confirm +
  duplicate-submit protections reused). Booking detail shows outcome states
  with calm copy and an "Ask for help with this booking" action.
- **Providers** see the policy in the portal (bookings inbox + booking
  detail); cancelling requires a reason category; no-show marking explains
  the client-visible consequence and links to the policy. Buffer/coverage
  settings pages are untouched.
- **Support escalation** appears only on terminal-state bookings the viewer
  owns; it opens the existing support-ticket UI pre-linked to the booking.
  Admin sees the linked booking context inside the existing admin ticket
  screens. All states must meet the existing jsdom a11y bar (roles, names,
  labels, non-color status).

## 7. Test strategy (categories the next Neo must implement)

- Cancellation behavior: within-notice vs late boundary math (marketplace
  timezone, DST boundaries), category recording, provider-cancel rules,
  blocked states.
- No-show behavior: provider-only, confirmed-only, time-passed rule,
  rescheduled-booking gate preserved, client-visible outcome.
- Authorization: ownership scoping, role gates, non-leak 403/404 parity with
  existing suites.
- Concurrency/idempotency: cancel vs reschedule-accept races, double-cancel,
  duplicate escalation submits.
- History: append-only, owner-scoped, no mutation routes.
- Privacy: reason redaction across parties, no public leakage, ticket
  payload safety.
- Integration: pending-proposal resolution on cancel, slot/buffer freeing
  (#12 regression suites must stay green), review-eligibility after
  corrections.
- Web/mobile parity for policy display and actions; mobile typecheck +
  Expo exports stay green.
- Accessibility: axe + a11y assertions for every new dialog/state.
- CI: every new scripted suite wired into `.github/workflows/ci.yml`
  (lesson from #12 — `test:service-area` was initially unwired).

## 8. Deferred items (intentionally NOT in #13)

- Payments/refunds/payouts; cancellation fees, deposits, penalties.
- Reminders and any email/SMS or guaranteed notification delivery.
- Routing/geocoding, maps, coordinates.
- Marketplace discovery/ranking changes.
- Extensibility/plugin work.
- Automated no-show detection, reliability scores, provider sanctions.
- Support SLAs, assignment, queues beyond the minimal flow.

## 9. Continuity and handoff

- **Baseline main SHA:** `a3121c5accb2bdb9ebe071f09b595aab1927fc1b`.
- **#12 merge SHAs:** `a0083e7e1492108c10451444eace65d492fadc25` (PR #49) and
  `a3121c5accb2bdb9ebe071f09b595aab1927fc1b` (PR #50 completion). #12 is fully
  merged; 16/16 CI jobs green on `main`.
- **This document's purpose:** the self-contained, implementation-ready spec
  for #13. It changes no behavior.
- **Authoritative context:** `docs/TODO-LEDGER.md`, `docs/api-routes.md`,
  `docs/data-models.md`, `docs/rescheduling-policy.md`,
  `docs/service-area-travel-policy.md` (implementation record),
  `docs/neo/2026-08-21-client-retention-handoff.md`.

### Next Neo must

1. Branch `feat/cancellation-no-show-policy` (or similar) from current
   `origin/main`; never from this docs branch or any `conflict_*` branch.
2. Implement only §2 in-scope items, honoring §8 deferrals and all existing
   #9–#12 semantics (consent-first rescheduling, service-area/buffer,
   non-leak errors, append-only history).
3. Additive-only schema with a frozen `docs/migrations/*.sql` artifact,
   tested on disposable PostgreSQL only (push ×2, seed ×2); no managed DB.
4. Wire every new test suite into CI; run the full local CI replication
   (note: port 8080 is occupied in the dev pod — use `PORT=8090`; the
   replay/DLQ suite needs its own fresh DB; arm64 hosts cannot run full Expo
   exports — CI covers them).
5. Update docs/ledger/continuity append-only; push without force; PR;
   squash-merge only with all deterministic checks green and the diff
   strictly in #13 scope.

### Next Neo must NOT

- Merge this draft PR as implementation, redo #12, touch payments/reminders/
  routing, access managed databases, deploy, force-push, or modify
  `conflict_*` branches.
