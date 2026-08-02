//! Counters, gauges and histograms for the capture pipeline.

use std::collections::HashMap;
use std::sync::Arc;

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};

/// Canonical metric names, shared with `METRICS` in `src/engine/metrics.ts`.
pub mod names {
    pub const CLIPS_SAVED: &str = "capture.clips_saved";
    pub const BUFFER_EVICTIONS: &str = "buffer.evictions";
    pub const BUFFER_BYTES: &str = "buffer.bytes";
    pub const ENCODER_FALLBACKS: &str = "encoder.fallbacks";
    pub const DROPPED_FRAMES: &str = "capture.dropped_frames";
    pub const ENCODE_LAG_MS: &str = "encoder.lag_ms";
    pub const FPS: &str = "capture.fps";
    pub const GPU_PERCENT: &str = "system.gpu_percent";
    pub const CPU_PERCENT: &str = "system.cpu_percent";
    pub const MEMORY_MB: &str = "system.memory_mb";
    pub const QUEUE_DEPTH: &str = "queue.depth";
    pub const QUEUE_FAILURES: &str = "queue.failures";
    pub const WATCHDOG_RESTARTS: &str = "watchdog.restarts";
    pub const RECOVERY_RECOVERED: &str = "recovery.recovered";
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistogramSnapshot {
    pub count: usize,
    pub min: f64,
    pub max: f64,
    pub avg: f64,
    pub p95: f64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct MetricsSnapshot {
    pub counters: HashMap<String, u64>,
    pub gauges: HashMap<String, f64>,
    pub histograms: HashMap<String, HistogramSnapshot>,
}

#[derive(Default)]
struct Inner {
    counters: HashMap<String, u64>,
    gauges: HashMap<String, f64>,
    samples: HashMap<String, Vec<f64>>,
}

/// Cloneable handle to a shared registry.
#[derive(Clone, Default)]
pub struct MetricsRegistry {
    inner: Arc<RwLock<Inner>>,
    window: usize,
}

impl MetricsRegistry {
    pub fn new(window: usize) -> Self {
        Self { inner: Arc::new(RwLock::new(Inner::default())), window: window.max(1) }
    }

    pub fn increment(&self, name: &str, by: u64) {
        let mut inner = self.inner.write();
        *inner.counters.entry(name.to_string()).or_insert(0) += by;
    }

    pub fn gauge(&self, name: &str, value: f64) {
        self.inner.write().gauges.insert(name.to_string(), value);
    }

    pub fn observe(&self, name: &str, value: f64) {
        let window = if self.window == 0 { 120 } else { self.window };
        let mut inner = self.inner.write();
        let entry = inner.samples.entry(name.to_string()).or_default();
        entry.push(value);
        if entry.len() > window {
            let excess = entry.len() - window;
            entry.drain(0..excess);
        }
    }

    pub fn counter(&self, name: &str) -> u64 {
        self.inner.read().counters.get(name).copied().unwrap_or(0)
    }

    pub fn gauge_value(&self, name: &str) -> Option<f64> {
        self.inner.read().gauges.get(name).copied()
    }

    pub fn histogram(&self, name: &str) -> Option<HistogramSnapshot> {
        let inner = self.inner.read();
        let samples = inner.samples.get(name)?;
        if samples.is_empty() {
            return None;
        }
        let mut sorted = samples.clone();
        sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        let index = ((sorted.len() as f64) * 0.95).floor() as usize;
        let index = index.min(sorted.len() - 1);
        Some(HistogramSnapshot {
            count: sorted.len(),
            min: sorted[0],
            max: sorted[sorted.len() - 1],
            avg: sorted.iter().sum::<f64>() / sorted.len() as f64,
            p95: sorted[index],
        })
    }

    pub fn snapshot(&self) -> MetricsSnapshot {
        let names: Vec<String> = self.inner.read().samples.keys().cloned().collect();
        let mut histograms = HashMap::new();
        for name in names {
            if let Some(value) = self.histogram(&name) {
                histograms.insert(name, value);
            }
        }
        let inner = self.inner.read();
        MetricsSnapshot { counters: inner.counters.clone(), gauges: inner.gauges.clone(), histograms }
    }

    pub fn reset(&self) {
        let mut inner = self.inner.write();
        inner.counters.clear();
        inner.gauges.clear();
        inner.samples.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tracks_counters_and_gauges() {
        let metrics = MetricsRegistry::new(10);
        metrics.increment(names::CLIPS_SAVED, 2);
        metrics.increment(names::CLIPS_SAVED, 1);
        metrics.gauge(names::FPS, 59.0);
        assert_eq!(metrics.counter(names::CLIPS_SAVED), 3);
        assert_eq!(metrics.gauge_value(names::FPS), Some(59.0));
    }

    #[test]
    fn histogram_respects_window() {
        let metrics = MetricsRegistry::new(2);
        for value in [1.0, 2.0, 3.0] {
            metrics.observe(names::ENCODE_LAG_MS, value);
        }
        let hist = metrics.histogram(names::ENCODE_LAG_MS).expect("histogram");
        assert_eq!(hist.count, 2);
        assert_eq!(hist.min, 2.0);
        assert_eq!(hist.max, 3.0);
    }

    #[test]
    fn snapshot_contains_all_families() {
        let metrics = MetricsRegistry::new(4);
        metrics.increment(names::BUFFER_EVICTIONS, 1);
        metrics.gauge(names::GPU_PERCENT, 42.0);
        metrics.observe(names::ENCODE_LAG_MS, 10.0);
        let snapshot = metrics.snapshot();
        assert_eq!(snapshot.counters.len(), 1);
        assert_eq!(snapshot.gauges.len(), 1);
        assert_eq!(snapshot.histograms.len(), 1);
    }
}
