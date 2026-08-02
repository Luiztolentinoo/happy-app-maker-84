/**
 * Serviço de atualização. Toda a lógica de estado vive aqui para que a rota
 * `/updates` seja apenas apresentação.
 *
 * No navegador nada é baixado nem instalado: o serviço reporta
 * `unavailable_in_browser`, deixando explícito que atualizações desktop não
 * podem ser testadas na prévia.
 */
import {
  APP_CHANNEL,
  APP_VERSION,
  channelAllowsAutoUpdate,
  type ReleaseChannel,
} from "@/lib/distribution";
import { isDesktopRuntime, nativeInvoke } from "./nativeClient";

export type UpdateStatus =
  | "up_to_date"
  | "checking"
  | "available"
  | "downloading"
  | "ready_to_install"
  | "installing"
  | "failed"
  | "blocked_unsigned"
  | "unavailable_in_browser";

export interface UpdateInfo {
  status: UpdateStatus;
  currentVersion: string;
  channel: ReleaseChannel;
  availableVersion: string | null;
  notes: string | null;
  sizeBytes: number | null;
  /** 0–100 durante o download. */
  progress: number;
  lastCheckedAt: string | null;
  /** Verdadeiro quando o manifesto foi verificado com a chave pública. */
  signatureVerified: boolean;
  error: string | null;
  /** Atualização adiada até este instante ISO. */
  postponedUntil: string | null;
}

const POSTPONE_KEY = "clipcore.update.postponedUntil";
const POSTPONE_MS = 24 * 60 * 60 * 1000;

function readPostponed(): string | null {
  try {
    return localStorage.getItem(POSTPONE_KEY);
  } catch {
    return null;
  }
}

export function baseUpdateInfo(): UpdateInfo {
  return {
    status: isDesktopRuntime() ? "up_to_date" : "unavailable_in_browser",
    currentVersion: APP_VERSION,
    channel: APP_CHANNEL,
    availableVersion: null,
    notes: null,
    sizeBytes: null,
    progress: 0,
    lastCheckedAt: null,
    signatureVerified: false,
    error: null,
    postponedUntil: readPostponed(),
  };
}

/** Motivo pelo qual a verificação não pode ocorrer, ou `null` quando é possível. */
export function updateBlockReason(): string | null {
  if (!isDesktopRuntime())
    return "Atualizações desktop não podem ser testadas na prévia do navegador.";
  if (!channelAllowsAutoUpdate())
    return `O canal ${APP_CHANNEL} distribui builds não assinadas: a atualização automática permanece desativada até que as chaves do updater estejam configuradas.`;
  return null;
}

export const updateService = {
  isNative: isDesktopRuntime,
  base: baseUpdateInfo,
  blockReason: updateBlockReason,

  /** Consulta o manifesto assinado. Nunca aceita release sem assinatura válida. */
  async check(): Promise<UpdateInfo> {
    const base = baseUpdateInfo();
    const blocked = updateBlockReason();
    if (blocked) {
      return {
        ...base,
        status: isDesktopRuntime() ? "blocked_unsigned" : "unavailable_in_browser",
        error: blocked,
        lastCheckedAt: new Date().toISOString(),
      };
    }
    const result = await nativeInvoke<Partial<UpdateInfo>>("check_for_update", undefined, () => ({}));
    return { ...base, ...result, lastCheckedAt: new Date().toISOString() };
  },

  async download(onProgress?: (percent: number) => void): Promise<UpdateInfo> {
    const blocked = updateBlockReason();
    if (blocked) return { ...baseUpdateInfo(), status: "blocked_unsigned", error: blocked };
    onProgress?.(0);
    const result = await nativeInvoke<Partial<UpdateInfo>>("download_update", undefined, () => ({}));
    onProgress?.(100);
    return { ...baseUpdateInfo(), ...result, status: "ready_to_install", progress: 100 };
  },

  /** Instala e reinicia. Só é chamado quando a assinatura foi verificada. */
  async installAndRestart(): Promise<void> {
    const blocked = updateBlockReason();
    if (blocked) throw new Error(blocked);
    await nativeInvoke<void>("install_update", undefined, () => undefined);
  },

  postpone(): string {
    const until = new Date(Date.now() + POSTPONE_MS).toISOString();
    try {
      localStorage.setItem(POSTPONE_KEY, until);
    } catch {
      /* storage indisponível: adia apenas na sessão */
    }
    return until;
  },

  clearPostpone(): void {
    try {
      localStorage.removeItem(POSTPONE_KEY);
    } catch {
      /* ignora */
    }
  },

  isPostponed(now = Date.now()): boolean {
    const until = readPostponed();
    return Boolean(until && Date.parse(until) > now);
  },
};
