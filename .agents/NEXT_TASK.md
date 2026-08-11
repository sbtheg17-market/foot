# NEXT_TASK — current truth for this checkout

## Neo cycle 2 status — 2026-08-11 (see LOG ENTRY-014…019)

All five cycle-2 tasks are DONE in this checkout, each as one commit → one patch,
awaiting operator approval on /patches:

| Task | Patch | Status |
|---|---|---|
| Provider auth + sessions | `patches/AUTH_provider-signin.patch` | DONE + tested (ENTRY-015) |
| Bypass confinement (deploy-caveat closure) | `patches/AUTH_bypass-removal.patch` | DONE (ENTRY-016) |
| Consent scope picker | `patches/C4_consent-scope-picker.patch` | DONE + verified live (ENTRY-017) |
| Consent history (V3.1 addendum §11) | `patches/C5_consent-history.patch` | DONE + tested (ENTRY-018) |
| Patch approval filters | `patches/C6_patch-approval-filters.patch` | DONE + verified live (ENTRY-019) |

Full suite: 27/27 node:test fetch-against-BASE checks passing (auth 4, comfort 12,
consent-history 7, provider-auth 4).

DEPLOY CHECKLIST (unchanged in spirit, now enforced in code):
- Do NOT set `ALLOW_TEST_IDENTITY_HEADERS` in production (default is false).
- Set `APP_ENV=production` for the hard-stop guard (bypass refused regardless of flag).

Next candidates (each needs its own operator approval before work):
1. Operator review of the five pending cycle-2 patches (flip INDEX.json approvals).
2. Booking linkage: tie provider projections to an ACTIVE booking record instead of a
   free patient-id lookup (the contract's "active booking" allow-list made literal).
3. Consent text v2 flow: demonstrate the version-bump path end to end (grant under v2,
   history showing both versions).

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
STATUS: DONE + VERIFIED (LOG ENTRY-009 — 4/4 auth checks; full suite 16/16)
PATCH: patches/AUTH_patient-signin-logout.patch
- Hardened logout DONE in this checkout: token cleared in `finally`, "You've been signed out"
  feedback, server logout always 200. The monorepo B-prime caveat criteria are met here.

## Task D — Patch Index Page (operator priority 4)
STATUS: DONE (LOG ENTRY-010) — /patches page + GET /api/patches parsing real patch files
PATCH: patches/C3_patch-index-page.patch
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

## DEPLOY BLOCKER (from approval ENTRY-012)
- AUTH approved for dev/staging ONLY. Before any live deployment: remove or confine the
  X-Patient-Id / X-Provider-Id test bypass headers to non-production builds.

## Standing gate state (unchanged)
- Managed Gate B: BLOCKED — managed `DATABASE_URL` unavailable in this environment; local
  PostgreSQL does not qualify and none is installed.
- C-1: NOT EXECUTABLE — implementation, codegen, schema, persistence wiring, events, economics,
  credentials, and publication remain forbidden until preconditions are recorded as satisfied
  or the operator explicitly authorizes under the no-gate policy (LOG ENTRY-002) with a signed
  log entry.
