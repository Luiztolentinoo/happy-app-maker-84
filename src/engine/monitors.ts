/**
 * Performance monitors: FPS, GPU, CPU, encoder and memory.
 *
 * Each monitor is a small independent sampler behind the same interface, so the
 * native adapter can replace any of them without touching the aggregator or the
 * UI. `PerformanceMonitor` merges the samples, records metrics and decides when
 * the pipeline should degrade — the same thresholds Rust uses.
 */

import { engineBus, type EventBus } from "./eventBus";
import { engineLogger, type EngineLogger } from "./logger";
import { engineMetrics, METRICS, type MetricsRegistry } from "./metrics";

export interface PerformanceSample {
  at: number;
  fps: number;
  targetFps: number;
  droppedFrames: number;
  gpuPercent: number;
  cpuPercent: number;
  memoryMb: number;
  encodeLagMs: number;
  encoderQueue: number;
}

export interface Monitor<T> {
  readonly id: string;
  sample(): Promise<T> | T;
}

export interface FpsReading {
  fps: number;
  droppedFrames: number;
}

/** Counts real frame callbacks; falls back to the target when no frames arrive. */
export class FpsMonitor implements Monitor<FpsReading> {
  readonly id = "fps";
  private frames: number[] = [];
  private dropped = 0;

  constructor(private readonly targetFps = 60) {}

  frame(at = Date.now()): void {
    this.frames.push(at);
    const cutoff = at - 1_000;
    while (this.frames.length > 0 && (this.frames[0] ?? 0) < cutoff) this.frames.shift();
  }

  drop(count = 1): void {
    this.dropped += count;
  }

  sample(): FpsReading {
    return { fps: this.frames.length, droppedFrames: this.dropped };
  }

  reset(): void {
    this.frames = [];
    this.dropped = 0;
  }

  get target(): number {
    return this.targetFps;
  }
}

export interface UsageReading {
  percent: number;
}

/** GPU/CPU usage source. The browser has no such API, so this is injectable. */
export class UsageMonitor implements Monitor<UsageReading> {
  constructor(
    readonly id: string,
    private readonly read: () => number,
  ) {}

  sample(): UsageReading {
    return { percent: clampPercent(this.read()) };
  }
}

export interface MemoryReading {
  usedMb: number;
}

export class MemoryMonitor implements Monitor<MemoryReading> {
  readonly id = "memory";

  constructor(private readonly read?: () => number) {}

  sample(): MemoryReading {
    if (this.read) return { usedMb: Math.max(0, this.read()) };
    const perf = typeof performance === "undefined" ? undefined : (performance as PerfWithMemory);
    const bytes = perf?.memory?.usedJSHeapSize ?? 0;
    return { usedMb: Math.round(bytes / (1024 * 1024)) };
  }
}

interface PerfWithMemory {
  memory?: { usedJSHeapSize?: number };
}

export interface EncoderReading {
  lagMs: number;
  queued: number;
}

export class EncoderMonitor implements Monitor<EncoderReading> {
  readonly id = "encoder";
  private lag = 0;
  private queued = 0;

  report(lagMs: number, queued: number): void {
    this.lag = Math.max(0, lagMs);
    this.queued = Math.max(0, queued);
  }

  sample(): EncoderReading {
    return { lagMs: this.lag, queued: this.queued };
  }
}

export interface DegradeThresholds {
  maxDroppedFrames: number;
  maxEncodeLagMs: number;
  minFpsRatio: number;
  maxGpuPercent: number;
  maxCpuPercent: number;
}

export const DEFAULT_THRESHOLDS: DegradeThresholds = {
  maxDroppedFrames: 30,
  maxEncodeLagMs: 250,
  minFpsRatio: 0.75,
  maxGpuPercent: 96,
  maxCpuPercent: 92,
};

export interface PerformanceMonitorOptions {
  fps?: FpsMonitor;
  gpu?: Monitor<UsageReading>;
  cpu?: Monitor<UsageReading>;
  memory?: Monitor<MemoryReading>;
  encoder?: EncoderMonitor;
  thresholds?: Partial<DegradeThresholds>;
  bus?: EventBus;
  logger?: EngineLogger;
  metrics?: MetricsRegistry;
  now?: () => number;
}

