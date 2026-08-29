# Provider Approval Status & Activation Hub

**Added:** 2026-08-28, branch `feat/provider-approval-status-hub`.
**Route:** `/provider/application-status` (existing route, evolved in place).
**API:** `GET /api/providers/me/activation-status` (new, owner-scoped,
read-only) + existing `GET /providers/application/status`,
`GET /providers/me/booking-page`, `GET /support/contact`, and the existing
reset/resubmit mutations.

## Purpose

The provider-facing answer to: *Did my application go through? What is being
reviewed? What have I completed? What is stopping me from accepting bookings?
What should I do next? When can I share my booking page?*

The hub turns the former single-purpose application-status page into the
guided activation experience for the current product mode (provider-led
appointments; mobile foot care; five-provider Southern Ontario pilot). It is
conversion-focused but strictly truthful: every rendered state is a
server-proven fact, and the page never promises approval, publication,
bookings, discovery traffic, payment handling, or revenue.

## Provider journey represented

```text
1. Account created            — always true for an authenticated session
2. Provider profile completed — readiness rule (title + city + bio)
3. Verification submitted     — ≥1 credential reference row exists
4. Application under review   — application status (server state machine)
5. Provider approved          — application approved + verification approved
6. Service area configured    — roadmap #12 active coverage (same rule that
                                gates booking-page publishing)
7. Active service added       — ≥1 active service
8. Availability configured    — ≥1 recurring availability window
9. Booking page published     — #11 publish flag
10. First booking received    — ≥1 booking ever (first-value signal,
                                same definition as the pilot dashboard)
```

A milestone is never marked complete unless the system can prove it from raw
source data. There is no fake progress and no client-side recomputation of
business rules.

## Plain-language state meanings

| Internal state | Provider-facing label | Meaning shown |
|---|---|---|
| `draft` | Finish setting up | Complete the remaining onboarding steps |
| `under_review` | Under review | Submission received; review protects trust; no action needed |
| `approved` | Approved | Finish booking readiness and publish when ready |
| `rejected` | Update needed | Review the safe feedback and resubmit |
| `suspended` | Account needs attention | Contact support for help |

Internal state IDs are never rendered. The only reviewer text shown is the
existing provider-visible `rejectionReason` (same projection as
`GET /providers/application/status`). When it is absent the page falls back
to: *"We need a small update before we can complete your review. Contact
support and we'll help you continue."*

## Next-action derivation (server-side)

`nextAction` is derived in journey order from true state only:

```text
draft        → continue_onboarding
rejected     → review_update_needed
suspended    → contact_support
under_review → wait_for_review        (setup routes are approval-gated,
                                       so waiting is the honest guidance)
approved, but verification not yet approved (pilot finding M-1):
             → review_update_needed   when verification was rejected
                                      (resubmission is accessible), else
             → wait_for_review        (the verification decision is still
                                       pending and every setup route is
                                       behind requireApprovedProvider —
                                       application AND verification approved)
fully approved → first missing of:
               complete_profile → configure_service_area → add_service →
               set_availability → publish_booking_page → share_booking_page
               → all_set
```

Invariant (recorded 2026-08-29, pilot finding M-1): every emitted
`nextAction` must resolve to a destination the provider is authorized to use
in the same lifecycle state. The activation checklist applies the same rule —
approved-only deep links render only once the server-derived `approved`
milestone (C1) is true, so no hub link can land on a 403 while the
verification decision is pending.

The client maps each code to a label, a reason ("why this matters"
microcopy), and a deep link to the **existing** destination
(`/provider/profile`, `/provider/service-area`, `/provider/services`,
`/provider/availability`, the in-page booking-page section, or
`/provider/dashboard`). No setup form or business rule is duplicated.

## API: `GET /providers/me/activation-status`

Added because composing existing endpoints could not safely serve the hub:
the `/me/*` operation routes (`readiness`, `services`, `availability`,
`service-area`, `dashboard`) are approved-provider-only, while the hub exists
precisely for providers who are *not yet* approved; and no owner-scoped
endpoint exposed the first-booking signal. The endpoint is:

