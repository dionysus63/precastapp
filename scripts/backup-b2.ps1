# Minimal Backblaze B2 client in plain PowerShell (Backblaze's native API,
# version 4), shared by backup-database.ps1 and deploy\check-backup.ps1.
# Dot-source it.
#
# It uses only Invoke-RestMethod, so there is no extra program for antivirus
# to block. Each upload sends the file's SHA-1, and Backblaze refuses the
# upload if the bytes it received do not match. Nothing in here ever deletes
# or hides a file in the bucket.
#
# Keep this file plain ASCII and Windows PowerShell 5.1 compatible: the
# nightly task runs it with powershell.exe.
# Self-check: scripts\deploy\test-backup-script.ps1.

$B2ApiVersion = "v4"
$B2AuthUrl = "https://api.backblazeb2.com/b2api/$B2ApiVersion/b2_authorize_account"
# Seconds to wait before another try of a failed upload, times the try number.
$B2RetryDelaySeconds = 5

# Invoke-RestMethod with the switches both PowerShell editions need.
function Invoke-B2Request([hashtable] $Request) {
    # The progress bar slows large transfers badly in Windows PowerShell.
    $ProgressPreference = "SilentlyContinue"
    if ($PSVersionTable.PSVersion.Major -ge 6) {
        # PowerShell 7 refuses Backblaze's tokens as Authorization values otherwise.
        $Request["SkipHeaderValidation"] = $true
    }
    # UseBasicParsing: the task's account may never have opened Internet Explorer.
    return Invoke-RestMethod @Request -UseBasicParsing
}

# Backblaze answers an error with JSON: { status, code, message }.
function Get-B2ErrorText($err) {
    if ($err.ErrorDetails -and $err.ErrorDetails.Message) {
        try {
            $body = $err.ErrorDetails.Message | ConvertFrom-Json
            if ($body.message) { return "$($body.status) $($body.code): $($body.message)" }
        } catch { }
        # Not Backblaze's JSON, e.g. a web filter's block page: keep it short.
        $text = "$($err.ErrorDetails.Message)" -replace "\s+", " "
        if ($text.Length -gt 300) { $text = $text.Substring(0, 300) + "..." }
        return $text
    }
    return $err.Exception.Message
}

function Invoke-B2Api($session, [string] $operation, [hashtable] $body) {
    $json = $body | ConvertTo-Json -Compress
    try {
        return Invoke-B2Request @{
            Method      = "Post"
            Uri         = "$($session.ApiUrl)/b2api/$B2ApiVersion/$operation"
            Headers     = @{ Authorization = $session.Token }
            ContentType = "application/json"
            Body        = [Text.Encoding]::UTF8.GetBytes($json)
        }
    } catch {
        throw "Backblaze $operation failed: $(Get-B2ErrorText $_)"
    }
}

# Signs in with an application key and finds the bucket. Returns the session
# the other functions take.
function Connect-B2([string] $KeyId, [string] $Key, [string] $Bucket, [string] $AuthUrl = $B2AuthUrl) {
    $ErrorActionPreference = "Stop"
    if (-not $KeyId -or -not $Key) {
        throw "BACKUP_B2_KEY_ID and BACKUP_B2_KEY must be set in .env"
    }
    # Windows PowerShell 5.1 does not always offer TLS 1.2 by default.
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

    $basic = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${KeyId}:${Key}"))
    try {
        $auth = Invoke-B2Request @{
            Method  = "Get"
            Uri     = $AuthUrl
            Headers = @{ Authorization = "Basic $basic" }
        }
    } catch {
        throw "Backblaze sign-in failed: $(Get-B2ErrorText $_)"
    }

    # Version 4 answers with apiInfo.storageApi; older versions put the same
    # fields at the top level. Read either.
    $storage = $auth
    if ($auth.apiInfo -and $auth.apiInfo.storageApi) { $storage = $auth.apiInfo.storageApi }
    if (-not $storage.apiUrl -or -not $auth.authorizationToken) {
        throw "Backblaze sign-in answered without an API address or a token"
    }
    $session = [pscustomobject]@{
        ApiUrl   = $storage.apiUrl
        Token    = $auth.authorizationToken
        Bucket   = $Bucket
        BucketId = $null
    }

    # A key limited to certain buckets names them in the answer (version 4:
    # allowed.buckets; older versions: bucketId and bucketName). A key for the
    # whole account names none, so the bucket is looked up by name.
    $limitedTo = @()
    $allowed = $storage.allowed
    if ($allowed -and $allowed.buckets) {
        foreach ($entry in @($allowed.buckets)) {
            if ($entry -and $entry.id) { $limitedTo += [pscustomobject]@{ Id = $entry.id; Name = $entry.name } }
        }
    } elseif ($allowed -and $allowed.bucketId) {
        $limitedTo += [pscustomobject]@{ Id = $allowed.bucketId; Name = $allowed.bucketName }
    } elseif ($storage.bucketId) {
        $limitedTo += [pscustomobject]@{ Id = $storage.bucketId; Name = $storage.bucketName }
    }

    if ($limitedTo.Count -gt 0) {
        foreach ($entry in $limitedTo) {
            if ($entry.Name -eq $Bucket) { $session.BucketId = $entry.Id; break }
        }
        if (-not $session.BucketId) {
            $names = @($limitedTo | ForEach-Object { if ($_.Name) { "'$($_.Name)'" } else { "(a bucket that no longer exists)" } }) -join ", "
            throw "this Backblaze key only allows bucket $names, not '$Bucket'"
        }
    } else {
        $list = Invoke-B2Api $session "b2_list_buckets" @{ accountId = $auth.accountId; bucketName = $Bucket }
        foreach ($found in @($list.buckets)) {
            if ($found -and $found.bucketId) { $session.BucketId = $found.bucketId; break }
        }
        if (-not $session.BucketId) {
            throw "Backblaze bucket '$Bucket' not found for this key"
        }
    }
    return $session
}

