/**
 * Watchdog: every subsystem sends a heartbeat; a missing heartbeat marks the
 * subsystem as stalled and triggers its registered restart routine.
 */

import { SUBSYSTEMS, type SubsystemHealth, type SubsystemId, type SubsystemStatus } from "./contracts";
import { engineBus, type EventBus } from "./eventBus";
import { engineLogger, type EngineLogger } from "./logger";
import { engineMetrics, METRICS, type MetricsRegistry } from "./metrics";

export interface WatchdogOptions {
  /** Grace period before a subsystem counts as stalled. */
  timeoutMs?: number;
  maxRestarts?: number;
  bus?: EventBus;
  logger?: EngineLogger;
  metrics?: MetricsRegistry;
  now?: () => number;
}

type RestartFn = () => Promise<void> | void;

interface Entry {
  lastHeartbeat: number | null;
  health: SubsystemHealth;
  detail: string;
  restarts: number;
  restart: RestartFn | null;
  /** Subsystems that were never started are not "stalled". */
  watched: boolean;
}

export class Watchdog {
  private readonly timeoutMs: number;
  private readonly maxRestarts: number;
  private readonly bus: EventBus;
  private readonly log;
  private readonly metrics: MetricsRegistry;
  private readonly now: () => number;
  private entries = new Map<SubsystemId, Entry>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(options: WatchdogOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 5_000;
    this.maxRestarts = options.maxRestarts ?? 3;
    this.bus = options.bus ?? engineBus;
    this.log = (options.logger ?? engineLogger).child("watchdog");
    this.metrics = options.metrics ?? engineMetrics;
    this.now = options.now ?? (() => Date.now());
    for (const id of SUBSYSTEMS) {
      this.entries.set(id, {
        lastHeartbeat: null,
        health: "unavailable",
        detail: "não iniciado",
        restarts: 0,
        restart: null,
        watched: false,
      });
    }
  }

  /** Starts watching a subsystem and registers how to bring it back. */
  register(id: SubsystemId, restart: RestartFn | null = null, detail = "iniciado"): void {
    const entry = this.entry(id);
    entry.watched = true;
    entry.restart = restart;
    entry.health = "ok";
    entry.detail = detail;
    entry.lastHeartbeat = this.now();
    this.publish(id);
  }

  unregister(id: SubsystemId): void {
    const entry = this.entry(id);
    entry.watched = false;
    entry.health = "unavailable";
    entry.detail = "parado";
    this.publish(id);
  }

  heartbeat(id: SubsystemId, detail?: string): void {
    const entry = this.entry(id);
    entry.lastHeartbeat = this.now();
    entry.watched = true;
    if (entry.health !== "ok") {
      entry.health = "ok";
      entry.detail = detail ?? "recuperado";
    } else if (detail) {
      entry.detail = detail;
    }
    this.bus.emit("watchdog:heartbeat", { subsystem: id, at: entry.lastHeartbeat });
    this.publish(id);
  }

  /** Reports a non-fatal degradation without stopping the subsystem. */
  degrade(id: SubsystemId, detail: string): void {
    const entry = this.entry(id);
    entry.health = "degraded";
    entry.detail = detail;
    this.publish(id);
  }

  fail(id: SubsystemId, detail: string): void {
    const entry = this.entry(id);
    entry.health = "failed";
    entry.detail = detail;
    this.log.error("subsistema falhou", { id, detail });
    this.publish(id);
  }

  status(): SubsystemStatus[] {
    return SUBSYSTEMS.map((id) => this.statusOf(id));
  }

  statusOf(id: SubsystemId): SubsystemStatus {
    const entry = this.entry(id);
    return { id, health: entry.health, detail: entry.detail, lastHeartbeat: entry.lastHeartbeat };
  }

  /** One watchdog pass. Returns the subsystems considered stalled. */
  async tick(): Promise<SubsystemId[]> {
    const stalled: SubsystemId[] = [];
    for (const id of SUBSYSTEMS) {
      const entry = this.entry(id);
      if (!entry.watched || entry.lastHeartbeat === null) continue;
      const since = this.now() - entry.lastHeartbeat;
      if (since <= this.timeoutMs) continue;
      stalled.push(id);
      entry.health = "failed";
      entry.detail = `sem sinal há ${Math.round(since / 1000)}s`;
      this.bus.emit("watchdog:stalled", { subsystem: id, sinceMs: since });
      this.publish(id);
      await this.tryRestart(id, entry);
    }
    return stalled;
  }

  start(intervalMs = 2_000): () => void {
    this.stop();
    this.timer = setInterval(() => void this.tick(), intervalMs);
    return () => this.stop();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tryRestart(id: SubsystemId, entry: Entry): Promise<void> {
    if (!entry.restart || entry.restarts >= this.maxRestarts) {
      if (entry.restarts >= this.maxRestarts) {
        entry.detail = `${entry.detail} · limite de reinícios atingido`;
        this.publish(id);
      }
      return;
    }
    entry.restarts += 1;
    this.metrics.increment(METRICS.watchdogRestarts);
    this.log.warn("reiniciando subsistema", { id, attempt: entry.restarts });
    this.bus.emit("watchdog:restarted", { subsystem: id, attempt: entry.restarts });
    try {
      await entry.restart();
      entry.lastHeartbeat = this.now();
      entry.health = "ok";
      entry.detail = `reiniciado (tentativa ${entry.restarts})`;
    } catch (error) {
      entry.health = "failed";
      entry.detail = error instanceof Error ? error.message : String(error);
    }
    this.publish(id);
  }

  private entry(id: SubsystemId): Entry {
    const found = this.entries.get(id);
    if (found) return found;
    const created: Entry = {
      lastHeartbeat: null,
      health: "unavailable",
      detail: "desconhecido",
      restarts: 0,
      restart: null,
      watched: false,
    };
    this.entries.set(id, created);
    return created;
  }

  private publish(id: SubsystemId): void {
    this.bus.emit("subsystem:status", this.statusOf(id));
  }
}

export const engineWatchdog = new Watchdog();
