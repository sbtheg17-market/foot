# Ground Game Phase 1 — Caller context & handoff tool (scope-corrected review packet)

**Status: REVIEW ONLY. No code, no schema declaration, no migration file, no SQL
applied, no telephony/voice provider connected, no production configuration
changed.** Prepared 2026-09-27 (E2 session) from the owner's scope correction.

This packet **replaces** the Phase 1 scope in
`docs/neo/2026-09-27-ground-game-phase1-review-packet.md` (v2) and
`docs/neo/2026-09-27-ground-game-design.md` (v1). Those documents remain as
history and as the later-phase reference (source/offer management, funnels,
adapters at full width). Everything below is smaller than v2.

Reference note: the owner's "supplied image sequence" did not arrive in this
workspace (the asset store for this job is empty). The flow is designed from
the nine written steps; the images are treated as UX reference only — no
branding, vendor, voice model or implementation is copied.

Repository fact: **no telephony, SMS, voice or transcription provider exists
in this repository** (Twilio / Fish Audio / etc. appear only in design docs).
There is nothing to activate, and nothing is proposed for activation.

---

## 1. What this is — and is not

**Is:** a lightweight caller/contact context + case + handoff record that a
human operator (admin, or an approved provider for their own assigned cases)
fills in while a call, message or walk-in inquiry happens, so the next
interaction starts with context instead of from zero.

**Is not:** a CRM, a campaign suite, an autonomous agent, marketing
automation, scraping, an omnichannel inbox, a telephony system, or a task
engine. No source/offer management table in this phase (the entry point and a
free-text source reference are recorded on the case; the v2 `sources` table is
deferred).

The nine-step flow, mapped to what Phase 1 does:

| # | Step (owner) | Phase 1 reality |
|---|---|---|
| 1 | A call, message or manual inquiry arrives | Operator clicks **New case** and picks the entry point (phone / sms / email / platform_message / website / referral / walk_in) |
| 2 | Identify the caller/contact when possible | Lookup by phone or e-mail in `contacts`; optional match to an existing `users` row by e-mail (operator confirms). "Not identified" is a valid, shown state |
| 3 | Retrieve last case and saved preferences | `contacts.last_case_id`, `contacts.preferences`, `contacts.last_interaction_at` shown in a context strip |
| 4 | Ask a small number of contextual questions | Adapter question set (≤ 6) rendered as a form; the **human** asks and records; no AI |
| 5 | Record need, urgency, deadline, what was tried | `cases.problem`, `urgency`, `needed_by`, `tried_already` |
| 6 | Show a concise case summary | `cases.summary` — auto-composed **deterministically** from the recorded fields (template, not AI); operator may edit; edits are recorded |
| 7 | Ask whether they want a human | Operator records the answer: `handoff_requested` yes/no |
| 8 | Transfer or hand to a human | Phase 1 = **assignment + attested state**. Platform performs no transfer; `handoff_status` moves only by human action (§6) |
| 9 | Record handoff status; leave a useful record | `cases.handoff_status`, `next_action`, `assigned_user_id`; `contacts.last_case_id` updated; interaction rows appended |

---

## 2. Smallest data model (3 tables, all new, all additive)

Reuse is by **reference only**: `users` (operator identity, optional matched
account), `provider_profiles` (assignment target, approval gate), `bookings`
(optional link). No existing table, enum, index or column changes.

