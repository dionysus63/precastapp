# Self-check for scripts\backup-database.ps1. Safe to run on any PC: it works
# only in a scratch folder under %TEMP%, which it removes again, and never
# touches the database, the app's storage folder or the real backups.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\deploy\test-backup-script.ps1
#
# It checks that the backup and check scripts parse, then runs the backup
# script's own file functions (the storage zip and the signed-ticket copy)
# against made-up files. Exit code 0 = every check passed.

$ErrorActionPreference = "Stop"
$failures = 0

function Check([bool] $ok, [string] $text) {
    if ($ok) { Write-Host "[OK]   $text" -ForegroundColor Green }
    else { Write-Host "[FAIL] $text" -ForegroundColor Red; $script:failures++ }
}

$backupScript = (Resolve-Path (Join-Path $PSScriptRoot "..\backup-database.ps1")).Path
$checkScript = (Resolve-Path (Join-Path $PSScriptRoot "check-backup.ps1")).Path

# --- 1. Both scripts parse ---
$asts = @{}
foreach ($path in @($backupScript, $checkScript)) {
    $tokens = $null
    $parseErrors = $null
    $asts[$path] = [System.Management.Automation.Language.Parser]::ParseFile($path, [ref] $tokens, [ref] $parseErrors)
    Check ($parseErrors.Count -eq 0) "$([System.IO.Path]::GetFileName($path)) parses"
    foreach ($problem in $parseErrors) {
        Write-Host "       line $($problem.Extent.StartLineNumber): $($problem.Message)"
    }
}

# --- 2. Load the backup script's file functions (nothing else in it runs) ---
$wanted = @("Get-RelativeFiles", "New-FolderZip", "Copy-NewFiles")
$functions = $asts[$backupScript].FindAll({
        param($node)
        $node -is [System.Management.Automation.Language.FunctionDefinitionAst]
    }, $true)
foreach ($definition in $functions) {
    if ($wanted -contains $definition.Name) {
        . ([scriptblock]::Create($definition.Extent.Text))
    }
}
$missing = @($wanted | Where-Object { -not (Get-Command $_ -CommandType Function -ErrorAction SilentlyContinue) })
Check ($missing.Count -eq 0) "found the backup script's file functions"
if ($missing.Count -gt 0) {
    Write-Host "       missing: $($missing -join ', ')"
    Write-Host "`n$failures check(s) failed." -ForegroundColor Red
    exit 1
}

Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem

$scratch = Join-Path ([System.IO.Path]::GetTempPath()) ("precastapp-backup-check-" + [guid]::NewGuid().ToString("N"))
$storage = Join-Path $scratch "storage"

function New-TestFile([string] $relative, [string] $text) {
    $path = Join-Path $storage $relative
    $folder = [System.IO.Path]::GetDirectoryName($path)
    if (-not (Test-Path -LiteralPath $folder)) {
        New-Item -ItemType Directory -Force -Path $folder | Out-Null
    }
    Set-Content -LiteralPath $path -Value $text -Encoding ascii
}

function Read-TestFile([string] $path) {
    if (-not (Test-Path -LiteralPath $path)) { return $null }
    return (Get-Content -LiteralPath $path -Raw).Trim()
}

try {
    New-TestFile "logo.png" "logo"
    New-TestFile "rect-pdf-sets\set1\base.pdf" "sheet pdf"
    New-TestFile "signed-tickets\2026\T10001.pdf" "signed one"
    New-TestFile "signed-tickets\2026\T10002 (earlier version 1).pdf" "signed two, earlier"
    New-TestFile "signed-tickets\2026\T10003.pdf.1234.part" "half written"
    New-TestFile "ticket-scans\scan1\upload.pdf" "an upload"

    # --- 3. The storage zip leaves the two scan folders out ---
    $zipPath = Join-Path $scratch "storage.zip"
    New-FolderZip $storage $zipPath @("signed-tickets", "ticket-scans")
    $zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
    try {
        $entries = @($zip.Entries | ForEach-Object { $_.FullName } | Sort-Object)
    } finally {
        $zip.Dispose()
    }
    Check (($entries -join "|") -eq "logo.png|rect-pdf-sets/set1/base.pdf") "the storage zip holds only the other files: $($entries -join ', ')"

    $restored = Join-Path $scratch "restored"
    Expand-Archive -LiteralPath $zipPath -DestinationPath $restored -Force
    Check ((Read-TestFile (Join-Path $restored "rect-pdf-sets\set1\base.pdf")) -eq "sheet pdf") "Expand-Archive restores the zip"

    # --- 4. Signed tickets: only new or changed files are copied, nothing is removed ---
    $signed = Join-Path $storage "signed-tickets"
    $mirror = Join-Path $scratch "backup\signed-tickets"

    $first = Copy-NewFiles $signed $mirror
    Check ($first.Total -eq 2 -and $first.Copied -eq 2) "the first run copies both signed tickets (found $($first.Total), copied $($first.Copied))"
    Check (-not (Test-Path -LiteralPath (Join-Path $mirror "2026\T10003.pdf.1234.part"))) "a half-written .part file is left alone"
    Check ((Read-TestFile (Join-Path $mirror "2026\T10002 (earlier version 1).pdf")) -eq "signed two, earlier") "a name with spaces and brackets copies intact"

    $second = Copy-NewFiles $signed $mirror
    Check ($second.Total -eq 2 -and $second.Copied -eq 0) "the second run copies nothing (copied $($second.Copied))"

    New-TestFile "signed-tickets\2026\T10001.pdf" "signed one, scanned again and longer"
    New-TestFile "signed-tickets\2027\T10004.pdf" "next year"
    $third = Copy-NewFiles $signed $mirror
    Check ($third.Total -eq 3 -and $third.Copied -eq 2) "a changed file and a new one are copied (found $($third.Total), copied $($third.Copied))"
    Check ((Read-TestFile (Join-Path $mirror "2026\T10001.pdf")) -eq "signed one, scanned again and longer") "the changed file was replaced in the copy"
    Check ((Read-TestFile (Join-Path $mirror "2027\T10004.pdf")) -eq "next year") "a new year folder is created in the copy"

    Remove-Item -LiteralPath (Join-Path $signed "2026\T10002 (earlier version 1).pdf") -Force
    $fourth = Copy-NewFiles $signed $mirror
    Check ($fourth.Total -eq 2 -and $fourth.Copied -eq 0) "nothing to copy after a file is deleted at the source (copied $($fourth.Copied))"
    Check (Test-Path -LiteralPath (Join-Path $mirror "2026\T10002 (earlier version 1).pdf")) "the deleted file is still in the copy"
} catch {
    Check $false "unexpected error: $($_.Exception.Message)"
} finally {
    Remove-Item -LiteralPath $scratch -Recurse -Force -ErrorAction SilentlyContinue
}

if ($failures -eq 0) {
    Write-Host "`nBackup script checks passed." -ForegroundColor Green
    exit 0
}
Write-Host "`n$failures check(s) failed." -ForegroundColor Red
exit 1
