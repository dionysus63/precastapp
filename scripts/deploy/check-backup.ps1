# Quick health check for the nightly backup. Read-only; safe to run any time.
# Run it from an administrator PowerShell: a window without administrator
# rights may not be able to see the scheduled task.
#   .\scripts\deploy\check-backup.ps1

param(
    [string] $TaskName = "PrecastApp DB Backup",
    [int] $MaxAgeHours = 26
)

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$envLines = Get-Content (Join-Path $repoRoot ".env") -ErrorAction SilentlyContinue
function Get-EnvValue([string] $name) {
    $line = $envLines | Where-Object { $_ -match "^\s*$name\s*=" } | Select-Object -First 1
    if ($line) { ($line -replace "^\s*$name\s*=\s*", '').Trim().Trim('"').Trim("'") }
}
$backupDir = Get-EnvValue "BACKUP_DIR"
if (-not $backupDir) { $backupDir = "C:\Backups\precastapp" }
$copyDir = Get-EnvValue "BACKUP_COPY_DIR"
$b2Bucket = Get-EnvValue "BACKUP_B2_BUCKET"
$b2Prefix = Get-EnvValue "BACKUP_B2_PREFIX"
if (-not $b2Prefix) { $b2Prefix = "precastapp/" }
$b2Prefix = $b2Prefix.TrimStart("/")
if ($b2Prefix -and -not $b2Prefix.EndsWith("/")) { $b2Prefix += "/" }
$problems = 0

function Report([bool] $ok, [string] $text) {
    if ($ok) { Write-Host "[OK]   $text" -ForegroundColor Green }
    else { Write-Host "[FAIL] $text" -ForegroundColor Red; $script:problems++ }
}

# --- Scheduled task ---
$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if (-not $task) {
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
        [Security.Principal.WindowsBuiltInRole]::Administrator)
    if ($isAdmin) {
        Report $false "Task '$TaskName' is not installed (run scripts\deploy\install-backup-task.ps1)"
    } else {
        Report $false "Task '$TaskName' was not found, but this window is not running as administrator and may not be able to see it. Open PowerShell with Run as administrator and run this check again"
    }
} else {
    $info = $task | Get-ScheduledTaskInfo
    $logon = $task.Principal.LogonType
    Report ($logon -ne "Interactive") "Task runs as $($task.Principal.UserId), logon type $logon (Interactive = only while logged on)"
    Report ($task.State -ne "Disabled") "Task state: $($task.State); next run $($info.NextRunTime)"
    if ($task.State -eq "Running" -or $info.LastTaskResult -eq 267009) {
        Write-Host "[--]   A backup is running right now; run this check again when it finishes" -ForegroundColor Yellow
    } elseif ($info.LastTaskResult -eq 267011) {
        Write-Host "[--]   Task has not run yet (Start-ScheduledTask -TaskName '$TaskName' to test it)" -ForegroundColor Yellow
    } else {
        Report ($info.LastTaskResult -eq 0) "Last run $($info.LastRunTime), result $($info.LastTaskResult) (0 = success, 1 = backup failed, 2 = second copy or cloud upload failed; see backup.log)"
    }
}

# --- Latest files ---
function Check-Folder([string] $dir, [string] $label) {
    if (-not (Test-Path $dir)) { Report $false "$label folder $dir not reachable"; return }
    foreach ($pattern in @("*.dump", "*-storage_*.zip")) {
        $latest = Get-ChildItem $dir -Filter $pattern -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if (-not $latest) { Report $false "$label has no $pattern files"; continue }
        $age = [math]::Round(((Get-Date) - $latest.LastWriteTime).TotalHours, 1)
        Report ($age -le $MaxAgeHours) "$label newest $($latest.Name), $([math]::Round($latest.Length / 1MB, 1)) MB, $age h old"
    }
}
Check-Folder $backupDir "Local"
if ($copyDir) { Check-Folder $copyDir "Copy" }

