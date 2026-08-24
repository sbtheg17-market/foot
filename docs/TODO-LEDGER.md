# TODO ledger — deferred and gated work (authoritative)

**Created 2026-08-24 during roadmap item 10 (test/CI matrix).** No single
authoritative TODO file existed before this date; deferred items were spread
across `docs/NEXT-STEPS.md`, `docs/test-coverage-matrix.md`,
`docs/managed-db-release-gate.md`, `docs/roadmap/*`, and the continuity record
`docs/neo/2026-08-21-client-retention-handoff.md`. This ledger consolidates
them. Append updates with dates; never silently delete an entry.

## Deferred product work (NOT implemented — do not mark complete)

| Item | Status | Notes / gate |
|---|---|---|
| Scheduled reminder delivery | DEFERRED — not implemented | No scheduler, no reminder jobs exist. Design remains open. |
| Native-device verification | DEFERRED — never performed | See `docs/native-device-checklist.md`. CI's Expo exports/typecheck are NOT native validation. |
| Payment/refund behavior | DEFERRED — not implemented | Only pure money/status primitives exist (`payments-foundation`); no provider selected, no checkout, no webhooks, no refunds/payouts/invoices changes. |
| Service-area / travel enforcement | DEFERRED — design only | `docs/service-area-travel-policy.md` is approval-gated; current behavior is descriptive only. |
| Cross-provider client-overlap policy change | DEFERRED — operator decision | `docs/booking-overlap-policy.md` recommendation unapproved; behavior unchanged. |
| Client notification persistence / email / SMS | DEFERRED — not implemented | Provider-only in-app unread persists; no client persistence, no email/SMS. |
| Production deployment | NOT AUTHORIZED | No CI job deploys. Railway config unchanged. |
| Managed-database migration/release | GATED — see `docs/managed-db-release-gate.md` | Backup/restore evidence and read-only managed catalog verification remain release blockers. Frozen artifacts (`docs/migrations/*.sql`) are additive-only, no DOWN, never auto-applied. |

## Roadmap item 10 follow-ups (added 2026-08-24)

| Item | Status | Notes |
|---|---|---|
| Full native device lab (iOS/Android simulators + physical devices) | OPEN | Prerequisite for closing the native-device row above; Maestro is the lighter automation candidate (no repo dependency). |
| Real notification delivery verification | OPEN | Requires physical devices and Expo push credentials; never verified. |
| Additional browser matrix (real-browser E2E) | OPEN | Web tests run in jsdom; a Playwright login→book→reschedule smoke against a seeded server is the next increment (framework not added to the repo yet — operator approval for the dependency). |
| jsdom-level a11y limits | OPEN | axe in jsdom cannot check color-contrast or real focus-trap behavior across browser paint; manual AT/browser audit still needed before release. |
| Unsupported CI environment cases | OPEN | (a) `prevented-bookings-daily-rebuild.test.ts` contains a Session-080 changed-file-scope guard that fails by design on any non-main tree — it runs as a labeled NON-GATING CI step; do not weaken or delete it. (b) `prevented-booking-replay.integration.test.ts` DLQ subtests consume fixed seeded slot-pool positions, so ANY booking suite that ran earlier against the same database collides (duplicate 409) — verified in the first CI run; the suite therefore has a dedicated CI job (`api-replay-tests`) with its own disposable database, and locally must run against a freshly reset scratch DB. (c) Expo export with Hermes bytecode requires x86_64 (`hermesc` linux64 binary); on arm64 hosts use `--no-bytecode` locally — CI runners are x86_64 and run the full export. (d) Package-level `typecheck` (e.g. mobile) needs `pnpm run typecheck:libs` first to build referenced lib d.ts outputs — the CI job does this. |
| Root `pnpm test` scope | INFO | Added 2026-08-24: runs the pure API unit suite and the web Vitest suite recursively. DB-backed integration suites remain per-package `test:*` scripts (documented in `docs/test-coverage-matrix.md`). |

## How to update

Append a dated row or strike-through with a date and the PR that closed it.
Deferred items above may only be closed by a session explicitly scoped to them.

## Pre-#11 release-readiness review — 2026-08-24

Full gate report: `docs/pre-11-release-readiness.md`. Verified `main`:
`17b1bf9589f9665630346af3a85d110debcd170a`. All deterministic checks re-run and
green (295 scripted + 71 unscripted API tests, 60 web, smoke, migration checks,
secret scan; 16/16 CI jobs green on `main`). Per-item detail for every deferred
entry — owner for all items: repository operator; last reviewed: 2026-08-24.

