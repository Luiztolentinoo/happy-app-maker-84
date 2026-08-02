import { describe, expect, it, vi } from "vitest";

import { EventBus } from "@/engine/eventBus";
import { Watchdog } from "@/engine/watchdog";

function makeWatchdog(now: () => number, restarts = 3) {
  return new Watchdog({ timeoutMs: 1_000, maxRestarts: restarts, bus: new EventBus(), now });
}

describe("Watchdog", () => {
  it("starts subsystems as unavailable until registered", () => {
    const dog = makeWatchdog(() => 0);
    expect(dog.statusOf("encoder").health).toBe("unavailable");
    dog.register("encoder");
    expect(dog.statusOf("encoder").health).toBe("ok");
  });

  it("marks stalled subsystems and restarts them", async () => {
    let clock = 0;
    const dog = makeWatchdog(() => clock);
    const restart = vi.fn(async () => {
      clock += 1;
    });
    dog.register("capture_engine", restart);
    clock = 500;
    expect(await dog.tick()).toEqual([]);
    clock = 5_000;
    expect(await dog.tick()).toEqual(["capture_engine"]);
    expect(restart).toHaveBeenCalledOnce();
    expect(dog.statusOf("capture_engine").health).toBe("ok");
  });

  it("stops restarting after the limit", async () => {
    let clock = 0;
    const dog = makeWatchdog(() => clock, 1);
    const restart = vi.fn(async () => undefined);
    dog.register("audio_engine", restart);
    for (const step of [5_000, 10_000, 15_000]) {
      clock = step;
      await dog.tick();
    }
    expect(restart).toHaveBeenCalledTimes(1);
    expect(dog.statusOf("audio_engine").health).toBe("failed");
  });

  it("heartbeats clear a degraded state", () => {
    const dog = makeWatchdog(() => 0);
    dog.register("storage");
    dog.degrade("storage", "disco quase cheio");
    expect(dog.statusOf("storage").health).toBe("degraded");
    dog.heartbeat("storage", "ok");
    expect(dog.statusOf("storage").health).toBe("ok");
  });

  it("reports every subsystem in status()", () => {
    const dog = makeWatchdog(() => 0);
    expect(dog.status()).toHaveLength(10);
  });
});
