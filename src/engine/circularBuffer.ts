/**
 * Circular (retroactive) buffer.
 *
 * Segment-based ring with dual eviction (time + bytes) and pinning, so saving a
 * clip never stops the recording. Mirrors `SegmentRingBuffer` in
 * `apps/desktop/src-tauri/src/capture/buffer.rs`.
 */

import type { BufferSegment, BufferStats, CircularBufferPort } from "./contracts";
import { engineBus, type EventBus } from "./eventBus";
import { engineLogger, type EngineLogger } from "./logger";
import { engineMetrics, METRICS, type MetricsRegistry } from "./metrics";

export interface CircularBufferOptions {
  capacitySeconds: number;
  /** 0 disables the byte limit. */
  capacityBytes?: number;
  bus?: EventBus;
  logger?: EngineLogger;
  metrics?: MetricsRegistry;
}

export class CircularBuffer implements CircularBufferPort {
  private segments: BufferSegment[] = [];
  private capacityMs: number;
  private capacityBytes: number;
  private evictions = 0;
  private readonly bus: EventBus;
  private readonly log;
  private readonly metrics: MetricsRegistry;

  constructor(options: CircularBufferOptions) {
    this.capacityMs = Math.max(1, options.capacitySeconds) * 1_000;
    this.capacityBytes = options.capacityBytes ?? 0;
    this.bus = options.bus ?? engineBus;
    this.log = (options.logger ?? engineLogger).child("buffer");
    this.metrics = options.metrics ?? engineMetrics;
  }

  setCapacitySeconds(seconds: number): void {
    this.capacityMs = Math.max(1, seconds) * 1_000;
    this.evict();
  }

  setCapacityBytes(bytes: number): void {
    this.capacityBytes = Math.max(0, bytes);
    this.evict();
  }

  push(segment: BufferSegment): void {
    this.segments.push({ ...segment });
    this.evict();
    this.metrics.gauge(METRICS.bufferBytes, this.bytes());
    this.bus.emit("buffer:stats", this.stats());
  }

  pinLast(seconds: number): BufferSegment[] {
    const target = Math.max(1, seconds) * 1_000;
    const pinned: BufferSegment[] = [];
    let total = 0;
    for (let i = this.segments.length - 1; i >= 0 && total < target; i -= 1) {
      const segment = this.segments[i];
      if (!segment) continue;
      segment.pinned = true;
      pinned.unshift({ ...segment });
      total += segment.durationMs;
    }
    this.log.info("segmentos fixados para gravação", { count: pinned.length, ms: total });
    return pinned;
  }

  release(ids: string[]): void {
    const set = new Set(ids);
    for (const segment of this.segments) {
      if (set.has(segment.id)) segment.pinned = false;
    }
    this.evict();
  }

  stats(): BufferStats {
    return {
      segments: this.segments.length,
      bufferedMs: this.bufferedMs(),
      bytes: this.bytes(),
      capacityMs: this.capacityMs,
      capacityBytes: this.capacityBytes,
      evictions: this.evictions,
    };
  }

  clear(): void {
    this.segments = this.segments.filter((segment) => segment.pinned);
    this.bus.emit("buffer:stats", this.stats());
  }

  private bufferedMs(): number {
    return this.segments.reduce((total, segment) => total + segment.durationMs, 0);
  }

  private bytes(): number {
    return this.segments.reduce((total, segment) => total + segment.bytes, 0);
  }

  /** Drops the oldest unpinned segments until both limits are satisfied. */
  private evict(): void {
    let removedSegments = 0;
    let removedBytes = 0;

    const overflowing = () =>
      this.bufferedMs() > this.capacityMs ||
      (this.capacityBytes > 0 && this.bytes() > this.capacityBytes);

    while (overflowing()) {
      const index = this.segments.findIndex((segment) => !segment.pinned);
      if (index < 0) break; // everything pinned: keep data, a writer owns it.
      const [segment] = this.segments.splice(index, 1);
      if (!segment) break;
      removedSegments += 1;
      removedBytes += segment.bytes;
      this.evictions += 1;
    }

    if (removedSegments > 0) {
      this.metrics.increment(METRICS.bufferEvictions, removedSegments);
      this.bus.emit("buffer:evicted", { segments: removedSegments, bytes: removedBytes });
    }
  }
}
