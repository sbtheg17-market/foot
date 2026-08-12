# Next product task — read `docs/roadmap/NEO_EAGLE_VIEW.md` first

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

## Race-Proof booking index — 2026-08-12 — APPLIED & CONCURRENCY-VERIFIED

- Operator approval referenced the complete SQL SHA-256
  `aece832e2356eb8c70f33bacaab3e7153fcfb4637788ba85eead9348d3594612`; the byte-identical
  packet SQL ran in one transaction over the verified `aws-0` session pooler after
  read-only preflight and an immediate pre-execution hash re-check.
- Live index: `bookings_active_booking_unique_idx` — partial unique on
  `public.bookings (client_id, provider_id, service_id, scheduled_at)
  WHERE status IN ('requested','confirmed','rescheduled')`; `indisunique=true`,
  `indisvalid=true`; catalog otherwise unchanged (18/18, 14/14, 34/34, 13 non-constraint
  indexes); 0 rows.
- Concurrency proof: two simultaneous identical booking inserts → exactly one COMMITTED,
  one rejected with SQLSTATE 23505 citing this index; transient test data fully removed;
  all 18 tables live-verified back to 0 rows. Independently re-verified by a separate
  testing agent (5/5).
- The duplicate-booking invariant is now enforced at the database level; the Session 070
  application 409 check is the fast path, not the only defense.
- Gated follow-ups (separate approvals): mirror declaration in
  `lib/db/src/schema/bookings.ts` BEFORE any future `drizzle-kit push` (index-drop
  hazard) — **DONE (Session 074, commit `f12bd05e1d57f17d5cfc1ec8b83b26b9968e174c`,
  branch `publish/session-074-index-mirror` published to GitHub 2026-08-12, PR review
  pending)**; map 23505 → 409 in the API insert path per
  `.agents/memory/drizzle-unique-error-wrapping.md` — **DONE (Session 077, commit
  `3ab6cb7329e54ff97c6e2c633b66fe0fecf1448d`, local-only, pending publication)**;
  next: provider-facing booking-race notice built on the friendly 409 contract
  (never raw database errors). Operator rule:
  any future push proposing DROP/CREATE for this index is a hard STOP requiring a
  separately reviewed migration.

## Architecture rule — 2026-08-12 — recorded for ALL future work (operator-issued)

- **OnCall Foot is the first vertical, not the permanent platform boundary.** Before any
  new domain feature, classify each change as (1) reusable marketplace core or
  (2) vertical/service adapter.
- The reusable core should eventually support: marketplace/workspace ownership;
  white-label branding; capability-based delegated administration; independent providers;
  individual clients and client groups; generic service categories and solution packages;
  configurable landing-page sections; tenant-scoped events, bookings, and analytics.
- Wiring direction (design now, build as separately reviewed tasks — additive migrations,
  never a rushed rewrite of the verified schema): record → `marketplace_id` → platform
  ownership path (mapped first, not blindly added to every table); capability-based
  authorization (`can_manage_providers`, `can_edit_branding`, …) instead of
  `role == "admin"` checks, with per-marketplace memberships; neutral service-catalog
  concepts (`service_category`, `service_definition`, `solution_package`,
  `provider_specialty`, …); client groups/cohorts (respectful terminology); configurable
  landing-page content model; domain-neutral events carrying marketplace/actor/subject/
  correlation context. Vertical terminology lives in the adapter layer.
- Build sequence recorded: finish integrity work (done: index) → publish verified
  foundation → extensibility architecture task → first vertical-neutral white-label
  slice → intelligence layer (ML recommends and explains; never silently overrides
  booking rules, authorization boundaries, qualifications, or consent). Permanent
  domain-neutrality rule applies to every future ML handoff.
- The future architecture must not weaken or bypass the database-level booking
  invariant established above.

## Gate B re-verification — 2026-08-12 — PASS (supersedes the 2026-08-11 disposition)

