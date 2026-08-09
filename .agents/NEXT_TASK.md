# Next product task — MC9 in progress (Commit 2 done, awaiting review)

## Current gate

MC8-lite is **complete**. MC9 (reviewer approve/reject workflow + decision
notifications) was **explicitly scope-approved** as three
separately-reviewed commits:

- **Commit 1 (landed):** admin-only reviewer decision endpoints — published
  by the managed environment as split commits `0afb3ff` + `92d001f`
  (combined tree byte-identical to the reviewed implementation; `59068c8`
  is an environment-only `.replit` marker on top). See Session 050
  traceability note.
- **Commit 2 (done, awaiting review):** provider-facing in-app
  notifications for `approved`/`rejected`, created in the SAME transaction
  as the lifecycle event, one per event via the existing
  `UNIQUE(user_id, event_id)` constraint, static provider-safe
  title/body/link (`/provider/application-status`), never any
  reviewer-private data in notification responses. Shared helper extracted
  to `artifacts/api-server/src/lib/application-notifications.ts`.
- **Commit 3 (next, gated on Commit 2 landing):** durable `node:test`
  coverage — reviewer authn/authz, provider self-approval rejection, valid
  approve/reject transitions, invalid-state and repeated-decision behavior,
  event/notification atomicity, notification privacy; existing suites +
  full typecheck + build.

## Constraints (locked)

- Step-0 gate before any work; one reviewed commit at a time; no push
  before approval.
- Web/mobile notification UI remains **out of scope**.
- Email, outbox, retry, and external delivery remain **out of scope**.
- No unrelated reviewer workflow or admin UI.
- Published history is never rewritten (Commit 4 `files` subject and the
  Commit 1 split-commit publication are recorded cosmetic discrepancies —
  see Session 049/050 traceability notes).
- Publication channel: patches applied by the managed environment, which
  may split commits or alter subjects — verify **tree identity, scope,
  ancestry, and validation**, not published commit hashes.

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