export class PerformanceMonitor {
  readonly fps: FpsMonitor;
  readonly gpu: Monitor<UsageReading>;
  readonly cpu: Monitor<UsageReading>;
  readonly memory: Monitor<MemoryReading>;
  readonly encoder: EncoderMonitor;
  readonly thresholds: DegradeThresholds;

  private readonly bus: EventBus;
  private readonly log;
  private readonly metrics: MetricsRegistry;
  private readonly now: () => number;
  private degradedReason: string | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private last: PerformanceSample | null = null;

  constructor(options: PerformanceMonitorOptions = {}) {
    this.fps = options.fps ?? new FpsMonitor();
    this.gpu = options.gpu ?? new UsageMonitor("gpu", () => 0);
    this.cpu = options.cpu ?? new UsageMonitor("cpu", () => 0);
    this.memory = options.memory ?? new MemoryMonitor();
    this.encoder = options.encoder ?? new EncoderMonitor();
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...options.thresholds };
    this.bus = options.bus ?? engineBus;
    this.log = (options.logger ?? engineLogger).child("performance");
    this.metrics = options.metrics ?? engineMetrics;
    this.now = options.now ?? (() => Date.now());
  }

  async sample(): Promise<PerformanceSample> {
    const [fps, gpu, cpu, memory, encoder] = await Promise.all([
      this.fps.sample(),
      this.gpu.sample(),
      this.cpu.sample(),
      this.memory.sample(),
      this.encoder.sample(),
    ]);

    const result: PerformanceSample = {
      at: this.now(),
      fps: fps.fps,
      targetFps: this.fps.target,
      droppedFrames: fps.droppedFrames,
      gpuPercent: gpu.percent,
      cpuPercent: cpu.percent,
      memoryMb: memory.usedMb,
      encodeLagMs: encoder.lagMs,
      encoderQueue: encoder.queued,
    };

    this.metrics.gauge(METRICS.fps, result.fps);
    this.metrics.gauge(METRICS.gpuPercent, result.gpuPercent);
    this.metrics.gauge(METRICS.cpuPercent, result.cpuPercent);
    this.metrics.gauge(METRICS.memoryMb, result.memoryMb);
    this.metrics.observe(METRICS.encodeLagMs, result.encodeLagMs);
    this.metrics.gauge(METRICS.droppedFrames, result.droppedFrames);

    this.last = result;
    this.bus.emit("performance:sample", result);
    this.evaluate(result);
    return result;
  }

  lastSample(): PerformanceSample | null {
    return this.last;
  }

  reason(): string | null {
    return this.degradedReason;
  }

  /** Pure decision function, mirrored by `DefaultPerformanceMonitor` in Rust. */
  shouldDegrade(sample: PerformanceSample): string | null {
    const t = this.thresholds;
    if (sample.droppedFrames > t.maxDroppedFrames) return `${sample.droppedFrames} quadros perdidos`;
    if (sample.encodeLagMs > t.maxEncodeLagMs) return `atraso do encoder ${sample.encodeLagMs}ms`;
    if (sample.targetFps > 0 && sample.fps > 0 && sample.fps / sample.targetFps < t.minFpsRatio) {
      return `FPS de captura em ${sample.fps} (alvo ${sample.targetFps})`;
    }
    if (sample.gpuPercent > t.maxGpuPercent) return `GPU em ${Math.round(sample.gpuPercent)}%`;
    if (sample.cpuPercent > t.maxCpuPercent) return `CPU em ${Math.round(sample.cpuPercent)}%`;
    return null;
  }

  start(intervalMs = 1_000): () => void {
    this.stop();
    this.timer = setInterval(() => void this.sample(), intervalMs);
    return () => this.stop();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private evaluate(sample: PerformanceSample): void {
    const reason = this.shouldDegrade(sample);
    if (reason && reason !== this.degradedReason) {
      this.degradedReason = reason;
      this.log.warn("pipeline degradado", { reason });
      this.bus.emit("performance:degraded", { reason });
      return;
    }
    if (!reason && this.degradedReason) {
      this.degradedReason = null;
      this.log.info("performance recuperada");
      this.bus.emit("performance:recovered", { at: sample.at });
    }
  }
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}
