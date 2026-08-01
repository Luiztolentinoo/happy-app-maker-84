import { cn } from "@/lib/utils";
import { type Tone, toneVar } from "../tokens";

/** Barra de progresso padronizada. */
export function ProgressBar({
  percent,
  tone = "purple",
  className,
  label,
}: {
  percent: number;
  tone?: Tone | undefined;
  className?: string | undefined;
  label?: string | undefined;
}) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-primary/70", className)}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{
          width: `${clamped}%`,
          background: toneVar[tone],
          boxShadow: `0 0 14px -2px ${toneVar[tone]}`,
        }}
      />
    </div>
  );
}

/** Medidor segmentado estilo monitor de hardware. */
export function Meter({
  percent,
  tone = "blue",
  segments = 16,
  className,
}: {
  percent: number;
  tone?: Tone | undefined;
  segments?: number | undefined;
  className?: string | undefined;
}) {
  const clamped = Math.min(100, Math.max(0, percent));
  const filled = Math.round((clamped / 100) * segments);
  const color = toneVar[tone];

  return (
    <div className={cn("flex gap-[3px]", className)} aria-hidden>
      {Array.from({ length: segments }).map((_, index) => (
        <span
          key={index}
          className="h-2 flex-1 rounded-[2px] transition-colors duration-300"
          style={
            index < filled
              ? { background: color, boxShadow: `0 0 10px -2px ${color}` }
              : { background: "var(--surface-secondary)" }
          }
        />
      ))}
    </div>
  );
}

/** Gauge: rótulo + valor + medidor (telemetria). */
export function Gauge({
  label,
  value,
  percent,
  tone = "purple",
  className,
}: {
  label: string;
  value: string;
  percent: number;
  tone?: Tone | undefined;
  className?: string | undefined;
}) {
  return (
    <div className={cn("rounded-lg border border-border-primary bg-background/40 p-4", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="label-caps">{label}</p>
        <p className="font-display text-lg font-semibold text-ink">{value}</p>
      </div>
      <Meter percent={percent} tone={tone} className="mt-3" />
    </div>
  );
}

/** Anel de progresso radial. */
export function RadialGauge({
  percent,
  size = 96,
  tone = "purple",
  children,
}: {
  percent: number;
  size?: number | undefined;
  tone?: Tone | undefined;
  children?: React.ReactNode | undefined;
}) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div
      className="relative grid place-items-center rounded-full"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(${toneVar[tone]} ${clamped * 3.6}deg, var(--surface-secondary) 0deg)`,
      }}
    >
      <div className="absolute inset-[8px] grid place-items-center rounded-full bg-background/85 text-center">
        {children}
      </div>
    </div>
  );
}

/** Sparkline simples para séries curtas (bitrate, FPS). */
export function Sparkline({
  values,
  tone = "blue",
  height = 48,
  className,
}: {
  values: number[];
  tone?: Tone | undefined;
  height?: number | undefined;
  className?: string | undefined;
}) {
  if (values.length === 0) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * 100;
      const y = 100 - ((value - min) / span) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      className={cn("w-full", className)}
      style={{ height }}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke={toneVar[tone]}
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