```
contacts                                  -- a caller/contact; NOT a user account
  id                    serial PK
  display_name          text
  phone                 text                       -- as permitted; nullable
  email                 text                       -- as permitted; nullable
  user_id               integer REFERENCES users(id)          -- set only when operator confirms a match (dedupe, never auto-create)
  preferred_channel     text                       -- phone|sms|email|platform_message|none  (API allowlist)
  consent_status        text NOT NULL DEFAULT 'unknown'      -- unknown|inbound_only|contact_ok|do_not_contact
  preferences           jsonb NOT NULL DEFAULT '{}'          -- adapter-declared keys only (e.g. preferred_window, area); no clinical data
  last_case_id          integer                    -- FK added after cases exists (see SQL); denormalised for the context strip
  last_interaction_at   timestamp
  redacted_at           timestamp                  -- retention: when phone/email were nulled
  created_by_user_id    integer NOT NULL REFERENCES users(id)
  created_at, updated_at timestamp NOT NULL DEFAULT now()
  UNIQUE partial indexes on lower(email) and on phone where not null

cases
  id                    serial PK
  vertical              text NOT NULL              -- 'foot_care' | 'tire_sourcing' (adapter key; text)
  contact_id            integer REFERENCES contacts(id)       -- nullable: "not identified" is allowed and shown
  entry_point           text NOT NULL              -- phone|sms|email|platform_message|website|referral|walk_in|manual
  source_ref            text                       -- free text: listing id / offer name / "Facebook post 12 Sep"; never fetched
  problem               text NOT NULL              -- the request in the caller's words
  tried_already         text
  urgency               text NOT NULL DEFAULT 'normal'       -- low|normal|high|urgent
  needed_by             timestamp
  answers               jsonb NOT NULL DEFAULT '{}'          -- adapter question answers; adapter marks sensitive keys
  summary               text NOT NULL              -- concise; template-composed, human-editable
  status                text NOT NULL DEFAULT 'open'         -- open|waiting|transferred|resolved|closed
  handoff_requested     boolean                    -- NULL = not asked yet; true/false = caller's answer
  handoff_status        text NOT NULL DEFAULT 'not_yet_connected'
                        -- not_yet_connected|transfer_requested|transfer_in_progress|transferred|transfer_failed|human_followup_required|note_only
  assigned_user_id      integer REFERENCES users(id)          -- the human who owns it now (admin or provider user)
  assigned_provider_profile_id integer REFERENCES provider_profiles(id)  -- set when the human is a provider (scoping key)
  next_action           text NOT NULL              -- one line, required
  next_action_due_at    timestamp
  booking_id            integer REFERENCES bookings(id)       -- link only; never creates a booking
  resolved_by_user_id   integer REFERENCES users(id)          -- set only when a human marks resolved
  resolved_at           timestamp
  created_by_user_id    integer NOT NULL REFERENCES users(id)
  created_at, updated_at timestamp NOT NULL DEFAULT now()

case_interactions                         -- every call / message note / state change; append-only (no PUT/DELETE)
  id                    serial PK
  case_id               integer NOT NULL REFERENCES cases(id)
  channel               text NOT NULL              -- phone|sms|email|platform_message|in_person|system
  direction             text NOT NULL              -- inbound|outbound|internal_note|system_event
  occurred_at           timestamp NOT NULL         -- may be back-dated on manual entry
  actor_kind            text NOT NULL              -- human|system   ('ai' reserved in the allowlist; never written in Phase 1)
  actor_user_id         integer REFERENCES users(id)          -- NULL only when actor_kind = system
  notes                 text
  answers               jsonb                      -- structured answers captured in this interaction (optional)
  transfer_status       text                       -- snapshot of handoff_status when this row concerns a handoff
  outcome               text                       -- free/allowlisted per adapter (e.g. booked, referred, no_fit, callback)
  platform_sent         boolean NOT NULL DEFAULT false        -- server-set; TRUE only if this platform transmitted a message; Phase 1 always false
  platform_transferred  boolean NOT NULL DEFAULT false        -- server-set; TRUE only if this platform performed a transfer; Phase 1 always false
  created_at            timestamp NOT NULL DEFAULT now()
```

Indexes: `cases(assigned_provider_profile_id, status)`,
`cases(status, next_action_due_at)`, `cases(handoff_status)`,
`cases(contact_id, created_at)`, `case_interactions(case_id, occurred_at)`,
`contacts(lower(email))` unique partial, `contacts(phone)` unique partial.

Why three and not four: state changes (assignment, status, handoff) are
`case_interactions` rows with `direction='system_event', actor_kind='system'`
(or `human` when a person set it), so no separate audit table is needed for
this scope. The v2 `sources` table is deferred (`entry_point` + `source_ref`
cover "source/entry point").

