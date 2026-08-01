/**
 * Bridge between the React UI and the Tauri backend.
 *
 * Environment detection replaces the old `DEMO_MODE` constant: when the app runs
 * inside the Tauri shell every call goes to a real Rust command. In the browser
 * preview the calls fall back to explicit mocks and the UI shows
 * "Modo demonstração".
 */

type InvokeFn = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
type ListenFn = (event: string, handler: (payload: unknown) => void) => Promise<() => void>;

interface TauriInternals {
  invoke?: InvokeFn;
}

declare global {
  interface Window {
    __TAURI__?: { core?: TauriInternals; event?: unknown };
    __TAURI_INTERNALS__?: TauriInternals;
  }
}

/** True only inside the desktop shell. */
export function isDesktopRuntime(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__);
}

/** True in the browser preview, where all data is simulated. */
export function isDemoRuntime(): boolean {
  return !isDesktopRuntime();
}

export const RUNTIME_LABEL = () => (isDesktopRuntime() ? "Desktop nativo" : "Modo demonstração");

export interface NativeError {
  code: string;
  message: string;
}

export class DemoModeError extends Error {
  readonly code = "demo_mode";
  constructor(command: string) {
    super(`"${command}" requer o aplicativo desktop ClipCore.`);
  }
}

export function toNativeError(error: unknown): NativeError {
  if (error && typeof error === "object" && "code" in error && "message" in error) {
    return error as NativeError;
  }
  return { code: "unknown", message: error instanceof Error ? error.message : String(error) };
}

let invokeRef: InvokeFn | null = null;
let listenRef: ListenFn | null = null;

async function loadInvoke(): Promise<InvokeFn> {
  if (invokeRef) return invokeRef;
  const mod = (await import(/* @vite-ignore */ "@tauri-apps/api/core")) as { invoke: InvokeFn };
  invokeRef = mod.invoke;
  return invokeRef;
}

async function loadListen(): Promise<ListenFn> {
  if (listenRef) return listenRef;
  const mod = (await import(/* @vite-ignore */ "@tauri-apps/api/event")) as {
    listen: (event: string, cb: (e: { payload: unknown }) => void) => Promise<() => void>;
  };
  listenRef = (event, handler) => mod.listen(event, (e) => handler(e.payload));
  return listenRef;
}

/**
 * Invokes a Rust command. `fallback` is used ONLY in the browser; when the
 * desktop backend is present its result (or error) is always the source of truth.
 */
export async function nativeInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
  fallback?: () => T | Promise<T>,
): Promise<T> {
  if (!isDesktopRuntime()) {
    if (fallback) return await fallback();
    throw new DemoModeError(command);
  }
  const invoke = await loadInvoke();
  return invoke<T>(command, args);
}

/** Subscribes to a backend event; no-op in the browser preview. */
export async function nativeListen(
  event: string,
  handler: (payload: unknown) => void,
): Promise<() => void> {
  if (!isDesktopRuntime()) return () => {};
  const listen = await loadListen();
  return listen(event, handler);
}

export const NATIVE_EVENTS = {
  captureState: "clipcore://capture-state",
  clipSaved: "clipcore://clip-saved",
  gameDetected: "clipcore://game-detected",
  storageWarning: "clipcore://storage-warning",
  performance: "clipcore://performance",
  diagnostic: "clipcore://diagnostic",
} as const;
