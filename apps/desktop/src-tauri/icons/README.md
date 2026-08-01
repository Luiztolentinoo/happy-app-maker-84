Place Tauri window/tray icons here:

- `32x32.png`
- `128x128.png`
- `icon.ico` (Windows installer + window icon)
- `icon.png` (tray)

Generate them from a single 1024x1024 source with:

```bash
bunx tauri icon path/to/logo.png --output apps/desktop/src-tauri/icons
```

Until real icons are added the build uses these paths and will fail if the files
are missing — this is intentional so the installer never ships placeholder art.
