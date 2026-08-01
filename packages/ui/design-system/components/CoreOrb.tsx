import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { type Tone, toneVar } from "../tokens";
import { animations } from "../animations";

export type OrbState =
  | "idle"
  | "buffering"
  | "recording"
  | "saving"
  | "warning"
  | "error";

export const orbStateConfig: Record<OrbState, { tone: Tone; label: string }> = {
  idle: { tone: "blue", label: "Aguardando" },
  buffering: { tone: "green", label: "Capturando" },
  recording: { tone: "green", label: "Capturando" },
  saving: { tone: "purple", label: "Salvando clipe" },
  warning: { tone: "yellow", label: "Pouco espaço" },
  error: { tone: "red", label: "Erro" },
};

/**
 * Core Orb — componente reutilizável.
 * Recebe estado, animação, cor (tom), intensidade e tamanho. Sem lógica duplicada.
 */
export function CoreOrb({
  state,
  tone,
  animation = "orbPulse",
  intensity = 1,
  size = 168,
  caption,
  burstKey = 0,
  className,
  children,
}: {
  state: OrbState;
  tone?: Tone | undefined;
  animation?: "orbPulse" | "pulse" | "glow" | "none" | undefined;
  /** 0.4 = discreto, 1 = padrão, 1.6 = intenso. */
  intensity?: number | undefined;
  size?: number | undefined;
  caption?: ReactNode | undefined;
  /** Incremente para disparar a explosão de brilho. */
  burstKey?: number | undefined;
  className?: string | undefined;
  children?: ReactNode | undefined;
}) {
  const config = orbStateConfig[state];
  const color = toneVar[tone ?? config.tone];
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    if (!burstKey) return;
    setBurst(burstKey);
    const timer = setTimeout(() => setBurst(0), 800);
    return () => clearTimeout(timer);
  }, [burstKey]);

  const spin = animation === "none" ? undefined : animations[animation];

  return (
    <div
      className={cn("flex flex-col items-center gap-3", className)}
      role="status"
      aria-live="polite"
    >
      <div className="relative grid place-items-center" style={{ width: size, height: size }}>
        <div
          aria-hidden
          className="absolute inset-0 rounded-full blur-2xl"
          style={{
            background: `radial-gradient(circle, ${color} 0%, transparent 68%)`,
            opacity: 0.28 * intensity,
          }}
        />
        {burst ? (
          <div
            key={burst}
            aria-hidden
            className={cn("absolute inset-2 rounded-full", animations.orbExplosion)}
            style={{ background: `radial-gradient(circle, ${color} 0%, transparent 70%)` }}
          />
        ) : null}
        <div
          aria-hidden
          className={cn("absolute inset-4 rounded-full", spin)}
          style={{
            background: `radial-gradient(circle at 32% 28%, oklch(0.98 0.01 300 / 0.5), ${color} 42%, var(--background) 100%)`,
            boxShadow: `0 0 ${60 * intensity}px -8px ${color}, inset 0 0 ${40 * intensity}px -10px ${color}`,
          }}
        />
        <div
          aria-hidden
          className="absolute inset-1 rounded-full"
          style={{ border: `1px solid ${color}`, opacity: 0.28 * intensity }}
        />
        {children ? <div className="relative">{children}</div> : null}
      </div>
      {caption ?? (
        <p className="label-caps" style={{ color }}>
          {config.label}
        </p>
      )}
    </div>
  );
}
