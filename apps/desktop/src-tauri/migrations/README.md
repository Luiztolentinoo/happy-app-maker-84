Runtime resources copied into the installer (initial database seeds, SQL files).

The schema itself is applied by `src/database/migrations.rs` at first launch, so
this folder only needs files that must exist on disk before that runs.
