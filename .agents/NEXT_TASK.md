# Next product task — Web notification feed PUBLISHED (`a98e1a3`); Provider Activation & First Booking Conversion IN PROGRESS (Phases 1–3 done; Phase 3 PUBLISHED at `cf689b5`); Mobile feed sequenced after

## Handoff scope notice — 2026-08-11

This workspace is the OnCall Foot repository (`sbtheg17-market/foot`), not the
Comfort-Wiring FARM/FastAPI/MongoDB repository described by the uploaded Neo
Entry Report. The referenced Comfort-Wiring recovery artifacts are absent here.
That mismatch is documented in [`docs/neo-handoff-scope.md`](neo-handoff-scope.md).

Do not reconstruct Comfort-Wiring, merge unrelated `conflict_*` branches, or
change OnCall Foot code in response to that report. A future Comfort-Wiring
handoff must provide its actual repository URL, archive, or complete recovery
bundle and name that repository as the target. Until then, continue only with a
separately approved OnCall Foot task.

## Current state — Session 063 (2026-08-10, takeover workspace)

- **Baseline:** canonical `origin/main` = `3e76114` (verified anonymous clone; tree `bc67dd6…`).
  **18** `conflict_*` branches exist (inventory v5) — all archival snapshots, never merged,
  based on, or modified; the two newest are platform auto-snapshots of the prior continuation
  workspaces (attribution recorded; owner audit-log confirmation open). **All conflict-branch
  cleanup is PAUSED** — the 16-branch cleanup plan and any deletion approval tied to it are
  invalidated.
- **Baseline independently re-verified green** from `3e76114`: typecheck + build PASS and all
  API suites reproduce recorded numbers (63/63, 8/8, 9/9, 23/23, 7/7, 14/14, 12/12, 14/14,
  11/11, 12/12) on an ephemeral local database. Gate B remains **NOT passed** (managed DB
  still UNVERIFIED).
- **Lost-candidate recovery:** the prior local candidates' patch artifacts and both v3
  contract documents were recovered read-only from archival snapshot `conflict_100826_1543`
  with exact checksum matches. The retired identities (`eec0147…`, `0c216d6…`) are not
  reused; new candidates are derived from exactly `3e76114`, each separate.
- **New local candidates (each requires its own review and publication approval):**
  1. this Session 063 traceability entry (docs-only);
  2. provider sign-out (one file, `artifacts/web/**` — publication additionally requires
     `--approve-web-ui`);
  3. lockfile-reproducibility fix (frozen install currently fails at the canonical tip;
     cause documented; no blind lockfile regeneration).
- **Standing approvals:** Phase 4C comfort-profile v3 (`339a03e6…`) — non-schema preparation
  only; provider economics v3 (`2172f6cf…`) — contract only. Blocked: schema, migrations,
  storage wiring, production event writes, economics implementation, marketplace expansion,
  conflict-branch cleanup, remote ledger edits, any push or merge without named approval.

> **Active checkpoint: Provider Activation & First Booking Conversion** (approved to sequence
> BEFORE the mobile feed). Product/measurement spec:
> `/workspace/CHECKPOINT_PROVIDER_ACTIVATION_FIRST_BOOKING_SPEC.md`. Phased, each phase
> separately sign-off-gated. **Phase 1 (additive `marketplace_events` migration) applied to the
> test DB** (Session 053). **Phase 2 (owner-scoped readiness API) PUBLISHED** as `4bb0e00`
> (Session 054). **Phase 3 (event emission) PUBLISHED** at `cf689b5`, tree
> `e30feca1251f250a7126e987c9379ca3e42e1056`, exactly the six approved files (Session 055
> remote verification). Managed database status: **UNVERIFIED**. Phases 4–7 (booking
> enforcement → flagged discovery gating → funnel-report API → validation) and readiness UI
> NOT started and remain gated. Mobile feed, email outbox, and push remain gated and
> sequenced after this checkpoint.

## Publication state (Session 062 remote verification)

- Canonical `origin/main` tip: `c02a308` (Session 061 traceability), tree
  `41c244286bda90be9b8a5c764e1d73722c39eec3`, parent `47df77e`
  (review-gate `--approve-web-ui` flag). Chain:
  `… → b3937a7 → 83cf335 → 6aa4863 → 47df77e → c02a308`,
  fast-forward only.
