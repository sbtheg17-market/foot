# Next product task — Phase 2 complete; awaiting next checkpoint

## Current gate

The post-submission progress presentation is complete across all surfaces:
MC5 (submission-history API), MC6 (web timeline), and MC7 (mobile timeline).
MC7 is implemented and verified on the safety branch
`phase2-mc7-mobile-timeline`, one commit ahead of
`origin/main = 982334332defaf9441bea181b5271c15168618e9`.
No new product work should begin until the MC7 patch lands on
`origin/main` at `0/0` and the next checkpoint is explicitly approved.

- Mobile `provider/application-status` renders `SubmissionHistoryTimeline`
  (Expo/React Native), consuming `GET /providers/application/submissions`
  newest-first with opaque keyset cursor paging; shows prior closed
  rejected cycles (oldest→newest) plus a current-cycle node from the
  server `summary`, with loading / empty / error / unauthorized / paging
  states and server-gated CTAs. `reviewerNotes`/`reviewedBy` never
  referenced; honesty caption matches MC6.
- Mobile + full-workspace typecheck pass; `expo export --platform web`
  bundles the whole module graph with no errors. Native Hermes/device
  preview is not runnable in this headless container.

## Next scope (queued, not started — requires explicit approval)

Nothing in the submission-history line remains. Candidate future work is
all explicitly deferred (see below); each needs its own checkpoint sign-off.

## Deferred (explicitly not part of MC5–MC7)

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
