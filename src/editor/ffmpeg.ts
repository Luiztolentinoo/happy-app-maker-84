/**
 * Builder de argumentos do FFmpeg para a exportação.
 *
 * REGRA DE SEGURANÇA: nada aqui monta uma linha de comando em string. A saída é
 * sempre um `argv` (array), executado pelo módulo FFmpeg já existente no Rust
 * (`apps/desktop/src-tauri/src/media/ffmpeg.rs`) via sidecar com argumentos
 * separados — não há shell, portanto não há command injection.
 *
 * Cada valor é validado (caminho, extensão, faixas numéricas, codec, encoder)
 * antes de virar argumento. Valores fora do permitido derrubam a exportação com
 * mensagem clara em vez de serem "corrigidos" silenciosamente.
 */

import { ASPECT_PRESET_LIST, sanitizeFileName } from "./presets";
import { computeDurationMs, enabledSegments } from "./timeline";
import type { EditProject, ExportSettings, TextOverlay, Timeline } from "./types";

export class FfmpegArgError extends Error {
  readonly code = "ffmpeg_args_invalid";
}

const ALLOWED_INPUT_EXT = new Set([".mp4", ".mkv", ".mov", ".webm", ".avi", ".m4v"]);
const ENCODER_MAP: Record<
  ExportSettings["encoder"],
  Record<ExportSettings["videoCodec"], string>
> = {
  auto: { h264: "libx264", hevc: "libx265", av1: "libsvtav1" },
  x264: { h264: "libx264", hevc: "libx265", av1: "libsvtav1" },
  nvenc: { h264: "h264_nvenc", hevc: "hevc_nvenc", av1: "av1_nvenc" },
  qsv: { h264: "h264_qsv", hevc: "hevc_qsv", av1: "av1_qsv" },
  amf: { h264: "h264_amf", hevc: "hevc_amf", av1: "av1_amf" },
};

function assert(condition: boolean, message: string): void {
  if (!condition) throw new FfmpegArgError(message);
}

function extensionOf(path: string): string {
  const index = path.lastIndexOf(".");
  return index < 0 ? "" : path.slice(index).toLowerCase();
}

/** Rejeita traversal, argumentos disfarçados de caminho e extensões estranhas. */
export function validateSourcePath(path: string): string {
  assert(path.trim().length > 0, "Caminho de origem vazio.");
  assert(!path.startsWith("-"), "Caminho de origem inválido.");
  assert(!path.includes("\0"), "Caminho de origem inválido.");
  assert(!path.includes(".."), "Caminho de origem não pode conter '..'.");
  assert(
    ALLOWED_INPUT_EXT.has(extensionOf(path)),
    `Extensão não suportada: ${extensionOf(path) || "?"}`,
  );
  return path;
}

export function buildOutputPath(settings: ExportSettings): string {
  const dir = settings.outputDir.replace(/[\\/]+$/, "");
  assert(!dir.includes(".."), "Pasta de destino não pode conter '..'.");
  assert(!dir.startsWith("-"), "Pasta de destino inválida.");
  const name = `${sanitizeFileName(settings.fileName)}.mp4`;
  return dir ? `${dir}/${name}` : name;
}

function escapeFilterValue(value: string): string {
  // Escapa os metacaracteres do parser de filtergraph do FFmpeg.
  return value
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\u2019")
    .replace(/,/g, "\\,")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/;/g, "\\;")
    .replace(/\n/g, " ");
}

function ms(value: number): string {
  return (Math.max(0, Math.round(value)) / 1000).toFixed(3);
}

/** Filtros de escala/crop/padding conforme a proporção e o modo de ajuste. */
export function buildAspectFilters(settings: ExportSettings): string[] {
  const { width, height, fit, aspect } = settings;
  const ratio = ASPECT_PRESET_LIST.find((item) => item.id === aspect)?.ratio ?? null;
  if (aspect === "original" && ratio === null && fit === "fit") {
    return [
      `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
      `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black`,
    ];
  }
  switch (fit) {
    case "fill":
      return [`scale=${width}:${height}`];
    case "crop_center":
      return [
        `scale=${width}:${height}:force_original_aspect_ratio=increase`,
        `crop=${width}:${height}`,
      ];
    case "blur_background":
      // Fundo desfocado: a mesma entrada é escalada duas vezes e sobreposta.
      return [
        `split=2[bg][fg]`,
        `[bg]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},gblur=sigma=28[blurred]`,
        `[fg]scale=${width}:${height}:force_original_aspect_ratio=decrease[fgs]`,
        `[blurred][fgs]overlay=(W-w)/2:(H-h)/2`,
      ];
    case "fit":
    default:
      return [
        `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
        `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black`,
      ];
  }
}

