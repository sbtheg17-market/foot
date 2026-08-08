# Next product task — Phase 1 cleanup and Phase 2 progress presentation

## Current gate

Phase 1 micro-checkpoints 1–4 are complete.

- MC1 (rejected-provider resubmission — server state transitions) merged at
  `54534b0`.
- MC2 (rejection-reason and status API — server only) merged at `1f4c018`.
- MC3 (web rejected-state UI) merged at `dc7a40d`.
- MC4 (mobile rejected-state UI) lands one focused commit on top that
  changes only `artifacts/mobile/app/provider/application-status.tsx`
  plus the two `.agents/` docs — no server, database, web, migration,
  or generated-client changes.

The provider now sees, on Expo mobile, the same server-authoritative
rejected-state experience already live on web:

- current `status` with a labelled pill
- `submittedAt` / `reviewedAt` for the current cycle
- a dedicated reviewer-feedback card containing the provider-visible
  `rejectionReason` (only when status is `rejected`)
- a prior-submissions history card with `submissionCount` and the public
  fields of `latestSubmission`
- server-gated CTAs — Reset (when `canReset`), Submit for review
  (when `canResubmit`), Continue editing (when `canEdit`)
- loading, unauthorized, no-application (404), non-member (403),
  generic error, and mutation-error states

Reviewer-private `reviewerNotes` is never referenced by the mobile code
and never enters the status response payload.

## Next scope (queued, not started)

Two independent cleanup / follow-up slices can be scheduled after user
approval:

1. **Baseline test-drift cleanup** — resolve the pre-existing failures
   in `test:provider-application` (2/8) and `test:onboarding` (1/2)
   without expanding scope beyond the affected test files.
2. **Phase 2 — post-submission progress presentation** — extend the
   status API and UIs with a submission-history timeline surface once
   product scope is confirmed.

## Guardrails

- Do not fix the pre-existing `test:provider-application` (2 failing) or
  `test:onboarding` (1 failing) baseline drift in this slice — separate
  cleanup.
- Do not add Stripe, payouts, admin verification, disputes, background
  checks, or any unrelated admin / care-history / review work.
- Never render `reviewerNotes` in the UI. Only `rejectionReason` and the
  public snapshot fields of `previousSubmissions` are safe to render.
- Signup `roleIntent` remains an onboarding request, not an authorization
  claim. Approved-provider authorization boundary must stay intact.
- Do not duplicate server authorization rules in any client — render
  actions strictly from `canEdit` / `canReset` / `canResubmit`.

## Separately queued cleanup slices (not for MC4)

- `attached_assets/phase1-mc1_1786063790850.patch` remains committed on
  `origin/conflict_070826_mc2` — safe to leave; delete the branch
  entirely as a hygiene action after MC4 lands.
- Web test infrastructure (vitest + testing-library) — separate slice.
- `test:provider-application` (2/8) and `test:onboarding` (1/2) drift —
  separate slice.
