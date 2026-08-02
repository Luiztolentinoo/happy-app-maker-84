//! Bounded work queues for recording finalisation, exports and thumbnails.
//!
//! The queue is transport-agnostic: jobs are opaque descriptors, and the caller
//! supplies the worker. This keeps FFmpeg, SQLite and the capture engine
//! decoupled from scheduling policy.

use std::collections::VecDeque;
use std::sync::Arc;

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};

use crate::errors::Result;
use crate::runtime::event_bus::{EngineEvent, EventBus};
use crate::runtime::metrics::{names, MetricsRegistry};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum QueueId {
    Recording,
    Export,
    Thumbnail,
}

impl QueueId {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Recording => "recording",
            Self::Export => "export",
            Self::Thumbnail => "thumbnail",
        }
    }

    /// Concurrency chosen per queue: recording finalisation is serialised to
    /// protect disk throughput, thumbnails can fan out.
    pub fn default_concurrency(&self) -> usize {
        match self {
            Self::Recording => 1,
            Self::Export => 2,
            Self::Thumbnail => 3,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum JobStatus {
    Queued,
    Running,
    Done,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Job {
    pub id: String,
    /// Higher runs first.
    pub priority: i32,
    pub payload: String,
    pub status: JobStatus,
    pub attempts: u32,
    pub error: Option<String>,
}

impl Job {
    pub fn new(id: impl Into<String>, payload: impl Into<String>, priority: i32) -> Self {
        Self {
            id: id.into(),
            priority,
            payload: payload.into(),
            status: JobStatus::Queued,
            attempts: 0,
            error: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueSnapshot {
    pub queue: String,
    pub queued: usize,
    pub running: usize,
    pub done: usize,
    pub failed: usize,
}

#[derive(Default)]
struct QueueInner {
    pending: VecDeque<Job>,
    running: Vec<Job>,
    done: usize,
    failed: Vec<Job>,
}

/// Priority work queue with retries. `drain` is synchronous and deterministic so
/// it can be unit-tested; the engine drives it from a worker thread.
pub struct WorkQueue {
    id: QueueId,
    concurrency: usize,
    max_attempts: u32,
    inner: Arc<Mutex<QueueInner>>,
    bus: EventBus,
    metrics: MetricsRegistry,
}

impl WorkQueue {
    pub fn new(id: QueueId, bus: EventBus, metrics: MetricsRegistry) -> Self {
        Self {
            concurrency: id.default_concurrency(),
            id,
            max_attempts: 3,
            inner: Arc::new(Mutex::new(QueueInner::default())),
            bus,
            metrics,
        }
    }

    pub fn with_max_attempts(mut self, attempts: u32) -> Self {
        self.max_attempts = attempts.max(1);
        self
    }

    pub fn id(&self) -> QueueId {
        self.id
    }

    pub fn concurrency(&self) -> usize {
        self.concurrency
    }

    pub fn enqueue(&self, job: Job) {
        {
            let mut inner = self.inner.lock();
            inner.pending.push_back(job);
            let mut sorted: Vec<Job> = inner.pending.drain(..).collect();
            sorted.sort_by(|a, b| b.priority.cmp(&a.priority));
            inner.pending = sorted.into();
        }
        self.publish();
    }

    pub fn snapshot(&self) -> QueueSnapshot {
        let inner = self.inner.lock();
        QueueSnapshot {
            queue: self.id.as_str().to_string(),
            queued: inner.pending.len(),
            running: inner.running.len(),
            done: inner.done,
            failed: inner.failed.len(),
        }
    }

    pub fn failed_jobs(&self) -> Vec<Job> {
        self.inner.lock().failed.clone()
    }

    /// Runs pending jobs through `worker` honouring concurrency as a batch size.
    /// Failed jobs are re-queued until `max_attempts` is reached.
    pub fn drain<F>(&self, worker: F)
    where
        F: Fn(&Job) -> Result<()>,
    {
        loop {
            let batch: Vec<Job> = {
                let mut inner = self.inner.lock();
                let take = self.concurrency.min(inner.pending.len());
                if take == 0 {
                    break;
                }
                let batch: Vec<Job> = inner.pending.drain(0..take).collect();
                for job in &batch {
                    let mut running = job.clone();
                    running.status = JobStatus::Running;
                    inner.running.push(running);
                }
                batch
            };

            for mut job in batch {
                job.attempts += 1;
                let outcome = worker(&job);
                let mut inner = self.inner.lock();
                inner.running.retain(|running| running.id != job.id);
                match outcome {
                    Ok(()) => {
                        inner.done += 1;
                    }
                    Err(error) => {
                        job.error = Some(error.to_string());
                        if job.attempts < self.max_attempts {
                            job.status = JobStatus::Queued;
                            inner.pending.push_back(job);
                        } else {
                            job.status = JobStatus::Failed;
                            inner.failed.push(job);
                            self.metrics.increment(names::QUEUE_FAILURES, 1);
                        }
                    }
                }
            }
            self.publish();
        }
        self.publish();
    }

    fn publish(&self) {
        let snapshot = self.snapshot();
        self.metrics.gauge(
            &format!("{}.{}", names::QUEUE_DEPTH, self.id.as_str()),
            snapshot.queued as f64,
        );
        self.bus.publish(EngineEvent::QueueChanged {
            queue: snapshot.queue.clone(),
            queued: snapshot.queued,
            running: snapshot.running,
            failed: snapshot.failed,
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::errors::ClipCoreError;
    use std::sync::atomic::{AtomicUsize, Ordering};

    fn queue(id: QueueId) -> WorkQueue {
        WorkQueue::new(id, EventBus::new(), MetricsRegistry::new(16))
    }

    #[test]
    fn runs_jobs_in_priority_order() {
        let queue = queue(QueueId::Export);
        queue.enqueue(Job::new("low", "a", 0));
        queue.enqueue(Job::new("high", "b", 10));
        let order = Arc::new(Mutex::new(Vec::new()));
        let sink = order.clone();
        queue.drain(move |job| {
            sink.lock().push(job.id.clone());
            Ok(())
        });
        assert_eq!(*order.lock(), vec!["high".to_string(), "low".to_string()]);
        assert_eq!(queue.snapshot().done, 2);
    }

    #[test]
    fn retries_then_marks_failed() {
        let queue = queue(QueueId::Thumbnail).with_max_attempts(2);
        queue.enqueue(Job::new("thumb", "clip.mp4", 0));
        let calls = Arc::new(AtomicUsize::new(0));
        let counter = calls.clone();
        queue.drain(move |_| {
            counter.fetch_add(1, Ordering::SeqCst);
            Err(ClipCoreError::Internal("ffmpeg indisponível".into()))
        });
        assert_eq!(calls.load(Ordering::SeqCst), 2);
        let snapshot = queue.snapshot();
        assert_eq!(snapshot.failed, 1);
        assert_eq!(snapshot.queued, 0);
        assert!(queue.failed_jobs()[0].error.is_some());
    }

    #[test]
    fn recording_queue_is_serialised() {
        assert_eq!(queue(QueueId::Recording).concurrency(), 1);
        assert_eq!(QueueId::Thumbnail.default_concurrency(), 3);
    }
}
