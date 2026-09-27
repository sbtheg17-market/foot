# Today's Leads — connected-flow contract & UI proposal (docs only) — 2026-09-27

**Status: PROPOSAL · NOT IMPLEMENTED · NOT APPROVED.** Nothing in this file changes
code, `openapi.yaml`, generated clients, the database or any channel. The shipped
release (`review/todays-leads-shell`) stays read-only: `connected:false`,
`emptyReason:"not_connected"`, `items:[]`; no ingestion, no Cases/Handoff tables,
no messaging/SMS/voice/recording/transcription/AI, no scraping, no production
configuration change.

Purpose: show **exactly** how `LeadActivityItem` / `LeadActivityResponse` would
grow to carry one connected *active case* (caller-context sequence) **without
breaking the empty state**, and how the existing destinations `/provider/leads`
and `/admin/ground-game` would evolve inside their current placement.

Related: `2026-09-27-ground-game-phase1-case-handoff-packet.md` (three handoff
facts, C1–C8, review-only SQL), `2026-09-27-ground-game-phase1-review-packet.md`
(§A.3 empty-state rule, §5 vertical adapters).

---

## 0. Compatibility contract (the non-negotiables)

| Rule | How it is guaranteed |
|---|---|
| Unconnected response is **byte-identical** to today | `LeadActivityResponse.required` stays `[connected, items]`; every new field is optional/nullable; `NO_SOURCE` path in `lib/lead-activity.ts` is untouched (`{connected:false, emptyReason:"not_connected", items:[]}`) |
| Existing tests keep passing unchanged | `lead-activity.test.ts` (7) and `leads-view.test.tsx` (7) assert only on the fields that already exist; new fields are additive |
| No `info.version` bump needed | additive optional fields only (same policy as the shell commit) |
| Generated clients stay deterministic | orval regenerates `leadActivity*` types; new zod fields are `.optional()/.nullable()`; hand edits to `lib/**/generated` remain forbidden |
| Provider never receives admin-only data | projection happens **server-side** in the adapter (`projectForProvider`), before the route responds; the web app never filters sensitive data itself |
| No invented wording | every `exchange` entry has a `provenance`; `template` = deterministic adapter prompt text (C6), `caller_provided`, `operator_recorded`. There is no `ai` provenance value |
| Platform transfer stays unavailable | `handoff.platformTransferInitiated` / `platformTransferConfirmed` are emitted as `false` and `capabilities.platformTransfer` is `false` until a real integration exists (packet §6 facts 2–3) |

---

## 1. Contract expansion — exact additive YAML (proposal, not applied)

### 1.1 `LeadActivityResponse` — envelope (adds 4 optional fields)

```yaml
    LeadActivityResponse:
      type: object
      properties:
        connected: { type: boolean }                       # unchanged
        emptyReason:                                       # unchanged enum
          type: string
          nullable: true
          enum: [not_connected, setup_incomplete, no_active_source, no_tracked_inquiry, insufficient_data]
        items:                                             # unchanged
          type: array
          items: { $ref: "#/components/schemas/LeadActivityItem" }
        # ── additive (all optional) ────────────────────────────────────────
        scope:
          type: string
          enum: [provider, admin]
          description: Which projection produced this payload (server-decided, never client-chosen)
        vertical:
          type: string
          nullable: true
          description: Adapter key that supplied `labels` (foot_care | tire_sourcing | …)
        labels:
          $ref: "#/components/schemas/LeadActivityLabels"
        activeItemId:
          type: string
          nullable: true
          description: Item to render as the "active lead/case card"; null when none
        sourcePerformance:
          nullable: true
          allOf: [{ $ref: "#/components/schemas/LeadSourcePerformance" }]
          description: Admin scope only, and ONLY when actually measured; otherwise null (never zeros)
      required: [connected, items]                         # unchanged
```

### 1.2 `LeadActivityItem` — item (adds 12 optional fields; existing 13 unchanged)

