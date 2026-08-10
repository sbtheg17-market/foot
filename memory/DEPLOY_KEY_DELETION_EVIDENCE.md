# Deploy-Key Deletion & Auto-Push Root-Cause — Audit Evidence Record

**Classification: EVIDENCE RECORD (post-closure addition, operator-ordered).**
Source: GitHub audit-log export uploaded by the operator on 2026-08-10. Raw export preserved at `evidence/export-sbtheg17-market.json.gz` in this directory. The four frozen handoff artifacts are unchanged; this record is a fifth, separately-checksummed artifact. All key material quoted below is **public** key material (fingerprints/public halves from the audit log) — no private keys, tokens, or secrets appear in this record.

## Evidence integrity

| Item | SHA-256 |
|---|---|
| `export-sbtheg17-market-1786371971.json.gz` (as uploaded / as preserved) | `3345e622a9adf9f79694490c4fcb7785f8ecf90c50f396163ac180331945d52c` |
| Decompressed NDJSON (`export-sbtheg17-market.json`, 306 events, 171,924 bytes) | `8c13f68b91f626d4e1df0ed356dc8e65510fac6d60450bc17d946c087f76d7a9` |

Export window: 2026-07-28 → 2026-08-10T13:15Z (epoch 1785265870173 → 1786367715988). Actor on all cited events: `sbtheg17-market`.

---

## Finding 1 — Deploy-key deletion CONFIRMED (Phase 3 prerequisite satisfied)

Primary evidence, event `_document_id: dBCe3Oevk8h46xWacXhjSA`:

```
action:       public_key.delete
repo:         sbtheg17-market/foot
title:        foot-publication-window-s062
fingerprint:  SHA256:TP17tQ7OS3i9Y2HI/OUAXjsrvQ3MhExZKcUtewwsDKg
operation:    remove  (explanation: removed_by_user)
timestamp:    2026-08-10T03:06:49.870Z
```

Full lifecycle: created 2026-08-10T03:02:45Z, verified 03:02:45Z, deleted 03:06:49Z — a bounded ~4-minute window, consistent with the publication-window design.

### Key reconciliation — ZERO deploy keys remain

All 8 `public_key.create` events reconcile against 8 `public_key.delete` events; every key identity ends in `delete`:

| Key title | Fingerprint (prefix) | Creates | Deletes | Final state |
|---|---|---|---|---|
| `foot-publication-window-s062` | SHA256:TP17tQ7OS3i9Y… | 1 | 1 | DELETED 03:06:49Z |
| `foot-publication-mcp-new` | SHA256:TP17tQ7OS3i9Y… | 1 | 1 | DELETED 02:41:14Z |
| `foot-publication-mcp-2026-08-10` | SHA256:hCqqnZK8Jc9dd… | 4 | 4 | DELETED 02:34:13Z |
| (untitled ed25519) | SHA256:VwdXig8tcarWL… | 1 | 1 | DELETED 02:00:49Z |
| `emergent` | SHA256:VwdXig8tcarWL… | 1 | 1 | DELETED 01:11:22Z |

Also recorded: two `public_key.verification_failure` events for a key titled "Neo managed publication" (01:12:09Z, 01:15:48Z) — failed verification attempts, no surviving key.

**Ledger consequence:** Deploy-key status → DELETED, confirmed by GitHub audit log (doc ID `dBCe3Oevk8h46xWacXhjSA`). The Session 063 publication window prerequisite is evidence-backed. Publication itself still requires: verified canonical clone + Gate A inventory captured + candidate `e6809e7` with parent exactly `3e76114` + gate pass + scope/patch checksum match.

---

## Finding 2 — Auto-push root-cause candidate IDENTIFIED and CURRENTLY ACTIVE (Phase 2 input)

The **Emergent.sh GitHub App** accounts for **41 of 306 events** — a repeating `integration_installation.destroy` → `integration_installation.create` churn (~20 reinstall cycles, pairs typically seconds apart), clustered heavily on 2026-08-09/10 — the same period in which the conflict-branch count grew from 12 to 15.

Key facts:
- 2026-07-28T20:59Z — first install (same day the repo was created, 19:11Z, public visibility).
- 2026-07-31T23:11Z — `integration_installation.repositories_added` (repo access granted).
- ~20 destroy/create cycles through 2026-08-10.
- **Most recent event in the entire export: `integration_installation.create` at 2026-08-10T13:15:12Z — the app is INSTALLED and the write channel is ACTIVE as of the export.**

Corroborating local evidence (this container): platform auto-checkpointing created 5 commits on local `main` (`9bafa77…04a3f80`) without explicit git actions — the same behavior class that, with the app's write channel, produces unintended remote branch creation (`conflict_*`).

**Containment recommendation (requires separate authorization + GitHub admin action; NOT executed):**
1. Uninstall the Emergent.sh app or remove `sbtheg17-market/foot` from its repository access until Gate A inventory is captured and containment is authorized.
2. Add branch protection to `main` (currently reported unprotected): block force-push, restrict who can push, require the managed publication channel.
3. Only after protection: any future re-grant of app access should exclude the canonical repository or be scoped to a non-canonical mirror.
4. Never delete `conflict_*` branches as part of containment.

---

## Finding 3 — Repository facts

- `repo.create sbtheg17-market/foot` — 2026-07-28T19:11:46Z, **public** visibility.
- Merge-setting and workflow-permission changes at creation time only; **no branch-protection events appear anywhere in the export**, consistent with `main` being unprotected.

## What this evidence does NOT change

- No canonical clone exists in this container (verified twice); Gate A remains unrunnable here.
- No repository, branch, or GitHub state was touched in producing this record — analysis was read-only against the uploaded file in `/tmp`.
- The four frozen handoff artifacts and their recorded checksums are unchanged.

## This artifact's own checksum

To be computed immediately after this file is written and quoted in the session report; future sessions verify both this record and the preserved raw export before relying on them.