- gated `requireAuth` + provider membership (same policy as
  `/application/status` and `/me/booking-page`) — works in every application
  state; clients and platform admins receive 403 (no admin provider-view
  bypass);
- read-only — nothing is persisted, no schema change, no migration;
- a pure composition of existing rules: `buildStatusView` capability flags,
  `computeReadiness` criteria, `hasActiveServiceAreaCoverage` (#12),
  `bookingPageView` (#11), status-level verification progress, and a
  `LIMIT 1` first-booking probe;
- documented in OpenAPI (`ProviderActivationStatusResponse`) with clients
  regenerated via the standard codegen.

Privacy: the payload contains **no** reviewer-private notes, reviewer
identity, raw document references or file names, internal scoring, platform
pilot metrics, retention intent, risk flags, client identities, or audit
metadata. The redaction contract is enforced by
`provider-activation-status.integration.test.ts`.

## Verification section behavior

Status-level only: `not_started` / `submitted` / `under_review` /
`needs_update` / `approved`, with the latest submission date. When the
existing policy allows resubmission (`verificationStatus = rejected`), the
hub shows the friendly recovery copy and links to the **existing**
submission flow (portal credentials page when approved, onboarding
otherwise). No uploads, OCR, or external verification vendor. The privacy
statement is shown verbatim: *"We use your verification information only to
review your provider application. We do not show it on your public booking
page."*

## Booking readiness and publish/share behavior

Four readiness cards (service area, services, availability, booking page)
with Complete / Needs attention / Ready to publish / Live / After approval
states, why-it-matters microcopy, and direct links to the existing pages.
The booking-page section embeds the **existing** `BookingPageCard`
(publish/unpublish, preview, copy link, native share, QR) — no duplication
of publish rules. The share-and-grow copy is conditional and truthful:
pre-publish it describes what the link *will* be; post-publish it invites
sharing. No campaign system, analytics, or demand claims.

## Conversion rationale (honest value reinforcement)

The "What Foot handles for you" section lists only implemented behavior:
accurate bookable times, service-area fit checks before booking,
travel/setup buffers in availability, client self-serve
reschedule/cancel, and one professional booking link. The hub's business
goal is to prevent drop-off between approval and first booking by removing
uncertainty — the same funnel the platform-admin pilot dashboard measures
from the other side.

## Mobile and accessibility expectations

Mobile-first at 390 px: single column, wrapping headers, no horizontal
overflow, touch-target-sized actions. Landmarks: one `<main>`, labelled
sections, single h1, status conveyed by text pills (never color alone),
progress bar with an accessible label, `role="alert"` on errors, jsdom axe
scans on the approved and rejected states. Loading, error (retryable),
404-empty (start onboarding), and 403 states are explicit.

## Reused features (not rebuilt)

Provider signup/application records, verification submission flow and
policy, readiness rules, #12 service-area coverage, availability engine,
#11 booking-page publish/preview/share/QR (`BookingPageCard`),
submission-history timeline, reset/resubmit mutations, support contact
component, portal routes and design system.

## Not implemented (deliberately)

Provider dashboard changes, earnings/payments/payouts, leaderboards or
ranking, organization/workspace/tenant model, client groups, workforce
assignment, white-labeling, document uploads/OCR, external verification,
reminder delivery, automated approval, external analytics, managed-DB
access, production deployment. Expo-native hub parity is deferred (the
existing mobile application-status screen continues to consume the
unchanged `/application/status` endpoint).

## Strategic role boundary

```text
Platform-admin Pilot Operations Dashboard: IMPLEMENTED.
Provider Approval Status & Activation Hub: THIS TASK.
Provider Dashboard: FUTURE NEXT MAJOR PROVIDER PRODUCT SURFACE.
Organization-admin/workforce dashboard: FUTURE, NOT IMPLEMENTED.
```

## Test map

- API: `pnpm --filter @workspace/api-server run test:activation-status`
  (11 tests: auth, owner scoping, full journey truthfulness, next-action
  order, verification recovery, rejected/suspended handling, redaction
  contract). Wired into the CI scripted-suite loop.
- Web: `artifacts/web/src/__tests__/provider-activation-hub.test.tsx`
  (15 tests: states, hero copy, checklist locking, deep links, readiness
  cards, share states, recovery actions, honest-copy guards, axe).

## Reuse update (2026-08-28) — dashboard Next Best Action (Phase A)

The provider dashboard (`/provider/dashboard`) now renders this hub's
server-derived `nextAction` as a Next Best Action card, consuming the same
owner-scoped `GET /providers/me/activation-status` read via the existing
generated hook (shared query key — one cached request across hub and
dashboard). The hub remains the authoritative activation surface: the
dashboard card deep-links back here for `wait_for_review`,
`review_update_needed`, and `contact_support` states and never recomputes
or contradicts hub truth. No endpoint or schema change was needed.

## Drift-resilience contract (2026-08-28) — first-return reads never 500 on a pre-Gate-B database

The hub's owner reads (`GET /providers/me/activation-status`,
`GET /providers/application/status`, `GET /providers/application`) are now
schema-drift-safe: on a deployed database where the frozen Gate B additive
artifacts have not been applied yet, they degrade to the truthful pre-artifact
state instead of 500 (`rejectionReason: null`, empty submission history,
`bookingPage` unpublished with no slug, `serviceAreaConfigured: false`).
Selection rule: **stable signup-era columns are the required read set; Gate
B-pending additive columns are attempted eagerly and degraded on
`42703`/`42P01` only** (walked through the Drizzle `cause` chain via
`isSchemaDriftError` in `routes/providers.ts`). Degraded reads log a
structured `logger.warn` naming the missing relation. Nothing is fabricated:
approval, verification, 401/403, and ownership boundaries are untouched, and
a missing application/profile row still 404s. Migrated databases take the
eager path unchanged. Guarded by `test:return-path-drift` (11 tests, CI
scripted loop). Full rationale and evidence:
`docs/provider-onboarding-return-path-reliability-plan.md`.

## Drift-resilience extended to all provider-owned reads (2026-08-28)

The provider route read audit (`docs/provider-route-read-audit.md`) extended
the same contract beyond the hub: the shared `getOwnProfile` helper and every
adjacent provider-owned read (services/availability gates, service area,
emergency openings, vacation ranges, listing preview, booking page,
dashboard/metrics, bookings list/detail, outcome history,
reschedule-requests, rescheduling-history) now degrade to truthful
pre-artifact states instead of 500 on a pre-Gate-B database.
`isSchemaDriftError` moved to the shared
`artifacts/api-server/src/lib/schema-drift.ts`. The hub's own reads and
semantics are unchanged. Additional regression guard:
`test:route-read-drift` (19 tests, CI scripted loop).

## Progress & next-step clarity (2026-08-28) — mobile CTA priority + "what follows"

The hub hero now renders in strict mobile-first priority order: status +
reassurance → ONE primary server-derived next action → compact progress
summary → checklist below. The next-action card gained a factual "what
follows" line (`NEXT_ACTION_COPY[action].after`,
`data-testid="activation-next-after"`) describing what the completed step
enables — never promising approval, bookings, or demand. The progress
summary stays text-first ("N of M steps complete" from the server's
`milestonesCompleted`/`milestonesTotal`) with a semantic
`role="progressbar"` meter. No API, schema, or readiness-rule change:
`deriveActivationNextAction`, `computeReadiness`, and the milestones model
are reused untouched; clients still never recompute readiness. No
provider-facing schema/drift banner exists or should be added — schema
compatibility is an internal operational concern (see the route read audit);
only feature-specific truthful states are shown. Verified live at 390×844
(CTA above the fold, zero horizontal overflow) and desktop; web suite 240
tests incl. 3 new progress/next-step tests and axe scans.
