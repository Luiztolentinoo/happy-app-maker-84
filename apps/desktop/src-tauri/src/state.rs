use std::path::PathBuf;
use std::sync::Arc;

use parking_lot::Mutex;
use tauri::{AppHandle, Manager};

use crate::capture::engine::{CaptureEngine, DefaultCaptureEngine};
use crate::capture::state_machine::CaptureStateMachine;
use crate::database::Database;
use crate::errors::Result;
use crate::system::hotkeys::HotkeyManager;
use crate::system::storage::StorageManager;

/// Shared application state managed by Tauri.
pub struct AppState {
    pub engine: Arc<Mutex<DefaultCaptureEngine>>,
    pub machine: Arc<Mutex<CaptureStateMachine>>,
    pub database: Arc<Database>,
    pub hotkeys: Arc<Mutex<HotkeyManager>>,
    pub storage: Arc<StorageManager>,
    pub data_dir: PathBuf,
}

impl AppState {
    /// Creates the data directory, opens SQLite, runs migrations and prepares
    /// the capture engine without starting it.
    pub fn bootstrap(app: &AppHandle) -> Result<Self> {
        let data_dir = app
            .path()
            .app_data_dir()
            .map_err(|e| crate::errors::ClipCoreError::Io(e.to_string()))?;
        std::fs::create_dir_all(&data_dir)?;

        let database = Arc::new(Database::open(data_dir.join("clipcore.db"))?);
        database.migrate()?;

        let clips_dir = data_dir.join("clips");
        let temp_dir = data_dir.join("segments");
        std::fs::create_dir_all(&clips_dir)?;
        std::fs::create_dir_all(&temp_dir)?;

        Ok(Self {
            engine: Arc::new(Mutex::new(DefaultCaptureEngine::new(temp_dir.clone(), clips_dir.clone()))),
            machine: Arc::new(Mutex::new(CaptureStateMachine::new())),
            database,
            hotkeys: Arc::new(Mutex::new(HotkeyManager::new())),
            storage: Arc::new(StorageManager::new(clips_dir, temp_dir)),
            data_dir,
        })
    }
}
