use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::errors::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecoveredFile {
    pub path: PathBuf,
    pub bytes: u64,
    pub recoverable: bool,
}

/// Cleans up after a crash: leftover `.part` clips and orphan segments.
pub trait RecoveryManager: Send + Sync {
    fn scan(&self) -> Result<Vec<RecoveredFile>>;
    fn recover(&self, path: &Path) -> Result<PathBuf>;
    fn discard(&self, path: &Path) -> Result<()>;
}

pub struct FsRecoveryManager {
    pub temp_dir: PathBuf,
    pub clips_dir: PathBuf,
}

impl FsRecoveryManager {
    pub fn new(temp_dir: PathBuf, clips_dir: PathBuf) -> Self {
        Self { temp_dir, clips_dir }
    }

    fn is_partial(path: &Path) -> bool {
        matches!(path.extension().and_then(|e| e.to_str()), Some("part") | Some("tmp"))
    }
}

impl RecoveryManager for FsRecoveryManager {
    fn scan(&self) -> Result<Vec<RecoveredFile>> {
        let mut found = Vec::new();
        for dir in [&self.temp_dir, &self.clips_dir] {
            if !dir.exists() {
                continue;
            }
            for entry in std::fs::read_dir(dir)? {
                let entry = entry?;
                let path = entry.path();
                if Self::is_partial(&path) {
                    let bytes = entry.metadata().map(|m| m.len()).unwrap_or(0);
                    found.push(RecoveredFile { path, bytes, recoverable: bytes > 0 });
                }
            }
        }
        Ok(found)
    }

    fn recover(&self, path: &Path) -> Result<PathBuf> {
        let mut target = self.clips_dir.join(path.file_stem().unwrap_or_default());
        target.set_extension("mp4");
        std::fs::rename(path, &target)?;
        Ok(target)
    }

    fn discard(&self, path: &Path) -> Result<()> {
        std::fs::remove_file(path)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_partial_extensions() {
        assert!(FsRecoveryManager::is_partial(Path::new("a.part")));
        assert!(!FsRecoveryManager::is_partial(Path::new("a.mp4")));
    }
}
