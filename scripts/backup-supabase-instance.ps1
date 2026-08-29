<#
backup-supabase-instance.ps1 — private logical backup of a Foot instance's
Supabase PostgreSQL database using pg_dump (Windows PowerShell alternative
to scripts/backup-supabase-instance.sh).

Usage:
  $env:SUPABASE_DB_URL = "postgresql://postgres:...@db.example.com:5432/postgres"
  .\scripts\backup-supabase-instance.ps1 [-OutputDir <dir>]

The connection string is read ONLY from the environment (SUPABASE_DB_URL, or
DATABASE_URL as an explicit operator-set fallback) and is never printed,
logged, or stored. Output: supabase-backup-YYYY-MM-DD-HHMM.sql in the chosen
directory. Never commit the backup file to Git.

Preflight: pg_dump must be the same major version as, or newer than, the
target PostgreSQL server (an older client aborts and produces no usable
backup). psql is required to read the target server version; only version
numbers are ever printed.
Full guide: docs/backup-supabase-instance.md
#>
param(
  [string]$OutputDir = "."
)

$ErrorActionPreference = "Stop"

$dbUrl = $env:SUPABASE_DB_URL
if ([string]::IsNullOrWhiteSpace($dbUrl)) { $dbUrl = $env:DATABASE_URL }
if ([string]::IsNullOrWhiteSpace($dbUrl)) {
  Write-Host "ERROR: SUPABASE_DB_URL is not set (and no DATABASE_URL fallback was set)." -ForegroundColor Red
  Write-Host "Set it for this shell session only - see docs/backup-supabase-instance.md."
  exit 1
}

if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
  Write-Host "ERROR: pg_dump not found on PATH." -ForegroundColor Red
  Write-Host "Install the PostgreSQL client tools first (docs/backup-supabase-instance.md - Prerequisites)."
  exit 1
}

if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
  Write-Host "ERROR: psql not found on PATH." -ForegroundColor Red
  Write-Host "psql is required for the version-compatibility preflight (it reads the"
  Write-Host "target server version). Install the PostgreSQL client tools first"
  Write-Host "(docs/backup-supabase-instance.md - Prerequisites)."
  exit 1
}

# --- Version-compatibility preflight ----------------------------------------
# pg_dump must be the same major version as, or newer than, the target
# PostgreSQL server; an older client aborts mid-dump and produces no usable
# backup. Only version numbers are read and printed here — never the
# connection string and never query output containing sensitive identifiers.
# The target version can only be learned after connecting, so run this script
# only from a trusted environment with runtime-only secret injection. The
# preflight performs no database mutation.
$pgDumpVersionRaw = ""
try { $pgDumpVersionRaw = (& pg_dump --version 2>$null | Out-String).Trim() } catch { $pgDumpVersionRaw = "" }
$pgDumpMajor = $null
if ($pgDumpVersionRaw -match '^pg_dump \(PostgreSQL[^)]*\) (\d+)') { $pgDumpMajor = [int]$Matches[1] }
if ($null -eq $pgDumpMajor) {
  Write-Host "ERROR: could not determine the local pg_dump major version." -ForegroundColor Red
  Write-Host "'pg_dump --version' returned malformed or empty output. Reinstall the"
  Write-Host "PostgreSQL client tools, then retry. No backup was created."
  exit 1
}

$serverVersionNum = ""
try {
  $serverVersionNum = (& psql --dbname=$dbUrl --no-psqlrc --quiet --tuples-only --no-align --command='SHOW server_version_num;' 2>$null | Out-String).Trim()
  if ($LASTEXITCODE -ne 0) { $serverVersionNum = "" }
} catch { $serverVersionNum = "" }
if ($serverVersionNum -notmatch '^\d{5,6}$') {
  Write-Host "ERROR: could not determine the target PostgreSQL server major version." -ForegroundColor Red
  Write-Host "The preflight version query failed or returned unexpected output."
  Write-Host "Verify connectivity and the connection string in your secure runtime"
  Write-Host "environment, then retry. No backup was created."
  exit 1
}
$serverMajor = [math]::Floor([int]$serverVersionNum / 10000)

if ($pgDumpMajor -lt $serverMajor) {
  Write-Host "ERROR: pg_dump major version $pgDumpMajor is older than target PostgreSQL major version $serverMajor." -ForegroundColor Red
  Write-Host "Install or select PostgreSQL client version $serverMajor or newer, then retry."
  Write-Host "No backup was created."
  exit 1
}
Write-Host "Preflight OK: pg_dump major $pgDumpMajor / target PostgreSQL major $serverMajor."

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$stamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd-HHmm")
$outFile = Join-Path $OutputDir "supabase-backup-$stamp.sql"
# Safe to re-run: never overwrite an earlier backup from the same minute.
if (Test-Path $outFile) {
  $stamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd-HHmmss")
  $outFile = Join-Path $OutputDir "supabase-backup-$stamp.sql"
}

Write-Host "Starting logical backup (public schema, plain SQL)..."
& pg_dump `
  --dbname=$dbUrl `
  --schema=public `
  --format=plain `
  --no-owner `
  --no-privileges `
  --file=$outFile
if ($LASTEXITCODE -ne 0) {
  Write-Host "ERROR: pg_dump failed - no usable backup was produced." -ForegroundColor Red
  if (Test-Path $outFile) { Remove-Item $outFile -Force }
  exit 1
}

if (-not (Test-Path $outFile)) {
  Write-Host "ERROR: backup file is missing: $outFile" -ForegroundColor Red
  exit 1
}
$item = Get-Item $outFile
if ($item.Length -eq 0) {
  Write-Host "ERROR: backup file is empty: $outFile" -ForegroundColor Red
  exit 1
}

$size = if ($item.Length -ge 1MB) { "{0:N1} MB" -f ($item.Length / 1MB) }
        elseif ($item.Length -ge 1KB) { "{0:N1} KB" -f ($item.Length / 1KB) }
        else { "$($item.Length) B" }

$gitCheck = Get-Command git -ErrorAction SilentlyContinue
if ($gitCheck) {
  & git -C $OutputDir rev-parse --is-inside-work-tree 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "WARNING: the backup file was written inside a Git working tree." -ForegroundColor Yellow
    Write-Host "         Move it to private storage now and NEVER commit it." -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "Backup complete."
Write-Host "  File:      $outFile"
Write-Host "  Size:      $size"
Write-Host "  Timestamp: $stamp (UTC)"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Move the file to secure private storage (encrypted drive or"
Write-Host "     password-manager attachment). Never commit it to Git."
Write-Host "  2. Open the file and confirm it contains SQL statements."
Write-Host "  3. Update the instance registry: backup_method, backup_verified_date,"
Write-Host "     backup_artifact_label, backup_location_note."
