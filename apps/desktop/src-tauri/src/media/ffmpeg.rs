use std::path::{Path, PathBuf};
use std::process::Command;

use sha2::{Digest, Sha256};

use crate::capture::buffer::Segment;
use crate::errors::{ClipCoreError, Result};

/// Wrapper around the FFmpeg binary shipped as a Tauri sidecar.
///
/// The binary is bundled by the installer (`externalBin` in tauri.conf.json).
/// ClipCore never downloads FFmpeg at runtime: if the sidecar is missing, the
/// affected feature reports an error and Diagnostics asks the user to install it.
#[derive(Debug, Clone)]
pub struct FfmpegSidecar {
    path: PathBuf,
    /// Optional expected SHA-256 of the shipped binary.
    expected_sha256: Option<String>,
}

impl FfmpegSidecar {
    pub fn new(path: PathBuf, expected_sha256: Option<String>) -> Self {
        Self { path, expected_sha256 }
    }

    /// Resolves the sidecar next to the executable. Rejects any path outside the
    /// install directory so a hijacked PATH cannot be used.
    pub fn resolve() -> Result<Self> {
        let exe = std::env::current_exe()?;
        let dir = exe.parent().ok_or_else(|| ClipCoreError::Io("no exe dir".into()))?;
        let name = if cfg!(windows) { "ffmpeg.exe" } else { "ffmpeg" };
        let path = dir.join(name);
        Ok(Self::new(path, None))
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn exists(&self) -> bool {
        self.path.is_file()
    }

    pub fn checksum(&self) -> Result<String> {
        let bytes = std::fs::read(&self.path)?;
        let mut hasher = Sha256::new();
        hasher.update(&bytes);
        Ok(format!("{:x}", hasher.finalize()))
    }

    pub fn verify(&self) -> Result<()> {
        if !self.exists() {
            return Err(ClipCoreError::Ffmpeg(format!("{} not found", self.path.display())));
        }
        if let Some(expected) = &self.expected_sha256 {
            let actual = self.checksum()?;
            if &actual != expected {
                return Err(ClipCoreError::Ffmpeg("checksum mismatch".into()));
            }
        }
        Ok(())
    }

    pub fn diagnose(&self) -> Result<String> {
        self.verify()?;
        let out = self.run(&["-hide_banner", "-version"])?;
        Ok(out.lines().next().unwrap_or("ffmpeg").to_string())
    }

    /// Runs FFmpeg with separated arguments — never a shell string.
    pub fn run(&self, args: &[&str]) -> Result<String> {
        self.verify()?;
        let output = Command::new(&self.path)
            .args(args)
            .output()
            .map_err(|e| ClipCoreError::Ffmpeg(e.to_string()))?;
        if !output.status.success() {
            return Err(ClipCoreError::Ffmpeg(String::from_utf8_lossy(&output.stderr).into()));
        }
        Ok(String::from_utf8_lossy(&output.stdout).into())
    }

    /// Builds the concat demuxer list for the pinned segments.
    pub fn concat_list(segments: &[Segment]) -> String {
        segments
            .iter()
            .map(|s| format!("file '{}'", s.path.display()))
            .collect::<Vec<_>>()
            .join("\n")
    }

    /// Stream-copy concatenation: no re-encode, so saving stays instant.
    pub fn concat_segments(&self, segments: &[Segment], output: &Path) -> Result<()> {
        if segments.is_empty() {
            return Err(ClipCoreError::Ffmpeg("no segments".into()));
        }
        let list_path = output.with_extension("concat.txt");
        std::fs::write(&list_path, Self::concat_list(segments))?;
        let result = self.run(&[
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            &list_path.to_string_lossy(),
            "-c",
            "copy",
            "-movflags",
            "+faststart",
            &output.to_string_lossy(),
        ]);
        let _ = std::fs::remove_file(&list_path);
        result.map(|_| ())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn seg(id: u64) -> Segment {
        Segment {
            id,
            path: PathBuf::from(format!("/tmp/seg-{id}.mp4")),
            start_us: 0,
            duration_us: 1_000_000,
            bytes: 10,
            pinned: true,
        }
    }

    #[test]
    fn concat_list_has_one_line_per_segment() {
        let list = FfmpegSidecar::concat_list(&[seg(1), seg(2)]);
        assert_eq!(list.lines().count(), 2);
        assert!(list.contains("seg-1.mp4"));
    }

    #[test]
    fn missing_binary_reports_ffmpeg_error() {
        let s = FfmpegSidecar::new(PathBuf::from("/definitely/missing/ffmpeg"), None);
        assert_eq!(s.verify().unwrap_err().code(), "ffmpeg_error");
    }
}
