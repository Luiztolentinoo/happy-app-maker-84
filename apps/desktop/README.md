# ClipCore desktop app

The React UI is shared with the web preview and lives at the repository root
(`/src`), which is also the Vite root Tauri points to (`frontendDist: ../../../dist/client`).
Keeping a single UI tree avoids duplicating the approved dashboard, library,
settings and diagnostics screens.

- `src-tauri/` — Rust backend, capabilities, bundle config, FFmpeg sidecar.
- `src/` — desktop-only React entry points (window chrome, tray menus) when needed.
- `public/` — desktop-only static assets.

Run from the repository root:

```bash
bun run desktop:dev     # Tauri dev shell (Windows for real capture)
bun run desktop:build   # NSIS + MSI installer
bun run rust:test       # Rust unit tests
```
