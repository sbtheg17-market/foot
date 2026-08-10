# plan.md — Neo → Next Handoff Continuation (Foot monorepo) — Phase 4B (LOCAL ONLY)

## 1) Objectives
- Record gate outcomes accurately (no secrets): **Gate A blocked**, **Gate B Exit 2 / UNVERIFIED**, missing gate artifacts unrecovered.
- Deliver a **local-only** Phase 4B web UI slice for provider readiness:
  - `/provider/readiness` page + canonical checklist
  - Dashboard card linking to page
  - Nav badge showing unresolved items (server-derived only)
- Maintain strict scope discipline: **no API/DB/schema/events/mobile/discovery/booking changes**, no generated-client modifications, no lockfile churn.
- Produce **one local code commit** + **patch** + **SHA-256**, then stop for review (no push).

**Updated status (all objectives met; stopped for review):**
- Repo verified at canonical `origin/main = 7c33672` and relocated to persistent path `/root/foot`.
- Gate A recorded as blocked (no secure GitHub auth channel; PAT forbidden; cleanup script missing); **no side effects**.
- Gate B recorded as environment-unavailable (no managed `DATABASE_URL`; verifier script missing); managed DB remains **UNVERIFIED**.
- Phase 4B implemented locally as a single reviewed candidate commit + patch + SHA-256; **not pushed**.
- Session 059 traceability drafted and committed locally as its own reviewed candidate commit + patch + SHA-256; `publish:gate` PASS; **not pushed**.

## 2) Implementation Steps

### Phase 1 — Core workflow POC (isolation) (required)
Core workflow = “Web can reliably render readiness state from server contract (GET `/providers/me/readiness`) and map reason codes to user-facing guidance without client-side re-derivation.”

User stories (POC)
1. As a provider, I want to see a loading state so I understand data is being fetched.
2. As a provider, I want to see a clear error state so I can retry if readiness fails to load.
3. As a provider, I want to be told I’m unauthorized (401) so I know to sign in.
4. As a provider, I want to be told I’m forbidden (403) so I know I lack provider access.
5. As a provider, I want to see a “Ready for clients” success state so I know I’m done.

Steps (COMPLETED)
- Confirmed source tree is `/root/foot` (persistent) and **verified** `origin/main` is pinned `7c33672`.
- Located and used generated client hook: `useGetMyProviderReadiness` for `GET /api/providers/me/readiness`.
- Proved the full state surface (loading/error/401/403/empty/ready/unready) using local dev validation and controlled local DB fixtures.
- Enumerated stable reason codes via generated types: `ProviderReadinessMissingCode`.

### Phase 2 — V1 app development (Phase 4B implementation)
User stories (V1)
1. As a provider, I want a dedicated **Readiness** page so I can complete setup in one place.
2. As a provider, I want plain-language explanations for missing requirements so I know what to do next.
3. As a provider, I want direct links to the right settings pages so I can fix gaps quickly.
4. As a provider, I want a progress summary so I can track what remains.
5. As a provider, I want a nav/dashboard indicator so I’m reminded to finish setup.

Steps (COMPLETED)
- Created branch: `phase4b-readiness-ui` from verified `origin/main` (`7c33672`).
- Added route: `/provider/readiness`.
- Implemented:
  - `PortalReadiness` page with loading/error/401/403/empty/ready/unready states and stable `data-testid` attributes.
  - `ReadinessChecklist` component rendering strictly from server-provided C1–C7 booleans and `missing` reason codes; no client-side re-derivation.
  - Centralized reason-code → plain-language + fix-link mapping: `artifacts/web/src/lib/readiness.ts` (includes graceful fallback for unknown future additive codes).
  - Compact dashboard summary card linking to readiness page.
  - Amber navigation progress badge (Dashboard tab) driven only by server-reported `missing.length` (mobile + desktop).
- Recorded discovered gap (no scope expansion): web portal currently has **no travel-zone management UI**; C5 `NO_SERVICE_AREA` fix link uses an interim destination (`/provider/profile`). Follow-up slice requires separate authorization.

Deliverable (local-only; NOT pushed)
- Commit: `7727bd2` (parent `7c33672`, tree `173a3da8…`).
- Patch: `/root/patches/0001-feat-web-provider-readiness-checklist-page-dashboard.patch`
- SHA-256: `abc263ad72f0eb529520428491bb8b39f3b3e286b8c5e49742b10d75eab5d5c7`
- Changed files: 8 files, all `artifacts/web/src/**`.

### Phase 3 — Add more features (explicitly out-of-scope placeholder)
User stories (future, not implemented)
1. As an admin, I want to see provider readiness across providers.
2. As a provider, I want notifications when readiness changes.
3. As a provider, I want guided onboarding flows per missing requirement.
4. As a provider, I want readiness history/audit.
5. As a provider, I want in-app document upload from the readiness page.

