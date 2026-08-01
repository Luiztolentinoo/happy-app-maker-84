use std::path::{Path, PathBuf};

use crate::errors::Result;
use crate::media::ffmpeg::FfmpegSidecar;

/// Extracts poster frames for the library grid.
pub trait ThumbnailGenerator: Send + Sync {
    fn generate(&self, clip: &Path, output: &Path, at_ms: u64) -> Result<PathBuf>;
}

pub struct FfmpegThumbnailGenerator {
    pub ffmpeg: FfmpegSidecar,
    pub width: u32,
}

impl FfmpegThumbnailGenerator {
    pub fn new(ffmpeg: FfmpegSidecar) -> Self {
        Self { ffmpeg, width: 640 }
    }
}

impl ThumbnailGenerator for FfmpegThumbnailGenerator {
    fn generate(&self, clip: &Path, output: &Path, at_ms: u64) -> Result<PathBuf> {
        let seek = format!("{}.{:03}", at_ms / 1000, at_ms % 1000);
        let scale = format!("scale={}:-2", self.width);
        self.ffmpeg.run(&[
            "-y",
            "-ss",
            &seek,
            "-i",
            &clip.to_string_lossy(),
            "-frames:v",
            "1",
            "-vf",
            &scale,
            &output.to_string_lossy(),
        ])?;
        Ok(output.to_path_buf())
    }
}
