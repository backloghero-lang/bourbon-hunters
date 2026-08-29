param(
  [string]$SigningDir = "$env:USERPROFILE\Documents\Bourbon-Hunters-Signing"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$android = Join-Path $root "android"
$artifacts = Join-Path $root "artifacts"
$downloads = Join-Path $root "downloads"
$keystore = Join-Path $SigningDir "bourbon-hunters-release.p12"
$credentials = Get-ChildItem -LiteralPath $SigningDir -Filter "*.txt" | Select-Object -First 1

if (!(Test-Path -LiteralPath $keystore) -or !$credentials) {
  throw "Brakuje lokalnego klucza lub pliku danych podpisu w $SigningDir"
}

$password = ((Get-Content -LiteralPath $credentials.FullName -Encoding UTF8 | Where-Object { $_ -like "Store password:*" }) -replace "^Store password:\s*", "")
if (!$password) { throw "Nie znaleziono hasła magazynu kluczy." }

$javaCandidates = @(
  "C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot",
  "$env:USERPROFILE\.jdks\jbr-21.0.11",
  "C:\Program Files\Android\Android Studio\jbr"
)
$javaHome = $javaCandidates | Where-Object {
  Test-Path -LiteralPath (Join-Path $_ "bin\java.exe")
} | Select-Object -First 1
if (!$javaHome) { throw "Nie znaleziono JDK do zbudowania aplikacji." }
$buildTools = Join-Path $env:LOCALAPPDATA "Android\Sdk\build-tools\36.0.0"
$zipalign = Join-Path $buildTools "zipalign.exe"
$apksigner = Join-Path $buildTools "apksigner.bat"
$unsigned = Join-Path $android "app\build\outputs\apk\release\app-release-unsigned.apk"
$aligned = Join-Path $artifacts "Bourbon-Hunters-demo-v0.1.4-aligned.apk"
$signed = Join-Path $artifacts "Bourbon-Hunters-demo-v0.1.4-release.apk"
$publicApk = Join-Path $downloads "Bourbon-Hunters-demo.apk"
$pnpm = "C:\Users\masly\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd"
$runtimeBin = "C:\Users\masly\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin"

$env:JAVA_HOME = $javaHome
$env:CI = "true"
$env:PATH = "$javaHome\bin;$runtimeBin;$env:PATH"
New-Item -ItemType Directory -Force -Path $artifacts, $downloads | Out-Null

Push-Location $root
try {
  & $pnpm run mobile:bundle
  if ($LASTEXITCODE) { throw "Przygotowanie lokalnej zawartosci APK nie powiodlo sie." }
  & .\node_modules\.bin\cap.CMD sync android
  if ($LASTEXITCODE) { throw "Synchronizacja Capacitor nie powiodla sie." }
} finally {
  Pop-Location
}

Push-Location $android
try {
  & .\gradlew.bat assembleRelease --no-daemon
  if ($LASTEXITCODE) { throw "Gradle assembleRelease nie powiódł się." }
} finally {
  Pop-Location
}

& $zipalign -f -p 4 $unsigned $aligned
if ($LASTEXITCODE) { throw "zipalign nie powiódł się." }

& $apksigner sign --ks $keystore --ks-type PKCS12 --ks-key-alias bourbon-hunters --ks-pass "pass:$password" --key-pass "pass:$password" --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true --v4-signing-enabled false --out $signed $aligned
if ($LASTEXITCODE) { throw "Podpisanie APK nie powiodło się." }

& $apksigner verify --verbose --print-certs $signed
if ($LASTEXITCODE) { throw "Weryfikacja podpisu APK nie powiodła się." }

Copy-Item -LiteralPath $signed -Destination $publicApk -Force
Get-Item -LiteralPath $publicApk | Select-Object FullName, Length, LastWriteTime
Get-FileHash -LiteralPath $publicApk -Algorithm SHA256
