/**
 * Modelo de dados do editor não destrutivo do ClipCore.
 *
 * O arquivo original NUNCA é alterado: um `EditProject` guarda apenas a
 * referência ao clipe de origem, a timeline (operações resolvidas em segmentos)
 * e as configurações de exportação. O arquivo final só nasce na exportação.
 *
 * Todo projeto persistido é validado por Zod e carrega `version`, para permitir
 * migrations do formato (ver `migrateProject`).
 */

import { z } from "zod";

/** Versão atual do formato de projeto. Incremente ao mudar o schema. */
export const PROJECT_FORMAT_VERSION = 2;

export const ASPECT_PRESETS = ["original", "16:9", "9:16", "1:1", "4:5"] as const;
export type AspectRatioPreset = (typeof ASPECT_PRESETS)[number];

export const FIT_MODES = ["fit", "fill", "crop_center", "blur_background"] as const;
export type AspectFitMode = (typeof FIT_MODES)[number];

export const TRACK_TYPES = [
  "video",
  "game_audio",
  "microphone",
  "application_audio",
  "text",
  "overlay",
] as const;
export type TimelineTrackType = (typeof TRACK_TYPES)[number];

export const EXPORT_STAGES = [
  "queued",
  "preparing",
  "rendering",
  "encoding",
  "finalizing",
  "completed",
  "cancelled",
  "failed",
] as const;
export type ExportStage = (typeof EXPORT_STAGES)[number];

/* ------------------------------------------------------------------ schemas */

export const timelineSegmentSchema = z.object({
  id: z.string().min(1),
  sourceStartMs: z.number().min(0),
  sourceEndMs: z.number().min(0),
  timelineStartMs: z.number().min(0),
  timelineEndMs: z.number().min(0),
  /** 0.25x a 4x. */
  speed: z.number().min(0.25).max(4).default(1),
  /** 0 a 2 (0 = silêncio, 1 = original, 2 = +6 dB). */
  volume: z.number().min(0).max(2).default(1),
  muted: z.boolean().default(false),
  enabled: z.boolean().default(true),
});

export const textOverlaySchema = z.object({
  id: z.string().min(1),
  text: z.string().max(240),
  startMs: z.number().min(0),
  endMs: z.number().min(0),
  /** Posição relativa (0-1) dentro do frame. */
  x: z.number().min(0).max(1).default(0.5),
  y: z.number().min(0).max(1).default(0.12),
  fontSize: z.number().min(8).max(160).default(48),
  /** Apenas fontes locais/redistribuíveis — nunca fontes remotas em runtime. */
  fontFamily: z.enum(["display", "body", "mono"]).default("display"),
  fontWeight: z.union([z.literal(400), z.literal(600), z.literal(700)]).default(700),
  color: z.string().min(3).max(32).default("#F4F7FF"),
  background: z.string().max(32).nullable().default(null),
  align: z.enum(["left", "center", "right"]).default("center"),
  opacity: z.number().min(0).max(1).default(1),
  fadeInMs: z.number().min(0).max(5_000).default(180),
  fadeOutMs: z.number().min(0).max(5_000).default(180),
  shadow: z.boolean().default(true),
});

export const timelineTrackSchema = z.object({
  id: z.string().min(1),
  type: z.enum(TRACK_TYPES),
  label: z.string().min(1),
  order: z.number().int().min(0),
  muted: z.boolean().default(false),
  locked: z.boolean().default(false),
  hidden: z.boolean().default(false),
  /** 0 a 2, aplicado sobre o volume dos segmentos. */
  gain: z.number().min(0).max(2).default(1),
  /** Sinaliza faixas que o arquivo de origem não possui de fato. */
  available: z.boolean().default(true),
  segments: z.array(timelineSegmentSchema).default([]),
});

export const timelineMarkerSchema = z.object({
  id: z.string().min(1),
  atMs: z.number().min(0),
  label: z.string().max(80),
});

