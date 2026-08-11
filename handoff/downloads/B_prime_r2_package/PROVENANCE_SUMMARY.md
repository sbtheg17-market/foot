# Provenance Summary — B′ r2 (provider portal sign-out)

Prepared 2026-08-11 in the post-C′ takeover workspace. LOCAL ONLY — zero
remote writes. Publication NOT approved; window CLOSED.

## Lineage

- Base and parent: e2406942b4206f877468e1b0f4c3c331ec151da9 (published C′,
  verified live origin/main at derivation time — ledger TO-001/TO-002).
- Source evidence: retired old B′ patch (identity e6380bf7, parent 3e76114),
  checksum dfbf9e18… verified against the recorded artifact before use
  (BD-002). The old identity is retired and was NOT pushed or reused.
- New identity: commit 9e0bbd451e9341729052db9c74d5e2ad526cf41b,
  tree c7e136a43853ae906617266ada831835188a4587, created BD-003.
- Scope: exactly artifacts/web/src/components/layout/provider-layout.tsx
  (+40/−2). No lockfile, schema, generated-client, mobile, or .agents change.

## Ledger records (append-only, /app/memory/evidence/LEDGER.jsonl)

BD-001 setup PASS · BD-002 source-evidence verification PASS · BD-003
reconstruction PASS · BD-004 frozen install PASS · BD-005 typecheck PASS ·
BD-006 web build PASS · BD-007 stack setup FAIL (env bootstrap: pgdata
ownership) superseded by BD-008 PASS · BD-009 desktop browser FAIL
(test-script timing assertion, not a candidate defect) superseded by BD-010
PASS 6/6 · BD-011 mobile 390px PASS 6/6 · BD-012 protected routes PASS 8/8 ·
BD-013 visual evidence PASS · BD-014 publication gate 12/12 PASS with REAL
reviewed --approve-web-ui audit record · BD-015 patch application/tree
reproduction PASS · BD-016 secret scan PASS (zero hits).

All FAIL records carry diagnoses and are superseded by re-runs per the
ledger's correction mechanism; nothing was edited or deleted.

## What this package is NOT

- NOT a publication and NOT publication approval.
- The gate's WEB-UI APPROVAL audit record authorizes only the
  artifacts/web/** forbidden-path check for the validation run; the push
  itself still requires a separate named approval + bounded credential.

## Secret hygiene

No tokens, connection strings, private keys, or env values recorded. The
verification stack generated its secrets locally, wrote them only to an
untracked gitignored .env, and never printed them (BD-008). Secret scan
BD-016: zero hits across patch, rationale, and all evidence logs.
