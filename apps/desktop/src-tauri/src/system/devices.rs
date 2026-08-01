use crate::capture::audio::{AudioCaptureBackend, AudioDeviceInfo, MockAudioBackend};
use crate::capture::source::{CaptureSourceEnumerator, CaptureSourceInfo, MockSourceEnumerator};
use crate::errors::Result;

/// Aggregates monitor/window and audio device enumeration for the settings UI.
pub trait DeviceManager: Send + Sync {
    fn video_sources(&self) -> Result<Vec<CaptureSourceInfo>>;
    fn audio_devices(&self) -> Result<Vec<AudioDeviceInfo>>;
}

pub struct SystemDeviceManager;

impl DeviceManager for SystemDeviceManager {
    fn video_sources(&self) -> Result<Vec<CaptureSourceInfo>> {
        MockSourceEnumerator.enumerate()
    }

    fn audio_devices(&self) -> Result<Vec<AudioDeviceInfo>> {
        MockAudioBackend::default().enumerate()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lists_mock_devices() {
        let m = SystemDeviceManager;
        assert!(!m.video_sources().unwrap().is_empty());
        assert_eq!(m.audio_devices().unwrap().len(), 2);
    }
}
