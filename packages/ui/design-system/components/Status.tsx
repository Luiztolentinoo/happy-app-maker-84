import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Clock,
  Cpu,
  Loader2,
  UploadCloud,
  Video,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type Tone, toneClass } from "../tokens";
import { animations } from "../animations";
import { Icon } from "./Icon";

export type StatusKind =
  | "idle"
  | "buffering"
  | "recording"
  | "saving"
  | "encoding"
  | "uploading"
  | "completed"
  | "warning"
  | "error";

export const statusMap: Record<
  StatusKind,
  { label: string; tone: Tone; icon: LucideIcon; spin?: boolean; pulse?: boolean }
> = {
  idle: { label: "Inativo", tone: "muted", icon: Clock },
  buffering: { label: "Buffer ativo", tone: "blue", icon: Activity, pulse: true },
  recording: { label: "Gravando", tone: "red", icon: Video, pulse: true },
  saving: { label: "Salvando", tone: "purple", icon: Loader2, spin: true },
  encoding: { label: "Codificando", tone: "purple", icon: Cpu, spin: true },
  uploading: { label: "Enviando", tone: "blue", icon: UploadCloud, spin: true },
  completed: { label: "Concluído", tone: "green", icon: CheckCircle2 },
  warning: { label: "Atenção", tone: "yellow", icon: AlertTriangle },
  error: { label: "Erro", tone: "red", icon: XCircle },
};

/** Componente único de estado — usado em dashboard, biblioteca, uploads e diagnóstico. */
export function StatusIndicator({
  status,
  label,
  variant = "chip",
  className,
}: {
  status: StatusKind;
  label?: string;
  variant?: "chip" | "dot" | "inline";
  className?: string;
}) {
  const config = statusMap[status];
  const text = label ?? config.label;

  if (variant === "dot") {
    return (
      <span className={cn("inline-flex items-center gap-2 text-xs text-ink-secondary", className)}>
        <span
          aria-hidden
          className={cn(
            "size-2 rounded-full",
            toneClass[config.tone].split(" ")[0]?.replace("text-", "bg-"),
            config.pulse && animations.pulse,
          )}
        />
        {text}
      </span>
    );
  }

  if (variant === "inline") {
    return (
      <span className={cn("inline-flex items-center gap-2 text-sm", toneClass[config.tone].split(" ")[0], className)}>
        <Icon icon={config.icon} size="sm" className={config.spin ? "animate-spin" : undefined} />
        {text}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.1em] uppercase",
        toneClass[config.tone],
        className,
      )}
      role="status"
    >
      <Icon
        icon={config.icon}
        size="xs"
        className={cn(config.spin && "animate-spin", config.pulse && animations.pulse)}
      />
      {text}
    </span>
  );
}

export { CircleDot };