# --- Signed tickets (copied file by file into a signed-tickets folder, not zipped) ---
$signedDir = Join-Path $repoRoot "storage\signed-tickets"
$signedDue = 0
if (Test-Path $signedDir) {
    # Tickets filed since the last backup are not copied yet, so count only the older ones.
    $cutoff = (Get-Date).AddHours(-$MaxAgeHours)
    $signedDue = @(Get-ChildItem $signedDir -File -Recurse |
        Where-Object { $_.Extension -ne ".part" -and $_.LastWriteTime -lt $cutoff }).Count
}
function Check-SignedTickets([string] $dir, [string] $label) {
    $mirror = Join-Path $dir "signed-tickets"
    $have = 0
    if (Test-Path $mirror) { $have = @(Get-ChildItem $mirror -File -Recurse).Count }
    Report ($have -ge $signedDue) "$label has $have signed ticket file(s); the app holds $signedDue filed more than $MaxAgeHours h ago"
}
if ($signedDue -gt 0) {
    if (Test-Path $backupDir) { Check-SignedTickets $backupDir "Local" }
    if ($copyDir -and (Test-Path $copyDir)) { Check-SignedTickets $copyDir "Copy" }
}

# --- Cloud (Backblaze B2) ---
if ($b2Bucket) {
    try {
        . (Join-Path $PSScriptRoot "..\backup-b2.ps1")
        $b2 = Connect-B2 (Get-EnvValue "BACKUP_B2_KEY_ID") (Get-EnvValue "BACKUP_B2_KEY") $b2Bucket
        $cloud = "Cloud bucket $b2Bucket/$b2Prefix"
        # The nightly files sit straight in that folder; the delimiter keeps
        # the signed tickets folder out of this listing.
        $since = [DateTimeOffset]::UtcNow.AddHours(-$MaxAgeHours).ToUnixTimeMilliseconds()
        $recent = @(Get-B2Files $b2 $b2Prefix "/" | Where-Object { $_.action -ne "folder" -and ([int64] $_.uploadTimestamp) -ge $since })
        $dumps = @($recent | Where-Object { $_.fileName -like "*.dump" })
        $zips = @($recent | Where-Object { $_.fileName -like "*-storage_*.zip" })
        Report ($dumps.Count -gt 0) "$cloud has $($dumps.Count) .dump file(s) from the last $MaxAgeHours h"
        Report ($zips.Count -gt 0) "$cloud has $($zips.Count) storage .zip file(s) from the last $MaxAgeHours h"
        if ($signedDue -gt 0) {
            $signedCloud = @(Get-B2Files $b2 ($b2Prefix + "signed-tickets/"))
            Report ($signedCloud.Count -ge $signedDue) "$cloud has $($signedCloud.Count) signed ticket file(s); the app holds $signedDue filed more than $MaxAgeHours h ago"
        }
    } catch {
        Report $false "Cannot check Backblaze bucket ${b2Bucket}: $($_.Exception.Message)"
    }
} elseif (Get-EnvValue "BACKUP_RCLONE_REMOTE") {
    Report $false "Nothing is uploaded off this server: .env still has BACKUP_RCLONE_REMOTE, which is no longer used. Set BACKUP_B2_BUCKET, BACKUP_B2_KEY_ID and BACKUP_B2_KEY instead (docs\DEPLOYMENT.md, Backups)"
}

if (-not $copyDir -and -not $b2Bucket) {
    Write-Host "[--]   No BACKUP_COPY_DIR or BACKUP_B2_BUCKET set; backups exist only on this server" -ForegroundColor Yellow
}

$log = Join-Path $backupDir "backup.log"
if (Test-Path $log) {
    Write-Host "`nLast log lines:"
    Get-Content $log -Tail 3 | ForEach-Object { Write-Host "  $_" }
}

if ($problems -eq 0) { Write-Host "`nBackups look healthy." -ForegroundColor Green }
else { Write-Host "`n$problems problem(s) found." -ForegroundColor Red; exit 1 }
