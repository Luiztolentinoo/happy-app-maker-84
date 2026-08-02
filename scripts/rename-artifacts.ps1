# Renomeia os artefatos gerados pelo Tauri para nomes publicos versionados
# e grava SHA256SUMS.txt. Executado pelo workflow de release.
#
#   pwsh scripts/rename-artifacts.ps1 -OutDir dist/release

param(
  [string]$OutDir = "dist/release"
)

$ErrorActionPreference = "Stop"

$conf = Get-Content "apps/desktop/src-tauri/tauri.conf.json" -Raw | ConvertFrom-Json
$version = $conf.version
$arch = "x64"
$bundle = "apps/desktop/src-tauri/target/release/bundle"

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$map = @(
  @{ Source = "$bundle/nsis"; Filter = "*-setup.exe"; Name = "ClipCore-Setup-$version-$arch.exe" },
  @{ Source = "$bundle/msi";  Filter = "*.msi";       Name = "ClipCore-$version-$arch.msi" }
)

foreach ($item in $map) {
  if (-not (Test-Path $item.Source)) {
    Write-Warning "Diretorio ausente: $($item.Source)"
    continue
  }
  $file = Get-ChildItem $item.Source -Filter $item.Filter | Select-Object -First 1
  if (-not $file) {
    Write-Warning "Nenhum artefato $($item.Filter) em $($item.Source)"
    continue
  }
  Copy-Item $file.FullName (Join-Path $OutDir $item.Name) -Force
  # Assinaturas do updater acompanham o instalador NSIS.
  Get-ChildItem $item.Source -Filter "*.sig" -ErrorAction SilentlyContinue |
    ForEach-Object { Copy-Item $_.FullName (Join-Path $OutDir ($item.Name + ".sig")) -Force }
}

# Sidecars tambem recebem checksum publicado.
Get-ChildItem "apps/desktop/src-tauri/binaries" -Filter "*.exe" -ErrorAction SilentlyContinue |
  ForEach-Object { Copy-Item $_.FullName (Join-Path $OutDir $_.Name) -Force -WhatIf } | Out-Null

Get-ChildItem $OutDir -File |
  Where-Object { $_.Name -ne "SHA256SUMS.txt" } |
  ForEach-Object { (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant() + "  " + $_.Name } |
  Set-Content (Join-Path $OutDir "SHA256SUMS.txt")

Get-ChildItem $OutDir | Format-Table Name, Length
Write-Host "Artefatos versionados em $OutDir."
