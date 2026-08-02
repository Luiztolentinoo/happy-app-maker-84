import { describe, expect, it, vi } from "vitest";

import type { RecoverableItem, RecoveryPort } from "@/engine/contracts";
import { EventBus } from "@/engine/eventBus";
import { MetricsRegistry } from "@/engine/metrics";
import { AutoRecovery } from "@/engine/recovery";

function port(items: RecoverableItem[], overrides: Partial<RecoveryPort> = {}): RecoveryPort {
  return {
    scan: async () => items,
    recover: async (path) => path.replace(/\.part$/, ".mp4"),
    discard: async () => undefined,
    ...overrides,
  };
}

const options = { bus: new EventBus(), metrics: new MetricsRegistry(), minRecoverableBytes: 1_000 };

describe("AutoRecovery", () => {
  it("recovers usable fragments and discards the rest", async () => {
    const recovery = new AutoRecovery(
      port([
        { path: "/tmp/a.part", bytes: 5_000, recoverable: true },
        { path: "/tmp/b.part", bytes: 10, recoverable: true },
        { path: "/tmp/c.part", bytes: 9_000, recoverable: false },
      ]),
      options,
    );
    const result = await recovery.run();
    expect(result.scanned).toBe(3);
    expect(result.recovered).toEqual(["/tmp/a.mp4"]);
    expect(result.discarded).toEqual(["/tmp/b.part", "/tmp/c.part"]);
    expect(result.failed).toEqual([]);
  });

  it("collects failures without aborting the pass", async () => {
    const recovery = new AutoRecovery(
      port(
        [
          { path: "/tmp/a.part", bytes: 5_000, recoverable: true },
          { path: "/tmp/b.part", bytes: 5_000, recoverable: true },
        ],
        {
          recover: async (path) => {
            if (path === "/tmp/a.part") throw new Error("disco ocupado");
            return path.replace(".part", ".mp4");
          },
        },
      ),
      options,
    );
    const result = await recovery.run();
    expect(result.failed).toEqual([{ path: "/tmp/a.part", error: "disco ocupado" }]);
    expect(result.recovered).toEqual(["/tmp/b.mp4"]);
  });

  it("announces findings and completion on the bus", async () => {
    const bus = new EventBus();
    const found = vi.fn();
    const completed = vi.fn();
    bus.on("recovery:found", found);
    bus.on("recovery:completed", completed);
    const recovery = new AutoRecovery(
      port([{ path: "/tmp/a.part", bytes: 5_000, recoverable: true }]),
      {
        ...options,
        bus,
      },
    );
    await recovery.run();
    expect(found).toHaveBeenCalledWith({ items: 1 });
    expect(completed).toHaveBeenCalledWith({ recovered: 1, discarded: 0 });
  });

  it("is a no-op when nothing is pending", async () => {
    const recovery = new AutoRecovery(port([]), options);
    const result = await recovery.run();
    expect(result).toEqual({ scanned: 0, recovered: [], discarded: [], failed: [] });
    expect(recovery.last()).toEqual(result);
  });
});
