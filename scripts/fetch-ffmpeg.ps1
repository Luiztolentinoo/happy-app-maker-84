# Downloads the authorized FFmpeg build into the Tauri sidecar folder.
# ClipCore never downloads FFmpeg at runtime: the binary is bundled by the
# installer, or the user is asked explicitly in Diagnostics.
$ErrorActionPreference = "Stop"

$target = "apps/desktop/src-tauri/binaries"
New-Item -ItemType Directory -Force -Path $target | Out-Null

if (-not $env:FFMPEG_URL) {
  Write-Host "FFMPEG_URL not set - skipping download. Place ffmpeg.exe in $target manually."
  exit 0
}

$zip = Join-Path $env:TEMP "ffmpeg.zip"
Invoke-WebRequest -Uri $env:FFMPEG_URL -OutFile $zip
Expand-Archive -Path $zip -DestinationPath (Join-Path $env:TEMP "ffmpeg") -Force
$exe = Get-ChildItem -Recurse (Join-Path $env:TEMP "ffmpeg") -Filter ffmpeg.exe | Select-Object -First 1

# Tauri sidecars are suffixed with the Rust target triple.
Copy-Item $exe.FullName (Join-Path $target "ffmpeg-x86_64-pc-windows-msvc.exe") -Force
(Get-FileHash (Join-Path $target "ffmpeg-x86_64-pc-windows-msvc.exe") -Algorithm SHA256).Hash |
  Set-Content (Join-Path $target "ffmpeg.sha256")
Write-Host "FFmpeg sidecar ready."
