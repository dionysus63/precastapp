# Minimal Backblaze B2 client in plain PowerShell (native B2 API v2), shared by
# backup-database.ps1 and deploy\check-backup.ps1. Dot-source it.
#
# Uses only Invoke-RestMethod, so there is no extra program for antivirus to
# block. Each upload sends the file's SHA-1, and B2 rejects the upload if the
# bytes it received don't match.

$B2AuthUrl = "https://api.backblazeb2.com/b2api/v2/b2_authorize_account"

function Get-B2ErrorText($err) {
    if ($err.ErrorDetails -and $err.ErrorDetails.Message) {
        try {
            $body = $err.ErrorDetails.Message | ConvertFrom-Json
            if ($body.message) { return "$($body.status) $($body.code): $($body.message)" }
        } catch { }
        return $err.ErrorDetails.Message
    }
    return $err.Exception.Message
}

function Connect-B2([string] $KeyId, [string] $Key, [string] $Bucket, [string] $AuthUrl = $B2AuthUrl) {
    # Windows PowerShell 5.1 does not offer TLS 1.2 by default.
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

    $basic = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${KeyId}:${Key}"))
    try {
        $auth = Invoke-RestMethod -Method Get -Uri $AuthUrl -Headers @{ Authorization = "Basic $basic" }
    } catch {
        throw "Backblaze sign-in failed: $(Get-B2ErrorText $_)"
    }

    # A key limited to one bucket reports it here; otherwise look the bucket up by name.
    $bucketId = $null
    if ($auth.allowed -and $auth.allowed.bucketId) {
        if ($auth.allowed.bucketName -ne $Bucket) {
            throw "This Backblaze key only allows bucket '$($auth.allowed.bucketName)', not '$Bucket'"
        }
        $bucketId = $auth.allowed.bucketId
    } else {
        $list = Invoke-B2Api $auth "b2_list_buckets" @{ accountId = $auth.accountId; bucketName = $Bucket }
        if ($list.buckets.Count -gt 0) { $bucketId = $list.buckets[0].bucketId }
    }
    if (-not $bucketId) {
        throw "Backblaze bucket '$Bucket' not found for this key"
    }

    return [pscustomobject]@{
        ApiUrl   = $auth.apiUrl
        Token    = $auth.authorizationToken
        BucketId = $bucketId
    }
}

function Invoke-B2Api($session, [string] $operation, $body) {
    $apiUrl = if ($session.ApiUrl) { $session.ApiUrl } else { $session.apiUrl }
    $token = if ($session.Token) { $session.Token } else { $session.authorizationToken }
    try {
        return Invoke-RestMethod -Method Post -Uri "$apiUrl/b2api/v2/$operation" `
            -Headers @{ Authorization = $token } -ContentType "application/json" `
            -Body ($body | ConvertTo-Json -Compress)
    } catch {
        throw "Backblaze $operation failed: $(Get-B2ErrorText $_)"
    }
}

function Send-B2File($session, [string] $Path, [string] $FileName) {
    $sha1 = (Get-FileHash -Algorithm SHA1 $Path).Hash.ToLower()
    $encodedName = [Uri]::EscapeDataString($FileName).Replace("%2F", "/")
    $lastError = $null

    # B2 asks clients to fetch a fresh upload URL and retry when an upload fails.
    for ($attempt = 1; $attempt -le 3; $attempt++) {
        try {
            $target = Invoke-B2Api $session "b2_get_upload_url" @{ bucketId = $session.BucketId }
            $result = Invoke-RestMethod -Method Post -Uri $target.uploadUrl -InFile $Path -ContentType "b2/x-auto" -Headers @{
                Authorization        = $target.authorizationToken
                "X-Bz-File-Name"     = $encodedName
                "X-Bz-Content-Sha1"  = $sha1
            }
            if ($result.contentSha1 -ne $sha1) {
                throw "checksum mismatch after upload"
            }
            return $result
        } catch {
            $lastError = Get-B2ErrorText $_
            if ($attempt -lt 3) { Start-Sleep -Seconds (5 * $attempt) }
        }
    }
    throw "upload of $FileName failed after 3 attempts: $lastError"
}

function Get-B2Files($session, [string] $Prefix) {
    $files = @()
    $start = $null
    do {
        $body = @{ bucketId = $session.BucketId; prefix = $Prefix; maxFileCount = 1000 }
        if ($start) { $body.startFileName = $start }
        $page = Invoke-B2Api $session "b2_list_file_names" $body
        $files += @($page.files)
        $start = $page.nextFileName
    } while ($start)
    return $files
}
