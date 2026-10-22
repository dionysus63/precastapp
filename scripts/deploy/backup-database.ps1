# Backs up the database and storage/ by running scripts\backup-database.ps1,
# which holds the real logic (settings, second copy, cloud upload, pruning, logging).
#
# Example:
#   .\scripts\deploy\backup-database.ps1
#   .\scripts\deploy\backup-database.ps1 -BackupDir "D:\Backups\precastapp" -CopyDir "\\NAS\Backups\precastapp"

param(
    [Alias("OutputDir")]
    [string] $BackupDir,
    [string] $CopyDir,
    [int] $RetentionDays = 0,
    [string] $B2Bucket
)

& (Join-Path $PSScriptRoot "..\backup-database.ps1") -BackupDir $BackupDir -CopyDir $CopyDir `
    -RetentionDays $RetentionDays -B2Bucket $B2Bucket
exit $LASTEXITCODE
