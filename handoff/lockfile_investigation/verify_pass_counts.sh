#!/bin/bash
declare -A expected=(
  ["test.log"]=63
  ["test_integration.log"]=16
  ["test_pressure.log"]=13
  ["test_availability.log"]=3
  ["test_provider-application.log"]=8
  ["test_provider-status.log"]=9
  ["test_onboarding.log"]=23
  ["test_authorization.log"]=7
  ["test_provider-readiness.log"]=14
  ["test_provider-notifications.log"]=12
  ["test_reviewer-decisions.log"]=14
  ["test_provider-resubmission.log"]=11
  ["test_marketplace-events.log"]=12
)

all_pass=true
for log in "${!expected[@]}"; do
  # Extract pass count from "ℹ pass N" line
  actual=$(grep "ℹ pass" /app/handoff/lockfile_investigation/battery/"$log" 2>/dev/null | awk '{print $3}')
  exp=${expected[$log]}
  
  if [ "$actual" = "$exp" ]; then
    echo "✓ $log: $actual pass (expected $exp)"
  else
    echo "✗ $log: $actual pass (expected $exp)"
    all_pass=false
  fi
  
  # Check for failures from "ℹ fail N" line
  fail_count=$(grep "ℹ fail" /app/handoff/lockfile_investigation/battery/"$log" 2>/dev/null | awk '{print $3}')
  if [ "$fail_count" != "0" ] && [ -n "$fail_count" ]; then
    echo "  WARNING: $fail_count failures found in $log"
    all_pass=false
  fi
done

if $all_pass; then
  echo ""
  echo "✓ All pass counts match and zero failures"
  exit 0
else
  echo ""
  echo "✗ Pass count or failure mismatch detected"
  exit 1
fi