---

## 3. What existing structures are safely reused (and what is not)

| Structure | Reuse | Why safe |
|---|---|---|
| `users` | operator identity (`created_by`, `assigned_user_id`, `actor_user_id`); optional `contacts.user_id` match | reference only; never inserted by this layer |
| `provider_profiles` | assignment target + `verification_status` gate for who may receive cases | existing `requireApprovedProvider` semantics |
| `bookings` | optional `cases.booking_id` link; picker limited to the assigned provider's own bookings | link only, no create; no duplicate people |
| `requireAuth`, `requireRole`, `requireApprovedProvider` (`middlewares/auth.ts`) | all routes | existing gates; composed locally in the new router |
| `QueueCard`, decision-dialog pattern, `time-ago`, `marketplace-time` (web) | admin card, dialogs, timestamps | existing UI conventions |
| OpenAPI → orval codegen | contract first | existing pipeline |
| **Not reused: `support_tickets` / `support_messages`** | — | ticket-semantic, client-authored, no direction/channel/visibility/actor semantics (`schema/support.ts`) — unsafe for a case conversation |
| **Not reused: `marketplace_events`** | — | closed enum for activation/booking funnels |
| **Not reused: `provider_notifications`** | — | bound to `provider_application_events`; Phase 1 sends no notifications |

---

## 4. Exact screens and route changes

**API (`lib/api-spec/openapi.yaml`, new router `routes/cases.ts`, mounted in `routes/index.ts`)**

| Method + path | Who | Purpose |
|---|---|---|
| `GET /contacts/lookup?phone=&email=` | admin, approved provider | step 2: returns contact + last case summary + preferences, or `{ found: false }`; providers get a match only if the contact's last case is assigned to them (else `{ found: false, reason: 'not_visible' }`) |
| `POST /contacts` · `PATCH /contacts/:id` | admin; provider only for a contact created within their own case | create/update identity, preferred channel, consent, preferences |
| `POST /cases` | admin, approved provider (auto-assigned to self when provider) | steps 1–7 in one submit (entry point, contact or none, answers, problem, urgency, needed_by, tried_already, handoff_requested); server composes `summary` |
| `GET /cases` (server-scoped) · `GET /cases/:id` | admin: all; provider: own assigned only (else 404) | lists + detail with interactions (provider never receives `internal_note` rows authored by admin) |
| `PATCH /cases/:id` | admin: everything; provider: status among provider states, next action, outcome, booking link (own), handoff attestation | step 8–9; every change appends a `system_event` interaction |
| `POST /cases/:id/interactions` | admin, assigned provider | add call note / message note / internal note; `platform_sent` and `platform_transferred` are **ignored in the body**, always false |
| `GET /providers/me/cases/today` | approved provider | aggregate for the dashboard card: due today, waiting, overdue, `emptyReason` |
| `GET /admin/cases/overview` | admin | counts: unassigned, stalled (no interaction ≥ N h — display definition), `transfer_failed`, `human_followup_required`, unresolved; `emptyReason` |

**Web (`artifacts/web`)**

