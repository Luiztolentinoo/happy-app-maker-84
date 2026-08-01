use rusqlite::Connection;

use crate::errors::Result;

/// Versioned migrations. Never edit an applied migration: append a new one.
pub const MIGRATIONS: &[(u32, &str)] = &[(
    1,
    r#"
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  executable TEXT NOT NULL,
  last_seen_at TEXT,
  auto_capture INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS game_profiles (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  buffer_seconds INTEGER NOT NULL DEFAULT 60,
  width INTEGER NOT NULL DEFAULT 1920,
  height INTEGER NOT NULL DEFAULT 1080,
  fps INTEGER NOT NULL DEFAULT 60,
  bitrate_kbps INTEGER NOT NULL DEFAULT 30000,
  codec TEXT NOT NULL DEFAULT 'h264'
);

CREATE TABLE IF NOT EXISTS hotkeys (
  action TEXT NOT NULL,
  profile_id TEXT REFERENCES game_profiles(id) ON DELETE CASCADE,
  combo TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (action, profile_id)
);

CREATE TABLE IF NOT EXISTS clips (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  game TEXT,
  file_path TEXT NOT NULL,
  thumbnail_path TEXT,
  captured_at TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  fps INTEGER NOT NULL,
  codec TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  clip_type TEXT NOT NULL,
  favorite INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  tags TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_clips_captured_at ON clips(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_clips_deleted_at ON clips(deleted_at);

CREATE TABLE IF NOT EXISTS edit_projects (
  id TEXT PRIMARY KEY,
  clip_id TEXT NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
  timeline_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS exports (
  id TEXT PRIMARY KEY,
  clip_id TEXT NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
  preset TEXT NOT NULL,
  output_path TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS job_queue (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS diagnostics (
  id TEXT PRIMARY KEY,
  generated_at TEXT NOT NULL,
  report_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recovery_files (
  path TEXT PRIMARY KEY,
  bytes INTEGER NOT NULL,
  recoverable INTEGER NOT NULL,
  found_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"#,
)];

/// Applies pending migrations and returns the resulting schema version.
pub fn run(conn: &Connection) -> Result<u32> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        );",
    )?;

    let current: u32 = conn
        .query_row("SELECT COALESCE(MAX(version), 0) FROM schema_migrations", [], |r| r.get(0))?;

    for (version, sql) in MIGRATIONS {
        if *version > current {
            conn.execute_batch(sql)?;
            conn.execute("INSERT INTO schema_migrations (version) VALUES (?1)", [version])?;
        }
    }

    Ok(conn.query_row("SELECT COALESCE(MAX(version), 0) FROM schema_migrations", [], |r| r.get(0))?)
}

#[cfg(test)]
mod tests {
    use crate::database::Database;

    #[test]
    fn migrations_are_idempotent() {
        let db = Database::in_memory().unwrap();
        assert_eq!(db.migrate().unwrap(), 1);
        assert_eq!(db.migrate().unwrap(), 1);
    }

    #[test]
    fn creates_expected_tables() {
        let db = Database::in_memory().unwrap();
        db.migrate().unwrap();
        db.with_conn(|c| {
            for table in ["settings", "clips", "hotkeys", "games", "exports", "job_queue"] {
                let count: u32 = c
                    .query_row(
                        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?1",
                        [table],
                        |r| r.get(0),
                    )
                    .unwrap();
                assert_eq!(count, 1, "missing table {table}");
            }
            Ok(())
        })
        .unwrap();
    }
}
