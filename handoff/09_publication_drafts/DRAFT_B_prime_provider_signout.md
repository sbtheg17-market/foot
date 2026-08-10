# Publication Draft B′ — Provider sign-out (re-derived)

**STATUS: PREPARED, NOT EXECUTED. PUBLICATION NOT APPROVED. REQUIRES `--approve-web-ui` HUMAN APPROVAL.**
Supersedes `DRAFT_B_provider_signout.md` (retired identity `0c216d6…`; recovered patch kept as evidence, SHA-256 `2b4ee109…78817bb`). Content was derived by applying that recovered, checksum-verified patch to a clean `3e76114` worktree; the commit identity is NEW and no byte identity of commit objects is claimed. Measured fact: the resulting tree equals the tree recorded in the recovered evidence (`c6e8c1f2…`), as expected for identical content on an identical parent.

| Field | Value |
|---|---|
| Target repository | `sbtheg17-market/foot` |
| Target ref | `refs/heads/main` (fast-forward only) |
| Commit | `e6380bf7b01b993b541bdbafe50ffdd6e51fc7ae` |
| Parent | `3e76114ce8ff8908a955d4beac38d6b3cde5dd6a` |
| Tree | `c6e8c1f2cd7d6ec7f24f0ac0908eb45bd2405321` |
| Patch artifact | `new_candidates/provider-signout-rederived.patch` |
| Patch SHA-256 | `dfbf9e18b643004316cdcfe4db2c7175ace9c7506c57a2915932af0437742093` |
| Changed files | exactly 1: `artifacts/web/src/components/layout/provider-layout.tsx` (+40/−2) |
| Tests / checks | web typecheck PASS; web build PASS; **browser E2E verified**: desktop sidebar sign-out → `/login`, `oncallfoot_token` cleared; direct `/provider` revisit redirects to `/login` (guard intact); mobile 390px top-right control visible and works; `publish:gate` 11/12 — every check PASS except the intentional web-UI rule, which by design requires the flag below |
| Gate invocation at publication | `bash scripts/verify-publication.sh --allow artifacts/web/src/components/layout/provider-layout.tsx --expected-tree c6e8c1f2cd7d6ec7f24f0ac0908eb45bd2405321 --patch <patch> --sha256 dfbf9e18… --approve-web-ui "<approver>: <reason>"` |

## Required `--approve-web-ui` rationale (for the approver to adopt or amend)
> "Provider portal previously had NO sign-out control (client layout has one) — confirmed UX gap from prior E2E. This one-file change mirrors the established client sign-out exactly (existing generated `useLogout` mutation → clear `oncallfoot_token` → route to login); no API, schema, route, generated-client, or auth-semantics changes; disabled-while-pending; `data-testid`s and `aria-label` included; verified in-browser at 1920px and 390px including the post-sign-out auth guard."
The gate prints the approval text and the single authorized web file as the audit record.

## Sequencing constraint
Parented on `3e76114`, mutually exclusive with A′/C′ as-is. If A′ and/or C′ publish first (recommended), B′ must be re-derived on the new tip (new commit hash, new patch checksum, fresh gate run incl. the flag, fresh approval); content re-application is mechanical (`git apply` of the recovered patch content).

## Execution steps
Same as Draft A′ steps 1–7, with: gate run WITH the named `--approve-web-ui` approval; post-push scope check must list exactly the one file; archive the printed audit record with this packet.
