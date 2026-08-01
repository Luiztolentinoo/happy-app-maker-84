use serde::Serialize;
use thiserror::Error;

/// Structured error returned by every Tauri command.
#[derive(Debug, Error)]
pub enum ClipCoreError {
    #[error("invalid state transition: {from} -> {to}")]
    InvalidTransition { from: String, to: String },
    #[error("capture backend unavailable: {0}")]
    BackendUnavailable(String),
    #[error("encoder unavailable: {0}")]
    EncoderUnavailable(String),
    #[error("buffer error: {0}")]
    Buffer(String),
    #[error("disk full: {needed_bytes} bytes needed, {free_bytes} available")]
    DiskFull { needed_bytes: u64, free_bytes: u64 },
    #[error("hotkey conflict on {combo}")]
    HotkeyConflict { combo: String },
    #[error("reserved hotkey: {combo}")]
    ReservedHotkey { combo: String },
    #[error("ffmpeg sidecar problem: {0}")]
    Ffmpeg(String),
    #[error("database error: {0}")]
    Database(String),
    #[error("not found: {0}")]
    NotFound(String),
    #[error("io error: {0}")]
    Io(String),
    #[error("feature not implemented in this build: {0}")]
    NotImplemented(String),
}

/// Serializable payload the frontend receives on `Result::Err`.
#[derive(Debug, Serialize)]
pub struct ErrorPayload {
    pub code: String,
    pub message: String,
}

impl ClipCoreError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::InvalidTransition { .. } => "invalid_transition",
            Self::BackendUnavailable(_) => "backend_unavailable",
            Self::EncoderUnavailable(_) => "encoder_unavailable",
            Self::Buffer(_) => "buffer_error",
            Self::DiskFull { .. } => "disk_full",
            Self::HotkeyConflict { .. } => "hotkey_conflict",
            Self::ReservedHotkey { .. } => "reserved_hotkey",
            Self::Ffmpeg(_) => "ffmpeg_error",
            Self::Database(_) => "database_error",
            Self::NotFound(_) => "not_found",
            Self::Io(_) => "io_error",
            Self::NotImplemented(_) => "not_implemented",
        }
    }
}

impl Serialize for ClipCoreError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error> {
        ErrorPayload { code: self.code().into(), message: self.to_string() }.serialize(serializer)
    }
}

impl From<std::io::Error> for ClipCoreError {
    fn from(value: std::io::Error) -> Self {
        Self::Io(value.to_string())
    }
}

impl From<rusqlite::Error> for ClipCoreError {
    fn from(value: rusqlite::Error) -> Self {
        Self::Database(value.to_string())
    }
}

pub type Result<T> = std::result::Result<T, ClipCoreError>;
