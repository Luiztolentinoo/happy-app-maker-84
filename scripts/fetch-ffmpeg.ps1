# Downloads e valida os sidecars autorizados (FFmpeg e FFprobe) para o bundle.
#
# Regras:
# - O ClipCore nunca baixa binarios em runtime: o instalador os empacota.
# - Nenhum executavel e aceito sem checksum SHA-256 conferido.
# - Os binarios NAO sao commitados no repositorio.
#
# Variaveis de ambiente:
#   FFMPEG_URL / FFMPEG_SHA256
#   FFPROBE_URL / FFPROBE_SHA256
#   CLIPCORE_ALLOW_MISSING_SIDECARS = 1  -> apenas builds locais de desenvolvimento
#
# Uso local documentado em docs/WINDOWS_BUILD.md.

$ErrorActionPreference = "Stop"

$target = "apps/desktop/src-tauri/binaries"
$triple = "x86_64-pc-windows-msvc"
New-Item -ItemType Directory -Force -Path $target | Out-Null

$sidecars = @(
  @{ Name = "ffmpeg";  Url = $env:FFMPEG_URL;  Sha = $env:FFMPEG_SHA256 },
  @{ Name = "ffprobe"; Url = $env:FFPROBE_URL; Sha = $env:FFPROBE_SHA256 }
)

function Get-Sha256([string]$path) {
  return (Get-FileHash $path -Algorithm SHA256).Hash.ToLowerInvariant()
}

foreach ($s in $sidecars) {
  $dest = Join-Path $target ("{0}-{1}.exe" -f $s.Name, $triple)
  $expected = if ($s.Sha) { $s.Sha.Trim().ToLowerInvariant() } else { $null }

  # 1. Binario ja presente: valida e segue.
  if (Test-Path $dest) {
    $actual = Get-Sha256 $dest
    if ($expected -and $actual -ne $expected) {
      throw "$($s.Name): checksum divergente. esperado=$expected atual=$actual"
    }
    if (-not $expected) {
      Write-Host "$($s.Name): presente, checksum esperado nao informado (build local)."
    } else {
      Write-Host "$($s.Name): presente e validado."
    }
    $actual | Set-Content (Join-Path $target ("{0}.sha256" -f $s.Name))
    continue
  }

  # 2. Sem binario e sem URL confiavel configurada.
  if (-not $s.Url) {
    if ($env:CLIPCORE_ALLOW_MISSING_SIDECARS -eq "1") {
      Write-Warning "$($s.Name): ausente e sem $($s.Name.ToUpper())_URL. Build local sem sidecar."
      continue
    }
    throw "$($s.Name): ausente. Configure $($s.Name.ToUpper())_URL e $($s.Name.ToUpper())_SHA256."
  }

  if (-not $s.Url.StartsWith("https://")) {
    throw "$($s.Name): a URL de download precisa usar HTTPS."
  }
  if (-not $expected) {
    throw "$($s.Name): download bloqueado sem $($s.Name.ToUpper())_SHA256. Checksum vazio nao e aceito."
  }

  # 3. Download autorizado.
  $tmp = Join-Path $env:TEMP ("clipcore-{0}" -f $s.Name)
  New-Item -ItemType Directory -Force -Path $tmp | Out-Null
  $archive = Join-Path $tmp "package"
  Invoke-WebRequest -Uri $s.Url -OutFile $archive -MaximumRedirection 3

  $exe = $null
  if ($s.Url -match "\.zip($|\?)") {
    $extract = Join-Path $tmp "extract"
    Expand-Archive -Path $archive -DestinationPath $extract -Force
    $exe = Get-ChildItem -Recurse $extract -Filter ("{0}.exe" -f $s.Name) | Select-Object -First 1
    if (-not $exe) { throw "$($s.Name): executavel nao encontrado no pacote." }
    Copy-Item $exe.FullName $dest -Force
  } else {
    Copy-Item $archive $dest -Force
  }

  $actual = Get-Sha256 $dest
  if ($actual -ne $expected) {
    Remove-Item $dest -Force
    throw "$($s.Name): checksum divergente apos download. esperado=$expected atual=$actual"
  }
  $actual | Set-Content (Join-Path $target ("{0}.sha256" -f $s.Name))
  Write-Host "$($s.Name): baixado e validado."
}

Write-Host "Sidecars prontos em $target."
