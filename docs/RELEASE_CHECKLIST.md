# Release checklist — ClipCore

Marque tudo antes de publicar. Qualquer item aberto bloqueia o release.

## Versão e código

- [ ] `APP_VERSION` atualizado em `src/lib/distribution.ts`.
- [ ] `bun run check:versions` passa (package.json, apps/desktop/package.json,
      Cargo.toml, tauri.conf.json, CHANGELOG.md).
- [ ] `CHANGELOG.md` com Added/Changed/Fixed/Security/Known limitations.
- [ ] Nenhuma função simulada declarada como concluída.
- [ ] Canal correto (`APP_CHANNEL`), rótulo Alpha/Beta visível na interface.

## Qualidade

- [ ] `bun run lint`
- [ ] `bun run typecheck`
- [ ] `bun run test`
- [ ] `bun run build`
- [ ] `cargo fmt --check`
- [ ] `cargo clippy -- -D warnings`
- [ ] `cargo test`
- [ ] `bun run desktop:build` em Windows CI

## Funcional

- [ ] Captura real validada em Windows (bloqueia Stable).
- [ ] Editor: cortes, velocidade, textos, exportação.
- [ ] Banco: migrations sequenciais e backup leve.
- [ ] Hotkeys registradas e sem conflito.
- [ ] Bandeja e autostart.
- [ ] Onboarding completo.
- [ ] Diagnóstico e reparo.

## Distribuição

- [ ] `scripts/fetch-ffmpeg.ps1` executado com checksums preenchidos.
- [ ] FFmpeg e FFprobe validados (build LGPL).
- [ ] Instalador NSIS validado (`docs/WINDOWS_INSTALLER_TEST_PLAN.md`).
- [ ] MSI validado.
- [ ] Desinstalação validada nos três modos de retenção de dados.
- [ ] Atualização sobre a versão anterior validada.
- [ ] Rollback / atualização interrompida validada.
- [ ] Ícones definitivos (não placeholders).
- [ ] Arte do instalador definitiva.
- [ ] Licenças revisadas (`LICENSES.md`, `licenses/*`).
- [ ] SBOM gerado.
- [ ] SHA-256 de instalador, MSI, executável e sidecars publicados.

## Segurança

- [ ] Artefatos assinados (código) — ou release marcado explicitamente como não assinado.
- [ ] Updater assinado; manifesto publicado só após aprovação.
- [ ] Secrets ausentes do repositório e dos logs.
- [ ] Comportamento no SmartScreen registrado.
- [ ] Varredura de antivírus sem falso positivo bloqueante.
- [ ] `bun audit` / `cargo audit` revisados.

## Publicação

- [ ] Draft release revisado manualmente.
- [ ] Release notes escritas.
- [ ] Página de download atualizada (versão, tamanho, checksum, requisitos, aviso de canal).
- [ ] Privacidade e termos acessíveis.
- [ ] Plano de suporte e rollback comunicado.
- [ ] Manifesto do updater publicado **por último**.
