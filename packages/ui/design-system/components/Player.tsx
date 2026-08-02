import { useRef, useState, type ReactNode } from "react";
import { FolderOpen, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";
import { ProgressBar } from "./Progress";
import { Text, DefinitionList } from "./Typography";

/**
 * Player oficial do Design System — apenas apresentação.
 * Toda a lógica de seleção/abertura de arquivo continua nas telas.
 */
export function MediaPlayer({
  src,
  title,
  accent,
  durationLabel,
  positionLabel,
  fallbackPercent = 38,
  meta,
  onOpenLocal,
  openLabel = "Abrir vídeo local",
  placeholder = "Miniatura simulada — abra um arquivo de vídeo local para reproduzir.",
  children,
  className,
}: {
  src?: string | undefined;
  title: string;
  accent?: string | undefined;
  durationLabel?: string | undefined;
  positionLabel?: string | undefined;
  fallbackPercent?: number | undefined;
  meta?: { label: string; value: ReactNode }[] | undefined;
  onOpenLocal?: (() => void) | undefined;
  openLabel?: string | undefined;
  placeholder?: string | undefined;
  children?: ReactNode | undefined;
  className?: string | undefined;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="relative overflow-hidden rounded-xl border border-border-primary">
        <div
          aria-hidden
          className="absolute inset-0 scale-110 blur-2xl opacity-70"
          style={{
            background: `linear-gradient(140deg, ${accent ?? "var(--surface-secondary)"} 0%, var(--background) 85%)`,
          }}
        />
        <div className="relative">
          {src ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video
              ref={video}
              src={src}
              controls
              muted={muted}
              className="aspect-video w-full bg-background"
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
            />
          ) : (
            <div className="grid aspect-video place-items-center p-5 text-center">
              <Text variant="small">{placeholder}</Text>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="circular"
          size="iconSm"
          icon={src && playing ? Pause : Play}
          aria-label={src && playing ? "Pausar" : "Reproduzir"}
          disabled={!src}
          onClick={() => {
            const el = video.current;
            if (!el) return;
            if (el.paused) void el.play();
            else el.pause();
          }}
        />
        <Button
          variant="circular"
          size="iconSm"
          icon={muted ? VolumeX : Volume2}
          aria-label={muted ? "Ativar som" : "Silenciar"}
          disabled={!src}
          onClick={() => setMuted((value) => !value)}
        />
        <div className="min-w-0 flex-1">
          <ProgressBar percent={src ? 0 : fallbackPercent} label="Progresso do clipe" />
        </div>
        <span className="font-mono text-[11px] text-ink-muted">
          {positionLabel ?? "00:00"} / {durationLabel ?? "00:00"}
        </span>
      </div>

      <Text variant="bodyStrong" className="truncate">
        {title}
      </Text>
      {meta && meta.length > 0 ? <DefinitionList items={meta} /> : null}
      {children}
      {onOpenLocal ? (
        <Button variant="secondary" className="w-full" icon={FolderOpen} onClick={onOpenLocal}>
          {openLabel}
        </Button>
      ) : null}
    </div>
  );
}