Existing (unchanged, still the only `required` set): `id, source{name,type},
offerRef?, attribution, vertical, needSummary, assignedProviderId?, ownerRole,
status, lastUpdate{summary,at}, nextAction{label,dueAt?}, relatedBookingId?, origin`.

```yaml
    LeadActivityItem:
      type: object
      properties:
        # … existing 13 properties exactly as today …
        # ── additive (all optional) ────────────────────────────────────────
        entryPoint:
          type: string
          nullable: true
          description: How the inquiry arrived (phone_call | web_form | referral | walk_in | listing_reply | other). Distinct from `source` (offer/campaign).
        contact:
          $ref: "#/components/schemas/LeadContactSummary"
        request:
          $ref: "#/components/schemas/LeadRequest"
        history:
          $ref: "#/components/schemas/LeadHistory"
        urgency:
          type: string
          nullable: true
          enum: [low, normal, high, urgent]
        neededBy:
          type: string
          format: date-time
          nullable: true
        triedAlready:
          type: string
          nullable: true
          description: Answer to "What has already been tried?" — caller-provided or operator-recorded text (see `facts` provenance)
        facts:
          type: array
          items: { $ref: "#/components/schemas/LeadFact" }
          description: Compact structured case card; order and labels come from the vertical adapter
        exchange:
          type: array
          items: { $ref: "#/components/schemas/LeadExchangeEntry" }
          description: Conversational Q&A in order (prompt → caller/operator response). ≤ 12 entries in a list payload
        notes:
          type: array
          items: { $ref: "#/components/schemas/LeadNote" }
          description: Concise structured notes. Provider scope receives `visibility=shared` only
        handoff:
          $ref: "#/components/schemas/LeadHandoff"
        capabilities:
          $ref: "#/components/schemas/LeadCapabilities"
        ownerDisplayName:
          type: string
          nullable: true
        oversight:
          $ref: "#/components/schemas/LeadOversight"
          description: Admin scope only; absent in provider payloads
      required: [id, source, attribution, vertical, needSummary, ownerRole, status, lastUpdate, nextAction, origin]   # unchanged
```

### 1.3 New component schemas

