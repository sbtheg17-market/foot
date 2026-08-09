#!/usr/bin/env bash
# Conflict-branch cleanup — sbtheg17-market/foot
#
# AUTHORIZED, inventory-based cleanup (final confirmation granted).
# Run in the AUTHENTICATED managed environment only. This script:
#   1. Tags archive/conflict_070826_mc2 at its pinned tip (real foot history,
#      superseded) and verifies the tag on the remote.
#   2. Deletes ONLY the nine unrelated Emergent workspace lineages, each
#      verified against its pinned tip hash first (aborts on any mismatch —
#      a mismatch means the branch moved since the accepted inventory).
#   3. Confirms main is unchanged and prints the final ref list.
#
# It never touches main, never force-pushes, never rewrites history, and
# never merges anything.

set -euo pipefail

REMOTE="origin"
EXPECTED_MAIN_PREFIX="5e031e5"   # main tip at authorization time; cleanup does not modify main,
                                 # but if main moved, re-confirm before running (informational check).

# --- pinned inventory (accepted as read-only evidence, Session 058) ---------
ARCHIVE_BRANCH="conflict_070826_mc2"
ARCHIVE_TIP="bed2e069107df40312e806536c6fb462e8f402bc"
ARCHIVE_TAG="archive/conflict_070826_mc2"

declare -A DELETE_TIPS=(
  [conflict_010826_0008]="a5638c55c4e182db98413eed4e1319b573776fd6"
  [conflict_010826_0036]="0c7bd7bde12738ead7f5bfebf2cb080afb3e9be2"
  [conflict_060826_2025]="058cf6ecb01cc6bc02c0f9982115be96851b6006"
  [conflict_080826_1307]="305fd861353b846a32c6cce5daa9a054631bda1e"
  [conflict_090826_0856]="7110dc939810271908b5409b7cbb3c7b09342463"
  [conflict_090826_1405]="60979dbfba25095085fe6b04dc32b5ec01896308"
  [conflict_090826_1718]="c3589b1941f2f5993477a0b0c6eb9b23823d568d"
  [conflict_310726_1942]="ffe8515962a6f617b183dab3adb1059905109ee2"
  [conflict_310726_2216]="5e852632731b3d14a21544bd087cfbb90e4e644d"
)

echo "== Pre-flight =="
git fetch "$REMOTE" --prune

MAIN_BEFORE="$(git ls-remote "$REMOTE" refs/heads/main | cut -f1)"
echo "main before: $MAIN_BEFORE"
case "$MAIN_BEFORE" in
  ${EXPECTED_MAIN_PREFIX}*) echo "  (matches authorization-time tip)" ;;
  *) echo "  NOTE: main has advanced since authorization ($EXPECTED_MAIN_PREFIX*). Cleanup does not touch main; continue only if the cleanup authorization still stands." ;;
esac

echo
echo "== Step 1: archive tag for $ARCHIVE_BRANCH =="
ACTUAL_ARCHIVE_TIP="$(git ls-remote "$REMOTE" "refs/heads/$ARCHIVE_BRANCH" | cut -f1)"
if [[ "$ACTUAL_ARCHIVE_TIP" != "$ARCHIVE_TIP" ]]; then
  echo "ABORT: $ARCHIVE_BRANCH tip is $ACTUAL_ARCHIVE_TIP, expected $ARCHIVE_TIP" >&2
  exit 1
fi
git tag -f "$ARCHIVE_TAG" "$ARCHIVE_TIP"
git push "$REMOTE" "refs/tags/$ARCHIVE_TAG"
REMOTE_TAG="$(git ls-remote "$REMOTE" "refs/tags/$ARCHIVE_TAG" | cut -f1)"
if [[ "$REMOTE_TAG" != "$ARCHIVE_TIP" ]]; then
  echo "ABORT: remote tag $ARCHIVE_TAG is $REMOTE_TAG, expected $ARCHIVE_TIP — do not delete anything." >&2
  exit 1
fi
echo "Archive tag verified on remote: $ARCHIVE_TAG -> $REMOTE_TAG"

echo
echo "== Step 2: delete the nine unrelated Emergent lineages (tip-pinned) =="
for b in "${!DELETE_TIPS[@]}"; do
  expected="${DELETE_TIPS[$b]}"
  actual="$(git ls-remote "$REMOTE" "refs/heads/$b" | cut -f1)"
  if [[ -z "$actual" ]]; then
    echo "  $b: already absent — skipping"
    continue
  fi
  if [[ "$actual" != "$expected" ]]; then
    echo "  ABORT on $b: tip is $actual, expected $expected (branch moved since inventory)" >&2
    exit 1
  fi
  git push "$REMOTE" ":refs/heads/$b"
  echo "  deleted $b (was $expected)"
done

echo
echo "== Step 3: post-cleanup verification =="
MAIN_AFTER="$(git ls-remote "$REMOTE" refs/heads/main | cut -f1)"
echo "main after:  $MAIN_AFTER"
if [[ "$MAIN_BEFORE" != "$MAIN_AFTER" ]]; then
  echo "WARNING: main changed during cleanup — investigate immediately." >&2
  exit 1
fi
echo "main unchanged: OK"
echo
echo "Remaining refs:"
git ls-remote "$REMOTE" | sed 's/^/  /'
echo
echo "CLEANUP COMPLETE. Also verify: $ARCHIVE_BRANCH itself may now be deleted"
echo "in a separate confirmed step (its content is preserved by $ARCHIVE_TAG)."
