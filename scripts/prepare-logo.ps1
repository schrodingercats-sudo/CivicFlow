Add-Type -AssemblyName System.Drawing

$srcPath = "c:\Users\prath\OneDrive\Desktop\SKY\CivicFlow\ChatGPT Image Aug 27, 2026, 12_45_32 PM.png"
$bytes = [System.IO.File]::ReadAllBytes($srcPath)
$ms = New-Object System.IO.MemoryStream(,$bytes)
$img = [System.Drawing.Image]::FromStream($ms)

Write-Host "Original Image Dimensions: $($img.Width) x $($img.Height)"

# 1. Full Logo (Resized to 600 width for crisp retina rendering & fast load)
$fullW = 600
$fullH = [int]($img.Height * ($fullW / $img.Width))
$bmpFull = New-Object System.Drawing.Bitmap($fullW, $fullH)
$gFull = [System.Drawing.Graphics]::FromImage($bmpFull)
$gFull.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gFull.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$gFull.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$gFull.DrawImage($img, 0, 0, $fullW, $fullH)

$logoOut = "c:\Users\prath\OneDrive\Desktop\SKY\CivicFlow\frontend\public\logo.png"
$bmpFull.Save($logoOut, [System.Drawing.Imaging.ImageFormat]::Png)
$bmpFull.Dispose()
$gFull.Dispose()

# 2. Emblem Icon Only (Cropping the upper circular 'C' emblem for favicon & avatar)
# In the original image (e.g. 1024x1024 or similar), the circular emblem occupies roughly:
# X: 22% to 78%, Y: 5% to 66%
$cropX = [int]($img.Width * 0.22)
$cropY = [int]($img.Height * 0.05)
$cropW = [int]($img.Width * 0.56)
$cropH = [int]($img.Height * 0.60)

$iconSize = 256
$bmpIcon = New-Object System.Drawing.Bitmap($iconSize, $iconSize)
$gIcon = [System.Drawing.Graphics]::FromImage($bmpIcon)
$gIcon.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gIcon.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$gIcon.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$gIcon.Clear([System.Drawing.Color]::White)

$srcRect = New-Object System.Drawing.Rectangle($cropX, $cropY, $cropW, $cropH)
$destRect = New-Object System.Drawing.Rectangle(0, 0, $iconSize, $iconSize)
$gIcon.DrawImage($img, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

$iconOut = "c:\Users\prath\OneDrive\Desktop\SKY\CivicFlow\frontend\public\logo-icon.png"
$faviconOut = "c:\Users\prath\OneDrive\Desktop\SKY\CivicFlow\frontend\public\favicon.png"
$bmpIcon.Save($iconOut, [System.Drawing.Imaging.ImageFormat]::Png)
$bmpIcon.Save($faviconOut, [System.Drawing.Imaging.ImageFormat]::Png)

$bmpIcon.Dispose()
$gIcon.Dispose()
$img.Dispose()
$ms.Dispose()

Write-Host "Generated logo.png ($((Get-Item $logoOut).Length / 1KB) KB)"
Write-Host "Generated logo-icon.png ($((Get-Item $iconOut).Length / 1KB) KB)"
Write-Host "Generated favicon.png ($((Get-Item $faviconOut).Length / 1KB) KB)"
