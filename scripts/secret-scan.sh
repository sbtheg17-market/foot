#!/usr/bin/env bash
# Deterministic deny-list secret scan over git-tracked files.
# No network, no external dependencies — runs identically locally and in CI.
# Local scratch credentials (postgres:postgres@127.0.0.1/localhost and CI
# service-container hosts) are explicitly allowed; real-looking tokens fail.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

FAIL=0

scan() {
  local label="$1" pattern="$2"
  # -I: skip binaries. Print file paths only — never echo the matched value.
  local hits
  hits=$(git grep -I -P -l -e "$pattern" -- . \
    ':(exclude)pnpm-lock.yaml' ':(exclude)scripts/secret-scan.sh' || true)
  if [ -n "$hits" ]; then
    echo "SECRET-SCAN FAIL [$label] in:"
    echo "$hits" | sed 's/^/  - /'
    FAIL=1
  fi
}

scan "GitHub token"          'gh[pousr]_[A-Za-z0-9]{20,}'
scan "GitHub fine-grained"   'github_pat_[A-Za-z0-9_]{20,}'
scan "OpenAI-style key"      'sk-[A-Za-z0-9]{24,}'
scan "Stripe live key"       '(sk|rk|pk)_live_[A-Za-z0-9]{10,}'
scan "AWS access key"        'AKIA[0-9A-Z]{16}'
scan "Slack token"           'xox[baprs]-[A-Za-z0-9-]{10,}'
scan "Private key block"     '-----BEGIN (RSA|EC|DSA|OPENSSH|PGP) PRIVATE KEY-----'
scan "Signed JWT"            'eyJhbGciOi[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}'
# Fixture hosts used by redaction tests (db.example.com, host.internal,
# host-a/host-b) and local/scratch hosts are allowed; real hosts fail.
scan "Non-local DB password" 'postgres(ql)?://[A-Za-z0-9_-]+:[^@\s"]+@(?!127\.0\.0\.1|localhost|postgres[:/]|db\.example\.com|host)'

if [ "$FAIL" -ne 0 ]; then
  echo "Secret scan failed — remove the flagged values before committing."
  exit 1
fi
echo "Secret scan clean."
