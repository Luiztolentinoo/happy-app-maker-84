//! Local SQLite storage: schema migrations, models and repositories.
pub mod migrations;
pub mod models;
pub mod repositories;

use std::path::PathBuf;

use parking_lot::Mutex;
use rusqlite::Connection;

use crate::errors::Result;

/// Thread-safe handle around the local SQLite database.
pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn open(path: PathBuf) -> Result<Self> {
        let conn = Connection::open(path)?;
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        Ok(Self { conn: Mutex::new(conn) })
    }

    #[cfg(test)]
    pub fn in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        Ok(Self { conn: Mutex::new(conn) })
    }

    pub fn with_conn<T>(&self, f: impl FnOnce(&Connection) -> Result<T>) -> Result<T> {
        let guard = self.conn.lock();
        f(&guard)
    }

    pub fn migrate(&self) -> Result<u32> {
        self.with_conn(migrations::run)
    }
}