### Scheduled reminder delivery — DEFERRED
- **Why:** no scheduler/queue infrastructure exists; operator approval for the
  delivery design is required (`docs/rescheduling-policy.md` Part 2 item 7).
- **Files:** `artifacts/api-server/src/lib/reschedule-policy.ts`
  (`PROPOSAL_REMINDER_LEAD_MS` constant only), notification helpers in
  `artifacts/api-server/src/lib/`.
- **Depends on:** scheduling infrastructure decision; notification persistence
  decision. **Next action:** operator approves a scheduler design.
- **Done when:** reminders fire at the documented lead time, covered by
  deterministic tests, without email/SMS scope creep.

### Native-device verification — DEFERRED (never performed)
- **Why:** no iOS/Android simulator, emulator, or physical device in any
  recorded environment. CI's Expo exports/typecheck are NOT native validation.
- **Files:** `docs/native-device-checklist.md`. **Depends on:** device lab or
  physical devices + Expo push credentials.
- **Next action:** run the checklist on one iOS and one Android device.
- **Done when:** every checklist row has a dated sign-off with device/OS/SHA.

### Payments/refunds/payouts — DEFERRED
- **Why:** only pure money/status primitives exist (`test:` suite
  `payments-foundation`, 6 tests); no provider selected, no checkout, no
  webhooks. **Files:** `docs/payments-foundation.md`, API money helpers.
- **Depends on:** provider choice + compliance decisions.
- **Next action:** operator selects a payment provider and scope.
- **Done when:** end-to-end payment flow exists behind tests and a rollout gate.

### Service-area/travel enforcement — DEFERRED (design only)
- **Why:** `docs/service-area-travel-policy.md` is approval-gated; current
  behavior is descriptive only. **Depends on:** operator approval of the policy.
- **Next action:** approve/revise the policy doc, then a scoped implementation.
- **Done when:** feasibility checks are enforced with tests, per approved policy.

### Production deployment — NOT AUTHORIZED
- **Why:** no deployment authorization; CI intentionally has no deploy job.
- **Files:** `railway.json`, `nixpacks.toml`, `Procfile` (all unchanged);
  `deploy-build` CI job proves Railway build parity only.
- **Next action:** operator decision. **Done when:** explicitly authorized,
  with the managed-DB gate satisfied first.

### Managed database migration/release — GATED
- **Why:** `docs/managed-db-release-gate.md` blockers (backup/restore evidence,
  read-only managed catalog verification) remain open. Frozen artifacts
  (`docs/migrations/*.sql`) are additive-only, hash-checked in CI, never
  auto-applied. **Next action:** satisfy the gate's evidence steps.
- **Done when:** the gate document's checklist is complete and signed off.

### Real-browser E2E (Playwright) — OPEN (not implemented)
- **Why:** web tests run in jsdom (axe cannot compute color-contrast; no real
  focus-trap/paint verification). Dependency addition needs operator approval.
- **Next action:** approve Playwright as a dev dependency; add a seeded-server
  login → book → reschedule smoke. **Done when:** the browser smoke runs in CI.

### CI status badge — OPEN (not implemented)
- **Why:** cosmetic; not part of item #10's scope. **Files:** `README.md`.
- **Next action:** add the workflow badge to README in any docs-scoped session.
- **Done when:** README shows live CI status for `main`.

### Environment-specific limitations (recorded facts)
- arm64 hosts must use `expo export --no-bytecode` (x86_64 `hermesc`); CI
  runners are x86_64 and run full exports.
- The replay/DLQ suite needs a booking-free slot pool → dedicated CI job
  (`api-replay-tests`); locally reset the scratch DB first.
- The Session-080 changed-file-scope guard
  (`prevented-bookings-daily-rebuild.test.ts`) fails by design off `main`
  (non-gating, labeled, in CI). **2026-08-24 fix:** the API server's runtime
  DLQ directory `artifacts/api-server/var/` was untracked-and-unignored and
  tripped this guard even on a clean `main` checkout after any server run; it
  is now gitignored (file-hygiene fix, no runtime change). External
  test-harness reports (`/test_reports/`) are likewise ignored to keep agent
  tooling out of the repository.

### Stale open PR #2 — OPERATOR DECISION
- `docs: record Session 068 publication verification` (2026-08-11, branch
  `docs/session-069-publication-record`, +38 lines to `.agents/LOG.md` and
  `.agents/NEXT_TASK.md`). Its `.agents/NEXT_TASK.md` payload is long
  superseded (it gates on the client booking-lifecycle slice, done many
  sessions ago); merging now would regress the task ledger. Recommendation:
  close without merging, preserving the branch as the historical record. Not
  closed in this gate (branch/PR disposition left to the operator).
