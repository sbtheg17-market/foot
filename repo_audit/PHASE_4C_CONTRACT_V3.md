# Phase 4C — Consent-First Client Comfort Profile Contract
**Candidate v3 (NEW derivation, 2026-08-10).** No continuity is claimed with any lost
prior contract document (lost checksums `1fa0eecb…` / "plan v2" are unrecoverable; this
document was re-derived from the published traceability record in `.agents/LOG.md`
Sessions 059–062 and the canonical codebase at `main = 3e76114`).

Status: **REVIEW REQUIRED before any implementation.** This is a product/API contract,
not an implementation. No schema, code, migration, event, mobile, analytics, or rollout
work is authorized by this document alone.

---

## 1. Purpose

Let clients optionally describe comfort, sensitivity, and accessibility preferences so
in-home visits feel safe and personal — while the client stays in complete control of
what is stored, what providers see, and for how long. OnCall Foot is a comfort/care
marketplace, **not** a medical service: nothing in this feature diagnoses, treats, or
implies medical suitability.

## 2. Binding principles (all inherited from published traceability)

1. **Consent-first** — nothing is collected, stored, or shown without explicit,
   plain-language, versioned consent. Consent is withdrawable at any time; withdrawal
   deactivates provider visibility immediately.
2. **Optional-everything** — every field is optional; the profile itself is optional;
   booking never requires a comfort profile.
3. **Owner-scoped** — only the owning client can create/read/update/withdraw their
   profile (`requireAuth` + `requireSelf` semantics; admin has no read surface in this
   slice; support access, if ever needed, is a separately reviewed scope).
