# One-command production update for the office server:
#   stop service -> back up the database -> git pull -> deploy-app.ps1
#   (npm ci, migrate, generate, build) -> start service -> health check.
#
# If any step after the pull fails, the update is rolled back fully:
#   - the git checkout returns to the previous commit (git reset --keep, so
#     uncommitted local edits are kept or the reset refuses)
#   - the previous .next build, node_modules and generated Prisma client are
#     put back
#   - if migrations ran, the database is restored from the pre-update backup
#     into a fresh database that is swapped in by rename; the migrated
#     database is kept as <db>_failed_<stamp> for inspection
# The service is only restarted when every piece was restored. Otherwise it
# is left stopped and the script prints the manual steps.
#
# Example:
#   .\scripts\deploy\update-production.ps1
#   .\scripts\deploy\update-production.ps1 -SkipInstall
#   npm run deploy:update

param(
    [string] $ServiceName = "PrecastApp",
    [string] $HealthCheckUrl = "http://localhost:3000/login",
    [string] $BackupDir = "C:\Backups\precastapp\pre-update",
    [int] $KeepBackups = 10,
    [string] $PgBin = "C:\Program Files\PostgreSQL\18\bin",
    [switch] $SkipInstall
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

$buildDir = Join-Path $repoRoot ".next"
$buildRollbackDir = Join-Path $repoRoot ".next.rollback"
$modulesDir = Join-Path $repoRoot "node_modules"
$modulesRollbackDir = Join-Path $repoRoot "node_modules.rollback"
$clientDir = Join-Path $repoRoot "app\generated\prisma"
$clientRollbackDir = Join-Path $repoRoot "app\generated\prisma.rollback"

$pgDump = Join-Path $PgBin "pg_dump.exe"
$pgRestore = Join-Path $PgBin "pg_restore.exe"
$psql = Join-Path $PgBin "psql.exe"

function Start-AppService {
    Write-Host "`n== starting $ServiceName ==" -ForegroundColor Cyan
    Start-Service -Name $ServiceName
}

function Remove-IfExists([string] $Path) {
    if (Test-Path $Path) {
        Remove-Item $Path -Recurse -Force
    }
}

# Reads DATABASE_URL from .env (same format scripts\backup-database.ps1 expects).
function Get-DbConnection {
    $envFile = Join-Path $repoRoot ".env"
    if (-not (Test-Path $envFile)) {
        throw ".env not found at $envFile"
    }
    $line = Get-Content $envFile | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
    if (-not $line) {
        throw "DATABASE_URL not found in $envFile"
    }
    $url = ($line -replace '^\s*DATABASE_URL\s*=\s*', '').Trim().Trim('"').Trim("'")
    if ($url -notmatch '^postgres(?:ql)?://([^:@/]+)(?::([^@]*))?@([^:/?]+)(?::(\d+))?/([^?]+)') {
        throw "DATABASE_URL is not in the expected postgresql://user:pass@host:port/db format"
    }
    $port = "5432"
    if ($Matches[4]) { $port = $Matches[4] }
    return [pscustomobject]@{
        User     = [Uri]::UnescapeDataString($Matches[1])
        Password = [Uri]::UnescapeDataString([string]$Matches[2])
        Host     = $Matches[3]
        Port     = $port
        Name     = [Uri]::UnescapeDataString($Matches[5])
    }
}

# Runs a PostgreSQL client tool with the .env credentials. Native stderr must
# not trip $ErrorActionPreference = "Stop", so the caller checks the exit code.
function Invoke-PgTool([string] $Exe, [string[]] $ToolArgs) {
    $ErrorActionPreference = "Continue"
    $env:PGPASSWORD = $db.Password
    try {
        # Out-Host keeps tool output (e.g. "CREATE DATABASE") out of the return value.
        & $Exe -h $db.Host -p $db.Port -U $db.User -w @ToolArgs | Out-Host
        return $LASTEXITCODE
    } finally {
        Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    }
}

# A fingerprint of _prisma_migrations: it changes whenever migrate deploy
# starts any migration, including one that fails halfway.
function Get-MigrationFingerprint {
    $ErrorActionPreference = "Continue"
    $env:PGPASSWORD = $db.Password
    try {
        $out = & $psql -h $db.Host -p $db.Port -U $db.User -w -d $db.Name -tA -c `
            "SELECT count(*) || '|' || coalesce(max(started_at)::text, '') || '|' || count(finished_at) FROM _prisma_migrations" 2>$null
        if ($LASTEXITCODE -ne 0) { return $null }
        return ($out | Out-String).Trim()
    } finally {
        Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    }
}

function Write-ManualDbRestore {
    Write-Host "`nTo restore the database by hand (service stopped):" -ForegroundColor Yellow
    Write-Host "  & `"$psql`" -U $($db.User) -h $($db.Host) -p $($db.Port) -d postgres -c `"CREATE DATABASE $($db.Name)_restore;`"" -ForegroundColor Yellow
    Write-Host "  & `"$pgRestore`" -U $($db.User) -h $($db.Host) -p $($db.Port) -d $($db.Name)_restore `"$backupFile`"" -ForegroundColor Yellow
    Write-Host "  & `"$psql`" -U $($db.User) -h $($db.Host) -p $($db.Port) -d postgres -c `"ALTER DATABASE $($db.Name) RENAME TO $($db.Name)_failed;`"" -ForegroundColor Yellow
    Write-Host "  & `"$psql`" -U $($db.User) -h $($db.Host) -p $($db.Port) -d postgres -c `"ALTER DATABASE $($db.Name)_restore RENAME TO $($db.Name);`"" -ForegroundColor Yellow
    Write-Host "Close pgAdmin/psql sessions on $($db.Name) first, or the rename fails." -ForegroundColor Yellow
}

# Restores the pre-update backup into a new database, then swaps it in by
# renaming, so the live database is never half-restored. Returns $true when
# the restored copy is live under the original name.
function Restore-Database {
    if ($db.Name -notmatch '^[a-z_][a-z0-9_]*$') {
        Write-Host "Database name '$($db.Name)' needs quoting; not restoring automatically." -ForegroundColor Red
        return $false
    }

    $restoreDb = "$($db.Name)_rollback_$stamp"
    $failedDb = "$($db.Name)_failed_$stamp"

    Write-Host "`n== restoring database from $backupFile ==" -ForegroundColor Cyan
    if ((Invoke-PgTool $psql @("-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", "CREATE DATABASE $restoreDb;")) -ne 0) {
        Write-Host "Could not create $restoreDb." -ForegroundColor Red
        return $false
    }
    if ((Invoke-PgTool $pgRestore @("-d", $restoreDb, "--exit-on-error", $backupFile)) -ne 0) {
        Write-Host "pg_restore into $restoreDb failed; live database left as is (migrated)." -ForegroundColor Red
        Invoke-PgTool $psql @("-d", "postgres", "-c", "DROP DATABASE IF EXISTS $restoreDb;") | Out-Null
        return $false
    }

    # The service is stopped; drop any other sessions (pgAdmin, psql) so the
    # rename can take the database.
    Invoke-PgTool $psql @("-d", "postgres", "-tA", "-c",
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$($db.Name)' AND pid <> pg_backend_pid();") | Out-Null

    if ((Invoke-PgTool $psql @("-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", "ALTER DATABASE $($db.Name) RENAME TO $failedDb;")) -ne 0) {
        Write-Host "Could not rename $($db.Name) (still in use?). The restored copy is ready as $restoreDb." -ForegroundColor Red
        return $false
    }
    if ((Invoke-PgTool $psql @("-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", "ALTER DATABASE $restoreDb RENAME TO $($db.Name);")) -ne 0) {
        Write-Host "Could not rename $restoreDb into place; putting the migrated database back." -ForegroundColor Red
        Invoke-PgTool $psql @("-d", "postgres", "-c", "ALTER DATABASE $failedDb RENAME TO $($db.Name);") | Out-Null
        return $false
    }

    Write-Host "Database restored. The migrated copy is kept as $failedDb; drop it once you no longer need it:" -ForegroundColor Green
    Write-Host "  & `"$psql`" -U $($db.User) -h $($db.Host) -p $($db.Port) -d postgres -c `"DROP DATABASE $failedDb;`"" -ForegroundColor Gray
    return $true
}

# Puts code, build, dependencies, Prisma client and (if migrations ran) the
# database back to their pre-update state. Returns $true when all of it worked.
function Invoke-Rollback {
    $ok = $true
    Write-Host "`n== rolling back ==" -ForegroundColor Yellow

    $current = (git rev-parse HEAD).Trim()
    if ($current -ne $previousCommit) {
        git -c gc.auto=0 reset --keep $previousCommit | Out-Host
        if ($LASTEXITCODE -ne 0) {
            Write-Host "git reset --keep $previousCommit failed (local edits in the way?)." -ForegroundColor Red
            $ok = $false
        } else {
            Write-Host "Code back at $previousCommit." -ForegroundColor Green
        }
    }

    try {
        if (Test-Path $buildRollbackDir) {
            Remove-IfExists $buildDir
            Rename-Item $buildRollbackDir ".next"
            Write-Host "Previous build restored." -ForegroundColor Green
        } elseif (-not (Test-Path $buildDir)) {
            Write-Host "No previous build to restore." -ForegroundColor Red
            $ok = $false
        }
        if (Test-Path $modulesRollbackDir) {
            Remove-IfExists $modulesDir
            Rename-Item $modulesRollbackDir "node_modules"
            Write-Host "Previous node_modules restored." -ForegroundColor Green
        }
        if (Test-Path $clientRollbackDir) {
            Remove-IfExists $clientDir
            Rename-Item $clientRollbackDir "prisma"
            Write-Host "Previous Prisma client restored." -ForegroundColor Green
        }
    } catch {
        Write-Host "Restoring files failed: $($_.Exception.Message)" -ForegroundColor Red
        $ok = $false
    }

    $fingerprintAfter = Get-MigrationFingerprint
    if ($null -eq $fingerprintAfter -or $fingerprintAfter -ne $fingerprintBefore) {
        if ($null -eq $fingerprintAfter) {
            Write-Host "Could not read _prisma_migrations; restoring the database to be safe." -ForegroundColor Yellow
        } else {
            Write-Host "Migrations ran during the failed update." -ForegroundColor Yellow
        }
        if (-not (Restore-Database)) {
            Write-ManualDbRestore
            $ok = $false
        }
    } else {
        Write-Host "No migrations ran; database untouched." -ForegroundColor Green
    }

    return $ok
}

$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $service) {
    Write-Host "ERROR: service '$ServiceName' not found on this machine." -ForegroundColor Red
    exit 1
}

foreach ($tool in @($pgDump, $pgRestore, $psql)) {
    if (-not (Test-Path $tool)) {
        Write-Host "ERROR: $tool not found. Pass -PgBin with your PostgreSQL bin folder." -ForegroundColor Red
        exit 1
    }
}

try {
    $db = Get-DbConnection
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Leftovers from an interrupted run would be mistaken for this run's snapshot.
foreach ($stale in @($buildRollbackDir, $modulesRollbackDir, $clientRollbackDir)) {
    if (Test-Path $stale) {
        Write-Host "ERROR: $stale exists from an earlier interrupted update. Check it, then delete it and re-run." -ForegroundColor Red
        exit 1
    }
}

Write-Host "Updating Precast Ops in $repoRoot (service: $ServiceName)" -ForegroundColor Cyan

Write-Host "`n== stopping $ServiceName ==" -ForegroundColor Cyan
if ($service.Status -ne "Stopped") {
    Stop-Service -Name $ServiceName -Force
}

$previousCommit = (git rev-parse HEAD).Trim()
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"

Write-Host "`n== database backup ==" -ForegroundColor Cyan
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Force $BackupDir | Out-Null
}
$backupFile = Join-Path $BackupDir "$($db.Name)_pre-update_$stamp.dump"
if ((Invoke-PgTool $pgDump @("-d", $db.Name, "-Fc", "-f", $backupFile)) -ne 0 -or -not (Test-Path $backupFile)) {
    Write-Host "Database backup failed - nothing was changed. Restarting the service." -ForegroundColor Red
    Start-AppService
    exit 1
}
$sizeMb = [math]::Round((Get-Item $backupFile).Length / 1MB, 1)
Write-Host "Backup written: $backupFile ($sizeMb MB)" -ForegroundColor Green

if ($KeepBackups -gt 0) {
    Get-ChildItem $BackupDir -Filter "*_pre-update_*.dump" |
        Sort-Object LastWriteTime -Descending |
        Select-Object -Skip $KeepBackups |
        Remove-Item -Force
}

$fingerprintBefore = Get-MigrationFingerprint

Write-Host "`n== git pull ==" -ForegroundColor Cyan
# gc.auto=0: auto-repack after a pull can hit locked pack files on Windows
# and stall on an interactive prompt; skip it entirely during deploys.
git -c gc.auto=0 pull --ff-only
if ($LASTEXITCODE -ne 0) {
    Write-Host "git pull failed - restarting the service on the old version." -ForegroundColor Red
    Start-AppService
    exit 1
}

# Snapshot everything the deploy replaces, so a failure can put it back.
try {
    if (Test-Path $buildDir) {
        Rename-Item $buildDir ".next.rollback"
    }
    if (-not $SkipInstall -and (Test-Path $modulesDir)) {
        # npm ci deletes node_modules anyway; moving it is instant.
        Rename-Item $modulesDir "node_modules.rollback"
    }
    if (Test-Path $clientDir) {
        Copy-Item $clientDir $clientRollbackDir -Recurse
    }
} catch {
    Write-Host "Could not snapshot the current install: $($_.Exception.Message)" -ForegroundColor Red
    if (Invoke-Rollback) {
        Start-AppService
    } else {
        Write-Host "Service left stopped - finish the steps above, then Start-Service $ServiceName." -ForegroundColor Red
    }
    exit 1
}

$deployArgs = @()
if ($SkipInstall) { $deployArgs += "-SkipInstall" }
$deployOk = $false
try {
    & (Join-Path $PSScriptRoot "deploy-app.ps1") @deployArgs
    $deployOk = ($LASTEXITCODE -eq 0)
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
}
Set-Location $repoRoot

if (-not $deployOk) {
    Write-Host "`nDeploy build failed." -ForegroundColor Red
    if (Invoke-Rollback) {
        Write-Host "`nRolled back to $previousCommit. Restarting the service on the old version." -ForegroundColor Yellow
        Start-AppService
    } else {
        Write-Host "`nRollback incomplete - service left stopped. Finish the steps above, then Start-Service $ServiceName." -ForegroundColor Red
    }
    exit 1
}

Remove-IfExists $buildRollbackDir
Remove-IfExists $modulesRollbackDir
Remove-IfExists $clientRollbackDir

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
    Write-Host "The build succeeded, so nothing was rolled back. To go back by hand:" -ForegroundColor Yellow
    Write-Host "  Stop-Service $ServiceName; git reset --keep $previousCommit; npm run deploy:build -- -SkipInstall" -ForegroundColor Yellow
    Write-Host "  (run npm ci first if dependencies changed), then restore the database:" -ForegroundColor Yellow
    Write-ManualDbRestore
    exit 1
}
