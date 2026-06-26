# Verifies read/write access to job and stock submittals paths (local or UNC).
# Run as the service account that will run the app, or pass -Credential.
#
# Example:
#   .\scripts\deploy\verify-unc-access.ps1 -JobsRoot "\\FILESERVER\PrecastJobs" -StockSubmittalsRoot "\\FILESERVER\StockSubmittals"

param(
    [Parameter(Mandatory = $true)]
    [string] $JobsRoot,

    [Parameter(Mandatory = $true)]
    [string] $StockSubmittalsRoot,

    [pscredential] $Credential
)

$ErrorActionPreference = "Stop"

function Test-PathWriteAccess {
    param([string] $Label, [string] $RootPath)

    Write-Host "Testing: $Label" -ForegroundColor Cyan
    Write-Host "  Path: $RootPath"

    if (-not (Test-Path -LiteralPath $RootPath)) {
        Write-Host "  [FAIL] Path does not exist or is not reachable" -ForegroundColor Red
        return $false
    }

    $testName = ".precast-access-test-{0}" -f [guid]::NewGuid().ToString("N").Substring(0, 8)
    $testPath = Join-Path $RootPath $testName

    try {
        New-Item -ItemType Directory -Path $testPath -Force | Out-Null
        $testFile = Join-Path $testPath "write-test.txt"
        Set-Content -Path $testFile -Value "precastapp verify $(Get-Date -Format o)" -Encoding UTF8
        Remove-Item -LiteralPath $testPath -Recurse -Force
        Write-Host "  [OK] Read/write confirmed" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "  [FAIL] $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

$scriptBlock = {
    param($JobsRoot, $StockSubmittalsRoot)
    $jobsOk = Test-PathWriteAccess -Label "Jobs root" -RootPath $JobsRoot
    $stockOk = Test-PathWriteAccess -Label "Stock submittals root" -RootPath $StockSubmittalsRoot
    return ($jobsOk -and $stockOk)
}

if ($Credential) {
    Write-Host "Running verification as $($Credential.UserName)..." -ForegroundColor Gray
    $ok = Invoke-Command -ScriptBlock $scriptBlock -ArgumentList $JobsRoot, $StockSubmittalsRoot -Credential $Credential
} else {
    $ok = & $scriptBlock $JobsRoot $StockSubmittalsRoot
}

Write-Host ""
if ($ok) {
    Write-Host "UNC/path verification passed." -ForegroundColor Green
    exit 0
} else {
    Write-Host "Fix share/NTFS permissions for the app service account, then re-run." -ForegroundColor Yellow
    exit 1
}
