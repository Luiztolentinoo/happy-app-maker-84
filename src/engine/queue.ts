/**
 * Generic async work queue used by the recording, export and thumbnail
 * pipelines. Concurrency-limited, retrying, priority-ordered and observable.
 */

import { engineBus, type EventBus } from "./eventBus";
import { engineLogger, type EngineLogger } from "./logger";
import { engineMetrics, METRICS, type MetricsRegistry } from "./metrics";

export type QueueId = "recording" | "export" | "thumbnail";
export type JobStatus = "queued" | "running" | "done" | "failed" | "canceled";

export interface QueueJob<T = unknown> {
  id: string;
  label: string;
  /** Higher runs first. */
  priority: number;
  status: JobStatus;
  attempts: number;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  error: string | null;
  payload: T;
}

export interface QueueSnapshot {
  queue: QueueId;
  queued: number;
  running: number;
  done: number;
  failed: number;
  jobs: QueueJob[];
}

export interface QueueOptions {
  id: QueueId;
  concurrency?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  bus?: EventBus;
  logger?: EngineLogger;
  metrics?: MetricsRegistry;
  now?: () => number;
  /** Injected so tests don't wait on real timers. */
  sleep?: (ms: number) => Promise<void>;
}

export type JobRunner<T> = (payload: T, job: QueueJob<T>) => Promise<void>;

let sequence = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(sequence += 1)}`;

export class WorkQueue<T = unknown> {
  readonly id: QueueId;
  private readonly concurrency: number;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly bus: EventBus;
  private readonly log;
  private readonly metrics: MetricsRegistry;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  private pending: QueueJob<T>[] = [];
  private active = new Set<string>();
  private history: QueueJob<T>[] = [];
  private draining = false;

  constructor(
    private readonly runner: JobRunner<T>,
    options: QueueOptions,
  ) {
    this.id = options.id;
    this.concurrency = Math.max(1, options.concurrency ?? 1);
    this.maxRetries = options.maxRetries ?? 2;
    this.retryDelayMs = options.retryDelayMs ?? 400;
    this.bus = options.bus ?? engineBus;
    this.log = (options.logger ?? engineLogger).child(`queue:${options.id}`);
    this.metrics = options.metrics ?? engineMetrics;
    this.now = options.now ?? (() => Date.now());
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  enqueue(payload: T, label: string, priority = 0): QueueJob<T> {
    const job: QueueJob<T> = {
      id: nextId(this.id),
      label,
      priority,
      status: "queued",
      attempts: 0,
      createdAt: this.now(),
      startedAt: null,
      finishedAt: null,
      error: null,
      payload,
    };
    this.pending.push(job);
    this.pending.sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt);
    this.log.info("job enfileirado", { id: job.id, label, priority });
    this.publish();
    void this.drain();
    return job;
  }

  cancel(id: string): boolean {
    const index = this.pending.findIndex((job) => job.id === id);
    if (index < 0) return false;
    const [job] = this.pending.splice(index, 1);
    if (!job) return false;
    job.status = "canceled";
    job.finishedAt = this.now();
    this.history.push(job);
    this.publish();
    return true;
  }

  snapshot(): QueueSnapshot {
    return {
      queue: this.id,
      queued: this.pending.length,
      running: this.active.size,
      done: this.history.filter((job) => job.status === "done").length,
      failed: this.history.filter((job) => job.status === "failed").length,
      jobs: [...this.pending, ...this.history.slice(-20)] as QueueJob[],
    };
  }

  /** Resolves when every queued and running job settles. */
  async idle(): Promise<void> {
    while (this.pending.length > 0 || this.active.size > 0) {
      await this.sleep(0);
    }
  }

  clearHistory(): void {
    this.history = [];
    this.publish();
  }

  private publish(): void {
    this.metrics.gauge(`${METRICS.queueDepth}.${this.id}`, this.pending.length + this.active.size);
    this.bus.emit("queue:changed", this.snapshot());
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.pending.length > 0 && this.active.size < this.concurrency) {
        const job = this.pending.shift();
        if (!job) break;
        void this.execute(job);
      }
    } finally {
      this.draining = false;
    }
  }

  private async execute(job: QueueJob<T>): Promise<void> {
    this.active.add(job.id);
    job.status = "running";
    job.startedAt = this.now();
    job.attempts += 1;
    this.publish();
    try {
      await this.runner(job.payload, job);
      job.status = "done";
      job.finishedAt = this.now();
      job.error = null;
      this.metrics.observe(
        METRICS.jobDurationMs,
        job.finishedAt - (job.startedAt ?? job.finishedAt),
      );
      this.history.push(job);
      this.log.info("job concluído", { id: job.id, attempts: job.attempts });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      job.error = message;
      if (job.attempts <= this.maxRetries) {
        job.status = "queued";
        this.log.warn("job falhou, reagendando", { id: job.id, attempts: job.attempts, message });
        this.active.delete(job.id);
        await this.sleep(this.retryDelayMs * job.attempts);
        this.pending.push(job);
        this.pending.sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt);
        this.publish();
        void this.drain();
        return;
      }
      job.status = "failed";
      job.finishedAt = this.now();
      this.history.push(job);
      this.metrics.increment(`${METRICS.queueFailures}.${this.id}`);
      this.log.error("job falhou definitivamente", { id: job.id, message });
    } finally {
      if (job.status !== "queued") {
        this.active.delete(job.id);
        this.publish();
        void this.drain();
      }
    }
  }
}
