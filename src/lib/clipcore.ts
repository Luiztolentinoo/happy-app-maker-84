export const APP_NAME = "ClipCore";
export const DEMO_MODE = true;

export type CaptureState =
  | "idle"
  | "detecting"
  | "buffering"
  | "recording_session"
  | "saving_clip"
  | "degraded"
  | "error";

export type ClipType = "retroactive" | "session" | "screenshot" | "export";

export interface Clip {
  id: string;
  title: string;
  game: string;
  capturedAt: string;
  durationMs: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  fileSize: number;
  type: ClipType;
  favorite: boolean;
  uploadStatus: "local" | "uploading" | "uploaded" | "failed";
  tags: string[];
  accent: string;
}

export const BUFFER_OPTIONS = [15, 30, 45, 60, 120, 180, 300];

export interface HotkeyBinding {
  id: string;
  label: string;
  combo: string;
}

export const DEFAULT_HOTKEYS: HotkeyBinding[] = [
  { id: "save_clip", label: "Salvar clipe", combo: "F8" },
  { id: "toggle_session", label: "Iniciar/parar gravação", combo: "F9" },
  { id: "marker", label: "Criar marcador", combo: "F10" },
  { id: "screenshot", label: "Capturar imagem", combo: "F7" },
  { id: "mic", label: "Ativar/desativar microfone", combo: "Ctrl+M" },
  { id: "overlay", label: "Mostrar/ocultar overlay", combo: "Shift+F8" },
];

const RESERVED = ["Ctrl+Alt+Del", "Ctrl+Shift+Esc", "Alt+Tab", "Win+L", "Win+D"];

export function hotkeyIssues(bindings: HotkeyBinding[]): Record<string, string> {
  const issues: Record<string, string> = {};
  const seen = new Map<string, string>();
  for (const b of bindings) {
    const combo = b.combo.trim();
    if (!combo) {
      issues[b.id] = "Atalho vazio";
      continue;
    }
    if (RESERVED.some((r) => r.toLowerCase() === combo.toLowerCase())) {
      issues[b.id] = "Reservado pelo Windows";
      continue;
    }
    const prev = seen.get(combo.toLowerCase());
    if (prev) issues[b.id] = `Conflito com "${prev}"`;
    else seen.set(combo.toLowerCase(), b.label);
  }
  return issues;
}

export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i] ?? "TB"}`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Estimativa de armazenamento por minuto para um bitrate em Mbps. */
export function estimateSizePerMinute(bitrateMbps: number): number {
  return (bitrateMbps * 1_000_000 * 60) / 8;
}

/** Dados simulados — nenhuma captura nativa acontece no ambiente web. */
export function makeDemoClips(): Clip[] {
  const base = Date.now();
  const seeds: Array<[string, string, number, ClipType, string]> = [
    ["Ace na bomba B", "Tactical Strike", 28_000, "retroactive", "oklch(0.62 0.19 265)"],
    ["Clutch 1v3", "Tactical Strike", 42_000, "retroactive", "oklch(0.58 0.15 235)"],
    ["Final da ranqueada", "Rift Legends", 186_000, "session", "oklch(0.6 0.16 300)"],
    ["Salto impossível", "Neon Runner", 15_000, "retroactive", "oklch(0.66 0.15 200)"],
    ["Boss em 40s", "Ember Souls", 51_000, "retroactive", "oklch(0.58 0.2 25)"],
    ["Print do placar", "Rift Legends", 0, "screenshot", "oklch(0.7 0.14 145)"],
    ["Highlight vertical", "Neon Runner", 22_000, "export", "oklch(0.64 0.17 320)"],
    ["Sessão completa", "Ember Souls", 1_820_000, "session", "oklch(0.55 0.12 255)"],
  ];
  return seeds.map(([title, game, durationMs, type, accent], i) => ({
    id: `clip-${i + 1}`,
    title,
    game,
    capturedAt: new Date(base - i * 5_400_000).toISOString(),
    durationMs,
    width: i % 3 === 0 ? 2560 : 1920,
    height: i % 3 === 0 ? 1440 : 1080,
    fps: i % 4 === 0 ? 120 : 60,
    codec: i % 5 === 0 ? "H.265" : "H.264",
    fileSize: Math.max(2_400_000, durationMs * 900),
    type,
    favorite: i === 0 || i === 4,
    uploadStatus: (["local", "uploaded", "uploading", "failed", "local"] as const)[i % 5]!,
    tags: type === "session" ? ["ranqueada"] : ["highlight"],
    accent,
  }));
}

export interface DiagnosticResult {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
  fix?: string;
}

export function runDemoDiagnostics(): DiagnosticResult[] {
  return [
    { id: "engine", label: "Motor de captura", status: "warn", detail: "Simulado — requer build Windows/Tauri.", fix: "Compile o projeto desktop no Windows." },
    { id: "encoder", label: "Encoder de hardware", status: "warn", detail: "Não detectável no navegador.", fix: "Execute o diagnóstico nativo." },
    { id: "audio", label: "Dispositivos de áudio", status: "pass", detail: "API de mídia disponível." },
    { id: "hotkeys", label: "Atalhos globais", status: "warn", detail: "Atalhos globais exigem camada nativa." },
    { id: "storage", label: "Escrita em disco", status: "pass", detail: "Persistência local disponível." },
    { id: "player", label: "Reprodução de vídeo", status: "pass", detail: "Decodificação MP4/H.264 disponível." },
    { id: "network", label: "Rede", status: "pass", detail: "Conexão ativa." },
  ];
}
