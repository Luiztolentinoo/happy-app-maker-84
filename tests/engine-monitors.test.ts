import { describe, expect, it, vi } from "vitest";

import { EventBus } from "@/engine/eventBus";
import { MetricsRegistry } from "@/engine/metrics";
import {
  EncoderMonitor,
  FpsMonitor,
  MemoryMonitor,
  PerformanceMonitor,
  UsageMonitor,
  type PerformanceSample,
} from "@/engine/monitors";

function monitor(overrides: Partial<PerformanceSample> = {}, thresholds = {}) {
  const fps = new FpsMonitor(60);
  const encoder = new EncoderMonitor();
  const perf = new PerformanceMonitor({
    fps,
    encoder,
    gpu: new UsageMonitor("gpu", () => overrides.gpuPercent ?? 0),
    cpu: new UsageMonitor("cpu", () => overrides.cpuPercent ?? 0),
    memory: new MemoryMonitor(() => overrides.memoryMb ?? 0),
    thresholds,
    bus: new EventBus(),
    metrics: new MetricsRegistry(),
    now: () => 1_000,
  });
  return { perf, fps, encoder };
}

describe("FpsMonitor", () => {
  it("counts frames inside the last second only", () => {
    const fps = new FpsMonitor(60);
    fps.frame(1_000);
    fps.frame(1_500);
    fps.frame(2_400);
    expect(fps.sample().fps).toBe(2);
  });

  it("accumulates dropped frames", () => {
    const fps = new FpsMonitor(60);
    fps.drop(3);
    fps.drop();
    expect(fps.sample().droppedFrames).toBe(4);
  });
});

describe("EncoderMonitor and MemoryMonitor", () => {
  it("reports lag, queue depth and memory", () => {
    const encoder = new EncoderMonitor();
    encoder.report(120, 4);
    expect(encoder.sample()).toEqual({ lagMs: 120, queued: 4 });
    expect(new MemoryMonitor(() => 512).sample()).toEqual({ usedMb: 512 });
  });
});

describe("PerformanceMonitor", () => {
  it("aggregates every monitor into one sample", async () => {
    const { perf, fps, encoder } = monitor({ gpuPercent: 40, cpuPercent: 20, memoryMb: 900 });
    fps.frame(1_000);
    encoder.report(30, 1);
    const sample = await perf.sample();
    expect(sample).toMatchObject({
      fps: 1,
      targetFps: 60,
      gpuPercent: 40,
      cpuPercent: 20,
      memoryMb: 900,
      encodeLagMs: 30,
      encoderQueue: 1,
    });
  });

  it("degrades on dropped frames, encoder lag, gpu and cpu pressure", () => {
    const { perf } = monitor();
    const base: PerformanceSample = {
      at: 0,
      fps: 60,
      targetFps: 60,
      droppedFrames: 0,
      gpuPercent: 10,
      cpuPercent: 10,
      memoryMb: 100,
      encodeLagMs: 0,
      encoderQueue: 0,
    };
    expect(perf.shouldDegrade(base)).toBeNull();
    expect(perf.shouldDegrade({ ...base, droppedFrames: 100 })).toContain("quadros perdidos");
    expect(perf.shouldDegrade({ ...base, encodeLagMs: 900 })).toContain("encoder");
    expect(perf.shouldDegrade({ ...base, fps: 20 })).toContain("FPS");
    expect(perf.shouldDegrade({ ...base, gpuPercent: 99 })).toContain("GPU");
    expect(perf.shouldDegrade({ ...base, cpuPercent: 99 })).toContain("CPU");
  });

  it("emits degraded then recovered on the bus", async () => {
    const bus = new EventBus();
    const degraded = vi.fn();
    const recovered = vi.fn();
    bus.on("performance:degraded", degraded);
    bus.on("performance:recovered", recovered);
    const encoder = new EncoderMonitor();
    const perf = new PerformanceMonitor({
      encoder,
      bus,
      metrics: new MetricsRegistry(),
    });
    encoder.report(900, 8);
    await perf.sample();
    expect(degraded).toHaveBeenCalledOnce();
    expect(perf.reason()).toContain("encoder");
    encoder.report(0, 0);
    await perf.sample();
    expect(recovered).toHaveBeenCalledOnce();
    expect(perf.reason()).toBeNull();
  });
});