- Canonical fast-forward history: `cf689b5` (Phase 3, tree `e30feca…`) →
  `4734990` (Session 055 recreation, tree `4002cbed…`) → `6a5cf35`
  (premature Session 056 publication — recorded and corrected by Session
  057) → `5e031e5` (Session 057, tree `cdaa7cb9…`) → `5853768` (review
  gate) → `7c33672` (Session 058). No force-push, rewrite, or `conflict_*`
  merge at any step.
- Sessions 054–061 are present exactly once each in `.agents/LOG.md`;
  Phase 3 remains unchanged at tree `e30feca1251f250a7126e987c9379ca3e42e1056`.
- Full ancestry: `d7a5999` (Phase 1 base) → `4bb0e00` (Phase 2 readiness
  patch) → `d7a01e8` (readiness docs) → `cf689b5` (Phase 3, six-file scope
  confirmed) → traceability chain above.
- All `origin/conflict_*` branches are unrelated Emergent workspace lineages
  EXCEPT `conflict_070826_mc2` (real foot history, superseded — see the
  accepted inventory, Session 058). Never merge or base work on any of them.
- **Gate status (Sessions 059–060):** conflict-branch cleanup BLOCKED (no
  authenticated GitHub channel in the working container; pinned cleanup
  script artifact unrestored; zero side effects — all refs verified
  untouched). Managed-database catalog check environment-unavailable (no
  managed `DATABASE_URL`); managed DB remains **UNVERIFIED**; production
  event-writing gate stays blocked.

## Published candidates (landed on `main`, Session 060)

- **Phase 4B provider readiness web UI — PUBLISHED first:** branch
  `phase4b-readiness-ui`, single commit `b3937a7` (parent `7c33672`,
  tree `10ce4b66…`), patch SHA-256
  `31cbfcf1f8af7042d81b916664eea0e218aa9b0f7d73285fea6701aa1cb15b3d`.
  Nine files, all `artifacts/web/src/**`, including the review-required
  `/provider/travel-zones` fix destination for C5 (existing contract
  only: list/add/remove; no update endpoint exists). `publish:gate`
  passes every check (incl. tree identity + patch checksum) except the
  single intentional `artifacts/web/**` forbidden-path rule, for which
  the gate documents no approval flag — publication requires an explicit
  managed-channel human decision or a separately reviewed gate amendment
  adding a documented UI-approval flag. See Session 059.
- **Session 059 traceability entry — PUBLISHED second:** `.agents` files
  only, parented on `b3937a7`; full gate PASS. Both pushes were
  fast-forward with post-push tree and changed-file scope verification
  (see Session 060). Session 060 subsequently landed at `6aa4863`
  (tree `4cf87b0552…`, parent `83cf335`).
- **Review-gate UI-approval flag — PUBLISHED (verified in Session 061):**
  `47df77e` (parent `6aa4863`, tree `1ef7d452…`), exactly one changed file
  (`scripts/verify-publication.sh`, +40/−3). `--approve-web-ui
  "<approver>: <reason>"` authorizes ONLY `artifacts/web/**` and prints an
  audit record (approval text + each authorized web file); every other
  forbidden category stays hard-forbidden and all other checks are
  unchanged. Functionally re-verified from the published tree (web change
  fails unflagged, passes flagged with audit record; schema changes still
  fail even when flagged; docs-only behavior unchanged).
- **Session 061 traceability — PUBLISHED (Session 062):** `c02a308`
  (parent `47df77e`, tree `41c2442…`), fast-forward via the new dedicated
  MCP publication channel (repo-scoped deploy key, full gate PASS, post-push
  tree/scope/patch-checksum verification, independent HTTPS cross-check;
  deploy-key write access revoked after the window; channel now requires an
  explicit operator-approved publication window and fails closed outside
  it). `origin/main` = `c02a308`. Next reviewed candidate: the Session 062
  docs commit.

## Settled candidates from Session 058 (now on `main`)

- **Publication review gate — PUBLISHED** at `5853768` (parent `5e031e5`,
  tree byte-identical to the reviewed commit `f957caf`):
  `scripts/verify-publication.sh` + root `publish:gate`. Pre-push safety
  checks for parent identity, fast-forward-only, allow-list scope,
  forbidden paths, draft-status wording, unique+ordered session numbers,
  tree identity, and patch checksum. A safety check — human publication
  approval remains required.
