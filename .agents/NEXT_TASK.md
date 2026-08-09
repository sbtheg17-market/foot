# Next product task — Phase 2 complete; awaiting next checkpoint

## Current gate

MC8-lite is **feature-complete** — four separately-reviewed commits off the
MC7 base. Commits 1–3 landed on canonical `main`; **Commit 4 is done** on
`phase2-mc8-notifications` (1 ahead / 0 behind `origin/main`), awaiting review.

- **Commit 1 (landed, `0ab9964`):** composite submission-history index.
- **Commit 2 (landed, `971cf70`):** `provider_application_events`
  (`submitted` | `reset_to_draft`), transactional emission.
- **Commit 3 (landed, `7d8e8ff`):** `provider_notifications` +
  owner-scoped read APIs (list / unread-count / mark-read).
- **Commit 4 (done, awaiting review):** durable `node:test` suite
  `test:provider-notifications` (12 cases) covering emission, atomicity,
  idempotency, isolation, pagination, unread-count, mark-read, error/auth
  paths, and privacy. No app/API/web/mobile changes.

After Commit 4 lands, MC8-lite is complete. Next candidate checkpoints are
all still gated (see Post-MC8 deferred): reviewer approve/reject + the
approved/rejected notification triggers (MC9), then push/email channels,
then web/mobile notification UI.

## Post-MC8 deferred

- Lifecycle event recording (submitted/under_review/approved outcomes) —
  the history remains closed-rejected-cycles only until a later checkpoint
  starts recording those events. Until then no surface may claim to show a
  complete persisted lifecycle event log.
- Notifications (`expo-notifications` is present but unused for this line).
- Composite index `(provider_application_id, created_at DESC, id DESC)` on
  `provider_application_submissions` — documented follow-up (D1 deferred).
- Web/mobile test infrastructure (vitest / RN testing-library) — the
  timelines are validated by typecheck + build/export today.
- Root `attached_assets/Pasted-*.txt` (pre-existing canonical content) —
  optional separate remote cleanup; not touched here.

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

- `attached_assets/phase1-mc1_1786063790850.patch` remains committed on
  `origin/conflict_070826_mc2` — safe to leave; delete the branch
  entirely as a hygiene action.
- Web test infrastructure (vitest + testing-library) — separate slice.
