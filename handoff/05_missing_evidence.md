# 5. Missing evidence

Each item below is required, absent from both the repository and this environment, and must NOT be satisfied by transferring any credential through this packet.

## 5.1 Detailed `main` branch-protection export — MISSING
- Anonymous check performed 2026-08-10: `GET /repos/sbtheg17-market/foot/branches/main/protection` → **HTTP 401** (authentication required).
- Needed: full protection JSON (required reviews, status checks, force-push/deletion restrictions, enforce_admins, push allow-lists).
- How to obtain safely: owner (or a **read-scoped, short-lived** credential held by the owner — never an audit credential reused for writes, never stored in this repo) runs:
  ```bash
  gh api repos/sbtheg17-market/foot/branches/main/protection > branch-protection-main.json
  sha256sum branch-protection-main.json   # record checksum in the ledger, commit only the sanitized export if approved
  ```

## 5.2 Post-16:35Z 2026-08-10 audit-log export — MISSING, urgency increased
- Original need: cover publication-window activity after 16:35Z.
- **New finding raising urgency:** two `conflict_*` branches were pushed AFTER the handoff statement — `conflict_100826_1415` (18:15:29Z) and `conflict_100826_1543` (19:44:06Z). The export must now cover **through at least 19:45Z** to attribute them (expected: Emergent workspace auto-snapshots; must be confirmed, not assumed).
- How to obtain: account owner exports the security/audit log for the repo/account for 2026-08-10 16:35Z → present (GitHub Settings → Security log, or `gh api /users/sbtheg17-market/…` equivalents available to the owner).

## 5.3 Managed Gate B verification — MISSING (and intentionally not attempted here)
- The managed production database remains **UNVERIFIED**. Verification is only valid in the managed environment with a **runtime-injected `DATABASE_URL`** (never pasted into chat, files, or this packet).
- Scope when run: read-only catalog check (schema/tables/migrations state vs `lib/db` expectations). No writes, no migrations, no event emission. Gate B is NOT passed until then.

## 5.4 Candidate artifacts for `eec0147` and `0c216d6` — MISSING FROM THIS ENVIRONMENT (new)
- Required: the patch files, **full 64-hex SHA-256 values** (the handoff gives only truncated prefixes `290fa509…` / `2b4ee109…`), commit trees, changed-file lists, and test evidence.
- Source: the previous account's local workspace or artifact store. Absent recovery, both must be **re-derived from `3e76114` as new candidates with new identities** — no byte-identity claims (per handoff rule on earlier re-derived candidates).

## 5.5 Phase 4C + provider-economics contract documents — MISSING (new)
- Only their SHA-256 checksums are recorded in the Session 062 ledger:
  - Phase 4C comfort-profile: `1fa0eecba58c4cd5c0b8a31cbd56f934ba47067e9af4dddf8a461d0e7269bb14`
  - Provider economics: `5a7a20290d0e99eb73f418e09eebb346f6778b0900e73dcf6cfeef2a49342bcc`
- The documents themselves are outside the repository and not present here. Approved Phase 4C non-schema preparation should be checked against the recovered contract document (checksum-verified) before drafting the OpenAPI spec.

## 5.6 Pinned Gate A cleanup script — STILL UNRECOVERED (carried forward)
- Per Sessions 060–062: must not be reconstructed under the original checksum; no branch deletion without the pinned inventory plus authenticated verification. Cleanup stays blocked; the 9-branch list is stale (18 branches now exist).
