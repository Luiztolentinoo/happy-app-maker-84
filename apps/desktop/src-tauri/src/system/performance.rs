use serde::{Deserialize, Serialize};

use crate::errors::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceSample {
    pub cpu_percent: f32,
    pub gpu_percent: f32,
    pub memory_mb: u64,
    pub dropped_frames: u64,
    pub encode_lag_ms: u32,
}

/// Watches capture cost so the engine can degrade instead of stuttering games.
pub trait PerformanceMonitor: Send + Sync {
    fn sample(&self) -> Result<PerformanceSample>;
    /// Returns Some(reason) when the pipeline should move to `Degraded`.
    fn should_degrade(&self, sample: &PerformanceSample) -> Option<String>;
}

pub struct DefaultPerformanceMonitor {
    pub max_dropped_frames: u64,
    pub max_encode_lag_ms: u32,
}

impl Default for DefaultPerformanceMonitor {
    fn default() -> Self {
        Self { max_dropped_frames: 30, max_encode_lag_ms: 250 }
    }
}

impl PerformanceMonitor for DefaultPerformanceMonitor {
    fn sample(&self) -> Result<PerformanceSample> {
        Ok(PerformanceSample {
            cpu_percent: 0.0,
            gpu_percent: 0.0,
            memory_mb: 0,
            dropped_frames: 0,
            encode_lag_ms: 0,
        })
    }

    fn should_degrade(&self, sample: &PerformanceSample) -> Option<String> {
        if sample.dropped_frames > self.max_dropped_frames {
            return Some(format!("{} dropped frames", sample.dropped_frames));
        }
        if sample.encode_lag_ms > self.max_encode_lag_ms {
            return Some(format!("encoder lag {}ms", sample.encode_lag_ms));
        }
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn flags_dropped_frames() {
        let m = DefaultPerformanceMonitor::default();
        let s = PerformanceSample { cpu_percent: 0.0, gpu_percent: 0.0, memory_mb: 0, dropped_frames: 500, encode_lag_ms: 0 };
        assert!(m.should_degrade(&s).is_some());
        assert!(m.should_degrade(&m.sample().unwrap()).is_none());
    }
}
