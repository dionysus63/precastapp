# Nightly backup for precastapp: the PostgreSQL database plus the storage/
# folder (uploaded sheet PDFs and signed delivery tickets, which live outside
# the database).
#
# - Reads the connection string from .env (DATABASE_URL) so there is a single
#   source of truth for credentials.
# - Writes a compressed pg_dump custom-format archive (.dump) that pg_restore
#   can restore selectively, and a zip of storage/ with the same timestamp.
# - Signed delivery tickets (storage\signed-tickets, one scanned PDF per
#   ticket, kept for good) are not in that zip: zipping all of them again
#   every night would multiply their size by the retention days. Each run
#   copies only the new or changed ones into <BackupDir>\signed-tickets, a
#   plain folder that only ever grows and is never pruned. Uploaded scans
#   (storage\ticket-scans) are deleted as soon as their pages are filed and
#   are not backed up.
# - Optionally copies both files to a second location (e.g. a UNC share on
#   another machine) and/or uploads them off-site with rclone (e.g. a
#   Backblaze B2 bucket), so a dead disk does not take the backups with it.
#   Old files in the cloud are removed by the bucket's lifecycle rule, not by
#   this script, so the upload key does not need delete rights. The signed
#   tickets folder goes to both places the same way: only what is new.
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
#   -RcloneRemote    BACKUP_RCLONE_REMOTE   (none; e.g. b2:precast-backups/precastapp)
#   -RcloneExe       BACKUP_RCLONE_EXE      C:\Program Files\rclone\rclone.exe
#   -RcloneConfig    BACKUP_RCLONE_CONFIG   (rclone's default for the task's account)
#
# Exit codes: 0 OK, 1 backup failed (or the signed tickets could not be
# copied), 2 local backup OK but the second copy or cloud upload failed.
#
# Restore (see COMMANDS.md):
#   & "C:\Program Files\PostgreSQL\18\bin\pg_restore.exe" -U postgres -h localhost `
#       -d precastapp --clean --if-exists "C:\Backups\precastapp\<file>.dump"
#   Expand-Archive "C:\Backups\precastapp\<db>-storage_<stamp>.zip" -DestinationPath C:\Apps\precastapp\storage
#   robocopy "C:\Backups\precastapp\signed-tickets" "C:\Apps\precastapp\storage\signed-tickets" /E
#
# Scheduled via Windows Task Scheduler (task name: "PrecastApp DB Backup"),
# registered by scripts\deploy\install-backup-task.ps1.

