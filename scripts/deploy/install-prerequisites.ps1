# Checks Node.js, PostgreSQL 18, Git, and a Chromium browser for office deployment.
# Does not install software automatically — reports status and download links.
# Run from repo root: .\scripts\deploy\install-prerequisites.ps1

$ErrorActionPreference = "Stop"

function Test-CommandExists($name) {
    return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

Write-Host "Precast Ops — prerequisite check" -ForegroundColor Cyan
Write-Host ""

$allOk = $true

# Node.js
if (Test-CommandExists "node") {
    $nodeVersion = node -v
    $major = [int]($nodeVersion -replace "^v(\d+).*", '$1')
    if ($major -ge 20) {
        Write-Host "[OK] Node.js $nodeVersion" -ForegroundColor Green
    } else {
        Write-Host "[WARN] Node.js $nodeVersion — need v20 LTS or newer" -ForegroundColor Yellow
        $allOk = $false
    }
} else {
    Write-Host "[MISSING] Node.js — install from https://nodejs.org (20 LTS or 22 LTS)" -ForegroundColor Red
    $allOk = $false
}

# npm
if (Test-CommandExists "npm") {
    Write-Host "[OK] npm $(npm -v)" -ForegroundColor Green
} else {
    Write-Host "[MISSING] npm (install with Node.js)" -ForegroundColor Red
    $allOk = $false
}

# Git
if (Test-CommandExists "git") {
    Write-Host "[OK] Git $(git --version)" -ForegroundColor Green
} else {
    Write-Host "[MISSING] Git — https://git-scm.com/download/win" -ForegroundColor Red
    $allOk = $false
}

# PostgreSQL 18
$pgService = Get-Service -Name "postgresql-x64-18" -ErrorAction SilentlyContinue
$psqlPath = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
if (Test-Path $psqlPath) {
    $svcStatus = if ($pgService) { $pgService.Status } else { "unknown" }
    if ($svcStatus -eq "Running") {
        Write-Host "[OK] PostgreSQL 18 (service running)" -ForegroundColor Green
    } else {
        Write-Host "[WARN] PostgreSQL 18 installed but service status: $svcStatus" -ForegroundColor Yellow
        Write-Host "       Start with: Start-Service postgresql-x64-18" -ForegroundColor Yellow
        $allOk = $false
    }
} else {
    Write-Host "[MISSING] PostgreSQL 18 — https://www.postgresql.org/download/windows/" -ForegroundColor Red
    $allOk = $false
}

# Chromium browser for PDFs
$browserPaths = @(
    "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\Application\brave.exe",
    "C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe",
    "C:\Program Files\Google\Chrome\Application\chrome.exe"
)
$foundBrowser = $false
foreach ($p in $browserPaths) {
    if (Test-Path $p) {
        Write-Host "[OK] Browser for PDFs: $p" -ForegroundColor Green
        $foundBrowser = $true
        break
    }
}
if (-not $foundBrowser) {
    Write-Host "[WARN] No Brave/Chrome found — install one, or run 'npm run puppeteer:install' after deploy" -ForegroundColor Yellow
}

# NSSM (optional, for Phase 5)
if (Test-CommandExists "nssm") {
    Write-Host "[OK] NSSM available for Windows service install" -ForegroundColor Green
} else {
    Write-Host "[INFO] NSSM not in PATH — needed for install-windows-service.ps1 (https://nssm.cc/)" -ForegroundColor Gray
}

Write-Host ""
if ($allOk) {
    Write-Host "Core prerequisites look good. Next: verify UNC access, create .env, run deploy-app.ps1" -ForegroundColor Green
    exit 0
} else {
    Write-Host "Fix missing items above, then re-run this script." -ForegroundColor Yellow
    exit 1
}
