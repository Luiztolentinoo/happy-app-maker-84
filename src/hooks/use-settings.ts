import { useCallback, useEffect, useState } from "react";
import { DEFAULT_HOTKEYS, type HotkeyBinding } from "@/lib/clipcore";

const KEY = "clipcore.settings.v1";

export interface ClipcoreSettings {
  hotkeys: HotkeyBinding[];
  bufferSeconds: number;
  qualityMode: "economy" | "balanced" | "high" | "custom";
  resolution: "720p" | "1080p" | "1440p" | "2160p" | "native";
  fps: 30 | 60 | 120 | 144;
  codec: "h264" | "h265" | "av1";
  bitrateMbps: number;
  micEnabled: boolean;
  systemAudio: boolean;
  overlayMode: "full" | "compact" | "notifications" | "off";
  folder: string;
  maxStorageGb: number;
  autoDelete: boolean;
  telemetry: boolean;
  language: "pt-BR" | "en-US";
}

export const DEFAULT_SETTINGS: ClipcoreSettings = {
  hotkeys: DEFAULT_HOTKEYS,
  bufferSeconds: 30,
  qualityMode: "balanced",
  resolution: "1080p",
  fps: 60,
  codec: "h264",
  bitrateMbps: 25,
  micEnabled: true,
  systemAudio: true,
  overlayMode: "compact",
  folder: "C:\\Users\\Public\\Videos\\ClipCore",
  maxStorageGb: 250,
  autoDelete: true,
  telemetry: false,
  language: "pt-BR",
};

export function useSettings() {
  const [settings, setSettings] = useState<ClipcoreSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setSettings({ ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as ClipcoreSettings) });
    } catch {
      /* configuração inválida: mantém os padrões */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(KEY, JSON.stringify(settings));
  }, [settings, ready]);

  const update = useCallback(<K extends keyof ClipcoreSettings>(key: K, value: ClipcoreSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => setSettings(DEFAULT_SETTINGS), []);

  return { settings, ready, update, reset };
}
