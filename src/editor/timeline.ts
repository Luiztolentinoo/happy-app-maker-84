/**
 * Operações puras sobre a timeline.
 *
 * Todas as funções são imutáveis: recebem uma `Timeline` e devolvem outra. Isso
 * dá reversibilidade (undo/redo por snapshot leve), testabilidade e garante que
 * nada aqui toca no arquivo de vídeo original.
 */

import type {
  CropOperation,
  EditorOperation,
  Timeline,
  TimelineMarker,
  TimelineSegment,
  TimelineTrack,
  TimelineTrackType,
  TextOverlay,
} from "./types";

let counter = 0;
/** Id determinístico o suficiente e seguro para SSR (sem crypto no módulo). */
export function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
}

export function segmentDurationMs(segment: TimelineSegment): number {
  return Math.max(0, segment.timelineEndMs - segment.timelineStartMs);
}

/** Duração de origem consumida por um segmento (antes da velocidade). */
export function sourceDurationMs(segment: TimelineSegment): number {
  return Math.max(0, segment.sourceEndMs - segment.sourceStartMs);
}

export function videoTrack(timeline: Timeline): TimelineTrack | undefined {
  return timeline.tracks.find((track) => track.type === "video");
}

export function enabledSegments(timeline: Timeline): TimelineSegment[] {
  return (videoTrack(timeline)?.segments ?? []).filter((segment) => segment.enabled);
}

/** Duração final do vídeo exportado, considerando velocidade e remoções. */
export function computeDurationMs(timeline: Timeline): number {
  return enabledSegments(timeline).reduce(
    (total, segment) => total + segmentDurationMs(segment),
    0,
  );
}

/** Reencadeia os segmentos ativos para que a timeline não tenha buracos. */
export function reflow(timeline: Timeline): Timeline {
  const tracks = timeline.tracks.map((track) => {
    if (track.type !== "video") return track;
    let cursor = 0;
    const segments = track.segments.map((segment) => {
      if (!segment.enabled) return { ...segment };
      const duration = Math.max(1, Math.round(sourceDurationMs(segment) / segment.speed));
      const next = { ...segment, timelineStartMs: cursor, timelineEndMs: cursor + duration };
      cursor += duration;
      return next;
    });
    return { ...track, segments };
  });
  const next: Timeline = { ...timeline, tracks };
  const durationMs = computeDurationMs(next);
  return { ...next, durationMs, playheadMs: Math.min(next.playheadMs, durationMs) };
}

/** Converte um instante da timeline para o instante correspondente na origem. */
export function timelineToSource(timeline: Timeline, timelineMs: number): number | null {
  for (const segment of enabledSegments(timeline)) {
    if (timelineMs >= segment.timelineStartMs && timelineMs <= segment.timelineEndMs) {
      const offset = (timelineMs - segment.timelineStartMs) * segment.speed;
      return segment.sourceStartMs + offset;
    }
  }
  return null;
}

/** Converte um instante da origem para a posição na timeline (ou null se cortado). */
export function sourceToTimeline(timeline: Timeline, sourceMs: number): number | null {
  for (const segment of enabledSegments(timeline)) {
    if (sourceMs >= segment.sourceStartMs && sourceMs <= segment.sourceEndMs) {
      return segment.timelineStartMs + (sourceMs - segment.sourceStartMs) / segment.speed;
    }
  }
  return null;
}

export function snap(timeline: Timeline, ms: number): number {
  if (timeline.snapMs <= 0) return Math.max(0, Math.round(ms));
  return Math.max(0, Math.round(ms / timeline.snapMs) * timeline.snapMs);
}

function mapVideoSegments(
  timeline: Timeline,
  fn: (segments: TimelineSegment[]) => TimelineSegment[],
): Timeline {
  return {
    ...timeline,
    tracks: timeline.tracks.map((track) =>
      track.type === "video" && !track.locked ? { ...track, segments: fn(track.segments) } : track,
    ),
  };
}

function patchSegments(
  timeline: Timeline,
  ids: string[],
  patch: (segment: TimelineSegment) => TimelineSegment,
): Timeline {
  const set = new Set(ids);
  return mapVideoSegments(timeline, (segments) =>
    segments.map((segment) => (set.has(segment.id) ? patch(segment) : segment)),
  );
}

/** Corta o início ou o fim: descarta a origem fora do ponto, sem tocar no arquivo. */
export function trim(timeline: Timeline, edge: "start" | "end", atMs: number): Timeline {
  const at = snap(timeline, atMs);
  const next = mapVideoSegments(timeline, (segments) =>
    segments
      .map((segment) => {
        if (!segment.enabled) return segment;
        if (edge === "start") {
          if (segment.timelineEndMs <= at) return { ...segment, enabled: false };
          if (segment.timelineStartMs >= at) return segment;
          const cut = (at - segment.timelineStartMs) * segment.speed;
          return { ...segment, sourceStartMs: segment.sourceStartMs + cut };
        }
        if (segment.timelineStartMs >= at) return { ...segment, enabled: false };
        if (segment.timelineEndMs <= at) return segment;
        const keep = (at - segment.timelineStartMs) * segment.speed;
        return { ...segment, sourceEndMs: segment.sourceStartMs + keep };
      })
      .filter((segment) => segment.enabled === false || sourceDurationMs(segment) > 0),
  );
  return reflow(next);
}

