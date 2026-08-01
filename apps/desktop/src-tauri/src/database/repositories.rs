use rusqlite::{params, Connection, Row};

use crate::database::models::{ClipRecord, NewClip};
use crate::database::Database;
use crate::errors::{ClipCoreError, Result};

fn row_to_clip(row: &Row<'_>) -> rusqlite::Result<ClipRecord> {
    let tags: String = row.get("tags")?;
    Ok(ClipRecord {
        id: row.get("id")?,
        title: row.get("title")?,
        game: row.get("game")?,
        file_path: row.get("file_path")?,
        thumbnail_path: row.get("thumbnail_path")?,
        captured_at: row.get("captured_at")?,
        duration_ms: row.get::<_, i64>("duration_ms")? as u64,
        width: row.get::<_, i64>("width")? as u32,
        height: row.get::<_, i64>("height")? as u32,
        fps: row.get::<_, i64>("fps")? as u32,
        codec: row.get("codec")?,
        file_size: row.get::<_, i64>("file_size")? as u64,
        clip_type: row.get("clip_type")?,
        favorite: row.get::<_, i64>("favorite")? == 1,
        deleted_at: row.get("deleted_at")?,
        tags: tags.split(',').filter(|t| !t.is_empty()).map(|t| t.to_string()).collect(),
    })
}

/// CRUD for the local clip library.
pub struct ClipRepository<'a> {
    db: &'a Database,
}

impl<'a> ClipRepository<'a> {
    pub fn new(db: &'a Database) -> Self {
        Self { db }
    }

    pub fn insert(&self, clip: &NewClip) -> Result<ClipRecord> {
        let id = uuid::Uuid::new_v4().to_string();
        let captured_at = chrono::Utc::now().to_rfc3339();
        self.db.with_conn(|c| {
            c.execute(
                "INSERT INTO clips (id, title, game, file_path, captured_at, duration_ms, width, height, fps, codec, file_size, clip_type)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)",
                params![
                    id,
                    clip.title,
                    clip.game,
                    clip.file_path,
                    captured_at,
                    clip.duration_ms as i64,
                    clip.width as i64,
                    clip.height as i64,
                    clip.fps as i64,
                    clip.codec,
                    clip.file_size as i64,
                    clip.clip_type
                ],
            )?;
            Ok(())
        })?;
        self.get(&id)
    }

    pub fn get(&self, id: &str) -> Result<ClipRecord> {
        self.db.with_conn(|c: &Connection| {
            c.query_row("SELECT * FROM clips WHERE id = ?1", [id], row_to_clip)
                .map_err(|_| ClipCoreError::NotFound(format!("clip {id}")))
        })
    }

    pub fn list(&self, include_deleted: bool) -> Result<Vec<ClipRecord>> {
        self.db.with_conn(|c| {
            let sql = if include_deleted {
                "SELECT * FROM clips ORDER BY captured_at DESC"
            } else {
                "SELECT * FROM clips WHERE deleted_at IS NULL ORDER BY captured_at DESC"
            };
            let mut stmt = c.prepare(sql)?;
            let rows = stmt.query_map([], row_to_clip)?;
            let mut out = Vec::new();
            for row in rows {
                out.push(row?);
            }
            Ok(out)
        })
    }

    pub fn rename(&self, id: &str, title: &str) -> Result<ClipRecord> {
        self.db.with_conn(|c| {
            let changed = c.execute("UPDATE clips SET title = ?2 WHERE id = ?1", params![id, title])?;
            if changed == 0 {
                return Err(ClipCoreError::NotFound(format!("clip {id}")));
            }
            Ok(())
        })?;
        self.get(id)
    }

    pub fn set_favorite(&self, id: &str, favorite: bool) -> Result<ClipRecord> {
        self.db.with_conn(|c| {
            c.execute(
                "UPDATE clips SET favorite = ?2 WHERE id = ?1",
                params![id, if favorite { 1 } else { 0 }],
            )?;
            Ok(())
        })?;
        self.get(id)
    }

    /// Soft delete so `restore_clip` can bring it back.
    pub fn soft_delete(&self, id: &str) -> Result<()> {
        self.db.with_conn(|c| {
            c.execute(
                "UPDATE clips SET deleted_at = ?2 WHERE id = ?1",
                params![id, chrono::Utc::now().to_rfc3339()],
            )?;
            Ok(())
        })
    }

    pub fn restore(&self, id: &str) -> Result<ClipRecord> {
        self.db.with_conn(|c| {
            c.execute("UPDATE clips SET deleted_at = NULL WHERE id = ?1", [id])?;
            Ok(())
        })?;
        self.get(id)
    }

