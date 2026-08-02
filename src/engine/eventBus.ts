/**
 * Typed event bus shared by every Capture Engine subsystem.
 *
 * Decoupling rule: subsystems never import each other — they publish and
 * subscribe here. The native layer forwards Tauri events into the same bus
 * (see `src/engine/bridge.ts`), so UI code has one place to listen.
 */

import type {
  BufferStats,
  CaptureStatus,
  DetectedGame,
  NativeCaptureState,
  StorageStatus,
  SubsystemId,
  SubsystemStatus,
} from "./contracts";
import type { PerformanceSample } from "./monitors";
import type { QueueSnapshot } from "./queue";

export interface EngineEvents {
  "engine:ready": { native: boolean };
  "capture:state": { state: NativeCaptureState; status: CaptureStatus | null };
  "capture:clip-saved": { id: string; path: string; durationMs: number };
  "buffer:stats": BufferStats;
  "buffer:evicted": { segments: number; bytes: number };
  "game:detected": { game: DetectedGame | null };
  "encoder:fallback": { from: string; to: string; reason: string };
  "audio:changed": { deviceIds: string[] };
  "storage:status": StorageStatus;
  "storage:warning": { message: string; freeBytes: number };
  "performance:sample": PerformanceSample;
  "performance:degraded": { reason: string };
  "performance:recovered": { at: number };
  "queue:changed": QueueSnapshot;
  "recovery:found": { items: number };
  "recovery:completed": { recovered: number; discarded: number };
  "watchdog:heartbeat": { subsystem: SubsystemId; at: number };
  "watchdog:stalled": { subsystem: SubsystemId; sinceMs: number };
  "watchdog:restarted": { subsystem: SubsystemId; attempt: number };
  "subsystem:status": SubsystemStatus;
  "log:entry": { level: string; scope: string; message: string; at: number };
}

export type EngineEventName = keyof EngineEvents;
export type EngineHandler<K extends EngineEventName> = (payload: EngineEvents[K]) => void;
export type Unsubscribe = () => void;

export class EventBus {
  private handlers = new Map<string, Set<(payload: unknown) => void>>();
  private anyHandlers = new Set<(name: string, payload: unknown) => void>();

  on<K extends EngineEventName>(name: K, handler: EngineHandler<K>): Unsubscribe {
    const set = this.handlers.get(name) ?? new Set<(payload: unknown) => void>();
    set.add(handler as (payload: unknown) => void);
    this.handlers.set(name, set);
    return () => {
      set.delete(handler as (payload: unknown) => void);
    };
  }

  once<K extends EngineEventName>(name: K, handler: EngineHandler<K>): Unsubscribe {
    const off = this.on(name, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  onAny(handler: (name: string, payload: unknown) => void): Unsubscribe {
    this.anyHandlers.add(handler);
    return () => {
      this.anyHandlers.delete(handler);
    };
  }

  emit<K extends EngineEventName>(name: K, payload: EngineEvents[K]): void {
    for (const handler of Array.from(this.handlers.get(name) ?? [])) {
      try {
        handler(payload);
      } catch (error) {
        // A broken subscriber must never take the capture pipeline down.
        console.error(`[clipcore] handler failed for ${name}`, error);
      }
    }
    for (const handler of Array.from(this.anyHandlers)) {
      try {
        handler(name, payload);
      } catch {
        /* ignored on purpose */
      }
    }
  }

  listenerCount(name: EngineEventName): number {
    return this.handlers.get(name)?.size ?? 0;
  }

  clear(): void {
    this.handlers.clear();
    this.anyHandlers.clear();
  }
}

/** Process-wide bus. Subsystems receive it by injection so tests stay isolated. */
export const engineBus = new EventBus();
