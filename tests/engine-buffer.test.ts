import { describe, expect, it } from "vitest";

import { CircularBuffer } from "@/engine/circularBuffer";
import { EventBus } from "@/engine/eventBus";
import { MetricsRegistry } from "@/engine/metrics";
import type { BufferSegment } from "@/engine/contracts";

function segment(id: string, durationMs = 2_000, bytes = 1_000): BufferSegment {
  return { id, startedAtMs: 0, durationMs, bytes, pinned: false };
}

function makeBuffer(seconds: number, bytesLimit = 0) {
  return new CircularBuffer({
    capacitySeconds: seconds,
    ...(bytesLimit ? { capacityBytes: bytesLimit } : {}),
    bus: new EventBus(),
    metrics: new MetricsRegistry(),
  });
}

describe("CircularBuffer", () => {
  it("evicts the oldest segments beyond the time capacity", () => {
    const buffer = makeBuffer(4);
    buffer.push(segment("a"));
    buffer.push(segment("b"));
    buffer.push(segment("c"));
    const stats = buffer.stats();
    expect(stats.segments).toBe(2);
    expect(stats.bufferedMs).toBe(4_000);
    expect(stats.evictions).toBe(1);
  });

  it("evicts on the byte limit as well", () => {
    const buffer = makeBuffer(600, 2_500);
    buffer.push(segment("a"));
    buffer.push(segment("b"));
    buffer.push(segment("c"));
    expect(buffer.stats().bytes).toBeLessThanOrEqual(2_500);
  });

  it("never drops pinned segments while a writer owns them", () => {
    const buffer = makeBuffer(4);
    buffer.push(segment("a"));
    buffer.push(segment("b"));
    const pinned = buffer.pinLast(4);
    expect(pinned.map((s) => s.id)).toEqual(["a", "b"]);
    buffer.push(segment("c"));
    // over capacity: only the unpinned newcomer may go, the pinned window stays.
    expect(buffer.stats().segments).toBe(2);
    buffer.release(["a", "b"]);
    expect(buffer.stats().segments).toBe(2);
  });

  it("pins only the requested window", () => {
    const buffer = makeBuffer(60);
    for (const id of ["a", "b", "c", "d", "e"]) buffer.push(segment(id));
    expect(buffer.pinLast(4).map((s) => s.id)).toEqual(["d", "e"]);
  });

  it("shrinking the capacity evicts immediately", () => {
    const buffer = makeBuffer(60);
    for (const id of ["a", "b", "c"]) buffer.push(segment(id));
    buffer.setCapacitySeconds(2);
    expect(buffer.stats().segments).toBe(1);
  });
});