    pub fn purge(&self, id: &str) -> Result<()> {
        self.db.with_conn(|c| {
            c.execute("DELETE FROM clips WHERE id = ?1", [id])?;
            Ok(())
        })
    }
}

/// Key/value settings repository.
pub struct SettingsRepository<'a> {
    db: &'a Database,
}

impl<'a> SettingsRepository<'a> {
    pub fn new(db: &'a Database) -> Self {
        Self { db }
    }

    pub fn set(&self, key: &str, value: &str) -> Result<()> {
        self.db.with_conn(|c| {
            c.execute(
                "INSERT INTO settings (key, value) VALUES (?1, ?2)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')",
                params![key, value],
            )?;
            Ok(())
        })
    }

    pub fn get(&self, key: &str) -> Result<Option<String>> {
        self.db.with_conn(|c| {
            Ok(c.query_row("SELECT value FROM settings WHERE key = ?1", [key], |r| r.get(0)).ok())
        })
    }
}

/// Hotkey persistence, optionally scoped to a per-game profile.
pub struct HotkeyRepository<'a> {
    db: &'a Database,
}

impl<'a> HotkeyRepository<'a> {
    pub fn new(db: &'a Database) -> Self {
        Self { db }
    }

    pub fn upsert(&self, action: &str, profile_id: Option<&str>, combo: &str, enabled: bool) -> Result<()> {
        self.db.with_conn(|c| {
            c.execute(
                "INSERT INTO hotkeys (action, profile_id, combo, enabled) VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT(action, profile_id) DO UPDATE SET combo = excluded.combo, enabled = excluded.enabled",
                params![action, profile_id, combo, if enabled { 1 } else { 0 }],
            )?;
            Ok(())
        })
    }

    pub fn list(&self) -> Result<Vec<(String, String, bool)>> {
        self.db.with_conn(|c| {
            let mut stmt = c.prepare("SELECT action, combo, enabled FROM hotkeys")?;
            let rows = stmt.query_map([], |r| {
                Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?, r.get::<_, i64>(2)? == 1))
            })?;
            let mut out = Vec::new();
            for row in rows {
                out.push(row?);
            }
            Ok(out)
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn db() -> Database {
        let db = Database::in_memory().unwrap();
        db.migrate().unwrap();
        db
    }

    fn new_clip() -> NewClip {
        NewClip {
            title: "Ace clutch".into(),
            game: Some("Valorant".into()),
            file_path: "C:/clips/ace.mp4".into(),
            duration_ms: 30_000,
            width: 1920,
            height: 1080,
            fps: 60,
            codec: "h264".into(),
            file_size: 42_000_000,
            clip_type: "retroactive".into(),
        }
    }

    #[test]
    fn clip_crud_round_trip() {
        let db = db();
        let repo = ClipRepository::new(&db);
        let created = repo.insert(&new_clip()).unwrap();
        assert_eq!(repo.list(false).unwrap().len(), 1);

        let renamed = repo.rename(&created.id, "Ace 1v5").unwrap();
        assert_eq!(renamed.title, "Ace 1v5");

        let fav = repo.set_favorite(&created.id, true).unwrap();
        assert!(fav.favorite);

        repo.soft_delete(&created.id).unwrap();
        assert!(repo.list(false).unwrap().is_empty());
        assert_eq!(repo.list(true).unwrap().len(), 1);

        let restored = repo.restore(&created.id).unwrap();
        assert!(restored.deleted_at.is_none());

        repo.purge(&created.id).unwrap();
        assert!(repo.list(true).unwrap().is_empty());
    }

    #[test]
    fn missing_clip_is_not_found() {
        let db = db();
        assert_eq!(ClipRepository::new(&db).get("nope").unwrap_err().code(), "not_found");
    }

    #[test]
    fn settings_upsert() {
        let db = db();
        let repo = SettingsRepository::new(&db);
        repo.set("buffer_seconds", "60").unwrap();
        repo.set("buffer_seconds", "120").unwrap();
        assert_eq!(repo.get("buffer_seconds").unwrap().unwrap(), "120");
        assert!(repo.get("missing").unwrap().is_none());
    }

    #[test]
    fn hotkeys_persist() {
        let db = db();
        let repo = HotkeyRepository::new(&db);
        repo.upsert("save_clip", None, "F8", true).unwrap();
        repo.upsert("save_clip", None, "F6", true).unwrap();
        let list = repo.list().unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].1, "F6");
    }
}
