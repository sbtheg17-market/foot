#!/usr/bin/env bash
# Transport-package validation — one candidate per invocation.
# Validates against canonical main 3e76114 in the dedicated validation worktree.
# Emits TAP-style counters so capture.py --parse-tap records check counts.
# Never touches the remote, the mirror refs, or the governance worktree.
set -u
WT=/app/repo_audit/validate_worktree
PKG=/app/handoff/patch_package/patches
BASE=3e76114ce8ff8908a955d4beac38d6b3cde5dd6a
KEY="${1:?usage: validate_patch.sh <A_prime|C_prime|B_prime|phase4c_prep|rule12_provenance>}"

case "$KEY" in
  A_prime)
    PATCH="$PKG/A-prime-session063-traceability.patch"
    SHA=dbb5abd618668354731a0e23ccc14ca00f875cb65e13678a73eb05d6d21a3ca9
    TREE=63dcfbe3080dae65a478c55d8e4bdbebb1832838
    COMMIT=f4a5dfeca5af222aeb9dcb1a6da822415397f902
    CDATE="Mon, 10 Aug 2026 20:30:57 +0000"
    FILES=".agents/LOG.md
.agents/NEXT_TASK.md" ;;
  C_prime)
    PATCH="$PKG/C-prime-lockfile-reproducibility.patch"
    SHA=1dfbfb13c932b240a8caaa8aa82a7691f700b1ab567e055c43dbed1b881b6e31
    TREE=093a2c22856ba93e31a002e79486bdb9751fbdd4
    COMMIT=2c6d0248569b9c3f99213a19a40eaade81e69a4a
    CDATE="Mon, 10 Aug 2026 21:31:54 +0000"
    FILES=".agents/SETUP.md
package.json" ;;
  B_prime)
    PATCH="$PKG/B-prime-provider-signout.patch"
    SHA=dfbf9e18b643004316cdcfe4db2c7175ace9c7506c57a2915932af0437742093
    TREE=c6e8c1f2cd7d6ec7f24f0ac0908eb45bd2405321
    COMMIT=e6380bf7b01b993b541bdbafe50ffdd6e51fc7ae
    CDATE="Mon, 10 Aug 2026 20:31:23 +0000"
    FILES="artifacts/web/src/components/layout/provider-layout.tsx" ;;
  phase4c_prep)
    PATCH="$PKG/phase4c-nonschema-prep.patch"
    SHA=528b9bac839473859a0c91ac874bfc3c6346a959023d65f147a6ce317530ad1d
    TREE=56d34d2b5062bcb770008c1d62c109563b45dd53
    COMMIT=2dc23539b21eb688526fe438b7fb9eaac0cc324b
    CDATE=""
    FILES="artifacts/api-server/package.json
artifacts/api-server/src/__tests__/comfort-profile.contract.test.ts
artifacts/api-server/src/__tests__/fixtures/comfort-profile.fixtures.ts
artifacts/api-server/src/contracts/comfort-profile.contract.ts
artifacts/web/src/components/comfort/provider-comfort-card-shell.tsx
artifacts/web/src/pages/comfort/comfort-preferences-shell.tsx
docs/comfort-profile/PHASE_4C_COMFORT_PROFILE_CONTRACT_V3.md
docs/comfort-profile/WIRING_NOTES.md
docs/comfort-profile/openapi.draft.yaml" ;;
  rule12_provenance)
    PATCH="$PKG/rule12-provenance-docs.patch"
    SHA=fca9c42183636ffa9d3d02057f998a31cead3ed37b838a058f1cdadce4a3b120
    TREE=a4091ce232f5521a7407a95f4eb63a902d6ab582
    COMMIT=b85f71f32202c293c1d7c240ec4af151b22c2c41
    CDATE=""
    FILES=".agents/AGENT-RULES.md" ;;
  *) echo "unknown candidate: $KEY"; exit 2 ;;
esac

pass=0; fail=0
check() { # check <name> <cmd...>
  local name="$1"; shift
  if "$@" >/dev/null 2>&1; then pass=$((pass+1)); echo "ok - $name"
  else fail=$((fail+1)); echo "not ok - $name"; fi
}

cd "$WT" || exit 2
git am --abort >/dev/null 2>&1
git reset -q --hard "$BASE"
git clean -qfd

# 1. patch file present and checksum matches the declared identity
ACTUAL_SHA=$(sha256sum "$PATCH" | cut -d' ' -f1)
check "patch sha256 matches declared ($SHA)" test "$ACTUAL_SHA" = "$SHA"

# 2. applies cleanly to canonical main
check "git apply --check clean on $BASE" git apply --check "$PATCH"

# 3. staged application reproduces the expected tree byte-identically
git apply --index "$PATCH" >/dev/null 2>&1
GOT_TREE=$(git write-tree)
check "expected tree reproduced ($TREE)" test "$GOT_TREE" = "$TREE"

# 4. changed-file list matches declared scope exactly
GOT_FILES=$(git diff --name-only --cached "$BASE" | sort)
WANT_FILES=$(printf '%s\n' "$FILES" | sort)
check "changed-file scope exact" test "$GOT_FILES" = "$WANT_FILES"

# 5. pnpm-lock.yaml untouched by this patch
check "pnpm-lock.yaml byte-identical" bash -c "git diff --cached --name-only $BASE | grep -qv . || ! git diff --cached --name-only $BASE | grep -qx pnpm-lock.yaml"

git reset -q --hard "$BASE"

# 6. commit identity reproduction (A'/C'/B' have recorded committer dates)
if [ -n "$CDATE" ]; then
  GIT_COMMITTER_NAME="E2 Agent (Emergent)" GIT_COMMITTER_EMAIL="github@emergent.sh" \
  GIT_COMMITTER_DATE="$CDATE" git am "$PATCH" >/dev/null 2>&1
  GOT_COMMIT=$(git rev-parse HEAD)
  check "commit SHA reproduced byte-identically ($COMMIT)" test "$GOT_COMMIT" = "$COMMIT"
else
  # local-origin candidates: confirm the recorded commit object exists in the
  # branches bundle restore path (transport bundle) with the expected tree
  git fetch -q /app/handoff/candidates/local-branches-2026-08-10.bundle "+refs/heads/*:refs/bundles/$KEY/*" 2>/dev/null
  GOT_TREE2=$(git rev-parse "$COMMIT^{tree}" 2>/dev/null || echo missing)
  check "recorded commit $COMMIT present in transport bundle with expected tree" test "$GOT_TREE2" = "$TREE"
fi

git am --abort >/dev/null 2>&1
git reset -q --hard "$BASE"
git clean -qfd

echo "# tests $((pass+fail))"
echo "# pass $pass"
echo "# fail $fail"
echo "remote-state-effect: NONE (validation worktree only; no push, no remote refs touched)"
[ "$fail" -eq 0 ]
