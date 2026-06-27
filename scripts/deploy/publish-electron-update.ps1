# Builds the Electron installer and publishes update files for auto-update.
# Run from the DEV PC repo root (C:\Projects\precastapp).
# Update files are copied to the SERVER (C:\Apps\precastapp\public\updates).
#
# Example (dev PC — build and copy to server admin share):
#   .\scripts\deploy\publish-electron-update.ps1 `
#     -ServerUrl "http://192.168.1.20:3000" `
#     -CopyTo "\\LIP-TITAN\C$\Apps\precastapp\public\updates"

param(
    [Parameter(Mandatory = $true)]
    [string] $ServerUrl,

    [string] $CopyTo = "",

    [switch] $SkipBuild
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

$trimmed = $ServerUrl.Trim().TrimEnd("/")
if ($trimmed -notmatch "^https?://") {
    Write-Host "ERROR: ServerUrl must start with http:// or https://" -ForegroundColor Red
    exit 1
}

$electronPkgPath = Join-Path $repoRoot "electron\package.json"
$electronPkg = Get-Content $electronPkgPath -Raw | ConvertFrom-Json
$version = $electronPkg.version

Write-Host "Publishing Precast Ops desktop update v$version" -ForegroundColor Cyan
Write-Host "  Update feed: $trimmed/updates"
Write-Host ""

if (-not $SkipBuild) {
    & (Join-Path $PSScriptRoot "build-electron-client.ps1") -ServerUrl $trimmed
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

$outputDir = Join-Path $repoRoot "dist\electron"
if (-not (Test-Path $outputDir)) {
    Write-Host "ERROR: Build output not found at $outputDir" -ForegroundColor Red
    exit 1
}

$latestYml = Join-Path $outputDir "latest.yml"
if (-not (Test-Path $latestYml)) {
    Write-Host "ERROR: latest.yml not found. electron-builder should emit this in dist\electron" -ForegroundColor Red
    exit 1
}

$publishDir = if ($CopyTo) {
    $CopyTo.Trim().TrimEnd("\")
} else {
    Join-Path $repoRoot "public\updates"
}

if (-not (Test-Path $publishDir)) {
    New-Item -ItemType Directory -Path $publishDir -Force | Out-Null
}

Write-Host "Copying update artifacts to $publishDir" -ForegroundColor Cyan

Copy-Item -Path $latestYml -Destination (Join-Path $publishDir "latest.yml") -Force

$artifacts = Get-ChildItem $outputDir -File |
    Where-Object {
        $_.Extension -in @(".exe", ".blockmap") -and
        $_.Name -like "*Setup*"
    }

if ($artifacts.Count -eq 0) {
    Write-Host "ERROR: No Setup *.exe found in $outputDir" -ForegroundColor Red
    exit 1
}

foreach ($file in $artifacts) {
    Copy-Item -Path $file.FullName -Destination (Join-Path $publishDir $file.Name) -Force
    Write-Host "  $($file.Name)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "[OK] Desktop update v$version published." -ForegroundColor Green
Write-Host "     Feed URL: $trimmed/updates/latest.yml" -ForegroundColor Green
Write-Host ""
Write-Host "If this folder is on the app server, clients will pick up the update automatically." -ForegroundColor Cyan
Write-Host ""
Write-Host "Typical workflow:" -ForegroundColor Gray
Write-Host "  Dev PC  — build here (this script)" -ForegroundColor Gray
Write-Host "  Server  — hosts public\updates\ (use -CopyTo \\SERVER\C$\Apps\precastapp\public\updates)" -ForegroundColor Gray
Write-Host "  Staff   — auto-update; no action needed" -ForegroundColor Gray
