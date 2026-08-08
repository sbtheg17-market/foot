# Next product task — Phase 2 complete; awaiting next checkpoint

## Current gate

MC8-lite is in progress as four separately-reviewed commits off the MC7
base. **Commit 1 of 4 (composite history-index migration) is done** on
`phase2-mc8-notifications`, 1 ahead / 0 behind `origin/main`:

- `provider_application_submissions` now has composite index
  `(provider_application_id, created_at DESC, id DESC)`; the redundant
  single-column index was retired. Database-only change; validated with
  `push` + `EXPLAIN` (Index Scan, no Sort) + `test:provider-history` 11/11.

**Commits 2–4 remain gated pending separate approval of Commit 1:**
2. Lifecycle event store (`provider_application_events`; enum values
   `submitted`, `reset_to_draft`) — emit the two locked transitions inside
   the existing submit/reset transactions.
3. In-app notifications (`provider_notifications`, `UNIQUE(user_id,
   event_id)`) + owner-scoped read APIs (list, unread-count, mark-read).
4. API regression coverage (extend the `node:test` harness).

Do not start Commit 2 until Commit 1 is reviewed and approved.

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
