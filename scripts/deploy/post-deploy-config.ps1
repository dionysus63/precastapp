# Post-deploy configuration reminders (browser steps + optional file sync).
# Run after deploy-app.ps1 and before office rollout.
#
# Example:
#   .\scripts\deploy\post-deploy-config.ps1 -SyncJobFiles

param(
    [switch] $SyncJobFiles
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

Write-Host @"

================================================================================
  Post-deploy configuration (browser)
================================================================================

  1. Open http://localhost:3000/login and sign in as admin.

  2. Settings -> Files & Folders
     - Jobs root: your UNC (e.g. \\FILESERVER\PrecastJobs)
     - Stock submittals root
     - Quote PDF fallback directory
     - Click "Test write access" for each path

  3. Settings -> Company / System — logo, tax rate, estimators, trucks

  4. Settings -> Users & Access — add all office staff

  See docs/DEPLOYMENT.md Phase 4 and docs/office-rollout.md

================================================================================

"@ -ForegroundColor Cyan

if ($SyncJobFiles) {
    Write-Host "Running npm run db:sync-files ..." -ForegroundColor Cyan
    npm run db:sync-files
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    Write-Host "[OK] Job file index sync complete." -ForegroundColor Green
}
