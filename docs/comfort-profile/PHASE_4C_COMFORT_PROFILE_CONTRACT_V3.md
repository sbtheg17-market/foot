# PHASE 4C — COMFORT PROFILE CONTRACT (V3)

Status: RESTORED/AUTHORED IN THIS CHECKOUT — DESIGN ONLY
Baseline: repo `/app`, branch `main`, commit `efbf7ec565e4403d6bc61b077c7d9a75ace5ab32`
Provenance: The monorepo `sbtheg17-market/foot` (HEAD `184833bd…`) is NOT accessible from this
environment. This document was authored fresh here from the accepted Comfort-Wiring Plan v1.1
decision record, under the operator's explicit directive (see `.agents/LOG.md` ENTRY-002/003).
It is the binding source of truth for this checkout until superseded.

This contract does NOT authorize: implementation of API routes, codegen, schema/migrations,
table/collection creation, persistence wiring, events, analytics, economics, credentials, or
publication. Those remain gated behind C-1 preconditions (see §9).

---

## 1. Scope

The Comfort Profile feature lets a patient record comfort preferences (temperature, lighting,
noise, notes) and share a read-only projection of them with providers, strictly gated by an
explicit, revocable consent.

Core invariants (accepted in Plan v1.1 — MUST NOT be weakened):

1. The contract contains exactly SIX routes/operations. OperationIds are normative (§2).
2. Server rules remain in the contract/module boundary — never in client shells.
3. Client shells are props-driven presentation only. No fetching, no persistence, no routing side effects.
4. `PUT` on preferences returns **409** when consent is not active.
5. `isConsentActive` is determined from the **latest consent row** (most recent by creation time), never from aggregates.
6. The preferences editor remains **locked** until consent is active.
7. **Withdraw hides; it never deletes.** Withdraw and delete are separate operations and separate UI actions.
8. The shell copy MUST state the hide-without-delete behavior **verbatim** (§5.3).
9. The provider projection is **404-only**. There is NO 403 path anywhere in this contract, including generated artifacts.
10. The four projection conditions are encoded in `buildProviderProjection` plus the status allow-list (§4).
11. The provider card renders **nothing** when the projection is null.
12. Generated code must remain confined to `lib/api-zod` and `lib/api-client-react` — nothing else.

---

## 2. Operations (exactly six)

| # | operationId | Method & Path | Success | Errors |
|---|-------------|---------------|---------|--------|
| 1 | `grantConsent` | `POST /api/comfort-profile/consent` | **201** Created | 400 validation, 401 |
| 2 | `withdrawConsent` | `POST /api/comfort-profile/consent/withdraw` | 200 OK | **404** no consent record, 401 |
| 3 | `deleteComfortProfile` | `DELETE /api/comfort-profile` | 204 No Content | **404** no profile, 401 |
| 4 | `getComfortProfile` | `GET /api/comfort-profile` | 200 OK | 401 |
| 5 | `updateComfortPreferences` | `PUT /api/comfort-profile/preferences` | 200 OK | 400 validation, **409** consent not active, 401 |
| 6 | `getProviderProjection` | `GET /api/provider/comfort-projection/{patientId}` | 200 OK | **404 only** (never 403), 401 |

Binding corrections folded into v1.1 (normative):
- `grantConsent` success is **HTTP 201, not 200**; validation handling includes **HTTP 400**.
- `withdrawConsent` and `deleteComfortProfile` each include **HTTP 404** handling.
- No seventh operation may be added. No operation may be merged (withdraw ≠ delete).

### 2.1 Request/response schemas (normative shapes)

`grantConsent` request:
```json
{ "scope": ["temperature", "lighting", "noise", "notes"] }
```
`grantConsent` 201 response:
```json
{ "consentId": "uuid", "status": "ACTIVE", "scope": ["..."], "createdAt": "ISO-8601" }
```

`withdrawConsent` request: empty body. 200 response:
```json
{ "consentId": "uuid", "status": "WITHDRAWN", "createdAt": "ISO-8601" }
```
Withdraw appends a new consent row with status `WITHDRAWN`. It MUST NOT delete or mutate
profile data. Effect is visibility-only (hide).

`getComfortProfile` 200 response:
```json
{
  "isConsentActive": true,
  "hasProfile": true,
  "preferences": {
    "temperature": "cool | moderate | warm | null",
    "lighting": "dim | soft | bright | null",
    "noise": "quiet | low | moderate | null",
    "notes": "string | null"
  }
}
```

