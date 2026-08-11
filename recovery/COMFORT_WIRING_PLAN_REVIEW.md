# COMFORT-WIRING PLAN — SECTION-BY-SECTION REVIEW
Reviewed: 2026-08-11. Reviewer: Neo (E2/Emergent), against the checked-out candidate
phase4c-nonschema-prep-r3 (d9195dfa) artifacts — not against summaries.
Verdicts: ACCEPTED / CHANGE REQUESTED / UNRESOLVED. No wiring, codegen, schema, or
tables were touched during this review.

## Verdict table

| # | Section | Verdict | Evidence / contract reference |
|---|---|---|---|
| 1 | Six exact routes and operations | **ACCEPTED** | openapi.draft.yaml: exactly six operationIds — getMyComfortProfile / putMyComfortProfile (path /clients/me/comfort-profile, lines 40-114), deleteMyComfortProfile, grantComfortConsent / withdrawComfortConsent (/clients/me/comfort-consent, 115-166), getBookingClientComfort (/bookings/{bookingId}/client-comfort, 167+). Matches contract V3 §6. |
| 2 | Status-code matrix | **CHANGE REQUESTED** | Draft yaml disagrees with the plan table in three places: grantComfortConsent returns **201** (+400, 401) — plan wrote 200; withdrawComfortConsent is 200/401/**404** — plan omitted 404; deleteMyComfortProfile is 204/401/**404** — plan omitted 404. PUT verified 200/400/401/**409** as planned. Plan v1.1 must adopt the draft's exact codes; the OpenAPI draft (checksum-pinned to contract 339a03e6…) is the source of truth. |
| 3 | Server-owned rules vs client-owned presentation | **ACCEPTED** | contract module exports the complete rule surface: validateComfortPreferences (line 193), validateVisibilityFlags (248), isConsentActive latest-row (280), buildProviderProjection (343), findForbiddenMedicalPhrases (409). Both shells are pure props-driven presentation with zero rule logic (provider card decides only null-render; editor receives consentStatus as a prop, "server-driven at C-3" comment at line 78). |
| 4 | Consent-first behavior | **ACCEPTED** | PUT 409 present in draft; contract §2 binding principle "consent-first: PUT profile is rejected without active consent (409)"; isConsentActive implements latest-row semantics; editor shell locks editors until consentActive (line 101, 158); covered by the 38 contract tests (ledger AC-004). |
| 5 | Withdraw-hides-but-never-deletes | **ACCEPTED** | Separate operations: withdraw (op 5) returns consent state with profile retained; DELETE (op 3) is the only destructive action. Shell consent copy states it verbatim: "withdrawal hides everything immediately" (editor line 94). Contract §2. |
| 6 | Booking-scoped 404-only projection, four conditions | **ACCEPTED** | Draft: op 6 responses 200/401/404 only — no 403 exists; contract §2 "404 (never 403) on any denial". Conditions encoded: assigned provider + booking status via PROJECTION_ACTIVE_BOOKING_STATUSES ['confirmed','en_route','in_progress'] (module line 296) + consent active + profile exists, composed in buildProviderProjection returning null on any failure; visibility filtering inside the builder. Provider card renders NOTHING on null/empty — "no card, no empty state, no hint that a profile exists" (card lines 6, 64-65). |
| 7 | Loading / empty / unauthorized / forbidden-by-404 / error states | **CHANGE REQUESTED** | Plan overstated "all states already scaffolded". Verified today: provider card empty/hidden state ✓; editor consent-lock and empty defaults ✓. NOT yet present in either shell: loading skeletons, error/retry banner, unauthorized redirect handling — these must be ADDED at C-3 wiring and the plan must say "to be added", not "scaffolded". Forbidden-by-404 design confirmed correct (no 403 anywhere in the draft). |
| 8 | Integration / status-matrix / no-event test plan | **CHANGE REQUESTED** | Test content accepted (per-operation error matrix, consent edge, projection status matrix, visibility filtering, no marketplace_events writes — contract §3 lock). Harness correction: the repo convention is node:test + fetch against a running BASE (see review.integration.test.ts imports "node:test", fetch(`${BASE}${path}`)) — NOT supertest as the plan proposed. Plan v1.1 must follow the existing harness. |
| 9 | Exact seven-file scope and C-1 codegen isolation | **ACCEPTED** | Seven implementation files enumerated (new comfort.ts route + routes/index.ts mount + integration test + package.json script + two shell edits + web router registration); C-1 isolated: lib/api-spec "codegen" script runs orval confined to lib/api-zod + lib/api-client-react then typecheck:libs — generated output only, consistent with WIRING_NOTES C-1. |
| 10 | Additive tables, rollback, Gate B, stop conditions | **ACCEPTED (with note)** | Tables client_comfort_profiles + client_comfort_consents per contract §5 (additive-only; "final DDL at implementation review" — exact DDL remains a C-1 review item, correctly NOT fixed by this plan). lib/db uses drizzle (drizzle.config.ts) so additive migrations follow the existing path. Gate B ordering and the eight stop conditions match owner constraints; Gate B must confirm comfort tables do NOT pre-exist. |

## Summary
- 8 sections ACCEPTED, 2 CHANGE REQUESTED (status-code matrix; UI-state wording +
  test harness), 0 UNRESOLVED.
- Plan revised to v1.1 in place (revision note at top) folding in the three
  corrections: grant=201(+400), withdraw/delete include 404, UI states marked
  "to be added at C-3", harness = node:test + fetch per repo convention.
- Review verdict: plan is READY FOR OWNER ACCEPTANCE. It is NOT implementation-
  approved until the owner explicitly accepts, and C-1 additionally requires
  Gate B PASS + confirmed table scope + OpenAPI/codegen boundary review.