/** Divide o segmento sob o playhead em dois, mantendo tudo reversível. */
export function split(timeline: Timeline, atMs: number): Timeline {
  const at = snap(timeline, atMs);
  const next = mapVideoSegments(timeline, (segments) => {
    const out: TimelineSegment[] = [];
    for (const segment of segments) {
      const inside =
        segment.enabled && at > segment.timelineStartMs + 1 && at < segment.timelineEndMs - 1;
      if (!inside) {
        out.push(segment);
        continue;
      }
      const cut = segment.sourceStartMs + (at - segment.timelineStartMs) * segment.speed;
      out.push({ ...segment, sourceEndMs: cut });
      out.push({
        ...segment,
        id: nextId("seg"),
        sourceStartMs: cut,
        timelineStartMs: at,
      });
    }
    return out;
  });
  return reflow(next);
}

/** Remoção "soft": o trecho fica desabilitado e pode ser restaurado. */
export function removeSegments(timeline: Timeline, ids: string[]): Timeline {
  const next = patchSegments(timeline, ids, (segment) => ({ ...segment, enabled: false }));
  return reflow({ ...next, selection: next.selection.filter((id) => !ids.includes(id)) });
}

export function restoreSegments(timeline: Timeline, ids: string[]): Timeline {
  return reflow(patchSegments(timeline, ids, (segment) => ({ ...segment, enabled: true })));
}

/** Reordena um segmento apenas quando isso não quebra a continuidade. */
export function reorderSegment(timeline: Timeline, segmentId: string, toIndex: number): Timeline {
  const track = videoTrack(timeline);
  if (!track || track.locked) return timeline;
  const from = track.segments.findIndex((segment) => segment.id === segmentId);
  if (from < 0) return timeline;
  const target = Math.max(0, Math.min(track.segments.length - 1, toIndex));
  if (target === from) return timeline;
  const segments = [...track.segments];
  const [moved] = segments.splice(from, 1);
  if (!moved) return timeline;
  segments.splice(target, 0, moved);
  return reflow(mapVideoSegments(timeline, () => segments));
}

export function setSpeed(timeline: Timeline, ids: string[], speed: number): Timeline {
  const clamped = Math.min(4, Math.max(0.25, speed));
  return reflow(patchSegments(timeline, ids, (segment) => ({ ...segment, speed: clamped })));
}

export function setVolume(timeline: Timeline, ids: string[], volume: number): Timeline {
  const clamped = Math.min(2, Math.max(0, volume));
  return patchSegments(timeline, ids, (segment) => ({ ...segment, volume: clamped }));
}

export function setMuted(timeline: Timeline, ids: string[], muted: boolean): Timeline {
  return patchSegments(timeline, ids, (segment) => ({ ...segment, muted }));
}

export function setTrackGain(timeline: Timeline, trackId: string, gain: number): Timeline {
  const clamped = Math.min(2, Math.max(0, gain));
  return {
    ...timeline,
    tracks: timeline.tracks.map((track) =>
      track.id === trackId ? { ...track, gain: clamped } : track,
    ),
  };
}

export function setTrackMuted(timeline: Timeline, trackId: string, muted: boolean): Timeline {
  return {
    ...timeline,
    tracks: timeline.tracks.map((track) => (track.id === trackId ? { ...track, muted } : track)),
  };
}

export function addOverlay(timeline: Timeline, overlay: TextOverlay): Timeline {
  return { ...timeline, overlays: [...timeline.overlays, overlay] };
}

export function updateOverlay(
  timeline: Timeline,
  id: string,
  patch: Partial<TextOverlay>,
): Timeline {
  return {
    ...timeline,
    overlays: timeline.overlays.map((overlay) =>
      overlay.id === id ? { ...overlay, ...patch } : overlay,
    ),
  };
}

export function removeOverlay(timeline: Timeline, id: string): Timeline {
  return {
    ...timeline,
    overlays: timeline.overlays.filter((overlay) => overlay.id !== id),
    selection: timeline.selection.filter((selected) => selected !== id),
  };
}

export function setCrop(timeline: Timeline, patch: Partial<CropOperation>): Timeline {
  return { ...timeline, crop: { ...timeline.crop, ...patch } };
}

export function addMarker(timeline: Timeline, marker: TimelineMarker): Timeline {
  return { ...timeline, markers: [...timeline.markers, marker].sort((a, b) => a.atMs - b.atMs) };
}

