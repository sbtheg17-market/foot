# REAL REVIEWED --approve-web-ui RATIONALE — B′ r2 (provider sign-out)

STATUS: REAL REVIEWED RATIONALE for gate validation. This is NOT the
DRAFT-VERIFICATION rationale (the 2026-08-10 draft, which was explicitly
labeled "DRAFT-VERIFICATION (not an approval)" and is invalid for
publication, remains retired together with the old candidate identity
e6380bf7).

DISTINCTION FROM DRAFT:
- Draft (retired): mechanics-only gate exercise, no owner review, labeled
  DRAFT-VERIFICATION, tied to retired identity e6380bf7 / parent 3e76114.
- THIS rationale: grounded in the owner's explicit written session approval
  (2026-08-11, post-C′ takeover session) that named B′ re-derivation from
  parent e2406942, fixed the exact one-file scope, and required this real
  reviewed rationale as validation item 7 of 10.

APPROVER: sbtheg17-market (repository owner) — via the written session
approval of 2026-08-11 authorizing "local-only B′ re-derivation and package
preparation" with required validation item 7: "real reviewed
--approve-web-ui rationale, clearly distinguished from a draft".

REASON: B′ r2 provider portal sign-out is an intentional, reviewed
artifacts/web/** UI change: exactly one file
(artifacts/web/src/components/layout/provider-layout.tsx, +40/−2), commit
9e0bbd451e9341729052db9c74d5e2ad526cf41b, parent exactly
e2406942b4206f877468e1b0f4c3c331ec151da9, tree
c7e136a43853ae906617266ada831835188a4587. It mirrors the established
client-layout sign-out exactly (server logout mutation, oncallfoot_token
cleared from localStorage, redirect to /login) and introduces no second
authentication mechanism. Validation evidence: typecheck (BD-005), web build
(BD-006), desktop browser sign-out 6/6 (BD-010), mobile/responsive 390px
sign-out 6/6 (BD-011), protected-route behavior after sign-out 8/8 incl.
API 401 (BD-012), visual control evidence (BD-013).

SCOPE LIMIT OF THIS RATIONALE: it authorizes ONLY the artifacts/web/**
portion of the gate's forbidden-path check for THIS candidate's gate
validation run. It is NOT a publication approval: B′ publication remains
blocked pending a separate named approval identifying the exact candidate
and target ref, plus a new bounded repository-scoped write credential.

GATE FLAG TEXT (exact):
sbtheg17-market (owner): reviewed B-prime r2 provider sign-out — one-file
web UI change mirroring the established client sign-out; validated by
BD-005..BD-013 evidence; session approval of 2026-08-11 (validation item 7);
not a publication approval
