import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Tone, toneVar } from "../tokens";

/** Tamanhos padronizados de ícone — nenhum ícone deve usar tamanho arbitrário. */
export const iconSizes = {
  xs: "size-3.5",
  sm: "size-4",
  md: "size-5",
  lg: "size-6",
  xl: "size-7",
} as const;

export type IconSize = keyof typeof iconSizes;

export function Icon({
  icon: Component,
  size = "sm",
  tone,
  className,
  label,
}: {
  icon: LucideIcon;
  size?: IconSize | undefined;
  tone?: Tone | undefined;
  className?: string | undefined;
  label?: string | undefined;
}) {
  return (
    <Component
      className={cn(iconSizes[size], "shrink-0", className)}
      strokeWidth={1.9}
      style={tone ? { color: toneVar[tone] } : undefined}
      aria-hidden={label ? undefined : true}
      aria-label={label}
    />
  );
}
