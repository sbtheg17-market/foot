# Next product task — Phase 2: post-submission progress presentation

## Current gate

MC5 (Provider submission-history API — backend only) is implemented and
verified on the safety branch `phase2-mc5-submission-history`, one commit
ahead of canonical `origin/main = 783052223e27fb781f1dae5e3c17a4eb583e8dce`.
Do not begin MC6 until the MC5 patch lands on `origin/main` at `0/0`.

- `GET /providers/application/submissions` — owner-scoped, keyset-paginated
  (`created_at DESC, id DESC`) history of closed rejected cycles, newest
  first. Returns `{ summary, submissions[], pagination }`; `summary` reuses
  the `/status` projection (shared `buildStatusView`), `submissions[]` is a
  six-field public allow-list, `pagination` is `{ limit, hasMore,
  nextCursor }` with an opaque position-only base64 cursor.
- `test:provider-history` 11/11; regression green
  (`test:authorization` 7/7, `test:provider-application` 8/8,
  `test:onboarding` 23/23, `test:provider-status` 9/9,
  `test:provider-resubmission` 11/11); typecheck + build clean.

Phase 1 micro-checkpoints 1–4 remain merged on canonical `main`
(MC1 `54534b0`, MC2 `1f4c018`, MC3 `dc7a40d`, MC4 `f2ed537`), and the
baseline test-drift + seed-hygiene cleanups are done.

## Next scope (queued, not started)

**MC6 — Web submission-history timeline.** Render the newest-first
timeline on `/provider/application-status` by consuming the generated
`useGetProviderApplicationSubmissions` hook (paged). Then **MC7** mirrors
it on mobile. Both are UI-only and must not change server behavior.

## Deferred (explicitly not MC5/MC6)

- Composite index `(provider_application_id, created_at DESC, id DESC)` on
  `provider_application_submissions` — documented follow-up (D1 deferred);
  add only if this endpoint becomes hot.
- Lifecycle event recording (submitted/under_review/approved outcomes) —
  the history is honestly closed-rejected-cycles only until a later
  checkpoint starts recording those events.
- `attemptNumber` (D2), submission-outcome enum expansion (B1=A),
  notifications, admin/reviewer history access.

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
