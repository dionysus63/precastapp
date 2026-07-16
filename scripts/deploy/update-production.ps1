# One-command production update for the office server:
#   stop service -> git pull -> deploy-app.ps1 (npm ci, migrate, generate,
#   build) -> start service, with best-effort rollback of the previous build
#   if anything fails.
#
# Example:
#   .\scripts\deploy\update-production.ps1
#   .\scripts\deploy\update-production.ps1 -SkipInstall
#   npm run deploy:update

param(
    [string] $ServiceName = "PrecastApp",
    [string] $HealthCheckUrl = "http://localhost:3000/login",
    [switch] $SkipInstall
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

$buildDir = Join-Path $repoRoot ".next"
$rollbackDir = Join-Path $repoRoot ".next.rollback"

function Start-AppService {
    Write-Host "`n== starting $ServiceName ==" -ForegroundColor Cyan
    Start-Service -Name $ServiceName
}

$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $service) {
    Write-Host "ERROR: service '$ServiceName' not found on this machine." -ForegroundColor Red
    exit 1
}

Write-Host "Updating Precast Ops in $repoRoot (service: $ServiceName)" -ForegroundColor Cyan

Write-Host "`n== stopping $ServiceName ==" -ForegroundColor Cyan
if ($service.Status -ne "Stopped") {
    Stop-Service -Name $ServiceName -Force
}

Write-Host "`n== git pull ==" -ForegroundColor Cyan
# gc.auto=0: auto-repack after a pull can hit locked pack files on Windows
# and stall on an interactive prompt; skip it entirely during deploys.
git -c gc.auto=0 pull --ff-only
if ($LASTEXITCODE -ne 0) {
    Write-Host "git pull failed - restarting the service on the old version." -ForegroundColor Red
    Start-AppService
    exit 1
}

# Keep the previous build so a failed build doesn't leave a dead server.
if (Test-Path $rollbackDir) {
    Remove-Item $rollbackDir -Recurse -Force
}
if (Test-Path $buildDir) {
    Rename-Item $buildDir ".next.rollback"
}

$deployArgs = @()
if ($SkipInstall) { $deployArgs += "-SkipInstall" }
& (Join-Path $PSScriptRoot "deploy-app.ps1") @deployArgs
if ($LASTEXITCODE -ne 0) {
    Write-Host "`nDeploy build failed." -ForegroundColor Red
    if (Test-Path $rollbackDir) {
        Write-Host "Restoring the previous build and restarting the service." -ForegroundColor Yellow
        Write-Host "NOTE: dependencies/migrations may already be newer than this build - update again soon." -ForegroundColor Yellow
        if (Test-Path $buildDir) {
            Remove-Item $buildDir -Recurse -Force
        }
        Rename-Item $rollbackDir ".next"
        Start-AppService
    } else {
        Write-Host "No previous build to restore - service left stopped." -ForegroundColor Red
    }
    exit 1
}

if (Test-Path $rollbackDir) {
    Remove-Item $rollbackDir -Recurse -Force
}

Start-AppService

Write-Host "`n== health check ==" -ForegroundColor Cyan
$healthy = $false
for ($attempt = 1; $attempt -le 12; $attempt++) {
    Start-Sleep -Seconds 5
    try {
        $response = Invoke-WebRequest -Uri $HealthCheckUrl -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            $healthy = $true
            break
        }
    } catch {
        # Server still warming up; retry.
    }
}

if ($healthy) {
    $version = git log -1 --format="%h %s"
    Write-Host "`nUpdate complete and healthy: $version" -ForegroundColor Green
} else {
    Write-Host "`nService started but $HealthCheckUrl did not answer within 60s - check the service logs." -ForegroundColor Yellow
    exit 1
}