| Change | File(s) |
|---|---|
| Routes `provider.cases = '/provider/cases'`, `admin.cases = '/admin/cases'` | `lib/routes.ts`, `App.tsx` (2 routes: `providerRoute(PortalCases)`, `AdminCases`) |
| Provider **Cases** page: sections Due today · Waiting on caller · Waiting on me · Overdue · Recently resolved; **New case** button; empty state with `emptyReason` copy | `pages/portal/cases.tsx` |
| Provider dashboard: one small card "Cases needing you" (count + link) placed with the existing action cards; no other dashboard change | `components/dashboard/cases-card.tsx`, `pages/portal/dashboard.tsx` (one insertion) |
| **New case** wizard (shared admin/provider): Step A identify (phone/e-mail lookup → context strip: last case, preferences, last interaction, consent) · Step B adapter questions (≤ 6) · Step C need/urgency/needed-by/tried · Step D summary (template, editable) · Step E "Wants a human?" → assign/attest handoff state · Done: case record + next action | `components/cases/new-case-wizard.tsx`, `context-strip.tsx`, `question-form.tsx`, `summary-card.tsx`, `handoff-panel.tsx` |
| Case detail drawer: summary, context strip, interactions timeline (each row shows actor, channel, direction, and "recorded — not sent by platform" / "attested by <name>" labels), add-note dialog, status/next-action controls | `components/cases/case-drawer.tsx`, `interaction-list.tsx`, `add-interaction-dialog.tsx` |
| Admin **Cases** page: All / Unassigned / Stalled / Failed or stuck transfers / Unresolved; assign dialog; caller context; source (`entry_point` + `source_ref`); urgency; ownership; next action | `pages/admin/cases.tsx`, `components/admin-cases/assign-dialog.tsx` |
| `/admin` home: one `QueueCard` "Cases needing an owner" (unassigned + `transfer_failed` + `human_followup_required` overdue) | `pages/admin/index.tsx` (one card) |
| Nav: "Cases" item in provider portal nav and admin header | `components/layout/*` (one entry each) |
| Tests: component tests for wizard steps, labels, `emptyReason` copy, "not yet measured"; api unit + scratch-DB integration | `web/src/__tests__/cases-*.test.tsx`, `api-server/src/__tests__/cases.test.ts`, `cases.integration.test.ts` |
| Docs | `docs/cases-handoff.md` (states, ownership, do-not-claim rules), `docs/metrics-definitions.md` (section), `backend/tests/test_cases.py` (read-only preview regression) |

Estimated: 1 SQL artifact, 1 Drizzle file, 1 OpenAPI edit (+ codegen), 3 api
files + 2 tests, ~12 web files + tests, 3 docs. Bookings, Services, Credentials,
Profile screens are **not modified**.

---

## 5. Permission model

| Actor | Contacts | Cases | Interactions | Actions |
|---|---|---|---|---|
| Admin | lookup, create, edit, consent, preferences, redact | all; assign/reassign; any status/handoff state; link booking/ticket; mark resolved | all incl. admin `internal_note` | everything |
| Approved provider (`requireAuth + requireRole('provider') + requireApprovedProvider`) | lookup returns a match **only** if that contact's latest case is assigned to them; may create a contact inside their own new case; may edit preferences/consent on contacts of their assigned cases | only `assigned_provider_profile_id = own profile`; others/unassigned → 404; may set `waiting`/`resolved`, next action, outcome, handoff attestation, link **own** bookings | rows on own cases except admin `internal_note`; may add inbound/outbound/internal notes (their internal notes are visible to admin) | cannot assign to others, cannot see other providers' cases or unrelated contacts |
| Client / unapproved provider | none | none | none | none (no client surface in Phase 1) |

Server-side rules: adapter `sensitive` answer keys (foot care:
`non_clinical_context` is allowed; **no clinical field exists**) are returned
only on single-case read to admin or the assigned provider, never in lists,
aggregates or logs; contact phone/e-mail in full only to admin + assigned
provider (lists show display name + preferred channel); verification docs,
reviewer notes, internal risk indicators and other providers' cases are never
joined into case payloads; `platform_sent` / `platform_transferred` are never
accepted from a request body.

---

## 6. Handoff state machine and the do-not-claim rules

`handoff_status` transitions (all by explicit human action in Phase 1; every
transition appends a `system_event` interaction naming the actor):

```
not_yet_connected ──(caller says yes)──▶ transfer_requested
transfer_requested ──(operator starts connecting)──▶ transfer_in_progress
transfer_in_progress ──(operator attests "connected")──▶ transferred          ← label: "attested by <name>; not performed by the platform"
transfer_in_progress ──(operator attests "could not connect")──▶ transfer_failed ──▶ human_followup_required (auto, sets next_action = "Call back <contact>" + due)
not_yet_connected / transfer_requested ──(caller says no, or no human needed)──▶ note_only  or  human_followup_required
```

