# Distribuição do ClipCore para Windows

Documento único sobre como o ClipCore chega ao usuário final.

## Experiência esperada

1. O usuário acessa a página oficial de download.
2. Baixa **um** arquivo: `ClipCore-Setup-<versão>-x64.exe`.
3. Executa o instalador (sem administrador).
4. Tudo é instalado: interface, backend, banco, migrations, FFmpeg, FFprobe,
   recursos visuais, traduções, licenças, desinstalador, atualizador e módulo de
   diagnóstico.
5. Abre o ClipCore.
6. Conclui o onboarding, que valida a instalação.
7. Começa a usar.

O usuário final **nunca** precisa de Node, Bun, npm, Rust, Cargo, Python, Visual
Studio, FFmpeg, bibliotecas de captura/áudio, terminal ou qualquer comando.

## Plataformas

| Plataforma     | Estado                                                        |
| -------------- | ------------------------------------------------------------- |
| Windows 11 x64 | suportada (pendente validação real — ver test plan)           |
| Windows 10 x64 | suportada em builds ainda com suporte da Microsoft            |
| Windows ARM64  | **não** suportado: arquitetura preparada, sem build nem teste |
| Windows 7 / 8  | não suportado                                                 |

## Formatos

| Formato | Arquivo                        | Público                | Modo          |
| ------- | ------------------------------ | ---------------------- | ------------- |
| NSIS    | `ClipCore-Setup-0.1.0-x64.exe` | usuário final (padrão) | `currentUser` |
| MSI     | `ClipCore-0.1.0-x64.msi`       | TI / corporativo       | por máquina   |

O instalador divulgado é o NSIS. O Tauri gera nomes internos
(`ClipCore_0.1.0_x64-setup.exe`); `scripts/rename-artifacts.ps1` produz os nomes
públicos versionados e o `SHA256SUMS.txt`.

## Identidade

Centralizada em `src/lib/distribution.ts` e refletida em `tauri.conf.json`:

- Product name: `ClipCore`
- Identifier: `com.clipcore.desktop` (estável — não alterar sem plano de migração)
- Publisher / Copyright: `ClipCore`
- Homepage / suporte / privacidade / termos: `clipcore.dev`
- Executável: `ClipCore.exe`
- Pasta do Menu Iniciar: `ClipCore`
- Desinstalador: "ClipCore"

## Caminhos

| Conteúdo          | Caminho                                              |
| ----------------- | ---------------------------------------------------- |
| App (por usuário) | `%LOCALAPPDATA%\Programs\ClipCore`                   |
| App (por máquina) | `%PROGRAMFILES%\ClipCore` (MSI)                      |
| Configurações     | `%APPDATA%\com.clipcore.desktop`                     |
| Banco             | `%APPDATA%\com.clipcore.desktop\clipcore.db`         |
| Cache             | `%LOCALAPPDATA%\com.clipcore.desktop\cache`          |
| Logs              | `%LOCALAPPDATA%\com.clipcore.desktop\logs`           |
| Atualizações      | `%LOCALAPPDATA%\com.clipcore.desktop\updates`        |
| Clipes            | `%USERPROFILE%\Videos\ClipCore` (ou pasta escolhida) |

Nada mutável dentro da pasta de instalação. Nenhum clipe dentro dela.

## Por usuário vs por máquina

Preferência: **por usuário**. Sem UAC, dentro do perfil, menor atrito e menor
risco de permissão. Administrador nunca é exigido para executar, salvar, editar,
exportar, configurar atalhos ou atualizar. O MSI por máquina existe apenas para
implantação corporativa e é documentado separadamente.

## Opções do instalador

Oferecidas: atalho na área de trabalho, atalho no Menu Iniciar, iniciar após a
instalação, iniciar com o Windows (desmarcado por padrão), pasta de instalação e
pasta inicial dos clipes.

Nunca: serviços, extensões de navegador, exclusões no Defender, alterações de
antivírus, desativação de proteções.

## Sidecars

| Sidecar | Arquivo empacotado                   | Obrigatório | Licença           |
| ------- | ------------------------------------ | ----------- | ----------------- |
| ffmpeg  | `ffmpeg-x86_64-pc-windows-msvc.exe`  | sim         | LGPL-2.1-or-later |
| ffprobe | `ffprobe-x86_64-pc-windows-msvc.exe` | sim         | LGPL-2.1-or-later |

Regras aplicadas (ver `SIDECARS` em `src/lib/distribution.ts` e
`media/ffmpeg.rs`): nome fixo, caminho resolvido apenas ao lado do executável
instalado, arquitetura correta, checksum SHA-256, lista de argumentos permitidos,
timeout, encerramento seguro, logs filtrados, licença documentada. Nenhum caminho
de executável vem do frontend; nenhum shell genérico é usado.

## Desinstalação

O desinstalador remove app, sidecars, atalhos, Menu Iniciar, entrada de
inicialização, temporários internos e componentes do atualizador. Antes de tocar
em dados pessoais, pergunta:

> Deseja manter seus clipes, projetos e configurações?

Opções: manter tudo · remover configurações mantendo vídeos · remover todos os
dados do ClipCore. Somente diretórios marcados com `.clipcore-owned` podem ser
removidos. Vídeos nunca são apagados silenciosamente.

## Dev vs produção

| Aspecto    | Development                   | Production                         |
| ---------- | ----------------------------- | ---------------------------------- |
| Mocks      | permitidos                    | proibidos em funções centrais      |
| Logs       | detalhados                    | reduzidos                          |
| Assinatura | ausente                       | obrigatória                        |
| Updater    | desativado                    | ativo e assinado                   |
| Sidecars   | podem faltar (flag explícita) | validados por checksum             |
| CSP        | permissiva no dev server      | restrita                           |
| Telemetria | desligada                     | apenas com consentimento           |
| Indicação  | banner de desenvolvimento     | rótulo de canal quando não estável |

Um build de produção nunca usa dados simulados sem indicação visível: a interface
mostra "Modo demonstração" no navegador e o rótulo do canal (ex.: `ClipCore Alpha`)
quando aplicável.

## Página oficial de download (contrato)

O tipo `DownloadOffer` em `src/lib/distribution.ts` define exatamente o que a
página precisa exibir: produto, versão, canal, plataforma, arquitetura,
instalador recomendado, SHA-256, tamanho, requisitos, aviso de canal, changelog,
privacidade e termos. A página em si ainda não faz parte deste repositório.

## Supply chain

- `bun.lock` versionado, `bunfig.toml` com `minimumReleaseAge` de 24h.
- Versões fixadas para actions do GitHub.
- Sidecars somente com checksum.
- `bun audit` e `cargo audit` no workflow de release.
- Releases publicadas manualmente a partir de draft revisado.
- Branch protection recomendada em `main`: PR obrigatório, checks obrigatórios
  (lint, typecheck, test, build, cargo), sem push forçado.
