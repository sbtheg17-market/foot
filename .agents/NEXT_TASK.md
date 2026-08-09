# Next product task — MC9 Commit 3 done, awaiting review; MC9 completes when it lands

## Current gate

MC9 (reviewer approve/reject workflow + decision notifications) — locked
three-commit scope:

- **Commit 1 (landed):** admin-only reviewer decision endpoints — published
  as split commits `0afb3ff` + `92d001f` (tree byte-identical to the
  reviewed implementation; `59068c8` is an environment-only `.replit`
  marker). See Session 050 traceability note.
- **Commit 2 (landed, `917361d`):** transactional `approved`/`rejected`
  provider notifications — tree byte-identical to the reviewed
  implementation (Session 051 traceability note).
- **Commit 3 (done, awaiting review):** durable `node:test` suite
  `test:reviewer-decisions` (14 cases) — reviewer authn/authz, self-review
  prevention, valid/invalid/repeated decisions with no-side-effect
  assertions, event + notification atomicity, ownership isolation, privacy.
  No app/API/schema changes.

Once Commit 3 lands, **MC9 is complete**. Next candidate checkpoints remain
gated pending separate scope approval: web/mobile in-app notification feed
with unread badge → email alerts via a separately designed outbox/retry
channel → push delivery.

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
