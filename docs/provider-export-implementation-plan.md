# Provider Data Export — Technical Implementation Plan

**Added:** 2026-08-29. Companion to
`docs/provider-export-and-recovery-backup-architecture.md` (§3, §6 Phase B)
and `docs/provider-data-export-spec.md`. Implementation-ready plan — **no
runtime code is implemented by this document's task**. All design types below
are proposals; do not treat proposed fields as existing schema.

Deferral: Phase B implementation starts only after canonical production
journey validation (`docs/NEXT-STEPS.md` sequencing).

---

## 1. Code, schemas, and routes to inspect before implementing

| Area | Location | Why |
|---|---|---|
| Auth middlewares | `artifacts/api-server/src/middlewares/auth.ts` (`requireAuth`, `requireRole`, approved-provider gating) | Export routes must reuse the exact same gates. |
| Role state | `artifacts/api-server/src/lib/role-state.ts` (`RoleState`) | DB-backed role confirmation pattern. |
| Provider routes pattern | `artifacts/api-server/src/routes/providers.ts` (`/providers/me/*` always scope to `req.user.id`) | Export endpoints follow this ownership pattern. |
| Router mounting | `artifacts/api-server/src/routes/index.ts` | Where a new export router mounts under `/api`. |
| Owned-data schema | `lib/db/src/schema/`: `provider_profiles`, `services`, `availability`, `provider_emergency_openings`, `provider_blocked_ranges`, `travel_zones`, `provider_service_areas`, `provider_coverage_areas`, `bookings`, `booking_outcome_history`, `booking_reschedule_*`, `users` | Source tables for allowlisted DTOs. |
| Append-only event precedent | `provider_application_events`, `marketplace_events` schemas | Pattern for the export audit-event table. |
| API contract generation | OpenAPI spec + Orval-generated clients (`lib/api-zod`) | New endpoints must be added to the contract and regenerated, mirroring existing drift tests. |
| Web portal | `artifacts/web/src/pages/portal/` (no settings page exists yet) | A `Settings → Data and privacy` page is new UI. |
| Authorization tests | `artifacts/api-server/src/__tests__/authorization-hardening.integration.test.ts` | Template for export authorization tests. |

Known gaps (confirmed by inspection, 2026-08-29): there is currently **no**
rate-limiting middleware, **no** background-job runner, **no** object-storage
integration, and **no** provider settings page in the codebase. All four are
new work scoped below.

## 2. Proposed API endpoints (all under `/api`, all `requireAuth` + provider role + approved-provider gate)

```text
POST   /api/providers/me/exports              create export request
GET    /api/providers/me/exports              list own export history (metadata only)
GET    /api/providers/me/exports/:exportId    poll one export's status (own only)
DELETE /api/providers/me/exports/:exportId    cancel/delete an unexpired export (own only)
GET    /api/providers/me/exports/:exportId/download   authenticated, short-lived download
```

## 3. Proposed request/response contracts (design types — not existing schema)

```text
CreateExportRequest  { scope: "provider_business_data" }   // only scope in MVP
ExportResource {
  exportId: string            // opaque, non-sequential (UUID/nanoid)
  scope: "provider_business_data"
  status: "requested" | "processing" | "ready" | "downloaded"
        | "expired" | "cancelled" | "failed"
  requestedAt / completedAt / expiresAt: ISO-8601 strings
  fileCount?: number
  sizeBytes?: number
}
```

Responses are DTOs only — never raw rows, never SQL, never storage paths.
Download responses stream the ZIP with `Content-Disposition: attachment` and
`Cache-Control: no-store`.

## 4. Export request state model

```text
requested → processing → ready → downloaded → expired
     \            \→ failed          \→ expired
      \→ cancelled (allowed from requested/processing/ready)
```

One active (requested/processing/ready) export per provider per scope;
creating a new one while active returns the active resource (idempotent).

## 5. Authorization boundaries

- Identity derived exclusively from the authenticated server session
  (`req.user.id`) — provider IDs from the browser are never authority.
- Every endpoint: `requireAuth` → provider role (DB-backed) →
  approved-provider operational gate → ownership check on `exportId`.
- The export job re-derives the provider scope itself; it never trusts request
  payloads for scoping.
- Admin has metadata visibility only; admin content access is an explicitly
  audited exception path, not a default.

## 6. Export DTO/allowlist strategy

- One explicit DTO per export file, hand-allowlisted per field (no `SELECT *`,
  no spreading raw rows).
- Excluded categories: password hashes, tokens, credentials, internal flags,
  verification/review internals, other users' records, schema internals.
- `clients.csv` contains only fields the provider already sees in their own
  bookings.
