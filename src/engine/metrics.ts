/**
 * Metrics registry: counters, gauges and histograms.
 *
 * Used by the monitors, queues and watchdog so the Diagnostics screen has real
 * numbers instead of ad-hoc component state.
 */

export interface HistogramSnapshot {
  count: number;
  min: number;
  max: number;
  avg: number;
  p95: number;
}

export interface MetricsSnapshot {
  counters: Record<string, number>;
  gauges: Record<string, number>;
  histograms: Record<string, HistogramSnapshot>;
}

export class MetricsRegistry {
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();
  private samples = new Map<string, number[]>();
  private readonly window: number;

  constructor(window = 120) {
    this.window = window;
  }

  increment(name: string, by = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + by);
  }

  gauge(name: string, value: number): void {
    this.gauges.set(name, value);
  }

  observe(name: string, value: number): void {
    const list = this.samples.get(name) ?? [];
    list.push(value);
    if (list.length > this.window) list.splice(0, list.length - this.window);
    this.samples.set(name, list);
  }

  counter(name: string): number {
    return this.counters.get(name) ?? 0;
  }

  gaugeValue(name: string): number | null {
    return this.gauges.get(name) ?? null;
  }

  histogram(name: string): HistogramSnapshot | null {
    const list = this.samples.get(name);
    if (!list || list.length === 0) return null;
    const sorted = [...list].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
    return {
      count: sorted.length,
      min: sorted[0] ?? 0,
      max: sorted[sorted.length - 1] ?? 0,
      avg: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
      p95: sorted[index] ?? 0,
    };
  }

  snapshot(): MetricsSnapshot {
    const histograms: Record<string, HistogramSnapshot> = {};
    for (const name of this.samples.keys()) {
      const value = this.histogram(name);
      if (value) histograms[name] = value;
    }
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms,
    };
  }

  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.samples.clear();
  }
}

export const METRICS = {
  clipsSaved: "capture.clips_saved",
  bufferEvictions: "buffer.evictions",
  bufferBytes: "buffer.bytes",
  encoderFallbacks: "encoder.fallbacks",
  droppedFrames: "capture.dropped_frames",
  encodeLagMs: "encoder.lag_ms",
  fps: "capture.fps",
  gpuPercent: "system.gpu_percent",
  cpuPercent: "system.cpu_percent",
  memoryMb: "system.memory_mb",
  queueDepth: "queue.depth",
  queueFailures: "queue.failures",
  jobDurationMs: "queue.job_ms",
  watchdogRestarts: "watchdog.restarts",
  recoveryRecovered: "recovery.recovered",
} as const;

export const engineMetrics = new MetricsRegistry();
