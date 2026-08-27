# Weekly Pilot Review — Operating Workflow (Part 3)

**Added:** 2026-08-28, branch `docs/pilot-operations-review-pack`.
**Audience:** the platform operator (platform administrator) running the
five-provider Southern Ontario pilot.
**Time budget:** 15–30 minutes, once per week, same weekday each week.
**Tool:** the `/admin/pilot` dashboard (Parts 1–2, merged). This document adds
no product features — it is the repeatable decision workflow on top of them.

The dashboard shows what is happening. It never explains why. Every number
below is a prompt for a conversation or an investigation, not a verdict.

## Before you start

- Sign in with a platform-administrator account and open `/admin/pilot`.
- Have last week's review record open (template below) for comparison.
- Small pilot numbers (5 providers, dozens of bookings) are **directional
  learning signals, not statistically conclusive proof**. One cancellation can
  move a rate by double digits. Read trends and talk to providers; do not
  chase single data points.

## The 15–30 minute weekly review

1. **Confirm dashboard freshness and pilot dates.** Check the generated-at
   timestamp and the pilot window on the context card. If the window shows the
   `Projected window` badge, the dates are inferred from booking data —
   configure `PILOT_START_DATE` / `PILOT_END_DATE` when the real window is
   agreed. Note any `configWarning`.
2. **Check approved-provider count against the five-provider target.** The
   target is display context, never a denominator. If below target, review
   recruiting/approval progress first — most other numbers are meaningless
   without providers.
3. **Review activation milestones and identify blocked providers.** Use the
   activation ladder and the provider health table to see who is stuck at
   which onboarding step (profile, verification, service area, service,
   availability, published page).
4. **Review published booking pages and providers without a first booking.**
   Published-but-no-booking is the highest-leverage outreach group: confirm
   whether they actually shared their link.
5. **Review bookings and appointment outcomes.** Total bookings in the window,
   plus per-provider booked/completed/cancelled/no-show counts.
6. **Review completion, cancellation, and no-show rates.** Compare against the
   pilot guardrails (completion ≥85%, cancellation ≤20%, no-show ≤10%) only
   where meaningful volume exists. "No completed appointments yet" is an
   honest state, not a failure.
7. **Review source attribution.** Which share channels bring bookings;
   `Direct / unknown` is expected early. Zero data is a sharing problem before
   it is a conversion problem.
8. **Review support escalations.** Count in the window and whether any are
   unresolved. Guardrail: ≤3 manageable escalations.
9. **Update retention intent after direct provider conversations.** Only set
   Yes/No after actually speaking with the provider; leave Unknown otherwise.
10. **Select ONE provider outreach action.** The single most valuable call,
    onboarding assist, or check-in this week. One, not five.
11. **Select ONE product-learning action.** The single most valuable thing to
    confirm, ask, or validate about the product this week.
12. **Record owner, date, and follow-up.** Fill the review record below, name
    an owner for both actions, and set the follow-up date (normally next
    week's review).

## Review-record template (copy per week)

Keep records in your operator notes, not in the repository. Never add client
identities, provider verification references, support notes, addresses, care
notes, or any private data to a review record.

```text
Review date:
Pilot window:
Dashboard data freshness:
Providers approved:
Providers activated:
Providers published:
Providers with first booking:
Bookings:
Completion rate:
Cancellation rate:
No-show rate:
Support escalations:
Retention intent summary:
Top provider outreach action:
Top product-learning action:
Owner:
Follow-up date:
```

## Decision rules — cautious investigation prompts

These rules tell you where to look next. They deliberately use "review",
"confirm", "ask", "investigate", and "validate" — the dashboard cannot prove
causation, and neither should you.

- **If providers cannot reach published status:** prioritize onboarding help
  and approval-status clarity. Ask each blocked provider which step confused
  them before changing anything.
- **If providers are approved but not activated:** review service-area,
  service, availability, and booking-page setup friction. Investigate whether
  the blocker is understanding, effort, or a defect.
- **If providers are published but have no bookings:** confirm whether they
  actually shared their link. Then review source attribution and, only after
  sharing is confirmed, booking-page conversion.
- **If cancellations or no-shows are elevated:** review booking fit (services,
  areas, times offered) and cancellation-policy clarity. Validate reminder
  demand with providers before building any notification infrastructure.
- **If support escalations recur:** review response time and recurring
  workflow gaps before building a broader support console.
- **If retention intent is low:** conduct direct provider interviews before
  expanding scope. Ask what would make them stay; do not guess.
- **If providers have bookings but report operational friction:** prioritize
  the provider dashboard and availability exceptions on the conversion
  roadmap — evidence of real usage plus friction is the strongest build
  signal the pilot can produce.

## Pilot closure criteria — decision framework

Apply this at the end of the pilot window (2–5 weeks). "Where meaningful
volume exists" means enough resolved bookings that one appointment does not
swing the rate — with pilot-scale numbers, treat every rate as directional.

**Continue/expand candidate — all of the following broadly hold:**

- At least 4 of 5 providers activate.
- At least 3 providers share a booking page.
- At least 15 total bookings occur.
- Completion rate is at least 85% where meaningful volume exists.
- Cancellation rate is 20% or lower where meaningful volume exists.
- No-show rate is 10% or lower where meaningful volume exists.
- Support escalations are manageable (guardrail: ≤3, none unresolved).
- At least 3 of 5 providers indicate they want to continue.

**Iterate before expansion — pilot taught something specific; fix it first:**

- Activation/publishing friction persists.
- Providers struggle with availability or booking-link sharing.
- Completion/cancellation/no-show patterns identify a clear workflow issue.
- Provider retention intent is weak but actionable feedback is clear.

**Pause/reassess — do not expand on a broken foundation:**

- Booking is unreliable.
- Privacy/security/support risks are unresolved.
- Providers do not reach first value despite hands-on onboarding.
- Core workflow failures materially affect providers or clients.

An honest "iterate" or "pause" outcome is a successful pilot: the pilot
exists to buy learning cheaply. Meeting every threshold on five providers is
a reason to expand carefully, not proof of product-market fit.

## Strategic boundary (unchanged by this workflow)

- Platform-admin pilot dashboard (`/admin/pilot`): **implemented** (Parts 1–2).
- Organization-admin / workspace / workforce dashboard: **future, NOT
  IMPLEMENTED** — documented only.
- Provider-facing pilot dashboard: **future, NOT IMPLEMENTED**. (The existing
  `/provider/dashboard` page is each provider's own performance surface; it
  exposes no pilot-cohort metrics, no other providers' data, and no retention
  intent.)
- Future conversion direction, guided by pilot evidence: Provider Approval
  Status Page, then Provider Dashboard, then Availability Exceptions.
