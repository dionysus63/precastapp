# Installs Precast Ops as a Windows service using NSSM.
# Run as Administrator after deploy-app.ps1 and a successful smoke test.
#
# Example:
#   .\scripts\deploy\install-windows-service.ps1
#   .\scripts\deploy\install-windows-service.ps1 -ServiceAccount "DOMAIN\svc-precastapp" -ServicePassword $securePwd

param(
    [string] $AppRoot = "C:\Apps\precastapp",
    [string] $ServiceName = "PrecastApp",
    [string] $ServiceAccount = "",
    [securestring] $ServicePassword,
    [int] $Port = 3000
)

$ErrorActionPreference = "Stop"

function Find-Nssm {
    $cmd = Get-Command nssm -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $candidates = @(
        "C:\nssm\nssm.exe",
        "C:\Program Files\nssm\nssm.exe",
        "C:\Tools\nssm\nssm.exe"
    )
    foreach ($p in $candidates) {
        if (Test-Path $p) { return $p }
    }
    return $null
}

$nssm = Find-Nssm
if (-not $nssm) {
    Write-Host "ERROR: NSSM not found. Download from https://nssm.cc/ and add to PATH." -ForegroundColor Red
    Write-Host "       Or install to C:\nssm\nssm.exe" -ForegroundColor Red
    exit 1
}

$AppRoot = (Resolve-Path $AppRoot).Path
$startScript = Join-Path $AppRoot "scripts\deploy\start-production.ps1"

if (-not (Test-Path $startScript)) {
    Write-Host "ERROR: start-production.ps1 not found at $startScript" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path (Join-Path $AppRoot ".env"))) {
    Write-Host "ERROR: .env not found in $AppRoot" -ForegroundColor Red
    exit 1
}

$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Service '$ServiceName' already exists (Status: $($existing.Status))." -ForegroundColor Yellow
    Write-Host "Remove with: nssm remove $ServiceName confirm" -ForegroundColor Yellow
    exit 1
}

$powershell = (Get-Command powershell.exe).Source
$arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$startScript`" -Port $Port"

Write-Host "Installing Windows service: $ServiceName" -ForegroundColor Cyan
Write-Host "  App root:   $AppRoot"
Write-Host "  Entry:      $startScript"
Write-Host "  Port:       $Port"

& $nssm install $ServiceName $powershell $arguments
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& $nssm set $ServiceName AppDirectory $AppRoot
& $nssm set $ServiceName DisplayName "Precast Ops"
& $nssm set $ServiceName Description "Next.js internal app for Long Island Precast (quotes, jobs, inventory)"
& $nssm set $ServiceName Start SERVICE_AUTO_START
& $nssm set $ServiceName AppStdout (Join-Path $AppRoot "logs\service-stdout.log")
& $nssm set $ServiceName AppStderr (Join-Path $AppRoot "logs\service-stderr.log")
& $nssm set $ServiceName AppRotateFiles 1
& $nssm set $ServiceName AppRotateBytes 10485760

$logsDir = Join-Path $AppRoot "logs"
if (-not (Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir | Out-Null
}

if ($ServiceAccount) {
    Write-Host "  Run as:     $ServiceAccount"
    & $nssm set $ServiceName ObjectName $ServiceAccount
    if ($ServicePassword) {
        $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($ServicePassword)
        try {
            $plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
            & $nssm set $ServiceName ObjectName $ServiceAccount $plain
        } finally {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
        }
    } else {
        Write-Host "WARN: No -ServicePassword provided; configure service logon in services.msc if needed." -ForegroundColor Yellow
    }
}

Write-Host "Starting service..." -ForegroundColor Cyan
Start-Service $ServiceName

Start-Sleep -Seconds 3
$svc = Get-Service $ServiceName
if ($svc.Status -eq "Running") {
    Write-Host "[OK] $ServiceName is running. Open http://localhost:$Port from this server or LAN." -ForegroundColor Green
} else {
    Write-Host "[WARN] Service status: $($svc.Status). Check logs in $logsDir" -ForegroundColor Yellow
}
