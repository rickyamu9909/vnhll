$ErrorActionPreference = "Stop"
$BuildRoot = if ($env:ANTS_ANDROID_BUILD) { $env:ANTS_ANDROID_BUILD } else { "C:\Users\10841\android-build" }
# aapt2 不吃含中文的路径：必须从 ASCII junction（如 android-build\ants-android）打包，不要 resolve 到真实目录
$Project = $PSScriptRoot
$Sdk = Join-Path $BuildRoot "sdk"
$BuildTools = Join-Path $Sdk "build-tools\34.0.0"
$AndroidJar = Join-Path $Sdk "platforms\android-34\android.jar"
$Jdk = Join-Path $BuildRoot "jdk-17.0.20.1+1"
$Kotlinc = Join-Path $BuildRoot "kotlinc\bin\kotlinc.bat"
$Stdlib = Join-Path $BuildRoot "kotlinc\lib\kotlin-stdlib.jar"
$Work = Join-Path $BuildRoot "apk-work"
$Keystore = Join-Path $BuildRoot "debug.keystore"
$OutDir = if (Test-Path (Join-Path $BuildRoot "ants-android")) { $BuildRoot } else { Split-Path $Project -Parent }
$Out = Join-Path $OutDir "ANTS-driver.apk"

if (-not (Test-Path $Kotlinc)) { throw "Missing Kotlin compiler: $Kotlinc" }
if (-not (Test-Path $AndroidJar)) { throw "Missing Android platform: $AndroidJar" }

$env:JAVA_HOME = $Jdk
$env:Path = "$(Join-Path $Jdk 'bin');$env:Path"

if (Test-Path $Work) { Remove-Item $Work -Recurse -Force }
New-Item -ItemType Directory -Force -Path (Join-Path $Work "classes"), (Join-Path $Work "dex") | Out-Null

& (Join-Path $BuildTools "aapt2.exe") compile --dir (Join-Path $Project "app\src\main\res") -o (Join-Path $Work "res.zip")
if ($LASTEXITCODE -ne 0) { throw "aapt2 compile failed" }

& (Join-Path $BuildTools "aapt2.exe") link `
    -o (Join-Path $Work "unsigned.apk") `
    -I $AndroidJar `
    --manifest (Join-Path $Project "app\src\main\AndroidManifest.xml") `
    --java (Join-Path $Work "gen") `
    --min-sdk-version 26 `
    --target-sdk-version 34 `
    (Join-Path $Work "res.zip")
if ($LASTEXITCODE -ne 0) { throw "aapt2 link failed" }

$javaFiles = @(Get-ChildItem (Join-Path $Work "gen") -Recurse -Filter *.java | ForEach-Object FullName)
& (Join-Path $Jdk "bin\javac.exe") -encoding UTF-8 -source 17 -target 17 -cp $AndroidJar -d (Join-Path $Work "classes") @javaFiles
if ($LASTEXITCODE -ne 0) { throw "javac failed" }

$kotlinFiles = @(Get-ChildItem (Join-Path $Project "app\src\main\java") -Recurse -Filter *.kt | ForEach-Object FullName)
$kotlinArgs = Join-Path $Work "kotlinc.args"
@(
    "-jvm-target", "17",
    "-classpath", "$AndroidJar;$(Join-Path $Work 'classes')",
    "-d", (Join-Path $Work "classes")
) + $kotlinFiles | Set-Content -Encoding ascii $kotlinArgs
& $Kotlinc "@$kotlinArgs"
if ($LASTEXITCODE -ne 0) { throw "kotlinc failed" }

& (Join-Path $Jdk "bin\jar.exe") --create --file (Join-Path $Work "classes.jar") -C (Join-Path $Work "classes") .
if ($LASTEXITCODE -ne 0) { throw "jar failed" }

& (Join-Path $BuildTools "d8.bat") --min-api 26 --lib $AndroidJar --output (Join-Path $Work "dex") (Join-Path $Work "classes.jar") $Stdlib
if ($LASTEXITCODE -ne 0) { throw "d8 failed" }

Push-Location (Join-Path $Work "dex")
& (Join-Path $Jdk "bin\jar.exe") --update --file (Join-Path $Work "unsigned.apk") classes.dex
$jarCode = $LASTEXITCODE
Pop-Location
if ($jarCode -ne 0) { throw "adding classes.dex failed" }

& (Join-Path $BuildTools "zipalign.exe") -p -f 4 (Join-Path $Work "unsigned.apk") (Join-Path $Work "aligned.apk")
if ($LASTEXITCODE -ne 0) { throw "zipalign failed" }

if (-not (Test-Path $Keystore)) {
    & (Join-Path $Jdk "bin\keytool.exe") -genkeypair -keystore $Keystore -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US"
    if ($LASTEXITCODE -ne 0) { throw "keytool failed" }
}

& (Join-Path $BuildTools "apksigner.bat") sign --ks $Keystore --ks-key-alias androiddebugkey --ks-pass pass:android --key-pass pass:android --out $Out (Join-Path $Work "aligned.apk")
if ($LASTEXITCODE -ne 0) { throw "apksigner failed" }

Write-Output "APK: $Out"
