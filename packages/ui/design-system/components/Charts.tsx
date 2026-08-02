import { cn } from "@/lib/utils";
import { type Tone, toneVar } from "../tokens";

/** Gráfico de barras compacto (telemetria, uploads por dia). */
export function BarChart({
  values,
  tone = "purple",
  height = 64,
  className,
  label,
}: {
  values: number[];
  tone?: Tone | undefined;
  height?: number | undefined;
  className?: string | undefined;
  label?: string | undefined;
}) {
  const max = Math.max(...values, 1);
  const color = toneVar[tone];
  return (
    <div
      className={cn("flex items-end gap-[3px]", className)}
      style={{ height }}
      role="img"
      aria-label={label}
    >
      {values.map((value, index) => (
        <span
          key={index}
          className="flex-1 rounded-[3px] transition-[height] duration-500"
          style={{
            height: `${Math.max(4, (value / max) * 100)}%`,
            background: color,
            boxShadow: `0 0 12px -4px ${color}`,
            opacity: 0.45 + (value / max) * 0.55,
          }}
        />
      ))}
    </div>
  );
}

/** Gráfico de área para séries contínuas (bitrate, FPS). */
export function AreaChart({
  values,
  tone = "blue",
  height = 96,
  className,
  label,
}: {
  values: number[];
  tone?: Tone | undefined;
  height?: number | undefined;
  className?: string | undefined;
  label?: string | undefined;
}) {
  if (values.length === 0) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const coords = values.map((value, index) => {
    const x = (index / Math.max(1, values.length - 1)) * 100;
    const y = 100 - ((value - min) / span) * 100;
    return `${x},${y}`;
  });
  const color = toneVar[tone];
  const gradientId = `ds-area-${tone}`;

  return (
    <svg
      className={cn("w-full", className)}
      style={{ height }}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.5} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={`0,100 ${coords.join(" ")} 100,100`} fill={`url(#${gradientId})`} />
      <polyline
        points={coords.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
