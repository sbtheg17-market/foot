# Ground Game Phase 1 — Caller context & handoff tool (scope-corrected review packet, rev 2)

**Status: REVIEW ONLY — NOT APPROVED. No code, no Drizzle declaration, no
migration file, no SQL executed (managed or scratch), no telephony/voice
provider connected, no production configuration changed.**
Prepared 2026-09-27 (E2 session). Rev 2 responds to the owner's review of rev 1:
C1–C8 in full with defaults, three distinct handoff facts in contract and UI,
a smaller first vertical slice, revised exact SQL, visual comparison marked
unverified.

This packet **replaces** the Phase 1 scope in
`docs/neo/2026-09-27-ground-game-phase1-review-packet.md` (v2) and
`docs/neo/2026-09-27-ground-game-design.md` (v1); those remain as history and
later-phase reference.

### Working specification and its limits

- **Visual comparison: UNVERIFIED.** Screenshots were supplied in the owner's
  conversation but **did not reach this job** (asset store empty). No claim in
  this packet is based on the images. **The nine written steps are the
  working specification.** If the images later arrive, a UX-only comparison
  will be recorded separately; nothing in the data model depends on it.
- **Repository fact:** no telephony, SMS, voice or transcription provider
  exists in this repository (Twilio / Fish Audio appear only in design docs).
  Nothing is proposed for activation.
- **Not a CRM / campaign suite / AI agent / omnichannel inbox / task engine.**

---

## 1. The nine steps → Phase 1 reality

| # | Step | Phase 1 |
|---|---|---|
| 1 | Call / message / manual inquiry arrives | Operator clicks **New case**, picks entry point (`phone`, `sms`, `email`, `platform_message`, `website`, `referral`, `walk_in`, `manual`) |
| 2 | Identify caller/contact when possible | Lookup by phone / e-mail in `contacts`; optional operator-confirmed match to `users` by e-mail; "Not identified" is a valid shown state |
| 3 | Retrieve last case + preferences | Context strip: `contacts.last_case_id` summary, `preferences`, `last_interaction_at`, consent |
| 4 | Ask a few contextual questions | Adapter question set (≤ 6) as a form; **the human asks and records**; no AI |
| 5 | Record need, urgency, deadline, tried | `cases.problem`, `urgency`, `needed_by`, `tried_already` |
| 6 | Concise summary | `cases.summary` composed **deterministically** from fields (template, C6); operator may edit; edit is an interaction row |
| 7 | Ask whether they want a human | `cases.handoff_requested` true/false (NULL = not asked yet; wizard forces the question) |
| 8 | Transfer / hand to a human | **Assignment + honest handoff state.** Platform performs nothing; only fact #1 (§6) may be recorded |
| 9 | Record status; useful record for next time | `handoff_status`, `next_action`, `assigned_*`; `contacts.last_case_id` / `last_interaction_at` updated; interactions appended |

---

## 2. Smallest data model (3 additive tables; no existing object touched)

