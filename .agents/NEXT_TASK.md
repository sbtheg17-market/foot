# Next product task — Phase 1 micro-checkpoint 3: web rejected-state UI

## Current gate

Phase 1 micro-checkpoint 1 (server transitions) and micro-checkpoint 2
(rejection-reason / status API) are complete and pushed to `origin/main`.
The server now offers:

- `GET /providers/application` — full owner-scoped detail with history
- `GET /providers/application/status` — compact owner-scoped status view
  with server-derived `nextAction` and capability flags
- `POST /providers/application/reset` — explicit `rejected → draft`
- `POST /providers/application/submit` — `draft → under_review`
- Immutable `provider_application_submissions` history
- Provider-visible `rejectionReason`, admin-private `reviewerNotes`

## Next scope — Phase 1 micro-checkpoint 3 (web only)

Add the web rejected-state UI on top of the existing `/provider/application-status`
route (or wherever the current post-submission status screen lives).

- Read from `GET /providers/application/status`.
- When `status === "rejected"`, show the provider-visible `rejectionReason`
  and a primary CTA that calls `POST /providers/application/reset`.
- Show `latestSubmission` and `submissionCount` in a low-emphasis
  summary line so providers understand how many prior cycles occurred.
- Respect `canEdit` / `canReset` / `canResubmit` — never render actions
  the server says are unavailable.
- Use existing web design tokens, routing, and query patterns.
- Keep loading, retry, empty, and error states aligned with the rest of
  the portal.
- Do not add mobile work in this slice (that becomes Phase 1 MC4).
- Do not add server changes.

## Guardrails

- Do not fix the pre-existing `test:provider-application` (2) or
  `test:onboarding` (1) baseline drift in this slice — separate cleanup.
- Do not add Stripe, payouts, admin verification, disputes, background
  checks, or unrelated admin/care-history/review work.
- Never expose `reviewerNotes` in the UI; only `rejectionReason` and public
  history fields are safe to render.
- Signup `roleIntent` remains an onboarding request, not an authorization
  claim. Approved-provider authorization boundary must stay intact.