4. **Additive-only structured schema** — new table(s) only; no changes to existing
   tables. **No free-text sensitive fields**: every preference is an enumerated,
   structured value. The single optional free-text field ("anything else for your
   visit") is explicitly labeled non-sensitive, length-capped, and excluded from the
   provider projection by default.
5. **Per-category client visibility controls** — the client toggles visibility per
   category (see §4), not per booking and not all-or-nothing.
6. **Booking-only filtered provider projection** — a provider sees a filtered
   projection only while they hold an ACTIVE booking with that client
   (statuses: `confirmed`, `en_route`, `in_progress` — exact set fixed at
   implementation review against `docs/booking-statuses.md`), and only the categories
   the client has made visible. No discovery surface, no search index, no list view
   ever includes preference data.
7. **Versioned + withdrawable consent** — consent records `{version, textHash,
   grantedAt}`; withdrawal is recorded, immediate, and reversible by re-granting.
   Historic bookings never retain a snapshot of withdrawn data.
8. **Language rule** — client-facing and provider-facing copy may say
   **"matches your preferences"** only. Never "medically suitable", "safe for your
   condition", "recommended for your health", or any diagnostic phrasing.

## 3. Explicitly out of scope for this slice (locked)

- No matching/ranking changes of any kind (preferences never affect discovery order).
- No new `marketplace_events` emission and no analytics properties from preference data.
- No mobile (Expo) work; web + API only.
- No PostHog / third-party analytics integration.
- No admin/moderation UI.
- No schema changes beyond the additive tables in §5.
- No care-notes/medical-history features; `careNotes` privacy rules unchanged.

## 4. Preference categories (structured vocabulary — `client_comfort_preferences`)

Vocabulary anchored to the published Session 060 record; enumerations are closed sets;
"unspecified" is always the default.

| Category | Field | Enum values (plus `unspecified`) |
|---|---|---|
| Booking reason | `bookingReason` | `comfort`, `relaxation`, `appearance`, `recurring_care`, `mobility_support`, `other_personal_goal` |
| Pressure | `pressurePreference` | `very_light`, `light`, `moderate`, `firm` |
| Touch | `touchSensitivity` | `low`, `medium`, `high` |
| Temperature | `temperaturePreference` | `cooler`, `neutral`, `warmer` |
| Fragrance | `fragrancePreference` | `fragrance_free_required`, `light_fragrance_ok`, `no_preference` |
| Sensitivities | `sensitivityFlags` | multi-select booleans: `sensitive_skin`, `allergy_common_lotions`, `allergy_latex`, `neuropathy_care_attention`, `bruises_easily` |
| Accessibility | `accessibilityNeeds` | multi-select booleans: `limited_mobility`, `uses_wheelchair`, `needs_seated_service`, `service_animal_present`, `stairs_at_entrance` |
| Setting | `settingPreference` | `at_home_only`, `studio_ok`, `either` |
| Appointment shape | `preferredDurationBucket` (`short_30_45`, `standard_60`, `extended_75_plus`), `preferredTimeWindows` (multi: `weekday_morning`, `weekday_afternoon`, `weekday_evening`, `weekend_morning`, `weekend_afternoon`, `weekend_evening`) |
| Communication | `communicationPreference` | `chatty`, `quiet_visit`, `no_preference`; `languagePreference` (BCP-47 code from a curated list) |
| Free note | `visitNote` | optional text ≤ 280 chars, non-sensitive label, **hidden from providers unless the client explicitly toggles the `visit_note` category visible** |

Per-category visibility toggles: `bookingReason`, `comfort` (pressure/touch/temperature/
fragrance), `sensitivities`, `accessibility`, `setting`, `appointment_shape`,
`communication`, `visit_note`. Default for every category: **hidden** until the client
turns it on (privacy by default).

## 5. Data model (additive-only; final DDL at implementation review)

- `client_comfort_profiles` — `id`, `userId` (unique, FK users, cascade delete),
  structured fields from §4, `visibilityFlags` (per-category booleans), `createdAt`,
  `updatedAt`.
- `client_comfort_consents` — `id`, `userId` (FK users), `consentVersion` (int),
  `consentTextHash` (sha256 of the exact copy shown), `grantedAt`,
  `withdrawnAt` (nullable). Latest row wins; a row with `withdrawnAt` set and no later
  grant means **no consent** — API must then return no profile data to anyone,
  including the owner's provider projection.
- Prices are unaffected; no monetary fields in this slice.

## 6. API contract (OpenAPI-first; exact shapes at implementation review)

All routes require auth; all are owner-scoped except the provider projection.

| Route | Role | Behavior |
|---|---|---|
| `GET /api/clients/me/comfort-profile` | client (self) | Profile + visibility flags + current consent state; `204`/empty-state if none. |
| `PUT /api/clients/me/comfort-profile` | client (self) | Upsert structured fields + visibility flags. Rejected with a clear error if no active consent. Zod-validated closed enums; unknown keys rejected. |
| `DELETE /api/clients/me/comfort-profile` | client (self) | Hard-deletes profile row (consent history retained). |
| `POST /api/clients/me/comfort-consent` | client (self) | Grant consent `{version}`; server stores hash of served consent text. |
| `DELETE /api/clients/me/comfort-consent` | client (self) | Withdraw consent (immediate; projection goes dark). |
| `GET /api/bookings/:id/client-comfort` | provider (booking party) | **Only** if the requesting provider owns the booking AND booking status is in the active set AND client consent is active — returns only client-visible categories. Otherwise `404` (never `403`, to avoid confirming existence). |

Server-side enforcement is authoritative; clients render only what the server returns
(no duplicated authorization rules in UI).

## 7. Web UI slice (mobile-first, 390px)

1. Client → Profile area → "Comfort preferences" screen: plain-language consent card
   (version + short copy) → grant → per-category editors with visibility toggles →
   save. Withdraw button always visible once granted, with an honest explanation of
   effect.
2. Provider → active booking detail: a "Client comfort preferences" card appears only
   when the projection returns data; renders "matches your preferences"-style copy;
   renders nothing (not even an empty card) otherwise.
3. Booking flow: after a booking request is created, a light, dismissible prompt may
   invite the client to add comfort preferences (never blocking).

## 8. Acceptance criteria

1. Client can grant consent, save a profile, edit it, withdraw consent, re-grant, and
   delete — all owner-scoped (verified by integration tests incl. cross-user 404s).
2. Provider with an active booking sees exactly the visible categories; provider with a
   `requested`/`completed`/`cancelled`-only relationship sees nothing; unrelated
   provider sees `404`.
3. Consent withdrawal takes effect on the next projection request (no caching leak).
4. No discovery/search/list endpoint includes any preference field (asserted by test).
5. All enums closed; free text capped at 280 chars and hidden by default.
6. `pnpm run typecheck`, `pnpm run build`, and new focused integration suite pass;
   existing 164-test regression stays green.
7. Copy audit: zero occurrences of medical-suitability phrasing.

## 9. Implementation sequencing (after this contract is approved)

C-1: additive schema + codegen (spec-first) → C-2: storage + API routes + integration
tests → C-3: web UI (client editor, provider booking card) → regression + E2E. One
focused local commit per step; patch + checksum artifacts each; no pushes from the
workspace.
