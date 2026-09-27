# Ground Game — Phase 1 review packet (verified against code, 2026-09-27)

**Status: REVIEW ONLY. No code, no schema declaration, no migration written or
applied. Stop point: owner review.**

This packet answers the Ground Game delivery request. It **supersedes** the
Phase 0 section of `docs/neo/2026-09-27-ground-game-design.md` (v1) and
**verifies, corrects and tightens** v1 §1–§9 after a fresh inspection of the
repository at `conflict_260926_1408` @ `f488d90`. Where v1 is confirmed, this
document says so and does not repeat the rationale; where it is corrected, the
correction is marked **Δ**. Read v1 for long-form design notes; read this for
what will actually be built.

Scope guard (from the brief, restated as hard rules for Phase 1): no scraping,
no platform-sent messages, no SMS/voice/recording/transcription, no AI replies,
no GA4/GTM, no `public.profiles` or tenant assumption, no migration before this
model is approved, booking value is never called paid revenue, no deploy /
merge / Railway / purge without separate authorisation.

---

## 0. Phase 0 — read-only reconciliation

Done in this workspace; full evidence table in
`docs/neo/2026-09-27-reconciliation-evidence.md`. Summary of what matters here:

| Item | State |
|---|---|
| Branch / GitHub | local = `origin/conflict_260926_1408` = `f488d90`; `origin/main` = `ee0d180` (#93); content diff = the four handoff commits only; publication to `main` is an owner PR click (packet §7 of the evidence doc) |
| Railway | still serving `5177fd4` (bundle `index-DsoWasjk.js`, scorecard route 404); the #93 merge never deployed → source trigger to be checked by owner |
| JWT_SECRET contradiction | resolved on 2026-09-27 (set on Railway, healthz 200, logins verified); stale `JWT` var remains — owner deletes |
| Supabase | not reachable from this workspace (no managed credential here); last known: 10/10 frozen artifacts applied; Phase 4 artifacts NOT applied |
| Unfinished files | none on the branch; tests green (typecheck, api 143, web 267) |
| Preview | up on a disposable local PostgreSQL 15 seeded from `seed.ts` |

---

## 1. Architecture inventory (re-verified in source; file evidence)

| Area | Verified fact | Evidence |
|---|---|---|
| Tables | **28** `pgTable` declarations: `users, account_roles, provider_profiles, provider_applications, provider_application_events, provider_application_submissions, services, availability, travel_zones, provider_coverage_areas, provider_service_areas, provider_blocked_ranges, provider_emergency_openings, verification_docs, bookings, booking_outcome_history, booking_reschedule_history, booking_reschedule_proposals, prevented_booking_records, prevented_bookings_daily, reviews, invoices, support_tickets, support_messages, provider_notifications, push_tokens, marketplace_events, pilot_provider_retention` | `lib/db/src/schema/*.ts` (grep `pgTable(`) |
| Enums (13) | `user_role, account_role, verification_status, verification_doc_status, booking_status, booking_outcome_action, invoice_status(pending/paid/cancelled), ticket_status, reschedule_proposal_status, prevented_booking_path, marketplace_event_type, marketplace_event_source, pilot_retention_intent` | same |
| `users` | `id, email UNIQUE, password_hash, role, first_name, last_name, phone, avatar_url, is_active, timestamps` — **no `profiles` table, no tenant column** | `schema/users.ts:19-29` |
| `bookings` | `client_id, provider_id, service_id, status, scheduled_at, address, city, postal_code, care_notes, client_notes, source (text allowlist), cancelled_by, cancellation_reason, cancellation_category, no_show_marked_by/at, timestamps` | `schema/bookings.ts:28-60` |
| Booking source allowlist | `instagram, qr-card, text, facebook, website` — recorded at booking creation from the public booking page | `api-server/src/lib/booking-page.ts:50-56` |
| `support_tickets` / `support_messages` | ticket: `user_id, subject, booking_id (nullable), status open/in_progress/resolved`; message: `ticket_id, user_id, message` — client-authored, ticket-semantic; **no direction, channel, or visibility field** → cannot host a lead conversation without misuse | `schema/support.ts:13-52` |
| `marketplace_events` | **closed enum** of activation + booking-funnel types (`provider_approved … booking_no_show`); no lead types | `schema/marketplace-events.ts` |
| Routers | `/api`: `auth, providers, booking-pages, (reschedule), bookings, reviews, invoices, notifications, admin, support`; `admin/pilot` nested | `routes/index.ts:16-26`, `routes/admin.ts:28` |
| Admin gate | `router.use(requireAuth, requireRole("admin"))` router-wide | `routes/admin.ts:25` |
| Auth middleware exports | `requireAuth, requireRole, requireApprovedProvider, requireApprovedProviderIfProvider, requireSelf, loadAuthorizationContext` | `middlewares/auth.ts:50-190` |
| **Δ** `requireProviderOperation` | is **file-local** to `routes/providers.ts:67` (not exported) — a new router must compose `[requireAuth, requireRole("provider"), requireApprovedProvider]` itself, or export it in a one-line change | `routes/providers.ts:67` |
| Provider `/me` API | `activation-status, availability, booking-page, dashboard, earnings, listing-preview, metrics, readiness, scorecard, service-area, services, travel-zones, verification` | `routes/providers.ts` |
| Web routes | provider: `dashboard, bookings, services, availability, earnings(+statement), profile, credentials, notifications, readiness, listing-preview, travel-zones, service-area, application-status`; admin: `/admin, /admin/verification, /admin/pilot, /admin/system`; router in `App.tsx` with `providerRoute()` wrapper for provider pages; admin pages self-gate on 401/403 (`home-auth-required` / `home-access-denied`) | `web/src/lib/routes.ts`, `web/src/App.tsx:72-127`, `pages/admin/index.tsx:183` |
| Reusable UI | `components/admin-home/queue-card.tsx` (`testId, icon, title, headline, tone ok/attention/warn/neutral`), decision dialogs pattern, `components/dashboard/*` cards incl. `source-attribution-chart.tsx`, `scorecard-card.tsx` | listed paths |
| Outbound channels | exactly one: decision e-mails via managed proxy with guardrail (`lib/decision-emails.ts`); no inbound channel of any kind | `api-server/src/lib/decision-emails.ts` |
| Audit | none applied (`admin_audit_log` is PROPOSED, NOT APPROVED) | `docs/migrations/ADMIN_AUDIT_LOG_V1.sql` |

### Reuse vs. missing (confirmed)

Reuse: `users` (client identity when known), `provider_profiles` (assignment
target + approval gate), `services` (foot-care requested service select),
`bookings` (link target; `bookings.source` vocabulary), `support_tickets`
(link target for escalations), `requireRole`/`requireApprovedProvider`,
owner-filter pattern, `QueueCard`, decision-dialog pattern, TanStack Query +
orval codegen, `docs/metrics-definitions.md` discipline.

Missing (all four confirmed absent): source/offer record; lead record;
lead-scoped conversation with direction/channel/visibility/sent-by-platform;
attribution confidence + evidence; per-lead owner/next-action/due; adapter
config layer; lead audit trail.

---

## 2. Proposed data model (Phase 1, additive; v1 §2 confirmed with Δ)

Four new tables. **No existing table, enum, index or column changes.**
Bookings are linked *from* the lead.

```
sources
  id serial PK
  vertical             text NOT NULL                       -- adapter key: 'foot_care' | 'tire_sourcing' (text; new vertical ≠ migration)
  source_type          text NOT NULL                       -- facebook|kijiji|referral|website|flyer|phone|sms|email|campaign_link (API allowlist)
  name                 text NOT NULL
  campaign_ref         text                                -- campaign / listing / ad id as printed on the platform
  landing_ref          text                                -- Δ landing-page identifier (e.g. provider public_slug or page path), separate from the URL
  offer_title          text NOT NULL
  offer_description    text
  area                 text
  starts_on            date
  ends_on              date
  owner_user_id        integer NOT NULL REFERENCES users(id)          -- admin owner
  provider_profile_id  integer REFERENCES provider_profiles(id)       -- optional single-provider offer
  external_ref         text                                -- listing/landing URL; stored, never fetched
  status               text NOT NULL DEFAULT 'draft'       -- draft|active|paused|expired
  created_at, updated_at timestamp NOT NULL DEFAULT now()

leads
  id serial PK
  vertical             text NOT NULL                       -- copied from source at creation
  source_id            integer REFERENCES sources(id)      -- nullable → shown as "Source unknown" (a fact)
  attribution_confidence text NOT NULL DEFAULT 'unknown'   -- exact|inferred|unknown
  attribution_evidence text                                -- Δ NEW: booking_source|referral_code|campaign_ref_quoted|landing_ref ; REQUIRED when exact
  attribution_reason   text                                -- required when inferred (manual reason)
  referral_code        text
  contact_channel      text NOT NULL                       -- platform_message|email|phone|sms|referral|website
  contact_name         text
  contact_email        text                                -- full value only to admin + assigned provider
  contact_phone        text                                -- same
  contact_redacted_at  timestamp                           -- Δ NEW: set when retention policy nulls contact fields (decision D2); no later migration needed
  client_user_id       integer REFERENCES users(id)        -- set when linked to a booking (= booking.client_id) or admin-confirmed e-mail match
  stated_need          text NOT NULL
  area                 text
  timing               text
  consent_status       text NOT NULL DEFAULT 'unknown'     -- unknown|inbound_only|contact_ok|do_not_contact
  qualification        jsonb NOT NULL DEFAULT '{}'         -- adapter fields; adapter-declared sensitive keys stripped for non-owners
  assigned_provider_profile_id integer REFERENCES provider_profiles(id)
  owner_role           text NOT NULL DEFAULT 'admin'       -- admin|provider|client  (exactly one visible next owner)
  next_action          text NOT NULL                       -- required, non-empty
  next_action_due_at   timestamp
  status               text NOT NULL DEFAULT 'new'         -- new|assigned|awaiting_provider|awaiting_client|awaiting_partner|qualified|closed
  outcome              text                                -- booked|sold|referred|declined|unreachable|no_fit|lost|pending  (NULL until closed)
  outcome_reason       text
  booking_id           integer REFERENCES bookings(id)     -- link only; never creates a booking or user
  support_ticket_id    integer REFERENCES support_tickets(id)
  first_provider_response_at timestamp                     -- Δ NEW nullable; written only after decision D7 defines it; UI shows "not yet measured" until then
  created_by_user_id   integer NOT NULL REFERENCES users(id)
  created_at, updated_at timestamp NOT NULL DEFAULT now()

lead_messages                                              -- the conversation; append-only (no PUT/DELETE routes)
  id serial PK
  lead_id              integer NOT NULL REFERENCES leads(id)
  direction            text NOT NULL                       -- inbound|outbound|internal_note|system_event
  channel              text NOT NULL                       -- platform_message|email|phone|sms|in_person|system
  body                 text NOT NULL                       -- verbatim; never rewritten
  original_ref         text                                -- id/link of the original external message
  occurred_at          timestamp NOT NULL                  -- may be back-dated on manual entry
  author_user_id       integer REFERENCES users(id)        -- NULL only for system_event
  visibility           text NOT NULL DEFAULT 'shared'      -- shared|admin_only
  sent_by_platform     boolean NOT NULL DEFAULT false      -- server-set; ALWAYS false in Phase 1
  delivery_status      text                                -- NULL in Phase 1
  created_at           timestamp NOT NULL DEFAULT now()

lead_events                                                -- append-only audit
  id serial PK
  lead_id              integer NOT NULL REFERENCES leads(id)
  actor_user_id        integer REFERENCES users(id)
  type                 text NOT NULL                       -- created|assigned|status_changed|owner_changed|outcome_recorded|linked_booking|linked_ticket|note_added|attribution_changed
  from_value           text
  to_value             text
  created_at           timestamp NOT NULL DEFAULT now()
```

Indexes: `leads(assigned_provider_profile_id, status)`, `leads(status, next_action_due_at)`,
`leads(source_id)`, `leads(booking_id)`, `lead_messages(lead_id, occurred_at)`,
`lead_events(lead_id, id)`, `sources(status, vertical)`.

**Δ Vocabulary alignment.** `sources.source_type` maps onto the existing
`bookings.source` allowlist inside the adapter file (`facebook→facebook`,
`website→website`, `sms→text`, `flyer→qr-card`, `campaign_link→website`,
others → no booking equivalent). The existing dashboard source chart is **not
changed**; the mapping only lets the admin funnel show "bookings recorded with
this source" as a *fact* next to lead counts, labelled as coming from two
different records.

Design choices carried from v1 (confirmed): text + zod allowlists instead of
enums; contact details on the lead, not in `users`; `qualification` jsonb with
adapter-declared sensitive keys; no task table in Phase 1; `marketplace_events`
untouched.

### What requires a migration

| Artifact | Content | Gate |
|---|---|---|
| `docs/migrations/GROUND_GAME_LEADS_V1.sql` (**not written**) | the four tables + indexes above, additive, single transaction, no DOWN (restore-based rollback policy) | frozen only after this model is approved → scratch PostgreSQL rehearsal → Gate B managed apply (separate named authorisation) → Drizzle mirror `lib/db/src/schema/ground-game.ts` |
| Nothing else | no change to `bookings`, `users`, `support_*`, `marketplace_events`; **independent of the pending Phase 4 artifacts** (`users.is_demo`, `admin_audit_log`) | — |

---

## 3. Smallest Phase 1 file list (v1 §3 confirmed; Δ ordering and minimum core)

Contract first → server → web. "Core" = cannot ship without; "Complete" = the
brief's full Phase 1 views.

| # | File | Core / Complete | Purpose |
|---|---|---|---|
| 1 | `docs/migrations/GROUND_GAME_LEADS_V1.sql` | Core | frozen artifact (after approval) |
| 2 | `lib/db/src/schema/ground-game.ts` + export in `schema/index.ts` | Core | Drizzle mirror, **after** apply |
| 3 | `lib/api-spec/openapi.yaml` (+ orval codegen into `lib/api-client-react`, `lib/api-zod`) | Core | `GET/POST /admin/sources`, `PATCH /admin/sources/:id`; `GET /leads` (server-scoped), `POST /leads`, `GET /leads/:id`, `PATCH /leads/:id` (assign / status / owner / next action / outcome / link booking / link ticket / attribution); `GET,POST /leads/:id/messages`; `GET /admin/leads/:id/events`; `GET /providers/me/ground-game`; `GET /admin/ground-game` |
| 4 | `artifacts/api-server/src/lib/ground-game-adapters.ts` | Core | `VerticalAdapter` registry: labels, qualification fields (+ `sensitive`), outcome vocabulary, `missingInfo()`, guards; `foot_care` + `tire_sourcing`; source→booking-source mapping |
| 5 | `artifacts/api-server/src/lib/ground-game.ts` | Core | pure helpers: visibility filter, contact masking, sensitive-key stripping, attribution validation (exact ⇒ evidence, inferred ⇒ reason), due/overdue classification, `notMeasured()` builders, owner/next-action invariant |
| 6 | `artifacts/api-server/src/routes/ground-game.ts` (mounted in `routes/index.ts` at `/leads`, `/admin/sources`, `/admin/ground-game`, `/providers/me/ground-game`) | Core | every lead read filtered to `assigned_provider_profile_id = caller profile` unless admin; `admin_only` messages stripped; `sent_by_platform` never read from the body; composes its own `[requireAuth, requireRole("provider"), requireApprovedProvider]` |
| 7 | `artifacts/api-server/src/__tests__/ground-game.test.ts` | Core | unit: masking, scope, attribution, adapter guards, not-measured, invariant |
| 8 | `artifacts/api-server/src/__tests__/ground-game.integration.test.ts` | Core | scratch-DB only: provider cannot read unassigned/other leads (404), admin reassign writes `lead_events`, booking link leaves `users` count unchanged and sets `client_user_id = booking.client_id`, message immutability (no PUT/DELETE), `exact` without evidence downgraded |
| 9 | `artifacts/web/src/lib/routes.ts` | Core | `provider.leads = '/provider/leads'`, `admin.groundGame = '/admin/ground-game'` |
| 10 | `artifacts/web/src/pages/portal/leads.tsx` | Core | provider Daily Ground Game (§4) + causal empty states |
| 11 | `artifacts/web/src/components/ground-game/{lead-card,lead-drawer,conversation-list,add-note-dialog,outcome-dialog,attribution-chip}.tsx` | Core (card, drawer, conversation, add-note) / Complete (outcome, chip can start inside drawer) | shared provider/admin components; labels via adapter `labels` |
| 12 | `artifacts/web/src/pages/admin/ground-game.tsx` + `components/admin-ground-game/{source-form,assign-dialog}.tsx` | Core | admin view (§4); facts vs "Suggestion" visually and textually separated |
| 13 | `artifacts/web/src/App.tsx`, provider portal nav, `/admin` nav + one `QueueCard` "Leads needing an owner" | Core | entry points, existing patterns |
| 14 | `docs/metrics-definitions.md` (new section), `docs/ground-game.md` (ownership + channel policy), `backend/tests/test_ground_game.py` (read-only preview regression) | Complete | definitions, policy, regression |
| 15 | `artifacts/web/src/__tests__/ground-game-*.test.tsx` | Core | component tests: attribution chip text, "sent outside the platform" label, "not yet measured" rendering, sensitive key absent from list |

Not in Phase 1 (even "Complete"): ingestion, sending, scraping, tasks table,
GA4/GTM, tire screens (config + unit tests only), bulk actions, client surface.

---

## 4. Views (confirmed v1 §4; Δ two clarifications)

**Provider `/provider/leads`** — only own assigned leads. Sections: Today's new
· Responses due today · Waiting for my reply (`owner_role=provider`) · Waiting
for client (`awaiting_client`) · Awaiting admin/partner (`awaiting_partner`,
labelled "awaiting admin" for foot care) · Overdue follow-ups · Upcoming
bookings from leads (`booking_id` set, `scheduled_at ≥ now`). Quick actions:
add note (inbound/outbound/internal) · request details · accept · decline /
refer back (reason → owner admin) · mark outcome · link **own** booking.
**Δ** "Reply" and "Call" open the provider's own mail/phone app via `mailto:`/`tel:`
and immediately open the add-note dialog pre-set to `outbound`; the platform
records, it never sends. Source summary = exact counts of own leads per offer;
offer views = "not yet measured". "What to do next" = 3 soonest-due
`next_action` lines. Empty states name the cause.

**Admin `/admin/ground-game`** — all leads. Active sources (status controls) ·
Unassigned · Overdue/stalled (stall window is a display definition, documented)
· Source→outcome funnel (inquiries → qualified → booked/sold → lost + reasons;
exact counts; views and response time "not yet measured") · Provider response
performance (**"not yet measured" in Phase 1**; enabled by D7) · Failed routing
(assigned provider not approved / inactive — fact) · Unresolved escalations
(reuses existing support feed) · Attracting-but-not-converting (fact:
inquiries > 0 and booked+sold = 0; recommendation text prefixed "Suggestion").
**Δ** `/admin` home gets one `QueueCard` ("Leads needing an owner" = unassigned
+ overdue, tone `attention` when > 0) using the existing component; nothing
else on `/admin` changes.

---

## 5. Vertical adapters (v1 §5 confirmed)

`VerticalAdapter { key, labels, qualificationFields[{key,label,kind,options?,required?,sensitive?}], outcomes, missingInfo(q), guards[] }`.

- **foot_care**: labels provider/client/service; fields `requested_service`
  (select from the assigned provider's `services`), `service_area`,
  `preferred_window`, `booking_readiness`, `needs_referral_or_support`,
  `accessibility_notes` (**sensitive**). Guards: sensitive key never appears in
  list payloads, events, aggregates, e-mails or logs; no AI-authored field
  exists; safety-sensitive wording → next owner admin (human) via
  `awaiting_partner` (label "awaiting admin").
- **tire_sourcing**: labels buyer/item/shop; fields `tire_size`, `quantity`
  (2|4), `season_type`, `tread_condition`, `vehicle_fitment`, `buyer_area`,
  `budget_cents`, `fulfilment_pref`, `source_listing_ref`, `shop_contacted`,
  `availability_state` (**unverified | possible_match | shop_confirmed | on_hand**,
  default `unverified`), `confirmed_price_cents`, `hold_expires_at`. Guards:
  `shop_confirmed`/`on_hand` require a human-recorded inbound message
  referencing the shop; `confirmed_price_cents` requires confirmed state;
  outcome `sold` requires confirmed state; buyer-facing summaries omit
  `unverified`/`possible_match`; a shop reply is an inbound message, never
  auto-copied into a buyer-facing field. Prices in cents (repo rule).
- Adapter chosen by `lead.vertical`; the foot-care flow never loads the tire
  adapter. Phase 1 UI creates `foot_care` sources only; the tire adapter ships
  as config + unit tests.

---

## 6. Permissions and privacy boundaries (v1 §6 confirmed; Δ evidence column)

| Actor | Sources | Leads | Messages | Actions |
|---|---|---|---|---|
| Admin | full (status transitions) | all; assign/reassign; owner/next action; link booking/ticket; outcome; attribution | all incl. `admin_only` | all |
| Approved provider | read name/offer of sources on own leads | only `assigned_provider_profile_id = own`; unassigned/others → 404; provider-owned status moves; decline/refer back; request info; outcome; link **own** bookings | `shared` only; may add inbound/outbound/internal (provider internal notes are visible to admin by design) | no assign-to-others, no source edits |
| Unapproved provider / client | none | none | none | none (clients have no lead surface in Phase 1) |

Server-side rules: contact e-mail/phone in full only to admin + assigned
provider, list payloads carry name + channel only; adapter `sensitive` keys
only on single-lead read for admin/assigned provider; `sent_by_platform`
server-set, always `false` in Phase 1, UI copy "Recorded by <name> · sent
outside the platform"; **Δ** `attribution_confidence = exact` accepted only with
`source_id` **and** a stored `attribution_evidence` kind (`booking_source`
when linked booking's `source` matches the mapped source type,
`referral_code` match, `campaign_ref_quoted`, `landing_ref`) — otherwise the
API downgrades to `inferred` (reason required) or `unknown` and writes
`lead_events.attribution_changed`; no lead data enters `marketplace_events`,
pilot metrics, e-mails or logs beyond ids and status words; verification docs,
reviewer notes and other providers' data are never joined.

Ownership: admin — source setup, routing, exceptions, unassigned/overdue/
escalated; provider — timely response, clarification, availability,
fulfilment; client — consent (`do_not_contact` blocks every future outbound
channel); platform — records handoffs in `lead_events`. **Invariant:** every
non-closed lead has exactly one `owner_role` and a non-empty `next_action`
(enforced in zod + a unit test; no general inbox).

---

## 7. Phase 1 acceptance tests (v1 §7 confirmed; mapped to files in §3)

| Brief | Test (file #) |
|---|---|
| Provider sees only assigned leads | #8 provider A list excludes B/unassigned; `GET /leads/:id` of B → 404; #14 preview pytest |
| Admin sees and reassigns | #8 admin lists all; `PATCH` assign → `lead_events.assigned`, `owner_role=provider` |
| Every lead has source, offer, status, owner, next action | #7 zod: `next_action` required; null `source_id` ⇒ confidence forced `unknown`, UI "Source unknown" |
| Manual conversation stays linked | #8 message → `lead_id`; response carries `source.offerTitle`; no edit route exists |
| Link booking without duplicating client | #8 `users` count unchanged; `client_user_id = booking.client_id` |
| No message claimed sent | #7 body `sentByPlatform` ignored; #15 outbound entry renders "sent outside the platform" |
| No attribution shown exact without evidence | #7 `exact` w/o evidence → `inferred`/`unknown`; #15 chip text = stored confidence |
| Tire record cannot show unconfirmed stock | #7 guards → 422 with plain reason; buyer summary omits unverified/possible |
| Foot-care sensitive info hidden | #7 list payload lacks `accessibility_notes`; #8 unassigned provider → 404; admin single read → present |
| Unmeasured metric says "not yet measured" | #7 `notMeasured()` shape; #15 renders the phrase, never `0` |
| Existing suites still pass | typecheck, api 143+, web 267+, preview pytests |

---

## 8. Unresolved decisions (owner) — v1 §8 carried, with recommendations

| # | Decision | Recommendation |
|---|---|---|
| D1 | Who creates leads in Phase 1? | Admin **and** approved providers; provider-created leads auto-assign to self, `created_by_user_id` shows it, admin sees them in "recently self-created" |
| D2 | Contact retention for leads that never book | 90 days after `closed` → null `contact_email/phone`, set `contact_redacted_at`; counts retained. Policy text goes in `docs/ground-game.md` before the artifact is frozen |
| D3 | Consent default on an inbound platform message | `inbound_only` (truthful: they wrote to us; nothing else granted) |
| D4 | Does a source belong to a provider or the marketplace? | default marketplace-owned (`provider_profile_id` NULL); single-provider offers set it |
| D5 | Text allowlists vs. PostgreSQL enums | text + zod (no migration per new value) |
| D6 | Vertical key now vs. tenant layer | text key now; tenant mapping belongs to the extensibility blueprint |
| D7 | Response-time definition | first `outbound` message or `accept` by the assigned provider after assignment; column exists (nullable), **not shown** until you approve the definition |
| D8 | Pending Phase 4 apply (`users.is_demo`, `admin_audit_log`) | independent of this slice; if later approved, admin `lead_events` may be mirrored into `admin_audit_log` |
| **Δ D9** | Export `requireProviderOperation` from `middlewares/auth.ts` (1-line change in `routes/providers.ts`) or compose locally in the new router | compose locally (zero touch to existing files) |
| **Δ D10** | Should the admin funnel show "bookings recorded with this source" from `bookings.source` beside lead counts (two records, clearly labelled)? | yes, as a fact with its own label; no change to bookings |

---

## 9. Explicitly deferred (unchanged from v1 §9)

Scraping / automated reading of Kijiji, Facebook, e-mail, SMS, voice · any
platform-sent message · call recording, transcription, telephony, warm transfer
· AI drafting/summaries/replies · GA4/GTM / external analytics · offer-view
counting · response-time display (D7) · `lead_tasks` / recurring follow-ups ·
client-facing lead surface · tire-sourcing screens · tenant layer · bulk actions
· any change to Bookings/Services/Credentials/Profile behaviour. Every future
channel needs platform-terms review, consent/privacy review, secure handling,
opt-out, explicit sent/delivered state, retention policy and an audit trail.

---

## Stop

Nothing is built until the owner reviews §2, §3, §6 and answers D1–D10.
On approval, the order is: freeze `GROUND_GAME_LEADS_V1.sql` (hash recorded)
→ scratch PostgreSQL rehearsal → Gate B managed apply (separate authorisation)
→ Drizzle mirror → OpenAPI + codegen → routes + tests → provider view → admin
view → preview pytest → LOG entry.
