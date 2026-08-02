/**
 * Presets de proporção e de exportação + estimativas.
 *
 * Todos os valores aqui são validados pelo Zod de `types.ts` antes de chegar ao
 * backend, e o builder de FFmpeg só aceita presets/valores desta lista.
 */

import type { AspectFitMode, AspectRatioPreset, ExportSettings, SourceMedia } from "./types";

export interface AspectPresetInfo {
  id: AspectRatioPreset;
  label: string;
  /** null = mantém a proporção da origem. */
  ratio: number | null;
  hint: string;
}

export const ASPECT_PRESET_LIST: AspectPresetInfo[] = [
  { id: "original", label: "Original", ratio: null, hint: "Mantém o enquadramento do clipe" },
  { id: "16:9", label: "16:9", ratio: 16 / 9, hint: "YouTube, Discord, monitores" },
  { id: "9:16", label: "9:16", ratio: 9 / 16, hint: "TikTok, Shorts, Reels" },
  { id: "1:1", label: "1:1", ratio: 1, hint: "Feed quadrado" },
  { id: "4:5", label: "4:5", ratio: 4 / 5, hint: "Feed vertical do Instagram" },
];

export const FIT_MODE_LABELS: Record<AspectFitMode, string> = {
  fit: "Ajustar (barras)",
  fill: "Preencher",
  crop_center: "Crop central",
  blur_background: "Fundo desfocado",
};

/** Safe areas aproximadas (fração do frame) das plataformas verticais. */
export const SAFE_AREAS = [
  { id: "tiktok", label: "TikTok", top: 0.08, bottom: 0.22, left: 0.05, right: 0.18 },
  { id: "shorts", label: "Shorts", top: 0.1, bottom: 0.18, left: 0.05, right: 0.14 },
  { id: "reels", label: "Reels", top: 0.09, bottom: 0.24, left: 0.05, right: 0.16 },
] as const;

export interface ExportPreset {
  id: string;
  label: string;
  hint: string;
  aspect: AspectRatioPreset;
  fit: AspectFitMode;
  /** null = herdar da origem. */
  width: number | null;
  height: number | null;
  fps: number | null;
  videoBitrateKbps: number;
  audioBitrateKbps: number;
  videoCodec: ExportSettings["videoCodec"];
  audioCodec: ExportSettings["audioCodec"];
}

export const EXPORT_PRESETS: ExportPreset[] = [
  {
    id: "original",
    label: "Original",
    hint: "Mesma resolução e proporção do clipe",
    aspect: "original",
    fit: "fit",
    width: null,
    height: null,
    fps: null,
    videoBitrateKbps: 12_000,
    audioBitrateKbps: 192,
    videoCodec: "h264",
    audioCodec: "aac",
  },
  {
    id: "discord",
    label: "Discord",
    hint: "1080p leve, cabe no limite de upload",
    aspect: "16:9",
    fit: "fit",
    width: 1920,
    height: 1080,
    fps: 60,
    videoBitrateKbps: 6_000,
    audioBitrateKbps: 128,
    videoCodec: "h264",
    audioCodec: "aac",
  },
  {
    id: "youtube",
    label: "YouTube",
    hint: "1440p60 alta qualidade",
    aspect: "16:9",
    fit: "fit",
    width: 2560,
    height: 1440,
    fps: 60,
    videoBitrateKbps: 24_000,
    audioBitrateKbps: 256,
    videoCodec: "h264",
    audioCodec: "aac",
  },
  {
    id: "shorts",
    label: "YouTube Shorts",
    hint: "Vertical 1080×1920",
    aspect: "9:16",
    fit: "blur_background",
    width: 1080,
    height: 1920,
    fps: 60,
    videoBitrateKbps: 12_000,
    audioBitrateKbps: 192,
    videoCodec: "h264",
    audioCodec: "aac",
  },
  {
    id: "tiktok",
    label: "TikTok",
    hint: "Vertical com crop central",
    aspect: "9:16",
    fit: "crop_center",
    width: 1080,
    height: 1920,
    fps: 60,
    videoBitrateKbps: 10_000,
    audioBitrateKbps: 192,
    videoCodec: "h264",
    audioCodec: "aac",
  },
  {
    id: "reels",
    label: "Instagram Reels",
    hint: "Vertical com fundo desfocado",
    aspect: "9:16",
    fit: "blur_background",
    width: 1080,
    height: 1920,
    fps: 30,
    videoBitrateKbps: 9_000,
    audioBitrateKbps: 192,
    videoCodec: "h264",
    audioCodec: "aac",
  },
  {
    id: "light",
    label: "Arquivo leve",
    hint: "720p30, ideal para enviar rápido",
    aspect: "16:9",
    fit: "fit",
    width: 1280,
    height: 720,
    fps: 30,
    videoBitrateKbps: 3_000,
    audioBitrateKbps: 128,
    videoCodec: "h264",
    audioCodec: "aac",
  },
  {
    id: "high",
    label: "Alta qualidade",
    hint: "HEVC 4K quando a origem permite",
    aspect: "original",
    fit: "fit",
    width: 3840,
    height: 2160,
    fps: 60,
    videoBitrateKbps: 60_000,
    audioBitrateKbps: 320,
    videoCodec: "hevc",
    audioCodec: "aac",
  },
  {
    id: "custom",
    label: "Personalizado",
    hint: "Você define resolução, FPS e bitrate",
    aspect: "original",
    fit: "fit",
    width: null,
    height: null,
    fps: null,
    videoBitrateKbps: 12_000,
    audioBitrateKbps: 192,
    videoCodec: "h264",
    audioCodec: "aac",
  },
];

