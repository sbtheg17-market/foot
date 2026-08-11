# Next product task — read `docs/roadmap/NEO_EAGLE_VIEW.md` first

## Session 070 publication candidate — ready for review (2026-08-11)

- The uploaded Session 069 publication record, Session 070 forensic resume report, and
  Session 070 client booking-lifecycle slice are applied in order on a dedicated branch.
- Workspace verification: `pnpm install --frozen-lockfile`, full typecheck, full build,
  API/web workflow startup, 63 booking state-machine tests, and a 390px web preview pass.
- DB-backed lifecycle, concurrency, and review suites are **UNVERIFIED in this workspace**
  because the development database has no `users` relation. No schema push or seed was
  performed, and this is not a Gate B attempt.
- The publication branch excludes the pre-existing `.replit` environment edit and all
  uploaded `.patch` files. Review and merge the pull request before treating the slice as
  published.

## Publication record — Session 068 is PUBLISHED (2026-08-11)

- **Session 068 landed on `main`:** squash-merge of PR #1 → `origin/main` =
  `36b5880743d4bd71c8ab566c0c832890eff33840` (single non-merge commit, parent
  `b20087d…`, no history rewrite, all 26 `conflict_*` refs untouched).
- **Content verification:** all five approved documentation files on `main` are
  byte-identical to the reviewed Session 068 commit (per-blob hash match).
- **Recorded discrepancy (environment-only):** the squash carried one out-of-scope
  file, `.replit` (+`"python-base-3.13"` in dev modules, added by the Replit Agent
  during the PR window). No application behavior is affected; same class as the
  Session 050 environment-only `.replit` marker. Main tree is `61061e9…` instead of
  the reviewed `c2e0409f…` solely because of this one line.
- The Eagle View (`docs/roadmap/NEO_EAGLE_VIEW.md`), root `AGENTS.md`, and Branch
  Inventory V7 are now canonical on `main`. Next agents: start there.

## Current active state — Session 068 (2026-08-11, eagle view + inventory v7)

- **Canonical remote baseline:** `origin/main` = `b20087d13eb77ad3da0b60efc88d4e768f68134d`
  (2026-08-11 16:29:48 +0000, Session 067 inventory-v6 docs commit).
- **This session (068) is documentation-only:** permanent eagle view
  (`docs/roadmap/NEO_EAGLE_VIEW.md`), root `AGENTS.md` read-order contract, and
  **Branch Inventory V7** (`docs/roadmap/BRANCH_INVENTORY_V7.md`, 26 branches —
  supersedes inventory v6 and every older inventory/cleanup authorization).
  No application, schema, OpenAPI, generated-client, dependency, workflow, or database
  changes. No branch was merged or deleted.
- **Merge boundary (permanent):** never merge, base work on, or delete any `conflict_*`
  ref without fresh named authorization against Inventory V7. No force-push. No history
  rewrite. Publication to `main` only via reviewed fast-forward / PR through the gate
  (`pnpm run publish:gate`).
- **Comfort-Wiring:** separate project. Canonical preserved state = `conflict_110826_1322`
  (contract V3 + V3.1, 11 patches + signed INDEX, CW ledger ENTRY-001..019, 27/27).
  Reference only — stack-native port under its own approval (Eagle View §4).

## Priority order (recorded in the Eagle View §7)

1. **Gate B clearance** — verify managed PostgreSQL `DATABASE_URL` (managed DB only; no
   local substitute; no fabricated PASS; record exactly what ran). Currently
   **BLOCKED/UNVERIFIED**. Blocks: activation Phases 4–7, production event writes, all
   migrations (incl. any future 4C schema).
2. **Client booking lifecycle completion slice** — cancellation confirmation,
   duplicate-submit protection, one-review-per-completed-booking UI; reuse existing APIs;
   tests for repeat submissions and invalid states. Next feature slice after (or while
   arranging) Gate B.
   **Status (Session 070): IMPLEMENTED as a reviewed candidate — pending PR review /
   squash merge.** Reimplemented from test-report evidence (original uncommitted working
   tree unavailable — see `docs/roadmap/SESSION_070_RECON_FOOT_WORKTREE.evidence.md`).
   Delivered: `POST /bookings` duplicate 409 + `bookingId` (contract-first, codegen),
   in-app cancel dialogs on the bookings list + detail (no `window.confirm`),
   booking-modal 409 info-toast + redirect, and
   `client-booking-lifecycle.integration.test.ts` (7/7; full regression green). The
   race-proof partial unique index remains a future schema task gated behind Gate B.
3. **Phase 4C stack-native port PLAN (plan only)** — Drizzle schema additions, Express
   routes, authz boundaries, consent status + visibility models, projection conditions,
   exact status codes (grant 201/400; PUT 409-on-inactive; withdraw/delete separate,
   404-capable; projection 404-only), test strategy, React/Vite UI, one-task → one-commit
   → one-patch sequence. Cite the recovered contract as reference; never apply
   FastAPI/Mongo code.
4. **Inventory V7 governance + branch export** — V7 is published with this session;
   export CW branches (1322 → 1134 → 1112 → 0846) to a separate repository/archive
   BEFORE any cleanup is considered. **No deletion is authorized.**

## Constraints (locked, carried forward)

- Step-0 gate before any work; one reviewed commit at a time; no push before approval.
- Never render `reviewerNotes` in any client; only `rejectionReason` + public snapshot
  fields are safe.
- Reviewer decisions never touch provider-profile `verificationStatus`; the
  approved-provider boundary (application AND verification approved) stays intact.
- Signup `roleIntent` is an onboarding request, never an authorization claim.
- Render actions strictly from server `canEdit` / `canReset` / `canResubmit`.
- No Stripe, payouts, disputes, background checks, or unrelated admin/care-history work
  without separate approval.
- Email outbox, push delivery, and the mobile notification feed remain gated, sequenced
  after the priorities above.
- Web/mobile automated test infrastructure remains a deferred, separately approved item.

## Superseded references

Session 063/066 baselines (`3e76114`, `184833b`, `c02a308`, `401a9d7`), the 18-branch
inventory (v5), inventory v6 (25 branches), and the 9-branch cleanup authorization are
ALL superseded. Use `docs/roadmap/BRANCH_INVENTORY_V7.md` and the Eagle View. The
Phase 4C “contract absent” blocker of Sessions 065/066 is updated: the actual contract
document is preserved on `conflict_110826_1322` (`docs/comfort-profile/…V3.md`);
recovering it into this repo is a docs-only operation that still requires explicit
operator approval.
