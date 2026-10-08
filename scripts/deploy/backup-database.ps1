# Backs up the database and storage/ by running scripts\backup-database.ps1,
# which holds the real logic (settings, second copy, pruning, logging).
#
# Example:
#   .\scripts\deploy\backup-database.ps1
#   .\scripts\deploy\backup-database.ps1 -BackupDir "D:\Backups\precastapp" -CopyDir "\\NAS\Backups\precastapp"

param(
    [Alias("OutputDir")]
    [string] $BackupDir,
    [string] $CopyDir,
    [int] $RetentionDays = 0
)

& (Join-Path $PSScriptRoot "..\backup-database.ps1") -BackupDir $BackupDir -CopyDir $CopyDir -RetentionDays $RetentionDays
exit $LASTEXITCODE