export function removeMarker(timeline: Timeline, id: string): Timeline {
  return { ...timeline, markers: timeline.markers.filter((marker) => marker.id !== id) };
}

/** Aplica uma operação declarativa. Ponto único usado pelo serviço e pelos hooks. */
export function applyOperation(timeline: Timeline, operation: EditorOperation): Timeline {
  switch (operation.kind) {
    case "trim":
      return trim(timeline, operation.edge, operation.atMs);
    case "split":
      return split(timeline, operation.atMs);
    case "remove":
      return removeSegments(timeline, operation.segmentIds);
    case "restore":
      return restoreSegments(timeline, operation.segmentIds);
    case "reorder":
      return reorderSegment(timeline, operation.segmentId, operation.toIndex);
    case "speed":
      return setSpeed(timeline, operation.segmentIds, operation.speed);
    case "volume":
      return setVolume(timeline, operation.segmentIds, operation.volume);
    case "mute":
      return setMuted(timeline, operation.segmentIds, operation.muted);
    case "track_gain":
      return setTrackGain(timeline, operation.trackId, operation.gain);
    case "track_mute":
      return setTrackMuted(timeline, operation.trackId, operation.muted);
    case "text_add":
      return addOverlay(timeline, operation.overlay);
    case "text_update":
      return updateOverlay(timeline, operation.id, operation.patch);
    case "text_remove":
      return removeOverlay(timeline, operation.id);
    case "aspect":
      return setCrop(timeline, operation.patch);
    case "marker_add":
      return addMarker(timeline, operation.marker);
    case "marker_remove":
      return removeMarker(timeline, operation.id);
    default:
      return timeline;
  }
}

export const OPERATION_LABELS: Record<EditorOperation["kind"], string> = {
  trim: "Cortar",
  split: "Dividir",
  remove: "Remover trecho",
  restore: "Restaurar trecho",
  reorder: "Reordenar",
  speed: "Velocidade",
  volume: "Volume",
  mute: "Mudo",
  track_gain: "Ganho da faixa",
  track_mute: "Mudo da faixa",
  text_add: "Adicionar texto",
  text_update: "Editar texto",
  text_remove: "Remover texto",
  aspect: "Proporção",
  marker_add: "Marcador",
  marker_remove: "Remover marcador",
};

/** Cria a timeline inicial de um clipe: um único segmento cobrindo tudo. */
export function createTimeline(options: {
  durationMs: number;
  hasMicrophoneTrack: boolean;
  hasApplicationTrack: boolean;
}): Timeline {
  const segment: TimelineSegment = {
    id: nextId("seg"),
    sourceStartMs: 0,
    sourceEndMs: options.durationMs,
    timelineStartMs: 0,
    timelineEndMs: options.durationMs,
    speed: 1,
    volume: 1,
    muted: false,
    enabled: true,
  };
  const track = (
    type: TimelineTrackType,
    label: string,
    order: number,
    available: boolean,
    segments: TimelineSegment[],
  ): TimelineTrack => ({
    id: nextId("track"),
    type,
    label,
    order,
    muted: false,
    locked: false,
    hidden: false,
    gain: 1,
    available,
    segments,
  });

  return {
    durationMs: options.durationMs,
    playheadMs: 0,
    zoom: 40,
    snapMs: 100,
    selection: [segment.id],
    markers: [],
    overlays: [],
    crop: {
      aspect: "original",
      fit: "fit",
      offsetX: 0.5,
      offsetY: 0.5,
      safeAreas: false,
      grid: false,
    },
    tracks: [
      track("video", "Vídeo", 0, true, [segment]),
      track("game_audio", "Áudio do jogo", 1, true, []),
      track("microphone", "Microfone", 2, options.hasMicrophoneTrack, []),
      track("application_audio", "Aplicativos", 3, options.hasApplicationTrack, []),
      track("text", "Texto", 4, true, []),
    ],
  };
}

/** Validação estrutural usada antes de salvar e antes de exportar. */
export function validateTimeline(timeline: Timeline): string[] {
  const problems: string[] = [];
  const segments = enabledSegments(timeline);
  if (segments.length === 0) problems.push("A timeline não tem nenhum trecho ativo.");
  if (computeDurationMs(timeline) < 100) problems.push("A duração final é menor que 0,1 s.");
  for (const segment of segments) {
    if (segment.sourceEndMs <= segment.sourceStartMs) {
      problems.push(`Segmento ${segment.id} tem duração de origem inválida.`);
    }
  }
  for (let i = 1; i < segments.length; i += 1) {
    if (segments[i]!.timelineStartMs < segments[i - 1]!.timelineEndMs) {
      problems.push("Existem trechos sobrepostos na timeline.");
      break;
    }
  }
  for (const overlay of timeline.overlays) {
    if (overlay.endMs <= overlay.startMs)
      problems.push(`Texto "${overlay.text}" tem duração zero.`);
  }
  return problems;
}