| The system never says | Unless | Enforced by |
|---|---|---|
| "the call was transferred" | `handoff_status = transferred` **and** the UI shows "attested by <name> (outside the platform)" because `platform_transferred = false` in Phase 1 | copy bound to state + flag; unit test |
| "the message was sent" | `platform_sent = true` — impossible in Phase 1; outbound notes read "recorded by <name> · sent outside the platform" | server-set flag; component test |
| "the item is available" | tire adapter `availability_state ∈ {shop_confirmed, on_hand}` recorded from an inbound shop response | adapter guard → 422 |
| "the case is resolved" | a human set `status = resolved` (`resolved_by_user_id` non-null) | route rule; no automatic resolution path exists |

`status` (`open|waiting|transferred|resolved|closed`) is the case lifecycle;
`handoff_status` is the handoff lifecycle; they are separate fields on purpose
(a case can be `transferred` and later `resolved`).

---

## 7. Case vs. booking vs. lead vs. conversation

| Term | Definition in this system | Table | Created by |
|---|---|---|---|
| **Contact** | a person/business we have talked to; not necessarily a user | `contacts` | operator |
| **Case** | one request/problem from a contact, with urgency, deadline, summary, owner, next action, handoff state; lives until a human resolves/closes it | `cases` | operator |
| **Interaction** (a.k.a. one entry of the conversation) | one call note, message note, internal note or state change on a case, with channel, direction, actor and truth flags | `case_interactions` | operator or system |
| **Conversation** | the ordered set of a case's interactions — a view, not a table | — | — |
| **Booking** | a scheduled service between an existing client user and a provider with a status machine (existing) | `bookings` | client via booking flow; a case may **link** to one, never create one |
| **Lead** | the v1/v2 term for a case that carries source/offer attribution and funnel semantics; **deferred**. In Phase 1 a "lead" is simply a case whose `entry_point`/`source_ref` point at an offer; no separate record | — | — |

---

## 8. Acceptance tests for the nine-step flow

| Step | Test |
|---|---|
| 1 Arrival | `POST /cases` requires `entry_point` from the allowlist; `source_ref` optional; case gets `status=open`, `handoff_status=not_yet_connected`, non-empty `next_action` |
| 2 Identify | lookup by phone returns the contact + last case summary; unknown → `{found:false}` and the wizard shows "Not identified"; provider lookup of a contact whose last case is another provider's → `{found:false, reason:'not_visible'}` |
| 3 Retrieve context | context strip renders `preferences`, `last_interaction_at`, last case summary; when absent renders "No previous case" (never blank) |
| 4 Questions | adapter returns ≤ 6 questions for `foot_care`; `tire_sourcing` question set exists and is unit-tested but has **no screen**; foot-care flow never loads tire questions |
| 5 Record | `problem` required; `urgency` allowlist; `needed_by` optional; `tried_already` stored verbatim |
| 6 Summary | server composes a deterministic summary from fields (snapshot test); operator edit stored; the edit appends an interaction |
| 7 Ask about human | `handoff_requested` NULL until asked; UI forces the question before finishing the wizard |
| 8 Handoff | state machine: illegal transitions → 422; `transferred` requires prior `transfer_in_progress`; `transfer_failed` auto-sets `human_followup_required` + next action + due; `platform_transferred` stays false; UI label "attested by <name> (outside the platform)" |
| 9 Continuity | after case creation `contacts.last_case_id` and `last_interaction_at` updated; second `POST /cases` for the same contact shows the first case in the context strip |
| Permissions | provider A `GET /cases` excludes B's and unassigned; `GET /cases/:id` of B's → 404; admin lists all and reassigns; reassign writes a `system_event` |
| Do-not-claim | `platformSent`/`platformTransferred` in request bodies ignored; outbound note renders "sent outside the platform"; `resolved` without a human actor impossible (no route) |
| Booking link | linking an existing booking leaves `users` and `bookings` counts unchanged |
| Empty states | `emptyReason` precedence `setup_incomplete → no_case_recorded → insufficient_data` with matching copy |
| Not measured | response-time and transfer-duration metrics render "not yet measured", never `0` |
| Regression | typecheck, api 143+, web 267+, preview pytests unchanged |

