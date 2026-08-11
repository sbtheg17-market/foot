#!/usr/bin/env bash
# Publication checklist DRY RUN — items 1-8 ONLY. PREPARATION, NOT PUBLICATION READINESS.
# Candidate: phase4c-nonschema-prep-r3 d9195dfab83a211dd2d79e7836348693a9748bc8
# Items 9-15 (approval, credential, window, push, post-push, revocation) are NOT executed.
set -uo pipefail
WT=/app/recovery/checkout
PKG=/app/recovery/candidates-r3/phase4c_r3
FAIL=0
item() { if eval "$2" >/app/recovery/work/dry.out 2>&1; then echo "ITEM $1 PASS — $3"; else echo "ITEM $1 FAIL — $3"; sed 's/^/    /' /app/recovery/work/dry.out | tail -6; FAIL=1; fi; }

cd "$WT"

# 1. fresh main verification (fetch from checksum-verified local bundle; no credentials)
item 1 'git fetch origin --prune --quiet && [ "$(git rev-parse origin/main)" = "d2ad54cd8e450fcc3bf8fab28aed257d67e73b42" ]' "fresh origin/main == d2ad54cd"

# 2. candidate identity + patch checksum
item 2 '[ "$(git rev-parse HEAD)" = "d9195dfab83a211dd2d79e7836348693a9748bc8" ] &&
        [ "$(git rev-parse HEAD^)" = "d2ad54cd8e450fcc3bf8fab28aed257d67e73b42" ] &&
        [ "$(git rev-parse HEAD^{tree})" = "2b1a3f7d7141b3afdfc8e016fbf6083dd47b8a93" ] &&
        git format-patch -1 --stdout HEAD > /app/recovery/work/dry-p4.patch &&
        pkgsha=$(grep "phase4c-nonschema-prep-r3.patch" "$PKG/CHECKSUMS.sha256" | cut -d" " -f1) &&
        nowsha=$(sha256sum /app/recovery/work/dry-p4.patch | cut -d" " -f1) &&
        [ "$pkgsha" = "$nowsha" ] && (cd "$PKG" && sha256sum -c CHECKSUMS.sha256 >/dev/null)' "commit/parent/tree + patch + package checksums"

# 3. contract tests 38/38
item 3 'cd "$WT/artifacts/api-server" && pnpm run test:comfort-contract 2>&1 | tail -10 | grep -q "^# pass 38" && cd "$WT/artifacts/api-server" && pnpm run test:comfort-contract 2>&1 | tail -10 | grep -q "^# fail 0"; r=$?; cd "$WT"; [ $r -eq 0 ]' "test:comfort-contract 38 pass / 0 fail"

# 4. typecheck + web production build
item 4 'cd "$WT" && pnpm run typecheck >/dev/null 2>&1 && cd artifacts/web && pnpm run build >/dev/null 2>&1' "workspace typecheck + web build"

# 5. lockfile invariant
item 5 '[ -z "$(git diff origin/main..HEAD -- pnpm-lock.yaml)" ] && [ -z "$(git status --porcelain pnpm-lock.yaml)" ]' "pnpm-lock.yaml unchanged"

# 6. exact nine-file scope
item 6 'diff <(git diff --name-only origin/main..HEAD | sort) <(printf "%s\n" \
  "artifacts/api-server/package.json" \
  "artifacts/api-server/src/__tests__/comfort-profile.contract.test.ts" \
  "artifacts/api-server/src/__tests__/fixtures/comfort-profile.fixtures.ts" \
  "artifacts/api-server/src/contracts/comfort-profile.contract.ts" \
  "artifacts/web/src/components/comfort/provider-comfort-card-shell.tsx" \
  "artifacts/web/src/pages/comfort/comfort-preferences-shell.tsx" \
  "docs/comfort-profile/PHASE_4C_COMFORT_PROFILE_CONTRACT_V3.md" \
  "docs/comfort-profile/WIRING_NOTES.md" \
  "docs/comfort-profile/openapi.draft.yaml" | sort)' "changed files == exact 9-file scope"

# 7. secret value scan (pattern file)
item 7 '! grep -nEf /app/recovery/ledger/secret-patterns.grep /app/recovery/work/dry-p4.patch' "secret value scan clean"

# 8. --approve-web-ui rationale MECHANISM validation (dry run; NOT an approval)
#    8a. gate REJECTS missing/malformed rationale (exit 2)
#    8b. gate runs end-to-end with an explicitly self-describing DRY-RUN rationale
ALLOW="--allow artifacts/api-server/package.json --allow artifacts/api-server/src/__tests__/comfort-profile.contract.test.ts --allow artifacts/api-server/src/__tests__/fixtures/comfort-profile.fixtures.ts --allow artifacts/api-server/src/contracts/comfort-profile.contract.ts --allow artifacts/web/src/components/comfort/provider-comfort-card-shell.tsx --allow artifacts/web/src/pages/comfort/comfort-preferences-shell.tsx --allow docs/comfort-profile/PHASE_4C_COMFORT_PROFILE_CONTRACT_V3.md --allow docs/comfort-profile/WIRING_NOTES.md --allow docs/comfort-profile/openapi.draft.yaml"
item 8a 'cd "$WT" && bash scripts/verify-publication.sh $ALLOW --approve-web-ui "malformed-no-colon" --base origin/main; [ $? -eq 2 ]' "gate rejects malformed rationale (exit 2)"
item 8b 'cd "$WT" && bash scripts/verify-publication.sh $ALLOW \
   --expected-tree 2b1a3f7d7141b3afdfc8e016fbf6083dd47b8a93 \
   --patch /app/recovery/work/dry-p4.patch \
   --sha256 $(sha256sum /app/recovery/work/dry-p4.patch | cut -d" " -f1) \
   --approve-web-ui "DRY-RUN MECHANISM CHECK (no approver): this is not an approval; no human review of the web files occurred; item 9 remains unsatisfied" \
   --base origin/main | grep -q "RESULT: PASS"' "gate mechanics run end-to-end with self-describing dry-run rationale"

rm -f /app/recovery/work/dry-p4.patch /app/recovery/work/dry.out
echo
if [ "$FAIL" -eq 0 ]; then
  echo "DRY RUN RESULT: items 1-8 ALL PASS — PREPARATION ONLY."
  echo "NOT publication readiness: items 9-15 (named approval, bounded credential,"
  echo "window, push, post-push verification, branch check, revocation) NOT executed."
else
  echo "DRY RUN RESULT: FAIL — fix before any window is considered."
fi
exit $FAIL