`updateComfortPreferences` request: the `preferences` object above (all fields optional,
validated against the enums). 409 body:
```json
{ "error": "CONSENT_NOT_ACTIVE" }
```

`getProviderProjection` 200 response:
```json
{ "patientId": "uuid", "projection": { "temperature": "...", "lighting": "...", "noise": "...", "notes": "..." } }
```
When any projection condition fails the endpoint returns **404** with no body detail that could
leak existence. It never returns 403.

---

## 3. Consent semantics

- Consent rows are append-only. Statuses: `ACTIVE`, `WITHDRAWN`.
- `isConsentActive` = (latest consent row exists) AND (latest row status ∈ allow-list).
- Status allow-list: `["ACTIVE"]`. Exactly one entry. Extending the allow-list requires a fresh
  contract review (CHANGE REQUESTED protocol).
- Grant while already active: idempotent-append is permitted (new ACTIVE row) — latest-row rule
  still governs.
- Withdraw while not active: **404** (no consent record) or appends nothing — the 404 path is
  normative when no consent row exists at all.

---

## 4. `buildProviderProjection` — the four conditions

The server-side rule surface lives at the contract/module boundary. `buildProviderProjection`
returns either a projection object or **null**. Null maps to HTTP 404. The FOUR conditions, all
required, evaluated in order:

1. **Consent exists** — the patient has at least one consent row.
2. **Latest row allowed** — the latest consent row's status is in the allow-list (`ACTIVE`).
3. **Profile exists** — a comfort profile document exists for the patient.
4. **Non-empty scoped payload** — after filtering profile fields to the granted scope, at least
   one field remains non-null.

If ANY condition fails → projection is `null` → HTTP **404**. There is no 403 branch. The
provider card renders **nothing** (no skeleton, no error chrome) when the projection is null.

---

## 5. Client presentation (shells)

### 5.1 Components
- `ComfortPreferencesShell` — patient-facing. Present in this checkout at
  `frontend/src/components/comfort-profile/ComfortPreferencesShell.jsx`.
- `ProviderComfortCard` — provider-facing read-only card. NOT yet present; renders nothing for a
  null projection when implemented. Implementation deferred (C-3 scope).

### 5.2 Shell state matrix

| State | Phase | Status in this checkout |
|---|---|---|
| consent-lock (editor locked) | 4C | PRESENT |
| empty (consent active, no profile) | 4C | PRESENT |
| active editor | 4C | PRESENT |
| loading | C-3 | NOT IMPLEMENTED — must be added at C-3 |
| error | C-3 | NOT IMPLEMENTED — must be added at C-3 |
| unauthorized | C-3 | NOT IMPLEMENTED — must be added at C-3 |

The C-3 note is a plan-wording correction, not permission to implement those states now.

### 5.3 Verbatim copy (normative — byte-exact in the shell)

> Withdrawing consent hides your comfort profile from providers. Your data is not deleted.

The shell MUST render this sentence pair exactly, adjacent to the withdraw action.

### 5.4 Shell purity rules
- Props in, callbacks out. No fetch/axios, no storage access, no global state writes.
- Ephemeral local input state for the editor draft is permitted (presentation concern).
- Withdraw and Delete are visually and functionally separate actions with distinct copy.

---

## 6. Persistence design (REFERENCE ONLY — not approved for execution)

Exactly TWO additive stores; no changes to existing stores:
1. `comfort_consents` — append-only consent rows: `id`, `patientId`, `status`, `scope`, `createdAt`.
2. `comfort_profiles` — one document per patient: `id`, `patientId`, `temperature`, `lighting`, `noise`, `notes`, `updatedAt`.

The exact DDL/collection setup is NOT presumed approved by this contract. It must be reviewed at
C-1 before execution. No third store, no indexes/triggers/policies/constraints outside the
reviewed scope. (This checkout is FastAPI + MongoDB: "tables" map to collections; the two-store
limit and additive-only rule apply identically.)

---

## 7. Codegen boundary

Generated code is confined to exactly:
- `lib/api-zod`
- `lib/api-client-react`

Neither directory exists in this checkout yet; creation happens only at an authorized C-1
candidate. If codegen would touch any other directory: STOP before generation and raise
CHANGE REQUESTED/BLOCKED. Generated files are not edited manually.

---

## 8. Test harness convention

