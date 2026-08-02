import type { ReactNode } from "react";
import { AlertTriangle, Loader2, Inbox, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { animations } from "../animations";
import { Icon } from "./Icon";
import { Button } from "./Button";

/** Carregamento padronizado. */
export function Loading({
  label = "Carregando…",
  size = "md",
  className,
}: {
  label?: string | undefined;
  size?: "sm" | "md" | "lg" | undefined;
  className?: string | undefined;
}) {
  const map = { sm: "size-4", md: "size-6", lg: "size-8" } as const;
  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-3 py-10", className)}
      role="status"
    >
      <Loader2 className={cn(map[size], "animate-spin text-accent-purple")} aria-hidden />
      <p className="text-sm text-ink-muted">{label}</p>
    </div>
  );
}

/** Skeleton padronizado. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("rounded-lg bg-surface-secondary/70", animations.shimmer, className)}
    />
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("glass-1 space-y-3 p-5", className)}>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-2 w-full" />
    </div>
  );
}

export function SkeletonMedia({ className }: { className?: string }) {
  return (
    <div className={cn("glass-1 overflow-hidden", className)}>
      <Skeleton className="aspect-video w-full rounded-none" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}

/** Estado vazio padronizado. */
export function EmptyState({
  icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon | undefined;
  title: string;
  description?: string | undefined;
  action?: ReactNode | undefined;
  className?: string | undefined;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-14 text-center",
        className,
      )}
    >
      <span className="grid size-12 place-items-center rounded-full border border-border-primary bg-surface-primary/60">
        <Icon icon={icon} size="md" tone="muted" />
      </span>
      <p className="font-display text-base font-semibold text-ink">{title}</p>
      {description ? <p className="max-w-sm text-sm text-ink-muted">{description}</p> : null}
      {action}
    </div>
  );
}

/** Estado de erro padronizado. */
export function ErrorState({
  title = "Algo deu errado",
  description,
  onRetry,
  retryLabel = "Tentar novamente",
  className,
}: {
  title?: string | undefined;
  description?: string | undefined;
  onRetry?: () => void | undefined;
  retryLabel?: string | undefined;
  className?: string | undefined;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-14 text-center",
        className,
      )}
      role="alert"
    >
      <span className="grid size-12 place-items-center rounded-full border border-accent-red/40 bg-accent-red/10">
        <Icon icon={AlertTriangle} size="md" tone="red" />
      </span>
      <p className="font-display text-base font-semibold text-ink">{title}</p>
      {description ? <p className="max-w-sm text-sm text-ink-muted">{description}</p> : null}
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
