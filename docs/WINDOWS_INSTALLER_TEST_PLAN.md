# Plano de teste do instalador Windows — ClipCore

Estado atual: **nenhum item foi executado em Windows real**. O ambiente de build
do projeto é Linux, sem toolchain Rust/MSVC nem Windows SDK. Este plano define o
que precisa ser validado antes de qualquer promoção para Beta/Stable.

Legenda: `[ ]` pendente · `[x]` validado · `[!]` falhou

## 1. Ambientes

| ID   | Sistema                      | Perfil                        |
| ---- | ---------------------------- | ----------------------------- |
| E1   | Windows 11 24H2 x64          | usuário padrão (sem admin)    |
| E2   | Windows 10 22H2 x64          | usuário padrão                |
| E3   | Windows 11 x64               | administrador (MSI)           |
| E4   | Windows 11 x64, VM limpa     | sem WebView2                  |
| E5   | Windows 11 x64               | usuário `Índio Ç Ünïcode`     |
| E6   | Windows 11 x64               | disco com < 1 GB livre        |

## 2. Instalação limpa (NSIS)

- [ ] Instalador roda sem prompt de administrador (E1, E2).
- [ ] Instala em `%LOCALAPPDATA%\Programs\ClipCore`.
- [ ] Atalhos: Menu Iniciar (pasta `ClipCore`) e Área de Trabalho quando marcado.
- [ ] "Iniciar ClipCore após instalação" funciona.
- [ ] "Iniciar com o Windows" **desmarcado** por padrão.
- [ ] Escolha da pasta de clipes é gravada nas configurações.
- [ ] `ffmpeg-*.exe` e `ffprobe-*.exe` presentes na instalação.
- [ ] Banco criado em `%APPDATA%\com.clipcore.desktop\clipcore.db` com migrations.
- [ ] Nenhum arquivo mutável criado dentro da pasta de instalação.
- [ ] Nenhuma exclusão de antivírus, serviço ou driver instalado.

## 3. Instalação MSI (corporativa)

- [ ] `msiexec /i ClipCore-0.1.0-x64.msi /qn` instala por máquina (E3).
- [ ] Instala em `%PROGRAMFILES%\ClipCore`.
- [ ] `msiexec /x` remove por completo os arquivos de instalação.
- [ ] Dados de usuário preservados após remoção silenciosa.

## 4. WebView2

- [ ] Em VM sem WebView2 (E4) o bootstrapper embutido instala o runtime.
- [ ] Sem rede: instalador informa o problema com clareza e não corrompe nada.

## 5. Primeira execução / onboarding

- [ ] Onboarding abre automaticamente.
- [ ] Verifica integridade, FFmpeg, FFprobe, versão, Windows, GPU, encoder,
      áudio, pasta de clipes, escrita, espaço, banco, migrations, hotkeys,
      permissões e updater.
- [ ] Componente ausente → mensagem clara + ação de reparo (nunca "procure o arquivo").
- [ ] Relatório de suporte gerado sem dados sensíveis.

## 6. Caminhos e Unicode

- [ ] Caminho com espaços (`C:\Program Files\...`) funciona.
- [ ] Usuário Unicode (E5): banco, logs, clipes e exportação funcionam.
- [ ] Pasta de clipes em outro volume funciona.

## 7. Bandeja e janela

- [ ] Estados: inativo, buffer ativo, gravando, salvando, aviso, erro.
- [ ] Ações: abrir, salvar clipe, iniciar/parar, mic, biblioteca, configurações,
      diagnóstico, sair.
- [ ] Fechar a janela minimiza para a bandeja quando configurado.
- [ ] "Sair" encerra captura, buffer, filas, exports, sidecars, banco, listeners
      e threads — nenhum `ffmpeg.exe` órfão no Gerenciador de Tarefas.

## 8. Inicialização com o Windows

- [ ] Ativar cria uma única entrada.
- [ ] Desativar remove a entrada.
- [ ] Reinício abre minimizado na bandeja, sem janela principal.
- [ ] Desinstalar remove a entrada de inicialização.

## 9. Atualização

- [ ] Instalar 0.1.0 → atualizar para 0.1.1: dados, clipes e projetos preservados.
- [ ] Migrations sequenciais aplicadas na ordem.
- [ ] Configurações antigas migradas; campos novos recebem default.
- [ ] Manifesto sem assinatura válida é **rejeitado**.
- [ ] Sem internet: falha silenciosa e informativa, app continua utilizável.
- [ ] Download interrompido: staging temporário limpo, instalação atual intacta.
- [ ] Arquivo corrompido: assinatura reprova, nenhuma troca de arquivos.
- [ ] Adiar 24h respeita o prazo.

## 10. Reparo

- [ ] Remover `ffmpeg.exe` → diagnóstico detecta → reparo restaura.
- [ ] Banco corrompido → validação detecta → reparo recria índices sem perder clipes.
- [ ] Atalhos removidos → reparo recria.
- [ ] Cache corrompido → limpeza pede confirmação.

## 11. Desinstalação

- [ ] Pergunta "Deseja manter seus clipes, projetos e configurações?".
- [ ] Manter tudo: vídeos e banco intactos.
- [ ] Remover configurações mantendo vídeos: banco/config removidos, `Vídeos\ClipCore` intacto.
- [ ] Remover todos os dados: apenas diretórios marcados como `.clipcore-owned`.
- [ ] Pastas externas escolhidas pelo usuário nunca são apagadas.
- [ ] Entrada em Aplicativos Instalados removida.

## 12. Espaço e erros

- [ ] Disco cheio (E6): aviso claro, buffer para com segurança, sem corromper clipes.
- [ ] Upgrade interrompido (kill no meio): app continua abrindo na versão anterior.

## 13. Segurança

- [ ] Instalador não baixa nada em runtime.
- [ ] Sidecars validados por SHA-256.
- [ ] Nenhum shell genérico é invocado.
- [ ] SmartScreen: registrar o comportamento antes e depois da assinatura.

## 14. Automação disponível hoje

`bun run test` cobre, sem Windows: sincronização de versões, nomes de
instaladores, especificação e argumentos permitidos de sidecars, validação de
checksum, caminhos de dados, detecção de canal, regras do updater e geração do
manifesto (`tests/distribution.test.ts`).