export function findExportPreset(id: string): ExportPreset {
  return EXPORT_PRESETS.find((preset) => preset.id === id) ?? EXPORT_PRESETS[0]!;
}

/** Resolve o preset contra a mídia de origem, mantendo tudo dentro dos limites. */
export function resolveExportSettings(
  presetId: string,
  source: Pick<SourceMedia, "width" | "height" | "fps">,
  overrides: Partial<ExportSettings> = {},
): ExportSettings {
  const preset = findExportPreset(presetId);
  const aspect = overrides.aspect ?? preset.aspect;
  const ratio = ASPECT_PRESET_LIST.find((item) => item.id === aspect)?.ratio ?? null;

  let width = preset.width ?? source.width;
  let height = preset.height ?? source.height;
  if (ratio !== null && preset.width === null) {
    // Deriva a altura/largura mantendo a maior dimensão da origem.
    if (ratio < 1) {
      height = source.height;
      width = Math.round(height * ratio);
    } else {
      width = source.width;
      height = Math.round(width / ratio);
    }
  }
  const even = (value: number) => Math.max(64, value - (value % 2));

  return {
    presetId: preset.id,
    fileName: overrides.fileName ?? "clipcore-export",
    outputDir: overrides.outputDir ?? "",
    width: even(overrides.width ?? width),
    height: even(overrides.height ?? height),
    fps: Math.round(overrides.fps ?? preset.fps ?? source.fps),
    videoCodec: overrides.videoCodec ?? preset.videoCodec,
    audioCodec: overrides.audioCodec ?? preset.audioCodec,
    videoBitrateKbps: overrides.videoBitrateKbps ?? preset.videoBitrateKbps,
    audioBitrateKbps: overrides.audioBitrateKbps ?? preset.audioBitrateKbps,
    encoder: overrides.encoder ?? "auto",
    aspect,
    fit: overrides.fit ?? preset.fit,
    overwrite: overrides.overwrite ?? false,
  };
}

/** Tamanho estimado do arquivo final em bytes. */
export function estimateExportBytes(settings: ExportSettings, durationMs: number): number {
  const seconds = Math.max(0, durationMs) / 1000;
  const totalKbps = settings.videoBitrateKbps + settings.audioBitrateKbps;
  // 3% de overhead de container (moov atom, índices).
  return Math.round(((totalKbps * 1000 * seconds) / 8) * 1.03);
}

/**
 * Tempo estimado de render. Encoders de hardware processam bem acima do
 * tempo real; x264 fica próximo de 1x em 1080p.
 */
export function estimateExportMs(settings: ExportSettings, durationMs: number): number {
  const pixels = settings.width * settings.height;
  const base = settings.encoder === "x264" ? 1.15 : 0.28;
  const load = pixels / (1920 * 1080);
  return Math.round(durationMs * base * Math.max(0.5, load));
}

/** Nome de arquivo seguro: nunca chega caminho ou metacaractere ao FFmpeg. */
export function sanitizeFileName(name: string): string {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "");
  return (cleaned || "clipcore-export").slice(0, 120);
}
