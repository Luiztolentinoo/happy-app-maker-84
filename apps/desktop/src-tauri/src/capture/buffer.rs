use std::collections::VecDeque;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::errors::{ClipCoreError, Result};

/// One encoded segment on disk. Segments always start on a keyframe so the
/// writer can concatenate without re-encoding.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Segment {
    pub id: u64,
    pub path: PathBuf,
    pub start_us: u64,
    pub duration_us: u64,
    pub bytes: u64,
    /// Pinned segments are never evicted while a save is in flight.
    pub pinned: bool,
}

/// Circular buffer contract over encoded segments.
pub trait CircularBuffer: Send + Sync {
    fn push(&mut self, segment: Segment) -> Result<Vec<Segment>>;
    /// Pins and returns the segments covering the last `seconds`.
    fn pin_last(&mut self, seconds: u32) -> Result<Vec<Segment>>;
    fn unpin(&mut self, ids: &[u64]) -> Result<()>;
    fn duration_us(&self) -> u64;
    fn bytes(&self) -> u64;
    fn segments(&self) -> Vec<Segment>;
}

/// Segment-based ring buffer. Eviction returns the removed segments so the
/// caller deletes files outside the lock.
#[derive(Debug)]
pub struct SegmentRingBuffer {
    segments: VecDeque<Segment>,
    capacity_us: u64,
    max_bytes: u64,
    dir: PathBuf,
    next_id: u64,
}

impl SegmentRingBuffer {
    pub fn new(dir: impl Into<PathBuf>, capacity_seconds: u32, max_bytes: u64) -> Self {
        Self {
            segments: VecDeque::new(),
            capacity_us: capacity_seconds as u64 * 1_000_000,
            max_bytes,
            dir: dir.into(),
            next_id: 1,
        }
    }

    pub fn dir(&self) -> &Path {
        &self.dir
    }

    pub fn set_capacity_seconds(&mut self, seconds: u32) {
        self.capacity_us = seconds as u64 * 1_000_000;
    }

    pub fn next_segment_id(&mut self) -> u64 {
        let id = self.next_id;
        self.next_id += 1;
        id
    }

    /// Fails early when the target device cannot hold another segment.
    pub fn ensure_space(&self, free_bytes: u64, needed_bytes: u64) -> Result<()> {
        if free_bytes < needed_bytes {
            return Err(ClipCoreError::DiskFull { needed_bytes, free_bytes });
        }
        Ok(())
    }

    fn evict(&mut self) -> Vec<Segment> {
        let mut removed = Vec::new();
        loop {
            let over_time = self.duration_us() > self.capacity_us;
            let over_bytes = self.max_bytes > 0 && self.bytes() > self.max_bytes;
            if !over_time && !over_bytes {
                break;
            }
            // Find the oldest unpinned segment; stop when everything is pinned.
            let idx = self.segments.iter().position(|s| !s.pinned);
            match idx {
                Some(i) => removed.push(self.segments.remove(i).expect("index in range")),
                None => break,
            }
        }
        removed
    }
}

impl CircularBuffer for SegmentRingBuffer {
    fn push(&mut self, segment: Segment) -> Result<Vec<Segment>> {
        self.segments.push_back(segment);
        Ok(self.evict())
    }

    fn pin_last(&mut self, seconds: u32) -> Result<Vec<Segment>> {
        if self.segments.is_empty() {
            return Err(ClipCoreError::Buffer("buffer is empty".into()));
        }
        let window_us = seconds as u64 * 1_000_000;
        let end = self.segments.back().map(|s| s.start_us + s.duration_us).unwrap_or(0);
        let start = end.saturating_sub(window_us);
        let mut picked = Vec::new();
        for segment in self.segments.iter_mut() {
            if segment.start_us + segment.duration_us > start {
                segment.pinned = true;
                picked.push(segment.clone());
            }
        }
        if picked.is_empty() {
            return Err(ClipCoreError::Buffer("no segments in requested window".into()));
        }
        Ok(picked)
    }

    fn unpin(&mut self, ids: &[u64]) -> Result<()> {
        for segment in self.segments.iter_mut() {
            if ids.contains(&segment.id) {
                segment.pinned = false;
            }
        }
        let _ = self.evict();
        Ok(())
    }

    fn duration_us(&self) -> u64 {
        self.segments.iter().map(|s| s.duration_us).sum()
    }

    fn bytes(&self) -> u64 {
        self.segments.iter().map(|s| s.bytes).sum()
    }

    fn segments(&self) -> Vec<Segment> {
        self.segments.iter().cloned().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn seg(id: u64, start_s: u64) -> Segment {
        Segment {
            id,
            path: PathBuf::from(format!("seg-{id}.mp4")),
            start_us: start_s * 1_000_000,
            duration_us: 1_000_000,
            bytes: 1_000,
            pinned: false,
        }
    }

    #[test]
    fn evicts_oldest_beyond_capacity() {
        let mut buf = SegmentRingBuffer::new("/tmp", 3, 0);
        for i in 0..5 {
            buf.push(seg(i + 1, i)).unwrap();
        }
        assert_eq!(buf.segments().len(), 3);
        assert_eq!(buf.segments().first().unwrap().id, 3);
    }

    #[test]
    fn respects_byte_ceiling() {
        let mut buf = SegmentRingBuffer::new("/tmp", 600, 2_000);
        for i in 0..5 {
            buf.push(seg(i + 1, i)).unwrap();
        }
        assert!(buf.bytes() <= 2_000);
    }

    #[test]
    fn pinned_segments_survive_eviction_and_recording_continues() {
        let mut buf = SegmentRingBuffer::new("/tmp", 3, 0);
        for i in 0..3 {
            buf.push(seg(i + 1, i)).unwrap();
        }
        let pinned = buf.pin_last(3).unwrap();
        assert_eq!(pinned.len(), 3);
        // Keep pushing while the save is in flight.
        for i in 3..8 {
            buf.push(seg(i + 1, i)).unwrap();
        }
        assert!(buf.segments().iter().any(|s| s.id == 1));
        let ids: Vec<u64> = pinned.iter().map(|s| s.id).collect();
        buf.unpin(&ids).unwrap();
        assert!(!buf.segments().iter().any(|s| s.id == 1));
        assert_eq!(buf.segments().len(), 3);
    }

    #[test]
    fn pin_window_smaller_than_buffer() {
        let mut buf = SegmentRingBuffer::new("/tmp", 30, 0);
        for i in 0..10 {
            buf.push(seg(i + 1, i)).unwrap();
        }
        assert_eq!(buf.pin_last(3).unwrap().len(), 3);
    }

    #[test]
    fn pin_on_empty_buffer_errors() {
        let mut buf = SegmentRingBuffer::new("/tmp", 30, 0);
        assert_eq!(buf.pin_last(5).unwrap_err().code(), "buffer_error");
    }

    #[test]
    fn disk_full_is_detected_before_writing() {
        let buf = SegmentRingBuffer::new("/tmp", 30, 0);
        assert_eq!(buf.ensure_space(100, 500).unwrap_err().code(), "disk_full");
        assert!(buf.ensure_space(1_000, 500).is_ok());
    }
}
