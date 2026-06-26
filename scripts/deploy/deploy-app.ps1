# Production build and database migration for office server.
# Run from repo root after creating .env from .env.example.
#
# Example:
#   .\scripts\deploy\deploy-app.ps1
#   .\scripts\deploy\deploy-app.ps1 -Seed
#   .\scripts\deploy\deploy-app.ps1 -SkipInstall

param(
    [switch] $Seed,
    [switch] $SkipInstall
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

Write-Host "Deploying Precast Ops from $repoRoot" -ForegroundColor Cyan

if (-not (Test-Path ".env")) {
    Write-Host "ERROR: .env not found. Copy .env.example to .env and set DATABASE_URL." -ForegroundColor Red
    exit 1
}

if (-not $SkipInstall) {
    Write-Host "`n== npm ci ==" -ForegroundColor Cyan
    npm ci
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "`n== prisma migrate deploy ==" -ForegroundColor Cyan
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n== prisma generate ==" -ForegroundColor Cyan
npx prisma generate
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n== npm run build ==" -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if ($Seed) {
    Write-Host "`n== npm run db:seed ==" -ForegroundColor Cyan
    npm run db:seed
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "`nDeploy build complete. Run start-production.ps1 to smoke test, or install-windows-service.ps1 for 24/7." -ForegroundColor Green
