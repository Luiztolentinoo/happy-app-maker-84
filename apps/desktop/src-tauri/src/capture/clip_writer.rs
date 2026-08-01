use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::capture::buffer::Segment;
use crate::errors::{ClipCoreError, Result};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WrittenClip {
    pub path: PathBuf,
    pub duration_ms: u64,
    pub bytes: u64,
}

/// Turns pinned segments into a final clip file. Implementations must write to
/// a `.part` file and rename atomically so a crash never leaves a half clip in
/// the library.
pub trait ClipWriter: Send + Sync {
    fn write(&self, segments: &[Segment], output: &Path) -> Result<WrittenClip>;
    fn validate(&self, path: &Path) -> Result<()>;
}

pub struct FfmpegClipWriter {
    pub ffmpeg: crate::media::ffmpeg::FfmpegSidecar,
}

impl FfmpegClipWriter {
    pub fn new(ffmpeg: crate::media::ffmpeg::FfmpegSidecar) -> Self {
        Self { ffmpeg }
    }

    /// Path used while the clip is still being assembled.
    pub fn temp_path(output: &Path) -> PathBuf {
        let mut p = output.to_path_buf();
        p.set_extension("part");
        p
    }
}

impl ClipWriter for FfmpegClipWriter {
    fn write(&self, segments: &[Segment], output: &Path) -> Result<WrittenClip> {
        if segments.is_empty() {
            return Err(ClipCoreError::Buffer("no segments to write".into()));
        }
        let temp = Self::temp_path(output);
        // Stream-copy concat: no re-encode, so saving is near-instant and the
        // capture pipeline keeps running.
        self.ffmpeg.concat_segments(segments, &temp)?;
        self.validate(&temp)?;
        std::fs::rename(&temp, output)?;
        let bytes = std::fs::metadata(output).map(|m| m.len()).unwrap_or(0);
        let duration_ms = segments.iter().map(|s| s.duration_us).sum::<u64>() / 1_000;
        Ok(WrittenClip { path: output.to_path_buf(), duration_ms, bytes })
    }

    fn validate(&self, path: &Path) -> Result<()> {
        let meta = std::fs::metadata(path)?;
        if meta.len() == 0 {
            return Err(ClipCoreError::Buffer(format!("{} is empty", path.display())));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn temp_path_uses_part_extension() {
        let p = FfmpegClipWriter::temp_path(Path::new("/clips/clip.mp4"));
        assert_eq!(p.extension().unwrap(), "part");
    }
}
