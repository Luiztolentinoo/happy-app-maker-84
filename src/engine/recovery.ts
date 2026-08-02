/**
 * Automatic recovery.
 *
 * Runs on startup (and after a watchdog restart): scans for partial clips and
 * orphan segments, repairs what is repairable and discards the rest. The scan /
 * repair / discard operations come from a `RecoveryPort` (native or simulated),
 * so the policy below is backend-agnostic and testable.
 */

import type { RecoverableItem, RecoveryPort } from "./contracts";
import { engineBus, type EventBus } from "./eventBus";
import { engineLogger, type EngineLogger } from "./logger";
import { engineMetrics, METRICS, type MetricsRegistry } from "./metrics";

export interface RecoveryResult {
  scanned: number;
  recovered: string[];
  discarded: string[];
  failed: { path: string; error: string }[];
}

export interface RecoveryOptions {
  /** Files smaller than this are treated as unusable fragments. */
  minRecoverableBytes?: number;
  bus?: EventBus;
  logger?: EngineLogger;
  metrics?: MetricsRegistry;
}

export class AutoRecovery {
  private readonly minBytes: number;
  private readonly bus: EventBus;
  private readonly log;
  private readonly metrics: MetricsRegistry;
  private lastResult: RecoveryResult | null = null;

  constructor(
    private readonly port: RecoveryPort,
    options: RecoveryOptions = {},
  ) {
    this.minBytes = options.minRecoverableBytes ?? 64 * 1024;
    this.bus = options.bus ?? engineBus;
    this.log = (options.logger ?? engineLogger).child("recovery");
    this.metrics = options.metrics ?? engineMetrics;
  }

  /** Pure policy: is this fragment worth repairing? */
  isRecoverable(item: RecoverableItem): boolean {
    return item.recoverable && item.bytes >= this.minBytes;
  }

  last(): RecoveryResult | null {
    return this.lastResult;
  }

  async run(): Promise<RecoveryResult> {
    const items = await this.port.scan();
    const result: RecoveryResult = { scanned: items.length, recovered: [], discarded: [], failed: [] };
    if (items.length > 0) {
      this.log.warn("fragmentos encontrados", { items: items.length });
      this.bus.emit("recovery:found", { items: items.length });
    }

    for (const item of items) {
      try {
        if (this.isRecoverable(item)) {
          const path = await this.port.recover(item.path);
          result.recovered.push(path);
        } else {
          await this.port.discard(item.path);
          result.discarded.push(item.path);
        }
      } catch (error) {
        result.failed.push({
          path: item.path,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.metrics.increment(METRICS.recoveryRecovered, result.recovered.length);
    this.lastResult = result;
    this.bus.emit("recovery:completed", {
      recovered: result.recovered.length,
      discarded: result.discarded.length,
    });
    this.log.info("recovery concluído", {
      recovered: result.recovered.length,
      discarded: result.discarded.length,
      failed: result.failed.length,
    });
    return result;
  }
}
