import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Módulo tecnológico: unidade visual padrão de todas as telas. */
export function Module({
  icon: Icon,
  title,
  hint,
  action,
  className,
  children,
}: {
  icon?: LucideIcon;
  title?: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("module animate-rise p-6", className)}>
      {title ? (
        <header className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <p className="label-caps flex items-center gap-2">
              {Icon ? <Icon className="size-3.5 shrink-0 text-primary" /> : null}
              <span className="truncate">{title}</span>
            </p>
            {hint ? <p className="mt-1 truncate text-sm text-muted-foreground">{hint}</p> : null}
          </div>
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}

/** Métrica de hardware com barra estilo monitor. */
export function Gauge({
  label,
  value,
  percent,
  tone = "primary",
}: {
  label: string;
  value: string;
  percent: number;
  tone?: "primary" | "electric" | "success" | "warning" | "destructive";
}) {
  const color = {
    primary: "var(--primary)",
    electric: "var(--electric)",
    success: "var(--success)",
    warning: "var(--warning)",
    destructive: "var(--destructive)",
  }[tone];

  return (
    <div className="rounded-lg border border-border bg-background/40 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="label-caps">{label}</p>
        <p className="font-display text-lg font-semibold">{value}</p>
      </div>
      <div className="mt-3 flex gap-[3px]" aria-hidden>
        {Array.from({ length: 16 }).map((_, i) => (
          <span
            key={i}
            className="h-2 flex-1 rounded-[2px] transition-colors duration-300"
            style={{
              background:
                i < Math.round((Math.min(100, Math.max(0, percent)) / 100) * 16)
                  ? color
                  : "oklch(0.32 0.03 264 / 60%)",
              boxShadow:
                i < Math.round((Math.min(100, Math.max(0, percent)) / 100) * 16)
                  ? `0 0 10px -2px ${color}`
                  : undefined,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/** Selo de status compacto. */
export function StatusChip({
  children,
  tone = "primary",
}: {
  children: ReactNode;
  tone?: "primary" | "electric" | "success" | "warning" | "destructive" | "muted";
}) {
  const map = {
    primary: "border-primary/40 bg-primary/10 text-primary",
    electric: "border-electric/40 bg-electric/10 text-electric",
    success: "border-success/40 bg-success/10 text-success",
    warning: "border-warning/40 bg-warning/10 text-warning",
    destructive: "border-destructive/40 bg-destructive/10 text-destructive",
    muted: "border-border bg-background/50 text-muted-foreground",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.1em] uppercase",
        map[tone],
      )}
    >
      {children}
    </span>
  );
}
