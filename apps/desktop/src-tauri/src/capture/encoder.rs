use serde::{Deserialize, Serialize};

use crate::errors::{ClipCoreError, Result};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum EncoderKind {
    NvidiaNvenc,
    AmdAmf,
    IntelQuickSync,
    SoftwareX264,
    Mock,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum VideoCodec {
    H264,
    Hevc,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncoderInfo {
    pub kind: EncoderKind,
    pub label: String,
    pub codecs: Vec<VideoCodec>,
    pub hardware: bool,
    pub available: bool,
    pub priority: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncoderConfig {
    pub codec: VideoCodec,
    pub width: u32,
    pub height: u32,
    pub fps: u32,
    pub bitrate_kbps: u32,
    /// Segment length in milliseconds; each segment must start on a keyframe so
    /// the circular buffer can cut without re-encoding.
    pub segment_ms: u32,
}

#[derive(Debug, Clone)]
pub struct EncodedPacket {
    pub timestamp_us: u64,
    pub duration_us: u64,
    pub keyframe: bool,
    pub data: Vec<u8>,
}

/// Encoder contract. `select_best` implements the hardware priority chain
/// NVENC -> AMF -> QuickSync -> software.
pub trait EncoderBackend: Send + Sync {
    fn info(&self) -> EncoderInfo;
    fn open(&mut self, config: &EncoderConfig) -> Result<()>;
    fn submit(&mut self, frame: &crate::capture::video::VideoFrame) -> Result<()>;
    fn try_next_packet(&mut self) -> Result<Option<EncodedPacket>>;
    fn close(&mut self) -> Result<()>;
}

pub fn available_encoders() -> Vec<EncoderInfo> {
    #[cfg(all(windows, feature = "windows-capture"))]
    let hardware = vec![
        EncoderInfo { kind: EncoderKind::NvidiaNvenc, label: "NVIDIA NVENC".into(), codecs: vec![VideoCodec::H264, VideoCodec::Hevc], hardware: true, available: false, priority: 0 },
        EncoderInfo { kind: EncoderKind::AmdAmf, label: "AMD AMF".into(), codecs: vec![VideoCodec::H264, VideoCodec::Hevc], hardware: true, available: false, priority: 1 },
        EncoderInfo { kind: EncoderKind::IntelQuickSync, label: "Intel Quick Sync".into(), codecs: vec![VideoCodec::H264], hardware: true, available: false, priority: 2 },
    ];
    #[cfg(not(all(windows, feature = "windows-capture")))]
    let hardware: Vec<EncoderInfo> = Vec::new();

    let mut all = hardware;
    all.push(EncoderInfo {
        kind: EncoderKind::SoftwareX264,
        label: "Software x264 (fallback)".into(),
        codecs: vec![VideoCodec::H264],
        hardware: false,
        available: true,
        priority: 3,
    });
    all
}

/// Picks the highest-priority available encoder, or errors out.
pub fn select_best(encoders: &[EncoderInfo]) -> Result<EncoderInfo> {
    encoders
        .iter()
        .filter(|e| e.available)
        .min_by_key(|e| e.priority)
        .cloned()
        .ok_or_else(|| ClipCoreError::EncoderUnavailable("no encoder reported available".into()))
}

/// Deterministic encoder used by buffer tests: one keyframe per segment.
pub struct MockEncoder {
    config: Option<EncoderConfig>,
    pending: Vec<EncodedPacket>,
    counter: u64,
}

impl Default for MockEncoder {
    fn default() -> Self {
        Self { config: None, pending: Vec::new(), counter: 0 }
    }
}

impl EncoderBackend for MockEncoder {
    fn info(&self) -> EncoderInfo {
        EncoderInfo {
            kind: EncoderKind::Mock,
            label: "Mock encoder".into(),
            codecs: vec![VideoCodec::H264],
            hardware: false,
            available: true,
            priority: 9,
        }
    }

    fn open(&mut self, config: &EncoderConfig) -> Result<()> {
        self.config = Some(config.clone());
        self.counter = 0;
        Ok(())
    }

    fn submit(&mut self, frame: &crate::capture::video::VideoFrame) -> Result<()> {
        let cfg = self
            .config
            .as_ref()
            .ok_or_else(|| ClipCoreError::EncoderUnavailable("encoder not opened".into()))?;
        self.counter += 1;
        let frames_per_segment = (cfg.fps as u64 * cfg.segment_ms as u64 / 1000).max(1);
        self.pending.push(EncodedPacket {
            timestamp_us: frame.timestamp_us,
            duration_us: 1_000_000 / cfg.fps.max(1) as u64,
            keyframe: (self.counter - 1) % frames_per_segment == 0,
            data: vec![0u8; 1024],
        });
        Ok(())
    }

    fn try_next_packet(&mut self) -> Result<Option<EncodedPacket>> {
        Ok(if self.pending.is_empty() { None } else { Some(self.pending.remove(0)) })
    }

    fn close(&mut self) -> Result<()> {
        self.config = None;
        self.pending.clear();
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn software_fallback_is_always_selectable() {
        let best = select_best(&available_encoders()).unwrap();
        assert!(best.available);
    }

    #[test]
    fn no_available_encoder_errors() {
        let none = vec![EncoderInfo {
            kind: EncoderKind::NvidiaNvenc,
            label: "NVENC".into(),
            codecs: vec![VideoCodec::H264],
            hardware: true,
            available: false,
            priority: 0,
        }];
        assert_eq!(select_best(&none).unwrap_err().code(), "encoder_unavailable");
    }
}
