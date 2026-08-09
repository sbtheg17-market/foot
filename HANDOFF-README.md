# Handoff Artifacts — foot traceability & gate operations

All files in this directory are downloadable resources for the
`sbtheg17-market/foot` publication workflow. Verify every file against
`SHA256SUMS` before use: `sha256sum -c SHA256SUMS`

Canonical remote at last verification:
`origin/main = 7c3367299bdaf635ff2340d0d5896da8f5cb38aa` (Session 058)
Chain: `cf689b5 → 4734990 → 6a5cf35 → 5e031e5 → 5853768 → 7c33672`

## Pending operations (run in the AUTHENTICATED environment)

| File | Purpose | Status |
|---|---|---|
| `conflict-branch-cleanup.sh` | Tags `archive/conflict_070826_mc2` at pinned `bed2e06…`, verifies the tag, deletes ONLY the nine pinned unrelated Emergent branches (tip-verified, aborts on drift), confirms `main` unchanged. Leaves `conflict_070826_mc2` untouched. | APPROVED — awaiting authenticated run; paste full output back for verification |
| `verify-marketplace-events-catalog.sh` | Phase 4A managed-DB gate. READ-ONLY catalog SELECTs: `marketplace_events` (14 columns), 3 enums (16/14/3 values), 5 indexes + PK, 5 FKs ON DELETE SET NULL. Never prints credentials. Run: `DATABASE_URL=... bash verify-marketplace-events-catalog.sh` | APPROVED — awaiting run where managed DATABASE_URL lives; exit 0 = verified, exit 1 = separate migration decision |

## Published patches (historical record — already on origin/main)

| File | Landed as | Tree (authoritative) |
|---|---|---|
| `session055-19fcaf4-traceability-docs.patch` | `4734990` | `4002cbed57f5e9ea436d153d49ecaa3ba02f506b` |
| `session057-a5d7e6e-traceability-docs.patch` | `5e031e5` | `cdaa7cb9cf7e0fe2ba8540c913749f47756f4346` |
| `publication-gate-f957caf.patch` | `5853768` | `3e6b7b32b173f51474cc7c6f8e0a71e9740b129d` |
| `session058-c396adb-traceability-docs.patch` | `7c33672` | `a1987963426b19ffe75f6d5aa68596b343b76631` |

Per the locked publication protocol: published commit hashes may differ from
locally prepared ones; TREE identity is authoritative and each landed tree is
byte-identical to its reviewed patch.

## Evidence & planning documents

| File | Purpose |
|---|---|
| `conflict-branch-inventory.md` | Accepted read-only inventory of all 10 `conflict_*` branches (basis for the authorized cleanup) |
| `phase4b-readiness-ui-scope.md` | Approved (conditional) Phase 4B provider readiness checklist UI scope — implementation starts only after both gates above pass |

## Gates before Phase 4B implementation

1. Branch cleanup completed and verified (archive tag `bed2e06…`, exactly
   nine deletions, `conflict_070826_mc2` retained, `main` unchanged).
2. Managed-DB catalog verification exit 0 (or separately reviewed decision).

Product work (discovery gating, booking enforcement, activation overrides,
event emission, schema/API/mobile changes) remains gated. The traceability
dashboard remains deferred.
