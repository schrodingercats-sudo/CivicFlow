Add-Type -AssemblyName System.Drawing

$files = Get-ChildItem -Path "c:\Users\prath\OneDrive\Desktop\SKY\CivicFlow\frontend\public\images\complaints\*.jpg"
$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
$encoder = [System.Drawing.Imaging.Encoder]::Quality
$encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter($encoder, [long]70)

foreach ($f in $files) {
    $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
    $ms = New-Object System.IO.MemoryStream(,$bytes)
    $img = [System.Drawing.Image]::FromStream($ms)

    $maxWidth = 500
    $targetW = [Math]::Min($img.Width, $maxWidth)
    $targetH = [int]($img.Height * ($targetW / $img.Width))

    $bmp = New-Object System.Drawing.Bitmap($targetW, $targetH)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($img, 0, 0, $targetW, $targetH)

    $outMs = New-Object System.IO.MemoryStream
    $bmp.Save($outMs, $jpegCodec, $encoderParams)
    [System.IO.File]::WriteAllBytes($f.FullName, $outMs.ToArray())

    $img.Dispose()
    $ms.Dispose()
    $bmp.Dispose()
    $g.Dispose()
    $outMs.Dispose()

    $newSize = (Get-Item $f.FullName).Length / 1KB
    Write-Host "Compressed $($f.Name) -> $($newSize.ToString('F1')) KB"
}
