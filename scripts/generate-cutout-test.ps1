param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

Add-Type -AssemblyName PresentationCore

$ids = @(
  "buffalo-trace-bourbon-1",
  "blantons-original-single-barrel-bourbon-whiskey-700ml",
  "eagle-rare-10-year-kentucky-straight-bourbon-whiskey-700ml",
  "w-l-weller-700ml-12-year-bourbon",
  "woodford-reserve-bourbon",
  "woodford-reserve-double-oaked-bourbon",
  "jim-beam-white-label",
  "knob-creek-kentucky-straight-bourbon",
  "knob-creek-bourbon-12-year",
  "makers-mark-101-proof-bourbon-whisky",
  "basil-hayden-s-kentucky-straight-bourbon",
  "russels-reserve-10-year-bourbon",
  "austin-nichols-wild-turkey-kentucky-straight-bourbon-whiskey-70cl",
  "four-roses",
  "elijah-craig-small-batch-bourbon",
  "old-forester-1897-bottled-in-bond",
  "old-forester-1910-old-fine-whiskey-bourbon-whiskey",
  "1792-single-barrel-kentucky-straight-bourbon",
  "yellowstone-select-kentucky-straight-bourbon",
  "michters-bourbon"
)

$dbPath = Join-Path $RepoRoot "db\bourbons.json"
$outDir = Join-Path $RepoRoot "assets\bourbons\cutouts-test"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$db = Get-Content -Raw -Path $dbPath | ConvertFrom-Json

function Load-BgraBitmap($path) {
  $stream = [System.IO.File]::OpenRead($path)
  try {
    $decoder = [System.Windows.Media.Imaging.BitmapDecoder]::Create(
      $stream,
      [System.Windows.Media.Imaging.BitmapCreateOptions]::PreservePixelFormat,
      [System.Windows.Media.Imaging.BitmapCacheOption]::OnLoad
    )
    $source = $decoder.Frames[0]
    $converted = New-Object System.Windows.Media.Imaging.FormatConvertedBitmap
    $converted.BeginInit()
    $converted.Source = $source
    $converted.DestinationFormat = [System.Windows.Media.PixelFormats]::Bgra32
    $converted.EndInit()
    return $converted
  }
  finally {
    $stream.Dispose()
  }
}

function Save-Png($pixels, $width, $height, $stride, $path) {
  $bitmap = [System.Windows.Media.Imaging.BitmapSource]::Create(
    $width,
    $height,
    96,
    96,
    [System.Windows.Media.PixelFormats]::Bgra32,
    $null,
    $pixels,
    $stride
  )
  $encoder = New-Object System.Windows.Media.Imaging.PngBitmapEncoder
  $encoder.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($bitmap))
  $fs = [System.IO.File]::Create($path)
  try { $encoder.Save($fs) } finally { $fs.Dispose() }
}

function ClampByte($v) {
  if ($v -lt 0) { return 0 }
  if ($v -gt 255) { return 255 }
  return [byte][Math]::Round($v)
}

$report = foreach ($id in $ids) {
  $bottle = $db.bottles | Where-Object { $_.id -eq $id } | Select-Object -First 1
  if (-not $bottle) {
    [pscustomobject]@{ id = $id; status = "missing-db"; output = "" }
    continue
  }

  $imagePath = Join-Path $RepoRoot ($bottle.image -replace "/", "\")
  if (-not (Test-Path -LiteralPath $imagePath)) {
    [pscustomobject]@{ id = $id; status = "missing-image"; output = "" }
    continue
  }

  $bitmap = Load-BgraBitmap $imagePath
  $width = $bitmap.PixelWidth
  $height = $bitmap.PixelHeight
  $stride = $width * 4
  $pixels = New-Object byte[] ($stride * $height)
  $bitmap.CopyPixels($pixels, $stride, 0)

  [int[]]$cornerIndices = @()
  $cornerIndices += 0
  $cornerIndices += [int](($width - 1) * 4)
  $cornerIndices += [int](($height - 1) * $stride)
  $cornerIndices += [int]((($height - 1) * $stride) + (($width - 1) * 4))
  $bgB = 0; $bgG = 0; $bgR = 0
  foreach ($i in $cornerIndices) {
    $bgB += $pixels[$i]
    $bgG += $pixels[$i + 1]
    $bgR += $pixels[$i + 2]
  }
  $bgB /= $cornerIndices.Count
  $bgG /= $cornerIndices.Count
  $bgR /= $cornerIndices.Count
  $bgBrightness = ($bgR + $bgG + $bgB) / 3

  $minX = $width
  $minY = $height
  $maxX = -1
  $maxY = -1

  for ($y = 0; $y -lt $height; $y++) {
    $row = $y * $stride
    for ($x = 0; $x -lt $width; $x++) {
      $i = $row + ($x * 4)
      $bb = [double]$pixels[$i]
      $gg = [double]$pixels[$i + 1]
      $rr = [double]$pixels[$i + 2]
      $aa = [double]$pixels[$i + 3]
      $brightness = ($rr + $gg + $bb) / 3
      $spread = [Math]::Max($rr, [Math]::Max($gg, $bb)) - [Math]::Min($rr, [Math]::Min($gg, $bb))
      $dist = [Math]::Sqrt((($rr - $bgR) * ($rr - $bgR)) + (($gg - $bgG) * ($gg - $bgG)) + (($bb - $bgB) * ($bb - $bgB)))
      $whiteDist = [Math]::Sqrt((($rr - 255) * ($rr - 255)) + (($gg - 255) * ($gg - 255)) + (($bb - 255) * ($bb - 255)))

      $removeScore = 0
      if ($bgBrightness -gt 185 -and $dist -lt 78 -and $brightness -gt 172 -and $spread -lt 46) {
        $removeScore = [Math]::Max($removeScore, 1 - ($dist / 78))
      }
      if ($whiteDist -lt 72 -and $spread -lt 52) {
        $removeScore = [Math]::Max($removeScore, 1 - ($whiteDist / 72))
      }

      $newA = $aa
      if ($removeScore -gt 0.72) {
        $newA = 0
      } elseif ($removeScore -gt 0.28) {
        $newA = $aa * (1 - (($removeScore - 0.28) / 0.44))
      }
      $pixels[$i + 3] = ClampByte $newA

      if ($pixels[$i + 3] -gt 28) {
        if ($x -lt $minX) { $minX = $x }
        if ($y -lt $minY) { $minY = $y }
        if ($x -gt $maxX) { $maxX = $x }
        if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }

  if ($maxX -lt 0) {
    [pscustomobject]@{ id = $id; status = "empty-mask"; output = "" }
    continue
  }

  $pad = 8
  $minX = [Math]::Max(0, $minX - $pad)
  $minY = [Math]::Max(0, $minY - $pad)
  $maxX = [Math]::Min($width - 1, $maxX + $pad)
  $maxY = [Math]::Min($height - 1, $maxY + $pad)
  $cropW = $maxX - $minX + 1
  $cropH = $maxY - $minY + 1
  $cropStride = $cropW * 4
  $crop = New-Object byte[] ($cropStride * $cropH)
  for ($cy = 0; $cy -lt $cropH; $cy++) {
    [Array]::Copy($pixels, (($minY + $cy) * $stride) + ($minX * 4), $crop, $cy * $cropStride, $cropStride)
  }

  $out = Join-Path $outDir "$id.png"
  Save-Png $crop $cropW $cropH $cropStride $out
  [pscustomobject]@{ id = $id; status = "ok"; output = $out }
}

$report | Format-Table -AutoSize
