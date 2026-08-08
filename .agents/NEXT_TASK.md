# Next product task — Phase 2: post-submission progress presentation

## Current gate

MC5 (submission-history API) is published on canonical `main`, and the
attachment-drift cleanup landed at `origin/main = 64db70a`. MC6 (web
submission-history timeline UI) is implemented and verified on the safety
branch `phase2-mc6-web-timeline`, one commit ahead of `origin/main`.
Do not begin MC7 until the MC6 patch lands on `origin/main` at `0/0`.

- Web `/provider/application-status` renders `SubmissionHistoryTimeline`,
  consuming `GET /providers/application/submissions` newest-first with
  opaque keyset cursor paging; shows prior closed rejected cycles
  (oldest→newest) plus a current-cycle node from the server `summary`,
  with loading / empty / error / unauthorized / paging states and
  server-gated CTAs. `reviewerNotes`/`reviewedBy` never referenced.
- Web + full-workspace typecheck and web production build pass; scope
  limited to `artifacts/web/` (+ `.agents/`).

## Next scope (queued, not started)

**MC7 — Mobile submission-history timeline.** Mirror the web timeline on
`artifacts/mobile` `provider/application-status`, consuming the same MC5
endpoint via the generated client, with the same privacy rules, honest
scope caption, and server-gated CTAs. Mobile-only; no server changes.

## Deferred (explicitly not MC6/MC7)

- Composite index `(provider_application_id, created_at DESC, id DESC)` on
  `provider_application_submissions` — documented follow-up (D1 deferred).
- Lifecycle event recording (submitted/under_review/approved outcomes) —
  history remains closed-rejected-cycles only until a later checkpoint.
- Web test infrastructure (vitest + testing-library) — separate slice.
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