---

## 9. Simulated / manual in Phase 1 vs. later integration

| Capability | Phase 1 | Later phase (each needs terms, consent/privacy, security, opt-out, sent/delivered state, retention, audit) |
|---|---|---|
| Inbound call/message arrival | manual: operator opens New case | telephony webhook, e-mail/SMS ingestion (Phase 3/4) |
| Caller identification | lookup by phone/e-mail typed by operator | caller-ID match from telephony |
| Questions | human asks; adapter form | AI-assisted prompts (never diagnosis/advice) after policy review |
| Summary | deterministic template; human edits | AI summary, clearly labelled, after review |
| Transfer | **simulated**: state set by human attestation; platform performs nothing | warm transfer via telephony (Phase 4) with real `platform_transferred` |
| Outbound reply | note of what the human sent elsewhere | platform-sent e-mail/SMS with real `platform_sent` + delivery status (Phase 3) |
| Recording / transcription / voice model | none | Phase 4, consented only |
| Metrics | exact counts of cases/states; everything else "not yet measured" | Phase 5 |

---

## 10. Migration required — exact SQL as a **review artifact only**

Not written to `docs/migrations/`, not hashed as frozen, not applied anywhere
(including scratch) until approved. On approval it becomes
`docs/migrations/CASES_HANDOFF_V1.sql`, is hashed, rehearsed on the disposable
local PostgreSQL, and only then proposed for Gate B.

```sql
-- CASES_HANDOFF_V1 (PROPOSED — NOT APPROVED — NOT APPLIED)
-- Additive only. No existing table, column, enum or index is touched. No DOWN (restore-based rollback policy).
BEGIN;

CREATE TABLE contacts (
  id                  serial PRIMARY KEY,
  display_name        text,
  phone               text,
  email               text,
  user_id             integer REFERENCES users(id),
  preferred_channel   text,
  consent_status      text NOT NULL DEFAULT 'unknown',
  preferences         jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_case_id        integer,
  last_interaction_at timestamp,
  redacted_at         timestamp,
  created_by_user_id  integer NOT NULL REFERENCES users(id),
  created_at          timestamp NOT NULL DEFAULT now(),
  updated_at          timestamp NOT NULL DEFAULT now(),
  CONSTRAINT contacts_consent_status_check CHECK (consent_status IN ('unknown','inbound_only','contact_ok','do_not_contact'))
);
CREATE UNIQUE INDEX contacts_email_lower_unique_idx ON contacts (lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX contacts_phone_unique_idx       ON contacts (phone)        WHERE phone IS NOT NULL;

CREATE TABLE cases (
  id                           serial PRIMARY KEY,
  vertical                     text NOT NULL,
  contact_id                   integer REFERENCES contacts(id),
  entry_point                  text NOT NULL,
  source_ref                   text,
  problem                      text NOT NULL,
  tried_already                text,
  urgency                      text NOT NULL DEFAULT 'normal',
  needed_by                    timestamp,
  answers                      jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary                      text NOT NULL,
  status                       text NOT NULL DEFAULT 'open',
  handoff_requested            boolean,
  handoff_status               text NOT NULL DEFAULT 'not_yet_connected',
  assigned_user_id             integer REFERENCES users(id),
  assigned_provider_profile_id integer REFERENCES provider_profiles(id),
  next_action                  text NOT NULL,
  next_action_due_at           timestamp,
  booking_id                   integer REFERENCES bookings(id),
  resolved_by_user_id          integer REFERENCES users(id),
  resolved_at                  timestamp,
  created_by_user_id           integer NOT NULL REFERENCES users(id),
  created_at                   timestamp NOT NULL DEFAULT now(),
  updated_at                   timestamp NOT NULL DEFAULT now(),
  CONSTRAINT cases_next_action_nonempty_check CHECK (length(btrim(next_action)) > 0),
  CONSTRAINT cases_urgency_check       CHECK (urgency IN ('low','normal','high','urgent')),
  CONSTRAINT cases_status_check        CHECK (status IN ('open','waiting','transferred','resolved','closed')),
  CONSTRAINT cases_handoff_status_check CHECK (handoff_status IN ('not_yet_connected','transfer_requested','transfer_in_progress','transferred','transfer_failed','human_followup_required','note_only')),
  CONSTRAINT cases_resolved_requires_human_check CHECK (status <> 'resolved' OR resolved_by_user_id IS NOT NULL)
);
CREATE INDEX cases_assigned_provider_status_idx ON cases (assigned_provider_profile_id, status);
CREATE INDEX cases_status_due_idx               ON cases (status, next_action_due_at);
CREATE INDEX cases_handoff_status_idx           ON cases (handoff_status);
CREATE INDEX cases_contact_created_idx          ON cases (contact_id, created_at);

ALTER TABLE contacts
  ADD CONSTRAINT contacts_last_case_fk FOREIGN KEY (last_case_id) REFERENCES cases(id);

CREATE TABLE case_interactions (
  id                   serial PRIMARY KEY,
  case_id              integer NOT NULL REFERENCES cases(id),
  channel              text NOT NULL,
  direction            text NOT NULL,
  occurred_at          timestamp NOT NULL,
  actor_kind           text NOT NULL,
  actor_user_id        integer REFERENCES users(id),
  notes                text,
  answers              jsonb,
  transfer_status      text,
  outcome              text,
  platform_sent        boolean NOT NULL DEFAULT false,
  platform_transferred boolean NOT NULL DEFAULT false,
  created_at           timestamp NOT NULL DEFAULT now(),
  CONSTRAINT case_interactions_direction_check  CHECK (direction IN ('inbound','outbound','internal_note','system_event')),
  CONSTRAINT case_interactions_actor_kind_check CHECK (actor_kind IN ('human','ai','system')),
  CONSTRAINT case_interactions_actor_user_check CHECK (actor_kind = 'system' OR actor_user_id IS NOT NULL)
);
CREATE INDEX case_interactions_case_occurred_idx ON case_interactions (case_id, occurred_at);

COMMIT;
```

