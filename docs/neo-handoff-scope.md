# Neo Handoff Scope — Repository Mismatch Record

**Recorded:** 2026-08-11  
**Decision:** Document the mismatch and stop. Do not reconstruct the other project in this repository.

## Repository target

| Field | Verified value |
|---|---|
| Repository identity | `sbtheg17-market/foot` |
| Canonical remote | `https://github.com/sbtheg17-market/foot` |
| Branch | `main` |
| Current checkout | `d2ad54cd8e450fcc3bf8fab28aed257d67e73b42` |
| Workspace product | OnCall Foot |
| Expected stack | pnpm monorepo, Node/Express/TypeScript, PostgreSQL/Drizzle, React/Vite, Expo |
| In-scope artifacts | `artifacts/api-server`, `artifacts/web`, `artifacts/mobile`, shared `lib/`, and repository documentation |

## Mismatched uploaded report

The uploaded Neo Entry Report describes a separate **Comfort-Wiring** project: a FARM
template with FastAPI/MongoDB consent routes and a `/recovery/` artifact bundle.
Those artifacts are not present in this OnCall Foot workspace, and the current
repository has no basis for inferring or recreating them from report prose.

The report's expected items were not found here, including the recovery plan and
acceptance artifacts, ledger, manifest, Gate B runbook, OpenAPI draft, C-1
requirements, and preserved conflict-branch records. The report's `/app` path is
not this workspace's repository identity.

## Scope boundary for future agents

**Allowed for this mismatch:** inspect repository identity, verify the presence of
the supplied recovery bundle or actual remote, and record the result.

**Forbidden without the actual Comfort-Wiring repository or recovery artifacts:**

- modifying OnCall Foot application code, schema, generated clients, or workflows
- creating a Comfort-Wiring implementation in this repository
- reconstructing missing artifacts from the uploaded report or summary text
- merging or using unrelated `conflict_*` branches as a substitute for the target

## Next handoff

To resume Comfort-Wiring work, provide its actual repository URL, archive, or
complete `/recovery/` artifact set in a handoff that names Comfort-Wiring as its
repository target. Until then, OnCall Foot remains the only in-scope project and
its code is intentionally unchanged by this mismatch review.