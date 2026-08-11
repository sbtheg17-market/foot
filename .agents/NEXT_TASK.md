# NEXT_TASK — current truth for this checkout

## Baseline (authoritative — do not follow older references)
- repository: `/app` (standalone checkout; `sbtheg17-market/foot` monorepo NOT accessible here)
- branch: `main`
- commit: `efbf7ec565e4403d6bc61b077c7d9a75ace5ab32`
- note: worktree carries the Phase 4C restoration described in `.agents/LOG.md` ENTRY-004.
- HISTORICAL ONLY (never align to these in this checkout): `3e76114`, `c02a308`, `184833bd8727…`

---

## Task 1 — Restore Phase 4C comfort-profile contract + shell
STATUS: DONE + VERIFIED (LOG ENTRY-004, ENTRY-005 — 16/16 automated checks passed)
PATCH: patches/PHASE_4C_restoration.patch

## Task A — Comfort Profile API (operator priority 1)
STATUS: DONE + VERIFIED (LOG ENTRY-007 — 12/12 node:test checks passed)
PATCH: patches/PHASE_4C_comfort-profile-api.patch

## Task B — Provider Projection Card (operator priority 2)
STATUS: DONE (LOG ENTRY-008) — interaction matrix queued for comprehensive test run
PATCH: patches/PHASE_4C_provider-projection-card.patch

## Task C — Patient Auth (operator priority 3)
STATUS: NEXT
- Sign-in + hardened logout (always clears session even on request failure).

## Task D — Patch Index Page (operator priority 4)
STATUS: QUEUED
- Lists patch name, commit hash, files touched, test evidence.
- `docs/comfort-profile/PHASE_4C_COMFORT_PROFILE_CONTRACT_V3.md` present.
- `ComfortPreferencesShell` present, props-driven, aligned with contract §5.
- Shell visible at `/phase-4c/shell-preview` (presentation-only harness).
- Forbidden items untouched: no schema/migrations, no API routes, no events, no analytics.

## Task 2 — Provider logout hardening (NEXT)
STATUS: NOT APPLICABLE IN THIS CHECKOUT — DEFERRED
- Finding carried from monorepo review: provider logout clears token and redirects only in
  `onSuccess`; on request failure or expired token, the local token remains and the provider may
  stay on the portal until an auth guard reacts.
- Acceptance criteria (apply wherever the auth code actually lives — monorepo, or here once
  auth exists):
  1. ALWAYS clear the local token/session, even when the logout request fails.
  2. Show a clean "You've been signed out" (or "Session expired") message on both success and
     failure paths.
  3. Redirect deterministically; never depend solely on `onSuccess`.
- This checkout currently has NO auth/logout code (template backend only) — verified 2026-08-11.
  Do not invent auth here just to "fix" it.

## Task 3 — Stale baseline cleanup
STATUS: SATISFIED FOR THIS CHECKOUT / OPEN FOR MONOREPO
- This `.agents` tree was created fresh pointing at the true current baseline (above), so no
  stale references exist here.
- In the monorepo, `.agents/NEXT_TASK.md` and older LOG entries referencing `3e76114` /
  `c02a308` should be marked HISTORICAL rather than deleted.

---

## Standing gate state (unchanged)
- Managed Gate B: BLOCKED — managed `DATABASE_URL` unavailable in this environment; local
  PostgreSQL does not qualify and none is installed.
- C-1: NOT EXECUTABLE — implementation, codegen, schema, persistence wiring, events, economics,
  credentials, and publication remain forbidden until preconditions are recorded as satisfied
  or the operator explicitly authorizes under the no-gate policy (LOG ENTRY-002) with a signed
  log entry.
