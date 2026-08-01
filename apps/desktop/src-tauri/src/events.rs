use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::capture::state_machine::CaptureState;

/// Event names emitted to the frontend. The TypeScript layer subscribes to
/// these in `src/services/captureService.ts`.
pub mod names {
    pub const CAPTURE_STATE: &str = "clipcore://capture-state";
    pub const CLIP_SAVED: &str = "clipcore://clip-saved";
    pub const GAME_DETECTED: &str = "clipcore://game-detected";
    pub const STORAGE_WARNING: &str = "clipcore://storage-warning";
    pub const PERFORMANCE: &str = "clipcore://performance";
    pub const DIAGNOSTIC: &str = "clipcore://diagnostic";
}

#[derive(Debug, Clone, Serialize)]
pub struct CaptureStateEvent {
    pub state: CaptureState,
    pub buffer_seconds: u32,
    pub game: Option<String>,
    pub degraded_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ClipSavedEvent {
    pub id: String,
    pub path: String,
    pub duration_ms: u64,
}

pub fn emit<T: Serialize + Clone>(app: &AppHandle, name: &str, payload: T) {
    if let Err(err) = app.emit(name, payload) {
        tracing::warn!("failed to emit {name}: {err}");
    }
}
