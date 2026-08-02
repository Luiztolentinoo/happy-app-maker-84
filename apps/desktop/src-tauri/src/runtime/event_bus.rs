//! In-process event bus.
//!
//! Subsystems publish `EngineEvent`s instead of calling each other. A single
//! forwarder subscribes and re-emits to the frontend through Tauri, so the
//! engine core stays testable without a running window.

use std::sync::Arc;

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};

use crate::capture::state_machine::CaptureState;

/// Subsystems tracked by the watchdog and the diagnostics screen.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SubsystemId {
    GameDetector,
    CaptureEngine,
    CircularBuffer,
    Encoder,
    Hotkeys,
    AudioEngine,
    Storage,
    Recovery,
    PerformanceMonitor,
    Diagnostics,
}

impl SubsystemId {
    pub const ALL: [SubsystemId; 10] = [
        SubsystemId::GameDetector,
        SubsystemId::CaptureEngine,
        SubsystemId::CircularBuffer,
        SubsystemId::Encoder,
        SubsystemId::Hotkeys,
        SubsystemId::AudioEngine,
        SubsystemId::Storage,
        SubsystemId::Recovery,
        SubsystemId::PerformanceMonitor,
        SubsystemId::Diagnostics,
    ];

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::GameDetector => "game_detector",
            Self::CaptureEngine => "capture_engine",
            Self::CircularBuffer => "circular_buffer",
            Self::Encoder => "encoder",
            Self::Hotkeys => "hotkeys",
            Self::AudioEngine => "audio_engine",
            Self::Storage => "storage",
            Self::Recovery => "recovery",
            Self::PerformanceMonitor => "performance_monitor",
            Self::Diagnostics => "diagnostics",
        }
    }
}

/// Every event the engine can publish. Payloads mirror `EngineEvents` in
/// `src/engine/eventBus.ts`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum EngineEvent {
    CaptureState { state: CaptureState, degraded_reason: Option<String> },
    ClipSaved { id: String, path: String, duration_ms: u64 },
    BufferEvicted { segments: u32, bytes: u64 },
    GameDetected { name: Option<String> },
    EncoderFallback { from: String, to: String, reason: String },
    StorageWarning { message: String, free_bytes: u64 },
    PerformanceSample { cpu_percent: f32, gpu_percent: f32, memory_mb: u64, fps: u32, encode_lag_ms: u32 },
    PerformanceDegraded { reason: String },
    PerformanceRecovered,
    QueueChanged { queue: String, queued: usize, running: usize, failed: usize },
    RecoveryCompleted { recovered: usize, discarded: usize },
    WatchdogStalled { subsystem: SubsystemId, since_ms: u64 },
    WatchdogRestarted { subsystem: SubsystemId, attempt: u32 },
    SubsystemStatus { subsystem: SubsystemId, health: String, detail: String },
}

impl EngineEvent {
    /// Stable name used for the Tauri channel and for log lines.
    pub fn name(&self) -> &'static str {
        match self {
            Self::CaptureState { .. } => "capture:state",
            Self::ClipSaved { .. } => "capture:clip-saved",
            Self::BufferEvicted { .. } => "buffer:evicted",
            Self::GameDetected { .. } => "game:detected",
            Self::EncoderFallback { .. } => "encoder:fallback",
            Self::StorageWarning { .. } => "storage:warning",
            Self::PerformanceSample { .. } => "performance:sample",
            Self::PerformanceDegraded { .. } => "performance:degraded",
            Self::PerformanceRecovered => "performance:recovered",
            Self::QueueChanged { .. } => "queue:changed",
            Self::RecoveryCompleted { .. } => "recovery:completed",
            Self::WatchdogStalled { .. } => "watchdog:stalled",
            Self::WatchdogRestarted { .. } => "watchdog:restarted",
            Self::SubsystemStatus { .. } => "subsystem:status",
        }
    }
}

type Subscriber = Arc<dyn Fn(&EngineEvent) + Send + Sync>;

/// Cloneable, lock-free-on-read event bus.
#[derive(Clone, Default)]
pub struct EventBus {
    subscribers: Arc<RwLock<Vec<Subscriber>>>,
}

impl EventBus {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn subscribe<F>(&self, handler: F)
    where
        F: Fn(&EngineEvent) + Send + Sync + 'static,
    {
        self.subscribers.write().push(Arc::new(handler));
    }

    pub fn subscriber_count(&self) -> usize {
        self.subscribers.read().len()
    }

    /// Publishes to every subscriber. A panicking subscriber must never take
    /// the capture pipeline down, so each call is isolated.
    pub fn publish(&self, event: EngineEvent) {
        let subscribers = self.subscribers.read().clone();
        for subscriber in subscribers {
            let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| subscriber(&event)));
            if result.is_err() {
                tracing::warn!("event subscriber panicked on {}", event.name());
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    #[test]
    fn delivers_to_every_subscriber() {
        let bus = EventBus::new();
        let hits = Arc::new(AtomicUsize::new(0));
        for _ in 0..3 {
            let hits = hits.clone();
            bus.subscribe(move |_| {
                hits.fetch_add(1, Ordering::SeqCst);
            });
        }
        bus.publish(EngineEvent::PerformanceRecovered);
        assert_eq!(hits.load(Ordering::SeqCst), 3);
        assert_eq!(bus.subscriber_count(), 3);
    }

    #[test]
    fn event_names_are_stable() {
        assert_eq!(EngineEvent::PerformanceRecovered.name(), "performance:recovered");
        assert_eq!(SubsystemId::CaptureEngine.as_str(), "capture_engine");
        assert_eq!(SubsystemId::ALL.len(), 10);
    }
}
