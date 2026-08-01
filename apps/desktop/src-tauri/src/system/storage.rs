use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::errors::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageStatus {
    pub clips_dir: PathBuf,
    pub temp_dir: PathBuf,
    pub used_bytes: u64,
    pub free_bytes: u64,
    pub total_bytes: u64,
    pub clip_count: u64,
    pub quota_bytes: u64,
    pub low_space: bool,
}

/// Storage accounting and retention.
pub trait StorageManagerContract: Send + Sync {
    fn status(&self) -> Result<StorageStatus>;
    fn set_quota(&self, bytes: u64) -> Result<()>;
    /// Deletes oldest non-favorite clips until usage fits the quota.
    fn enforce_quota(&self) -> Result<Vec<PathBuf>>;
}

pub struct StorageManager {
    pub clips_dir: PathBuf,
    pub temp_dir: PathBuf,
    pub low_space_threshold: u64,
}

impl StorageManager {
    pub fn new(clips_dir: PathBuf, temp_dir: PathBuf) -> Self {
        Self { clips_dir, temp_dir, low_space_threshold: 5 * 1024 * 1024 * 1024 }
    }

    fn dir_size(path: &PathBuf) -> (u64, u64) {
        let mut bytes = 0u64;
        let mut count = 0u64;
        if let Ok(entries) = std::fs::read_dir(path) {
            for entry in entries.flatten() {
                if let Ok(meta) = entry.metadata() {
                    if meta.is_file() {
                        bytes += meta.len();
                        count += 1;
                    }
                }
            }
        }
        (bytes, count)
    }

    pub fn status(&self) -> Result<StorageStatus> {
        let (used_bytes, clip_count) = Self::dir_size(&self.clips_dir);
        // Free space needs a platform call (GetDiskFreeSpaceEx on Windows);
        // until that adapter lands we report 0 and flag low_space as unknown.
        let free_bytes = 0;
        Ok(StorageStatus {
            clips_dir: self.clips_dir.clone(),
            temp_dir: self.temp_dir.clone(),
            used_bytes,
            free_bytes,
            total_bytes: 0,
            clip_count,
            quota_bytes: 0,
            low_space: free_bytes > 0 && free_bytes < self.low_space_threshold,
        })
    }
}
