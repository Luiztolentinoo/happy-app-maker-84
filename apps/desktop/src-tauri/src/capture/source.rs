use serde::{Deserialize, Serialize};

use crate::errors::Result;

/// Kind of surface being captured.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SourceKind {
    Monitor,
    Window,
    GameProcess,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptureSourceInfo {
    pub id: String,
    pub label: String,
    pub kind: SourceKind,
    pub width: u32,
    pub height: u32,
    pub refresh_hz: u32,
    pub hdr: bool,
    pub available: bool,
}

/// A concrete surface the video backend can attach to.
pub trait CaptureSource: Send + Sync {
    fn info(&self) -> CaptureSourceInfo;
    /// Returns false when the window/monitor disappeared and the engine should
    /// re-enumerate sources.
    fn is_alive(&self) -> bool;
}

/// Enumerates monitors, windows and game processes.
pub trait CaptureSourceEnumerator: Send + Sync {
    fn enumerate(&self) -> Result<Vec<CaptureSourceInfo>>;
    fn primary_monitor(&self) -> Result<CaptureSourceInfo>;
}

/// Mock enumerator used in the browser preview, tests and non-Windows dev boxes.
pub struct MockSourceEnumerator;

impl CaptureSourceEnumerator for MockSourceEnumerator {
    fn enumerate(&self) -> Result<Vec<CaptureSourceInfo>> {
        Ok(vec![self.primary_monitor()?])
    }

    fn primary_monitor(&self) -> Result<CaptureSourceInfo> {
        Ok(CaptureSourceInfo {
            id: "monitor-0".into(),
            label: "Primary monitor (mock)".into(),
            kind: SourceKind::Monitor,
            width: 2560,
            height: 1440,
            refresh_hz: 144,
            hdr: false,
            available: true,
        })
    }
}
