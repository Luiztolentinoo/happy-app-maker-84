//! Heartbeat watchdog. Subsystems check in periodically; when one goes silent
//! past its deadline the watchdog marks it stalled and asks the owner to
//! restart it, up to a bounded number of attempts.

use std::collections::HashMap;
use std::sync::Arc;

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};

use crate::runtime::event_bus::{EngineEvent, EventBus, SubsystemId};
use crate::runtime::metrics::{names, MetricsRegistry};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SubsystemHealth {
    Ok,
    Degraded,
    Stalled,
    Failed,
    Unavailable,
}

impl SubsystemHealth {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Ok => "ok",
            Self::Degraded => "degraded",
            Self::Stalled => "stalled",
            Self::Failed => "failed",
            Self::Unavailable => "unavailable",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubsystemStatus {
    pub subsystem: SubsystemId,
    pub health: SubsystemHealth,
    pub detail: String,
    pub last_beat_ms: u64,
    pub restarts: u32,
}

#[derive(Debug, Clone)]
struct Tracked {
    health: SubsystemHealth,
    detail: String,
    last_beat_ms: u64,
    restarts: u32,
    supervised: bool,
}

/// Watchdog over registered subsystems. `tick` is pure with respect to the
/// injected clock, which makes the restart policy testable.
pub struct Watchdog {
    timeout_ms: u64,
    max_restarts: u32,
    tracked: Arc<Mutex<HashMap<SubsystemId, Tracked>>>,
    bus: EventBus,
    metrics: MetricsRegistry,
}

impl Watchdog {
    pub fn new(timeout_ms: u64, max_restarts: u32, bus: EventBus, metrics: MetricsRegistry) -> Self {
        Self {
            timeout_ms: timeout_ms.max(250),
            max_restarts,
            tracked: Arc::new(Mutex::new(HashMap::new())),
            bus,
            metrics,
        }
    }

    /// Registers a subsystem. `supervised` subsystems are eligible for restart.
    pub fn register(&self, subsystem: SubsystemId, now_ms: u64, supervised: bool) {
        self.tracked.lock().insert(
            subsystem,
            Tracked {
                health: SubsystemHealth::Ok,
                detail: String::new(),
                last_beat_ms: now_ms,
                restarts: 0,
                supervised,
            },
        );
        self.publish(subsystem, SubsystemHealth::Ok, "");
    }

    pub fn heartbeat(&self, subsystem: SubsystemId, now_ms: u64, detail: impl Into<String>) {
        let detail = detail.into();
        let mut tracked = self.tracked.lock();
        if let Some(entry) = tracked.get_mut(&subsystem) {
            entry.last_beat_ms = now_ms;
            entry.detail = detail.clone();
            if entry.health != SubsystemHealth::Failed {
                entry.health = SubsystemHealth::Ok;
            }
        }
        drop(tracked);
        self.publish(subsystem, self.health_of(subsystem), detail);
    }

    pub fn degrade(&self, subsystem: SubsystemId, reason: impl Into<String>) {
        let reason = reason.into();
        if let Some(entry) = self.tracked.lock().get_mut(&subsystem) {
            entry.health = SubsystemHealth::Degraded;
            entry.detail = reason.clone();
        }
        self.publish(subsystem, SubsystemHealth::Degraded, reason);
    }

    pub fn health_of(&self, subsystem: SubsystemId) -> SubsystemHealth {
        self.tracked
            .lock()
            .get(&subsystem)
            .map(|entry| entry.health)
            .unwrap_or(SubsystemHealth::Unavailable)
    }

    /// Full status list, including subsystems that never registered.
    pub fn status(&self) -> Vec<SubsystemStatus> {
        let tracked = self.tracked.lock();
        SubsystemId::ALL
            .iter()
            .map(|subsystem| match tracked.get(subsystem) {
                Some(entry) => SubsystemStatus {
                    subsystem: *subsystem,
                    health: entry.health,
                    detail: entry.detail.clone(),
                    last_beat_ms: entry.last_beat_ms,
                    restarts: entry.restarts,
                },
                None => SubsystemStatus {
                    subsystem: *subsystem,
                    health: SubsystemHealth::Unavailable,
                    detail: "não registrado".into(),
                    last_beat_ms: 0,
                    restarts: 0,
                },
            })
            .collect()
    }

