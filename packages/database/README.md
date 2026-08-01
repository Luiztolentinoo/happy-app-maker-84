Database contracts.

The desktop database is local SQLite, owned by Rust:
`apps/desktop/src-tauri/src/database/` (migrations, models, repositories).

This package holds SQL/schema documentation shared with any future cloud sync
layer. `localStorage` is NOT the desktop database — it only backs the browser preview.
