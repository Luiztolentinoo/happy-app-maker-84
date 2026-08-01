import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Tone, toneClass, toneVar } from "../tokens";
import { animations } from "../animations";
import { Panel } from "./Panel";
import { Icon } from "./Icon";
import { StatusIndicator, type StatusKind } from "./Status";
import { Meter } from "./Progress";

/** Card de vidro genérico. */
export function GlassCard({
  className,
  children,
  hover = true,
  onClick,
}: {
  className?: string | undefined;
  children: ReactNode;
  hover?: boolean | undefined;
  onClick?: () => void | undefined;
}) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={cn(
        "glass-2 relative w-full overflow-hidden p-5 text-left",
        hover && animations.cardHover,
        className,
      )}
    >
      {children}
    </Wrapper>
  );
}

/** Card de métrica (números do dashboard). */
export function MetricCard({
  icon,
  label,
  value,
  hint,
  tone = "purple",
  className,
}: {
  icon?: LucideIcon | undefined;
  label: string;
  value: string;
  hint?: string | undefined;
  tone?: Tone | undefined;
  className?: string | undefined;
}) {
  return (
    <GlassCard className={className}>
      <div className="flex items-start justify-between gap-3">
        <p className="label-caps">{label}</p>
        {icon ? <Icon icon={icon} size="sm" tone={tone} /> : null}
      </div>
      <p className="mt-3 font-display text-2xl font-semibold text-ink">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
    </GlassCard>
  );
}

/** Card de estado do motor / serviço. */
export function StatusCard({
  title,
  status,
  description,
  action,
  className,
}: {
  title: string;
  status: StatusKind;
  description?: string | undefined;
  action?: ReactNode | undefined;
  className?: string | undefined;
}) {
  return (
    <GlassCard className={className}>
      <div className="flex items-center justify-between gap-3">
        <p className="font-display text-sm font-semibold text-ink">{title}</p>
        <StatusIndicator status={status} />
      </div>
      {description ? <p className="mt-2 text-sm text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </GlassCard>
  );
}

/** Card de hardware com medidor. */
export function HardwareCard({
  icon,
  label,
  value,
  percent,
  tone = "blue",
  className,
}: {
  icon?: LucideIcon | undefined;
  label: string;
  value: string;
  percent: number;
  tone?: Tone | undefined;
  className?: string | undefined;
}) {
  return (
    <GlassCard className={className} hover={false}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="label-caps flex items-center gap-2">
          {icon ? <Icon icon={icon} size="xs" tone={tone} /> : null}
          {label}
        </p>
        <p className="font-display text-lg font-semibold text-ink">{value}</p>
      </div>
      <Meter percent={percent} tone={tone} className="mt-3" />
    </GlassCard>
  );
}

/** Card de mídia (biblioteca / gravações). */
export function MediaCard({
  title,
  meta,
  thumbnail,
  duration,
  overlay,
  footer,
  onClick,
  className,
}: {
  title: string;
  meta?: string | undefined;
  thumbnail?: ReactNode | undefined;
  duration?: string | undefined;
  overlay?: ReactNode | undefined;
  footer?: ReactNode | undefined;
  onClick?: () => void | undefined;
  className?: string | undefined;
}) {
  return (
    <div className={cn("glass-2 group relative overflow-hidden", animations.cardHover, className)}>
      <div
        className="relative aspect-video w-full cursor-pointer overflow-hidden bg-surface-primary"
        onClick={onClick}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={(event) => {
          if (onClick && (event.key === "Enter" || event.key === " ")) onClick();
        }}
      >
        {thumbnail ?? (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,var(--surface-secondary),var(--background))]" />
        )}
        {duration ? (
          <span className="absolute right-2 bottom-2 rounded-md bg-background/80 px-1.5 py-0.5 font-mono text-[11px] text-ink-secondary">
            {duration}
          </span>
        ) : null}
        {overlay ? (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-background/55 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            {overlay}
          </div>
        ) : null}
      </div>
      <div className="p-4">
        <p className="truncate font-display text-sm font-semibold text-ink">{title}</p>
        {meta ? <p className="mt-1 truncate text-xs text-ink-muted">{meta}</p> : null}
        {footer ? <div className="mt-3">{footer}</div> : null}
      </div>
    </div>
  );
}

/** Card de jogo detectado / perfil. */
export function GameCard({
  name,
  detail,
  icon,
  active = false,
  action,
  className,
}: {
  name: string;
  detail?: string | undefined;
  icon?: LucideIcon | undefined;
  active?: boolean | undefined;
  action?: ReactNode | undefined;
  className?: string | undefined;
}) {
  return (
    <GlassCard className={cn(active && "border-border-glow glow-purple", className)}>
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-border-primary bg-surface-primary/60">
          {icon ? <Icon icon={icon} size="md" tone={active ? "purple" : "muted"} /> : null}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-semibold text-ink">{name}</p>
          {detail ? <p className="truncate text-xs text-ink-muted">{detail}</p> : null}
        </div>
        {action}
      </div>
    </GlassCard>
  );
}

/** Card de diagnóstico (capacidade do ambiente). */
export function DiagnosticCard({
  label,
  status,
  detail,
  className,
}: {
  label: string;
  status: StatusKind;
  detail?: string | undefined;
  className?: string | undefined;
}) {
  const tone: Tone = status === "error" ? "red" : status === "warning" ? "yellow" : "green";
  return (
    <GlassCard className={className} hover={false}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold text-ink">{label}</p>
          {detail ? <p className="mt-1 text-xs text-ink-muted">{detail}</p> : null}
        </div>
        <StatusIndicator status={status} />
      </div>
      <span
        aria-hidden
        className={cn("mt-4 block h-px w-full", toneClass[tone].split(" ")[0])}
        style={{ background: toneVar[tone], opacity: 0.4 }}
      />
    </GlassCard>
  );
}

export { Panel };
