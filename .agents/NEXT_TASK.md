# Next product task — Phase 1 micro-checkpoint 2: rejection-reason / status API

## Current gate

Phase 1 micro-checkpoint 1 is complete and locally verified. The server now
supports the explicit `rejected → draft → under_review` provider-application
resubmission flow with immutable submission history, owner-scoped access,
idempotent resets, and the existing approved-provider authorization gate
unchanged.

## Audit status

Phase 0, additive schema migration, compatibility backfill/server-state
exposure, Phase 3 authorization hardening, and Phase 4 shared signup/provider
onboarding remain complete. The new Phase 1 slice adds:

- `POST /providers/application/reset` (server transition only)
- `rejectionReason` column on `provider_applications`
- `provider_application_submissions` append-only history table
- Rejected applications are blocked from direct `PATCH` and direct submit
- Focused resubmission tests (11/11) and full regression suite pass

## Next scope — Phase 1 micro-checkpoint 2

Expose the rejection reason and structured application status through a stable
owner-scoped API so the web and mobile rejected-state screens (subsequent
slices) have a single server-authoritative source. Scope is server-only.

- Confirm the shape returned by `GET /providers/application` is sufficient for
  the rejected-state screen: `status`, `rejectionReason`, `previousSubmissions`.
  If additional public fields are needed (e.g. last reviewedAt formatted, or a
  human-readable `nextAction`), add them behind an owner-scoped endpoint.
- Do not begin web or mobile UI work in this slice.
- Do not add admin rejection endpoints (Phase 3).
- Do not touch approved-provider authorization.

## Guardrails

- Signup `roleIntent` remains an onboarding request, never an authorization
  claim.
- Provider operations require database-backed provider membership, an
  owner-linked application with `approved` status, and an approved provider
  profile.
- Do not add Stripe, payouts, active-role switching, disputes, background
  checks, or unrelated admin / care-history / review expansion in this scope.
- `reviewerNotes` must never appear in owner-facing responses; only the
  provider-visible `rejectionReason` is exposed.