export const cropSchema = z.object({
  aspect: z.enum(ASPECT_PRESETS).default("original"),
  fit: z.enum(FIT_MODES).default("fit"),
  /** Offset horizontal/vertical do crop (0-1, 0.5 = centro). */
  offsetX: z.number().min(0).max(1).default(0.5),
  offsetY: z.number().min(0).max(1).default(0.5),
  safeAreas: z.boolean().default(false),
  grid: z.boolean().default(false),
});

export const timelineSchema = z.object({
  durationMs: z.number().min(0),
  playheadMs: z.number().min(0).default(0),
  /** Pixels por segundo na régua. */
  zoom: z.number().min(4).max(400).default(40),
  snapMs: z.number().min(0).max(5_000).default(100),
  tracks: z.array(timelineTrackSchema),
  selection: z.array(z.string()).default([]),
  markers: z.array(timelineMarkerSchema).default([]),
  overlays: z.array(textOverlaySchema).default([]),
  crop: cropSchema.default({
    aspect: "original",
    fit: "fit",
    offsetX: 0.5,
    offsetY: 0.5,
    safeAreas: false,
    grid: false,
  }),
});

export const sourceMediaSchema = z.object({
  clipId: z.string().min(1),
  path: z.string().min(1),
  durationMs: z.number().min(0),
  width: z.number().int().min(1),
  height: z.number().int().min(1),
  fps: z.number().min(1),
  codec: z.string().min(1),
  hasMicrophoneTrack: z.boolean().default(false),
  hasApplicationTrack: z.boolean().default(false),
  /** Preenchido por `validate_source_media`; null enquanto não verificado. */
  available: z.boolean().nullable().default(null),
});

export const exportSettingsSchema = z.object({
  presetId: z.string().min(1).default("original"),
  fileName: z.string().min(1).max(160).default("clipcore-export"),
  outputDir: z.string().default(""),
  width: z.number().int().min(64).max(7680),
  height: z.number().int().min(64).max(4320),
  fps: z.number().int().min(15).max(240),
  videoCodec: z.enum(["h264", "hevc", "av1"]).default("h264"),
  audioCodec: z.enum(["aac", "opus"]).default("aac"),
  videoBitrateKbps: z.number().int().min(500).max(200_000),
  audioBitrateKbps: z.number().int().min(64).max(512).default(192),
  encoder: z.enum(["auto", "nvenc", "qsv", "amf", "x264"]).default("auto"),
  aspect: z.enum(ASPECT_PRESETS).default("original"),
  fit: z.enum(FIT_MODES).default("fit"),
  overwrite: z.boolean().default(false),
});

export const editProjectSchema = z.object({
  version: z.number().int().min(1),
  id: z.string().min(1),
  title: z.string().min(1).max(160),
  sourceClipId: z.string().min(1),
  source: sourceMediaSchema,
  timeline: timelineSchema,
  exportSettings: exportSettingsSchema,
  thumbnail: z.string().nullable().default(null),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  lastOpenedAt: z.string().min(1),
});

export const exportJobSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  outputPath: z.string(),
  presetId: z.string().min(1),
  progress: z.number().min(0).max(1),
  stage: z.enum(EXPORT_STAGES),
  simulated: z.boolean(),
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  error: z.string().nullable(),
  cancellable: z.boolean(),
  etaMs: z.number().nullable(),
});

/* -------------------------------------------------------------------- types */

export type TimelineSegment = z.infer<typeof timelineSegmentSchema>;
export type TextOverlay = z.infer<typeof textOverlaySchema>;
export type TimelineTrack = z.infer<typeof timelineTrackSchema>;
export type TimelineMarker = z.infer<typeof timelineMarkerSchema>;
export type CropOperation = z.infer<typeof cropSchema>;
export type Timeline = z.infer<typeof timelineSchema>;
export type SourceMedia = z.infer<typeof sourceMediaSchema>;
export type ExportSettings = z.infer<typeof exportSettingsSchema>;
export type EditProject = z.infer<typeof editProjectSchema>;
export type ExportJob = z.infer<typeof exportJobSchema>;