- Read-only re-verification executed from the confirmed takeover environment using the
  tenant-specific **`aws-0-us-west-2.pooler.supabase.com:5432` session pooler**, database
  `postgres`. The tenant-bearing login was accepted; the 2026-08-11 `no tenant identifier
  provided` failure did not recur. The IPv6-only direct host and the rejected `aws-1`
  pooler were not used. The secret was never printed, logged, or committed.
- Live-observed, inside `BEGIN TRANSACTION READ ONLY` (`transaction_read_only=on`):
  PostgreSQL 17.6, `in_recovery=false`, UTF8, UTC; extensions `pg_stat_statements`,
  `pgcrypto`, `plpgsql`, `supabase_vault`, `uuid-ossp`; **18/18 tables** exact-match to the
  pinned Drizzle schema, **14/14 enums**, **12/12 non-constraint indexes**, **34/34 foreign
  keys**, **0 rows** in every table; no drizzle migration tracking in `public`.
- `bookings_active_booking_unique_idx` confirmed **absent** — the Race-Proof index remains
  a separate schema task requiring explicit approval of the frozen packet
  (SQL SHA-256 `aece832e2356eb8c70f33bacaab3e7153fcfb4637788ba85eead9348d3594612`).
- No DDL, no `drizzle-kit push`, no migration, no seed, no write, no application or schema
  file change occurred during the verification run.
- The 2026-08-11 BLOCKED record below is preserved as true history of the failed `aws-1`
  attempt; its "pending" disposition is superseded by this PASS.

## Gate B attempt — 2026-08-11 — BLOCKED / UNVERIFIED (superseded 2026-08-12)

- The operator authorized the exact Supabase Session pooler host
  `aws-1-us-west-2.pooler.supabase.com` and selected option 3(a): read-only
  verification only.
- The secure `SUPABASE_DATABASE_URL` value was not printed or logged. It parsed
  as a Supabase direct database URI rather than the complete Session pooler URI.
  The direct path was not used; this container has no global IPv6 interface.
- The exact pooler host was attempted without guessing a hostname. The pooler
  rejected the stored direct-URI credential components with `no tenant
  identifier provided (external_id or sni_hostname required)`. No SQL completed.
- No schema push, `drizzle-kit push`, migration, migration generation, seed,
  write, DDL, or Race-Proof Index operation ran. Provider/database identity,
  PostgreSQL version, extensions, migration state, and catalog contents remain
  unverified. No empty catalog or Gate B PASS was fabricated.
- Required disposition recorded: **schema absent — pending separately authorized
  migration**; this is not evidence that the remote catalog is empty.
- Full report: `memory/GATE_B_RUN_2026-08-11.md`. The requested absolute
  `/app/memory/` path does not exist in this workspace.

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
   local substitute; no fabricated PASS; record exactly what ran). **RE-VERIFIED / PASS
   (2026-08-12)** — see the re-verification record above. No longer blocks migrations.
   The Race-Proof partial unique index was subsequently **applied and
   concurrency-verified (2026-08-12)**; the next gated schema task is the
   `bookings.ts` index-mirror follow-up (required before any future `drizzle-kit push`).
2. **Client booking lifecycle completion slice** — cancellation confirmation,
   duplicate-submit protection, one-review-per-completed-booking UI; reuse existing APIs;
   tests for repeat submissions and invalid states. Next feature slice after (or while
   arranging) Gate B.
   **Status (Session 070): IMPLEMENTED as a reviewed candidate — verification in progress.**
   Reimplemented from test-report evidence (original uncommitted working tree unavailable;
   see `docs/roadmap/SESSION_070_RECON_FOOT_WORKTREE.evidence.md`). Delivered: `POST
   /bookings` duplicate 409 + `bookingId` (contract-first, codegen), in-app cancel dialogs
   on the bookings list + detail (no `window.confirm`), booking-modal 409 info-toast +
   redirect, and `client-booking-lifecycle.integration.test.ts`. The race-proof partial
   unique index remains a future schema task gated behind Gate B.
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