    /// Returns the subsystems that must be restarted by the caller. The caller
    /// performs the restart (the watchdog owns no subsystem handles) and then
    /// sends a heartbeat on success.
    pub fn tick(&self, now_ms: u64) -> Vec<SubsystemId> {
        let mut to_restart = Vec::new();
        let mut stalled = Vec::new();
        let mut exhausted = Vec::new();

        {
            let mut tracked = self.tracked.lock();
            for (subsystem, entry) in tracked.iter_mut() {
                if entry.health == SubsystemHealth::Failed || !entry.supervised {
                    continue;
                }
                let since = now_ms.saturating_sub(entry.last_beat_ms);
                if since <= self.timeout_ms {
                    continue;
                }
                if entry.restarts >= self.max_restarts {
                    entry.health = SubsystemHealth::Failed;
                    entry.detail = "limite de reinícios atingido".into();
                    exhausted.push(*subsystem);
                    continue;
                }
                entry.health = SubsystemHealth::Stalled;
                entry.restarts += 1;
                entry.last_beat_ms = now_ms;
                stalled.push((*subsystem, since, entry.restarts));
                to_restart.push(*subsystem);
            }
        }

        for (subsystem, since, attempt) in stalled {
            self.metrics.increment(names::WATCHDOG_RESTARTS, 1);
            self.bus.publish(EngineEvent::WatchdogStalled { subsystem, since_ms: since });
            self.bus.publish(EngineEvent::WatchdogRestarted { subsystem, attempt });
        }
        for subsystem in exhausted {
            self.publish(subsystem, SubsystemHealth::Failed, "limite de reinícios atingido");
        }
        to_restart
    }

    fn publish(&self, subsystem: SubsystemId, health: SubsystemHealth, detail: impl Into<String>) {
        self.bus.publish(EngineEvent::SubsystemStatus {
            subsystem,
            health: health.as_str().to_string(),
            detail: detail.into(),
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn watchdog(max_restarts: u32) -> Watchdog {
        Watchdog::new(1_000, max_restarts, EventBus::new(), MetricsRegistry::new(16))
    }

    #[test]
    fn unregistered_subsystems_are_unavailable() {
        let dog = watchdog(3);
        assert_eq!(dog.health_of(SubsystemId::Encoder), SubsystemHealth::Unavailable);
        dog.register(SubsystemId::Encoder, 0, true);
        assert_eq!(dog.health_of(SubsystemId::Encoder), SubsystemHealth::Ok);
        assert_eq!(dog.status().len(), 10);
    }

    #[test]
    fn restarts_stalled_subsystems_then_gives_up() {
        let dog = watchdog(1);
        dog.register(SubsystemId::CaptureEngine, 0, true);
        assert!(dog.tick(500).is_empty());
        assert_eq!(dog.tick(5_000), vec![SubsystemId::CaptureEngine]);
        assert!(dog.tick(20_000).is_empty());
        assert_eq!(dog.health_of(SubsystemId::CaptureEngine), SubsystemHealth::Failed);
    }

    #[test]
    fn unsupervised_subsystems_are_never_restarted() {
        let dog = watchdog(3);
        dog.register(SubsystemId::Diagnostics, 0, false);
        assert!(dog.tick(60_000).is_empty());
    }

    #[test]
    fn heartbeat_clears_degraded() {
        let dog = watchdog(3);
        dog.register(SubsystemId::Storage, 0, true);
        dog.degrade(SubsystemId::Storage, "disco quase cheio");
        assert_eq!(dog.health_of(SubsystemId::Storage), SubsystemHealth::Degraded);
        dog.heartbeat(SubsystemId::Storage, 10, "ok");
        assert_eq!(dog.health_of(SubsystemId::Storage), SubsystemHealth::Ok);
    }
}
