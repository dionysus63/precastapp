# Nightly backup for precastapp: the PostgreSQL database plus the storage/
# folder (uploaded sheet PDF sets, which live outside the database).
#
# - Reads the connection string from .env (DATABASE_URL) so there is a single
#   source of truth for credentials.
# - Writes a compressed pg_dump custom-format archive (.dump) that pg_restore
#   can restore selectively, and a zip of storage/ with the same timestamp.
# - Optionally copies both files to a second location (e.g. a UNC share on
#   another machine) and/or uploads them to a Backblaze B2 bucket (plain
#   PowerShell, see backup-b2.ps1), so a dead disk does not take the backups
#   with it.
#   Old files in the cloud are removed by the bucket's lifecycle rule, not by
#   this script, so the upload key does not need delete rights.
# - Keeps the most recent 30 days of backups in each location and prunes
#   older ones.
# - Appends one line per run (OK / WARN / FAIL) to backup.log in the backup
#   folder and exits non-zero on any failure, so Task Scheduler's
#   "Last Run Result" shows it.
#
# Settings (parameter > .env > default):
#   -BackupDir       BACKUP_DIR             C:\Backups\precastapp
#   -CopyDir         BACKUP_COPY_DIR        (none; e.g. \\NAS\Backups\precastapp)
#   -RetentionDays   BACKUP_RETENTION_DAYS  30
#   -B2Bucket        BACKUP_B2_BUCKET       (none = no cloud upload)
#                    BACKUP_B2_KEY_ID       application key ID
#                    BACKUP_B2_KEY          application key
#                    BACKUP_B2_PREFIX       precastapp/  (folder inside the bucket)
#
# Exit codes: 0 OK, 1 backup failed, 2 local backup OK but the second copy
# or cloud upload failed.
#
# Restore (see COMMANDS.md):
#   & "C:\Program Files\PostgreSQL\18\bin\pg_restore.exe" -U postgres -h localhost `
#       -d precastapp --clean --if-exists "C:\Backups\precastapp\<file>.dump"
#   Expand-Archive "C:\Backups\precastapp\<db>-storage_<stamp>.zip" -DestinationPath C:\Apps\precastapp\storage
#
# Scheduled via Windows Task Scheduler (task name: "PrecastApp DB Backup"),
# registered by scripts\deploy\install-backup-task.ps1.

