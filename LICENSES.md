# Licenças e avisos de terceiros

O ClipCore é distribuído com componentes de terceiros. Os textos completos são
instalados junto ao aplicativo em `licenses/` e acessíveis em
**Configurações › Licenças e avisos de terceiros**.

| Componente               | Licença                  | Uso no ClipCore                        |
| ------------------------ | ------------------------ | -------------------------------------- |
| FFmpeg / FFprobe         | LGPL-2.1-or-later        | concat, thumbnails, exportação         |
| Tauri 2                  | MIT / Apache-2.0         | shell desktop, instalador, updater     |
| SQLite (via rusqlite)    | Domínio público / MIT    | banco local                            |
| React 19                 | MIT                      | interface                              |
| TanStack Router/Query    | MIT                      | rotas e dados                          |
| Radix UI                 | MIT                      | primitivas acessíveis                  |
| Tailwind CSS 4           | MIT                      | estilos                                |
| lucide-react             | ISC                      | ícones                                 |
| recharts                 | MIT                      | gráficos de desempenho                 |
| zod                      | MIT                      | validação de esquemas do editor        |
| Sora, Inter Tight        | SIL OFL 1.1              | tipografia Nightforge                  |
| windows-rs               | MIT / Apache-2.0         | APIs de captura no Windows             |

## Obrigações cumpridas

- **FFmpeg**: build LGPL, redistribuído sem modificação, aviso de licença
  incluído, ponteiro para o código-fonte. Builds GPL não são distribuídas.
- **Fontes**: OFL exige apenas aviso de copyright — incluído.
- **MIT / Apache-2.0 / ISC**: avisos de copyright preservados em
  `apps/desktop/src-tauri/licenses/THIRD-PARTY.txt`.

## SBOM

O workflow de release gera um SBOM (dependências JavaScript, crates Rust,
sidecars, versões e licenças) publicado como artefato. Ver
`docs/RELEASE_CHECKLIST.md`.
