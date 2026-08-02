# Build local no Windows — ClipCore

Estes requisitos valem **somente para desenvolvedores**. O usuário final apenas
executa o instalador: nada de Node, Bun, Rust, Python, Visual Studio ou FFmpeg é
exigido dele.

## 1. Requisitos

| Item                          | Versão / observação                                        |
| ----------------------------- | ---------------------------------------------------------- |
| Windows                       | 10 64-bit (build suportada) ou 11 64-bit                   |
| Bun                           | 1.1+ — `powershell -c "irm bun.sh/install.ps1 | iex"`      |
| Rust                          | stable MSVC — `rustup toolchain install stable-msvc`        |
| Visual Studio Build Tools     | 2022, workload "Desktop development with C++"              |
| Windows SDK                   | 10.0.22621 ou superior (Graphics.Capture, Media Foundation) |
| WebView2 Runtime              | já presente no Windows 11; o instalador embute o bootstrapper |
| PowerShell 7 (`pwsh`)         | para os scripts de sidecar e artefatos                     |

## 2. Dependências do projeto

```powershell
bun install --frozen-lockfile
```

## 3. Sidecars FFmpeg / FFprobe

Os binários **não** são versionados. Defina as variáveis e rode o script:

```powershell
$env:FFMPEG_URL   = "https://<build-lgpl-autorizada>/ffmpeg.zip"
$env:FFMPEG_SHA256 = "<64 hex>"
$env:FFPROBE_URL  = "https://<build-lgpl-autorizada>/ffprobe.zip"
$env:FFPROBE_SHA256 = "<64 hex>"
pwsh scripts/fetch-ffmpeg.ps1
```

Alternativa manual: copiar os executáveis para
`apps/desktop/src-tauri/binaries/ffmpeg-x86_64-pc-windows-msvc.exe` e
`...\ffprobe-x86_64-pc-windows-msvc.exe`. O script valida o checksum do arquivo
já presente.

Para um build local sem sidecar (a exportação falha de forma controlada):

```powershell
$env:CLIPCORE_ALLOW_MISSING_SIDECARS = "1"
```

## 4. Ícones

Os ícones atuais são **placeholders Nightforge**. Para gerar os definitivos a
partir de um PNG 1024×1024:

```powershell
bunx tauri icon path\to\clipcore-logo.png --output apps\desktop\src-tauri\icons
```

Arte do instalador: `apps/desktop/src-tauri/installer/header.bmp` (150×57) e
`sidebar.bmp` (164×314), ambos BMP 24-bit.

## 5. Desenvolvimento

```powershell
bun run desktop:dev      # Vite + Tauri com hot reload
bun run rust:check
bun run rust:clippy
bun run rust:test
```

## 6. Release local

```powershell
bun run check:versions   # versões sincronizadas
bun run lint
bun run typecheck
bun run test
bun run build
bun run desktop:build    # gera NSIS + MSI
pwsh scripts/rename-artifacts.ps1 -OutDir dist/release
```

Saída em `dist/release`:
`ClipCore-Setup-0.1.0-x64.exe`, `ClipCore-0.1.0-x64.msi`, `SHA256SUMS.txt`.

## 7. Assinatura (opcional, local)

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content $HOME\.tauri\clipcore.key -Raw
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "<senha>"
bun run desktop:build
```

Sem essas variáveis o bundle do updater é gerado **sem** assinatura e não deve
ser publicado. Ver `docs/UPDATER.md` e `docs/CODE_SIGNING.md`.

## 8. Troubleshooting

| Sintoma                                        | Causa provável / ação                                                    |
| ---------------------------------------------- | ------------------------------------------------------------------------ |
| `link.exe not found`                           | Build Tools sem workload C++.                                            |
| `failed to bundle project: externalBin`        | sidecar ausente — rode `scripts/fetch-ffmpeg.ps1`.                       |
| `Icon not found`                               | falta `icons/icon.ico` — gere com `bunx tauri icon`.                     |
| `headerImage` inválido                         | BMP precisa ser 24-bit, 150×57.                                          |
| NSIS falha em `currentUser`                    | remova instalação anterior por máquina antes de testar por usuário.      |
| WebView2 ausente em VM limpa                   | esperado: o bootstrapper embutido instala no primeiro run do instalador. |
| `cargo test` lento na primeira vez             | `rusqlite` com feature `bundled` compila o SQLite.                       |
| Erro de assinatura ao publicar                 | secrets não configurados — o updater permanece inativo por segurança.    |
