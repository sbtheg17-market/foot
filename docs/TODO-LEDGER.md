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
