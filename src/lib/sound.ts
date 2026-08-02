/**
 * Feedback sonoro opcional (desligado por padrão).
 * Sons são sintetizados via WebAudio — nenhum arquivo externo, nenhuma regra de negócio.
 */
import { useCallback, useEffect, useState } from "react";

const KEY = "clipcore.sound.v1";

export type SoundName = "hover" | "click" | "save" | "success" | "error";

const RECIPES: Record<
  SoundName,
  { freq: number; to: number; dur: number; gain: number; type: OscillatorType }
> = {
  hover: { freq: 880, to: 940, dur: 0.05, gain: 0.02, type: "sine" },
  click: { freq: 520, to: 700, dur: 0.07, gain: 0.04, type: "triangle" },
  save: { freq: 320, to: 860, dur: 0.22, gain: 0.05, type: "sine" },
  success: { freq: 660, to: 1180, dur: 0.26, gain: 0.05, type: "sine" },
  error: { freq: 300, to: 140, dur: 0.3, gain: 0.05, type: "sawtooth" },
};

let context: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  context ??= new Ctor();
  return context;
}

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(KEY) === "on";
}

export function setSoundEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, enabled ? "on" : "off");
  window.dispatchEvent(new Event("clipcore:sound"));
}

export function playSound(name: SoundName) {
  if (!isSoundEnabled()) return;
  const ctx = audio();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();

  const recipe = RECIPES[name];
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = recipe.type;
  osc.frequency.setValueAtTime(recipe.freq, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, recipe.to), now + recipe.dur);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(recipe.gain, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + recipe.dur);

  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + recipe.dur + 0.02);
}

/** Estado do feedback sonoro + disparo de sons. */
export function useSound() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const sync = () => setEnabled(isSoundEnabled());
    sync();
    window.addEventListener("clipcore:sound", sync);
    return () => window.removeEventListener("clipcore:sound", sync);
  }, []);

  const toggle = useCallback(() => {
    const next = !isSoundEnabled();
    setSoundEnabled(next);
    if (next) playSound("click");
  }, []);

  return { enabled, toggle, play: playSound };
}