/** Filtro `drawtext` de um overlay, com fade e posição relativa. */
export function buildTextFilter(overlay: TextOverlay, settings: ExportSettings): string {
  assert(overlay.endMs > overlay.startMs, `Texto "${overlay.text}" tem duração zero.`);
  const x = Math.round(overlay.x * settings.width);
  const y = Math.round(overlay.y * settings.height);
  const parts = [
    `text='${escapeFilterValue(overlay.text)}'`,
    `fontsize=${Math.round(overlay.fontSize)}`,
    `fontcolor=${escapeFilterValue(overlay.color)}@${overlay.opacity.toFixed(2)}`,
    `x=${x}-text_w/2`,
    `y=${y}`,
    `enable='between(t,${ms(overlay.startMs)},${ms(overlay.endMs)})'`,
  ];
  if (overlay.background) {
    parts.push("box=1", `boxcolor=${escapeFilterValue(overlay.background)}@0.65`, "boxborderw=16");
  }
  if (overlay.shadow) parts.push("shadowcolor=black@0.7", "shadowx=2", "shadowy=2");
  return `drawtext=${parts.join(":")}`;
}

export interface FfmpegPlan {
  argv: string[];
  outputPath: string;
  /** Filtergraph legível, útil para logs e para os testes. */
  filterGraph: string;
  durationMs: number;
  segments: number;
}

/**
 * Monta o plano completo: um trim por segmento ativo, ajuste de velocidade,
 * volume, concatenação, proporção e textos.
 */
export function buildExportPlan(project: EditProject): FfmpegPlan {
  const source = validateSourcePath(project.source.path);
  const settings = project.exportSettings;
  const timeline: Timeline = project.timeline;
  const segments = enabledSegments(timeline);

  assert(segments.length > 0, "A timeline não tem trechos ativos para exportar.");
  assert(settings.width % 2 === 0 && settings.height % 2 === 0, "Resolução precisa ser par.");
  assert(settings.fps >= 15 && settings.fps <= 240, "FPS fora do intervalo permitido (15–240).");
  assert(
    settings.videoBitrateKbps >= 500 && settings.videoBitrateKbps <= 200_000,
    "Bitrate de vídeo fora do intervalo permitido.",
  );
  const videoEncoder = ENCODER_MAP[settings.encoder]?.[settings.videoCodec];
  assert(Boolean(videoEncoder), "Combinação de encoder e codec não suportada.");

  const outputPath = buildOutputPath(settings);
  const filters: string[] = [];
  const videoLabels: string[] = [];
  const audioLabels: string[] = [];

  segments.forEach((segment, index) => {
    const start = ms(segment.sourceStartMs);
    const end = ms(segment.sourceEndMs);
    const vLabel = `v${index}`;
    const aLabel = `a${index}`;
    const vChain = [`trim=start=${start}:end=${end}`, "setpts=PTS-STARTPTS"];
    if (segment.speed !== 1) vChain.push(`setpts=PTS/${segment.speed.toFixed(3)}`);
    filters.push(`[0:v]${vChain.join(",")}[${vLabel}]`);

    const gain = segment.muted ? 0 : segment.volume;
    const aChain = [`atrim=start=${start}:end=${end}`, "asetpts=PTS-STARTPTS"];
    if (segment.speed !== 1)
      aChain.push(`atempo=${Math.min(2, Math.max(0.5, segment.speed)).toFixed(3)}`);
    aChain.push(`volume=${gain.toFixed(3)}`);
    filters.push(`[0:a]${aChain.join(",")}[${aLabel}]`);

    videoLabels.push(`[${vLabel}]`);
    audioLabels.push(`[${aLabel}]`);
  });

  filters.push(
    `${videoLabels.join("")}${audioLabels.join("")}concat=n=${segments.length}:v=1:a=1[vcat][acat]`,
  );

  const aspectFilters = buildAspectFilters(settings);
  const blurGraph = aspectFilters.some((filter) => filter.includes("[bg]"));
  if (blurGraph) {
    filters.push(`[vcat]${aspectFilters[0]}`);
    filters.push(...aspectFilters.slice(1, -1));
    filters.push(`${aspectFilters[aspectFilters.length - 1]}[vaspect]`);
  } else {
    filters.push(`[vcat]${aspectFilters.join(",")}[vaspect]`);
  }

  const textFilters = timeline.overlays.map((overlay) => buildTextFilter(overlay, settings));
  if (textFilters.length > 0) {
    filters.push(`[vaspect]${textFilters.join(",")}[vout]`);
  } else {
    filters.push("[vaspect]null[vout]");
  }
  filters.push(`[acat]aformat=sample_fmts=fltp:sample_rates=48000[aout]`);

  const filterGraph = filters.join(";");
  const argv = [
    "-hide_banner",
    "-nostdin",
    settings.overwrite ? "-y" : "-n",
    "-i",
    source,
    "-filter_complex",
    filterGraph,
    "-map",
    "[vout]",
    "-map",
    "[aout]",
    "-c:v",
    videoEncoder!,
    "-b:v",
    `${settings.videoBitrateKbps}k`,
    "-r",
    String(settings.fps),
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    settings.audioCodec === "aac" ? "aac" : "libopus",
    "-b:a",
    `${settings.audioBitrateKbps}k`,
    "-movflags",
    "+faststart",
    "-progress",
    "pipe:1",
    outputPath,
  ];

  return {
    argv,
    outputPath,
    filterGraph,
    durationMs: computeDurationMs(timeline),
    segments: segments.length,
  };
}