- Backend tests use **`node:test`** with **fetch-against-BASE** (HTTP against a running server via
  a `BASE` URL), per repository convention. Do not replace with supertest without a separately
  approved alteration.
- Required coverage at C-1: all six operations and the full status matrix
  (201/200/400/401/404/409), plus the four projection conditions and the 404-only rule.
- Evidence capture: each check records name, command, timestamp, duration, exit code, redacted
  output/evidence path, final status.

---

## 9. Gate state (unchanged by this document)

| Precondition | Status |
|---|---|
| Plan v1.1 acceptance | Recorded per operator directive (see `.agents/LOG.md`) |
| Managed Gate B PASS | BLOCKED — managed `DATABASE_URL` unavailable in this environment; local substitutes do not qualify |
| Exact two-store additive scope | PENDING — review after Gate B |
| OpenAPI/codegen boundary review | PENDING — review after Gate B |

C-1 remains **NOT EXECUTABLE**. This contract restores the design source of truth only.

---

## 10. Alteration protocol

Any mismatch between this contract and future implementation must halt work and produce an
alteration proposal (original wording, actual behavior, precise mismatch, proposed replacement,
reason, affected files, schema/API/test/rollback impact, compatibility, evidence, gate rerun
needs, explicit approval requirement). Examples: grant returning 200 → CHANGE REQUESTED, never
normalized silently; a third store appearing necessary → BLOCKED pending scope review.

---

## 11. V3.1 ADDENDUM — operator-approved alterations (2026-08-11 Neo handoff)

Authorization: the operator's Comfort Wiring handoff (recorded in `.agents/LOG.md`
ENTRY-014) explicitly orders the consent scope picker and consent history features.
Per §10 this addendum is the explicit contract update carrying those alterations.
Nothing in §§1–10 is weakened except where amended below.

### 11.1 Seventh operation — `getConsentHistory` (amends §1.1/§2 "exactly six")

| # | operationId | Method & Path | Success | Errors |
|---|-------------|---------------|---------|--------|
| 7 | `getConsentHistory` | `GET /api/comfort-profile/consent/history` | 200 OK | 401 |

- OWNER-SCOPED and read-only: a patient sees only their own consent rows, newest first.
- There is still NO 403 path anywhere in the contract.
- 200 response shape:
```json
{
  "history": [
    {
      "id": "uuid", "status": "ACTIVE | WITHDRAWN", "scope": ["..."],
      "consentVersion": "string | null", "consentTextHash": "sha256-hex | null",
      "purpose": "comfort-profile-sharing | null", "createdAt": "ISO-8601"
    }
  ],
  "consentText": "current consent statement (verbatim)",
  "consentTextVersion": "1",
  "consentTextHash": "sha256-hex of consentText"
}
```
- Rows recorded before versioning surface `null` version fields (legacy-tolerant; history is
  never rewritten).

### 11.2 Versioned consent evidence (additive fields on `comfort_consents` rows)

Grant and withdraw rows additionally record: `consentVersion`, `consentTextHash`
(sha256 of the consent statement presented), and `purpose`. The consent statement and its
version live in `backend/comfort_profile.py` (`CONSENT_TEXT`, `CONSENT_TEXT_VERSION`) — the
single source of truth. Any wording change REQUIRES a version bump. The store count is
unchanged (still exactly two collections; fields are additive on existing rows). The §2.1
response shapes of operations 1–6 are NOT modified.

### 11.3 Consent scope picker (shell presentation; §5 amended)

- The consent-lock state gains a per-category picker: patients choose exactly which of the
  four categories to share when granting. `onGrantConsent(scope)` carries the selection out
  of the shell; the grant request shape (§2.1) is unchanged.
- CONSERVATIVE DEFAULTS (normative): `temperature`, `lighting`, `noise` default ON;
  `notes` (the single free-text field) defaults OFF and is labeled as off-by-default.
- Grant is disabled while zero categories are selected (the API's non-empty-scope rule).
- New presentation-only props: `consentStatement` (server-provided text, rendered verbatim
  near the grant action) and `sharedScope` (read-only chips of currently shared categories).
  Shell purity rules (§5.4) are unchanged: props in, callbacks out, ephemeral local state only.
- `ConsentHistoryTimeline` is a separate pure component rendering the §11.1 history.

### 11.4 Language rule (restated, binding for all §11 surfaces)

All consent/history copy may say "matches your preferences" only — never medical,
diagnostic, or suitability claims.
