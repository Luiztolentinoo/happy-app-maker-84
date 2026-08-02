//! Structured logging with an in-memory ring buffer so the diagnostics screen
//! can show recent engine activity without touching the filesystem.

use std::collections::VecDeque;
use std::sync::Arc;

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};

use crate::runtime::event_bus::SubsystemId;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LogLevel {
    Debug,
    Info,
    Warn,
    Error,
}

impl LogLevel {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Debug => "debug",
            Self::Info => "info",
            Self::Warn => "warn",
            Self::Error => "error",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub level: LogLevel,
    pub subsystem: SubsystemId,
    pub message: String,
    pub at_ms: u64,
}

/// Cloneable ring-buffer log sink.
#[derive(Clone)]
pub struct EngineLog {
    entries: Arc<RwLock<VecDeque<LogEntry>>>,
    capacity: usize,
    min_level: LogLevel,
}

impl Default for EngineLog {
    fn default() -> Self {
        Self::new(500, LogLevel::Debug)
    }
}

impl EngineLog {
    pub fn new(capacity: usize, min_level: LogLevel) -> Self {
        Self { entries: Arc::new(RwLock::new(VecDeque::new())), capacity: capacity.max(1), min_level }
    }

    pub fn log(&self, level: LogLevel, subsystem: SubsystemId, message: impl Into<String>) {
        if level < self.min_level {
            return;
        }
        let entry = LogEntry { level, subsystem, message: message.into(), at_ms: now_ms() };
        match level {
            LogLevel::Debug => tracing::debug!(target: "clipcore", "{} {}", subsystem.as_str(), entry.message),
            LogLevel::Info => tracing::info!(target: "clipcore", "{} {}", subsystem.as_str(), entry.message),
            LogLevel::Warn => tracing::warn!(target: "clipcore", "{} {}", subsystem.as_str(), entry.message),
            LogLevel::Error => tracing::error!(target: "clipcore", "{} {}", subsystem.as_str(), entry.message),
        }
        let mut entries = self.entries.write();
        entries.push_front(entry);
        while entries.len() > self.capacity {
            entries.pop_back();
        }
    }

    pub fn info(&self, subsystem: SubsystemId, message: impl Into<String>) {
        self.log(LogLevel::Info, subsystem, message);
    }

    pub fn warn(&self, subsystem: SubsystemId, message: impl Into<String>) {
        self.log(LogLevel::Warn, subsystem, message);
    }

    pub fn error(&self, subsystem: SubsystemId, message: impl Into<String>) {
        self.log(LogLevel::Error, subsystem, message);
    }

    /// Most recent entries first, newest-limited.
    pub fn recent(&self, limit: usize) -> Vec<LogEntry> {
        self.entries.read().iter().take(limit).cloned().collect()
    }

    pub fn clear(&self) {
        self.entries.write().clear();
    }
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_only_capacity_entries_newest_first() {
        let log = EngineLog::new(2, LogLevel::Debug);
        log.info(SubsystemId::Encoder, "a");
        log.info(SubsystemId::Encoder, "b");
        log.info(SubsystemId::Encoder, "c");
        let recent = log.recent(10);
        assert_eq!(recent.len(), 2);
        assert_eq!(recent[0].message, "c");
    }

    #[test]
    fn filters_below_min_level() {
        let log = EngineLog::new(10, LogLevel::Warn);
        log.log(LogLevel::Debug, SubsystemId::Storage, "ignored");
        log.error(SubsystemId::Storage, "kept");
        assert_eq!(log.recent(10).len(), 1);
    }
}
