Add-Type -AssemblyName System.Drawing
$sizes = @(16, 32, 48, 128)
$iconDir = "C:\Users\ZIG ZAG\.gemini\antigravity\scratch\autoflow-chrome-extension\icons"

foreach ($size in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)

    $rect = New-Object System.Drawing.Rectangle 0, 0, $size, $size
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $rect,
        [System.Drawing.Color]::FromArgb(255, 99, 102, 241),
        [System.Drawing.Color]::FromArgb(255, 168, 85, 247),
        45.0
    )
    $g.FillEllipse($brush, 1, 1, ($size - 2), ($size - 2))

    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, [Math]::Max(1, [int]($size / 10)))
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

    $p1 = New-Object System.Drawing.PointF ($size * 0.55), ($size * 0.2)
    $p2 = New-Object System.Drawing.PointF ($size * 0.35), ($size * 0.52)
    $p3 = New-Object System.Drawing.PointF ($size * 0.55), ($size * 0.52)
    $p4 = New-Object System.Drawing.PointF ($size * 0.45), ($size * 0.8)

    $points = [System.Drawing.PointF[]]@($p1, $p2, $p3, $p4)
    $g.DrawLines($pen, $points)

    $filePath = Join-Path $iconDir "icon$size.png"
    $bmp.Save($filePath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Generated icon: $filePath"
}
