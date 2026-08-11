# Application Guide — B′ r2 (provider portal sign-out)

Transport-only package. NOT a publication. Publication requires a separate
named approval and a new bounded repository-scoped credential.

## Identity (verify every value before any use)

- candidate commit  9e0bbd451e9341729052db9c74d5e2ad526cf41b
- parent / base     e2406942b4206f877468e1b0f4c3c331ec151da9 (must equal live origin/main at apply AND push time)
- tree              c7e136a43853ae906617266ada831835188a4587
- patch             B-prime-r2-provider-signout.patch
- patch sha256      af55ecf502c7828dec8b78b75cfefd0404bbdf00e4be6531948c5303c09e5a48
- scope             exactly artifacts/web/src/components/layout/provider-layout.tsx (+40/−2)

The old B′ identity e6380bf7 (parent 3e76114) is RETIRED. Never apply or push it.

## Apply in a managed environment

```bash
git clone https://github.com/sbtheg17-market/foot.git && cd foot
git fetch origin && git rev-parse origin/main   # MUST print e2406942b4206f877468e1b0f4c3c331ec151da9
sha256sum B-prime-r2-provider-signout.patch     # MUST print af55ecf5...c09e5a48
git checkout -b candidate/B-prime-r2-provider-signout origin/main
git am B-prime-r2-provider-signout.patch
git rev-parse 'HEAD^{tree}'                     # MUST print c7e136a43853ae906617266ada831835188a4587
git diff-tree --no-commit-id --name-only -r HEAD # MUST list exactly the one provider-layout.tsx file
```

If origin/main is NOT e2406942, STOP: the candidate must be re-derived on the
new tip with a new identity; do not rebase or force anything.

## Gate (run again in the managed environment before push)

```bash
bash scripts/verify-publication.sh \
  --allow artifacts/web/src/components/layout/provider-layout.tsx \
  --expected-tree c7e136a43853ae906617266ada831835188a4587 \
  --patch B-prime-r2-provider-signout.patch \
  --sha256 af55ecf502c7828dec8b78b75cfefd0404bbdf00e4be6531948c5303c09e5a48 \
  --approve-web-ui "<owner>: <the reviewed rationale — see APPROVE_WEB_UI_RATIONALE_B_prime_r2.md>"
```

## Push (ONLY inside an explicitly approved publication window)

- Approval must name candidate 9e0bbd45… and target refs/heads/main.
- Use a NEW bounded repository-scoped write credential; never an audit credential.
- `git push origin HEAD:main` as fast-forward only. Never force-push.
- Post-push: independently verify remote SHA, parent e2406942, tree c7e136a4,
  one-file scope, pnpm-lock.yaml blob unchanged (8a5e03928a523e39b5855e0172f1772aec05ec71),
  all 21 conflict_* branches untouched; then REVOKE the credential.
- Do not publish any other candidate in the same window.

## Validation evidence in this package

See MANIFEST.json (validation section), evidence/*.log (capture.py records
BD-005..BD-016), evidence/*.png (desktop + mobile pre-sign-out controls and
post-sign-out login states), evidence/LEDGER_EXTRACT_B_prime_r2.jsonl.
