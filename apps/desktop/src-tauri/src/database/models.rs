use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipRecord {
    pub id: String,
    pub title: String,
    pub game: Option<String>,
    pub file_path: String,
    pub thumbnail_path: Option<String>,
    pub captured_at: String,
    pub duration_ms: u64,
    pub width: u32,
    pub height: u32,
    pub fps: u32,
    pub codec: String,
    pub file_size: u64,
    pub clip_type: String,
    pub favorite: bool,
    pub deleted_at: Option<String>,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewClip {
    pub title: String,
    pub game: Option<String>,
    pub file_path: String,
    pub duration_ms: u64,
    pub width: u32,
    pub height: u32,
    pub fps: u32,
    pub codec: String,
    pub file_size: u64,
    pub clip_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportRecord {
    pub id: String,
    pub clip_id: String,
    pub preset: String,
    pub output_path: Option<String>,
    pub status: String,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameProfileRecord {
    pub id: String,
    pub game_id: String,
    pub name: String,
    pub buffer_seconds: u32,
    pub width: u32,
    pub height: u32,
    pub fps: u32,
    pub bitrate_kbps: u32,
    pub codec: String,
}
