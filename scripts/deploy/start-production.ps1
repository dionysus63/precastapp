# Starts Next.js in production mode with .env loaded.
# Used for smoke tests and as the NSSM service entry point.
#
# Example:
#   .\scripts\deploy\start-production.ps1
#   .\scripts\deploy\start-production.ps1 -Port 3000

param(
    [int] $Port = 0
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

if (-not (Test-Path ".env")) {
    Write-Host "ERROR: .env not found in $repoRoot" -ForegroundColor Red
    exit 1
}

# Load .env into process environment (simple KEY=VALUE parser)
Get-Content ".env" | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq "" -or $line.StartsWith("#")) { return }
    $eq = $line.IndexOf("=")
    if ($eq -lt 1) { return }
    $key = $line.Substring(0, $eq).Trim()
    $value = $line.Substring($eq + 1).Trim()
    if ($value.StartsWith('"') -and $value.EndsWith('"')) {
        $value = $value.Substring(1, $value.Length - 2)
    }
    [Environment]::SetEnvironmentVariable($key, $value, "Process")
}

if ($Port -gt 0) {
    [Environment]::SetEnvironmentVariable("PORT", "$Port", "Process")
}

if (-not $env:NODE_ENV) {
    [Environment]::SetEnvironmentVariable("NODE_ENV", "production", "Process")
}

if (-not $env:HOSTNAME) {
    [Environment]::SetEnvironmentVariable("HOSTNAME", "0.0.0.0", "Process")
}

if (-not (Test-Path ".next")) {
    Write-Host "ERROR: No production build found. Run deploy-app.ps1 first." -ForegroundColor Red
    exit 1
}

$listenPort = if ($env:PORT) { $env:PORT } else { "3000" }
Write-Host "Starting Precast Ops on http://$($env:HOSTNAME):$listenPort (NODE_ENV=$($env:NODE_ENV))" -ForegroundColor Cyan

& npm run start
