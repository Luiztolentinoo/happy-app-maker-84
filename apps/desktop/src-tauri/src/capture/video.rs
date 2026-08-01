use serde::{Deserialize, Serialize};

use crate::capture::source::CaptureSourceInfo;
use crate::errors::{ClipCoreError, Result};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum VideoBackendKind {
    /// Windows.Graphics.Capture — preferred on Windows 10 1903+.
    WindowsGraphicsCapture,
    /// DXGI Desktop Duplication — fallback for older builds / exclusive fullscreen.
    DxgiDesktopDuplication,
    /// Media Foundation transform pipeline, used for some capture cards.
    MediaFoundation,
    /// Deterministic frame generator used off-Windows and in tests.
    Mock,
}

#[derive(Debug, Clone)]
pub struct VideoFrame {
    pub timestamp_us: u64,
    pub width: u32,
    pub height: u32,
    /// Opaque GPU texture handle or CPU buffer, depending on the backend.
    pub payload: FramePayload,
}

#[derive(Debug, Clone)]
pub enum FramePayload {
    GpuTexture(u64),
    Cpu(Vec<u8>),
}

/// Video acquisition backend contract. Implementations must be non-blocking on
/// `try_next_frame` so the engine can keep the buffer cadence.
pub trait VideoCaptureBackend: Send + Sync {
    fn kind(&self) -> VideoBackendKind;
    fn is_supported() -> bool
    where
        Self: Sized;
    fn start(&mut self, source: &CaptureSourceInfo, target_fps: u32) -> Result<()>;
    fn try_next_frame(&mut self) -> Result<Option<VideoFrame>>;
    fn stop(&mut self) -> Result<()>;
}

/// Chooses the best backend for the current machine, highest priority first.
pub fn preferred_backends() -> Vec<VideoBackendKind> {
    #[cfg(all(windows, feature = "windows-capture"))]
    {
        vec![
            VideoBackendKind::WindowsGraphicsCapture,
            VideoBackendKind::DxgiDesktopDuplication,
            VideoBackendKind::MediaFoundation,
        ]
    }
    #[cfg(not(all(windows, feature = "windows-capture")))]
    {
        vec![VideoBackendKind::Mock]
    }
}

/// Mock backend: emits synthetic frames at the requested cadence.
pub struct MockVideoBackend {
    fps: u32,
    frame: u64,
    running: bool,
    size: (u32, u32),
}

impl Default for MockVideoBackend {
    fn default() -> Self {
        Self { fps: 60, frame: 0, running: false, size: (1920, 1080) }
    }
}

impl VideoCaptureBackend for MockVideoBackend {
    fn kind(&self) -> VideoBackendKind {
        VideoBackendKind::Mock
    }

    fn is_supported() -> bool {
        true
    }

    fn start(&mut self, source: &CaptureSourceInfo, target_fps: u32) -> Result<()> {
        self.size = (source.width, source.height);
        self.fps = target_fps.max(1);
        self.frame = 0;
        self.running = true;
        Ok(())
    }

    fn try_next_frame(&mut self) -> Result<Option<VideoFrame>> {
        if !self.running {
            return Err(ClipCoreError::BackendUnavailable("mock backend not started".into()));
        }
        self.frame += 1;
        Ok(Some(VideoFrame {
            timestamp_us: self.frame * 1_000_000 / self.fps as u64,
            width: self.size.0,
            height: self.size.1,
            payload: FramePayload::GpuTexture(self.frame),
        }))
    }

    fn stop(&mut self) -> Result<()> {
        self.running = false;
        Ok(())
    }
}

/// Real Windows adapters live behind the `windows-capture` feature flag. They
/// are compiled only on Windows with the Windows SDK available.
#[cfg(all(windows, feature = "windows-capture"))]
pub mod windows_adapters {
    use super::*;

    pub struct GraphicsCaptureBackend;
    impl VideoCaptureBackend for GraphicsCaptureBackend {
        fn kind(&self) -> VideoBackendKind {
            VideoBackendKind::WindowsGraphicsCapture
        }
        fn is_supported() -> bool {
            true
        }
        fn start(&mut self, _source: &CaptureSourceInfo, _fps: u32) -> Result<()> {
            Err(ClipCoreError::NotImplemented("Windows.Graphics.Capture start".into()))
        }
        fn try_next_frame(&mut self) -> Result<Option<VideoFrame>> {
            Err(ClipCoreError::NotImplemented("Windows.Graphics.Capture frame".into()))
        }
        fn stop(&mut self) -> Result<()> {
            Ok(())
        }
    }

    pub struct DxgiDuplicationBackend;
    impl VideoCaptureBackend for DxgiDuplicationBackend {
        fn kind(&self) -> VideoBackendKind {
            VideoBackendKind::DxgiDesktopDuplication
        }
        fn is_supported() -> bool {
            true
        }
        fn start(&mut self, _source: &CaptureSourceInfo, _fps: u32) -> Result<()> {
            Err(ClipCoreError::NotImplemented("DXGI duplication start".into()))
        }
        fn try_next_frame(&mut self) -> Result<Option<VideoFrame>> {
            Err(ClipCoreError::NotImplemented("DXGI duplication frame".into()))
        }
        fn stop(&mut self) -> Result<()> {
            Ok(())
        }
    }
}
