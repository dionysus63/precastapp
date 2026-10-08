# Registers (or replaces) the "PrecastApp DB Backup" scheduled task so the
# nightly backup runs whether or not anyone is logged on.
#
# Run once on the server from an elevated PowerShell:
#   .\scripts\deploy\install-backup-task.ps1                     # runs as you; asks for your password
#   .\scripts\deploy\install-backup-task.ps1 -User "LIP-TITAN\svc-precast" -At "02:00"
#   .\scripts\deploy\install-backup-task.ps1 -User SYSTEM        # no password; see note below
#
# Windows needs the account's password to run a task while nobody is logged
# on. It is stored by Task Scheduler, never by this script or in .env. When
# the password changes, re-run this script.
#
# SYSTEM needs no password, but it reaches a UNC share (BACKUP_COPY_DIR) as
# the server's computer account, which usually has no rights on the share.
# Use a real account when copying to a share.

param(
    [string] $User = "$env:USERDOMAIN\$env:USERNAME",
    [string] $At = "02:00",
    [string] $TaskName = "PrecastApp DB Backup"
)

$ErrorActionPreference = "Stop"

$script = Resolve-Path (Join-Path $PSScriptRoot "..\backup-database.ps1")
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")

$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`"" `
    -WorkingDirectory $repoRoot
$trigger = New-ScheduledTaskTrigger -Daily -At $At
# StartWhenAvailable: if the server was off at the scheduled time, run as soon as it is back.
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
    -RestartCount 2 -RestartInterval (New-TimeSpan -Minutes 15)

if ($User -eq "SYSTEM") {
    $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
        -Principal $principal -Description "Nightly precastapp database + storage backup" -Force | Out-Null
} else {
    $cred = Get-Credential -UserName $User -Message "Password for $User (stored by Task Scheduler so the backup runs while logged off)"
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
        -User $cred.UserName -Password $cred.GetNetworkCredential().Password -RunLevel Highest `
        -Description "Nightly precastapp database + storage backup" -Force | Out-Null
}

Write-Host "[OK] '$TaskName' runs daily at $At as $User, whether or not anyone is logged on." -ForegroundColor Green
Write-Host "Test it now:  Start-ScheduledTask -TaskName '$TaskName'; then run .\scripts\deploy\check-backup.ps1"
