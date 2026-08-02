/**
 * Engine runtime: the single composition root.
 *
 * Wires the ports (native or simulated), monitors, queues, watchdog and
 * recovery into one object the UI can consume. Nothing here knows whether it is
 * talking to Rust or to the browser simulation — that decision lives in
 * `adapters.ts`.
 */

import type {
  CaptureEnginePort,
  CaptureSettings,
  CaptureStatus,
  DiagnosticsPort,
  EncoderPort,
  GameDetector,
  HotkeyPort,
  RecoveryPort,
  StoragePort,
  SubsystemStatus,
} from "./contracts";
import { CircularBuffer } from "./circularBuffer";
import { engineBus, type EventBus } from "./eventBus";
import { engineLogger, type EngineLogger } from "./logger";
import { engineMetrics, type MetricsRegistry, type MetricsSnapshot } from "./metrics";
import { PerformanceMonitor, type PerformanceSample } from "./monitors";
import { EngineQueues, type EngineQueueHandlers } from "./queues";
import { AutoRecovery, type RecoveryResult } from "./recovery";
import { Watchdog } from "./watchdog";

export interface EnginePorts {
  capture: CaptureEnginePort;
  games: GameDetector;
  encoders: EncoderPort;
  hotkeys: HotkeyPort;
  storage: StoragePort;
  recovery: RecoveryPort;
  diagnostics: DiagnosticsPort;
  queues: EngineQueueHandlers;
}

export interface EngineRuntimeOptions {
  native: boolean;
  ports: EnginePorts;
  bus?: EventBus;
  logger?: EngineLogger;
  metrics?: MetricsRegistry;
  bufferSeconds?: number;
}

export interface EngineHealth {
  native: boolean;
  subsystems: SubsystemStatus[];
  performance: PerformanceSample | null;
  degradedReason: string | null;
  metrics: MetricsSnapshot;
}

export class EngineRuntime {
  readonly native: boolean;
  readonly bus: EventBus;
  readonly ports: EnginePorts;
  readonly buffer: CircularBuffer;
  readonly performance: PerformanceMonitor;
  readonly queues: EngineQueues;
  readonly watchdog: Watchdog;
  readonly recovery: AutoRecovery;

  private readonly log;
  private readonly metrics: MetricsRegistry;
  private stopFns: (() => void)[] = [];
  private started = false;

  constructor(options: EngineRuntimeOptions) {
    this.native = options.native;
    this.bus = options.bus ?? engineBus;
    this.metrics = options.metrics ?? engineMetrics;
    this.log = (options.logger ?? engineLogger).child("engine");
    this.ports = options.ports;

    this.buffer = new CircularBuffer({
      capacitySeconds: options.bufferSeconds ?? 60,
      bus: this.bus,
      metrics: this.metrics,
    });
    this.performance = new PerformanceMonitor({ bus: this.bus, metrics: this.metrics });
    this.queues = new EngineQueues(options.ports.queues, { bus: this.bus });
    this.watchdog = new Watchdog({ bus: this.bus });
    this.recovery = new AutoRecovery(options.ports.recovery, { bus: this.bus });
  }

  /** Boots the engine: recovery first, then monitors and watchdog. */
  async start(): Promise<RecoveryResult> {
    if (this.started) {
      const last = this.recovery.last();
      if (last) return last;
    }
    this.started = true;

    this.watchdog.register("capture_engine", () => void this.ports.capture.startBuffer());
    this.watchdog.register("performance_monitor", () => void this.performance.sample());
    this.watchdog.register("recovery", null, "pronto");
    if (!this.native) {
      for (const id of ["game_detector", "encoder", "audio_engine", "hotkeys"] as const) {
        this.watchdog.degrade(id, "indisponível fora do aplicativo desktop");
      }
    }

    const result = await this.recovery.run();
    this.stopFns.push(this.performance.start(1_000));
    this.stopFns.push(this.watchdog.start(2_000));
    this.bus.emit("engine:ready", { native: this.native });
    this.log.info("engine iniciado", { native: this.native, recuperados: result.recovered.length });
    return result;
  }

  stop(): void {
    for (const stop of this.stopFns) stop();
    this.stopFns = [];
    this.started = false;
  }

  /** Saves a retroactive clip: pins segments, enqueues the write, releases them. */
  async saveRetroactiveClip(seconds: number, meta: { title?: string; game?: string } = {}) {
    const pinned = this.buffer.pinLast(seconds);
    const clipId = `clip-${Date.now().toString(36)}`;
    const job = this.queues.enqueueRecording({
      clipId,
      seconds,
      segmentIds: pinned.map((segment) => segment.id),
      ...(meta.title ? { title: meta.title } : {}),
      ...(meta.game ? { game: meta.game } : {}),
    });
    await this.ports.capture.saveRetroactive(seconds, meta);
    this.buffer.release(pinned.map((segment) => segment.id));
    this.watchdog.heartbeat("capture_engine", "clipe salvo");
    return job;
  }

  async status(): Promise<CaptureStatus> {
    const status = await this.ports.capture.status();
    this.watchdog.heartbeat("capture_engine");
    this.bus.emit("capture:state", { state: status.state, status });
    return status;
  }

  async updateSettings(settings: CaptureSettings): Promise<CaptureStatus> {
    this.buffer.setCapacitySeconds(settings.buffer_seconds);
    return this.ports.capture.updateSettings(settings);
  }

  health(): EngineHealth {
    return {
      native: this.native,
      subsystems: this.watchdog.status(),
      performance: this.performance.lastSample(),
      degradedReason: this.performance.reason(),
      metrics: this.metrics.snapshot(),
    };
  }
}
