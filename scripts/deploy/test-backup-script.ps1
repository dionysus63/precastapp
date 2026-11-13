# Self-check for scripts\backup-database.ps1 and scripts\backup-b2.ps1. Safe
# to run on any PC: it works only in a scratch folder under %TEMP%, which it
# removes again, and never touches the database, the app's storage folder,
# the real backups or Backblaze.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\deploy\test-backup-script.ps1
#
# It checks that the backup scripts parse, runs the backup script's own file
# functions (the storage zip and the signed-ticket copy) against made-up
# files, and runs the Backblaze upload against a stand-in for Backblaze's API
# that it starts on this PC with Node.js (test-backup-b2-mock.mjs, 127.0.0.1
# only). Exit code 0 = every check passed.

$ErrorActionPreference = "Stop"
$failures = 0

function Check([bool] $ok, [string] $text) {
    if ($ok) { Write-Host "[OK]   $text" -ForegroundColor Green }
    else { Write-Host "[FAIL] $text" -ForegroundColor Red; $script:failures++ }
}

$backupScript = (Resolve-Path (Join-Path $PSScriptRoot "..\backup-database.ps1")).Path
$b2Script = (Resolve-Path (Join-Path $PSScriptRoot "..\backup-b2.ps1")).Path
$checkScript = (Resolve-Path (Join-Path $PSScriptRoot "check-backup.ps1")).Path
$installScript = (Resolve-Path (Join-Path $PSScriptRoot "install-backup-task.ps1")).Path
$wrapperScript = (Resolve-Path (Join-Path $PSScriptRoot "backup-database.ps1")).Path
$mockScript = (Resolve-Path (Join-Path $PSScriptRoot "test-backup-b2-mock.mjs")).Path

Write-Host "PowerShell $($PSVersionTable.PSVersion)"

