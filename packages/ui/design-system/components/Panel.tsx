import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { glass, type GlassLevel } from "../tokens";
import { animations } from "../animations";
import { Icon } from "./Icon";

/** Painel base: superfície de vidro de todas as telas. */
export function Panel({
  level = 2,
  hover = false,
  className,
  children,
}: {
  level?: GlassLevel | undefined;
  hover?: boolean | undefined;
  className?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        glass[level],
        "relative overflow-hidden",
        hover && animations.cardHover,
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Módulo: painel com cabeçalho padronizado (ícone, título, dica, ação). */
export function Module({
  icon,
  title,
  hint,
  action,
  level = 2,
  className,
  children,
}: {
  icon?: LucideIcon | undefined;
  title?: string | undefined;
  hint?: string | undefined;
  action?: ReactNode | undefined;
  level?: GlassLevel | undefined;
  className?: string | undefined;
  children: ReactNode;
}) {
  return (
    <section className={cn(glass[level], animations.cardHover, animations.slide, "relative overflow-hidden p-6", className)}>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent-purple/55 to-transparent"
      />
      {title ? (
        <header className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <p className="label-caps flex items-center gap-2">
              {icon ? <Icon icon={icon} size="xs" tone="purple" /> : null}
              <span className="truncate">{title}</span>
            </p>
            {hint ? <p className="mt-1 truncate text-sm text-ink-muted">{hint}</p> : null}
          </div>
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}

/** Título de seção padronizado. */
export function SectionTitle({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string | undefined;
  action?: ReactNode | undefined;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
        {hint ? <p className="mt-1 text-sm text-ink-muted">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}
