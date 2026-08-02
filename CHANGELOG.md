# Changelog — ClipCore

Formato baseado em Keep a Changelog. Versionamento semântico.
Funções ainda simuladas nunca são listadas como concluídas.

## [0.1.0] — 2026-08-02 (canal Alpha)

### Added

- Distribuição Windows: bundle NSIS (instalação por usuário, sem administrador)
  e MSI corporativo (por máquina), com nomes versionados
  `ClipCore-Setup-0.1.0-x64.exe` e `ClipCore-0.1.0-x64.msi`.
- Identidade centralizada em `src/lib/distribution.ts`: nome, identificador
  `com.clipcore.desktop`, publisher, versão, canal, URLs, requisitos e caminhos.
- Sidecars FFmpeg e FFprobe empacotados pelo instalador, com nome fixo,
  argumentos permitidos, timeout e checksum SHA-256 validado na build.
- `scripts/fetch-ffmpeg.ps1` reescrito: verificação, download apenas por HTTPS
  autorizado, falha explícita em checksum divergente, sem commit de binários.
- `scripts/check-versions.mjs`, `scripts/rename-artifacts.ps1` e
  `scripts/generate-update-manifest.mjs`.
- Página de atualização Nightforge em `/updates` com canal, versão, notas,
  progresso, adiar, instalar e reiniciar.
- Verificações de instalação e ações de reparo no Centro de Diagnóstico.
- Bandeja do sistema com estados (inativo, buffer, gravando, salvando, aviso,
  erro) e ações rápidas; fechar a janela minimiza para a bandeja.
- Inicialização com o Windows configurável, desativada por padrão.
- Ícones e arte do instalador em todos os formatos exigidos (placeholders
  Nightforge identificados como provisórios).
- Documentação: `docs/WINDOWS_BUILD.md`, `docs/WINDOWS_INSTALLER_TEST_PLAN.md`,
  `docs/RELEASE_CHECKLIST.md`, `docs/UPDATER.md`, `docs/CODE_SIGNING.md`,
  `docs/DISTRIBUTION.md`, `LICENSES.md`.
- Workflow de release manual (`workflow_dispatch` + tags `v*`) com testes,
  instaladores, checksums, SBOM e draft release.

### Changed

- `tauri.conf.json`: identificador estável, publisher, copyright, homepage,
  CSP com `connect-src` restrito ao endpoint de atualização, updater sem diálogo
  nativo e `allowDowngrades: false`.
- Capabilities revisadas pelo princípio de menor privilégio (FS restrito às
  pastas de dados, sidecars nomeados, notificações e updater).

### Fixed

- Dados mutáveis (banco, cache, logs, clipes) deixam de depender do diretório
  de instalação; caminhos separados por tipo.

### Security

- Nenhuma atualização não assinada é aceita: o updater permanece inativo até que
  as chaves estejam configuradas.
- Secrets (`TAURI_SIGNING_PRIVATE_KEY`, `WINDOWS_CERTIFICATE`) nunca ficam no
  repositório nem em logs.
- Sidecars executam apenas argumentos declarados; nenhum caminho de executável
  vem do frontend.

### Known limitations

- Captura de quadros, encoders de hardware e áudio WASAPI seguem simulados: esta
  build **não** grava gameplay real.
- Instalador, MSI, bandeja, autostart e updater ainda não foram executados em
  Windows real (ambiente de build é Linux sem toolchain Rust/Windows SDK).
- Aplicativo e instaladores não estão assinados: o SmartScreen exibirá aviso.
- Rollback automático depende do modo de instalação do NSIS; hoje há apenas
  staging temporário e detecção de atualização incompleta.