param(
    [string] $BackupDir,
    [string] $CopyDir,
    [int] $RetentionDays = 0,
    [string] $B2Bucket,
    [string] $PgBin = "C:\Program Files\PostgreSQL\18\bin"
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$EnvFile = Join-Path $RepoRoot ".env"
$StorageDir = Join-Path $RepoRoot "storage"
$DefaultBackupDir = "C:\Backups\precastapp"

function Get-EnvValue([string[]] $lines, [string] $name) {
    $line = $lines | Where-Object { $_ -match "^\s*$name\s*=" } | Select-Object -First 1
    if (-not $line) { return $null }
    $value = ($line -replace "^\s*$name\s*=\s*", '').Trim().Trim('"').Trim("'")
    if ($value) { return $value }
    return $null
}

function Write-Log([string] $message) {
    try {
        if (-not (Test-Path $BackupDir)) {
            New-Item -ItemType Directory -Force $BackupDir | Out-Null
        }
        Add-Content -Encoding utf8 (Join-Path $BackupDir "backup.log") "$(Get-Date -Format s) $message"
    } catch {
        Write-Warning "Could not write backup.log: $($_.Exception.Message)"
    }
}

function Remove-OldBackups([string] $dir, [string] $prefix) {
    $cutoff = (Get-Date).AddDays(-$RetentionDays)
    $old = @(Get-ChildItem $dir -File |
        Where-Object { $_.Name -like "$prefix*" -and ($_.Extension -eq ".dump" -or $_.Extension -eq ".zip") } |
        Where-Object { $_.LastWriteTime -lt $cutoff })
    $old | Remove-Item -Force -Confirm:$false
    return $old.Count
}

try {
    # --- Settings ---
    if (-not (Test-Path $EnvFile)) {
        throw ".env not found at $EnvFile"
    }
    $envLines = Get-Content $EnvFile

    if (-not $BackupDir) { $BackupDir = Get-EnvValue $envLines "BACKUP_DIR" }
    if (-not $BackupDir) { $BackupDir = $DefaultBackupDir }
    if (-not $CopyDir) { $CopyDir = Get-EnvValue $envLines "BACKUP_COPY_DIR" }
    if (-not $B2Bucket) { $B2Bucket = Get-EnvValue $envLines "BACKUP_B2_BUCKET" }
    $B2KeyId = Get-EnvValue $envLines "BACKUP_B2_KEY_ID"
    $B2Key = Get-EnvValue $envLines "BACKUP_B2_KEY"
    $B2Prefix = Get-EnvValue $envLines "BACKUP_B2_PREFIX"
    if (-not $B2Prefix) { $B2Prefix = "precastapp/" }
    if ($RetentionDays -le 0) {
        $configured = Get-EnvValue $envLines "BACKUP_RETENTION_DAYS"
        $RetentionDays = if ($configured) { [int]$configured } else { 30 }
    }

    # --- Parse DATABASE_URL ---
    $url = Get-EnvValue $envLines "DATABASE_URL"
    if (-not $url) {
        throw "DATABASE_URL not found in $EnvFile"
    }
    if ($url -notmatch '^postgresql://([^:]+):([^@]+)@([^:/]+):(\d+)/([^?]+)') {
        throw "DATABASE_URL is not in the expected postgresql://user:pass@host:port/db format"
    }
    $DbUser = $Matches[1]
    $DbPass = [Uri]::UnescapeDataString($Matches[2])
    $DbHost = $Matches[3]
    $DbPort = $Matches[4]
    $DbName = $Matches[5]

    if (-not (Test-Path $BackupDir)) {
        New-Item -ItemType Directory -Force $BackupDir | Out-Null
    }
    $stamp = Get-Date -Format "yyyy-MM-dd_HHmm"
    $dumpFile = Join-Path $BackupDir "$DbName`_$stamp.dump"
    $storageZip = Join-Path $BackupDir "$DbName-storage`_$stamp.zip"

    # --- Database dump ---
    $env:PGPASSWORD = $DbPass
    try {
        & (Join-Path $PgBin "pg_dump.exe") -U $DbUser -h $DbHost -p $DbPort -Fc -f $dumpFile $DbName
        if ($LASTEXITCODE -ne 0) {
            throw "pg_dump exited with code $LASTEXITCODE"
        }
    } finally {
        Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    }

    $dumpSize = (Get-Item $dumpFile).Length
    if ($dumpSize -lt 10KB) {
        throw "Backup file suspiciously small ($dumpSize bytes): $dumpFile"
    }
    $made = @($dumpFile)

    # --- storage/ (uploaded sheet PDF sets) ---
    $storageNote = "no storage/ folder"
    if (Test-Path $StorageDir) {
        Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
        Remove-Item $storageZip -Force -ErrorAction SilentlyContinue
        [System.IO.Compression.ZipFile]::CreateFromDirectory(
            $StorageDir, $storageZip, [System.IO.Compression.CompressionLevel]::Optimal, $false)
        $made += $storageZip
        $storageNote = "storage $([math]::Round((Get-Item $storageZip).Length / 1MB, 1))MB"
    }

    # --- Prune old backups ---
    $pruned = Remove-OldBackups $BackupDir $DbName

    $dumpMb = [math]::Round($dumpSize / 1MB, 1)
    $summary = "$([System.IO.Path]::GetFileName($dumpFile)) ${dumpMb}MB, $storageNote (pruned $pruned)"

    $offsiteErrors = @()

    # --- Second copy ---
    if ($CopyDir) {
        try {
            if (-not (Test-Path $CopyDir)) {
                New-Item -ItemType Directory -Force $CopyDir | Out-Null
            }
            foreach ($file in $made) {
                Copy-Item $file -Destination $CopyDir -Force
                $copied = Join-Path $CopyDir ([System.IO.Path]::GetFileName($file))
                if ((Get-Item $copied).Length -ne (Get-Item $file).Length) {
                    throw "size mismatch after copying $([System.IO.Path]::GetFileName($file))"
                }
            }
            $copyPruned = Remove-OldBackups $CopyDir $DbName
            $summary += "; copied to $CopyDir (pruned $copyPruned)"
        } catch {
            $offsiteErrors += "copy to $CopyDir failed: $($_.Exception.Message)"
        }
    }

    # --- Cloud upload (Backblaze B2) ---
    if ($B2Bucket) {
        try {
            if (-not $B2KeyId -or -not $B2Key) {
                throw "BACKUP_B2_KEY_ID and BACKUP_B2_KEY must be set in .env"
            }
            . (Join-Path $PSScriptRoot "backup-b2.ps1")
            $b2 = Connect-B2 $B2KeyId $B2Key $B2Bucket
            foreach ($file in $made) {
                Send-B2File $b2 $file ($B2Prefix + [System.IO.Path]::GetFileName($file)) | Out-Null
            }
            $summary += "; uploaded to b2://$B2Bucket/$B2Prefix"
        } catch {
            $offsiteErrors += "upload to Backblaze bucket $B2Bucket failed: $($_.Exception.Message)"
        }
    }

    if ($offsiteErrors.Count -gt 0) {
        $problem = $offsiteErrors -join "; "
        Write-Log "WARN $summary; $problem"
        Write-Error "Local backup OK but $problem" -ErrorAction Continue
        exit 2
    }

    Write-Log "OK $summary"
    Write-Output "Backup written: $summary"
    exit 0
} catch {
    if (-not $BackupDir) { $BackupDir = $DefaultBackupDir }
    Write-Log "FAIL $($_.Exception.Message)"
    Write-Error "Backup failed: $($_.Exception.Message)" -ErrorAction Continue
    exit 1
}