# --- 1. Every backup script parses ---
$asts = @{}
foreach ($path in @($backupScript, $b2Script, $checkScript, $installScript, $wrapperScript)) {
    $tokens = $null
    $parseErrors = $null
    $asts[$path] = [System.Management.Automation.Language.Parser]::ParseFile($path, [ref] $tokens, [ref] $parseErrors)
    $shown = $path.Substring($path.LastIndexOf("scripts"))
    Check ($parseErrors.Count -eq 0) "$shown parses"
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
$mock = $null

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

    # --- 5. Backblaze upload, against a stand-in for Backblaze on this PC ---
    $node = Get-Command node -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $node) {
        Check $false "Node.js was not found, so the Backblaze upload could not be checked"
    } else {
        . $b2Script
        # No waiting between the tries of an upload the stand-in refuses on purpose.
        $B2RetryDelaySeconds = 0

        $portFile = Join-Path $scratch "mock-port.txt"
        $mock = Start-Process -FilePath $node.Source -PassThru -NoNewWindow `
            -ArgumentList @("`"$mockScript`"", "--port-file", "`"$portFile`"") `
            -RedirectStandardOutput (Join-Path $scratch "mock-out.txt") `
            -RedirectStandardError (Join-Path $scratch "mock-err.txt")
        $port = $null
        for ($wait = 0; $wait -lt 100 -and -not $port; $wait++) {
            Start-Sleep -Milliseconds 100
            if (Test-Path -LiteralPath $portFile) {
                $portText = Get-Content -LiteralPath $portFile -Raw
                if ($portText) { $port = $portText.Trim() }
            }
        }
        if (-not $port) {
            throw "the stand-in for Backblaze did not start: $(Read-TestFile (Join-Path $scratch 'mock-err.txt'))"
        }
        $mockBase = "http://127.0.0.1:$port"
        $authUrl = "$mockBase/b2api/v4/b2_authorize_account"

        function Set-MockConfig([hashtable] $config) {
            Invoke-RestMethod -Method Post -Uri "$mockBase/__mock/config" -ContentType "application/json" `
                -Body ($config | ConvertTo-Json -Compress) -UseBasicParsing | Out-Null
        }
        function Get-MockState {
            return Invoke-RestMethod -Method Get -Uri "$mockBase/__mock/state" -UseBasicParsing
        }

        # Signing in
        $b2 = Connect-B2 "test-key-id" "test-key" "test-bucket" $authUrl
        Check ($b2.BucketId -eq "bucket-0001" -and $b2.ApiUrl -eq $mockBase) "signs in with a key limited to one bucket"

        $message = ""
        try { Connect-B2 "test-key-id" "wrong-key" "test-bucket" $authUrl | Out-Null } catch { $message = $_.Exception.Message }
        Check ($message -like "Backblaze sign-in failed:*") "a wrong key is refused: $message"
        Check ($message -like "*401 bad_auth_token*") "the refusal shows Backblaze's own error text"

        $message = ""
        try { Connect-B2 "test-key-id" "test-key" "other-bucket" $authUrl | Out-Null } catch { $message = $_.Exception.Message }
        Check ($message -like "*only allows bucket 'test-bucket'*") "a wrong bucket name is caught: $message"

        $message = ""
        try { Connect-B2 "" "" "test-bucket" $authUrl | Out-Null } catch { $message = $_.Exception.Message }
        Check ($message -like "BACKUP_B2_KEY_ID and BACKUP_B2_KEY must be set*") "a missing key is named: $message"

        Set-MockConfig @{ restricted = $false }
        $b2Whole = Connect-B2 "test-key-id" "test-key" "test-bucket" $authUrl
        Check ($b2Whole.BucketId -eq "bucket-0001") "a key for the whole account finds the bucket by name"
        Set-MockConfig @{ restricted = $true }

        Set-MockConfig @{ olderAnswer = $true }
        $b2Older = Connect-B2 "test-key-id" "test-key" "test-bucket" $authUrl
        Check ($b2Older.BucketId -eq "bucket-0001" -and $b2Older.ApiUrl -eq $mockBase) "the older shape of Backblaze's sign-in answer is read too"
        Set-MockConfig @{ olderAnswer = $false }

        # The nightly files
        $dump = Join-Path $scratch "precastapp_2026-11-13_0200.dump"
        Set-Content -LiteralPath $dump -Value ("database dump " * 2000) -Encoding ascii
        $dumpName = "precastapp/precastapp_2026-11-13_0200.dump"
        $sent = Send-B2File $b2 $dump $dumpName
        $listed = @(Get-B2Files $b2 "precastapp/" "/")
        Check ($listed.Count -eq 1 -and $listed[0].fileName -eq $dumpName -and ([int64] $listed[0].contentLength) -eq (Get-Item -LiteralPath $dump).Length) "a backup file is uploaded and listed with its size"
        Check ($sent.contentSha1 -eq (Get-FileHash -Algorithm SHA1 -LiteralPath $dump).Hash.ToLower()) "Backblaze received the same bytes (SHA-1 matches)"

        Set-MockConfig @{ failUploads = 1 }
        $zipName = "precastapp/precastapp-storage_2026-11-13_0200.zip"
        Send-B2File $b2 $zipPath $zipName | Out-Null
        $state = Get-MockState
        Check ($state.failedUploads -eq 1 -and @($state.files | Where-Object { $_.fileName -eq $zipName }).Count -eq 1) "an upload that is refused once goes through on the next try"

        Set-MockConfig @{ failUploads = 3 }
        $message = ""
        try { Send-B2File $b2 $dump "precastapp/never.dump" | Out-Null } catch { $message = $_.Exception.Message }
        Check ($message -like "upload of precastapp/never.dump failed after 3 attempts:*") "three refusals in a row are reported: $message"
        Check ($message -like "*503 service_unavailable*") "the report shows Backblaze's own error text"

        # Signed tickets: only new or changed files are uploaded, nothing is removed
        New-TestFile "b2-signed\2026\T20001.pdf" "signed one"
        New-TestFile "b2-signed\2026\T20002 (earlier version 1).pdf" "signed two, earlier"
        New-TestFile "b2-signed\2026\T20003.pdf.1234.part" "half written"
        $signedSource = Join-Path $storage "b2-signed"
        $signedPrefix = "precastapp/signed-tickets/"
        $earlierName = "precastapp/signed-tickets/2026/T20002 (earlier version 1).pdf"

        $first = Send-B2NewFiles $b2 $signedSource $signedPrefix
        Check ($first.Total -eq 2 -and $first.Sent -eq 2) "the first run uploads both signed tickets (found $($first.Total), sent $($first.Sent))"
        $names = @(Get-B2Files $b2 $signedPrefix | ForEach-Object { $_.fileName } | Sort-Object)
        Check (($names -join "|") -eq "precastapp/signed-tickets/2026/T20001.pdf|$earlierName") "they keep their year folder, spaces and brackets, and the .part file is left alone: $($names -join ', ')"

        $uploadsBefore = (Get-MockState).uploads
        $second = Send-B2NewFiles $b2 $signedSource $signedPrefix
        Check ($second.Total -eq 2 -and $second.Sent -eq 0 -and (Get-MockState).uploads -eq $uploadsBefore) "the second run uploads nothing (sent $($second.Sent))"

        # Written again after its upload, in the very same size.
        Start-Sleep -Milliseconds 1200
        New-TestFile "b2-signed\2026\T20001.pdf" "signed ONE"
        New-TestFile "b2-signed\2027\T20004.pdf" "next year"
        $third = Send-B2NewFiles $b2 $signedSource $signedPrefix
        Check ($third.Total -eq 3 -and $third.Sent -eq 2) "a ticket scanned again in the same size and a new one are uploaded (found $($third.Total), sent $($third.Sent))"

        Remove-Item -LiteralPath (Join-Path $signedSource "2026\T20002 (earlier version 1).pdf") -Force
        $fourth = Send-B2NewFiles $b2 $signedSource $signedPrefix
        $names = @(Get-B2Files $b2 $signedPrefix | ForEach-Object { $_.fileName })
        Check ($fourth.Total -eq 2 -and $fourth.Sent -eq 0 -and ($names -contains $earlierName)) "a ticket deleted on the server stays in the bucket"

        # Listings
        Set-MockConfig @{ pageSize = 2 }
        $all = @(Get-B2Files $b2 "precastapp/")
        Check ($all.Count -eq 5) "a long listing is read page by page ($($all.Count) of 5 files)"
        $top = @(Get-B2Files $b2 "precastapp/" "/")
        $topFiles = @($top | Where-Object { $_.action -ne "folder" })
        $topFolders = @($top | Where-Object { $_.action -eq "folder" })
        Check ($topFiles.Count -eq 2 -and $topFolders.Count -eq 1) "the nightly files are listed without the signed tickets ($($topFiles.Count) files, $($topFolders.Count) folder)"
        Check (@(Get-B2Files $b2 "nothing-here/").Count -eq 0) "an empty folder lists as no files"
        Set-MockConfig @{ pageSize = 1000 }

        Set-MockConfig @{ failUploads = 3 }
        New-TestFile "b2-signed\2027\T20005.pdf" "one more"
        $message = ""
        try { Send-B2NewFiles $b2 $signedSource $signedPrefix | Out-Null } catch { $message = $_.Exception.Message }
        Check ($message -like "1 of 3 file(s) not uploaded, first: precastapp/signed-tickets/2027/T20005.pdf*") "a signed ticket that will not upload is reported by name: $message"
    }
} catch {
    Check $false "unexpected error: $($_.Exception.Message)"
} finally {
    if ($mock -and -not $mock.HasExited) {
        Stop-Process -Id $mock.Id -Force -ErrorAction SilentlyContinue
    }
    Remove-Item -LiteralPath $scratch -Recurse -Force -ErrorAction SilentlyContinue
}

if ($failures -eq 0) {
    Write-Host "`nBackup script checks passed." -ForegroundColor Green
    exit 0
}
Write-Host "`n$failures check(s) failed." -ForegroundColor Red
exit 1
