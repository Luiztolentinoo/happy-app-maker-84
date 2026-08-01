use serde::{Deserialize, Serialize};

use crate::errors::{ClipCoreError, Result};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AudioDeviceKind {
    /// WASAPI loopback of the default render device (game audio).
    SystemLoopback,
    Microphone,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioDeviceInfo {
    pub id: String,
    pub label: String,
    pub kind: AudioDeviceKind,
    pub sample_rate: u32,
    pub channels: u16,
    pub is_default: bool,
    pub available: bool,
}

#[derive(Debug, Clone)]
pub struct AudioChunk {
    pub device_id: String,
    pub timestamp_us: u64,
    pub samples: Vec<f32>,
}

/// Audio acquisition contract. The engine mixes chunks by `timestamp_us` to
/// keep A/V sync against video frame timestamps.
pub trait AudioCaptureBackend: Send + Sync {
    fn enumerate(&self) -> Result<Vec<AudioDeviceInfo>>;
    fn start(&mut self, device_ids: &[String]) -> Result<()>;
    fn try_next_chunk(&mut self) -> Result<Option<AudioChunk>>;
    fn set_muted(&mut self, device_id: &str, muted: bool) -> Result<()>;
    fn stop(&mut self) -> Result<()>;
}

pub struct MockAudioBackend {
    running: bool,
    cursor: u64,
    muted: Vec<String>,
}

impl Default for MockAudioBackend {
    fn default() -> Self {
        Self { running: false, cursor: 0, muted: Vec::new() }
    }
}

impl AudioCaptureBackend for MockAudioBackend {
    fn enumerate(&self) -> Result<Vec<AudioDeviceInfo>> {
        Ok(vec![
            AudioDeviceInfo {
                id: "loopback-default".into(),
                label: "System audio (mock loopback)".into(),
                kind: AudioDeviceKind::SystemLoopback,
                sample_rate: 48_000,
                channels: 2,
                is_default: true,
                available: true,
            },
            AudioDeviceInfo {
                id: "mic-default".into(),
                label: "Default microphone (mock)".into(),
                kind: AudioDeviceKind::Microphone,
                sample_rate: 48_000,
                channels: 1,
                is_default: true,
                available: true,
            },
        ])
    }

    fn start(&mut self, _device_ids: &[String]) -> Result<()> {
        self.running = true;
        self.cursor = 0;
        Ok(())
    }

    fn try_next_chunk(&mut self) -> Result<Option<AudioChunk>> {
        if !self.running {
            return Err(ClipCoreError::BackendUnavailable("mock audio not started".into()));
        }
        self.cursor += 10_000;
        Ok(Some(AudioChunk {
            device_id: "loopback-default".into(),
            timestamp_us: self.cursor,
            samples: vec![0.0; 480],
        }))
    }

    fn set_muted(&mut self, device_id: &str, muted: bool) -> Result<()> {
        self.muted.retain(|d| d != device_id);
        if muted {
            self.muted.push(device_id.to_string());
        }
        Ok(())
    }

    fn stop(&mut self) -> Result<()> {
        self.running = false;
        Ok(())
    }
}