```yaml
    LeadActivityLabels:
      type: object
      description: Adapter-supplied wording so the layout is identical across verticals
      properties:
        contact:   { type: string, example: "Client" }        # tire: "Buyer"
        item:      { type: string, example: "Foot-care request" } # tire: "Item"
        owner:     { type: string, example: "Provider" }      # tire: "Shop"
        source:    { type: string, example: "Entry point" }
        openingPrompt: { type: string, example: "What's going on?" }  # tire: "What are you looking for?"
        handoffHuman:  { type: string, example: "Wants a provider?" } # tire: "Wants a shop?"
      required: [contact, item, owner, source, openingPrompt, handoffHuman]

    LeadContactSummary:
      type: object
      properties:
        permitted:   { type: boolean, description: Whether the requester may see this contact at all }
        displayName: { type: string, nullable: true, description: Null unless permitted. Never phone/e-mail in list payloads }
        consent:     { type: string, nullable: true, enum: [unknown, inbound_only, contact_ok, do_not_contact] }
      required: [permitted]

    LeadRequest:
      type: object
      properties:
        current:          { type: string, description: Current request in the caller's words (sanitized) }
        requestedService: { type: string, nullable: true }
        area:             { type: string, nullable: true, description: Coarse area only (city/zone), never a street address }
        timing:           { type: string, nullable: true }
      required: [current]

    LeadHistory:
      type: object
      description: Saved preferences and last case — only when authorized
      properties:
        permitted:       { type: boolean }
        lastCaseSummary: { type: string, nullable: true }
        lastCaseAt:      { type: string, format: date-time, nullable: true }
        preferences:     { type: string, nullable: true }
      required: [permitted]

    LeadFact:
      type: object
      properties:
        key:        { type: string }
        label:      { type: string }
        value:      { type: string, nullable: true }
        kind:       { type: string, enum: [text, date, number, enum, money_cents] }
        provenance: { type: string, enum: [caller_provided, operator_recorded, system] }
        confidence: { type: string, nullable: true, enum: [confirmed, unconfirmed], description: Tire availability etc.; null when not applicable }
      required: [key, label, kind, provenance]

    LeadExchangeEntry:
      type: object
      properties:
        id:         { type: string }
        role:       { type: string, enum: [prompt, caller, operator] }
        text:       { type: string }
        at:         { type: string, format: date-time }
        provenance: { type: string, enum: [template, caller_provided, operator_recorded] }
        recordedBy: { type: string, nullable: true, description: Operator display name when provenance=operator_recorded }
      required: [id, role, text, at, provenance]

    LeadNote:
      type: object
      properties:
        id:         { type: string }
        text:       { type: string }
        by:         { type: string }
        at:         { type: string, format: date-time }
        visibility: { type: string, enum: [shared, internal], description: internal never leaves the admin projection }
      required: [id, text, by, at, visibility]

    LeadHandoff:
      type: object
      description: Three distinct facts (case-handoff packet §6). The word "transferred" is shown only when platformTransferConfirmed is true.
      properties:
        state:
          type: string
          enum: [not_yet_connected, transfer_requested, transfer_in_progress, transferred, transfer_failed, human_followup_required, note_only]
        wantsHuman:               { type: string, enum: [yes, no, not_asked] }
        humanFollowupRequired:    { type: boolean }
        humanAttestedOffplatformConnection: { type: boolean }
        attestedBy:               { type: string, nullable: true }
        attestedAt:               { type: string, format: date-time, nullable: true }
        platformTransferInitiated: { type: boolean, description: Always false until a real transfer integration exists }
        platformTransferConfirmed: { type: boolean, description: Always false until a real transfer integration exists }
      required: [state, wantsHuman, humanFollowupRequired, humanAttestedOffplatformConnection, platformTransferInitiated, platformTransferConfirmed]

    LeadCapabilities:
      type: object
      description: Server-computed. A control renders ONLY when its flag is true. All false in the unconnected slice.
      properties:
        recordUpdate:            { type: boolean, description: True only when an approved write model exists }
        continueOutsidePlatform: { type: boolean, description: Informational affordance; no channel needed }
        reply:                   { type: boolean, description: False until a real messaging channel is connected }
        call:                    { type: boolean, description: False until a real voice channel is connected }
        confirm:                 { type: boolean, description: False until a real confirmation source exists }
        platformTransfer:        { type: boolean, description: False until a real transfer integration exists }
      required: [recordUpdate, continueOutsidePlatform, reply, call, confirm, platformTransfer]

    LeadOversight:
      type: object
      description: Admin-only operational context
      properties:
        assigned:               { type: boolean }
        stalled:                { type: boolean, description: Display rule C4 (24 h idle OR next action overdue); never stored }
        providerResponseStatus: { type: string, enum: [none, awaiting_provider, provider_responded, followup_scheduled] }
        offer:                  { type: string, nullable: true }
      required: [assigned, stalled, providerResponseStatus]

    LeadSourcePerformance:
      type: object
      description: Emitted only when measured; an unmeasured metric is omitted, never 0
      properties:
        sourceName: { type: string }
        measuredFrom: { type: string, format: date-time }
        inquiries:  { type: integer }
        connected:  { type: integer, description: Cases with humanAttestedOffplatformConnection or platformTransferConfirmed }
      required: [sourceName, measuredFrom, inquiries, connected]
```

### 1.4 Adapter changes implied (still no data source)

- `LeadActivityItem`/`LeadActivityResponse` TS types in `lib/lead-activity.ts` gain the
  same optional fields; `NO_SOURCE` and `unconnected()` are unchanged.
- New pure functions, unit-tested with fixtures only:
  `projectForProvider(item, providerProfileId)` — drops `oversight`, `notes[visibility=internal]`,
  `contact` when `!permitted`, `history` when `!permitted`, any item whose
  `assignedProviderId !== providerProfileId`;
  `projectForAdmin(item)` — passes everything except third-party verification material and
  risk flags, which are never part of this contract at all;
  `emptyReasonFor(scope, sourceState, items)` — §3 mapping.
