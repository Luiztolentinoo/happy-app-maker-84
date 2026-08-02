import { describe, expect, it, vi } from "vitest";

import { EventBus } from "@/engine/eventBus";

describe("EventBus", () => {
  it("delivers typed payloads to subscribers", () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on("performance:degraded", handler);
    bus.emit("performance:degraded", { reason: "GPU em 99%" });
    expect(handler).toHaveBeenCalledWith({ reason: "GPU em 99%" });
  });

  it("unsubscribes and reports listener count", () => {
    const bus = new EventBus();
    const off = bus.on("recovery:found", () => undefined);
    expect(bus.listenerCount("recovery:found")).toBe(1);
    off();
    expect(bus.listenerCount("recovery:found")).toBe(0);
  });

  it("keeps emitting when one subscriber throws", () => {
    const bus = new EventBus();
    const good = vi.fn();
    bus.on("recovery:found", () => {
      throw new Error("boom");
    });
    bus.on("recovery:found", good);
    expect(() => bus.emit("recovery:found", { items: 2 })).not.toThrow();
    expect(good).toHaveBeenCalledOnce();
  });

  it("once only fires a single time and onAny observes every event", () => {
    const bus = new EventBus();
    const once = vi.fn();
    const any = vi.fn();
    bus.once("recovery:found", once);
    bus.onAny(any);
    bus.emit("recovery:found", { items: 1 });
    bus.emit("recovery:found", { items: 2 });
    expect(once).toHaveBeenCalledOnce();
    expect(any).toHaveBeenCalledTimes(2);
  });
});
