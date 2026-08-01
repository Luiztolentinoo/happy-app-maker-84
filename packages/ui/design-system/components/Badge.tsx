import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { type Tone, toneClass } from "../tokens";
import { animations } from "../animations";

const BADGE_BASE =
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.1em] uppercase";

/** Badge genérico por tom. */
export function Badge({
  tone = "purple",
  dot = false,
  pulse = false,
  className,
  children,
}: {
  tone?: Tone | undefined;
  dot?: boolean | undefined;
  pulse?: boolean | undefined;
  className?: string | undefined;
  children: ReactNode;
}) {
  return (
    <span className={cn(BADGE_BASE, toneClass[tone], className)}>
      {dot ? (
        <span
          aria-hidden
          className={cn("size-1.5 rounded-full bg-current", pulse && animations.pulse)}
        />
      ) : null}
      {children}
    </span>
  );
}

export const badgePresets = {
  online: { tone: "green", label: "Online", dot: true },
  offline: { tone: "muted", label: "Offline", dot: true },
  recording: { tone: "red", label: "Gravando", dot: true, pulse: true },
  saving: { tone: "purple", label: "Salvando", dot: true, pulse: true },
  paused: { tone: "yellow", label: "Pausado", dot: true },
  warning: { tone: "yellow", label: "Atenção" },
  error: { tone: "red", label: "Erro" },
  success: { tone: "green", label: "Concluído" },
} as const satisfies Record<
  string,
  { tone: Tone; label: string; dot?: boolean | undefined; pulse?: boolean }
>;

export type BadgePreset = keyof typeof badgePresets;

/** Badge pronto para os estados do produto. */
export function StatusBadge({
  preset,
  label,
  className,
}: {
  preset: BadgePreset;
  label?: string | undefined;
  className?: string | undefined;
}) {
  const config = badgePresets[preset];
  return (
    <Badge
      tone={config.tone}
      dot={"dot" in config ? config.dot : false}
      pulse={"pulse" in config ? config.pulse : false}
      className={className}
    >
      {label ?? config.label}
    </Badge>
  );
}

/** Chip compacto reutilizável (rótulos, filtros, metadados). */
export function Chip({
  tone = "muted",
  className,
  children,
}: {
  tone?: Tone | undefined;
  className?: string | undefined;
  children: ReactNode;
}) {
  return <Badge tone={tone} className={cn("normal-case tracking-normal", className)}>{children}</Badge>;
}