- `LeadSource` interface gains `labels(vertical)` and `capabilities(scope)`; both
  return the unconnected defaults today.

---

## 2. Target UI inside the existing destinations (no new routes, no new nav tab)

Mobile-first vertical flow at 390 px; same components for both verticals; only
`labels`/`facts` differ. The existing `LeadActivityView` becomes the shell that
composes ≤ 50-line pieces:

```
/provider/leads  (390px)                          component
┌──────────────────────────────────────────┐
│ Daily Ground Game                        │  LeadHeader (title, one-line "what
│ 1 active case · next: call back by 3 pm  │  needs attention today"; counts only
├──────────────────────────────────────────┤  from real items, else omitted)
│ ▣ ACTIVE CASE           Urgent · by Fri  │  ActiveCaseCard (source/entry point,
│ Phone call → Foot-care request           │  contact name if permitted, request,
│ Maria K. · heel pain, home visit         │  urgency, needed-by, tried already,
│ Tried: pharmacy insoles                  │  last update, next action)
│ Last: recorded by Admin, 10:12           │
│ Next: Call back · due 3:00 pm            │
├──────────────────────────────────────────┤
│ ○ What's going on?             template  │  ExchangeFlow (prompt card = muted;
│ ● "My heel hurts when I stand… "         │  response card = contrast; each
│     caller-provided · 10:05              │  response labelled caller-provided /
│ ○ Where and when?                        │  recorded by <operator>)
│ ● "Downtown, mornings this week"         │
│     recorded by Admin · 10:07            │
├──────────────────────────────────────────┤
│ CASE CARD                                │  FactsCard (compact label/value grid
│ Service      Home foot-care assessment   │  from `facts`; confidence chip when
│ Area         Downtown                    │  present, e.g. tire "unconfirmed")
│ Timing       Mornings, this week         │
│ Last case    Nail care, Aug 12 (perm.)   │
├──────────────────────────────────────────┤
│ HANDOFF                                  │  HandoffPanel (bound to the three
│ Wants a provider?  Yes                   │  facts; "Connected off-platform —
│ Human follow-up required                 │  attested by <name>" only for fact 1;
│ Platform transfer: not available         │  transfer row always "not available")
├──────────────────────────────────────────┤
│ NEXT ACTION  Call back · due 3:00 pm     │  NextActionBar (controls only if
│ [ Continue outside the platform ]        │  capabilities.* is true; otherwise
│ [ Record update ]  (only if recordUpdate)│  text only)
└──────────────────────────────────────────┘
```

- No table, no column headers, no bulk selection, no inbox filters.
- Dark/light contrast for prompt vs. response uses the existing tokens
  (`bg-secondary` prompt, `bg-primary text-primary-foreground` response); no new palette.
- Headings: one `h1` (page), `h2` per section; every card `data-testid` (`active-case-card`,
  `exchange-entry-<id>`, `facts-card`, `handoff-panel`, `next-action-bar`).
- Focus states and ≥ 4.5:1 contrast reuse the current design system; 390 px overflow check
  stays part of the screenshot routine.

`/admin/ground-game` — same components plus oversight wrapped around them:

```
Ground Game (admin)
├ Sources & offers (only listed, performance only if `sourcePerformance` present)
├ Needs an owner        → items with oversight.assigned=false   (ActiveCaseCard, compact)
├ Stalled               → oversight.stalled=true                (same card + "stalled" chip)
├ All active cases      → owner, latest update, next action, urgency, handoff chip,
│                          provider response status
└ (tap) → full ActiveCaseCard + ExchangeFlow + FactsCard + HandoffPanel + internal notes
```

Admin sees the broader context; the admin projection still never includes verification
material or internal risk flags (not part of the contract), and a provider's contacts are
shown only for cases the admin is authorized to oversee.

---

## 3. Empty-state mapping (server decides; copy per scope)

