#!/usr/bin/env bash
set -euo pipefail

branch="$(git branch --show-current)"
if [[ -z "$branch" ]]; then
  echo "GitHub sync check failed: detached HEAD." >&2
  exit 1
fi

remote_url="$(git remote get-url origin)"
if [[ -z "$remote_url" ]]; then
  echo "GitHub sync check failed: origin is not configured." >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree: dirty"
else
  echo "Working tree: clean"
fi

echo "Branch: $branch"
echo "Origin: $remote_url"
echo "HEAD: $(git rev-parse HEAD)"

if git show-ref --verify --quiet "refs/remotes/origin/$branch"; then
  remote_commit="$(git rev-parse "origin/$branch")"
  echo "origin/$branch: $remote_commit"
  git rev-list --left-right --count "origin/$branch...HEAD" | awk \
    '{ print "Ahead/behind: " $2 " ahead, " $1 " behind" }'
else
  echo "origin/$branch: not fetched locally"
  echo "Ahead/behind: unavailable until git fetch origin --prune"
fi

echo "Remote read check:"
git ls-remote --exit-code origin "refs/heads/$branch" >/dev/null
echo "  reachable"