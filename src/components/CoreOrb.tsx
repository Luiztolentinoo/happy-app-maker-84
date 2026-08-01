/**
 * Core Orb do ClipCore — mapeamento do estado de negócio para o componente do Design System.
 * A implementação visual vive em @ds (nenhuma lógica duplicada aqui).
 */
import { CoreOrb as DSCoreOrb, type OrbState } from "@ds";
import type { CaptureState } from "@/lib/clipcore";

export type OrbTone = OrbState;

export function orbToneFor(state: CaptureState, lowSpace = false): OrbState {
  if (state === "error") return "error";
  if (state === "saving_clip") return "saving";
  if (lowSpace || state === "degraded") return "warning";
  if (state === "recording_session" || state === "buffering") return "buffering";
  return "idle";
}

export function CoreOrb({
  tone,
  burstKey = 0,
  size = 168,
  caption,
}: {
  tone: OrbState;
  burstKey?: number;
  size?: number;
  caption?: string;
}) {
  return (
    <DSCoreOrb
      state={tone}
      burstKey={burstKey}
      size={size}
      {...(caption ? { caption } : {})}
    />
  );
}