- **Session 058 traceability entry:** PUBLISHED at `7c33672` (parent
  `5853768`), the current canonical tip.

## Queued after publication (approved order — recorded, not started)

1. **Phase 4C — client comfort/preferences intake** (next approved
   checkpoint). Contract prepared for review — SHA-256
   `1fa0eecba58c4cd5c0b8a31cbd56f934ba47067e9af4dddf8a461d0e7269bb14`:
   consent-first structured preferences, owner-scoped access, booking-only
   filtered provider projection, per-category client visibility toggles,
   consent versioning + withdrawal, no sensitive free text or medical
   inference. After contract approval: convert into its own API/schema and
   test plan; implement as its own slice (own tests, review, publication
   gate, traceability entry). No migration before Gate B clears.
2. **Provider economics** (after Phase 4C). Contract prepared for review —
   SHA-256 `5a7a20290d0e99eb73f418e09eebb346f6778b0900e73dcf6cfeef2a49342bcc`:
   provider boundary settings (buffers, travel boundaries via the existing
   travel-zone contract, minimum booking value, preferred blocks), capped
   time-bounded deals, mandatory pre-publish earnings preview,
   advisory-only worthwhile-ness estimates; no forced acceptance, automatic
   discounting, or ranking changes. After contract approval: separate
   API/schema and test plan; separate slice from Phase 4C.
3. Phase 4D provider opportunity cards (one action + one measurable
   outcome per card; never pressure providers past availability,
   boundaries, or comfort).
4. Phase 4E discovery eligibility (separately authorized gating).
5. Phase 4F booking reliability.
6. Phase 4G funnel reporting + product analytics (PostHog candidate)
   using the approved 14-event taxonomy recorded in Session 059 —
   supplements, never replaces, canonical `marketplace_events`; binding
   privacy rules: no health details, care notes, exact addresses, payment
   data, or document contents; masked replay; flag-gated experiments.
7. Phase 5 mobile readiness parity; later: white-label/admin platform
   phase (tenant isolation first, not a visual skin).

Approved immediate sequence (Session 062): revoke key (done) → Session 062
candidate → review both contracts → MCP key-expiry safeguard (done, channel
infrastructure) → verify managed DB (Gate B still blocking) → implement
Phase 4C → implement provider economics.

## Authorized conflict-branch cleanup (separate managed-channel operation)

- Order: (1) tag `archive/conflict_070826_mc2` at `bed2e06` and verify the
  tag; (2) delete ONLY the nine unrelated Emergent lineages
  (`conflict_010826_0008`, `conflict_010826_0036`, `conflict_060826_2025`,
  `conflict_080826_1307`, `conflict_090826_0856`, `conflict_090826_1405`,
  `conflict_090826_1718`, `conflict_310726_1942`, `conflict_310726_2216`);
  (3) confirm `main` is unchanged and report results.
- Basis: accepted read-only inventory (Session 058) — no unique
  unrecovered artifacts exist on any conflict branch; all patch artifacts
  correspond to published `main` work.
- Never delete `main`, rewrite history, or merge any conflict branch.

## Canonical handoff policy (permanent)

- `origin/main` of `https://github.com/sbtheg17-market/foot` is the ONLY
  canonical source of truth.
- Every new account/agent must clone that repository, then fetch and verify
  `origin/main` (commit + tree) BEFORE editing anything.
- Never continue from an Emergent-generated `conflict_*` branch unless it is
  proven to descend from foot `main`.
- Use a unique local branch per task; push only reviewed commits through the
  authenticated managed publication channel, as a fast-forward — no
  force-push, no history rewrite, no `conflict_*` merges.
- End every session with either a pushed commit or an explicit local artifact
  (patch) plus SHA-256 checksum recorded in `.agents/LOG.md`.
- The next account must verify the remote commit/tree before doing any work.
- Archive `conflict_*` branches for forensics; do not merge or force-push them.

## Current gate

**MC9 complete** and validated on canonical `main` (`8323aac`): reviewer approve/reject
workflow, transactional approved/rejected decision notifications, and the
durable `test:reviewer-decisions` suite (14/14) are all present.

