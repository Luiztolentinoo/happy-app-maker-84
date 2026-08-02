import { describe, expect, it, vi } from "vitest";

import { EventBus } from "@/engine/eventBus";
import { EngineLogger } from "@/engine/logger";
import { MetricsRegistry } from "@/engine/metrics";
import { WorkQueue } from "@/engine/queue";

const options = () => ({
  id: "export" as const,
  bus: new EventBus(),
  logger: new EngineLogger({ mirrorToConsole: false }),
  metrics: new MetricsRegistry(),
  retryDelayMs: 0,
  sleep: async () => undefined,
});

describe("WorkQueue", () => {
  it("runs jobs and reports them as done", async () => {
    const run = vi.fn(async () => undefined);
    const queue = new WorkQueue(run, options());
    queue.enqueue({ clip: "a" }, "job a");
    await queue.idle();
    expect(run).toHaveBeenCalledOnce();
    expect(queue.snapshot().done).toBe(1);
  });

  it("respects the concurrency limit", async () => {
    let running = 0;
    let peak = 0;
    const queue = new WorkQueue(
      async () => {
        running += 1;
        peak = Math.max(peak, running);
        await Promise.resolve();
        running -= 1;
      },
      { ...options(), concurrency: 2 },
    );
    for (let i = 0; i < 6; i += 1) queue.enqueue({ i }, `job ${i}`);
    await queue.idle();
    expect(peak).toBeLessThanOrEqual(2);
  });

  it("retries then marks the job as failed", async () => {
    const run = vi.fn(async () => {
      throw new Error("encoder busy");
    });
    const queue = new WorkQueue(run, { ...options(), maxRetries: 2 });
    queue.enqueue({}, "flaky");
    await queue.idle();
    expect(run).toHaveBeenCalledTimes(3);
    const snapshot = queue.snapshot();
    expect(snapshot.failed).toBe(1);
    expect(snapshot.jobs.at(-1)?.error).toBe("encoder busy");
  });

  it("recovers when a retry succeeds", async () => {
    let attempts = 0;
    const queue = new WorkQueue(async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("temporário");
    }, options());
    queue.enqueue({}, "retry once");
    await queue.idle();
    expect(attempts).toBe(2);
    expect(queue.snapshot().failed).toBe(0);
    expect(queue.snapshot().done).toBe(1);
  });

  it("runs higher priority jobs first", async () => {
    const order: string[] = [];
    const queue = new WorkQueue<{ label: string }>(async ({ label }) => {
      order.push(label);
    }, options());
    queue.enqueue({ label: "low" }, "low", 1);
    queue.enqueue({ label: "high" }, "high", 100);
    await queue.idle();
    expect(order[0]).toBe("low"); // first job starts immediately
    expect(order).toContain("high");
  });

  it("cancels a queued job", async () => {
    const queue = new WorkQueue(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }, options());
    queue.enqueue({}, "first");
    const second = queue.enqueue({}, "second");
    expect(queue.cancel(second.id)).toBe(true);
    await queue.idle();
    expect(queue.snapshot().done).toBe(1);
  });
});
