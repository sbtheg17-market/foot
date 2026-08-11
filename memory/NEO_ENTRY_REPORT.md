# OnCall Foot — Complete Marketplace Vision, Branch Reconciliation, Roadmap, and Current-State Report

**Neo Entry Report — 2026-08-11 (Reconnaissance cycle 2, "recon-report-2")**
**Prepared by:** Neo (E2 Agent)
**Method:** Fresh full clone of `github.com/sbtheg17-market/foot` (all 27 refs), live `git ls-remote` verification at task start AND at report time, per-branch merge-base + root-lineage analysis, tree/stack fingerprinting of all 26 conflict branches, code-surface inspection of `origin/main` (routes, pages, screens, schema, 17 test suites), ledger reconstruction (`.agents/LOG.md` Sessions 001–067), docs corpus (19 files), recovery of the prior reconnaissance workspace's own report and the Comfort-Wiring patch index from `conflict_110826_1322`, and a repo-wide auth-bypass grep.
**Mode:** Reconnaissance and synthesis only. **Nothing was merged, pushed, rewritten, deleted, or modified in the target repository.** The clone lives read-only at `/app/recon/foot`.

---

## 1. Executive Overview

OnCall Foot is a three-portal, mobile-first marketplace OS for in-home foot care ("*The right care. At your door. Right now.*"). The canonical implementation lives **only** on `origin/main` of `sbtheg17-market/foot`: a **pnpm / Node 24 / Express 5 / TypeScript 5.9 / PostgreSQL+Drizzle / React 19+Vite / Expo monorepo at ~85% MVP**. The Provider Portal and the client booking journey are live and heavily tested (92+ core tests across 17 suites); the Admin surface is real but narrow (verification queue + application approve/reject); payments/monetization are deliberately deferred by design.

The repository now carries **26 `conflict_*` branches** (one more than the accepted inventory v6 on main). **None is mergeable.** Only `conflict_070826_mc2` shares history with main and it is fully superseded (verified by `git cherry`). The other 25 have **no merge base** and split into five distinct root lineages: two are the **original OnCall Foot FastAPI/MongoDB era** (historical, superseded by the TS rebuild), and three are successive **Emergent agent workspaces** that carried OnCall Foot patch artifacts and then evolved into the separate **Comfort-Wiring** consent-first project — culminating in `conflict_110826_1322`, the snapshot of the immediately preceding reconnaissance workspace.

