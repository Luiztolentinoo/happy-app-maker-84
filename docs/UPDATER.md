# Updater do ClipCore

O updater oficial do Tauri é usado. **Ele permanece desativado
(`plugins.updater.active = false`) até que o par de chaves esteja configurado e
testado.** Nenhuma release não assinada é aceita.

## Estado atual

| Item                          | Estado                                            |
| ----------------------------- | ------------------------------------------------- |
| Plugin instalado              | sim (`tauri-plugin-updater`)                      |
| Endpoint HTTPS                | `https://updates.clipcore.dev/{{target}}/{{arch}}/{{current_version}}` |
| `pubkey`                      | placeholder `REPLACE_WITH_TAURI_UPDATER_PUBLIC_KEY` |
| `active`                      | `false`                                           |
| Diálogo nativo                | desativado — a UI de `/updates` conduz o fluxo    |
| Canais                        | development, alpha, beta, stable                  |
| Auto-update permitido em      | beta e stable (ver `channelAllowsAutoUpdate`)     |

## Geração e configuração das chaves

1. Gerar o par (uma vez, em máquina confiável):
   ```powershell
   bunx tauri signer generate -w $HOME\.tauri\clipcore.key
   ```
2. Copiar a **chave pública** para `plugins.updater.pubkey` em
   `apps/desktop/src-tauri/tauri.conf.json`.
3. Armazenar a **chave privada** em secrets do repositório:
   - `TAURI_SIGNING_PRIVATE_KEY` (conteúdo do arquivo `.key`)
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (senha usada na geração)
4. Nunca commitar a chave privada, nem colocá-la em `.env` versionado,
   documentação, artefatos ou frontend. Nunca imprimir em logs.
5. Assinar os artefatos: com os secrets presentes, `tauri build` gera `.sig`
   junto ao bundle do updater.
6. Publicar o manifesto:
   ```bash
   node scripts/generate-update-manifest.mjs \
     --dir apps/desktop/src-tauri/target/release/bundle/nsis \
     --base-url https://updates.clipcore.dev/windows-x86_64 \
     --channel beta --out latest.json
   ```
   O script **falha** se a assinatura estiver ausente.
7. Testar em canal beta com pelo menos duas máquinas.
8. Somente então ativar `plugins.updater.active = true` para o canal estável.

## Estrutura de canais

```
updates.clipcore.dev/
  stable/windows-x86_64/latest.json
  beta/windows-x86_64/latest.json
```

O canal é derivado da versão (`detectChannel` em `src/lib/distribution.ts`).
Builds alpha não consultam o endpoint: o app mostra "bloqueado por assinatura".

## Fluxo na interface (`/updates`)

`up_to_date → checking → available → downloading → ready_to_install →
installing`, com `failed`, `blocked_unsigned` e `unavailable_in_browser`.

- Download em segundo plano com progresso.
- "Adiar 24h" grava o prazo localmente.
- "Instalar e reiniciar" só habilita após assinatura verificada.
- Na prévia do navegador o estado é sempre `unavailable_in_browser`.

## Banco e configurações na atualização

- A versão do schema é lida do banco; migrations rodam em ordem crescente.
- Backup leve do arquivo `.db` antes de migrations destrutivas.
- Downgrade incompatível é bloqueado (`allowDowngrades: false` no bundle).
- Configurações são versionadas: campos válidos são preservados, ausentes
  recebem default. Nunca há sobrescrita completa.

## Rollback — limitação honesta

O NSIS em modo `currentUser` substitui a instalação após o download validado.
Hoje existe:

- staging em `%LOCALAPPDATA%\com.clipcore.desktop\updates`;
- validação de assinatura antes de qualquer troca;
- detecção de atualização incompleta na inicialização, com orientação de reparo.

**Não** existe rollback automático para a versão anterior: o usuário reinstala a
build anterior a partir da página de download. Isso será revisto quando o
updater suportar instalação lado a lado.