(No implementation in this handoff; keep as a placeholder only.)

### Phase 4 — Validation & packaging (must complete before review stop)
User stories (validation)
1. As a reviewer, I want assurance no forbidden areas changed.
2. As a reviewer, I want the patch to apply cleanly on top of `origin/main`.
3. As a reviewer, I want publish:gate to pass locally.
4. As a reviewer, I want stable screenshots to verify UI quickly.
5. As a reviewer, I want traceability notes stating what is verified vs blocked.

Steps (COMPLETED)
- Installed deps and ran:
  - `pnpm run typecheck` (workspace) ✅
  - `pnpm --filter @workspace/web run build` ✅
  - `pnpm --filter @workspace/api-server run build` ✅
- Ran server tests (LOCAL postgres only):
  - `test:provider-readiness` 14/14 ✅
  - `test:marketplace-events` 12/12 ✅
  - booking unit tests 63/63 ✅
- Verified scope:
  - No changes in `lib/api-spec`, `lib/db`, schema/migrations, OpenAPI, generated clients, lockfiles, `.emergent`, mobile, or api-server source.
  - `git diff --check` clean; allow-list file set confirmed.
- Captured Playwright screenshots (desktop 1920px + mobile 390px) into: `/root/phase4b-screenshots/`:
  - dashboard + readiness (incomplete), readiness (ready), readiness (403), readiness (logged-out redirect), and mobile views.
- Ran `publish:gate` on Phase 4B candidate with explicit allow-list + patch checksum:
  - 10/11 PASS; the single failure is expected due to the gate’s blanket forbidden-path rule for `artifacts/web/**` (UI publication requires an explicit managed-channel allow-list decision).

### Phase 5 — Local commits, patch, SHA, and traceability (STOP after)
User stories (handoff)
1. As a maintainer, I want one coherent commit for the UI changes.
2. As a maintainer, I want a patch file I can apply/review.
3. As a maintainer, I want SHA-256 for integrity.
4. As a maintainer, I want a Session 059 note capturing gate blocks and scope.
5. As a maintainer, I want zero claims of publication/push.

Steps (COMPLETED)
- Created **one** local commit for Phase 4B UI:
  - Commit `7727bd2` + patch + SHA-256 recorded above.
- Drafted and committed **Session 059** traceability on separate branch `session-059-traceability`:
  - Commit `3df802e` (parent `7c33672`).
  - Patch: `/root/patches/0001-docs-traceability-Session-059-main-verified-at-7c336.patch`
  - SHA-256: `1ffe7950ad9b2777a034406678096531e3ccf9edf9e435fb16dbb3e88d11056d`
  - `publish:gate` PASS (12/12) with no draft-status wording.
- Confirmed `origin/main` remained unchanged at `7c33672` after final fetch.
- Stopped for review; **no push performed**.

## 3) Next Actions
- **Recover original gate artifacts** (user-selected path):
  - `conflict-branch-cleanup.sh`
  - `verify-marketplace-events-catalog.sh`
  - `phase4b-readiness-ui-scope.md`
  Once received, checksum-verify against the recorded SHA-256 values and store them under an agreed repo location.

- When a secure managed publication environment is available:
  1) **Gate A re-attempt (branch cleanup)** using authenticated GitHub App / managed channel (no PAT in chat):
     - Tag `archive/conflict_070826_mc2` at `bed2e06`.
     - Delete ONLY the 9 authorized branches.
     - Do NOT touch `conflict_090826_1916` (out of scope).
     - Confirm `main` unchanged.
  2) **Gate B re-attempt (DB catalog)** using managed `DATABASE_URL` (never pasted):
     - Run the read-only catalog script in the managed environment.
     - Return only redacted output.

- **Publication sequencing (managed channel only):**
  - Two local candidates exist, both parented on `7c33672`:
    - Phase 4B UI commit `7727bd2` (requires explicit `artifacts/web/**` allow-list approval).
    - Session 059 traceability commit `3df802e` (docs-only; `publish:gate` PASS).
  - Whichever is published second must be rebased onto the new `origin/main` tip and re-verified with `publish:gate`.

- Follow-up slice (needs separate authorization):
  - Add a provider travel-zone management surface in web (to provide a real fix path for C5), and optionally mobile parity.

## 4) Success Criteria
- Gate status recorded exactly as decided (A blocked; B Exit 2/UNVERIFIED; artifacts unrecovered).
- `/provider/readiness` implemented with checklist, links, all states, and stable testids.
- Dashboard card + nav unresolved badge implemented (server-derived only).
- No forbidden files/areas changed; generated code unchanged; working tree clean after commits.
- Local validation passes (typecheck/build/tests + `publish:gate` for docs candidate; Phase 4B gate acknowledged as requiring explicit allow-list decision).
- Patch files + SHA-256 produced for both candidates; Session 059 drafted; **no push performed**.
