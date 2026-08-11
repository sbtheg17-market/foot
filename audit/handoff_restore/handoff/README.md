# Handoff Bundle — sbtheg17-market/foot — 2026-08-10 (new-workspace session)

Plain-file durability bundle (snapshot-eligible; nothing here is gitignored).
DURABILITY STATUS: handoff-bundle level ONLY. Repository durability is NOT
claimed until either (a) the platform workspace snapshot actually pushes, or
(b) a reviewed repository candidate containing these artifacts is published.

## Contents
- STATE_REPORT_2026-08-10.md / STATE_MATRIX_v3_2026-08-10.md — session state
- candidates/local-branches-2026-08-10.bundle — git bundle (verified complete)
  of ALL local branches: candidate/A-prime-session063 (f4a5dfec…),
  candidate/C-prime-lockfile (2c6d0248…), candidate/B-prime-provider-signout
  (e6380bf7…), phase4c/non-schema-prep (7009ce66…, parent 2dc23539…),
  candidate/provenance-rule-docs (b85f71f3…). Restore with:
  git clone /path/to/local-branches-2026-08-10.bundle
- candidates/*.patch + lockfile-identity.txt — checksum-pinned patch artifacts
- publication_drafts/ — A' (INTENDED FIRST, blocked), C', B' drafts
- evidence/ — point-in-time copies of the provenance ledger system
  (canonical live copies remain at /app/memory/evidence/)
- test_reports/ — independent testing-agent reports
- MANIFEST.sha256 — checksums of every file in this bundle

## Why nested git repos are NOT relied upon
/app/repo_audit/{foot-mirror,main_worktree} are embedded git repositories; a
workspace snapshot records them only as gitlinks (contents lost). Hence the
bundle + patches here as plain files.
