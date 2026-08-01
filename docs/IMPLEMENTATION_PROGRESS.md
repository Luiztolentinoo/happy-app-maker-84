# ClipCore — Implementation progress

Last updated: 2026-08-01

## Current state

The approved React interface (dashboard, library, settings, diagnostics, design
system, routes, hooks, components) is untouched and still runs in the browser
preview. On top of it, the real desktop layer now exists: a Tauri 2 + Rust
backend with SQLite, typed commands, a guarded capture state machine, a segment
circular buffer, hotkey rules, FFmpeg sidecar plumbing, Windows installer config
and CI workflows.

## What is real

- Tauri 2 project: `apps/desktop/src-tauri` with `Cargo.toml`, `build.rs`,
  `tauri.conf.json`, minimal capabilities, tray, updater slot, NSIS + MSI bundle.
- Rust modules: `main.rs`, `lib.rs`, `state.rs`, `errors.rs`, `commands.rs`,
  `events.rs`, plus `capture/`, `system/`, `database/`, `media/`.
- 24 typed Tauri commands, all returning `Result<T, ClipCoreError>` with
  structured `{ code, message }` errors. No generic shell commands.
- Capture state machine with all 9 states, guarded transitions and unit tests.
- Circular buffer over encoded segments: eviction by time and bytes, pinning
  during save, capture continues while writing, disk-full detection, unit tests.
- Clip writer: concat via stream copy into a `.part` file, validation, atomic
  rename, segment release on success and on failure.
- Crash recovery scanner for `.part`/`.tmp` leftovers.
- SQLite: versioned migrations for settings, games, per-game profiles, hotkeys,
  clips, edit projects, exports, job queue, diagnostics, recovery files.
  Repositories with CRUD + soft delete/restore and tests.
- Hotkeys: F8/F9/F10/F7/Ctrl+M/Shift+F8 defaults, conflict detection, reserved
  combos, enable/disable, restore defaults, persistence, tests. Only enabled
  bindings are ever registered.
- FFmpeg sidecar: install-dir-only path resolution, checksum, argv execution,
  concat, thumbnails, exports, diagnostics, missing-binary handling.
- TypeScript bridge: `nativeClient`, `captureService`, `storageService`,
  `hotkeyService`, `diagnosticService`, `clipRepository`. Runtime detection
  replaced the fixed `DEMO_MODE` constant; mocks run only in the browser.
- CI: lint, typecheck, frontend tests, web build, cargo fmt/clippy/test, Windows
  installer build, checksums, artifact upload.

## What is still simulated / blocked

- Real frame acquisition (Windows.Graphics.Capture, DXGI Desktop Duplication,
  Media Foundation) exists as trait + adapters behind the `windows-capture`
  feature flag. The adapters return `not_implemented`; the mock backend is used
  otherwise. Capture is NOT functional yet.
- Hardware encoders (NVENC / AMF / QuickSync) are enumerated and prioritized;
  only the software fallback is reported available. No real encode yet.
- WASAPI loopback and microphone capture are contracts + mock backend.
- Free disk space uses a placeholder until the `GetDiskFreeSpaceEx` adapter lands.
- Global shortcut plugin is wired into the app, but OS registration of the
  validated bindings still needs the `HotkeyRegistrar` Windows implementation.
- Browser preview keeps using `localStorage` hooks (by design); the desktop app
  uses SQLite.

## Blockers (environment)

The Lovable build environment is Linux without a Rust toolchain, Windows SDK or
code-signing keys, so `cargo test`, `cargo clippy` and `tauri build` cannot run
here. They run in `.github/workflows/desktop.yml` on `windows-latest`.

## Pending human actions

1. Add real icons to `apps/desktop/src-tauri/icons` (`bunx tauri icon logo.png`).
2. Provide an LGPL FFmpeg build (or set the `FFMPEG_URL` repo variable) — see `docs/FFMPEG.md`.
3. Generate updater keys (`bunx tauri signer generate`) and set `pubkey` +
   `TAURI_SIGNING_PRIVATE_KEY`; keep `updater.active: false` until then.
4. Add a Windows code-signing certificate before publishing a production release.

## Tests / builds executed

- `bun run test` — frontend hotkey + runtime detection tests: pass.
- `bun run typecheck` — pass.
- `cargo test` — authored (state machine, buffer, encoder selection, hotkeys,
  migrations, repositories, ffmpeg args, export args); must run on Windows CI.
- `tauri build` — not run locally; runs in CI.

## Next automatic task

Implement `system/hotkeys` OS registration through `tauri-plugin-global-shortcut`
and the Windows `GetDiskFreeSpaceEx` storage adapter, then wire the capture loop
(video backend -> encoder -> segment writer -> ring buffer) behind the
`windows-capture` feature.