```
contacts                                  -- a caller/contact; NOT a user account
  id                    serial PK
  display_name          text
  phone                 text
  email                 text
  user_id               integer → users(id)          -- only when operator confirms a match; never auto-created
  preferred_channel     text                          -- phone|sms|email|platform_message|none (zod allowlist)
  consent_status        text NOT NULL DEFAULT 'unknown'   -- unknown|inbound_only|contact_ok|do_not_contact (CHECK)
  preferences           jsonb NOT NULL DEFAULT '{}'       -- adapter-declared keys only
  last_case_id          integer → cases(id)          -- denormalised for the context strip (FK added after cases)
  last_interaction_at   timestamp
  redacted_at           timestamp                     -- when phone/email were nulled (C2)
  created_by_user_id    integer NOT NULL → users(id)
  created_at, updated_at

cases
  id                    serial PK
  vertical              text NOT NULL                 -- 'foot_care' | 'tire_sourcing' (adapter key)
  contact_id            integer → contacts(id)        -- nullable: "not identified"
  entry_point           text NOT NULL                 -- allowlist above
  source_ref            text                          -- free text listing/offer reference; never fetched
  problem               text NOT NULL
  tried_already         text
  urgency               text NOT NULL DEFAULT 'normal'    -- low|normal|high|urgent (CHECK)
  needed_by             timestamp
  answers               jsonb NOT NULL DEFAULT '{}'       -- adapter answers; adapter marks sensitive keys
  summary               text NOT NULL
  status                text NOT NULL DEFAULT 'open'      -- open|waiting|transferred|resolved|closed (CHECK)
  handoff_requested     boolean                       -- NULL = not asked
  handoff_status        text NOT NULL DEFAULT 'not_yet_connected'
                        -- not_yet_connected|transfer_requested|transfer_in_progress|transferred|transfer_failed|human_followup_required|note_only (CHECK)
  -- three distinct handoff facts (§6); server-set, never accepted from a request body
  human_attested_offplatform_connection boolean NOT NULL DEFAULT false   -- fact 1: Phase 1 may set true
  platform_transfer_initiated           boolean NOT NULL DEFAULT false   -- fact 2: Phase 1 always false
  platform_transfer_confirmed           boolean NOT NULL DEFAULT false   -- fact 3: Phase 1 always false
  handoff_attested_by_user_id integer → users(id)     -- who attested fact 1
  handoff_attested_at   timestamp
  assigned_user_id      integer → users(id)           -- the human who owns it now
  assigned_provider_profile_id integer → provider_profiles(id)   -- scoping key when that human is a provider
  next_action           text NOT NULL                 -- non-empty (CHECK)
  next_action_due_at    timestamp
  booking_id            integer → bookings(id)        -- link only
  resolved_by_user_id   integer → users(id)           -- required when status = resolved (CHECK)
  resolved_at           timestamp
  created_by_user_id    integer NOT NULL → users(id)
  created_at, updated_at

case_interactions                         -- append-only; no PUT/DELETE routes
  id                    serial PK
  case_id               integer NOT NULL → cases(id)
  channel               text NOT NULL                 -- phone|sms|email|platform_message|in_person|system
  direction             text NOT NULL                 -- inbound|outbound|internal_note|system_event (CHECK)
  occurred_at           timestamp NOT NULL
  actor_kind            text NOT NULL                 -- human|ai|system (CHECK; 'ai' never written in Phase 1)
  actor_user_id         integer → users(id)           -- required unless actor_kind = system (CHECK)
  notes                 text
  answers               jsonb
  transfer_status       text                          -- snapshot of handoff_status for handoff rows
  outcome               text
  platform_sent         boolean NOT NULL DEFAULT false   -- server-set; Phase 1 always false
  platform_transfer_initiated boolean NOT NULL DEFAULT false   -- server-set; Phase 1 always false
  platform_transfer_confirmed boolean NOT NULL DEFAULT false   -- server-set; Phase 1 always false
  created_at
```

State changes (assign, status, handoff) are `case_interactions` rows with
`direction='system_event'`, so no separate audit table is needed for this scope.

---

## 3. Safe reuse

