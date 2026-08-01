# ClipCore

**ClipCore é um aplicativo desktop para Windows** de captura retroativa de clipes
de jogos (buffer circular de 15s a 5min, gravação de sessão, editor não
destrutivo e biblioteca local).

A interface web publicada é **apenas uma prévia**: ela mostra o produto, mas não
captura vídeo. Fora do aplicativo desktop a interface exibe **“Modo demonstração”**
e usa dados simulados.

## Estado dos recursos

| Recurso | Estado |
| --- | --- |
| Interface (dashboard, biblioteca, configurações, diagnóstico) | Real |
| Backend Tauri 2 + Rust, comandos tipados, eventos | Real |
| SQLite local (migrations, repositórios, CRUD) | Real |
| Máquina de estados de captura + testes | Real |
| Buffer circular por segmentos + testes | Real (lógica) |
| Regras de atalhos globais (conflito, reservados, perfis) | Real (lógica) |
| Registro de atalhos no sistema operacional | Pendente |
| Captura de vídeo (WGC / DXGI / Media Foundation) | Estrutura + mock |
| Áudio (WASAPI loopback / microfone) | Estrutura + mock |
| Encoders NVENC / AMF / QuickSync | Enumeração + fallback software |
| FFmpeg sidecar (concat, thumbnail, export) | Preparado (binário não incluído) |
| Instalador Windows (NSIS/MSI) | Configurado |

Detalhes e próximos passos: [`docs/IMPLEMENTATION_PROGRESS.md`](docs/IMPLEMENTATION_PROGRESS.md).

## Estrutura

```text
apps/desktop/src-tauri   backend Rust (capture, system, database, media)
apps/web                 superfície web/preview
packages/*               ui, shared, types, config, database
src/                     interface React compartilhada
src/services/            ponte TypeScript -> comandos Tauri
docs/ scripts/ tests/ .github/workflows/
```

## Dependências de desenvolvimento

- [Bun](https://bun.sh) (ou Node 20+)
- [Rust estável](https://rustup.rs) + `cargo`
- Windows 10 1903+ com **Visual Studio Build Tools** (C++ desktop) e WebView2
- `bun install`

## Comandos

```bash
bun run dev             # prévia web
bun run desktop:dev     # aplicativo desktop (Tauri)
bun run test            # testes do frontend
bun run typecheck       # TypeScript
bun run rust:test       # testes Rust
bun run rust:clippy     # lint Rust
bun run desktop:build   # instalador Windows (NSIS + MSI)
```

O instalador gerado é único: o usuário final **não** precisa instalar Node, Rust,
Cargo, FFmpeg, Python, Visual Studio ou bibliotecas auxiliares.

## FFmpeg

Coloque o binário em
`apps/desktop/src-tauri/binaries/ffmpeg-x86_64-pc-windows-msvc.exe`
(ou defina a variável `FFMPEG_URL` e use `scripts/fetch-ffmpeg.ps1`).
O aplicativo nunca baixa FFmpeg silenciosamente em tempo de execução.
Licenciamento: [`docs/FFMPEG.md`](docs/FFMPEG.md).

## Limitações atuais

- A captura real de vídeo/áudio e os encoders de hardware ainda não estão
  implementados: os contratos e adaptadores existem atrás da feature
  `windows-capture` e retornam `not_implemented`.
- Compilação Tauri/Rust e geração do instalador acontecem no CI Windows
  (`.github/workflows/desktop.yml`), não no ambiente de preview.
- Releases de produção exigem assinatura de código e chaves do updater.
