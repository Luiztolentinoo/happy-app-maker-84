import { describe, expect, it } from "vitest";

import { EngineLogger } from "@/engine/logger";
import { EventBus } from "@/engine/eventBus";
import { MetricsRegistry } from "@/engine/metrics";

describe("EngineLogger", () => {
  const make = (capacity = 3) =>
    new EngineLogger({ capacity, mirrorToConsole: false, bus: new EventBus(), now: () => 42 });

  it("keeps only the last N entries", () => {
    const logger = make(2);
    const scoped = logger.child("capture");
    scoped.info("a");
    scoped.info("b");
    scoped.info("c");
    expect(logger.recent().map((entry) => entry.message)).toEqual(["c", "b"]);
  });

  it("filters below the minimum level", () => {
    const logger = new EngineLogger({
      minLevel: "warn",
      mirrorToConsole: false,
      bus: new EventBus(),
    });
    const scoped = logger.child("encoder");
    scoped.debug("ignored");
    scoped.error("kept");
    expect(logger.recent()).toHaveLength(1);
  });

  it("republishes entries on the bus", () => {
    const bus = new EventBus();
    const seen: string[] = [];
    bus.on("log:entry", (entry) => seen.push(entry.message));
    new EngineLogger({ bus, mirrorToConsole: false }).child("buffer").warn("evicted");
    expect(seen).toEqual(["evicted"]);
  });
});

describe("MetricsRegistry", () => {
  it("tracks counters, gauges and histograms", () => {
    const metrics = new MetricsRegistry();
    metrics.increment("clips", 2);
    metrics.increment("clips");
    metrics.gauge("fps", 59);
    for (const value of [10, 20, 30, 40]) metrics.observe("lag", value);
    expect(metrics.counter("clips")).toBe(3);
    expect(metrics.gaugeValue("fps")).toBe(59);
    expect(metrics.histogram("lag")).toMatchObject({ count: 4, min: 10, max: 40, avg: 25 });
    expect(metrics.snapshot().counters["clips"]).toBe(3);
  });

  it("keeps only the configured sample window", () => {
    const metrics = new MetricsRegistry(2);
    for (const value of [1, 2, 3]) metrics.observe("lag", value);
    expect(metrics.histogram("lag")?.count).toBe(2);
  });
});
