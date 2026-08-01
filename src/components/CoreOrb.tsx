import { useEffect, useState } from "react";
import type { CaptureState } from "@/lib/clipcore";

/**
 * Core Orb — identidade visual do ClipCore.
 * Reflete o estado do motor de captura (mesmo contrato CaptureState).
 */
export type OrbTone = "capturing" | "waiting" | "saving" | "low_space" | "error";

const TONES: Record<OrbTone, { color: string; label: string }> = {
  capturing: { color: "oklch(0.79 0.19 160)", label: "Capturando" },
  waiting: { color: "oklch(0.75 0.14 232)", label: "Aguardando" },
  saving: { color: "oklch(0.63 0.235 302)", label: "Salvando clipe" },
  low_space: { color: "oklch(0.86 0.13 92)", label: "Pouco espaço" },
  error: { color: "oklch(0.62 0.235 24)", label: "Erro" },
};

export function orbToneFor(state: CaptureState, lowSpace = false): OrbTone {
  if (state === "error") return "error";
  if (state === "saving_clip") return "saving";
  if (lowSpace || state === "degraded") return "low_space";
  if (state === "recording_session" || state === "buffering") return "capturing";
  return "waiting";
}

export function CoreOrb({
  tone,
  burstKey = 0,
  size = 168,
  caption,
}: {
  tone: OrbTone;
  /** Incremente para disparar a explosão de brilho ao salvar um clipe. */
  burstKey?: number;
  size?: number;
  caption?: string;
}) {
  const { color, label } = TONES[tone];
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    if (!burstKey) return;
    setBurst(burstKey);
    const t = setTimeout(() => setBurst(0), 800);
    return () => clearTimeout(t);
  }, [burstKey]);

  return (
    <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
      <div className="relative grid place-items-center" style={{ width: size, height: size }}>
        <div
          className="absolute inset-0 rounded-full blur-2xl"
          style={{ background: `radial-gradient(circle, ${color} 0%, transparent 68%)`, opacity: 0.38 }}
        />
        {burst ? (
          <div
            key={burst}
            className="absolute inset-2 rounded-full animate-orb-burst"
            style={{ background: `radial-gradient(circle, ${color} 0%, transparent 70%)` }}
          />
        ) : null}
        <div
          className="absolute inset-4 rounded-full animate-orb-pulse"
          style={{
            background: `radial-gradient(circle at 32% 28%, oklch(0.98 0.01 300 / 0.55), ${color} 42%, oklch(0.18 0.02 265) 100%)`,
            boxShadow: `0 0 60px -8px ${color}, inset 0 0 40px -10px ${color}`,
          }}
        />
        <div
          className="absolute inset-1 rounded-full"
          style={{ border: `1px solid ${color}`, opacity: 0.35 }}
        />
        <div
          className="absolute inset-[-6px] rounded-full"
          style={{ border: `1px dashed ${color}`, opacity: 0.16 }}
        />
      </div>
      <p className="font-display text-sm font-semibold tracking-wide" style={{ color }}>
        {caption ?? label}
      </p>
    </div>
  );
}
