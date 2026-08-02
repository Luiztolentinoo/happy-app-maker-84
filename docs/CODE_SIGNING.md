# Assinatura de código Windows — ClipCore

**Estado atual: o ClipCore NÃO está assinado.** Nenhum certificado está
configurado. Toda a infraestrutura abaixo está preparada e é ativada apenas
quando os secrets existirem — nada é desativado para "contornar" avisos.

## Tipos de certificado

| Tipo | Reputação SmartScreen                  | Armazenamento           | Custo/atrito |
| ---- | -------------------------------------- | ----------------------- | ------------ |
| OV   | construída ao longo do tempo/downloads | HSM/token (desde 2023)  | menor        |
| EV   | reputação imediata na maioria dos casos| token de hardware/HSM   | maior        |

Desde junho de 2023 a Microsoft exige que a chave privada de certificados de
assinatura de código fique em HSM/token certificado FIPS. Provedores oferecem
assinatura em nuvem (Azure Trusted Signing, DigiCert KeyLocker,
SSL.com eSigner) — é a via prática para CI.

## Aquisição

1. Comprar de uma CA reconhecida (DigiCert, Sectigo, SSL.com) ou usar Azure
   Trusted Signing.
2. Validar a organização (documentos, telefone verificável, endereço).
3. Receber acesso ao HSM em nuvem ou o token físico.
4. Registrar o publisher exatamente como em `bundle.publisher` (`ClipCore`).

## Secrets esperados no CI

| Secret                          | Conteúdo                                          |
| ------------------------------- | ------------------------------------------------- |
| `WINDOWS_CERTIFICATE`           | PFX em base64 **ou** credenciais do assinador em nuvem |
| `WINDOWS_CERTIFICATE_PASSWORD`  | senha do PFX                                      |
| `WINDOWS_TIMESTAMP_URL`         | ex.: `http://timestamp.digicert.com`              |

O workflow de release detecta a presença dos secrets. Sem eles, o build continua
e os artefatos são marcados como **não assinados**.

## O que assinar

- `ClipCore.exe` (executável principal)
- `ClipCore-Setup-<versão>-x64.exe` (NSIS)
- `ClipCore-<versão>-x64.msi`
- bundle do updater (`.exe` + `.sig` do Tauri, que é assinatura de update, não de código)
- sidecars próprios, quando existirem (FFmpeg é assinado pelo fornecedor da build)

Sempre com **timestamp**: sem ele a assinatura expira com o certificado.

## Renovação e rotação

- Renovar com 30 dias de antecedência.
- Manter o antigo certificado válido até a última release assinada com ele ser
  substituída.
- Rotacionar secrets do CI no mesmo dia da troca.
- Registrar data de expiração no checklist de release.

## SmartScreen e antivírus

Meios legítimos usados pelo ClipCore para reduzir falsos positivos:

- assinatura digital com publisher consistente;
- sem empacotadores, sem ofuscação;
- sem download oculto e sem execução arbitrária;
- sem drivers, sem injeção em jogos, sem keylogger, sem persistência oculta;
- sem alteração de configurações de segurança do Windows;
- builds reproduzíveis na medida do possível (lockfiles, versões fixadas).

Mesmo com certificado OV a reputação do SmartScreen leva tempo e volume de
downloads para se estabelecer. Isso é esperado e deve ser comunicado na página de
download. **Não** documentamos formas de burlar antivírus ou SmartScreen.
