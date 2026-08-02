//! Runtime services shared by every capture subsystem: event bus, metrics,
//! logging, work queues and watchdog.
//!
//! These modules have no knowledge of Windows, Tauri or SQLite; the capture,
//! system and media layers depend on them, never the other way around. The
//! TypeScript layer mirrors the same primitives in `src/engine` so both sides
//! observe the pipeline with identical vocabulary.
pub mod event_bus;
pub mod logging;
pub mod metrics;
pub mod queue;
pub mod watchdog;

pub use event_bus::{EngineEvent, EventBus, SubsystemId};
pub use metrics::{MetricsRegistry, MetricsSnapshot};
pub use queue::{JobStatus, QueueId, QueueSnapshot, WorkQueue};
pub use watchdog::{SubsystemHealth, SubsystemStatus, Watchdog};
