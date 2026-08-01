use serde::{Deserialize, Serialize};

use crate::errors::Result;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CheckStatus {
    Pass,
    Warn,
    Fail,
    Skipped,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagnosticCheck {
    pub id: String,
    pub label: String,
    pub status: CheckStatus,
    pub detail: String,
    /// Set when a human action is required (install driver, add FFmpeg, etc.).
    pub action: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagnosticReport {
    pub generated_at: String,
    pub checks: Vec<DiagnosticCheck>,
}

/// Runs native environment checks reported in the Diagnostics screen.
pub trait DiagnosticRunner: Send + Sync {
    fn run(&self) -> Result<DiagnosticReport>;
}

pub struct NativeDiagnosticRunner {
    pub ffmpeg: crate::media::ffmpeg::FfmpegSidecar,
}

impl DiagnosticRunner for NativeDiagnosticRunner {
    fn run(&self) -> Result<DiagnosticReport> {
        let mut checks = vec![DiagnosticCheck {
            id: "platform".into(),
            label: "Operating system".into(),
            status: if cfg!(windows) { CheckStatus::Pass } else { CheckStatus::Warn },
            detail: std::env::consts::OS.into(),
            action: if cfg!(windows) { None } else { Some("Capture backends require Windows 10 1903+".into()) },
        }];

        checks.push(DiagnosticCheck {
            id: "capture_backend".into(),
            label: "Video capture backend".into(),
            status: if cfg!(all(windows, feature = "windows-capture")) { CheckStatus::Pass } else { CheckStatus::Warn },
            detail: format!("{:?}", crate::capture::video::preferred_backends()),
            action: Some("Build with --features windows-capture on Windows".into()),
        });

        let encoder = crate::capture::encoder::available_encoders();
        checks.push(DiagnosticCheck {
            id: "encoders".into(),
            label: "Encoders".into(),
            status: if encoder.iter().any(|e| e.available) { CheckStatus::Pass } else { CheckStatus::Fail },
            detail: encoder.iter().map(|e| e.label.clone()).collect::<Vec<_>>().join(", "),
            action: None,
        });

        let ffmpeg = self.ffmpeg.diagnose();
        checks.push(DiagnosticCheck {
            id: "ffmpeg".into(),
            label: "FFmpeg sidecar".into(),
            status: if ffmpeg.is_ok() { CheckStatus::Pass } else { CheckStatus::Fail },
            detail: ffmpeg.clone().unwrap_or_else(|e| e.to_string()),
            action: ffmpeg.err().map(|_| "Place ffmpeg.exe in src-tauri/binaries (see docs/FFMPEG.md)".into()),
        });

        Ok(DiagnosticReport { generated_at: chrono::Utc::now().to_rfc3339(), checks })
    }
}