Notes for review: CHECK constraints are used only where the vocabulary is
part of the truth rules (status, handoff state, resolved-requires-human,
actor); `vertical`, `entry_point`, `channel`, `preferred_channel`, `outcome`
stay text + zod allowlists so a new vertical or channel needs no migration.
`actor_kind='ai'` is permitted by the CHECK so a future labelled AI assist
does not need DDL, but **nothing in Phase 1 writes it**.

---

## 11. Decisions needed before any file is created

| # | Question | Recommendation |
|---|---|---|
| C1 | Providers may create cases (auto-assigned to self) or admin only? | both (mirrors D1) |
| C2 | Contact retention | null phone/e-mail 90 days after the last case closes; set `redacted_at`; keep counts (mirrors D2) |
| C3 | Consent default for an inbound inquiry | `inbound_only` (mirrors D3) |
| C4 | Stall definition for the admin "stalled" list | no interaction for 24 h on an `open`/`waiting` case — display definition, documented |
| C5 | Should `transferred` be allowed as human attestation in Phase 1 at all, or should Phase 1 stop at `human_followup_required` until real telephony exists? | allow attestation, always labelled "attested by <name> (outside the platform)"; `platform_transferred=false` |
| C6 | Deterministic summary template wording (one sentence per recorded field) | draft in `docs/cases-handoff.md` for your approval before coding |
| C7 | Dashboard card for providers: a small "Cases needing you" card, or nav entry only? | small card + nav entry |
| C8 | Keep the v2 `sources` table deferred (yes) and record only `entry_point` + `source_ref` now? | yes |

---

## Stop

Nothing is coded, no Drizzle declaration is written, no migration file is
created, no SQL is executed (managed or scratch), no Twilio / Fish Audio / any
provider is connected, and no production configuration changes until the owner
approves §2, §4, §5, §6 and answers C1–C8.
