# Next product task — Phase 2: post-submission progress presentation

## Current gate

Phase 1 micro-checkpoints 1–4 are complete, and the baseline test-drift
cleanup slice is done.

- MC1 (rejected-provider resubmission — server state transitions) merged at
  `54534b0`.
- MC2 (rejection-reason and status API — server only) merged at `1f4c018`.
- MC3 (web rejected-state UI) merged at `dc7a40d`.
- MC4 (mobile rejected-state UI) merged at `f2ed537`.
- Baseline test-drift cleanup lands one focused commit on top that changes
  only `artifacts/api-server/src/__tests__/provider-application.integration.test.ts`,
  `artifacts/api-server/src/routes/providers.ts`, and the two `.agents/`
  docs — no web, mobile, database-schema, migration, or generated-client
  changes.

The API integration baseline is fully green again:

- `test:provider-application` 8/8 — stale submit-validation assertion (F1)
  and incomplete happy-path submission setup (F2) fixed.
- `test:onboarding` 23/23 — restored by the F3 product fix.
- F3 was a product regression, not test drift: public
  `GET /providers/:providerId/services` leaked draft services of
  unapproved providers. It now applies the same
  `verificationStatus === "approved"` gate as the provider-listing
  endpoint and returns a stable-shaped empty list for unapproved
  providers.
- Regression sweep also green: `test:provider-status` 9/9,
  `test:provider-resubmission` 11/11, `test:authorization` 7/7.

## Next scope (queued, not started)

**Phase 2 — post-submission progress presentation.** Extend the status
API and UIs with a submission-history / progress-timeline surface once
product scope is confirmed with the user. Candidate slices:

1. Server: expose the full ordered `previousSubmissions` history (public
   snapshot fields only) on the status endpoint, or a dedicated
   sub-resource, with owner-only access.
2. Web: render the progress timeline on `/provider/application-status`.
3. Mobile: mirror the timeline on `provider/application-status`.

## Guardrails

- Never render `reviewerNotes` in any client. Only `rejectionReason` and
  the public snapshot fields of `previousSubmissions` are safe to render.
- Signup `roleIntent` remains an onboarding request, not an authorization
  claim. Approved-provider authorization boundary must stay intact.
- Do not duplicate server authorization rules in any client — render
  actions strictly from `canEdit` / `canReset` / `canResubmit`.
- Do not add Stripe, payouts, admin verification, disputes, background
  checks, or any unrelated admin / care-history / review work.

## Separately queued cleanup slices

- Seed-script drift: `seed.ts` creates provider profiles but no
  `provider_applications` rows, so `test:authorization` cannot pass on a
  freshly seeded database without manual inserts. Extend the seed to
  create approved application rows for the demo providers — separate
  hygiene slice.
- `attached_assets/phase1-mc1_1786063790850.patch` remains committed on
  `origin/conflict_070826_mc2` — safe to leave; delete the branch
  entirely as a hygiene action.
- Web test infrastructure (vitest + testing-library) — separate slice.
