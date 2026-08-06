# Next product task — progressive provider onboarding

## Current gate

The shared signup and role-aware provider onboarding checkpoint is complete and
verified. Provider application ownership, concurrent idempotent start/resume,
draft validation, submission transitions, approval prerequisites, role-intent
authorization boundaries, existing-client enrollment, credential submission,
and privacy boundaries are covered by API integration tests.

## Audit status

Phase 0, the additive schema migration, compatibility backfill/server-state
exposure, Phase 3 authorization hardening, and Phase 4 shared signup/provider
onboarding are complete. The full API regression matrix, workspace build,
workflow startup, and 390px signup previews have passed.

## Next scope

- Extend provider onboarding beyond the initial profile step with services,
  availability, and verification-document completion.
- Keep onboarding endpoints owner-scoped and preserve the existing
  `requireApprovedProvider` authorization gate.
- Add each new onboarding endpoint to OpenAPI first, regenerate clients, and
  add focused integration coverage before exposing it in web or mobile.

## Guardrails

- Signup `roleIntent` remains an onboarding request, never an authorization
  claim.
- Provider operations require database-backed provider membership, an
  owner-linked application with `approved` status, and an approved provider
  profile.
- Do not add Stripe, payouts, active-role switching, or unrelated admin,
  care-history, or review expansion in this scope.
