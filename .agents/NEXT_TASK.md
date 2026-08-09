# Next product task — MC9 in progress (Commit 1 done, awaiting review)

## Current gate

MC8-lite is **complete** — all four commits landed on canonical `main`
(`0ab9964`, `971cf70`, `7d8e8ff`, `05292ab`). MC9 (reviewer approve/reject
workflow + decision notifications) was **explicitly scope-approved** as three
separately-reviewed commits:

- **Commit 1 (done, awaiting review):** admin-only reviewer decision
  endpoints `POST /admin/provider-applications/:id/approve|reject` —
  `under_review`-only transitions, transactional persistence of
  `reviewedAt`/`reviewedBy`/reviewer-private `reviewerNotes` (+
  provider-visible `rejectionReason` on reject), `approved`/`rejected`
  lifecycle-event enum extension + transactional emission, no self-review,
  invalid/repeated decisions fail with 409 and no side effects, OpenAPI +
  regenerated clients.
- **Commit 2 (next, gated on Commit 1 landing):** provider-facing in-app
  notifications for `approved`/`rejected`, created in the SAME transaction
  as the lifecycle event, one per event via the existing
  `UNIQUE(user_id, event_id)` constraint, provider-safe title/body/link,
  never any reviewer-private data in notification responses.
- **Commit 3 (gated):** durable `node:test` coverage — reviewer authn/authz,
  provider self-approval rejection, valid approve/reject transitions,
  invalid-state and repeated-decision behavior, event/notification
  atomicity, notification privacy; existing suites + full typecheck + build.

## Constraints (locked)

- Step-0 gate before any work; one reviewed commit at a time; no push
  before approval.
- Web/mobile notification UI remains **out of scope**.
- Email, outbox, retry, and external delivery remain **out of scope**.
- No unrelated reviewer workflow or admin UI.
- Published history is never rewritten (Commit 4 `files` subject is a
  recorded cosmetic discrepancy — see Session 049 traceability note).

## Post-MC9 deferred

- Web and mobile in-app notification feed with unread badge.
- Email alerts through a separately designed outbox/retry channel.
- Push channel (`expo-notifications` present but unused for this line).
- Composite index `(provider_application_id, created_at DESC, id DESC)` on
  `provider_application_submissions` — documented follow-up (D1 deferred).
- Web/mobile test infrastructure (vitest / RN testing-library).
- Root `attached_assets/Pasted-*.txt` cleanup; delete stale
  `origin/conflict_070826_mc2` branch (hygiene actions).

## Guardrails

- Never render `reviewerNotes` in any client. Only `rejectionReason` and
  the public snapshot fields of `previousSubmissions` are safe to render.
- Reviewer decisions do not touch provider-profile `verificationStatus`;
  the approved-provider authorization boundary (application **and**
  verification both approved) stays intact.
- Signup `roleIntent` remains an onboarding request, not an authorization
  claim.
- Do not duplicate server authorization rules in any client — render
  actions strictly from `canEdit` / `canReset` / `canResubmit`.
- Do not add Stripe, payouts, disputes, background checks, or any
  unrelated admin / care-history / review work.
