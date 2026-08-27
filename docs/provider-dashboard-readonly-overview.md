# Provider Dashboard — Read-Only Conversion Overview (Blueprint)

**Created:** 2026-08-28, branch `docs/provider-dashboard-readonly-overview`.
**Type:** documentation/design blueprint only — this file changes NO runtime
behavior, adds NO routes, tables, APIs, clients, or dependencies.
**Companion docs:** `provider-dashboard-capability-inventory.md`,
`provider-dashboard-conversion-playbook.md`,
`provider-dashboard-future-boundaries.md`, optional static concept
`provider-dashboard-wireframe.html`.

## The single most important truth first

An initial, conversion-first provider dashboard **already exists and is
merged** at `/provider/dashboard` (2026-08-27, `feat/provider-dashboard`,
documented in `docs/provider-dashboard.md`). This overview is therefore an
**evolution blueprint**, not a greenfield proposal. Anyone planning
provider-dashboard work must read the capability inventory before building
anything — most of the classic "dashboard MVP" is shipped, and duplicating it
would violate the repo's continuity rules.

What exists today (verified against source, `pages/portal/dashboard.tsx` +
`GET /api/providers/me/dashboard`):

- greeting + today's booking count + next appointment (marketplace timezone);
- quick actions (availability, share link, bookings);
- readiness summary card + first-booking conversion card;
- upcoming bookings (7/30-day toggle, privacy-trimmed client names, FSA/city);
- personal performance metrics (completion/cancellation/no-show/repeat, honest
  empty states, text chips beside colors);
- booking-link section: existing `BookingPageCard` (publish, copy, native
  share, QR) + source-attribution chart (allowlisted sources);
- recent activity (derived from latest booking states);
- honest "coming soon" earnings preview (no payments claimed).

What does NOT exist yet (the real gaps this blueprint targets):

- a **next-best-action card** on the dashboard (the server-derived
  `nextAction` shipped with the Activation Hub, PR #64 — exists but is not
  wired into the dashboard);
- **pending reschedule-request surfacing** on the dashboard (the review flow
  exists on `/provider/bookings`; the dashboard doesn't count or link it);
- **availability exceptions** (block-off dates, emergency openings) — a
  standing deferred ledger item; current availability is weekly recurring
  windows only;
- reminders, offers/engagement, payments, organization/workspace — FUTURE.

## Purpose

The provider dashboard is the provider's **daily business home**, not an
internal analytics screen. Within seconds it must answer: *What do I need to
do today? Who is my next client? What changed? Is my page ready and shared?
Do I have an opening to fill? Can I protect my time quickly? What next step
helps me get or manage bookings?* It should leave the provider feeling
organized, professional, in control, supported — and more likely to keep
using and pay for Foot.

Current vertical: mobile foot care (five-provider Southern Ontario pilot).
Design rule: every element below is written around **generic
appointment-provider value** — nothing is foot-care-specific except example
copy — so the same dashboard serves any local service market and stays
adaptable for future online, regional, or organization-led markets.

## Section-by-section concept

Statuses use exactly: `IMPLEMENTED`, `EXISTS BUT NEEDS WIRING`,
`NEEDS NEW BUILD`, `FUTURE / DEFERRED`, `OUT OF SCOPE`.

### 1. Today at a glance — IMPLEMENTED

Greeting + provider identity, today's booking count, next appointment, and
the no-booking empty state already ship. Honest copy in production today:
"You have N bookings today — you're all set." / "No bookings today — a great
day to share your booking link." Proposed refinement (copy-only, no new
data): add "urgent action needing attention" line when a pending
reschedule request exists — `EXISTS BUT NEEDS WIRING` (data lives in booking
rows with status `rescheduled`; the dashboard payload already carries
upcoming bookings with status, so a count/link is a small wiring change).
Booking-page visibility status: `IMPLEMENTED` (BookingPageCard shows
live/unpublished truthfully).

### 2. Next best action — EXISTS BUT NEEDS WIRING (highest-value gap)