**Three findings are new versus everything recorded on main:**
1. `conflict_110826_1322` (pushed 2026-08-11 17:23, *after* main's last commit) preserves the complete Comfort-Wiring cycle-2 build (27/27 tests), 11 one-task→one-patch artifacts with a signed approval index, the prior Neo marketplace report, **and `docs/comfort-profile/PHASE_4C_COMFORT_PROFILE_CONTRACT_V3.md` — the exact artifact Sessions 065/066 declared absent and blocking Phase 4C.** The blocker is now recoverable from a preserved ref (an actual document, not prose reconstruction), pending operator approval.
2. Main's accepted **inventory v6 is stale** (25 branches counted; 26 exist). Any branch-cleanup authorization must be re-issued against a v7 inventory.
3. Inventory v6's blanket label "24 unrelated Emergent FARM lineages (Comfort-Wiring family)" is **imprecise**: the four oldest foreign branches (Jul 31 / Aug 1) are the **original OnCall Foot FastAPI/Mongo implementations** ("Foot-Care Marketplace OS"), not Comfort-Wiring. The classification below corrects this. The operational conclusion is unchanged — reference only, never merge.

---

## 2. Repository Identity (verified live at task start and re-verified at report time)

| Field | Value |
|---|---|
| Repository | `github.com/sbtheg17-market/foot` (public read access confirmed) |
| Canonical branch | `main` |
| **Current HEAD SHA** | `b20087d13eb77ad3da0b60efc88d4e768f68134d` |
| HEAD date | 2026-08-11 16:29:48 +0000 |
| HEAD author | Neo Connector `<neo-connector@oncallfoot.local>` |
| HEAD message | "conflict-branch inventory v6: all 25 archival branches classified so no agent ever merges foreign code" (docs-only, Session 067) |
| Worktree sync | Fresh clone at `/app/recon/foot`; `git status` clean, up to date with `origin/main`; re-fetch at report time showed **no drift** |
| Stack | pnpm workspace · Node ≥20 (Node 24 target) · TypeScript ~5.9.3 · Express 5 · PostgreSQL + Drizzle 0.45 · React 19 + Vite 7 · Expo · OpenAPI 3.1 + Orval codegen · Zod 4 · Replit/Railway/Nixpacks deploy config |
| Remote refs | 27 total: `HEAD→main`, `main`, **26 × `conflict_*`** — no `feature/*`, `phase/*`, `patch/*`, or `recovery/*` refs exist |

No stale SHA from prior handoffs (`3e76114`, `c02a308`, `184833b`, `401a9d7`) is current; each is an ancestor in main's fast-forward-only chain.

---

## 3. Full Branch Inventory (all 26 conflict branches inspected)

Method per branch: tip SHA/date/author/message, `git merge-base` vs main, `git rev-list --count` unique commits, root commit (`--max-parents=0`), `git ls-tree` top level, stack fingerprint (pnpm-workspace.yaml vs `backend/requirements.txt` FastAPI/Motor/Mongo), content sampling.

**Five distinct root lineages exist among the 25 no-merge-base branches:**

| Lineage root | Branches | Identity |
|---|---|---|
| `11c2276` (2026-07-25) | conflict_310726_1942, conflict_310726_2216 | **Original OnCall Foot FastAPI/MongoDB Provider Portal v0** — `backend/app/{core,db,models,repositories,routers}`, provider auth with httpOnly-cookie JWT + brute-force lockout, onboarding wizard, services/bookings/earnings/invoices/reviews feature folders, `auth_testing.md` playbook. Matches the PRD's "Python/FastAPI + MongoDB phase" verbatim. |
| `b720fae` | conflict_010826_0008, conflict_010826_0036 | **OnCall Foot FastAPI "Foot-Care Marketplace OS" Phase 2** — `server.py` titled "Foot-Care Marketplace OS", `opportunities.py`, `sms.py`, `storage_client.py`, marketplace/phase-2 pytest suites. Still FastAPI/Mongo-era OnCall Foot. |
| `d0aeb89` | conflict_060826_2025, conflict_080826_1307 | **Emergent work-transfer workspaces for OnCall Foot patches** — contain `external/foot` as a **git submodule (gitlink → `fa973a8`)** plus root-level OnCall Foot patch artifacts: `phase1-mc1..mc4.patch`, `seed-script-hygiene.patch`, `baseline-test-drift.patch`. |
| `66e9b96` | 16 branches: conflict_090826_0856 → conflict_110826_0846 | **Successive Emergent agent/continuation workspaces.** Early ones carry OnCall Foot phase-2 patch artifacts (`phase2-mc9-commit1..3` reviewer decisions, marketplace-events / notification-feed patches); middle ones are Neo continuation/audit workspaces (`plan.md` Phase 4B local slice, `handoff/`, `repo_audit/`, `audit/`, HANDOFF-README + SHA256SUMS); the last (`conflict_110826_0846`) is the **definitive Comfort-Wiring recovery workspace** (`recovery/COMFORT_WIRING_PLAN.md` v1.1, Gate-B runbook, acceptance records, phase4c_r3 candidate manifests). |
| `efbf7ec` (2026-08-11 03:22) | conflict_110826_1112, conflict_110826_1134, conflict_110826_1322 | **Comfort-Wiring implementation workspaces** — FastAPI/MongoDB backend + React frontend + `patches/` + `docs/comfort-profile/PHASE_4C_COMFORT_PROFILE_CONTRACT_V3.md` + `.agents/LOG.md` (ENTRY-001…019). 1112 = cycle 1; 1134 = +provider auth begins cycle 2; **1322 = complete cycle 2 + patch INDEX.json + the prior Neo marketplace report** (`memory/NEO_ENTRY_full_marketplace_report.md`). |

**Full per-branch table (sorted by actual tip commit date, newest first):**

| # | Branch | Tip | Tip date (UTC) | Tip author | Unique commits | Merge base | Lineage | Classification |
|---|--------|-----|----------------|-----------|----------------|------------|---------|----------------|
| 1 | **conflict_110826_1322** | 93cf393 | 08-11 17:23 | emergent-agent-e1 | 8 (full) | **none** | efbf7ec | **3 — Comfort-Wiring (NEWEST; cycle 2 + patches + Phase 4C contract + prior Neo report). NOT in inventory v6** |
| 2 | conflict_110826_1134 | 0fa8ffc | 08-11 15:35 | emergent-agent-e1 | 18 (full) | none | efbf7ec | 3 — Comfort-Wiring (cycle 2 start) |
| 3 | conflict_110826_1112 | c687c8f | 08-11 15:12 | emergent-agent-e1 | 15 (full) | none | efbf7ec | 3 — Comfort-Wiring (cycle 1) |
| 4 | conflict_110826_0846 | 39965b0 | 08-11 12:47 | emergent-agent-e1 | 12 (full) | none | 66e9b96 | 3 — Comfort-Wiring (recovery plan v1.1, definitive) |
| 5 | conflict_100826_2258 | 12c8863 | 08-11 02:58 | emergent-agent-e1 | 8 (full) | none | 66e9b96 | 5→resolved: agent audit workspace (`audit/`, `handoff/`) — reference only |
| 6 | conflict_100826_2113 | b9d2722 | 08-11 01:14 | emergent-agent-e1 | 7 (full) | none | 66e9b96 | agent continuation workspace (`handoff/`, `repo_audit/`) |
| 7 | conflict_100826_1941 | 9a752ae | 08-10 23:41 | emergent-agent-e1 | 8 (full) | none | 66e9b96 | agent continuation workspace |
| 8 | conflict_100826_1738 | 1eefbfd | 08-10 21:39 | emergent-agent-e1 | 6 (full) | none | 66e9b96 | agent continuation workspace (`handoff/`) |
| 9 | conflict_100826_1543 | 9e9a3ee | 08-10 19:44 | emergent-agent-e1 | 3 (full) | none | 66e9b96 | agent workspace; nested `foot/` dir; Session-063 lost-candidate recovery source |
| 10 | conflict_100826_1415 | 27a5ada | 08-10 18:15 | emergent-agent-e1 | 8 (full) | none | 66e9b96 | agent workspace (+`.agents/`) |
| 11 | conflict_100826_1234 | f9d0b7e | 08-10 16:34 | emergent-agent-e1 | 21 (full) | none | 66e9b96 | agent workspace |
| 12 | conflict_100826_0906 | 018e69b | 08-10 13:07 | emergent-agent-e1 | 8 (full) | none | 66e9b96 | agent workspace |
| 13 | conflict_100826_0813 | 8cc0028 | 08-10 12:14 | emergent-agent-e1 | 5 (full) | none | 66e9b96 | agent workspace |
| 14 | conflict_090826_2326 | 73bdad6 | 08-10 03:26 | emergent-agent-e1 | 9 (full) | none | 66e9b96 | agent workspace |
| 15 | conflict_090826_2136 | 7f7cfaa | 08-10 01:36 | emergent-agent-e1 | 5 (full) | none | 66e9b96 | Neo Phase-4B local-slice workspace (`plan.md`: readiness UI, one-commit+patch, stopped for review — that work later landed on main as `b3937a7`) |
| 16 | conflict_090826_1916 | 81014b0 | 08-09 23:16 | emergent-agent-e1 | 13 (full) | none | 66e9b96 | handoff workspace (HANDOFF-README, conflict-branch-inventory.md, SHA256SUMS) |
| 17 | conflict_090826_1718 | c3589b1 | 08-09 21:18 | emergent-agent-e1 | 14 (full) | none | 66e9b96 | OCF patch-carrier (marketplace-events / notification-feed patch artifacts) |
| 18 | conflict_090826_1405 | 60979db | 08-09 18:05 | emergent-agent-e1 | 12 (full) | none | 66e9b96 | OCF patch-carrier (same series) |
| 19 | conflict_090826_0856 | 7110dc9 | 08-09 12:56 | emergent-agent-e1 | 10 (full) | none | 66e9b96 | OCF patch-carrier (`phase2-mc9-commit1..3` reviewer-decision patches) |
| 20 | conflict_080826_1307 | 305fd86 | 08-08 17:08 | emergent-agent-e1 | 21 (full) | none | d0aeb89 | OCF patch-carrier (`phase1-mc1..4`, seed-hygiene, baseline-drift patches; `external/foot` submodule) |
| 21 | **conflict_070826_mc2** | **bed2e06** | **08-08 13:28** | **sbtheg17-market** | **5** | **`54534b0b`** | foot | **2 — OnCall Foot, historical reference only (superseded; see §5)** |
| 22 | conflict_060826_2025 | 058cf6e | 08-07 00:26 | emergent-agent-e1 | 6 (full) | none | d0aeb89 | OCF work-transfer workspace (`external/foot` submodule) |
| 23 | conflict_010826_0036 | 0c7bd7b | 08-01 04:36 | emergent-agent-e1 | 11 (full) | none | b720fae | **2 — OnCall Foot FastAPI era, historical reference only** ("Foot-Care Marketplace OS" phase 2) |
| 24 | conflict_010826_0008 | a5638c5 | 08-01 04:09 | emergent-agent-e1 | 9 (full) | none | b720fae | 2 — OnCall Foot FastAPI era, historical |
| 25 | conflict_310726_2216 | 5e85263 | 08-01 02:17 | emergent-agent-e1 | 14 (full) | none | 11c2276 | 2 — OnCall Foot FastAPI era, historical (Provider Portal v0) |
| 26 | conflict_310726_1942 | ffe8515 | 07-31 23:43 | emergent-agent-e1 | 12 (full) | none | 11c2276 | 2 — OnCall Foot FastAPI era, historical (Provider Portal v0) |

All 25 foreign tips carry the subject "Auto-generated changes" — automated Emergent workspace snapshots, not curated commits. Chronological branch names do **not** prove continuity: five independent root histories exist.

---

## 4. Branch Chronology — how the snapshots map to the project timeline

1. **Jul 25–Aug 1:** OnCall Foot v0 built on FastAPI/MongoDB (Provider Portal, then "Marketplace OS" phase 2 with opportunities/SMS). Snapshotted as the four oldest branches. This implementation was later **fully rebuilt** on the TS/Postgres stack (the PRD carries an explicit stack note).
2. **Jul 28 onward (main):** the canonical TS monorepo begins its Replit bring-up (Session 001) and evolves through Session 067 — this is the only lineage that became `main`.
3. **Aug 6–9:** Emergent workspaces produce OnCall Foot patch series (phase-1 MC1–MC4, phase-2 MC9, marketplace-events, notification feed) delivered to main via the reviewed patch channel; their workspaces were auto-snapshotted (branches #17–20, #22).
4. **Aug 9–11:** Neo continuation/audit/handoff workspaces (branches #5–16), including the local Phase-4B readiness-UI slice that later landed on main as `b3937a7`.
5. **Aug 11:** Comfort-Wiring recovery (#4) and implementation cycles (#1–3) — a deliberately **separate project** per the operator's repo-separation decision (CW ledger ENTRY-013) and main's `docs/neo-handoff-scope.md`.

---

## 5. Conflict Classification Summary

- **1 — OnCall Foot, safe candidate for review:** **none.** Nothing on any branch is ahead of main in a usable way.
- **2 — OnCall Foot, historical reference only (5 branches):**
  - `conflict_070826_mc2` — the only branch with a merge base (`54534b0b`; 5 unique commits, 46 behind). `git cherry` re-verified this session: feature commit `5f9992e` ("onboarding: expose provider application status via dedicated API") is **patch-equivalent on main (`-`)**; the other 4 commits are patch artifacts (`attached_assets/*.patch`) and handoff notes. Optional docs-only salvage: `docs/phase1-mc2-handoff.md` (47 lines, absent from main). Never cherry-pick `f6df78e`/`bce9735` (both touch the diverged `.agents/LOG.md`).
  - `conflict_310726_1942`, `conflict_310726_2216`, `conflict_010826_0008`, `conflict_010826_0036` — the superseded FastAPI/Mongo OnCall Foot era (**correction to inventory v6**, which lumped them into "Comfort-Wiring family"). No merge base; reference only.
- **3 — Comfort-Wiring, separate project (4 branches):** `conflict_110826_0846` (recovery), `conflict_110826_1112`, `conflict_110826_1134`, `conflict_110826_1322` (implementation cycles; 1322 is canonical/newest).
- **Agent work-transfer / audit workspaces (16 branches):** d0aeb89 + 66e9b96 lineages (minus 0846) — FARM-templated Emergent workspaces that carried OnCall Foot patch artifacts or audit/handoff records. Every patch artifact they carry corresponds to work already published on main (verified for mc2 by `git cherry`; asserted and cross-checked for the MC/phase-2 series by inventory v6 + the session ledger). Reference/forensics only.
- **4 — Unrelated project:** none. **5 — Unknown:** none remaining.

**For every no-merge-base branch: do not merge, do not cherry-pick blindly.** Anything valuable must be ported stack-natively (new Drizzle models, Express routes, React/Vite components, tests, one-task→one-patch commit).

---

## 6. Handoff & Log Chronology (Sessions 001–067 + Comfort-Wiring ENTRY-001–019)

`.agents/LOG.md` on main (2,364 lines) is the canonical ledger. Condensed by era:

| Era | Sessions | Dates | What happened |
|---|---|---|---|
| **Genesis (pre-repo)** | — | Feb 2026 | PRD authored during the FastAPI/Mongo phase (provider auth, onboarding wizard, RBAC scaffolding, portal shell). Later fully rebuilt; PRD retained with a stack note. |
| **Replit bring-up** | 001–005 | 07-28 | GitHub import; pnpm install; Drizzle schema → PostgreSQL (10 tables); portability hardening; agent handbook + rules. |
| **Core build-out** | 006–018 | 08-04 → 08-06 | Auth/JWT/RBAC; providers, services, availability, travel zones; bookings + strict state machine (63 unit tests); reviews; invoices; notifications (SSE + Expo push); seed; single-service deploy. Session 018 (4 checkpoints): availability preset, booking filters, tap-to-reach, earnings export — commits `49d049c`, `9730a7f`, `183c255`, `94d629b`. |
| **Client activation** | 019–041 | 08-06 → 08-07 | Provider trust checklist; client portal activation (role-gated booking); client booking list/detail; role-aware migration (`account_roles`, `provider_applications`) Phases 1–3 — DB-backed authorization. |
| **Onboarding MC-series** | 042–052 | 08-08 → 08-09 | Application submit/approve/reject/reset/resubmit (MC1–MC4); status API (8/8, 11/11, 9/9); submission-history API + web + mobile timelines (MC5–MC7, 11/11); reviewer decisions + transactional notifications (MC9, 14/14); provider notifications APIs (MC8-lite, 12/12); web notification feed + unread badge (MC10). |
| **Activation track + governance** | 053–062 | 08-09 → 08-10 | Provider Activation & First Booking checkpoint: Phase 1 `marketplace_events` schema, Phase 2 readiness API (`4bb0e00`), Phase 3 event emission (`cf689b5`, six-file scope, tree-verified). Publication gate `scripts/verify-publication.sh` (`5853768`) + `--approve-web-ui` flag (`47df77e`). Phase 4B readiness web UI published (`b3937a7`, 9 files, patch SHA-256 recorded). Deploy-key MCP publication channel established; key revoked after window. |
| **Takeover + mismatch record** | 063–066 | 08-10 → 08-11 | New lineage verified from `3e76114`; lost candidates recovered from snapshot `conflict_100826_1543`; Comfort-Wiring Neo-report mismatch documented (`docs/neo-handoff-scope.md`); **Phase 4C contract/shell recorded ABSENT from this repo**; B-prime logout audit; baselines reconciled `184833b` → `401a9d7`. |
| **Inventory** | 067 | 08-11 | Conflict-branch inventory v6 (25 branches) published via authenticated deploy-key channel → HEAD `b20087d`. **Already stale: branch #26 (`conflict_110826_1322`) appeared at 17:23.** |

Known ledger defects (recorded, grandfathered by the gate): duplicate/non-monotonic session numbers (011, 018×4, 021–023×2, 036×2); Session 056 header published with "LOCAL DRAFT" wording.

**Parallel Comfort-Wiring ledger** (on `conflict_110826_1322` at `.agents/LOG.md`, ENTRY-001–019, all 2026-08-11): blocked entry report → operator policy + task authorization → provenance-conflict record → Phase 4C contract+shell restoration → comfort-profile API (12/12) → provider projection card → patient auth + hardened logout → patch index page → E2E validation → **ENTRY-012 signed operator (Deep Research) approvals** (incl. the AUTH dev/staging bypass caveat) → ENTRY-013 repo-separation decision → **cycle 2** (ENTRY-014–019): provider auth + sessions, bypass confinement closing the ENTRY-012 caveat, consent scope picker, consent history (contract V3.1 addendum §11), patch approval filters — **27/27 backend checks**.

---

## 7. Approved-Build Synopsis

**OnCall Foot — all approved builds are already on main; none require porting:**

| Build | Commit(s) on main | Test evidence | Status |
|---|---|---|---|
| Auth/JWT/RBAC + role-aware migration Phases 1–3 | core-era chain | test:authorization, test:role-state | on main, green |
| Booking state machine + concurrency + pressure | core era | 63 + 16 + 13 | on main, locked (do not regress) |
| Session-018 quartet (preset/filters/tap-to-reach/earnings export) | `49d049c` `9730a7f` `183c255` `94d629b` | 95 green at the time | on main |
| Provider application lifecycle MC1–MC7 | incl. `0afb3ff`+`92d001f`, `917361d` | 8/8, 11/11, 9/9, 11/11, 23/23 | on main |
| MC9 reviewer decisions + notifications | split-published, tree-verified | 14/14 | on main |
| MC8-lite provider notification APIs + MC10 web feed/badge | published | 12/12 + manual screenshots | on main |
| Activation Phases 1–3 (`marketplace_events`, readiness API, event emission) | `d7a5999` → `4bb0e00` → `cf689b5` | readiness 14/14, events 12/12 | on main; **Phases 4–7 gated on Gate B** |
| Publication gate + `--approve-web-ui` | `5853768`, `47df77e` | functional re-verification | on main |
| Phase 4B readiness web UI (+ `/provider/travel-zones`) | `b3937a7` | patch SHA-256 `31cbfcf1…` | on main |
| Inventory v6 (docs-only) | `b20087d` (HEAD) | gate PASS | on main — **superseded by this report's 26-branch findings** |
| `conflict_070826_mc2` feature commit | `5f9992e` ≡ on main | `git cherry` re-verified this session | superseded |

**Comfort-Wiring — separate project; approved in ITS ledger only; NONE may be applied to OnCall Foot main (stack-native port only):**

| Patch (on `conflict_110826_1322:patches/`) | Approval status |
|---|---|
| PHASE_4C_restoration / PHASE_4C_comfort-profile-api / PHASE_4C_provider-projection-card / C3_patch-index-page | **Approved** (Deep Research, ENTRY-012) |
| AUTH_patient-signin-logout | **Approved dev/staging with CAVEAT** (test-identity bypass must never reach production) |
| PROCESS_patch-approvals | Recorded |
| AUTH_provider-signin / AUTH_bypass-removal / C4_consent-scope-picker / C5_consent-history / C6_patch-approval-filters | **Pending operator review** (submitted with cycle 2, ENTRY-015–019; 27/27 backend + browser-verified) |

A patch approved in the Comfort-Wiring project is **not** thereby applicable to OnCall Foot — different stack, different repo history, explicit repo-separation decision.

---

## 8. Provider Portal — Current Status (evidence: `artifacts/api-server/src/routes/`, `artifacts/web/src/pages/portal/*`, 17 test suites, ledger)

| Area | Status | Evidence / notes |
|---|---|---|
| Sign-up / sign-in / logout / sessions | **COMPLETE** | `auth.ts`: register/login/me/logout; JWT HS256 + bcrypt; shared role-intent signup; server-confirmed redirects; failed-logout cleanup edge documented, unimplemented (B-prime caveat) |
| Onboarding & application lifecycle | **COMPLETE** | web+mobile onboarding pages; draft→submit→review→approve/reject→reset→resubmit; status API with `nextAction` + `canEdit`/`canReset`/`canResubmit`; submission-history timelines web+mobile |
| Verification & trust | **COMPLETE (core)** | `verificationStatus` gates public discoverability (unapproved providers' services never publicly listed); readiness checklist C1–C7 at `/provider/readiness` + dashboard card + nav badge |
| Profile | **COMPLETE** | `portal/profile.tsx`, `portal/credentials.tsx`; trust checklist + completion progress; public profile parity |
| Services CRUD | **COMPLETE** | `portal/services.tsx`; list/create/edit/toggle/soft-delete; prices in cents (locked convention) |
| Availability + preset | **COMPLETE** | weekly grid + one-tap 9–5 weekday preset (test:availability 3/3) |
| Travel zones | **COMPLETE (list/add/remove)** | `portal/travel-zones.tsx`; no update endpoint by contract |
| Bookings inbox | **COMPLETE** | `portal/bookings.tsx` + booking-detail; status-chip filters + counts; strict transitions; tap-to-call/tap-to-map; today section |
| Private post-visit notes | **COMPLETE (privacy-verified)** | `careNotes` never rendered to clients (regression-tested) |
| Earnings + statement | **COMPLETE (no payments)** | `portal/earnings.tsx` + printable `earnings-statement.tsx` (print-to-PDF); derived from completed bookings only |
| Invoices | **COMPLETE (records)** | auto-created on `confirmed`; `pending→paid` reserved for future Stripe |
| Notifications | **COMPLETE (in-app web)** | MC8-lite APIs; `/provider/notifications` feed + unread badge (99+ cap); SSE + Expo push infra present; email outbox **gated, not built** |
| Mobile parity (Expo) | **PARTIAL** | discover/bookings/account/provider/auth/onboarding/application-status present; mobile notification feed **gated, not started** |

## 9. Client Portal — Current Status

| Area | Status | Notes |
|---|---|---|
| Sign-up / sign-in / logout / role enforcement | **COMPLETE** | shared signup with additive `roleIntent` (never an authorization claim); client-only booking access enforced |
| Discovery | **COMPLETE (core)** | public browse + provider profiles without an account (`discover.tsx`, `provider-profile.tsx`); verified-only surfacing; no geo-distance sort yet |
| Provider profile + service catalog | **COMPLETE** | avatars, credentials, availability-for-new-clients, service notes |
| Booking flow | **COMPLETE** | choose provider/service/time → request; unauthenticated → sign-in routing |
| Booking status / history / detail | **COMPLETE (first slice)** | upcoming/past/cancelled; role-safe detail; server-owned status labels; refresh on mount/focus/reconnect |
| Cancel / reschedule | **PARTIAL** | cancel works; cancellation-confirmation + duplicate-submit protection queued; `rescheduled` exists in the state machine, no client UI |
| Reviews | **PARTIAL** | backend POST/GET complete (completed-booking + one-per-booking validation, green); client review UI slice queued |
| Care history | **COMPLETE (bounded)** | client-safe bounded history (test:care-history) |
| Comfort & consent preferences | **NOT STARTED on OnCall Foot — SEPARATE PROJECT** | full reference implementation on `conflict_110826_1322` (Comfort-Wiring); Phase 4C contract V3 recovered there; stack-native port required |
| Client notifications | SCAFFOLDED | SSE/push infra exists; no client-facing feed |
| Support / report-block / account deletion | NOT STARTED | `support.ts` schema exists; no routes/UI for clients |

## 10. Admin / Operations Portal — Current Status (no overclaiming; actual code only)

- **Admin auth/role:** COMPLETE — `requireRole("admin")`, DB-backed via `account_roles`; demo admin seeded.
- **Provider verification queue:** COMPLETE — `GET /api/admin/verification/queue` (status filter, pagination) + `PATCH /api/admin/verification/docs/:docId`; web page `pages/admin/verification.tsx`.
- **Application reviewer decisions:** COMPLETE — `POST /api/admin/provider-applications/:id/approve|reject`; transactional decision notifications; self-review prevention; 14/14 tests.
- **Everything else** — client management, booking oversight, disputes, support responses, taxonomy management, commissions, subscriptions, payouts, analytics dashboards, audit-log UI: **NOT STARTED** (roadmap only). The append-only `marketplace_events` table (Phases 1–3) is the future audit/analytics substrate; the funnel-report API is gated Phase 4G.

## 11. Shared Auth / RBAC Status

- **Implemented roles:** `client`, `provider`, `admin` — DB-backed membership in `account_roles`; `users.role` is a compatibility context field. PRD's future roles (`support_agent`, `compliance_reviewer`, `finance_admin`, `marketplace_manager`) are **named only — not scaffolded** in the TS code.
- **Guards:** `requireAuth` (re-validates the user against PostgreSQL, not just the JWT), `requireRole`, approved-provider gate (application AND verification both approved), owner-scoping on all provider-application surfaces. JWT HS256 bearer; logout present; `reviewerNotes` never leaves the server (regression-tested).
- **Bypass audit on main (this session):** grep for `X-Patient-Id`, `X-Provider-Id`, `test bypass`, `mock user`, `demo user`, `auth override`, `skip auth`, `dev auth`, `impersonation` across `artifacts/`, `lib/`, `scripts/` → **zero auth bypasses in application code.** Single hit: a comment in `seed.ts` about demo users (seeded demo accounts `*@oncallfoot.com` / `demo1234` — dev/demo data, not an auth path).
- **Bypass audit, Comfort-Wiring (separate project):** `X-Patient-Id`/`X-Provider-Id` exist by design as a documented test bypass — cycle 2 confined it: `ALLOW_TEST_IDENTITY_HEADERS` defaults false AND a hard production refusal (`APP_ENV/ENVIRONMENT=production`) regardless of the flag (AUTH_bypass-removal.patch, pending operator review). Satisfies the "non-production build condition" requirement; the flag must stay unset in any production environment.

## 12. Comfort / Consent Status

- **Comfort-Wiring (separate project, canonical state on `conflict_110826_1322`):** complete for its slice — six contract operations (grant 201/400; withdraw/delete separate, each 404-capable; GET profile; PUT 409-on-inactive-consent; provider projection strictly 404-only, no 403 anywhere) plus the V3.1 owner-scoped `getConsentHistory`; versioned + SHA-256-hashed append-only consent rows; per-category scope picker (notes free-text OFF by default); projection filtered to granted scope; real patient + provider auth with hardened logout; bypass confinement; 27/27 node:test + browser-verified. One known MEDIUM frontend bug at snapshot time: patient registration redirect on /signin (provider path works; fix was queued).
- **OnCall Foot main:** **NOT STARTED / DESIGN ONLY.** Phase 4C has a standing contract-only approval (SHA-256 `1fa0eec…` recorded in NEXT_TASK). Sessions 065/066 recorded the contract/shell as absent and blocked implementation. **NEW:** the actual `PHASE_4C_COMFORT_PROFILE_CONTRACT_V3.md` is preserved on `conflict_110826_1322` — recoverable as a real document (not prose reconstruction), which materially changes the Phase 4C precondition, subject to operator approval and Gate B.
- **Correct integration path (unchanged):** stack-native port — additive Drizzle models honoring the two-store rule, Express routes preserving the exact 201/400/404/409/404-only semantics, React/Vite shell + scope picker + history timeline, node:test suites, one-task→one-patch, publication gate. The "booking-only provider projection" maps naturally onto OnCall Foot's real bookings (ACTIVE-booking allow-list becomes literal). Never merge the FastAPI/Mongo implementation.

## 13. Booking & Marketplace Status

Centralized, hardened state machine (`booking-state-machine.ts`): 6 statuses, strict transition matrix, admin override; 63 unit + 16 concurrency + 13 pressure tests. Auto-invoice on confirm. Client-safe bounded history. Marketplace-events substrate published (Phases 1–3, append-only, erasure-friendly FKs); **Phases 4–7 (booking enforcement → flagged discovery gating → funnel-report API → validation) BLOCKED on Gate B** (managed `DATABASE_URL` never verified). Discovery is browsable pre-auth; readiness + verification gate provider surfacing.

## 14. Earnings / Invoice / Payment Status

Earnings **COMPLETE** (derived from completed bookings only; today/week/month; printable statement). Invoices **COMPLETE as records** (auto-create on confirm; `paid` reserved). Payments, payouts, commissions, subscriptions, featured placement: **DESIGN ONLY** (`docs/future-monetization.md`) — explicitly deferred; no Stripe anywhere by locked decision. Prices in cents everywhere.

## 15. Test & Deployment Status

- **Test surface on main:** 17 suites in `artifacts/api-server/src/__tests__/` (state machine, concurrency, pressure, availability preset, authorization hardening, role state, care history, reviews, provider application ×5, reviewer decisions, provider notifications, readiness, marketplace events). Historic full-matrix evidence: 63/63, 16, 13, 3/3, 8/8, 9/9, 11/11, 11/11, 23/23, 7/7, 14/14, 12/12, 12/12, 14/14. Last recorded full validation (Session 065): Corepack-pinned frozen install, typecheck, build, 63/63, four managed workflows, API/web HTTP 200, 390px preview — green. **No web/mobile automated test framework** (deferred; web verified via manual screenshots). *Note: suites were not re-run during this read-only reconnaissance.*
- **Deployment:** single Node service (Express serves `/api/*` + built SPA); Railway/Nixpacks/Procfile/.replit present; portability documented. **Gate B — managed-database verification — remains UNVERIFIED and is the standing deployment blocker** for activation Phases 4–7, production event writes, and any future migration (incl. Phase 4C).
- **Publication governance:** `pnpm run publish:gate` (`scripts/verify-publication.sh`) enforces parent identity, fast-forward-only ancestry, single non-merge commit, allow-list scope, hard-forbidden paths, tree identity, patch checksum, session numbering; `--approve-web-ui` covers `artifacts/web/**` only. Deploy-key channel exists; write access is windowed and was revoked after the last use (main's ledger) — the prior recon workspace held its own deploy key (`NEO_GITHUB_CONNECTOR.md` on branch 1322), whose current validity is UNKNOWN from this workspace.

## 16. Roadmap Completion Matrix

Statuses: COMPLETE · PARTIAL · SCAFFOLDED · DESIGN ONLY · BLOCKED · NOT STARTED · SEPARATE PROJECT · UNKNOWN

| Product area | Provider | Client | Admin | Backend | Frontend | DB | Tests | Roadmap | Recommended next action |
|---|---|---|---|---|---|---|---|---|---|
| Authentication | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | done | logout-failure cleanup edge (documented) |
| RBAC | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | COMPLETE | done | future roles stay PRD-only until needed |
| Provider profile | COMPLETE | n/a | read | COMPLETE | COMPLETE | COMPLETE | COMPLETE | done | — |
| Client profile | n/a | PARTIAL | NOT STARTED | PARTIAL | PARTIAL | COMPLETE | PARTIAL | queued | client settings surface |
| Services | COMPLETE | read | read | COMPLETE | COMPLETE | COMPLETE | COMPLETE | done | service templates (future) |
| Categories / taxonomy | PARTIAL | PARTIAL | NOT STARTED | PARTIAL | PARTIAL | PARTIAL | UNKNOWN | future | admin taxonomy management |
| Availability | COMPLETE | visibility | n/a | COMPLETE | COMPLETE | COMPLETE | COMPLETE | done | booking-slot compatibility (future) |
| Travel zones | COMPLETE | n/a | n/a | COMPLETE | COMPLETE | COMPLETE | COMPLETE | done | update endpoint intentionally absent |
| Bookings | COMPLETE | COMPLETE (slice) | NOT STARTED (oversight) | COMPLETE | COMPLETE | COMPLETE | COMPLETE | active | cancel-confirm + duplicate-submit protection |
| Booking state machine | COMPLETE | COMPLETE | override | COMPLETE | n/a | COMPLETE | COMPLETE (92) | locked | do not regress |
| Notifications | COMPLETE (web in-app) | SCAFFOLDED | NOT STARTED | COMPLETE | PARTIAL | COMPLETE | COMPLETE | gated | mobile feed → email outbox → push |
| Invoices | COMPLETE | view | NOT STARTED | COMPLETE | COMPLETE | COMPLETE | PARTIAL | done | paid status with future Stripe |
| Earnings | COMPLETE | n/a | NOT STARTED | COMPLETE | COMPLETE | COMPLETE | PARTIAL | done | — |
| Payments | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | reserved | NOT STARTED | future | explicitly deferred |
| Comfort profile | SEPARATE PROJECT | SEPARATE PROJECT | n/a | SEPARATE PROJECT | SEPARATE PROJECT | reserved | SEPARATE PROJECT | gated 4C | stack-native port (contract now recoverable) |
| Consent | SEPARATE PROJECT | SEPARATE PROJECT | boundary rules only | SEPARATE PROJECT | SEPARATE PROJECT | reserved | SEPARATE PROJECT | gated 4C | port with exact contract semantics |
| Provider projection | SEPARATE PROJECT | n/a | n/a | SEPARATE PROJECT | SEPARATE PROJECT | reserved | SEPARATE PROJECT | gated 4C | tie to real ACTIVE bookings on port |
| Reviews | read | PARTIAL | NOT STARTED (moderation) | COMPLETE | PARTIAL | COMPLETE | COMPLETE | queued | client review UI slice |
| Admin moderation | n/a | n/a | PARTIAL | PARTIAL (verification + decisions) | PARTIAL (1 page) | COMPLETE | COMPLETE (14/14) | future | operations dashboard |
| Support | NOT STARTED | NOT STARTED | NOT STARTED | SCAFFOLDED (schema) | NOT STARTED | COMPLETE | NOT STARTED | future | — |
| Analytics | n/a | n/a | NOT STARTED | PARTIAL (events Phases 1–3) | NOT STARTED | COMPLETE | COMPLETE (12/12) | **BLOCKED (Gate B)** | Phases 4–7 + 4G |
| Monetization | DESIGN ONLY | DESIGN ONLY | DESIGN ONLY | NOT STARTED | NOT STARTED | reserved names | NOT STARTED | future | — |
| Patch index page | n/a | n/a | n/a | SEPARATE PROJECT (CW `/patches`) | SEPARATE PROJECT | n/a | verified in CW | CW-only | optional OCF port |
| Deployment | COMPLETE (single-service) | — | — | COMPLETE | COMPLETE | **BLOCKED (Gate B managed DB)** | PARTIAL | active | verify managed `DATABASE_URL` |

## 17. Contradictions & Missing Evidence

1. **Inventory v6 is stale on arrival:** it counts 25 branches; **26 exist** (`conflict_110826_1322`, pushed 54 minutes after the v6 commit). Its "prior 9-branch cleanup authorization is stale" warning now applies to v6 itself — any cleanup needs a v7 inventory.
2. **Inventory v6 misclassification (docs-only, no operational impact):** the four Jul-31/Aug-1 branches are the original OnCall Foot FastAPI era, and the d0aeb89/66e9b96 lineages are agent work-transfer/audit workspaces — not all "Comfort-Wiring family." The never-merge conclusion stands for all of them.
3. **Phase 4C blocker partially dissolved:** Sessions 065/066 recorded the contract/shell as absent and forbade reconstruction from prose. The actual contract document (+ shell + patches + tests) is preserved on `conflict_110826_1322`. Recovering a real preserved artifact from an archived ref is materially different from prose reconstruction — but doing so still requires explicit operator approval per the standing scope rules.
4. **PRD internal duplication + stack anachronism:** checkpoints 5/6 appear twice with conflicting statuses (the ✅ rows are current); PRD §3 "Current Truth" describes the old FastAPI implementation — superseded by `replit.md`/LOG (annotated as historical).
5. **NEXT_TASK.md stale baselines:** references `184833b`/`c02a308`/`3e76114` (all ancestors of `b20087d`), an 18-branch inventory, and a 9-branch cleanup authorization — superseded twice over.
6. **Gate B (managed DB) UNVERIFIED** — the single standing blocker for activation Phases 4–7, production event writes, and all future migrations.
7. **LOG session numbering defects** (duplicates, non-monotonic order, one "LOCAL DRAFT" header published) — recorded; the gate enforces uniqueness going forward.
8. **No-show / reschedule / founding-provider UI affordances:** the state machine supports `no_show`/`rescheduled`, but dedicated UI affordances are not evidenced in the page inventory — UNKNOWN pending UI-level inspection. "Founding provider status" appears in no code found — NOT STARTED.
9. **Deploy-key channel state:** main's ledger says write access was revoked after the last publication window; branch 1322's connector note says its own key was active in that (now-snapshotted) environment. Whether any deploy key is currently valid is UNKNOWN from this workspace — verify before any publication.
10. **Test suites were not re-executed** during this read-only reconnaissance; all pass/fail counts are the ledger's recorded evidence, not fresh runs.

## 18. Safe Integration Recommendations

1. **Merge nothing from any conflict branch — ever.** 25 have no merge base; the 1 that does is superseded (cherry-verified). This is now quadruple-recorded (Session 058, Session 067/v6, the prior Neo report, this report).
2. **Recover Phase 4C artifacts the safe way (needs operator approval):** from `conflict_110826_1322`, `git show` the contract document (and optionally the CW patches as *reference specimens*) into a fresh docs-only commit on a dedicated branch → `publish:gate` → reviewed fast-forward. This is file recovery from a preserved ref — not a merge, not a cherry-pick, not prose reconstruction.
3. **Optional docs salvage** from `conflict_070826_mc2`: fresh docs-only commit checking out `docs/phase1-mc2-handoff.md`. Never cherry-pick `f6df78e`/`bce9735`.
4. **Comfort-Wiring → OnCall Foot = stack-native port only**, as its own gated checkpoint after Gate B: additive Drizzle models (two-store rule), Express routes with exact status-code semantics (incl. 404-only projection), React/Vite shell + scope picker + history timeline, node:test suites, one-task→one-patch, publication gate.
5. **Branch hygiene (requires fresh authorization against a v7 inventory):** (a) publish inventory v7 covering all 26 branches; (b) tag `archive/conflict_070826_mc2` @ `bed2e06`; (c) export the Comfort-Wiring/workspace lineages to a dedicated repository (newest-richest: 1322, 1134, 1112, 0846); (d) delete refs only after export verification; (e) confirm main untouched.
6. **All future publications:** dedicated branch → `pnpm run publish:gate` → reviewed fast-forward through an explicitly opened, verified publication channel. Never force-push; never rewrite main history; never merge a no-merge-base branch.

## 19. Next Three Implementation Tasks (recommended order)

1. **Gate B clearance — verify the managed PostgreSQL** (`DATABASE_URL` catalog check + `drizzle-kit push` dry run against the managed instance). Smallest task, largest unblock: releases activation Phases 4–7, production event writes, and the Phase 4C migration path.
2. **Client booking-lifecycle completion slice** (already the user-approved direction in `docs/NEXT-STEPS.md`): cancellation confirmation + duplicate-submit protection, provider status-change surfacing through existing notification paths, then the one-review-per-completed-booking client UI. Pure reuse of existing APIs; no schema changes; own tests; one reviewed commit per checkpoint.
3. **Phase 4C stack-native comfort/consent port** — after operator approval to recover the preserved contract from `conflict_110826_1322` and after Gate B: implement the six operations + consent history on Drizzle/Express/React with the exact semantics (grant 201/400, PUT 409-on-inactive, withdraw-hides-never-deletes, delete separate, projection 404-only tied to real ACTIVE bookings, scope picker with notes-off default, versioned+hashed append-only consent rows), with node:test suites and gated publication.

*(Parallel non-code task: publish inventory v7 and re-authorize the branch export/cleanup.)*

## 20. Final Source-of-Truth Statement

1. **Actual current main SHA:** `b20087d13eb77ad3da0b60efc88d4e768f68134d`
2. **Actual current main date:** 2026-08-11 16:29:48 +0000 (author: Neo Connector; docs-only inventory-v6 commit)
3. **Worktree/branch synchronized:** YES — fresh clone at `/app/recon/foot`, clean, equal to `origin/main`; re-fetched at report time with no drift
4. **All conflict branches inspected:** YES — **all 26** (merge-base, unique-commit count, root lineage, tip metadata, tree, stack fingerprint, content sampling)
5. **OnCall Foot conflict branches:** **5** — `conflict_070826_mc2` (true shared history, superseded) plus the four FastAPI-era historical implementations (`conflict_310726_1942`, `conflict_310726_2216`, `conflict_010826_0008`, `conflict_010826_0036`; no merge base, reference only)
6. **Comfort-Wiring conflict branches:** **4 definitive** (`conflict_110826_0846`, `_1112`, `_1134`, `_1322`) **+ 16 agent work-transfer/audit workspace snapshots** (d0aeb89 + 66e9b96 lineages) that carried OnCall Foot patch artifacts and Comfort-Wiring recovery material — all FARM-stack, all reference-only
7. **Branches with no merge base:** **25 of 26** (all except `conflict_070826_mc2`)
8. **Approved patches safe to apply to main:** **none pending** — every approved OnCall Foot build already sits on main; the five pending Comfort-Wiring patches belong only to Comfort-Wiring's own ledger
9. **Functionality to port (never merge):** the Comfort-Wiring consent/comfort stack (Phase 4C), using the preserved contract + reference implementation on `conflict_110826_1322`
10. **Next three tasks:** Gate B clearance → client booking-lifecycle completion slice → Phase 4C stack-native port (inventory v7 + branch export/cleanup in parallel as a non-code operation)

**`origin/main` of `https://github.com/sbtheg17-market/foot` is the ONLY canonical source of truth for OnCall Foot.** The Comfort-Wiring canonical record is the `.agents/LOG.md` ledger preserved on `conflict_110826_1322` (ENTRY-001–019). During this reconnaissance nothing was merged, pushed, rewritten, deleted, or modified in the target repository.
