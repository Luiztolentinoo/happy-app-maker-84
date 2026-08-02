import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Tipografia oficial. Nenhuma tela deve inventar escalas de texto.
 * display = Sora, body = Inter Tight (definidos em __root.tsx / styles.css).
 */
export const textStyles = {
  hero: "font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl",
  title: "font-display text-xl font-semibold tracking-tight text-ink",
  subtitle: "font-display text-base font-semibold tracking-tight text-ink",
  body: "text-sm text-ink-secondary",
  bodyStrong: "text-sm font-semibold text-ink",
  small: "text-xs text-ink-muted",
  mono: "font-mono text-[11px] text-ink-muted",
  caps: "label-caps",
} as const;

export type TextVariant = keyof typeof textStyles;

export function Text({
  as,
  variant = "body",
  className,
  children,
}: {
  as?: ElementType | undefined;
  variant?: TextVariant | undefined;
  className?: string | undefined;
  children: ReactNode;
}) {
  const Component = (as ?? (variant === "hero" ? "h1" : variant === "title" ? "h2" : "p")) as ElementType;
  return <Component className={cn(textStyles[variant], className)}>{children}</Component>;
}

/** Lista de definições (metadados de clipe, hardware, etc.). */
export function DefinitionList({
  items,
  className,
}: {
  items: { label: string; value: ReactNode }[];
  className?: string | undefined;
}) {
  return (
    <dl className={cn("grid grid-cols-2 gap-y-1.5 text-xs text-ink-muted", className)}>
      {items.map((item) => (
        <div key={item.label} className="col-span-2 grid grid-cols-2 gap-2">
          <dt>{item.label}</dt>
          <dd className="truncate text-right text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