| `emptyReason` | Provider copy | Admin copy |
|---|---|---|
| `not_connected` (today) | **"Lead activity isn't connected yet."** (unchanged) | same |
| `no_active_source` | "No active source is producing leads yet." | "No active source is producing leads yet. Activate an offer to start." |
| `no_tracked_inquiry` | "No inquiry has been recorded for you yet." | "No inquiries recorded for the active source(s)." |
| `insufficient_data` | "Not enough activity yet to show this." | same |
| `setup_incomplete` | "Finish setup before leads can be routed to you." → existing readiness link | "Provider <name> can't receive leads until setup is complete." |

Precedence when several apply: `not_connected` → `setup_incomplete` → `no_active_source`
→ `no_tracked_inquiry` → `insufficient_data`. An unmeasured metric is omitted, never `0`.

---

## 4. Visibility matrix (enforced by projection, tested with fixtures)

| Field | Approved provider (own items) | Admin |
|---|---|---|
| `contact.displayName` | only if `contact.permitted` | if permitted for oversight |
| `contact` phone / e-mail | **never in this contract** | never in list payloads |
| `history.*` | only if `history.permitted` | yes |
| `notes[visibility=internal]` | **never** | yes |
| `oversight` | **absent** | yes |
| other providers' items | **filtered out** (`assignedProviderId`) | all authorized |
| `sourcePerformance` | absent | only when measured |
| verification material / risk flags | not in contract | not in contract |

---

## 5. Vertical adapter config (same layout, different labels/facts)

| Slot | foot_care | tire_sourcing |
|---|---|---|
| `labels.openingPrompt` | "What's going on?" | "What are you looking for?" |
| `labels.contact / item / owner` | Client / Foot-care request / Provider | Buyer / Item / Shop |
| `request.requestedService` | requested foot-care service | item/request |
| `facts` (ordered) | service · area · timing · relevant non-clinical context · tried already · urgency | tire size · quantity (2 / 4) · condition/type · needed-by · shops/listings already checked · availability (`confirmed`/`unconfirmed`) |
| `labels.handoffHuman` | "Wants a provider?" | "Wants a shop?" |
| Follow-up | booking or provider follow-up (`relatedBookingId` link only, never auto-create) | human/shop handoff |
| Sensitive keys (never in list payloads) | accessibility/clinical notes | none beyond contact details |

Exchange prompts are fixed adapter templates (`provenance=template`); responses are
`caller_provided` or `operator_recorded`. No generated or paraphrased wording.

---

## 6. Acceptance tests to add with the connected slice (fixture-only until a source exists)

1. `NO_SOURCE` response is deep-equal to today's `{connected:false, emptyReason:"not_connected", items:[]}` — no new key appears.
2. Provider projection removes `oversight`, internal notes, unpermitted `contact`/`history`, other providers' items.
3. Admin projection keeps `oversight` and internal notes; never emits contact phone/e-mail.
4. `emptyReasonFor` precedence table (§3) for both scopes.
5. Handoff copy: fact 1 → "Connected off-platform — attested by <name>"; the word "transferred" appears only when `platformTransferConfirmed`.
6. `capabilities` all false ⇒ `/provider/leads` renders zero buttons (extends the existing "no action controls" test).
7. Exchange entries render their provenance label; no entry without provenance.
8. Labels swap between `foot_care` and `tire_sourcing` fixtures with identical DOM structure (same test IDs).
9. 390 px: no horizontal overflow on both pages with a full fixture item.

---

## 7. What this proposal does **not** authorize (separate approvals required)

- The data source itself (`LeadSource` implementation) and any ingestion path.
- Cases/Handoff/Contacts tables or any SQL (case-handoff packet §10 stays a review artifact).
- Any write endpoint (`recordUpdate`), messaging, SMS, voice, recording, transcription, AI agent, scraping.
- Any production configuration, Railway, Supabase or deployment change.
- Decisions C1–C8 remain open; C5/C6 wording above is the proposed default only.

**Stop.** Next step, if approved: contract-only commit (OpenAPI + orval regeneration + adapter
types/projection functions + fixture tests), still returning the unconnected shell in production.