param(
    [string] $BackupDir,
    [string] $CopyDir,
    [int] $RetentionDays = 0,
    [string] $RcloneRemote,
    [string] $RcloneExe,
    [string] $RcloneConfig,
    [string] $PgBin = "C:\Program Files\PostgreSQL\18\bin"
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$EnvFile = Join-Path $RepoRoot ".env"
$StorageDir = Join-Path $RepoRoot "storage"
$DefaultBackupDir = "C:\Backups\precastapp"
# Folders in storage\ that stay out of the nightly zip (see the notes above).
$SignedTicketsFolder = "signed-tickets"
$StorageZipSkips = @($SignedTicketsFolder, "ticket-scans")

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

# Every file under a folder, keyed by its path relative to that folder.
function Get-RelativeFiles([string] $dir) {
    $root = (Get-Item -LiteralPath $dir).FullName.TrimEnd([char[]]@('\', '/'))
    $list = @{}
    foreach ($file in @(Get-ChildItem -LiteralPath $root -File -Recurse -Force)) {
        $list[$file.FullName.Substring($root.Length + 1)] = $file
    }
    return $list
}

# Zips a folder, leaving out the named folders at its top level.
function New-FolderZip([string] $sourceDir, [string] $zipPath, [string[]] $skipTopFolders) {
    $root = (Get-Item -LiteralPath $sourceDir).FullName.TrimEnd([char[]]@('\', '/'))
    $files = @()
    foreach ($item in @(Get-ChildItem -LiteralPath $root -Force)) {
        if ($item.PSIsContainer) {
            if ($skipTopFolders -contains $item.Name) { continue }
            $files += @(Get-ChildItem -LiteralPath $item.FullName -File -Recurse -Force)
        } else {
            $files += $item
        }
    }
    $zip = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($file in $files) {
            $entryName = $file.FullName.Substring($root.Length + 1).Replace('\', '/')
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                $zip, $file.FullName, $entryName,
                [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
        }
    } finally {
        $zip.Dispose()
    }
}

# Copies the files that are new or changed (by size or modified time) from
# one folder tree into another. Nothing is ever removed from the destination,
# so a file that is later replaced or deleted at the source stays backed up.
# Returns how many files the source holds and how many were copied; throws
# after trying every file if any of them could not be copied.
function Copy-NewFiles([string] $sourceDir, [string] $destDir) {
    if (-not (Test-Path -LiteralPath $destDir)) {
        New-Item -ItemType Directory -Force -Path $destDir | Out-Null
    }
    $have = Get-RelativeFiles $destDir
    $source = Get-RelativeFiles $sourceDir
    $total = 0
    $copied = 0
    $failed = @()
    foreach ($relative in @($source.Keys)) {
        $file = $source[$relative]
        # The app writes "<name>.part" and renames it into place a moment later.
        if ($file.Extension -eq ".part") { continue }
        $total++
        $existing = $have[$relative]
        if ($existing -and $existing.Length -eq $file.Length -and
            [math]::Abs(($existing.LastWriteTimeUtc - $file.LastWriteTimeUtc).TotalSeconds) -le 2) {
            continue
        }
        try {
            $target = Join-Path $destDir $relative
            $targetDir = [System.IO.Path]::GetDirectoryName($target)
            if (-not (Test-Path -LiteralPath $targetDir)) {
                New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
            }
            Copy-Item -LiteralPath $file.FullName -Destination $target -Force
            if ((Get-Item -LiteralPath $target).Length -ne $file.Length) {
                throw "size mismatch"
            }
            $copied++
        } catch {
            $failed += "$relative ($($_.Exception.Message))"
        }
    }
    if ($failed.Count -gt 0) {
        throw "$($failed.Count) of $total file(s) not copied, first: $($failed[0])"
    }
    return @{ Total = $total; Copied = $copied }
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
    if (-not $RcloneRemote) { $RcloneRemote = Get-EnvValue $envLines "BACKUP_RCLONE_REMOTE" }
    if (-not $RcloneExe) { $RcloneExe = Get-EnvValue $envLines "BACKUP_RCLONE_EXE" }
    if (-not $RcloneExe) { $RcloneExe = "C:\Program Files\rclone\rclone.exe" }
    if (-not $RcloneConfig) { $RcloneConfig = Get-EnvValue $envLines "BACKUP_RCLONE_CONFIG" }
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

    # --- storage/ (uploaded sheet PDFs; signed tickets are handled below) ---
    $storageNote = "no storage/ folder"
    if (Test-Path $StorageDir) {
        Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
        Remove-Item $storageZip -Force -ErrorAction SilentlyContinue
        New-FolderZip $StorageDir $storageZip $StorageZipSkips
        $made += $storageZip
        $storageNote = "storage $([math]::Round((Get-Item $storageZip).Length / 1MB, 1))MB"
    }

    # --- Prune old backups ---
    $pruned = Remove-OldBackups $BackupDir $DbName

    $dumpMb = [math]::Round($dumpSize / 1MB, 1)
    $summary = "$([System.IO.Path]::GetFileName($dumpFile)) ${dumpMb}MB, $storageNote (pruned $pruned)"

    $localErrors = @()
    $offsiteErrors = @()

    # --- Signed tickets: copy only the new or changed ones ---
    # A problem here is reported at the end, after the database backup has
    # been sent off the server, so it never holds that up.
    $signedDir = Join-Path $StorageDir $SignedTicketsFolder
    $hasSignedTickets = Test-Path -LiteralPath $signedDir -PathType Container
    if ($hasSignedTickets) {
        try {
            $signed = Copy-NewFiles $signedDir (Join-Path $BackupDir $SignedTicketsFolder)
            $summary += ", signed tickets $($signed.Total) files ($($signed.Copied) new)"
        } catch {
            $localErrors += "signed tickets not copied to ${BackupDir}: $($_.Exception.Message)"
        }
    }

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
            if ($hasSignedTickets) {
                $signedCopy = Copy-NewFiles $signedDir (Join-Path $CopyDir $SignedTicketsFolder)
                $summary += ", $($signedCopy.Copied) new signed tickets"
            }
        } catch {
            $offsiteErrors += "copy to $CopyDir failed: $($_.Exception.Message)"
        }
    }

    # --- Cloud upload (rclone verifies checksums on upload) ---
    if ($RcloneRemote) {
        try {
            if (-not (Test-Path $RcloneExe -PathType Leaf)) {
                throw "rclone not found at $RcloneExe"
            }
            $rcloneArgs = @()
            if ($RcloneConfig) { $rcloneArgs += @("--config", $RcloneConfig) }
            foreach ($file in $made) {
                # rclone logs to stderr; under "Stop", Windows PowerShell would treat that as an error.
                $ErrorActionPreference = "Continue"
                $output = & $RcloneExe @rcloneArgs copy $file $RcloneRemote --retries 3 --low-level-retries 10 2>&1
                $ErrorActionPreference = "Stop"
                if ($LASTEXITCODE -ne 0) {
                    $detail = ($output | Select-Object -Last 1)
                    throw "rclone exited with code $LASTEXITCODE for $([System.IO.Path]::GetFileName($file)): $detail"
                }
            }
            if ($hasSignedTickets) {
                # "copy" sends only files that are new or changed and never
                # deletes anything at the far end.
                $signedRemote = "$($RcloneRemote.TrimEnd('/'))/$SignedTicketsFolder"
                $ErrorActionPreference = "Continue"
                $output = & $RcloneExe @rcloneArgs copy $signedDir $signedRemote --exclude "*.part" --retries 3 --low-level-retries 10 2>&1
                $ErrorActionPreference = "Stop"
                if ($LASTEXITCODE -ne 0) {
                    $detail = ($output | Select-Object -Last 1)
                    throw "rclone exited with code $LASTEXITCODE for the signed tickets: $detail"
                }
            }
            $summary += "; uploaded to $RcloneRemote"
        } catch {
            $offsiteErrors += "upload to $RcloneRemote failed: $($_.Exception.Message)"
        }
    }

    if ($localErrors.Count -gt 0) {
        $problem = ($localErrors + $offsiteErrors) -join "; "
        Write-Log "FAIL $summary; $problem"
        Write-Error "Backup incomplete: $problem" -ErrorAction Continue
        exit 1
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