**Web in-app notification feed + unread badge — DONE (frontend-only, awaiting
managed-environment publication).** `/provider/notifications` consumes only the
existing MC8-lite APIs via the generated client; ProviderLayout gained an
"Alerts" unread badge. No backend/schema/OpenAPI/generated-client/notification
-semantics changes; no email/SMTP/push/SSE/notification-bus/vendor coupling
(complies with `NOTIFICATION_ARCHITECTURE_CONSTRAINTS.md`). Validated:
typecheck + build pass; regression green (`test:reviewer-decisions` 14/14,
`test:provider-notifications` 12/12, provider-application 8/8, provider-status
9/9); all UI states verified by manual browser screenshots (no web test
framework introduced — that infra remains deferred). Scope: `artifacts/web/`
only. See Session 052 in `.agents/LOG.md`.

### Superseded reference — MC9 locked three-commit scope


- **Commit 1 (landed):** admin-only reviewer decision endpoints — published
  as split commits `0afb3ff` + `92d001f` (tree byte-identical to the
  reviewed implementation; `59068c8` is an environment-only `.replit`
  marker). See Session 050 traceability note.
- **Commit 2 (landed, `917361d`):** transactional `approved`/`rejected`
  provider notifications — tree byte-identical to the reviewed
  implementation (Session 051 traceability note).
- **Commit 3 (done, awaiting review):** durable `node:test` suite
  `test:reviewer-decisions` (14 cases) — reviewer authn/authz, self-review
  prevention, valid/invalid/repeated decisions with no-side-effect
  assertions, event + notification atomicity, ownership isolation, privacy.
  No app/API/schema changes.

Once Commit 3 lands, **MC9 is complete**. Next candidate checkpoints remain
gated pending separate scope approval: web/mobile in-app notification feed
with unread badge → email alerts via a separately designed outbox/retry
channel → push delivery.

## Constraints (locked)

- Step-0 gate before any work; one reviewed commit at a time; no push
  before approval.
- Web/mobile notification UI remains **out of scope**.
- Email, outbox, retry, and external delivery remain **out of scope**.
- No unrelated reviewer workflow or admin UI.
- Published history is never rewritten (Commit 4 `files` subject and the
  Commit 1 split-commit publication are recorded cosmetic discrepancies —
  see Session 049/050 traceability notes).
- Publication channel: patches applied by the managed environment, which
  may split commits or alter subjects — verify **tree identity, scope,
  ancestry, and validation**, not published commit hashes.

## Next gated candidate

**Mobile in-app notification feed + unread badge (Expo)** — parity with the web
feed, consuming the SAME existing MC8-lite APIs via the generated client. Still
**gated**: requires its own scope, acceptance criteria, and explicit approval
before any work. Then: vendor-neutral email outbox + delivery-adapter design →
push through the same channel abstraction. Each is separately approved.

## Post-MC9 deferred

- Web in-app notification feed with unread badge — **DONE** (Session 052; awaiting publication).
- Mobile in-app notification feed with unread badge — next gated candidate (see above).
- Email alerts through a separately designed, vendor-neutral outbox/retry channel.
- Push channel (`expo-notifications` present but unused for this line).
- Composite index `(provider_application_id, created_at DESC, id DESC)` on
  `provider_application_submissions` — documented follow-up (D1 deferred).
- Web/mobile test infrastructure (vitest / RN testing-library) — still deferred; the web
  feed (Session 052) was verified via manual browser screenshots, not automated tests.
- Root `attached_assets/Pasted-*.txt` cleanup; delete stale
  `origin/conflict_070826_mc2` branch (hygiene actions).

## Guardrails

- Never render `reviewerNotes` in any client. Only `rejectionReason` and
  the public snapshot fields of `previousSubmissions` are safe to render.
- Reviewer decisions do not touch provider-profile `verificationStatus`;
  the approved-provider authorization boundary (application **and**
  verification both approved) stays intact.
- Signup `roleIntent` remains an onboarding request, not an authorization
  claim.
- Do not duplicate server authorization rules in any client — render
  actions strictly from `canEdit` / `canReset` / `canResubmit`.
- Do not add Stripe, payouts, disputes, background checks, or any
  unrelated admin / care-history / review work.
