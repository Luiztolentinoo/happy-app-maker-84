/**
 * Concrete engine queues: recording, export and thumbnails.
 *
 * Each queue owns one pipeline and is fed by the capture engine or the UI. The
 * jobs' actual work is injected (native command or browser simulation), which
 * keeps the queues free of backend knowledge.
 */

import { engineBus, type EventBus } from "./eventBus";
import { WorkQueue, type QueueJob, type QueueSnapshot } from "./queue";

export interface RecordingJobPayload {
  clipId: string;
  seconds: number;
  title?: string;
  game?: string;
  segmentIds: string[];
}

export interface ExportJobPayload {
  clipId: string;
  startMs: number;
  endMs: number;
  format: "mp4" | "webm" | "gif";
}

export interface ThumbnailJobPayload {
  clipId: string;
  atMs: number;
}

export interface EngineQueueHandlers {
  writeRecording: (payload: RecordingJobPayload) => Promise<void>;
  runExport: (payload: ExportJobPayload) => Promise<void>;
  buildThumbnail: (payload: ThumbnailJobPayload) => Promise<void>;
}

export interface EngineQueuesOptions {
  bus?: EventBus;
  concurrency?: { recording?: number; export?: number; thumbnail?: number };
}

/** Priority tiers so a retroactive clip never waits behind a thumbnail batch. */
export const QUEUE_PRIORITY = { recording: 100, export: 50, thumbnail: 10 } as const;

export class EngineQueues {
  readonly recording: WorkQueue<RecordingJobPayload>;
  readonly export: WorkQueue<ExportJobPayload>;
  readonly thumbnail: WorkQueue<ThumbnailJobPayload>;

  constructor(handlers: EngineQueueHandlers, options: EngineQueuesOptions = {}) {
    const bus = options.bus ?? engineBus;
    this.recording = new WorkQueue<RecordingJobPayload>(handlers.writeRecording, {
      id: "recording",
      concurrency: options.concurrency?.recording ?? 1,
      maxRetries: 1,
      bus,
    });
    this.export = new WorkQueue<ExportJobPayload>(handlers.runExport, {
      id: "export",
      concurrency: options.concurrency?.export ?? 1,
      maxRetries: 2,
      bus,
    });
    this.thumbnail = new WorkQueue<ThumbnailJobPayload>(handlers.buildThumbnail, {
      id: "thumbnail",
      concurrency: options.concurrency?.thumbnail ?? 2,
      maxRetries: 2,
      bus,
    });
  }

  enqueueRecording(payload: RecordingJobPayload): QueueJob<RecordingJobPayload> {
    return this.recording.enqueue(payload, `Clipe ${payload.seconds}s`, QUEUE_PRIORITY.recording);
  }

  enqueueExport(payload: ExportJobPayload): QueueJob<ExportJobPayload> {
    return this.export.enqueue(
      payload,
      `Exportar ${payload.format.toUpperCase()}`,
      QUEUE_PRIORITY.export,
    );
  }

  enqueueThumbnail(payload: ThumbnailJobPayload): QueueJob<ThumbnailJobPayload> {
    return this.thumbnail.enqueue(payload, "Miniatura", QUEUE_PRIORITY.thumbnail);
  }

  snapshots(): QueueSnapshot[] {
    return [this.recording.snapshot(), this.export.snapshot(), this.thumbnail.snapshot()];
  }

  async idle(): Promise<void> {
    await Promise.all([this.recording.idle(), this.export.idle(), this.thumbnail.idle()]);
  }
}
