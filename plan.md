# plan.md

## 1. Objectives
- Produce **two documentation-only, read-only** deliverables in the existing repo checkout on the remote code-server workstation:
  1) `docs/gate-b-artifact-extraction-review.md` — a **line-mapped, DRAFT** inventory of expected schema objects extracted **only** from the **eight catalog-absent** frozen artifacts in `docs/migrations/`.
  2) Append one **DEFERRED, pg_catalog-only** query section to `docs/gate-b-catalog-queries-readonly.sql` for **R1 truncated constraint-name collision checking**.
- Keep `docs/gate-b-release-record.md` **completely untouched** (no templates, no entries).
- Avoid any external access: **no DB connection**, no Supabase/Railway/GitHub, no Git remote contact, no deployments.

## 2. Implementation Steps

### Phase 1 — Core preparation (no workstation writes; local-only drafting)
User stories:
1. As a release approver, I want a concise, line-mapped list of expected objects per artifact so I can verify what should exist after apply.
2. As an operator, I want long identifiers and their exact PostgreSQL truncations called out so I can anticipate apply-time naming and verification.
3. As a reviewer, I want FK actions and unique/check semantics summarized so I can confirm safety and intent without reading full SQL bodies.
4. As a reviewer, I want serial/sequence expectations captured so I can validate ID behavior post-apply.
5. As a reviewer, I want a scoped collision-check query so I can assess R1 failure risk without dumping all constraints.

Steps:
- Identify apply-scope artifacts (from Gate-B record):
  - `CANCELLATION_NO_SHOW_SUPPORT_V1`
  - `PILOT_PROVIDER_RETENTION_V1`
  - `PREVENTED_BOOKINGS_DAILY_V1`
  - `PROVIDER_BLOCKED_RANGES_V1`
  - `PROVIDER_EMERGENCY_OPENINGS_V1`
  - `PROVIDER_PUBLIC_BOOKING_PAGES_V1`
  - `PROVIDER_SERVICE_AREAS_V1`
  - `RESCHEDULE_PROPOSALS_HISTORY_V1`
- Parse each artifact **by reading only** `docs/migrations/*.sql`:
  - Extract and line-map: created types/enums; created tables; altered tables/added columns; constraints (PK/FK/CHECK/UNIQUE); indexes (including predicates); sequences implied by `serial` columns; FK `ON DELETE/ON UPDATE` actions.
  - Identify identifiers **>63 bytes**, compute expected truncated names (PostgreSQL rule: 63-byte `NAMEDATALEN-1` truncation), and note **same-prefix collision risk** candidates.
- Draft `docs/gate-b-artifact-extraction-review.md` with:
  - One section per artifact.
  - Bullet inventories with **(file:line)** references.
  - A dedicated “Long identifiers + truncation” table.
  - Prominent label on every expectation: **“DRAFT — requires human artifact review before use in verification SQL.”**
  - No unnecessary full SQL bodies; only minimal excerpts when needed to disambiguate actions/semantics.
- Draft the new **DEFERRED** query section for `docs/gate-b-catalog-queries-readonly.sql`:
  - Read-only `SELECT` / `WITH … SELECT` only.
  - Query **only** `pg_catalog`.
  - Scope narrowly to:
    - Exact match on the truncated identifier: `booking_reschedule_history_proposal_id_booking_reschedule_propo`
    - Names sharing the same relevant prefix (exact prefix string used in `LIKE '<prefix>%')`.
  - Include comments explaining:
    - DEFERRED usage during approved change-window review only.
    - Output requires human interpretation.
    - Do not modify the artifact.
- Prepare complete unified diffs (for both files) for user review.

### Phase 2 — Workstation preflight checks (read-only)
User stories:
1. As an operator, I want confirmation the working tree is clean before branching so I don’t mix unrelated changes.
2. As a reviewer, I want assurance no remote fetch/pull occurs before edits.
3. As a release approver, I want the exact planned file list and diffs before any write happens.
4. As a compliance reviewer, I want confirmation the new SQL query is pg_catalog-only.
5. As a release approver, I want the assistant to pause until I explicitly say “go.”

Steps (terminal on workstation; no file writes yet):
- Run: `git status --short`.
  - If non-empty: **stop** and report **paths only**.
- Run: `git branch --show-current`, `git rev-parse HEAD`.
- Confirm no Git remote interaction (no fetch/pull/push; no upstream set).

### Phase 3 — Present plan + diffs; wait for approval (no writes)
User stories:
1. As an approver, I want to see the exact file list so I can confirm scope.
2. As an approver, I want complete diffs so I can review content before it lands.
3. As an approver, I want a clear explanation why the new query is read-only and catalog-only.
4. As an approver, I want confirmation the query is narrowly scoped to R1 truncated name/prefix.
5. As an approver, I want the assistant to pause until I say “go.”

Steps:
- Show exact file list: only
  - `docs/gate-b-artifact-extraction-review.md` (new)
  - `docs/gate-b-catalog-queries-readonly.sql` (append-only change)
- Show full diffs.
- Explain the R1 query’s read-only and catalog-only properties:
  - It selects from `pg_catalog.pg_constraint` and `pg_catalog.pg_namespace` (and/or other pg_catalog views) only.
  - No writes, no application tables.
- Confirm the query does **not** list all constraints; it filters by exact truncated name OR the single prefix.
- **Pause** for explicit written “go”.

### Phase 4 — Apply changes after explicit “go” (bounded writes + checks)
User stories:
1. As an operator, I want changes isolated to a local-only branch so main stays untouched.
2. As an approver, I want verification that only the two allowed files changed.
3. As a compliance reviewer, I want secret scanning to cover untracked/modified files without staging.
4. As an operator, I want formatting checks (`git diff --check`) to catch whitespace errors.
5. As an approver, I want a final status report and then a hard stop.

Steps (only after “go”):
- Confirm again `git status --short` is empty; if not, stop and report changed paths.
- Create local-only branch: `git checkout -b neo/gate-b-artifact-review`.
- Write only:
  - `docs/gate-b-artifact-extraction-review.md`
  - Append-only section to `docs/gate-b-catalog-queries-readonly.sql`
- Run: `git diff --check`.
- Run: `scripts/secret-scan.sh` as-is.
- Direct-scan the same secret patterns against every new/modified **untracked** file (without staging) and print only file paths if hits occur (never the matched text).
- Run: `git status --short` and confirm only those two paths changed.
- Stop (no stage/commit/push).

## 3. Next Actions
- Draft the two deliverables locally and produce complete diffs.
- Perform workstation read-only preflight (`git status --short`, branch, HEAD) and report.
- Present file list + full diffs + R1 query scope/read-only rationale.
- Await explicit “go.”

## 4. Success Criteria
- Only two files are created/modified exactly as scoped:
  - New `docs/gate-b-artifact-extraction-review.md` contains full line-mapped DRAFT expectations for the 8 catalog-absent artifacts and flags all >63-byte identifiers with truncations.
  - `docs/gate-b-catalog-queries-readonly.sql` contains one new clearly labeled DEFERRED, pg_catalog-only, narrowly scoped R1 collision-check query section.
- No edits to release record, preflight draft, operator runbook, or any migration artifact.
- No external service access, no DB queries, no Git remote operations.
- Post-write checks pass: `git diff --check`, secret scans, and `git status --short` shows only the two allowed paths changed.

Final statement to use after completion:
“Artifact expectations and the R1 collision-check query are prepared for human review. Production migration and Railway deployment remain blocked.”
