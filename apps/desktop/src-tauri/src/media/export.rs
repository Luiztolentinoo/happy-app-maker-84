use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::errors::Result;
use crate::media::ffmpeg::FfmpegSidecar;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportRequest {
    pub clip_path: PathBuf,
    pub output_path: PathBuf,
    /// Non-destructive trim window, in milliseconds.
    pub start_ms: u64,
    pub end_ms: u64,
    pub width: Option<u32>,
    pub bitrate_kbps: Option<u32>,
    pub mute: bool,
}

/// Non-destructive export: the source clip is never modified.
pub trait Exporter: Send + Sync {
    fn export(&self, request: &ExportRequest) -> Result<PathBuf>;
}

pub struct FfmpegExporter {
    pub ffmpeg: FfmpegSidecar,
}

impl FfmpegExporter {
    pub fn new(ffmpeg: FfmpegSidecar) -> Self {
        Self { ffmpeg }
    }

    pub fn build_args(request: &ExportRequest) -> Vec<String> {
        let mut args: Vec<String> = vec![
            "-y".into(),
            "-ss".into(),
            format!("{}.{:03}", request.start_ms / 1000, request.start_ms % 1000),
            "-to".into(),
            format!("{}.{:03}", request.end_ms / 1000, request.end_ms % 1000),
            "-i".into(),
            request.clip_path.to_string_lossy().into(),
        ];
        if let Some(width) = request.width {
            args.push("-vf".into());
            args.push(format!("scale={width}:-2"));
        }
        if let Some(bitrate) = request.bitrate_kbps {
            args.push("-b:v".into());
            args.push(format!("{bitrate}k"));
        }
        if request.mute {
            args.push("-an".into());
        }
        args.push(request.output_path.to_string_lossy().into());
        args
    }
}

impl Exporter for FfmpegExporter {
    fn export(&self, request: &ExportRequest) -> Result<PathBuf> {
        let owned = Self::build_args(request);
        let args: Vec<&str> = owned.iter().map(|s| s.as_str()).collect();
        self.ffmpeg.run(&args)?;
        Ok(request.output_path.clone())
    }
}

pub fn default_output(clip: &Path, suffix: &str) -> PathBuf {
    let stem = clip.file_stem().and_then(|s| s.to_str()).unwrap_or("clip");
    clip.with_file_name(format!("{stem}-{suffix}.mp4"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn args_include_trim_window_and_mute() {
        let req = ExportRequest {
            clip_path: PathBuf::from("/clips/a.mp4"),
            output_path: PathBuf::from("/clips/a-export.mp4"),
            start_ms: 1_500,
            end_ms: 4_000,
            width: Some(1280),
            bitrate_kbps: Some(8_000),
            mute: true,
        };
        let args = FfmpegExporter::build_args(&req);
        assert!(args.contains(&"1.500".to_string()));
        assert!(args.contains(&"4.000".to_string()));
        assert!(args.contains(&"-an".to_string()));
        assert!(args.contains(&"scale=1280:-2".to_string()));
    }

    #[test]
    fn default_output_adds_suffix() {
        let out = default_output(Path::new("/clips/ace.mp4"), "vertical");
        assert!(out.to_string_lossy().ends_with("ace-vertical.mp4"));
    }
}
