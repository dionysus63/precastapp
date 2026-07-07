# Nightly backup for the precastapp PostgreSQL database.
#
# - Reads the connection string from .env (DATABASE_URL) so there is a single
#   source of truth for credentials.
# - Writes a compressed pg_dump custom-format archive (.dump) that pg_restore
#   can restore selectively.
# - Keeps the most recent 30 days of backups and prunes older ones.
#
# Restore (see COMMANDS.md):
#   & "C:\Program Files\PostgreSQL\18\bin\pg_restore.exe" -U postgres -h localhost `
#       -d precastapp --clean --if-exists "C:\Backups\precastapp\<file>.dump"
#
# Scheduled via Windows Task Scheduler (task name: "PrecastApp DB Backup").

$ErrorActionPreference = "Stop"

$PgBin = "C:\Program Files\PostgreSQL\18\bin"
$BackupDir = "C:\Backups\precastapp"
$RetentionDays = 30
$EnvFile = Join-Path $PSScriptRoot "..\.env"

# --- Parse DATABASE_URL from .env ---
$envLine = Get-Content $EnvFile | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
if (-not $envLine) {
    throw "DATABASE_URL not found in $EnvFile"
}
$url = ($envLine -replace '^\s*DATABASE_URL\s*=\s*', '').Trim().Trim('"')
if ($url -notmatch '^postgresql://([^:]+):([^@]+)@([^:/]+):(\d+)/([^?]+)') {
    throw "DATABASE_URL is not in the expected postgresql://user:pass@host:port/db format"
}
$DbUser = $Matches[1]
$DbPass = $Matches[2]
$DbHost = $Matches[3]
$DbPort = $Matches[4]
$DbName = $Matches[5]

# --- Run the dump ---
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Force $BackupDir | Out-Null
}
$stamp = Get-Date -Format "yyyy-MM-dd_HHmm"
$target = Join-Path $BackupDir "$DbName`_$stamp.dump"
$logFile = Join-Path $BackupDir "backup.log"

$env:PGPASSWORD = $DbPass
try {
    & (Join-Path $PgBin "pg_dump.exe") -U $DbUser -h $DbHost -p $DbPort -Fc -f $target $DbName
    if ($LASTEXITCODE -ne 0) {
        throw "pg_dump exited with code $LASTEXITCODE"
    }
} finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

$size = (Get-Item $target).Length
if ($size -lt 10KB) {
    throw "Backup file suspiciously small ($size bytes): $target"
}

# --- Prune old backups ---
$cutoff = (Get-Date).AddDays(-$RetentionDays)
$pruned = @(Get-ChildItem $BackupDir -Filter "*.dump" | Where-Object { $_.LastWriteTime -lt $cutoff })
$pruned | Remove-Item -Force -Confirm:$false

$sizeMb = [math]::Round($size / 1MB, 1)
Add-Content -Encoding utf8 $logFile "$(Get-Date -Format s) OK $([System.IO.Path]::GetFileName($target)) ${sizeMb}MB (pruned $($pruned.Count))"
Write-Output "Backup written: $target (${sizeMb} MB); pruned $($pruned.Count) old backup(s)."