The Activation Hub (PR #64) already computes a truthful, journey-ordered
`nextAction` server-side (`GET /providers/me/activation-status`, readable in
every application state). The dashboard should render ONE action at a time
from that same source — no second derivation, no client-side rules. Examples
(all mappable to existing `nextAction` codes): finish service area, add
availability, publish page, share link. Two proposed additions require new
codes and pilot evidence: "review your pending reschedule request"
(`NEEDS NEW BUILD`, small — booking rows already prove the state) and
"upcoming appointment — be ready" (`NEEDS NEW BUILD`, small).
Hard rules (inherited from the hub, non-negotiable): no fake urgency, no
false scarcity, no lost-revenue claims without evidence, no "you are losing
clients" pressure, no ranking, no manipulative nudges; always explain why;
always deep-link to the existing destination.

### 3. Upcoming work — IMPLEMENTED core; actions EXISTS BUT NEEDS WIRING

Today/next-7/next-30 list ships with privacy-trimmed fields (client first
name + last initial; FSA/city only — full address/phone stay on the
authorized `/provider/bookings` detail, which serves actual service
delivery). Reschedule review, eligible cancel, eligible no-show, and
support escalation all exist on `/provider/bookings` (roadmap #13 rules,
server state machine). Blueprint: dashboard rows link into those existing
flows (`EXISTS BUT NEEDS WIRING`); inline actions on the dashboard itself are
optional later polish. A "pending reschedule requests" group and "recent
changes" group reuse existing statuses. **Do not create a second booking or
scheduling engine.**

### 4. Booking-link growth card — IMPLEMENTED

Live status, professional URL, copy, native share, QR, preview, and the
safe source-attribution summary all ship (BookingPageCard + attribution
chart). This is already one of the most visible dashboard components, second
only to the greeting. The conversion playbook doc adds the truthful
social/local guidance (Instagram bio, Facebook post, post-visit text, Google
Business Profile, printed QR, email signature/website, TikTok profile) —
guidance is marketing copy, not product work. The dashboard never promises
marketplace traffic or guaranteed bookings; canonical line: "Share your page
anywhere clients already find you." Works identically for any local service
market: the link + QR + share sheet are vertical-neutral.

### 5. Schedule control — partly IMPLEMENTED, partly FUTURE / DEFERRED

Manage availability, view service areas, manage services: `IMPLEMENTED`
(existing portal pages; dashboard quick actions already link to
availability). "Block off time" and "Add an emergency opening":
`FUTURE / DEFERRED` — they require the Availability Exceptions model
(date-specific overrides on top of weekly recurring windows), a standing
TODO-ledger item. No fake buttons ship today and none are proposed until
that model exists. Reuse rule: exceptions must extend the existing
availability + travel/setup-buffer engine — never a second engine.
Why this section converts: **providers pay for tools that save them
coordination time and protect their schedule** — schedule control is the
most direct expression of that promise.

### 6. Provider-owned business health — IMPLEMENTED (restrained by design)

Bookings, completed, upcoming, completion/cancellation/no-show rates,
repeat-client signal, and source mix all ship — own data only, resolved-
denominator rates, honest empty states when volume is insufficient, plain-
language supportive copy, no comparisons, no retention intent, no risk
flags, no punitive language, no client identities. Classification of
possible additions: period-over-period trends (`NEEDS NEW BUILD` — simple
date-window queries over existing rows), on-time rate (`FUTURE / DEFERRED`
— start times are not tracked; requires future event design), rating
display (`FUTURE / DEFERRED` — deferred until review volume is meaningful).
No analytics pipeline is authorized in this phase.

### 7. Recent activity — IMPLEMENTED with an honest limitation

The shipped timeline derives from current booking rows ordered by
`updatedAt` — it reflects each booking's **latest** state, not an
append-only event history. Booking-page-published or service-area-updated
events have no persistence today; adding them is `FUTURE / DEFERRED`
(event design). The blueprint explicitly forbids inventing event
persistence for cosmetic timeline variety.

### 8. Approval and readiness — IMPLEMENTED as designed here

Exactly the proposed pattern already ships: a compact
`ReadinessSummaryCard` entry point on the dashboard, with the full journey
living at `/provider/application-status` (Activation Hub). Proposed copy
refinement: surface the hub's "X of 9 steps complete" figure on the card
(`EXISTS BUT NEEDS WIRING` — the activation endpoint already returns
milestone counts). No duplication of the hub on the dashboard — ever.

### 9. Support and trust — IMPLEMENTED

`SupportContactLink` renders at the provider-layout footer (and inside hub
sections). Providers need reliable help during setup, booking changes, and
account review; the platform support contact is the answer. No support chat
system is proposed for this phase.

## Value framework (the "why" behind every element)

| Provider need | Dashboard answer | Status | Business value |
|---|---|---|---|
| "What should I do?" | Next best action (hub `nextAction`) | EXISTS BUT NEEDS WIRING | Faster activation |
| "What is on my schedule?" | Today + upcoming bookings | IMPLEMENTED | Less coordination chaos |
| "How do clients book me?" | Booking-link growth card | IMPLEMENTED | More self-service bookings |
| "Can I protect my time?" | Availability/service-area controls | IMPLEMENTED (exceptions FUTURE / DEFERRED) | Fewer bad-fit bookings |
| "Am I ready?" | Readiness entry point → hub | IMPLEMENTED | Higher publish completion |
| "What changed?" | Activity + reschedule surfacing | IMPLEMENTED / EXISTS BUT NEEDS WIRING | Fewer missed actions |
| "Is this helping?" | Simple personal metrics | IMPLEMENTED | Clear reason to continue |
| "Can I get help?" | Support entry | IMPLEMENTED | More trust and retention |

## UX and accessibility overview

- **Mobile-first hierarchy** (390 px): greeting/today → next best action →
  upcoming → booking-link card → readiness entry → metrics → activity →
  support. Desktop adapts to a two-column layout (schedule left,
  growth/health right) without reordering meaning. See the static wireframe
  (`docs/provider-dashboard-wireframe.html` — READ-ONLY CONCEPT).
- Touch targets ≥ 44 px; one primary action per card; progressive disclosure
  (activity collapsed by default — already shipped); no clutter: max one
  next-best-action at a time.
- States: skeleton loading, retryable error, honest empty states
  ("No bookings today…") — all already shipped patterns; keep them.
- Keyboard: logical tab order, focus returns to the triggering control after
  modals/retry; landmarks: one `main`, labelled sections, single h1; status
  always text-beside-color (shipped convention).
- No dark patterns: no forced onboarding walls after approval (dashboard
  renders fully with a readiness card, never a blocking overlay), no fake
  progress, no hidden blockers, no countdowns.

## Phased implementation blueprint (future work — NOT built in this task)

### Phase A — Dashboard MVP: **SHIPPED except one card**
Today card ✔ · upcoming ✔ · booking-link share card ✔ · approval-status
entry ✔ · support entry ✔ · **next-best-action card = the remaining Phase A
item** (wire `GET /providers/me/activation-status` into the dashboard).
Dependencies: activation hub endpoint (merged). Risks: duplicate guidance if
the readiness card and action card overlap — resolve by making the action
card the single guidance surface and the readiness card a pure progress
entry. Privacy: none new (owner-scoped read). Authorization: none new.
Conversion value: the dashboard finally answers "what should I do?" in one
glance. Validate with pilot evidence: weekly reviews showing providers stuck
between approval and publish.

### Phase B — Operational controls
Availability exceptions (block-off dates, emergency openings) + quick
service-area/service links (links already exist). Dependencies: new
date-specific exceptions model extending the existing availability engine +
slot generation + buffer rules; OpenAPI + migrations (the first schema work
in this roadmap). Risks: double-booking edge cases at exception boundaries;
timezone correctness; slot-cache invalidation. Privacy: none new.
Authorization: provider-owned rows only. Conversion value: schedule
protection is a direct pay-for reason. Pilot evidence needed first:
providers reporting real block-off/emergency needs in weekly reviews (the
decision rule "validate reminder demand before building" applies equally
here).

### Phase C — Provider personal insights: **largely SHIPPED**
Own bookings/outcomes ✔ · repeat-client signal ✔ · source attribution ✔ ·
activity timeline ✔ (latest-state limitation documented). Remaining:
period-over-period trends and true event history — build only if weekly
reviews show providers asking "is this improving?". Risks: analytics creep;
keep it restrained. Privacy: own data only, unchanged.

### Phase D — Ethical engagement tools
Communication preferences → appointment reminders → provider-created
in-portal notices → future offer system (design constraints in
`provider-dashboard-future-boundaries.md`). Dependencies: consent model,
frequency caps, notification delivery infrastructure (none exists — honest).
Risks: spam/dark-pattern drift; moderation burden. Privacy: consent-based
client contact is a new data-use category — requires explicit policy work.
Authorization: provider→own-clients only. Conversion value: retention and
repeat bookings. Pilot evidence gate: decision rule already recorded —
validate reminder demand before building notification infrastructure.

### Phase E — Organization/workforce expansion: **FUTURE, NOT IMPLEMENTED**
Organization/workspace model, org admin, provider affiliation, client
groups, tenant-scoped permissions, org metrics, branding. Dependencies:
everything in `provider-dashboard-future-boundaries.md`; a real paying
organization customer. Risks: premature multi-tenancy tax on a five-provider
pilot. Privacy/authorization: entirely new scoping model — the reason it
must not be started casually. Conversion value: second commercial path.
Evidence gate: pilot closure decision + real organization demand.

## Recommended next actual implementation step

**Phase A completion:** wire the next-best-action card (and the pending
reschedule count line) into `/provider/dashboard`, reusing
`GET /providers/me/activation-status` and existing booking rows. Small,
evidence-backed, zero new schema. Availability Exceptions (Phase B) follows
per the established roadmap, gated on weekly-review evidence.

## Status update (2026-08-28) — Phase A implemented

The Phase A completion wiring recommended by this blueprint is now
IMPLEMENTED on the existing `/provider/dashboard`
(`feat/provider-dashboard-phase-a-actions`): the Activation Hub's
server-derived `nextAction` renders as a Next Best Action card (existing
`GET /providers/me/activation-status` hook reused; no logic duplicated), and
pending client reschedule requests (`rescheduled` bookings) are surfaced
with a count + privacy-trimmed soonest request and a deep link to the
existing bookings Reschedules tab (`?tab=rescheduled`).
`GET /providers/me/dashboard` gained a `pendingReschedules` field derived
from rows it already loads — no new endpoint, no schema change, no
migration. Priority: reschedule work above the next action only when
present. Details in `docs/provider-dashboard.md` (Phase A section).
Phase B (Availability Exceptions) remains DEFERRED and evidence-gated;
Phases C–E unchanged.
