use serde::{Deserialize, Serialize};

use crate::errors::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub executable: String,
    pub window_title: Option<String>,
    pub fullscreen: bool,
}

/// Enumerates running processes and foreground window information.
pub trait ProcessInspector: Send + Sync {
    fn list(&self) -> Result<Vec<ProcessInfo>>;
    fn foreground(&self) -> Result<Option<ProcessInfo>>;
}

pub struct MockProcessInspector;

impl ProcessInspector for MockProcessInspector {
    fn list(&self) -> Result<Vec<ProcessInfo>> {
        Ok(Vec::new())
    }

    fn foreground(&self) -> Result<Option<ProcessInfo>> {
        Ok(None)
    }
}

/// Real implementation uses EnumProcesses + GetForegroundWindow.
#[cfg(all(windows, feature = "windows-capture"))]
pub struct WindowsProcessInspector;
