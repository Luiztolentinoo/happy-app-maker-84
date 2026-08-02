/**
 * Timeline visual do editor.
 *
 * Puramente apresentacional: recebe a timeline e emite intenções para o hook
 * (`useEditor`). Nenhuma regra de edição vive aqui.
 */

import { useCallback, useMemo, useRef } from "react";
import { Eye, EyeOff, Lock, Mic, Monitor, Music2, Type, Volume2, VolumeX } from "lucide-react";
import { Icon } from "@ds";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/clipcore";
import type { Timeline, TimelineSegment, TimelineTrack } from "@/editor/types";

const TRACK_ICONS = {
  video: Monitor,
  game_audio: Music2,
  microphone: Mic,
  application_audio: Volume2,
  text: Type,
  overlay: Type,
} as const;

export interface EditorTimelineProps {
  timeline: Timeline;
  durationMs: number;
  waveform: number[];
  accent: string;
  onSeek: (ms: number) => void;
  onSelect: (ids: string[]) => void;
  onToggleTrackMute: (trackId: string, muted: boolean) => void;
}

export function EditorTimeline({
  timeline,
  durationMs,
  waveform,
  accent,
  onSeek,
  onSelect,
  onToggleTrackMute,
}: EditorTimelineProps) {
  const laneRef = useRef<HTMLDivElement>(null);
  const safeDuration = Math.max(1, durationMs);

  const seekFromEvent = useCallback(
    (clientX: number) => {
      const rect = laneRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return;
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      onSeek(ratio * safeDuration);
    },
    [onSeek, safeDuration],
  );

  const ticks = useMemo(() => {
    const target = 8;
    const stepMs = Math.max(1000, Math.round(safeDuration / target / 1000) * 1000);
    const list: number[] = [];
    for (let at = 0; at <= safeDuration; at += stepMs) list.push(at);
    return list;
  }, [safeDuration]);

  const playheadPercent = (timeline.playheadMs / safeDuration) * 100;

  return (
    <div className="space-y-3">
      {/* Régua */}
      <div className="flex items-center justify-between font-mono text-[11px] text-ink-muted">
        {ticks.map((tick) => (
          <span key={tick}>{formatDuration(tick)}</span>
        ))}
      </div>

      <div className="relative">
        {/* Playhead atravessando todas as faixas */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 z-20 w-px bg-primary"
          style={{ left: `calc(${Math.min(100, Math.max(0, playheadPercent))}% )`, boxShadow: "0 0 12px var(--primary)" }}
        />

        <div className="space-y-2">
          {[...timeline.tracks]
            .sort((a, b) => a.order - b.order)
            .map((track) => (
              <TrackRow
                key={track.id}
                track={track}
                timeline={timeline}
                durationMs={safeDuration}
                waveform={waveform}
                accent={accent}
                laneRef={track.type === "video" ? laneRef : undefined}
                onSeek={seekFromEvent}
                onSelect={onSelect}
                onToggleMute={onToggleTrackMute}
              />
            ))}
        </div>
      </div>

      {timeline.markers.length > 0 ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {timeline.markers.map((marker) => (
            <button
              key={marker.id}
              type="button"
              onClick={() => onSeek(marker.atMs)}
              className="rounded-full border border-border-primary bg-surface-primary/60 px-2.5 py-1 font-mono text-[11px] text-ink-secondary transition hover:border-primary/60 hover:text-ink"
            >
              {formatDuration(marker.atMs)} · {marker.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TrackRow({
  track,
  timeline,
  durationMs,
  waveform,
  accent,
  laneRef,
  onSeek,
  onSelect,
  onToggleMute,
}: {
  track: TimelineTrack;
  timeline: Timeline;
  durationMs: number;
  waveform: number[];
  accent: string;
  laneRef?: React.RefObject<HTMLDivElement | null> | undefined;
  onSeek: (clientX: number) => void;
  onSelect: (ids: string[]) => void;
  onToggleMute: (trackId: string, muted: boolean) => void;
}) {
  const icon = TRACK_ICONS[track.type];
  const isAudio = track.type !== "video" && track.type !== "text" && track.type !== "overlay";

  return (
    <div className="flex items-stretch gap-3">
      <div className="flex w-40 shrink-0 items-center gap-2 rounded-lg border border-border-primary bg-surface-primary/50 px-2.5 py-2">
        <Icon icon={icon} size="sm" tone={track.available ? "muted" : "red"} />
        <span className="min-w-0 flex-1 truncate text-xs text-ink-secondary">{track.label}</span>
        {track.locked ? <Icon icon={Lock} size="xs" tone="muted" /> : null}
        {isAudio ? (
          <button
            type="button"
            aria-label={track.muted ? `Ativar ${track.label}` : `Silenciar ${track.label}`}
            onClick={() => onToggleMute(track.id, !track.muted)}
            className="grid size-6 place-items-center rounded-md text-ink-muted transition hover:bg-surface-hover hover:text-ink"
          >
            <Icon icon={track.muted ? VolumeX : Volume2} size="xs" />
          </button>
        ) : (
          <Icon icon={track.hidden ? EyeOff : Eye} size="xs" tone="muted" />
        )}
      </div>

      <div
        ref={laneRef}
        role="presentation"
        onPointerDown={(event) => onSeek(event.clientX)}
        className={cn(
          "relative h-14 flex-1 cursor-pointer overflow-hidden rounded-lg border border-border-primary bg-bg-deep/60",
          !track.available && "opacity-45",
        )}
      >
        {track.type === "text"
          ? timeline.overlays.map((overlay) => (
              <span
                key={overlay.id}
                className="absolute inset-y-2 grid place-items-center overflow-hidden rounded-md border border-accent-blue/50 bg-accent-blue/15 px-2 text-[11px] text-ink"
                style={{
                  left: `${(overlay.startMs / durationMs) * 100}%`,
                  width: `${Math.max(2, ((overlay.endMs - overlay.startMs) / durationMs) * 100)}%`,
                }}
              >
                <span className="truncate">{overlay.text || "texto"}</span>
              </span>
            ))
          : track.segments.map((segment) => (
              <SegmentBlock
                key={segment.id}
                segment={segment}
                durationMs={durationMs}
                selected={timeline.selection.includes(segment.id)}
                accent={accent}
                audio={isAudio}
                waveform={waveform}
                onSelect={onSelect}
              />
            ))}
      </div>
    </div>
  );
}

function SegmentBlock({
  segment,
  durationMs,
  selected,
  accent,
  audio,
  waveform,
  onSelect,
}: {
  segment: TimelineSegment;
  durationMs: number;
  selected: boolean;
  accent: string;
  audio: boolean;
  waveform: number[];
  onSelect: (ids: string[]) => void;
}) {
  const left = (segment.timelineStartMs / durationMs) * 100;
  const width = Math.max(0.6, ((segment.timelineEndMs - segment.timelineStartMs) / durationMs) * 100);
  const bars = audio ? waveform.slice(0, 60) : [];

  return (
    <button
      type="button"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={() => onSelect([segment.id])}
      aria-pressed={selected}
      className={cn(
        "absolute inset-y-1.5 overflow-hidden rounded-md border text-left transition",
        selected ? "border-primary shadow-[0_0_18px_-4px_var(--primary)]" : "border-border-primary",
        !segment.enabled && "opacity-35 grayscale",
      )}
      style={{
        left: `${left}%`,
        width: `${width}%`,
        background: audio
          ? "color-mix(in oklab, var(--accent-blue) 22%, transparent)"
          : `linear-gradient(135deg, ${accent} 0%, oklch(0.2 0.03 268) 100%)`,
      }}
    >
      {audio ? (
        <span className="flex h-full items-center gap-px px-1">
          {bars.map((value, index) => (
            <span
              key={index}
              className="flex-1 rounded-full bg-accent-blue/70"
              style={{ height: `${Math.max(8, value * 100)}%` }}
            />
          ))}
        </span>
      ) : (
        <span className="absolute bottom-1 left-1.5 font-mono text-[10px] text-ink/80">
          {segment.speed !== 1 ? `${segment.speed.toFixed(2)}x` : formatDuration(segment.timelineEndMs - segment.timelineStartMs)}
        </span>
      )}
    </button>
  );
}