# Uploads one file under the given name (forward slashes make folders).
# Uploading a name the bucket already holds adds a new version; the old one
# stays until the bucket's own lifecycle rule removes it.
function Send-B2File($session, [string] $Path, [string] $FileName) {
    $ErrorActionPreference = "Stop"
    $sha1 = (Get-FileHash -Algorithm SHA1 -LiteralPath $Path).Hash.ToLower()
    # Percent-encode all but letters, digits, "-", "_", "." and "~". "/" stays,
    # because it separates folders. Windows PowerShell leaves five more
    # characters alone, so those are done by hand.
    $encodedName = [Uri]::EscapeDataString($FileName).Replace("%2F", "/").Replace("!", "%21").Replace("'", "%27").Replace("(", "%28").Replace(")", "%29").Replace("*", "%2A")
    $lastError = $null

    # Backblaze asks clients to fetch a fresh upload URL and try again when an upload fails.
    for ($attempt = 1; $attempt -le 3; $attempt++) {
        try {
            $target = Invoke-B2Api $session "b2_get_upload_url" @{ bucketId = $session.BucketId }
            $result = Invoke-B2Request @{
                Method      = "Post"
                Uri         = $target.uploadUrl
                InFile      = $Path
                ContentType = "b2/x-auto"
                TimeoutSec  = 3600
                Headers     = @{
                    Authorization       = $target.authorizationToken
                    "X-Bz-File-Name"    = $encodedName
                    "X-Bz-Content-Sha1" = $sha1
                }
            }
            if ($result.contentSha1 -ne $sha1) {
                throw "checksum mismatch after upload"
            }
            return $result
        } catch {
            $lastError = Get-B2ErrorText $_
            if ($attempt -lt 3) { Start-Sleep -Seconds ($B2RetryDelaySeconds * $attempt) }
        }
    }
    throw "upload of $FileName failed after 3 attempts: $lastError"
}

# Lists the newest version of every file whose name starts with the prefix.
# With -Delimiter "/" it stays inside that one folder: files in sub-folders
# are left out and each sub-folder comes back as one entry whose action is
# "folder". Always wrap the call in @( ) so that no files gives an empty list.
function Get-B2Files($session, [string] $Prefix, [string] $Delimiter) {
    $files = @()
    $start = $null
    do {
        $body = @{ bucketId = $session.BucketId; prefix = $Prefix; maxFileCount = 1000 }
        if ($Delimiter) { $body["delimiter"] = $Delimiter }
        if ($start) { $body["startFileName"] = $start }
        $page = Invoke-B2Api $session "b2_list_file_names" $body
        foreach ($entry in @($page.files)) {
            if ($entry) { $files += $entry }
        }
        $start = $page.nextFileName
    } while ($start)
    return $files
}

# Uploads every file under a folder that the bucket does not hold yet, holds
# in another size, or that was written again after its upload. Nothing is
# removed from the bucket, so a file that is later replaced or deleted on
# this server stays backed up. Returns how many files the folder holds and
# how many were sent; throws after trying every file if any could not be sent.
function Send-B2NewFiles($session, [string] $SourceDir, [string] $Prefix) {
    $ErrorActionPreference = "Stop"
    $root = (Get-Item -LiteralPath $SourceDir).FullName.TrimEnd([char[]]@('\', '/'))
    $have = @{}
    foreach ($remote in @(Get-B2Files $session $Prefix)) {
        $have[$remote.fileName] = $remote
    }
    $total = 0
    $sent = 0
    $failed = @()
    foreach ($file in @(Get-ChildItem -LiteralPath $root -File -Recurse -Force)) {
        # The app writes "<name>.part" and renames it into place a moment later.
        if ($file.Extension -eq ".part") { continue }
        $total++
        $name = $Prefix + $file.FullName.Substring($root.Length + 1).Replace('\', '/')
        $existing = $have[$name]
        if ($existing) {
            $writtenMs = ([DateTimeOffset] $file.LastWriteTimeUtc).ToUnixTimeMilliseconds()
            if (([int64] $existing.contentLength) -eq $file.Length -and $writtenMs -le ([int64] $existing.uploadTimestamp)) {
                continue
            }
        }
        try {
            Send-B2File $session $file.FullName $name | Out-Null
            $sent++
        } catch {
            $failed += "$name ($($_.Exception.Message))"
        }
    }
    if ($failed.Count -gt 0) {
        throw "$($failed.Count) of $total file(s) not uploaded, first: $($failed[0])"
    }
    return @{ Total = $total; Sent = $sent }
}