- CSV writer applies formula-injection defense (prefix `'` for values starting
  `=`, `+`, `-`, `@`) and RFC-4180 quoting; DTO snapshot tests freeze the
  allowlists so field additions are deliberate.

## 7. Background-job approach

- MVP: in-process async job queue (single worker, per-provider mutex) — no new
  infrastructure; job state persisted in the export table so restarts recover
  to `failed`.
- Growth path: extract to a proper queue/runner in Phase C without changing
  the API contract.

## 8. Artifact storage interface

```text
interface ExportArtifactStore {
  put(exportId, stream): Promise<{ sizeBytes, checksum }>
  createReadStream(exportId): ReadableStream
  delete(exportId): Promise<void>
}
```

- MVP implementation: private server-side directory outside the repo/web
  root, encrypted at rest by the platform volume, strict permissions.
- Preferred upgrade: private encrypted object storage. The interface isolates
  that choice. Storage paths never appear in API responses, logs, or docs.

## 9. Signed download route behavior

- Download requires a live authenticated session of the owning provider —
  links are useless if forwarded.
- `expiresAt` enforced server-side; expired → 410 + `expired` audit event.
- Optional MVP+: single-use download tokens (one-time link) minted at
  render-time with short TTL.

## 10. Rate-limit / idempotency strategy

- Max 1 active export per provider (idempotent create), plus a cooldown
  (e.g. N per 24h) enforced server-side.
- A small generic per-route limiter is new shared middleware (none exists
  today) — introduced with this feature and reusable elsewhere.

## 11. Audit event taxonomy

Append-only table (pattern: `provider_application_events`):

```text
export_requested | export_started | export_completed | export_downloaded
| export_expired | export_failed | export_cancelled | export_deleted
| export_admin_metadata_viewed | export_admin_content_access (exception path)
```

Each event: exportId, actor role label, timestamp, non-secret detail JSON.
Never store file contents, paths, or client data in events.

## 12. Retention/deletion job

- Default retention: short (e.g. 72h after ready) — final value is an open
  product decision below.
- Scheduled sweep deletes expired artifacts (storage + `deleted` event);
  metadata rows are retained for history display.

## 13. Test plan

- Unit: DTO allowlists (snapshot), CSV injection defense, state machine
  transitions, manifest generation.
- Integration (disposable Postgres, existing harness): full lifecycle;
  cross-provider access attempts rejected (extend
  `authorization-hardening.integration.test.ts` patterns); client-role and
  unapproved-provider rejection; expiry → 410; duplicate-create idempotency;
  rate limits; audit events emitted per transition.
- Web: settings page states (entry/preparing/ready/expired/error),
  accessibility roles/announcements, no infra vocabulary in rendered copy.
- Contract: OpenAPI drift tests extended to the new endpoints.

## 14. Observability and support

- Structured logs with exportId only (no provider PII, no paths); failure
  alerts on repeated `export_failed`; support runbook maps provider-reported
  "data export" issues to exportId lookup via metadata (never content).

## 15. Rollout plan and feature flags

1. Ship dark (routes flag-gated off; `EXPORTS_ENABLED=false` default).
2. Enable on canonical prototype; run pilot: provider journey + export +
   verification of contents against allowlists.
3. Enable per instance via configuration only after the instance passes the
   provider-client smoke protocol.
4. Kill switch: single env flag disables creation while keeping history
   visible.

## 16. Migration needs

One additive frozen artifact (new tables: export requests + export audit
events), delivered through the standard release gate
(`docs/managed-db-release-gate.md`) — never startup-time schema push. Exact
DDL is written at implementation time.

## 17. Open questions requiring product/legal/security decision

1. Exact `clients.csv` field list the provider is entitled to receive
   (legal/privacy review; per-region variance?).
2. Retention default for ready artifacts (proposal: 72h) and history metadata
   (proposal: 12 months).
3. Should `provider_blocked_ranges.reason` (private note) be included?
   (proposal: yes, owner-only data — confirm.)
4. Admin content-access exception: allowed at all in MVP, or metadata-only
   with support-guided provider self-service?
5. Include invoices/earnings and reviews in MVP scope or defer?
6. One-time download links vs. session-bound short-lived links for MVP.
7. Client-initiated "export my data" (client role) — separate future feature;
   confirm out of scope for Phase B.

## 18. Compatibility plan for isolated future provider instances

- The feature ships as canonical core: same code, contract, tests, and flags
  in every instance release (`docs/canonical-prototype-and-instance-model.md`
  §C/§G).
- Per-instance configuration is limited to: enable flag, retention values,
  storage backend selection, and branding of the settings page copy.
- Export artifacts and audit data stay inside each instance's own database
  and private storage — never in the canonical repo, Graphify, the registry
  sheet (labels/dates only), or another instance.
