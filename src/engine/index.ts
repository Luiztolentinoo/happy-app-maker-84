/**
 * Capture Engine public surface.
 *
 * Import everything engine-related from `@/engine` — subsystem files are
 * implementation detail and should not be imported directly by UI code.
 */

export * from "./contracts";
export { EventBus, engineBus, type EngineEvents, type EngineEventName, type Unsubscribe } from "./eventBus";
export { EngineLogger, ScopedLogger, engineLogger, type LogEntry, type LogLevel } from "./logger";
export { MetricsRegistry, engineMetrics, METRICS, type MetricsSnapshot, type HistogramSnapshot } from "./metrics";
export {
  DEFAULT_THRESHOLDS,
  EncoderMonitor,
  FpsMonitor,
  MemoryMonitor,
  PerformanceMonitor,
  UsageMonitor,
  type DegradeThresholds,
  type Monitor,
  type PerformanceSample,
} from "./monitors";
export { WorkQueue, type JobRunner, type QueueId, type QueueJob, type QueueSnapshot } from "./queue";
export {
  EngineQueues,
  QUEUE_PRIORITY,
  type EngineQueueHandlers,
  type ExportJobPayload,
  type RecordingJobPayload,
  type ThumbnailJobPayload,
} from "./queues";
export { CircularBuffer, type CircularBufferOptions } from "./circularBuffer";
export { AutoRecovery, type RecoveryResult } from "./recovery";
export { Watchdog, engineWatchdog } from "./watchdog";
export { EngineRuntime, type EngineHealth, type EnginePorts, type EngineRuntimeOptions } from "./runtime";
export { createEnginePorts, listAudioDevices } from "./adapters";

import { isDesktopRuntime } from "@/services/nativeClient";
import { createEnginePorts } from "./adapters";
import { EngineRuntime } from "./runtime";

let runtime: EngineRuntime | null = null;

/** Lazily created process-wide runtime (browser: simulated ports). */
export function getEngineRuntime(): EngineRuntime {
  if (!runtime) {
    const native = isDesktopRuntime();
    runtime = new EngineRuntime({ native, ports: createEnginePorts(native) });
  }
  return runtime;
}

/** Test helper: drops the cached runtime. */
export function resetEngineRuntime(): void {
  runtime?.stop();
  runtime = null;
}