| Structure | Reuse | Why safe |
|---|---|---|
| `users` | operator identity, assignment target, optional confirmed contact match | reference only; never inserted here |
| `provider_profiles` | assignment + approval gate | existing `requireApprovedProvider` semantics |
| `bookings` | optional `cases.booking_id` link (assigned provider's own bookings) | link only; no duplicate people/bookings |
| `requireAuth`, `requireRole`, `requireApprovedProvider` | all routes (composed locally in the new router) | existing gates |
| `QueueCard`, dialog patterns, `time-ago`, `marketplace-time` | UI | existing conventions |
| OpenAPI → orval codegen | contract first | existing pipeline |
| **Not reused:** `support_tickets`/`support_messages` (no direction/channel/visibility/actor semantics), `marketplace_events` (closed enum), `provider_notifications` (bound to application events) | — | semantically unsafe |

---

## 4. First vertical slice (smaller than rev 1) — and what it defers

The slice must demonstrate, end to end, on the preview against the scratch
database: **manually create a case → capture context → show the assigned
human the case → record an honest handoff state → retrieve that context on the
next interaction.**

### 4.1 Slice endpoints (5 of the 8)

| Method + path | Who | Purpose in the slice |
|---|---|---|
| `GET /contacts/lookup?phone=&email=` | admin; approved provider (match returned only if the contact's latest case is assigned to them) | step 2–3: contact + last case summary + preferences, or `{ found:false }` |
| `POST /cases` | admin; approved provider (auto-assigned to self) | steps 1–7 in one submit; body may include an inline `newContact {displayName, phone?, email?, preferredChannel?, consentStatus?}` **or** `contactId`; server composes `summary`, sets `handoff_status` from `handoff_requested` (`true → transfer_requested`, `false → note_only`), writes the `created` system_event |
| `GET /cases` (scoped) · `GET /cases/:id` | admin all; provider own only (else 404) | step 8: the assigned human sees the case + interactions (admin `internal_note` rows hidden from providers) |
| `PATCH /cases/:id` | admin: assign/reassign, handoff transition, next action, status; provider: handoff transition, next action, `waiting`/`resolved` | step 8–9; each change appends a system_event; handoff facts 2–3 are **never** writable |
| `POST /cases/:id/interactions` | admin; assigned provider | step 9: call/message/internal notes; `platformSent`/`platformTransfer*` ignored in body |

**Deferred from the slice** (rev 1 items 6–8 and extras): `PATCH /contacts/:id`
(preferences edited inline via `POST /cases` newContact only), `GET
/providers/me/cases/today` aggregate, `GET /admin/cases/overview` aggregate,
`/admin` QueueCard, provider dashboard card, stalled/failed lists, booking
link picker (column exists; UI later), outcome vocabulary UI, "not yet
measured" metric tiles (no metrics are shown in the slice at all).

### 4.2 Slice screens

| Screen | Content |
|---|---|
| **New case wizard** (`/admin/cases/new`, `/provider/cases/new`) | A. Identify (phone/e-mail lookup → context strip or "Not identified" → optional new contact) · B. Adapter questions (foot care ≤ 6) · C. Need / urgency / needed-by / tried · D. Summary (template, editable) · E. "Do they want to speak with a human?" → yes/no; if yes, admin may assign now · Done card: case id, owner, next action, handoff state |
| **Case list** (`/admin/cases`, `/provider/cases`) | plain list sorted by `next_action_due_at`: contact name, urgency chip, handoff-state chip, owner, next action; New case button; empty state (§8) |
| **Case detail drawer** | summary · context strip (last case, preferences, consent, last interaction) · interactions timeline with honesty labels (§6) · Add note · Handoff panel (§6 transitions) · Next action editor · admin-only Assign |

Route changes: `routes.ts` (`provider.cases`, `provider.newCase`, `admin.cases`,
`admin.newCase`), `App.tsx` (4 routes), one nav entry each side. **No change**
to Bookings, Services, Credentials, Profile, `/admin` home or the provider
dashboard in the slice.

### 4.3 Slice file list

| # | File |
|---|---|
| 1 | `docs/migrations/CASES_HANDOFF_V1.sql` — only after approval (§10) |
| 2 | `lib/db/src/schema/cases.ts` + export — after apply |
| 3 | `lib/api-spec/openapi.yaml` (5 endpoints) + codegen |
| 4 | `artifacts/api-server/src/lib/case-adapters.ts` (foot_care questions + sensitive keys; tire_sourcing questions, unit-tested, no screen) |
| 5 | `artifacts/api-server/src/lib/cases.ts` (summary template, handoff state machine, scope filter, masking, honesty flags) |
| 6 | `artifacts/api-server/src/routes/cases.ts` (+ mount in `routes/index.ts`) |
| 7 | `artifacts/api-server/src/__tests__/cases.test.ts`, `cases.integration.test.ts` (scratch DB) |
| 8 | `artifacts/web/src/lib/routes.ts`, `App.tsx`, nav entries |
| 9 | `artifacts/web/src/pages/cases/{new-case.tsx, case-list.tsx}` (shared by role; scope decided server-side) |
| 10 | `artifacts/web/src/components/cases/{context-strip, question-form, summary-card, handoff-panel, case-drawer, interaction-list, add-interaction-dialog}.tsx` |
| 11 | `artifacts/web/src/__tests__/cases-*.test.tsx` |
| 12 | `docs/cases-handoff.md` (states, three facts, ownership, summary template) · `backend/tests/test_cases.py` (read-only preview regression) |

---

## 5. Permission model

| Actor | Contacts | Cases | Interactions |
|---|---|---|---|
| Admin | lookup, create (inline), redact (later) | all; assign/reassign; all transitions; resolve | all incl. own `internal_note` |
| Approved provider | lookup match only via own assigned case; create inline within own new case | only `assigned_provider_profile_id = own`; others/unassigned → 404; transitions on own case; `waiting`/`resolved`; next action | rows on own cases except admin `internal_note`; may add inbound/outbound/internal (visible to admin) |
| Client / unapproved provider | none | none | none |

Server-side: contact phone/e-mail in full only to admin + assigned provider
(lists: display name + preferred channel); adapter `sensitive` answer keys only
on single-case read to admin/assigned provider; no clinical field exists in the
foot-care adapter (`non_clinical_context` only); verification docs, reviewer
notes, risk indicators, other providers' cases never joined; the three handoff
facts and `platform_sent` are server-set only.

---

## 6. Handoff: three distinct facts, one state, honest labels

### 6.1 The three facts (contract fields on `cases` and on handoff interactions)

| # | Fact | Field | Phase 1 |
|---|---|---|---|
| 1 | **A human attested an off-platform connection** (e.g. "I called the client and connected them with Sarah") | `humanAttestedOffplatformConnection` (+ `handoffAttestedBy`, `handoffAttestedAt`) | **may be recorded** — by the assigned human or admin, always with name + time |
| 2 | **The platform initiated a transfer** | `platformTransferInitiated` | **always false** — no transfer capability exists |
| 3 | **The transfer was confirmed successful by the platform/carrier** | `platformTransferConfirmed` | **always false** — no confirmation source exists |

Invariants (DB CHECK + zod + unit tests): fact 3 ⇒ fact 2; `handoff_status =
transferred` ⇒ (fact 1 **or** fact 3); facts 2–3 are never writable via API in
Phase 1 (`400` if present in a body); `platform_sent` likewise.

### 6.2 State machine (human-driven in Phase 1; each transition = one `system_event` row)

```
not_yet_connected
  ├─ caller says yes ──────────────▶ transfer_requested
  └─ caller says no / no human ────▶ note_only  |  human_followup_required
transfer_requested ── operator starts connecting ─▶ transfer_in_progress
transfer_in_progress
  ├─ operator attests connected (fact 1) ───────▶ transferred
  └─ operator attests could not connect ────────▶ transfer_failed ─(auto)─▶ human_followup_required
                                                     (next_action = "Call back <name>", due set)
human_followup_required ── human follows up ─▶ transfer_requested | note_only
any (by human) ── status: waiting | resolved (resolved_by required) | closed
```

### 6.3 UI copy bound to facts, not to the state word

| State + facts | Chip / timeline label |
|---|---|
| `transferred`, fact 1 only (Phase 1) | **"Connected off-platform — attested by <name>, <time>"** (never the word "transferred by the platform") |
| `transferred`, fact 3 (later) | "Transferred by platform — confirmed <time>" |
| fact 2 without fact 3 (later) | "Transfer started by platform — not yet confirmed" |
| `transfer_failed` | "Could not connect — attested by <name>" |
| `human_followup_required` | "Needs a human follow-up — <next action> by <due>" |
| `note_only` | "Recorded — no handoff requested" |
| `not_yet_connected` / `transfer_requested` / `transfer_in_progress` | plain state words |
| outbound interaction, `platform_sent=false` | "Recorded by <name> · sent outside the platform" |
| `resolved` | "Resolved by <name>, <time>" (never auto) |

The word **"transferred"** appears in UI copy only when fact 3 is true.

---

## 7. Case vs. booking vs. lead vs. conversation

| Term | Definition | Table |
|---|---|---|
| Contact | a person/business we spoke with; not necessarily a user | `contacts` |
| Case | one request with urgency, deadline, summary, owner, next action, handoff facts; lives until a human resolves/closes | `cases` |
| Interaction | one note or state change on a case with channel, direction, actor, honesty flags | `case_interactions` |
| Conversation | the ordered interactions of a case — a view, not a table | — |
| Booking | scheduled service between an existing client user and a provider (existing); a case may **link** to one, never create one | `bookings` |
| Lead | v1/v2 term for a case carrying source/offer attribution and funnel semantics — **deferred**; Phase 1 records only `entry_point` + `source_ref` | — |

---

## 8. Acceptance tests — first vertical slice

| Path step | Test |
|---|---|
| Create a case | `POST /cases` with inline `newContact` → 201; `status=open`; `handoff_requested=true ⇒ handoff_status=transfer_requested`, `false ⇒ note_only`; all three handoff facts false; `summary` equals the template snapshot; one `created` system_event |
| Capture context | `GET /contacts/lookup?phone=` returns the contact, `lastCase.summary`, `preferences`, `lastInteractionAt`; unknown → `{found:false}`; wizard shows "Not identified" and "No previous case" (never blank) |
| Show the assigned human | admin `PATCH /cases/:id {assignedUserId}` → provider `GET /cases` includes it, `GET /cases/:id` shows summary + context + interactions; provider B → 404; admin `internal_note` absent from provider payload |
| Record an honest handoff | provider `PATCH {handoffStatus:'transfer_in_progress'}` then `{handoffStatus:'transferred', attestOffplatformConnection:true}` → fact 1 true with attester + time, facts 2–3 false; UI chip reads "Connected off-platform — attested by …"; body containing `platformTransferInitiated`/`platformTransferConfirmed`/`platformSent` → 400; `transferred` without fact 1 → 422; `transfer_failed` auto-sets `human_followup_required` + next action + due |
| Retrieve context next time | second `POST /cases` for the same contact: lookup shows the first case's summary; `contacts.last_case_id` now = second case; `last_interaction_at` updated |
| Do-not-claim | outbound note renders "sent outside the platform"; `resolved` impossible without `resolvedByUserId` (CHECK + route); no route can set facts 2–3 |
| Adapter | foot care ≤ 6 questions; tire questions unit-tested, no screen; foot flow never loads tire questions; sensitive keys absent from list payloads |
| Empty state | `emptyReason` precedence `setup_incomplete → no_case_recorded`, copy asserted |
| Regression | typecheck; api 143+; web 267+; preview pytests unchanged |

---

## 9. Simulated / manual in Phase 1 vs. later

| Capability | Phase 1 | Later (each needs terms, consent/privacy, security, opt-out, sent/delivered state, retention, audit) |
|---|---|---|
| Arrival | manual New case | telephony webhook, e-mail/SMS ingestion |
| Identification | operator-typed lookup | caller-ID match |
| Questions | human asks; adapter form | AI-assisted prompts (never diagnosis/advice) |
| Summary | deterministic template, human-edited | labelled AI summary |
| Handoff | **fact 1 only (human attestation)**; facts 2–3 always false | real transfer → fact 2; carrier confirmation → fact 3 |
| Outbound reply | note of what the human sent elsewhere; `platform_sent=false` | platform-sent messages with delivery status |
| Recording / transcription / voice | none | consented only |
| Metrics | none shown in the slice | counts, then "not yet measured" tiles |

---

## 10. Migration — exact SQL, **review artifact only** (not a file, not hashed, not applied)

On approval it becomes `docs/migrations/CASES_HANDOFF_V1.sql`, is hashed,
rehearsed on the disposable local PostgreSQL, then separately proposed for
Gate B. Additive only; no DOWN (restore-based rollback policy).

```sql
-- CASES_HANDOFF_V1 (PROPOSED — NOT APPROVED — NOT APPLIED) — rev 2
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
  CONSTRAINT contacts_consent_status_check
    CHECK (consent_status IN ('unknown','inbound_only','contact_ok','do_not_contact'))
);
CREATE UNIQUE INDEX contacts_email_lower_unique_idx ON contacts (lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX contacts_phone_unique_idx       ON contacts (phone)        WHERE phone IS NOT NULL;

CREATE TABLE cases (
  id                                    serial PRIMARY KEY,
  vertical                              text NOT NULL,
  contact_id                            integer REFERENCES contacts(id),
  entry_point                           text NOT NULL,
  source_ref                            text,
  problem                               text NOT NULL,
  tried_already                         text,
  urgency                               text NOT NULL DEFAULT 'normal',
  needed_by                             timestamp,
  answers                               jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary                               text NOT NULL,
  status                                text NOT NULL DEFAULT 'open',
  handoff_requested                     boolean,
  handoff_status                        text NOT NULL DEFAULT 'not_yet_connected',
  human_attested_offplatform_connection boolean NOT NULL DEFAULT false,
  platform_transfer_initiated           boolean NOT NULL DEFAULT false,
  platform_transfer_confirmed           boolean NOT NULL DEFAULT false,
  handoff_attested_by_user_id           integer REFERENCES users(id),
  handoff_attested_at                   timestamp,
  assigned_user_id                      integer REFERENCES users(id),
  assigned_provider_profile_id          integer REFERENCES provider_profiles(id),
  next_action                           text NOT NULL,
  next_action_due_at                    timestamp,
  booking_id                            integer REFERENCES bookings(id),
  resolved_by_user_id                   integer REFERENCES users(id),
  resolved_at                           timestamp,
  created_by_user_id                    integer NOT NULL REFERENCES users(id),
  created_at                            timestamp NOT NULL DEFAULT now(),
  updated_at                            timestamp NOT NULL DEFAULT now(),
  CONSTRAINT cases_next_action_nonempty_check CHECK (length(btrim(next_action)) > 0),
  CONSTRAINT cases_urgency_check CHECK (urgency IN ('low','normal','high','urgent')),
  CONSTRAINT cases_status_check  CHECK (status IN ('open','waiting','transferred','resolved','closed')),
  CONSTRAINT cases_handoff_status_check CHECK (handoff_status IN (
    'not_yet_connected','transfer_requested','transfer_in_progress','transferred',
    'transfer_failed','human_followup_required','note_only')),
  CONSTRAINT cases_resolved_requires_human_check
    CHECK (status <> 'resolved' OR resolved_by_user_id IS NOT NULL),
  CONSTRAINT cases_transfer_confirmed_requires_initiated_check
    CHECK (platform_transfer_confirmed = false OR platform_transfer_initiated = true),
  CONSTRAINT cases_transferred_requires_evidence_check
    CHECK (handoff_status <> 'transferred'
           OR human_attested_offplatform_connection = true
           OR platform_transfer_confirmed = true),
  CONSTRAINT cases_attestation_requires_attester_check
    CHECK (human_attested_offplatform_connection = false
           OR (handoff_attested_by_user_id IS NOT NULL AND handoff_attested_at IS NOT NULL))
);
CREATE INDEX cases_assigned_provider_status_idx ON cases (assigned_provider_profile_id, status);
CREATE INDEX cases_status_due_idx               ON cases (status, next_action_due_at);
CREATE INDEX cases_handoff_status_idx           ON cases (handoff_status);
CREATE INDEX cases_contact_created_idx          ON cases (contact_id, created_at);

ALTER TABLE contacts
  ADD CONSTRAINT contacts_last_case_fk FOREIGN KEY (last_case_id) REFERENCES cases(id);

CREATE TABLE case_interactions (
  id                          serial PRIMARY KEY,
  case_id                     integer NOT NULL REFERENCES cases(id),
  channel                     text NOT NULL,
  direction                   text NOT NULL,
  occurred_at                 timestamp NOT NULL,
  actor_kind                  text NOT NULL,
  actor_user_id               integer REFERENCES users(id),
  notes                       text,
  answers                     jsonb,
  transfer_status             text,
  outcome                     text,
  platform_sent               boolean NOT NULL DEFAULT false,
  platform_transfer_initiated boolean NOT NULL DEFAULT false,
  platform_transfer_confirmed boolean NOT NULL DEFAULT false,
  created_at                  timestamp NOT NULL DEFAULT now(),
  CONSTRAINT case_interactions_direction_check
    CHECK (direction IN ('inbound','outbound','internal_note','system_event')),
  CONSTRAINT case_interactions_actor_kind_check CHECK (actor_kind IN ('human','ai','system')),
  CONSTRAINT case_interactions_actor_user_check
    CHECK (actor_kind = 'system' OR actor_user_id IS NOT NULL),
  CONSTRAINT case_interactions_confirmed_requires_initiated_check
    CHECK (platform_transfer_confirmed = false OR platform_transfer_initiated = true)
);
CREATE INDEX case_interactions_case_occurred_idx ON case_interactions (case_id, occurred_at);

COMMIT;
```

Review notes: CHECKs cover only truth rules (status/handoff vocab,
resolved-requires-human, transferred-requires-evidence, confirmed-requires-
initiated, attestation-requires-attester, actor). `vertical`, `entry_point`,
`channel`, `preferred_channel`, `outcome` remain text + zod allowlists so a
new vertical/channel needs no DDL. `actor_kind='ai'` is allowed by CHECK for a
future labelled assist; **nothing in Phase 1 writes it.**

---

## 11. Decisions C1–C8 — in full, with proposed defaults

**C1 — Who may create cases in Phase 1?**
Options: (a) admin only; (b) admin + approved providers, provider-created cases
auto-assigned to the creator; (c) providers only for contacts already linked to
them.
*Proposed default:* **(b)**. Rationale: providers take the calls; forcing them
through admin adds a delay the nine-step flow is meant to remove. Safeguards:
`created_by_user_id` visible to admin; admin list shows "self-created" chip;
providers still cannot see anyone else's cases.

**C2 — Contact retention (phone / e-mail).**
Options: (a) keep indefinitely; (b) null `phone`/`email` N days after the
contact's last case reaches `resolved`/`closed`, set `redacted_at`, keep the
case text and counts; (c) delete the contact row.
*Proposed default:* **(b) with N = 90 days**, executed by a documented manual
admin action in Phase 1 (no scheduler), policy text in `docs/cases-handoff.md`
before the artifact is frozen. `do_not_contact` contacts keep only the
consent flag and a hash-free "redacted" marker.

**C3 — Consent default for an inbound inquiry.**
Options: `unknown` · `inbound_only` · `contact_ok`.
*Proposed default:* **`inbound_only`** — truthful (they contacted us; nothing
more was granted). `contact_ok` only when the operator records that the
person agreed to be contacted back; `do_not_contact` blocks every future
outbound channel and is never overridden by a later channel integration.

**C4 — "Stalled" definition (admin list; deferred from the slice but decided now so the state words are stable).**
Options: (a) no interaction for 24 h on `open`/`waiting`; (b) 48 h; (c)
`next_action_due_at` passed.
*Proposed default:* **(a) 24 h OR (c) due passed**, whichever first — a
display definition documented in `docs/metrics-definitions.md`, not a stored
state.

**C5 — May `transferred` be recorded in Phase 1 by human attestation (fact 1)?**
Options: (a) yes, with mandatory attester + time and the label "Connected
off-platform — attested by <name>"; (b) no — Phase 1 stops at
`human_followup_required` until a real transfer path exists.
*Proposed default:* **(a)**. The CHECK `cases_transferred_requires_evidence_check`
guarantees the state is never reached without fact 1 or fact 3; the UI never
uses the word "transferred" for fact 1.

**C6 — Deterministic summary template.**
Options: (a) fixed one-sentence-per-field template composed server-side,
operator may edit, edit stored as an interaction; (b) free text only.
*Proposed default:* **(a)**, wording (for approval, foot care):
`"<Contact or 'Unidentified caller'> via <entry point> asks for <problem>. Urgency: <urgency>[; needed by <date>]. Already tried: <tried_already or 'nothing recorded'>. <Answers: key: value; …>. Wants a human: <yes/no/not asked>. Next: <next_action>."`
Tire adapter substitutes item/buyer/shop labels; same skeleton.

**C7 — Provider entry point.**
Options: (a) nav entry "Cases" only; (b) nav entry + small dashboard card
"Cases needing you"; (c) dashboard card only.
*Proposed default:* **(a) in the first slice**, (b) immediately after (card
deferred to keep the provider dashboard untouched in the slice).

**C8 — Defer the v2 `sources` table and record only `entry_point` + `source_ref` now?**
Options: (a) yes — free-text `source_ref`, sources table later if funnels are
ever wanted; (b) no — include `sources` now.
*Proposed default:* **(a)**. A sources table is campaign management, which is
out of Phase 1 scope; `source_ref` preserves the fact for later attribution
without any funnel semantics.

---

## Stop

Rev 2 ends here. Nothing is coded, no Drizzle declaration is written, no
migration file is created, no SQL is executed (managed or scratch), no
Twilio / Fish Audio / other provider is connected, and no production
configuration changes until the owner approves §2, §4, §5, §6, §10 and answers
C1–C8. Visual comparison with the supplied screenshots remains **unverified**.
