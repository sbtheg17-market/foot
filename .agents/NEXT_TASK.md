# Next product task — MC9 complete (landed at `917361d`/`8323aac`); Web notification feed done (awaiting publication); Mobile feed is next, gated

## Current gate

**MC9 complete** and validated on canonical `main` (`8323aac`): reviewer approve/reject
workflow, transactional approved/rejected decision notifications, and the
durable `test:reviewer-decisions` suite (14/14) are all present.

**Web in-app notification feed + unread badge — DONE (frontend-only, awaiting
managed-environment publication).** `/provider/notifications` consumes only the
existing MC8-lite APIs via the generated client; ProviderLayout gained an
"Alerts" unread badge. No backend/schema/OpenAPI/generated-client/notification
-semantics changes; no email/SMTP/push/SSE/notification-bus/vendor coupling
(complies with `NOTIFICATION_ARCHITECTURE_CONSTRAINTS.md`). Validated:
typecheck + build pass; regression green (`test:reviewer-decisions` 14/14,
`test:provider-notifications` 12/12, provider-application 8/8, provider-status
9/9); all UI states verified by manual browser screenshots (no web test
framework introduced — that infra remains deferred). Scope: `artifacts/web/`
only. See Session 052 in `.agents/LOG.md`.

### Superseded reference — MC9 locked three-commit scope


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

## Next gated candidate

**Mobile in-app notification feed + unread badge (Expo)** — parity with the web
feed, consuming the SAME existing MC8-lite APIs via the generated client. Still
**gated**: requires its own scope, acceptance criteria, and explicit approval
before any work. Then: vendor-neutral email outbox + delivery-adapter design →
push through the same channel abstraction. Each is separately approved.

## Post-MC9 deferred

- Web in-app notification feed with unread badge — **DONE** (Session 052; awaiting publication).
- Mobile in-app notification feed with unread badge — next gated candidate (see above).
- Email alerts through a separately designed, vendor-neutral outbox/retry channel.
- Push channel (`expo-notifications` present but unused for this line).
- Composite index `(provider_application_id, created_at DESC, id DESC)` on
  `provider_application_submissions` — documented follow-up (D1 deferred).
- Web/mobile test infrastructure (vitest / RN testing-library) — still deferred; the web
  feed (Session 052) was verified via manual browser screenshots, not automated tests.
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
