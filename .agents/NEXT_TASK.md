# Next product task — Phase 2 complete; awaiting next checkpoint

## Current gate

MC8-lite is in progress as four separately-reviewed commits off the MC7
base. **Commits 1–2 of 4 are done** on `phase2-mc8-notifications`
(1 ahead / 0 behind `origin/main` after each publish):

- **Commit 1 (landed, `0ab9964`):** composite index
  `(provider_application_id, created_at DESC, id DESC)` on
  `provider_application_submissions`; redundant single-column index retired.
- **Commit 2 (done, awaiting review):** append-only `provider_application_events`
  (enum `submitted` | `reset_to_draft`, `from_status`/`to_status`), emitted
  inside the existing submit/reset transactions — exactly-once, atomic. No
  notification table/API, reviewer endpoint, or web/mobile changes.

**Commits 3–4 remain gated pending separate approval of Commit 2:**
3. In-app notifications (`provider_notifications`, `UNIQUE(user_id,
   event_id)`) + owner-scoped read APIs (list, unread-count, mark-read),
   created in the same transaction as each event.
4. API regression coverage (extend the `node:test` harness), including
   durable event-emission and notification tests.

Do not start Commit 3 until Commit 2 is reviewed and approved.

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
