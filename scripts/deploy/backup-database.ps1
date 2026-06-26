# PostgreSQL backup via pg_dump. Schedule with Windows Task Scheduler for nightly backups.
#
# Example:
#   .\scripts\deploy\backup-database.ps1
#   .\scripts\deploy\backup-database.ps1 -OutputDir "D:\Backups\precastapp" -RetentionDays 30

param(
    [string] $OutputDir = "D:\Backups\precastapp",
    [int] $RetentionDays = 30,
    [string] $PgDumpPath = "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$envFile = Join-Path $repoRoot ".env"

if (-not (Test-Path $envFile)) {
    Write-Host "ERROR: .env not found at $envFile" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $PgDumpPath)) {
    Write-Host "ERROR: pg_dump not found at $PgDumpPath" -ForegroundColor Red
    exit 1
}

# Parse DATABASE_URL from .env
$dbUrl = $null
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*DATABASE_URL\s*=\s*"(.+)"\s*$') {
        $dbUrl = $matches[1]
    } elseif ($_ -match "^\s*DATABASE_URL\s*=\s*'(.+)'\s*$") {
        $dbUrl = $matches[1]
    } elseif ($_ -match '^\s*DATABASE_URL\s*=\s*(\S+)') {
        $dbUrl = $matches[1]
    }
}

if (-not $dbUrl) {
    Write-Host "ERROR: DATABASE_URL not found in .env" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$outFile = Join-Path $OutputDir "precastapp_$timestamp.dump"

Write-Host "Backing up database to $outFile" -ForegroundColor Cyan

$env:PGPASSWORD = $null
try {
    $uri = [Uri]$dbUrl
    if ($uri.UserInfo -match "^([^:]*):?(.*)$") {
        $pgUser = $uri.UserInfo.Split(":")[0]
        if ($uri.UserInfo.Contains(":")) {
            $env:PGPASSWORD = $uri.UserInfo.Substring($uri.UserInfo.IndexOf(":") + 1)
        }
    } else {
        $pgUser = "postgres"
    }
    $pgHost = $uri.Host
    if ($uri.Port -gt 0) { $pgHost = "$($uri.Host):$($uri.Port)" }
    $pgDb = $uri.AbsolutePath.TrimStart("/")

    & $PgDumpPath -h $uri.Host -p $uri.Port -U $pgUser -d $pgDb -Fc -f $outFile
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: pg_dump failed with exit code $LASTEXITCODE" -ForegroundColor Red
        exit $LASTEXITCODE
    }
} finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

$sizeMb = [math]::Round((Get-Item $outFile).Length / 1MB, 2)
Write-Host "[OK] Backup complete ($sizeMb MB)" -ForegroundColor Green

if ($RetentionDays -gt 0) {
    $cutoff = (Get-Date).AddDays(-$RetentionDays)
    $removed = Get-ChildItem $OutputDir -Filter "precastapp_*.dump" |
        Where-Object { $_.LastWriteTime -lt $cutoff }
    foreach ($old in $removed) {
        Remove-Item $old.FullName -Force
        Write-Host "Removed old backup: $($old.Name)" -ForegroundColor Gray
    }
}
