<#
restore-supabase-instance-rehearsal.ps1 — operator-only restore REHEARSAL of
a local plain-SQL backup into an explicitly DISPOSABLE, NON-PRODUCTION
PostgreSQL target, using psql (Windows PowerShell alternative to
scripts/restore-supabase-instance-rehearsal.sh).

This is not a production restore workflow. It exists to prove that a backup
artifact can be restored at all. It must never be called from application
runtime code, a provider/vendor dashboard, CI, or unattended automation, and
it never uses GitHub, Railway, Supabase dashboard APIs, or artifact storage.

The target URL is read ONLY from RESTORE_TARGET_DB_URL (never
SUPABASE_DB_URL, never a CLI argument) and is never printed, logged, or
stored. Begin with a newly provisioned EMPTY disposable target: this script
never drops, truncates, resets, alters, or migrates the target before
restoring. Full guide: docs/restore-supabase-instance-rehearsal.md

Usage:
  $env:RESTORE_TARGET_DB_URL = "[private disposable target URL]"
  .\scripts\restore-supabase-instance-rehearsal.ps1 `
    -BackupFile "C:\private\path\to\backup.sql" `
    -TargetLabel "disposable-rehearsal-YYYY-MM-DD" `
    -ConfirmDisposableTarget
  Remove-Item Env:RESTORE_TARGET_DB_URL
#>
param(
  [string]$BackupFile = "",
  [string]$TargetLabel = "",
  [switch]$ConfirmDisposableTarget,
  [switch]$AllowNonstandardExtension
)

$ErrorActionPreference = "Stop"
$ConfirmPhrase = "RESTORE TO DISPOSABLE TARGET"

function Fail([string]$Message) {
  Write-Host "ERROR: $Message" -ForegroundColor Red
  Write-Host "The rehearsal fails closed: do not proceed until the condition is fixed."
  exit 1
}

if ([string]::IsNullOrWhiteSpace($BackupFile)) { Fail "-BackupFile is required." }
if ([string]::IsNullOrWhiteSpace($TargetLabel)) { Fail "-TargetLabel is required." }
if (-not $ConfirmDisposableTarget) { Fail "-ConfirmDisposableTarget is required. It is the explicit acknowledgement that the target is a separately provisioned disposable database." }

if (-not (Test-Path -LiteralPath $BackupFile)) { Fail "backup file does not exist: $BackupFile" }
$backupItem = Get-Item -LiteralPath $BackupFile
if ($backupItem.PSIsContainer) { Fail "backup path is not a regular file: $BackupFile" }
if ($backupItem.Length -eq 0) { Fail "backup file is empty: $BackupFile" }
if (($backupItem.Extension -ne ".sql") -and (-not $AllowNonstandardExtension)) {
  Fail "backup file does not have a .sql extension. Pass -AllowNonstandardExtension only if you are certain it is a plain-SQL dump."
}

# Target URL: environment only, never printed. SUPABASE_DB_URL (the backup
# SOURCE variable) is deliberately never read as a target.
$targetUrl = $env:RESTORE_TARGET_DB_URL
if ([string]::IsNullOrWhiteSpace($targetUrl)) {
  Fail "RESTORE_TARGET_DB_URL is not set. Set it for this session only (see docs/restore-supabase-instance-rehearsal.md)."
}

# Defense-in-depth: refuse if the rehearsal target equals the backup-source
# variable. Neither value is printed.
if ((-not [string]::IsNullOrWhiteSpace($env:SUPABASE_DB_URL)) -and ($env:SUPABASE_DB_URL -ceq $targetUrl)) {
  Fail "RESTORE_TARGET_DB_URL matches SUPABASE_DB_URL. The rehearsal target must never be the backup source. Provision a separate disposable target."
}

if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
  Fail "psql not found on PATH. Install the PostgreSQL client tools first (docs/backup-supabase-instance.md - Prerequisites)."
}

# Target-label denylist/allowlist. Defense-in-depth only: a compliant label is
# NOT proof the target is safe — the operator remains responsible for where
# RESTORE_TARGET_DB_URL actually points.
$labelLc = $TargetLabel.ToLowerInvariant()
foreach ($banned in @("production", "prod", "canonical", "live", "primary", "oncall-foot")) {
  if ($labelLc.Contains($banned)) {
    Fail "target label contains the prohibited term '$banned'. This tool never restores to production-like targets."
  }
}
$labelOk = $false
foreach ($required in @("disposable", "test", "rehearsal", "sandbox", "temporary")) {
  if ($labelLc.Contains($required)) { $labelOk = $true }
}
if (-not $labelOk) {
  Fail "target label must contain one of: disposable, test, rehearsal, sandbox, temporary."
}

# Safe, minimal target metadata: connection check + server major version only.
# Neither the URL nor any identifying query output is ever printed.
function Get-TargetQueryValue([string]$Query) {
  try {
    $value = (& psql --dbname=$targetUrl --no-psqlrc --quiet --tuples-only --no-align --command=$Query 2>$null | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) { return $null }
    return $value
  } catch {
    return $null
  }
}

$targetVersionNum = Get-TargetQueryValue 'SHOW server_version_num;'
if (($null -eq $targetVersionNum) -or ($targetVersionNum -notmatch '^\d{5,6}$')) {
  Fail "could not connect to the rehearsal target or read its server version. Verify the disposable target and RESTORE_TARGET_DB_URL in your secure runtime environment. Nothing was restored."
}
$targetMajor = [math]::Floor([int]$targetVersionNum / 10000)

# Optional non-secret source hint: if the operator recorded the source server
# major version during the backup, it can be cross-checked here. Never a URL.
$expectedMajor = $env:RESTORE_EXPECTED_SERVER_MAJOR
if (-not [string]::IsNullOrWhiteSpace($expectedMajor)) {
  if ($expectedMajor -notmatch '^\d+$') {
    Fail "RESTORE_EXPECTED_SERVER_MAJOR must be a plain major version number (for example 17)."
  }
  if ($targetMajor -lt [int]$expectedMajor) {
    Fail "rehearsal target PostgreSQL major version $targetMajor is older than the expected source major version $expectedMajor. Provision a disposable target at the source major version or newer."
  }
}

$backupName = Split-Path -Leaf $BackupFile
$sizeLabel = if ($backupItem.Length -ge 1MB) { "{0:N1} MB" -f ($backupItem.Length / 1MB) }
             elseif ($backupItem.Length -ge 1KB) { "{0:N1} KB" -f ($backupItem.Length / 1KB) }
             else { "$($backupItem.Length) B" }

Write-Host ""
Write-Host "Restore rehearsal preflight passed. Review before continuing:"
Write-Host "  Backup file:   $backupName ($sizeLabel)"
Write-Host "  Target label:  $TargetLabel"
Write-Host "  Target server: PostgreSQL major version $targetMajor"
Write-Host "  Target URL:    (read from RESTORE_TARGET_DB_URL - never printed)"
Write-Host ""
Write-Host "This restores into the operator-labeled DISPOSABLE target only."
Write-Host "The target should be a newly provisioned EMPTY database; this script"
Write-Host "never deletes, truncates, drops, or alters the target before restoring."
Write-Host "If there is any doubt the target is disposable, abort now."
Write-Host ""
Write-Host "Type exactly: $ConfirmPhrase"
$confirmInput = Read-Host ">"
if ($confirmInput -cne $ConfirmPhrase) {
  Fail "confirmation phrase did not match. Nothing was restored."
}

Write-Host ""
Write-Host "Restoring backup into the disposable target..."
# --single-transaction makes the restore all-or-nothing: on any error psql
# rolls the entire restore back, leaving the (empty) target unchanged.
# psql stdout is fully suppressed so no SQL contents or data can leak into
# the terminal. stderr is captured to a private, operator-only error log next
# to the backup file — the same private location and sensitivity class as the
# backup itself. The log is deleted on success and its CONTENTS are never
# printed here.
$errorLog = "$BackupFile.restore-error.log"
Remove-Item -LiteralPath $errorLog -ErrorAction SilentlyContinue
try {
  & psql --dbname=$targetUrl --no-psqlrc --quiet --single-transaction --set ON_ERROR_STOP=1 --set VERBOSITY=verbose --file=$BackupFile 1> $null 2> $errorLog
} catch {
  # Native stderr can raise in strict configurations; exit code decides below.
}
if ($LASTEXITCODE -ne 0) {
  Write-Host "ERROR: psql reported a failure during the restore." -ForegroundColor Red
  Write-Host "The restore ran in a single transaction and was rolled back: the disposable"
  Write-Host "target should be unchanged by this attempt."
  Write-Host "The psql error output was captured to a private, operator-only log file:"
  Write-Host "  $errorLog"
  Write-Host "Review it privately to diagnose the failure. It may contain SQL identifiers"
  Write-Host "or hostnames: treat it exactly like the backup file itself - never commit it,"
  Write-Host "never paste it into chat, tickets, or documentation, and delete it after"
  Write-Host "diagnosis."
  Write-Host "The rehearsal fails closed: do not proceed until the condition is fixed."
  exit 1
}
Remove-Item -LiteralPath $errorLog -ErrorAction SilentlyContinue

# Non-destructive, read-only technical verification. This is a basic
# technical verification only — NOT full application-level recovery
# validation.
$verifyVersionNum = Get-TargetQueryValue 'SHOW server_version_num;'
if (($null -eq $verifyVersionNum) -or ($verifyVersionNum -notmatch '^\d{5,6}$')) {
  Fail "post-restore verification could not re-connect to the disposable target. Treat the rehearsal as unverified."
}
$publicTableCount = Get-TargetQueryValue "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"
if (($null -eq $publicTableCount) -or ($publicTableCount -notmatch '^\d+$')) {
  Fail "post-restore verification could not count public schema tables. Treat the rehearsal as unverified."
}
$verifyMajor = [math]::Floor([int]$verifyVersionNum / 10000)

Write-Host ""
Write-Host "Basic technical verification only (not full recovery validation):"
Write-Host "  Connection:           OK"
Write-Host "  Server major version: $verifyMajor"
Write-Host "  public schema tables: $publicTableCount"
Write-Host ""
Write-Host "Restore rehearsal completed against the operator-labeled disposable target."
Write-Host "Record non-secret metadata only."
Write-Host "Do not treat this target as production."
Write-Host "Delete the disposable target according to the runbook when verification is complete."
