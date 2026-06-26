# Builds the Windows Electron installer for staff PCs (thin client).
# Run from repo root on a machine with Node.js — not required on each desk PC.
#
# Example:
#   .\scripts\deploy\build-electron-client.ps1 -ServerUrl "http://precast-srv:3000"

param(
    [Parameter(Mandatory = $true)]
    [string] $ServerUrl
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

$trimmed = $ServerUrl.Trim().TrimEnd("/")
if ($trimmed -notmatch "^https?://") {
    Write-Host "ERROR: ServerUrl must start with http:// or https:// (e.g. http://precast-srv:3000)" -ForegroundColor Red
    exit 1
}

$configPath = Join-Path $repoRoot "electron\config.default.json"
$config = @{ serverUrl = $trimmed } | ConvertTo-Json
Set-Content -Path $configPath -Value $config -Encoding UTF8

Write-Host "Building Precast Ops Electron client" -ForegroundColor Cyan
Write-Host "  Server URL: $trimmed"
Write-Host "  Wrote:      $configPath"
Write-Host ""

if (-not (Test-Path "node_modules\electron")) {
    Write-Host "Installing dependencies (including electron)..." -ForegroundColor Cyan
    npm ci
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "Running electron-builder..." -ForegroundColor Cyan
npm run electron:build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$outputDir = Join-Path $repoRoot "dist\electron"
$installers = Get-ChildItem $outputDir -Filter "*.exe" -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like "*Setup*" } |
    Sort-Object LastWriteTime -Descending

Write-Host ""
if ($installers.Count -gt 0) {
    Write-Host "[OK] Installer ready:" -ForegroundColor Green
    foreach ($installer in $installers) {
        Write-Host "  $($installer.FullName)"
    }
    Write-Host ""
    Write-Host "Copy the installer to staff PCs or deploy via GPO/RMM." -ForegroundColor Cyan
    Write-Host "Staff can override the URL later via %APPDATA%\Precast Ops\config.json" -ForegroundColor Gray
} else {
    Write-Host "Build finished. Check $outputDir for output files." -ForegroundColor Yellow
}
