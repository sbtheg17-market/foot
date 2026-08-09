# Next product task — Web notification feed PUBLISHED (`a98e1a3`); Provider Activation & First Booking Conversion IN PROGRESS (Phases 1–3 done; Phase 3 PUBLISHED at `cf689b5`); Mobile feed sequenced after

> **Active checkpoint: Provider Activation & First Booking Conversion** (approved to sequence
> BEFORE the mobile feed). Product/measurement spec:
> `/workspace/CHECKPOINT_PROVIDER_ACTIVATION_FIRST_BOOKING_SPEC.md`. Phased, each phase
> separately sign-off-gated. **Phase 1 (additive `marketplace_events` migration) applied to the
> test DB** (Session 053). **Phase 2 (owner-scoped readiness API) PUBLISHED** as `4bb0e00`
> (Session 054). **Phase 3 (event emission) PUBLISHED** at `cf689b5`, tree
> `e30feca1251f250a7126e987c9379ca3e42e1056`, exactly the six approved files (Session 055
> remote verification). Managed database status: **UNVERIFIED**. Phases 4–7 (booking
> enforcement → flagged discovery gating → funnel-report API → validation) and readiness UI
> NOT started and remain gated. Mobile feed, email outbox, and push remain gated and
> sequenced after this checkpoint.

## Publication state (Session 055 remote verification)

- Canonical `origin/main` tip: `cf689b5` ("uploaded Phase 3 patch"), tree
  `e30feca1251f250a7126e987c9379ca3e42e1056`, parent `d7a01e8`.
- Ancestry: `d7a5999` (Phase 1 base) → `4bb0e00` (Phase 2 readiness patch) →
  `d7a01e8` (readiness docs) → `cf689b5` (Phase 3, six-file scope confirmed).
- The originally approved Session 055 documentation publication (target tree
  `9a30663a…`) never landed on any remote ref; it is recreated as a docs-only
  commit (this change). See Session 055 in `.agents/LOG.md`.
- All `origin/conflict_*` branches are unrelated Emergent workspace lineages
  (no common ancestor with `main`) — forensic archive only; never merge or
  base work on them.

## Session 056 local draft — awaiting review

- Managed publication succeeded without force-push, history rewrite,
  `conflict_*` merge, or Emergent “Save to GitHub” flow.
- Verified canonical `origin/main` is
  `4734990df76b65735c12b62f88cbda2d327738fd`, parent
  `cf689b5bb0f6bbc2f01a63a101cf6bc4e32a9421`, tree
  `4002cbed57f5e9ea436d153d49ecaa3ba02f506b`.
- Session 055 is present on `origin/main`; the Phase 3 tree remains
  `e30feca1251f250a7126e987c9379ca3e42e1056`; the published diff contains
  only `.agents/LOG.md` and `.agents/NEXT_TASK.md`.
- The working tree was clean before this intentional local draft. Managed DB
  remains **UNVERIFIED**.
- **STOP FOR REVIEW:** this draft is not committed or published. No Phase 3
  enhancements, funnel-report implementation, UI work, database operations, or
  validation work is authorized.

## Session 057 traceability correction (local draft — awaiting review)

- The "Session 056 local draft" section above was in fact **published to
  `origin/main` at `6a5cf35`** without the required separate review gate; its
  "not committed or published" wording became inaccurate at publication. The
  published text is preserved verbatim — this correction is additive (see
  Session 057 in `.agents/LOG.md`).
- Session 055 landed correctly at `4734990` (parent `cf689b5`, tree
  `4002cbed57f5e9ea436d153d49ecaa3ba02f506b`, byte-identical to the reviewed
  patch, docs-only two-file scope). Phase 3 remains unchanged at tree
  `e30feca1251f250a7126e987c9379ca3e42e1056`.
- Canonical history `cf689b5 → 4734990 → 6a5cf35` is preserved — no rewrite,
  no force-push, no amend/revert, no `conflict_*` involvement.
- Managed DB remains **UNVERIFIED**. Phase 3 enhancements, funnel reporting,
  flagged discovery gating, booking enforcement, readiness UI, and any
  database/schema operations remain **gated**.

## Canonical handoff policy (permanent)

- `origin/main` of `https://github.com/sbtheg17-market/foot` is the ONLY
  canonical source of truth.
- Every new account/agent must clone that repository, then fetch and verify
  `origin/main` (commit + tree) BEFORE editing anything.
- Never continue from an Emergent-generated `conflict_*` branch unless it is
  proven to descend from foot `main`.
- Use a unique local branch per task; push only reviewed commits through the
  authenticated managed publication channel, as a fast-forward — no
  force-push, no history rewrite, no `conflict_*` merges.
- End every session with either a pushed commit or an explicit local artifact
  (patch) plus SHA-256 checksum recorded in `.agents/LOG.md`.
- The next account must verify the remote commit/tree before doing any work.
- Archive `conflict_*` branches for forensics; do not merge or force-push them.

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
