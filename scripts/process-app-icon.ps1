# Builds electron/icon.png from the brand logo (512x512 square).
param(
    [Parameter(Mandatory = $true)]
    [string] $SourcePath,

    [string] $OutputPath = "",

    [switch] $SkipSmRemoval,

    [switch] $AutoTrimWhite,

    [double] $PaddingPercent = 8,

    [int] $TrimThreshold = 245,

    [switch] $RoundCorners,

    [double] $CornerRadiusPercent = 22
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

function Test-IsBackgroundPixel($color, [int] $threshold) {
    return $color.R -ge $threshold -and $color.G -ge $threshold -and $color.B -ge $threshold
}

function Get-TrimBounds([System.Drawing.Bitmap] $bitmap, [int] $threshold) {
    $minX = $bitmap.Width
    $minY = $bitmap.Height
    $maxX = 0
    $maxY = 0
    $found = $false

    for ($y = 0; $y -lt $bitmap.Height; $y++) {
        for ($x = 0; $x -lt $bitmap.Width; $x++) {
            $pixel = $bitmap.GetPixel($x, $y)
            if (-not (Test-IsBackgroundPixel $pixel $threshold)) {
                $found = $true
                if ($x -lt $minX) { $minX = $x }
                if ($y -lt $minY) { $minY = $y }
                if ($x -gt $maxX) { $maxX = $x }
                if ($y -gt $maxY) { $maxY = $y }
            }
        }
    }

    if (-not $found) {
        return @{ X = 0; Y = 0; Width = $bitmap.Width; Height = $bitmap.Height }
    }

    return @{
        X = $minX
        Y = $minY
        Width = ($maxX - $minX + 1)
        Height = ($maxY - $minY + 1)
    }
}

function New-RoundedRectanglePath([int] $x, [int] $y, [int] $width, [int] $height, [int] $radius) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $diameter = $radius * 2
    $path.AddArc($x, $y, $diameter, $diameter, 180, 90)
    $path.AddArc($x + $width - $diameter, $y, $diameter, $diameter, 270, 90)
    $path.AddArc($x + $width - $diameter, $y + $height - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc($x, $y + $height - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()
    return $path
}

$sourcePath = (Resolve-Path $SourcePath).Path
if (-not $OutputPath) {
    $OutputPath = Join-Path (Split-Path $PSScriptRoot -Parent) "electron\icon.png"
}
$outputPath = $OutputPath

$source = [System.Drawing.Image]::FromFile($sourcePath)
$work = $null
$icon = $null

try {
    $work = New-Object System.Drawing.Bitmap $source.Width, $source.Height
    $gWork = [System.Drawing.Graphics]::FromImage($work)
    $gWork.Clear([System.Drawing.Color]::White)
    $gWork.DrawImage($source, 0, 0, $source.Width, $source.Height)
    $gWork.Dispose()

    if (-not $SkipSmRemoval) {
        $smWidth = [int][Math]::Max(72, $source.Width * 0.18)
        $smHeight = [int][Math]::Max(56, $source.Height * 0.14)
        $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
        $gWork = [System.Drawing.Graphics]::FromImage($work)
        $gWork.FillRectangle($brush, 0, $source.Height - $smHeight - 4, $smWidth, $smHeight + 4)
        $brush.Dispose()
        $gWork.Dispose()
    }

    if ($AutoTrimWhite) {
        $bounds = Get-TrimBounds $work $TrimThreshold
        $cropped = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
        $gCrop = [System.Drawing.Graphics]::FromImage($cropped)
        $gCrop.DrawImage(
            $work,
            (New-Object System.Drawing.Rectangle 0, 0, $bounds.Width, $bounds.Height),
            (New-Object System.Drawing.Rectangle $bounds.X, $bounds.Y, $bounds.Width, $bounds.Height),
            [System.Drawing.GraphicsUnit]::Pixel
        )
        $gCrop.Dispose()
        $work.Dispose()
        $work = $cropped
    }

    $size = 512
    $flat = New-Object System.Drawing.Bitmap $size, $size
    $gFlat = [System.Drawing.Graphics]::FromImage($flat)
    $gFlat.Clear([System.Drawing.Color]::White)
    $gFlat.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $gFlat.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $gFlat.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $padding = [int][Math]::Round($size * ($PaddingPercent / 100.0))
    $maxDim = $size - (2 * $padding)
    $scale = [Math]::Min($maxDim / $work.Width, $maxDim / $work.Height)
    $drawW = [int]($work.Width * $scale)
    $drawH = [int]($work.Height * $scale)
    $x = [int](($size - $drawW) / 2)
    $y = [int](($size - $drawH) / 2)
    $gFlat.DrawImage($work, $x, $y, $drawW, $drawH)
    $gFlat.Dispose()

    if ($RoundCorners) {
        $icon = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $gIcon = [System.Drawing.Graphics]::FromImage($icon)
        $gIcon.Clear([System.Drawing.Color]::Transparent)
        $gIcon.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $radius = [int][Math]::Max(8, [Math]::Round($size * ($CornerRadiusPercent / 100.0)))
        $clipPath = New-RoundedRectanglePath -x 0 -y 0 -width $size -height $size -radius $radius
        $gIcon.SetClip($clipPath)
        $gIcon.Clear([System.Drawing.Color]::White)
        $gIcon.DrawImage($flat, 0, 0, $size, $size)
        $gIcon.ResetClip()
        $clipPath.Dispose()
        $gIcon.Dispose()
        $flat.Dispose()
    } else {
        $icon = $flat
    }

    $outDir = Split-Path $outputPath -Parent
    if (-not (Test-Path $outDir)) {
        New-Item -ItemType Directory -Path $outDir -Force | Out-Null
    }

    $icon.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $roundLabel = if ($RoundCorners) { ", corners ${CornerRadiusPercent}%" } else { "" }
    Write-Host "[OK] Wrote $outputPath (${size}x${size}, padding ${PaddingPercent}%, trim=$AutoTrimWhite$roundLabel)" -ForegroundColor Green
} finally {
    $source.Dispose()
    if ($work) { $work.Dispose() }
    if ($icon) { $icon.Dispose() }
}
