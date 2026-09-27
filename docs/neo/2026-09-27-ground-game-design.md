# Ground Game — source-to-lead engagement layer (design for review)

**Status: DESIGN ONLY. No code, no migration, no schema declaration written.**
Prepared 2026-09-27 (E1 session) at the owner's request. Stop point: owner
review of this document before any Phase 1 file is created.

This layer is not a separate product. It is the operational spine that the
Admin Command Center (`/admin`), the Provider Dashboard (`/provider/dashboard`)
and the later vendor scorecard / admin analytics read from. It adds a
**Leads / Ground Game** entry point; it does not replace Bookings, Services,
Credentials or Profile.

---

## Phase 0 — read-only reconciliation (evidence table)

All checks below were read-only (git, GitHub REST, Railway GraphQL read, live
HTTP). No push, deploy, secret change, DDL or purge was performed.

| Surface | Observed (2026-09-27 ~03:35Z) | Evidence | Disposition |
|---|---|---|---|
| Local `main` | `933d165` (03:13Z); tree clean except untracked `frontend/yarn.lock` (preview shim artefact, ignore) | `git rev-parse HEAD`, `git status --short` | 3 local commits after `92331da` are **not on GitHub**: `7b2bb2c` (Phase 2 tests/pytests), `a058f64` (scorecard + earnings fix), `933d165` (Phase 4 proposals, metrics definitions) |
| GitHub `main` | `ee0d180` "Conflict 260926 2310 (#93)" merged **03:22Z** | `GET api.github.com/repos/sbtheg17-market/foot/commits/main` | PR #93 = branch `conflict_260926_2310` = `92331da` → Phase 2 dialogs, feeds and decision-email code are now on `main`. Scorecard is not |
| GitHub branches | `conflict_260926_1108`=`b2e4ffb`, `_1408`=`a058f64`(old workspace HEAD `8dcaecd` lineage), `_2310`=`92331da` | `GET …/branches` | Reference only; never base work on `conflict_*` (AGENTS.md) |
| Railway `foot` deploy | last deployment `SUCCESS` **02:52Z**, commit `5177fd4` (squash of #91), reason `deploy` (variable change) | Railway GraphQL `deployments(first:3)` | **Contradiction:** `main` advanced at 03:22Z but no deployment followed in ≥13 min. Either the GitHub trigger is delayed/disabled or auto-deploy is off. Needs owner check in Railway → Service → Settings → Source (no change made) |
| Railway variables (names only) | `DATABASE_URL, JWT_SECRET, JWT_EXPIRES_IN, NODE_ENV, JWT (stale), EMERGENT_EMAIL_KEY, EMAIL_FROM_NAME, PUBLIC_APP_URL` + `RAILWAY_*` | Railway GraphQL `variables` | **JWT_SECRET contradiction resolved:** `JWT_SECRET` is set (Session 4 upsert), deploy is SUCCESS, `/api/healthz` 200 and login was live-verified. Stale `JWT` still present → owner may delete (not done; out of authorization) |
| Railway live bundle | `/api/healthz` 200; `/api/admin/*` unauth 401 (router-wide gate — not feature evidence); `/api/providers/me/scorecard` unauth **404** (route absent → scorecard not deployed, as expected); bundle `index-DsoWasjk.js` | curl | Consistent with commit `5177fd4` |
| Supabase (managed DB) | Reached only through the preview API's `GET /api/admin/system-status`: DB connected, 10/10 frozen artifacts applied, `overall: healthy` | preview pytest `test_admin_phase2_feeds.py` 14/14 earlier this session | No direct connection opened by the agent. **Phase 4 artifacts (`users.is_demo`, `admin_audit_log`) remain NOT applied** — the apply confirmation question was superseded by this design request; nothing was run |
| Preview (this workspace) | `https://8f3f5a3f-d59c-4ffd-8b8a-8c0d683fb9e8.preview.emergentagent.com` serving local `933d165` | curl/screenshots | Test surface for Phase 1 |
| Unfinished files | none: every Phase 2/3 file has tests and a LOG entry; `scripts/railway-set-email-vars.py` is a completed one-off (no secrets inside) | `git status`, Appendices F–H | — |

Owner actions surfaced (no agent action taken): revoke the Railway project
token; check why the 03:22Z merge did not deploy; Save to GitHub again to
publish `7b2bb2c..933d165`; delete stale `JWT`.

---

## 1. Current architecture inventory (what exists, verified in code)

**Stack.** pnpm workspace · Express 5 + Drizzle/PostgreSQL (`artifacts/api-server`,
`lib/db`) · React 19 + Vite + wouter + TanStack Query (`artifacts/web`) ·
contract-first OpenAPI (`lib/api-spec/openapi.yaml` → orval clients in
`lib/api-client-react`, `lib/api-zod`) · Expo mobile (out of scope here).

**Tables (28, `lib/db/src/schema`).** `users` (role enum client/provider/admin,
email, phone) · `account_roles` · `provider_profiles` · `provider_applications`
(+ `_events`, `_submissions`) · `services` · `availability` · `travel_zones` ·
`provider_coverage_areas` · `provider_service_areas` · `provider_blocked_ranges`
· `provider_emergency_openings` · `verification_docs` · `bookings`
(**`source` text allowlist column** — instagram/qr-card/text/facebook/website,
recorded at creation) · `booking_outcome_history` · `booking_reschedule_history`
· `booking_reschedule_proposals` · `prevented_booking_records` · `prevented_bookings_daily`
· `reviews` · `invoices` · `support_tickets` + `support_messages` (status
open/in_progress/resolved; messages by any user; admin PATCH records a resolution
message) · `provider_notifications` · `push_tokens` · `marketplace_events`
(typed enum: provider activation funnel + client conversion funnel; actor,
provider, client, service, booking, `correlation_id`, `metadata` jsonb) ·
`pilot_provider_retention`.

**No** `public.profiles`, **no** tenant/marketplace_id layer, **no** CRM /
lead / contact table, **no** generic "conversation" table (support_messages is
ticket-bound), **no** audit table (proposed, not applied).

**Routers (`/api`).** `auth`, `providers` (owner-scoped `/me/*` incl. dashboard,
metrics, scorecard, readiness, earnings), `booking-pages` (public slug pages,
source attribution at booking creation), `bookings`, `reschedule`, `reviews`,
`invoices`, `notifications`, `admin` (router-wide `requireAuth + requireRole("admin")`;
verification queue/docs/events, provider-applications queue/events/approve/reject,
support escalations feed, system-status, demo-data), `support` (tickets,
messages, admin PATCH), `admin-pilot`.

**Role checks (`middlewares/auth.ts`).** `requireAuth`, `requireRole(...)`,
`requireApprovedProvider`, `requireApprovedProviderIfProvider`, `requireSelf`.
Composite `requireProviderOperation = [requireAuth, requireRole("provider"), requireApprovedProvider]`.
Ownership is enforced per route by filtering on the caller's
`provider_profiles.id` / `users.id` — there is no row-level policy layer.

**Web surfaces.** `/admin` command center (QueueCards + three decision dialogs,
recent activity feeds), `/admin/verification`, `/admin/pilot`, `/admin/system`;
`/provider/*` portal (dashboard with NextBestAction, PendingReschedules,
UpcomingBookings, PerformanceMetrics, **ScorecardCard**, booking link + source
attribution chart, RecentActivity, EarningsPreview; bookings, services,
availability, earnings, profile, credentials, notifications, readiness,
service area, travel zones). Shared UI: `components/ui/*` (Radix), sonner toasts,
`lib/time-ago.ts`, `lib/marketplace-time.ts`.

**Event/notification model.** `marketplace_events` is domain-typed (no
lead types); `provider_notifications` + push are provider-only in-app
notifications; decision e-mails go through the managed proxy with a guardrail
gate (`lib/decision-emails.ts`) — the only outbound channel that exists, and it
is one-way (no inbound).

**Metrics discipline.** `docs/metrics-definitions.md` (every displayed figure
has rule + SQL + fixture test; "not shown by decision" list). Admin cards
already distinguish facts from display definitions (e.g. `SLOW_DAYS`).

### Reuse vs. missing

| Need (from the brief) | Reuse | Missing |
|---|---|---|
| Source / offer | `bookings.source` allowlist and `booking-page.ts` normaliser; `public_slug` landing pages | A **source/offer record** (type, name, campaign/listing id, offer title, vertical, area, dates, owner, external ref, status) |
| Lead | `users` (client identity when known), `provider_profiles`, `services` | A **lead record** with attribution, channel, need, timing, consent, owner, next action, due date, status, outcome |
| Conversation | pattern from `support_messages` (author, timestamp) | A **lead-scoped conversation entry** with direction (inbound/outbound/internal/system), channel, verbatim body, original reference, "sent by platform" = false unless the platform actually sent it |
| Tasks / next owner | none | Next action + owner + due on the lead (Phase 1: fields on the lead, not a task table) |
| Routing / permissions | `requireRole`, `requireProviderOperation`, owner filtering pattern | Lead visibility = assigned provider or admin (server-side, every read) |
| Link to booking | `bookings` FK; client dedupe by `users.email` | `lead.booking_id` nullable FK (no new person/booking created) |
| Attribution confidence | none | `attribution_confidence` enum exact/inferred/unknown + manual reason |
| Vertical adapters | none | Config layer: labels, qualification field set, outcome vocabulary, guard rules per vertical |
| Audit | `provider_application_events` pattern | `lead_events` (Phase 2) or the proposed `admin_audit_log` |
| Metrics | `docs/metrics-definitions.md`, "not yet measured" rule already stated | Lead funnel definitions + `not_measured` sentinel in API |

---

## 2. Proposed data model (Phase 1 minimum; all additive)

Four new tables, one nullable FK column on nothing existing (bookings are
linked FROM the lead). No change to any existing table, enum or index.

```
sources
  id serial PK
  vertical            text NOT NULL            -- 'foot_care' | 'tire_sourcing' (adapter key; text, not enum, so a vertical needs no migration)
  source_type         text NOT NULL            -- facebook|kijiji|referral|website|flyer|phone|sms|email|campaign_link (allowlist enforced in API)
  name                text NOT NULL
  campaign_ref        text                     -- campaign / listing / ad identifier as printed on the platform
  offer_title         text NOT NULL
  offer_description   text
  area                text                     -- free text / FSA list
  starts_on           date
  ends_on             date
  owner_user_id       integer NOT NULL REFERENCES users(id)   -- admin who owns the source
  provider_profile_id integer REFERENCES provider_profiles(id) -- optional: offer belongs to one provider
  external_ref        text                     -- landing page URL or listing URL (stored, never fetched)
  status              text NOT NULL DEFAULT 'draft'  -- draft|active|paused|expired
  created_at, updated_at timestamp NOT NULL DEFAULT now()

leads
  id serial PK
  vertical            text NOT NULL            -- copied from source at creation; adapter key
  source_id           integer REFERENCES sources(id)          -- nullable: "unknown source" is allowed and shown as such
  attribution_confidence text NOT NULL DEFAULT 'unknown'      -- exact|inferred|unknown
  attribution_reason  text                     -- required when confidence = inferred (manual reason)
  referral_code       text
  contact_channel     text NOT NULL            -- platform_message|email|phone|sms|referral|website
  contact_name        text
  contact_email       text                     -- optional; provider sees masked unless assigned
  contact_phone       text                     -- optional; same rule
  client_user_id      integer REFERENCES users(id)            -- set when the contact is an existing client (dedupe by email, admin-confirmed)
  stated_need         text NOT NULL
  area                text
  timing              text                     -- free text in Phase 1 ("next week", "Tue pm")
  consent_status      text NOT NULL DEFAULT 'unknown'         -- unknown|inbound_only|contact_ok|do_not_contact
  qualification       jsonb NOT NULL DEFAULT '{}'             -- adapter-defined fields (see §5); PHI-sensitive keys listed by adapter are never returned to non-owners
  assigned_provider_profile_id integer REFERENCES provider_profiles(id)
  owner_role          text NOT NULL DEFAULT 'admin'           -- who holds the next action: admin|provider|client
  next_action         text NOT NULL            -- one sentence, required
  next_action_due_at  timestamp
  status              text NOT NULL DEFAULT 'new'             -- new|assigned|awaiting_provider|awaiting_client|awaiting_partner|qualified|closed
  outcome             text                     -- booked|sold|referred|declined|unreachable|no_fit|lost|pending (NULL until closed)
  outcome_reason      text
  booking_id          integer REFERENCES bookings(id)         -- link, never create
  support_ticket_id   integer REFERENCES support_tickets(id)
  created_by_user_id  integer NOT NULL REFERENCES users(id)
  created_at, updated_at timestamp NOT NULL DEFAULT now()

lead_messages                                   -- the "conversation"
  id serial PK
  lead_id             integer NOT NULL REFERENCES leads(id)
  direction           text NOT NULL            -- inbound|outbound|internal_note|system_event
  channel             text NOT NULL            -- platform_message|email|phone|sms|in_person|system
  body                text NOT NULL            -- verbatim; never edited after insert (API has no PUT)
  original_ref        text                     -- link/id of the original message on the external platform
  occurred_at         timestamp NOT NULL       -- when it happened (manual entry may be back-dated)
  author_user_id      integer REFERENCES users(id)   -- who recorded it (NULL only for system_event)
  visibility          text NOT NULL DEFAULT 'shared'  -- shared|admin_only  (provider never receives admin_only)
  sent_by_platform    boolean NOT NULL DEFAULT false  -- true ONLY when this system transmitted it; Phase 1 always false
  delivery_status     text                     -- NULL in Phase 1 (no channel); later: queued|sent|delivered|failed
  created_at          timestamp NOT NULL DEFAULT now()

lead_events                                     -- append-only audit of state changes (Phase 1 minimal: status/owner/assignment/outcome)
  id serial PK
  lead_id             integer NOT NULL REFERENCES leads(id)
  actor_user_id       integer REFERENCES users(id)
  type                text NOT NULL            -- created|assigned|status_changed|owner_changed|outcome_recorded|linked_booking|note_added
  from_value          text
  to_value            text
  created_at          timestamp NOT NULL DEFAULT now()
```

Indexes: `leads(assigned_provider_profile_id, status)`, `leads(status, next_action_due_at)`,
`leads(source_id)`, `lead_messages(lead_id, occurred_at)`, `lead_events(lead_id, id)`,
`sources(status, vertical)`.

Design choices to review:
- **Text + API allowlists instead of PostgreSQL enums** for vertical, source
  type, status, outcome — a new vertical or outcome must not need a migration.
  Trade-off: no DB-level enforcement; mitigated by zod validation from the spec.
- **Contact details live on the lead, not in `users`.** A lead is not a user
  until they book; `client_user_id` links when the admin confirms a match by
  e-mail. This is how "connect to an existing booking without duplicating the
  client" is met.
- **`qualification` jsonb** holds adapter fields; the adapter names which keys
  are sensitive (foot care: mobility/accessibility notes) and the API strips
  them for anyone who is not the assigned provider or an admin.
- **No task table in Phase 1.** One `next_action` + `owner_role` + due date on
  the lead satisfies "one visible owner and one next action". A `lead_tasks`
  table is Phase 2 (follow-ups after close).
- **`marketplace_events` is not extended.** Its enum is typed for activation
  and booking funnels; lead events get their own table so the analytics
  boundary stays explicit.

### What requires a migration
All four tables → one frozen artifact `docs/migrations/GROUND_GAME_LEADS_V1.sql`
(additive, Gate B). Nothing in Phase 1 can be built on existing tables without
misusing them (support_tickets is client-authored and ticket-semantic;
marketplace_events has a closed enum). **Not to be written until this model is
approved.** Drizzle declarations follow the apply, per the existing sequencing
rule.

---

## 3. Smallest Phase 1 file list

Contract first, then server, then web. Estimated 14 files + generated clients.

| # | File | Purpose |
|---|---|---|
| 1 | `docs/migrations/GROUND_GAME_LEADS_V1.sql` | frozen artifact (after model approval; applied only with Gate B approval) |
| 2 | `lib/db/src/schema/ground-game.ts` (+ export in `index.ts`) | Drizzle mirror — **after** apply |
| 3 | `lib/api-spec/openapi.yaml` | `/admin/sources` (GET list, POST, PATCH status), `/leads` (GET mine/all with server-side scope, POST, PATCH assign/status/owner/next-action/outcome/link-booking), `/leads/:id/messages` (GET, POST), `/leads/:id/events` (GET admin), `/providers/me/ground-game` (today view aggregate), `/admin/ground-game` (admin view aggregate) — then codegen |
| 4 | `artifacts/api-server/src/lib/ground-game-adapters.ts` | vertical config: labels, qualification field schema, sensitive keys, outcome vocabulary, guard rules (tire: availability states) |
| 5 | `artifacts/api-server/src/lib/ground-game.ts` | pure helpers: visibility filter, masking, "not_measured" builders, due/overdue classification, attribution validation (inferred ⇒ reason required) |
| 6 | `artifacts/api-server/src/routes/ground-game.ts` (mounted `/leads`, `/admin/sources`, `/admin/ground-game`) | routes; every lead read filtered by `assigned_provider_profile_id = caller's profile` unless admin; `admin_only` messages stripped for providers |
| 7 | `artifacts/api-server/src/__tests__/ground-game.test.ts` | unit: masking, scope filter, attribution rules, adapter guards, not_measured |
| 8 | `artifacts/api-server/src/__tests__/ground-game.integration.test.ts` | scratch-DB only: provider cannot read unassigned lead (403/404), admin reassign, booking link without duplicate user, message immutability |
| 9 | `artifacts/web/src/lib/routes.ts` | `provider.leads = '/provider/leads'`, `admin.groundGame = '/admin/ground-game'` |
| 10 | `artifacts/web/src/pages/portal/leads.tsx` | provider Daily Ground Game view (sections in §4) + actionable empty state |
| 11 | `artifacts/web/src/components/ground-game/lead-card.tsx`, `lead-drawer.tsx`, `conversation-list.tsx`, `add-note-dialog.tsx`, `outcome-dialog.tsx` | provider + admin shared components; adapter labels via a `useVertical()` helper |
| 12 | `artifacts/web/src/pages/admin/ground-game.tsx` (+ `components/admin-ground-game/source-form.tsx`, `assign-dialog.tsx`) | admin view; facts vs recommendations separated visually and in copy |
| 13 | `artifacts/web/src/App.tsx`, portal nav, `/admin` header nav, `/admin` QueueCard "Leads needing an owner" | entry points; the `/admin` card follows the what/why/next/done-when pattern |
| 14 | `docs/metrics-definitions.md` (section), `docs/ground-game.md` (ownership + channel policy), `backend/tests/test_ground_game.py` (read-only preview regression) | definitions, policy, regression |

Explicitly **not** in Phase 1: any ingestion, any send, any scraper, tasks
table, analytics beyond exact counts, GA4/GTM, tire adapter UI beyond the
config file and its unit tests (the adapter exists so nothing tire-specific
leaks into the foot-care flow; its screens come with the first tire pilot).

---

## 4. Views (proposed, subject to existing routes/permissions)

**Provider — `/provider/leads` "Daily Ground Game"** (only leads where
`assigned_provider_profile_id` = own profile):
- Today's new leads · Responses due today · Waiting for my reply
  (`owner_role = provider`) · Waiting for client (`awaiting_client`) ·
  Awaiting admin/partner info (`awaiting_partner`) · Overdue follow-ups
  (`next_action_due_at < now`, not closed) · Upcoming bookings linked to leads
  (`booking_id` set, scheduled ≥ now).
- Quick actions: add note (inbound/outbound/internal) · request details
  (sets `awaiting_client`, next action, due) · accept (`owner_role=provider`) ·
  decline / refer back (owner→admin with reason) · mark outcome · link booking
  (picker over own bookings only). "Reply" and "call" open the provider's own
  mail/phone app and then ask the provider to record what was sent — the
  platform never claims it sent anything.
- Source summary: per offer → inquiries, qualified, booked (exact counts of
  own leads only). Offer views: **"not yet measured"**.
- "What to do next": the 3 soonest-due `next_action` lines.
- Empty state names the cause: no source active → "Ask your admin to activate
  an offer"; source active but no lead → "No inquiry has been recorded yet —
  record one from the Add lead button"; not approved provider → existing gate.

**Admin — `/admin/ground-game`** (all leads):
- Active sources (with status controls) · Unassigned leads (`assigned` null) ·
  Overdue / stalled (due passed, or no message in N days — N is a display
  definition) · Source→outcome funnel (inquiries → qualified → booked/sold →
  lost with reasons; exact counts; "not yet measured" for views/response time
  until instrumented) · Provider response performance (**Phase 2**: needs
  first-response timestamps from `lead_events`; Phase 1 shows "not yet
  measured") · Failed routing (assigned provider not approved/inactive) ·
  Unresolved escalations (reuses support feed) · Offers attracting inquiries
  but not converting (fact: inquiries > 0 and booked = 0; recommendation text
  clearly labelled "Suggestion").
- `/admin` home gets one QueueCard: "Leads needing an owner" (unassigned +
  overdue), linking here.

---

## 5. Vertical adapters (configuration, not branches)

```ts
type VerticalAdapter = {
  key: 'foot_care' | 'tire_sourcing';
  labels: { lead: string; contact: string; offer: string; partner: string; item?: string };
  qualificationFields: Array<{ key: string; label: string; kind: 'text'|'select'|'number'|'date'|'boolean'; options?: string[]; required?: boolean; sensitive?: boolean }>;
  outcomes: string[];                       // subset/ordering of the shared vocabulary
  missingInfoRule: (q: Record<string, unknown>) => string[];   // drives "what is still missing"
  guards: Array<(lead, patch) => string | null>;              // reject unsafe states with a plain-language reason
};
```

**foot_care**: labels provider/client/service; fields requested_service (select
from provider's `services`), service_area, preferred_window, booking_readiness
(select), needs_referral_or_support (boolean), accessibility_notes
(**sensitive** — visible to assigned provider + admin only; never in list
payloads, events, e-mails or metrics). Guards: no outbound/system message may
contain the sensitive key; no AI-authored content field exists in Phase 1;
`awaiting_partner` maps to "awaiting admin".

**tire_sourcing**: labels buyer/item/shop; fields tire_size, quantity (2|4),
season_type, tread_condition, vehicle_fitment, buyer_area, budget_cents,
fulfilment_pref (pickup|delivery), source_listing_ref, shop_contacted,
availability_state (**unverified | possible_match | shop_confirmed | on_hand**,
default unverified), confirmed_price_cents, hold_expires_at. Guards:
`availability_state` cannot be set to `shop_confirmed`/`on_hand` without a
`lead_messages` inbound entry from channel ≠ system referencing the shop
(human-recorded confirmation); `confirmed_price_cents` requires
`shop_confirmed` or `on_hand`; outcome `sold` requires `on_hand` or
`shop_confirmed` + linked fulfilment note; any buyer-facing summary omits
items whose state is `unverified` or `possible_match`. A shop reply is an
inbound message, never auto-copied into a buyer-facing field.

Foot-care flow never loads the tire adapter; adapter is selected by
`lead.vertical` (copied from `source.vertical`).

---

## 6. Permissions and privacy boundaries

| Actor | Sources | Leads | Messages | Actions |
|---|---|---|---|---|
| Admin | full CRUD (status transitions) | all; assign/reassign; set owner/next action; link booking/ticket; record outcome | all, incl. `admin_only` | everything above + escalate |
| Approved provider | read: only sources of leads assigned to them (name/offer only) | only `assigned_provider_profile_id = own`; cannot see unassigned or others'; may change status among provider-owned states, decline/refer back, request info, record outcome, link **own** bookings | `shared` only; may add inbound/outbound/internal (own internal notes are `shared` to admin by design — providers get no admin-invisible space, admins do) | no assign-to-others, no source edits |
| Unapproved provider / client | none (`requireProviderOperation` gate; clients have no lead surface in Phase 1) | — | — | — |

Privacy rules enforced server-side:
- Contact e-mail/phone returned in full only to admin and the assigned
  provider; list payloads carry `contactName` + channel only.
- Adapter `sensitive` keys stripped from list payloads, events and any
  aggregate; returned only on the single-lead read to admin/assigned provider.
- `sent_by_platform` is server-set (never accepted from the client) and is
  `false` for every Phase 1 write; UI copy for outbound entries reads
  "Recorded by <name> · sent outside the platform".
- `attribution_confidence = exact` is only accepted when `source_id` is set
  **and** (`referral_code` matches the source, or the lead was created from a
  landing-page/booking-page context, or `campaign_ref` was quoted by the
  contact — admin selects the evidence kind); otherwise the API downgrades to
  `inferred` (reason required) or `unknown`. UI shows a confidence chip; never
  "exact" without stored evidence kind.
- No lead data enters `marketplace_events`, pilot metrics, e-mails or logs
  beyond ids and status words.
- Reviewer-private material from other domains (verification docs, application
  reviewer notes, other providers' leads) is never joined into lead payloads.

Ownership (recorded, not implied): admin owns source setup, routing, exceptions,
unassigned/overdue/escalated leads; provider owns timely response, clarification,
availability and fulfilment; client controls consent (`consent_status`,
`do_not_contact` blocks any future outbound channel); platform records handoffs
in `lead_events`. Invariant: every non-closed lead has exactly one `owner_role`
and a non-empty `next_action`.

---

## 7. Phase 1 acceptance tests (mapped)

| Brief | Test |
|---|---|
| Provider sees only assigned/authorized leads | integration: provider A `GET /leads` excludes B's and unassigned; `GET /leads/:id` of B's → 404; preview pytest with the QA provider |
| Admin can see and reassign | integration: admin lists all; `PATCH /leads/:id {assignedProviderProfileId}` writes `lead_events.assigned` and flips `owner_role=provider` |
| Every lead has source, offer, status, owner, next action | zod: `next_action` required non-empty; `source_id` nullable but then `attribution_confidence` forced `unknown` and UI shows "Source unknown" (fact) |
| Manual conversation stays linked to source + lead | integration: message → `lead_id`; response includes `source.offerTitle`; no endpoint edits `body` |
| Link to existing booking without duplicating client | integration: link booking → `leads.booking_id`; `users` count unchanged; `client_user_id` set only when e-mail matches an existing user and admin confirms |
| No external message claimed sent | unit: `sent_by_platform` ignored in request body, always false; UI test: outbound entry renders "sent outside the platform" |
| No attribution shown exact without evidence | unit: POST with `exact` and no evidence → stored `inferred`/`unknown`; component test: chip text matches confidence |
| Tire record cannot show unconfirmed stock as available | unit (adapter guards): `shop_confirmed` without inbound shop message → 422 with reason; buyer summary omits `unverified`/`possible_match` |
| Foot-care lead hides sensitive info from unauthorized roles | unit: list payload never contains `accessibility_notes`; integration: unassigned provider read → 404; admin single read → present |
| Unmeasured metric says "not yet measured" | unit: aggregate builder returns `{ state: 'not_measured' }` for offer views / response time; component test renders the phrase, never `0` |
| Existing suites still pass | api unit 143, web 267, `authorization-hardening`, `reviewer-decisions`, `provider-application*`, preview pytests |

---

## 8. Unresolved decisions (need the owner)

1. **Who may create leads in Phase 1?** Admin only (safest; provider forwards
   screenshots) vs. approved providers for their own offers (faster, but
   self-assigned leads bypass routing). Recommendation: both, with
   provider-created leads auto-assigned to self and flagged `created_by=provider`.
2. **Contact detail retention.** How long to keep `contact_email/phone` for
   leads that never book (proposal: 90 days after close, then null the fields,
   keep counts). Needs a stated policy before the artifact is frozen.
3. **Consent default.** `unknown` vs `inbound_only` for a lead recorded from
   an inbound platform message. Affects nothing in Phase 1 (no outbound) but
   should be decided now so records are truthful later.
4. **Does a source belong to a provider or to the marketplace?** Model allows
   both (`provider_profile_id` nullable). Decide default for foot-care offers.
5. **Text allowlists vs. enums** (see §2). Recommendation: text.
6. **Vertical key on `sources`/`leads` now vs. a `marketplaces` table later.**
   Recommendation: text key now; mapping to a tenant layer is the
   extensibility blueprint's job, not this slice's.
7. **Response-time measurement.** Requires `lead_events.type='first_response'`
   from the assigned provider's first outbound/`accept`. Phase 2 — confirm the
   definition before it is shown anywhere.
8. **Pending Phase 4 apply** (`users.is_demo`, `admin_audit_log`): still
   awaiting your explicit approval; if approved, `lead_events` could later be
   mirrored into `admin_audit_log` for admin actions.

---

## 9. Explicitly deferred

Scraping or automated reading of Kijiji/Facebook/e-mail/SMS/voice · any
outbound message sent by the platform (e-mail, SMS, DM) · call recording,
transcription, telephony, warm transfer · AI drafting, summaries or replies ·
GA4/GTM or any external analytics · offer-view counting · response-time metrics
· `lead_tasks` table and recurring follow-ups · client-facing lead surface ·
tire-sourcing screens (adapter config + tests only) · tenant/marketplace layer ·
bulk actions · any change to Bookings/Services/Credentials/Profile behaviour.
Each channel later needs: platform-terms review, consent/privacy review, secure
handling, opt-out, explicit sent/delivered state, retention policy, audit trail.

---

## Stop

Nothing further is built until the owner reviews §2 (model), §3 (file list),
§6 (boundaries) and answers §8. On approval the order is: freeze
`GROUND_GAME_LEADS_V1.sql` → scratch rehearsal → Gate B apply → Drizzle mirror
→ contract → routes + tests → provider view → admin view → preview pytest.
