# Publication Draft — B′ (provider portal sign-out) — THIRD IN SEQUENCE
Prepared 2026-08-10 (new workspace). LOCAL ONLY — NOT PUSHED.

## Identity (reconstructed and verified byte-identical to the recorded candidate)
- commit  e6380bf7b01b993b541bdbafe50ffdd6e51fc7ae
- parent  3e76114ce8ff8908a955d4beac38d6b3cde5dd6a
- tree    c6e8c1f2cd7d6ec7f24f0ac0908eb45bd2405321
- patch   /app/repo_audit/handoff_extract/provider-signout-rederived.patch
- sha256  dfbf9e18b643004316cdcfe4db2c7175ace9c7506c57a2915932af0437742093
- scope   exactly artifacts/web/src/components/layout/provider-layout.tsx (+40/−2)
- local branch: candidate/B-prime-provider-signout

## Verification evidence (re-run in this workspace)
- pnpm run typecheck: EXIT=0 (all packages incl. web/mobile)
- pnpm -r --filter @workspace/web run build: EXIT=0
  (logs: /app/repo_audit/battery/bprime_typecheck.log, bprime_webbuild.log)
- publish:gate: PASS — run with a rationale explicitly labeled
  "DRAFT-VERIFICATION (not an approval)" to test mechanics only
  (log: /app/repo_audit/battery/gate_B.log)

## EXTRA PUBLICATION REQUIREMENT (in addition to standard blockers)
artifacts/web/** is a forbidden path in the gate: the REAL publication run
requires the owner's reviewed --approve-web-ui "<approver>: <reason>" rationale.
The draft-verification rationale above is NOT valid for publication.

## SEQUENCING RULE (mandatory)
B′ publishes THIRD. After A′ and the re-derived C′ land, B′ MUST be re-derived on
the new tip with a NEW identity, then re-verified (typecheck/build/browser) and
re-gated with the owner rationale before any push.
