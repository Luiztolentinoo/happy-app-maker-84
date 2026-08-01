use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::capture::audio::{AudioCaptureBackend, MockAudioBackend};
use crate::capture::buffer::{CircularBuffer, Segment, SegmentRingBuffer};
use crate::capture::encoder::{EncoderConfig, VideoCodec};
use crate::capture::source::{CaptureSourceEnumerator, CaptureSourceInfo, MockSourceEnumerator};
use crate::capture::state_machine::CaptureState;
use crate::capture::video::{MockVideoBackend, VideoCaptureBackend};
use crate::errors::{ClipCoreError, Result};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptureSettings {
    pub buffer_seconds: u32,
    pub width: u32,
    pub height: u32,
    pub fps: u32,
    pub bitrate_kbps: u32,
    pub codec: VideoCodec,
    pub segment_ms: u32,
    pub audio_device_ids: Vec<String>,
    pub source_id: Option<String>,
}

impl Default for CaptureSettings {
    fn default() -> Self {
        Self {
            buffer_seconds: 60,
            width: 1920,
            height: 1080,
            fps: 60,
            bitrate_kbps: 30_000,
            codec: VideoCodec::H264,
            segment_ms: 2_000,
            audio_device_ids: vec!["loopback-default".into()],
            source_id: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptureStatus {
    pub state: CaptureState,
    pub buffer_seconds: u32,
    pub buffered_ms: u64,
    pub buffered_bytes: u64,
    pub settings: CaptureSettings,
    pub degraded_reason: Option<String>,
    /// False whenever the running build has no real capture backend.
    pub native_capture_available: bool,
}

/// Top-level capture orchestration contract used by the Tauri commands.
pub trait CaptureEngine: Send + Sync {
    fn status(&self) -> CaptureStatus;
    fn settings(&self) -> CaptureSettings;
    fn update_settings(&mut self, settings: CaptureSettings) -> Result<()>;
    fn start_buffer(&mut self) -> Result<()>;
    fn stop_buffer(&mut self) -> Result<()>;
    /// Pins the last `seconds` of buffered segments and writes them out. The
    /// buffer keeps recording during the write.
    fn save_retroactive(&mut self, seconds: u32) -> Result<Vec<Segment>>;
    fn start_session(&mut self) -> Result<()>;
    fn stop_session(&mut self) -> Result<()>;
    fn pause(&mut self) -> Result<()>;
    fn resume(&mut self) -> Result<()>;
    fn list_sources(&self) -> Result<Vec<CaptureSourceInfo>>;
}

/// Default engine. Wires the source enumerator, video/audio backends, encoder
/// and circular buffer. On non-Windows builds the mock backends are used, and
/// `native_capture_available` reports false so the UI never claims real capture.
pub struct DefaultCaptureEngine {
    settings: CaptureSettings,
    buffer: SegmentRingBuffer,
    video: Box<dyn VideoCaptureBackend>,
    audio: Box<dyn AudioCaptureBackend>,
    sources: Box<dyn CaptureSourceEnumerator>,
    state: CaptureState,
    degraded_reason: Option<String>,
    clips_dir: PathBuf,
}

impl DefaultCaptureEngine {
    pub fn new(temp_dir: PathBuf, clips_dir: PathBuf) -> Self {
        let settings = CaptureSettings::default();
        Self {
            buffer: SegmentRingBuffer::new(temp_dir, settings.buffer_seconds, 0),
            settings,
            video: Box::new(MockVideoBackend::default()),
            audio: Box::new(MockAudioBackend::default()),
            sources: Box::new(MockSourceEnumerator),
            state: CaptureState::Idle,
            degraded_reason: None,
            clips_dir,
        }
    }

    pub fn clips_dir(&self) -> &PathBuf {
        &self.clips_dir
    }

    pub fn native_capture_available() -> bool {
        cfg!(all(windows, feature = "windows-capture"))
    }

    fn encoder_config(&self) -> EncoderConfig {
        EncoderConfig {
            codec: self.settings.codec,
            width: self.settings.width,
            height: self.settings.height,
            fps: self.settings.fps,
            bitrate_kbps: self.settings.bitrate_kbps,
            segment_ms: self.settings.segment_ms,
        }
    }

    pub fn buffer_mut(&mut self) -> &mut SegmentRingBuffer {
        &mut self.buffer
    }

    pub fn set_state(&mut self, state: CaptureState) {
        self.state = state;
    }
}

impl CaptureEngine for DefaultCaptureEngine {
    fn status(&self) -> CaptureStatus {
        CaptureStatus {
            state: self.state,
            buffer_seconds: self.settings.buffer_seconds,
            buffered_ms: self.buffer.duration_us() / 1_000,
            buffered_bytes: self.buffer.bytes(),
            settings: self.settings.clone(),
            degraded_reason: self.degraded_reason.clone(),
            native_capture_available: Self::native_capture_available(),
        }
    }

    fn settings(&self) -> CaptureSettings {
        self.settings.clone()
    }

    fn update_settings(&mut self, settings: CaptureSettings) -> Result<()> {
        if settings.buffer_seconds == 0 || settings.buffer_seconds > 300 {
            return Err(ClipCoreError::Buffer("buffer must be between 1 and 300 seconds".into()));
        }
        self.buffer.set_capacity_seconds(settings.buffer_seconds);
        self.settings = settings;
        Ok(())
    }

    fn start_buffer(&mut self) -> Result<()> {
        let source = match &self.settings.source_id {
            Some(id) => self
                .sources
                .enumerate()?
                .into_iter()
                .find(|s| &s.id == id)
                .ok_or_else(|| ClipCoreError::NotFound(format!("source {id}")))?,
            None => self.sources.primary_monitor()?,
        };
        self.video.start(&source, self.settings.fps)?;
        self.audio.start(&self.settings.audio_device_ids)?;
        if !Self::native_capture_available() {
            self.degraded_reason = Some("running with mock capture backends".into());
            self.state = CaptureState::Degraded;
        } else {
            self.degraded_reason = None;
            self.state = CaptureState::Buffering;
        }
        let _ = self.encoder_config();
        Ok(())
    }

    fn stop_buffer(&mut self) -> Result<()> {
        self.video.stop()?;
        self.audio.stop()?;
        self.state = CaptureState::Idle;
        Ok(())
    }

    fn save_retroactive(&mut self, seconds: u32) -> Result<Vec<Segment>> {
        let pinned = self.buffer.pin_last(seconds)?;
        // Capture continues while the writer consumes the pinned segments.
        self.state = CaptureState::SavingClip;
        Ok(pinned)
    }

    fn start_session(&mut self) -> Result<()> {
        if self.state == CaptureState::Idle {
            self.start_buffer()?;
        }
        self.state = CaptureState::RecordingSession;
        Ok(())
    }

    fn stop_session(&mut self) -> Result<()> {
        self.state = CaptureState::Buffering;
        Ok(())
    }

    fn pause(&mut self) -> Result<()> {
        self.state = CaptureState::Paused;
        Ok(())
    }

    fn resume(&mut self) -> Result<()> {
        self.state = CaptureState::Buffering;
        Ok(())
    }

    fn list_sources(&self) -> Result<Vec<CaptureSourceInfo>> {
        self.sources.enumerate()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn engine() -> DefaultCaptureEngine {
        DefaultCaptureEngine::new(PathBuf::from("/tmp/seg"), PathBuf::from("/tmp/clips"))
    }

    #[test]
    fn rejects_out_of_range_buffer() {
        let mut e = engine();
        let mut s = e.settings();
        s.buffer_seconds = 999;
        assert!(e.update_settings(s).is_err());
    }

    #[test]
    fn mock_build_reports_no_native_capture() {
        assert_eq!(engine().status().native_capture_available, DefaultCaptureEngine::native_capture_available());
    }
}