export interface ExportProgress {
  jobId: string;
  stage: ExportStage;
  progress: number;
  etaMs: number | null;
}

/** Operações declarativas — a base do undo/redo e da persistência. */
export type TrimOperation = { kind: "trim"; edge: "start" | "end"; atMs: number };
export type SplitOperation = { kind: "split"; atMs: number };
export type RemoveOperation = { kind: "remove"; segmentIds: string[] };
export type RestoreOperation = { kind: "restore"; segmentIds: string[] };
export type ReorderOperation = { kind: "reorder"; segmentId: string; toIndex: number };
export type SpeedOperation = { kind: "speed"; segmentIds: string[]; speed: number };
export type AudioOperation =
  | { kind: "volume"; segmentIds: string[]; volume: number }
  | { kind: "mute"; segmentIds: string[]; muted: boolean }
  | { kind: "track_gain"; trackId: string; gain: number }
  | { kind: "track_mute"; trackId: string; muted: boolean };
export type TextOperation =
  | { kind: "text_add"; overlay: TextOverlay }
  | { kind: "text_update"; id: string; patch: Partial<TextOverlay> }
  | { kind: "text_remove"; id: string };
export type AspectOperation = { kind: "aspect"; patch: Partial<CropOperation> };
export type MarkerOperation =
  | { kind: "marker_add"; marker: TimelineMarker }
  | { kind: "marker_remove"; id: string };

export type EditorOperation =
  | TrimOperation
  | SplitOperation
  | RemoveOperation
  | RestoreOperation
  | ReorderOperation
  | SpeedOperation
  | AudioOperation
  | TextOperation
  | AspectOperation
  | MarkerOperation;

export interface EditorHistoryEntry {
  id: string;
  label: string;
  operation: EditorOperation;
  timeline: Timeline;
  at: number;
}

/* ---------------------------------------------------------------- migrations */

/** Registro de migrations do formato de projeto, aplicadas em ordem. */
const MIGRATIONS: Array<{ to: number; migrate: (raw: Record<string, unknown>) => Record<string, unknown> }> = [
  {
    to: 2,
    // v1 guardava apenas `{ trimStartMs, trimEndMs }` e não tinha crop/overlays.
    migrate: (raw) => {
      const timeline = (raw["timeline"] ?? {}) as Record<string, unknown>;
      return {
        ...raw,
        timeline: {
          ...timeline,
          overlays: timeline["overlays"] ?? [],
          markers: timeline["markers"] ?? [],
          snapMs: timeline["snapMs"] ?? 100,
          crop:
            timeline["crop"] ??
            { aspect: "original", fit: "fit", offsetX: 0.5, offsetY: 0.5, safeAreas: false, grid: false },
        },
      };
    },
  },
];

export type ProjectParseResult =
  | { ok: true; project: EditProject; migratedFrom: number | null }
  | { ok: false; error: string };

/**
 * Aplica migrations e valida. Nunca lança: um projeto corrompido devolve
 * `{ ok: false }` para a UI mostrar o estado "projeto incompatível" em vez de
 * sobrescrever dados do usuário.
 */
export function parseProject(input: unknown): ProjectParseResult {
  if (!input || typeof input !== "object") return { ok: false, error: "Projeto vazio ou inválido." };
  let raw = { ...(input as Record<string, unknown>) };
  const from = typeof raw["version"] === "number" ? (raw["version"] as number) : 1;
  if (from > PROJECT_FORMAT_VERSION) {
    return { ok: false, error: `Projeto criado em uma versão mais nova (v${from}).` };
  }
  for (const migration of MIGRATIONS) {
    if (from < migration.to) raw = migration.migrate(raw);
  }
  raw["version"] = PROJECT_FORMAT_VERSION;
  const parsed = editProjectSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Projeto inválido." };
  }
  return { ok: true, project: parsed.data, migratedFrom: from === PROJECT_FORMAT_VERSION ? null : from };
}
