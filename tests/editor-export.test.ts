import { describe, expect, it } from "vitest";
import { createTimeline, applyOperation, nextId } from "@/editor/timeline";
import { EditorHistory } from "@/editor/history";
import {
  buildExportPlan,
  buildTextFilter,
  validateSourcePath,
  FfmpegArgError,
} from "@/editor/ffmpeg";
import { estimateExportBytes, resolveExportSettings, sanitizeFileName } from "@/editor/presets";
import { PROJECT_FORMAT_VERSION, type EditProject } from "@/editor/types";

const source = {
  clipId: "clip-1",
  path: "clips/clip-1.mp4",
  durationMs: 30_000,
  width: 1920,
  height: 1080,
  fps: 60,
  codec: "h264",
  hasMicrophoneTrack: true,
  hasApplicationTrack: false,
  available: true,
};

function project(): EditProject {
  return {
    version: PROJECT_FORMAT_VERSION,
    id: "proj-1",
    title: "Ace",
    sourceClipId: source.clipId,
    source,
    timeline: createTimeline({
      durationMs: source.durationMs,
      hasMicrophoneTrack: true,
      hasApplicationTrack: false,
    }),
    exportSettings: resolveExportSettings("discord", source),
    thumbnail: null,
    createdAt: "2028-01-01T00:00:00.000Z",
    updatedAt: "2028-01-01T00:00:00.000Z",
    lastOpenedAt: "2028-01-01T00:00:00.000Z",
  };
}

describe("presets", () => {
  it("resolve vertical preset com dimensões pares", () => {
    const settings = resolveExportSettings("tiktok", source);
    expect(settings.width).toBe(1080);
    expect(settings.height).toBe(1920);
    expect(settings.width % 2).toBe(0);
  });

  it("mantém proporção da origem no preset original", () => {
    const settings = resolveExportSettings("original", source);
    expect(settings.width).toBe(1920);
    expect(settings.height).toBe(1080);
  });

  it("estima tamanho proporcional à duração", () => {
    const settings = resolveExportSettings("discord", source);
    const ten = estimateExportBytes(settings, 10_000);
    const twenty = estimateExportBytes(settings, 20_000);
    expect(twenty).toBeGreaterThan(ten);
    expect(twenty / ten).toBeCloseTo(2, 1);
  });

  it("sanitiza nome de arquivo removendo caminhos e metacaracteres", () => {
    expect(sanitizeFileName("../../etc/passwd; rm -rf")).not.toContain("/");
    expect(sanitizeFileName("../../etc/passwd; rm -rf")).not.toContain(";");
    expect(sanitizeFileName("   ")).toBe("clipcore-export");
  });
});

describe("history", () => {
  it("desfaz e refaz mantendo a timeline", () => {
    const base = createTimeline({
      durationMs: 10_000,
      hasMicrophoneTrack: false,
      hasApplicationTrack: false,
    });
    const history = new EditorHistory(base);
    const op = { kind: "trim", edge: "start", atMs: 2_000 } as const;
    const trimmed = applyOperation(base, op);
    history.push(op, trimmed);

    expect(history.canUndo()).toBe(true);
    expect(history.undo()).toEqual(base);
    expect(history.canRedo()).toBe(true);
    expect(history.redo()).toEqual(trimmed);
  });

  it("agrupa operações contínuas do mesmo tipo", () => {
    let now = 1_000;
    const base = createTimeline({
      durationMs: 10_000,
      hasMicrophoneTrack: false,
      hasApplicationTrack: false,
    });
    const history = new EditorHistory(base, { now: () => now });
    const segId = base.tracks[0]!.segments[0]!.id;

    for (const volume of [0.9, 0.8, 0.7]) {
      const op = { kind: "volume", segmentIds: [segId], volume } as const;
      history.push(op, applyOperation(history.current(), op));
      now += 100;
    }
    expect(history.labels()).toHaveLength(1);

    now += 5_000;
    const op = { kind: "volume", segmentIds: [segId], volume: 0.5 } as const;
    history.push(op, applyOperation(history.current(), op));
    expect(history.labels()).toHaveLength(2);
  });

  it("limpa o redo após nova operação", () => {
    const base = createTimeline({
      durationMs: 10_000,
      hasMicrophoneTrack: false,
      hasApplicationTrack: false,
    });
    const history = new EditorHistory(base);
    const op = { kind: "split", atMs: 5_000 } as const;
    history.push(op, applyOperation(base, op));
    history.undo();
    expect(history.canRedo()).toBe(true);
    history.push(op, applyOperation(history.current(), op));
    expect(history.canRedo()).toBe(false);
  });
});

describe("ffmpeg plan", () => {
  it("gera argv com trim, concat e escala", () => {
    const plan = buildExportPlan(project());
    expect(plan.argv).toContain("-filter_complex");
    expect(plan.filterGraph).toContain("trim=start=");
    expect(plan.filterGraph).toContain("concat=n=1");
    expect(plan.filterGraph).toContain("scale=1920:1080");
    expect(plan.outputPath.endsWith(".mp4")).toBe(true);
  });

  it("adiciona um trim por segmento após split", () => {
    const base = project();
    const timeline = applyOperation(base.timeline, { kind: "split", atMs: 12_000 });
    const plan = buildExportPlan({ ...base, timeline });
    expect(plan.segments).toBe(2);
    expect(plan.filterGraph).toContain("concat=n=2");
  });

  it("usa fundo desfocado no preset vertical", () => {
    const base = project();
    const plan = buildExportPlan({
      ...base,
      exportSettings: resolveExportSettings("shorts", source),
    });
    expect(plan.filterGraph).toContain("gblur=sigma=28");
    expect(plan.filterGraph).toContain("overlay=(W-w)/2:(H-h)/2");
  });

  it("recusa caminho com traversal ou flag", () => {
    expect(() => validateSourcePath("../secret.mp4")).toThrow(FfmpegArgError);
    expect(() => validateSourcePath("-i")).toThrow(FfmpegArgError);
    expect(() => validateSourcePath("clip.exe")).toThrow(FfmpegArgError);
  });

  it("escapa metacaracteres do filtergraph no drawtext", () => {
    const settings = resolveExportSettings("discord", source);
    const filter = buildTextFilter(
      {
        id: nextId("txt"),
        text: "GG: pwn,ed [x]",
        startMs: 0,
        endMs: 1_000,
        x: 0.5,
        y: 0.1,
        fontSize: 48,
        fontFamily: "display",
        fontWeight: 700,
        color: "#FFFFFF",
        background: null,
        align: "center",
        opacity: 1,
        fadeInMs: 0,
        fadeOutMs: 0,
        shadow: false,
      },
      settings,
    );
    expect(filter).toContain("\\:");
    expect(filter).toContain("\\,");
    expect(filter).toContain("\\[");
  });

  it("falha quando não há trechos ativos", () => {
    const base = project();
    const ids = base.timeline.tracks[0]!.segments.map((segment) => segment.id);
    const timeline = applyOperation(base.timeline, { kind: "remove", segmentIds: ids });
    expect(() => buildExportPlan({ ...base, timeline })).toThrow(FfmpegArgError);
  });
});
