# Next product task — Phase 1 micro-checkpoint 4: mobile rejected-state UI

## Current gate

Phase 1 micro-checkpoints 1–3 are complete. `origin/main` at time of MC3
handoff was `1f4c018` (MC2 published). MC3 lands one focused commit on top
that changes only `artifacts/web/src/pages/provider-application-status.tsx`
plus the two `.agents/` docs — no server, database, mobile, migration, or
generated-client changes.

The provider now sees, on the web:

- current `status` with a labeled pill
- `submittedAt` / `reviewedAt` for the current cycle
- a dedicated reviewer-feedback card containing the provider-visible
  `rejectionReason` (only when status is `rejected`)
- a prior-submissions history card with `submissionCount` and the public
  fields of `latestSubmission`
- server-gated CTAs — Reset (when `canReset`), Submit for review
  (when `canResubmit`), Continue editing (when `canEdit`)
- loading, unauthorized (401), no-application (404), non-member (403),
  generic error, and mutation-error states

Reviewer-private `reviewerNotes` is never referenced by the web code and
never enters the status response payload.

## Next scope — Phase 1 micro-checkpoint 4 (mobile only)

Bring the same server-authoritative rejected-state experience to Expo
mobile (`artifacts/mobile/`).

- Read from `GET /providers/application/status` via the shared
  `@workspace/api-client-react` hook (`useGetProviderApplicationStatus`).
- Reuse the exact same server-derived visibility rules: Reset action only
  when `canReset`, Resubmit only when `canResubmit`, Continue editing only
  when `canEdit`.
- Render the provider-visible `rejectionReason` prominently when the
  status is `rejected`; never render `reviewerNotes` (it isn't in the
  payload).
- Render the `submissionCount` and public `latestSubmission` summary the
  same way the web page does — a low-emphasis card, not a list of every
  historical submission.
- Preserve the mobile navigation contract (approved → provider tabs,
  draft → mobile onboarding flow).
- Keep loading / unauthorized / 404 / 403 / error / mutation-error
  states aligned with the mobile design system already in use elsewhere
  in the app.
- Do not add web work in this slice.
- Do not add server changes.

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
- Do not duplicate server authorization rules in the mobile client —
  render actions strictly from `canEdit` / `canReset` / `canResubmit`.

## Separately queued cleanup slices (not for MC4)

- `attached_assets/phase1-mc1_1786063790850.patch` remains committed on
  `origin/conflict_070826_mc2` — safe to leave; delete the branch
  entirely as a hygiene action after MC4 lands.
- Web test infrastructure (vitest + testing-library) — separate slice.
- `test:provider-application` (2/8) and `test:onboarding` (1/2) drift —
  separate slice.
