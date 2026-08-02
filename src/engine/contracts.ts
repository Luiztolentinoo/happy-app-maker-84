/**
 * ClipCore Capture Engine — contracts.
 *
 * Single source of truth for the engine's interfaces. Both the browser
 * (simulated) adapters and the native Tauri/Rust adapters implement these, so
 * the UI never depends on a concrete backend. Rust mirrors the same shapes in
 * `apps/desktop/src-tauri/src` (see docs/CAPTURE_ENGINE.md).
 */

import type { CaptureSettings, CaptureStatus, NativeCaptureState } from "@/services/captureService";
import type { DiagnosticReport } from "@/services/diagnosticService";
import type { HotkeyAction, NativeHotkeyBinding } from "@/services/hotkeyService";

export type { CaptureSettings, CaptureStatus, NativeCaptureState };
export type { DiagnosticReport };
export type { HotkeyAction, NativeHotkeyBinding };

/** Every subsystem reports readiness the same way. */
export type SubsystemHealth = "ok" | "degraded" | "unavailable" | "failed";

export interface SubsystemStatus {
  id: SubsystemId;
  health: SubsystemHealth;
  detail: string;
  /** Epoch ms of the last successful heartbeat. */
  lastHeartbeat: number | null;
}

export type SubsystemId =
  | "game_detector"
  | "capture_engine"
  | "circular_buffer"
  | "encoder"
  | "hotkeys"
  | "audio_engine"
  | "storage"
  | "recovery"
  | "performance_monitor"
  | "diagnostics";

export const SUBSYSTEMS: readonly SubsystemId[] = [
  "game_detector",
  "capture_engine",
  "circular_buffer",
  "encoder",
  "hotkeys",
  "audio_engine",
  "storage",
  "recovery",
  "performance_monitor",
  "diagnostics",
] as const;

export const SUBSYSTEM_LABELS: Record<SubsystemId, string> = {
  game_detector: "Detector de jogos",
  capture_engine: "Motor de captura",
  circular_buffer: "Buffer circular",
  encoder: "Encoder",
  hotkeys: "Atalhos globais",
  audio_engine: "Motor de áudio",
  storage: "Armazenamento",
  recovery: "Recovery",
  performance_monitor: "Monitor de performance",
  diagnostics: "Diagnóstico",
};

/* ------------------------------------------------------------------ */
/* Game detector                                                       */
/* ------------------------------------------------------------------ */

export interface DetectedGame {
  id: string;
  name: string;
  executable: string;
  pid: number | null;
  api: "dx11" | "dx12" | "vulkan" | "opengl" | "unknown";
  fullscreen: boolean;
  confidence: number;
}

export interface GameDetector {
  /** Snapshot of the currently running games, best candidate first. */
  detect(): Promise<DetectedGame[]>;
  /** Best candidate for automatic capture, or null when no game is running. */
  active(): Promise<DetectedGame | null>;
}

/* ------------------------------------------------------------------ */
/* Circular buffer                                                     */
/* ------------------------------------------------------------------ */

export interface BufferSegment {
  id: string;
  startedAtMs: number;
  durationMs: number;
  bytes: number;
  pinned: boolean;
}

export interface BufferStats {
  segments: number;
  bufferedMs: number;
  bytes: number;
  capacityMs: number;
  capacityBytes: number;
  evictions: number;
}

export interface CircularBufferPort {
  stats(): BufferStats;
  push(segment: BufferSegment): void;
  /** Pins the newest `seconds` worth of segments so a writer can consume them. */
  pinLast(seconds: number): BufferSegment[];
  release(ids: string[]): void;
  clear(): void;
}

/* ------------------------------------------------------------------ */
/* Encoder                                                            */
/* ------------------------------------------------------------------ */

export interface EncoderInfo {
  id: string;
  label: string;
  vendor: "nvidia" | "amd" | "intel" | "software" | "unknown";
  codec: "h264" | "hevc" | "av1";
  hardware: boolean;
  available: boolean;
}

export interface EncoderPort {
  list(): Promise<EncoderInfo[]>;
  /** Best available encoder for the requested codec, or null. */
  select(codec: "h264" | "hevc" | "av1"): Promise<EncoderInfo | null>;
}

/* ------------------------------------------------------------------ */
/* Audio engine                                                       */
/* ------------------------------------------------------------------ */

export interface AudioDeviceInfo {
  id: string;
  label: string;
  kind: "loopback" | "microphone";
  isDefault: boolean;
  available: boolean;
}

export interface AudioEnginePort {
  devices(): Promise<AudioDeviceInfo[]>;
  setTracks(deviceIds: string[]): Promise<void>;
}

/* ------------------------------------------------------------------ */
/* Storage                                                            */
/* ------------------------------------------------------------------ */

export interface StorageStatus {
  clipsDir: string;
  usedBytes: number;
  quotaBytes: number;
  freeBytes: number;
  segmentsBytes: number;
  warning: string | null;
}

export interface StoragePort {
  status(): Promise<StorageStatus>;
  /** Frees space by removing the oldest expendable clips/segments. */
  reclaim(bytes: number): Promise<number>;
}

/* ------------------------------------------------------------------ */
/* Recovery                                                           */
/* ------------------------------------------------------------------ */

export interface RecoverableItem {
  path: string;
  bytes: number;
  recoverable: boolean;
}

export interface RecoveryPort {
  scan(): Promise<RecoverableItem[]>;
  recover(path: string): Promise<string>;
  discard(path: string): Promise<void>;
}

/* ------------------------------------------------------------------ */
/* Capture engine                                                     */
/* ------------------------------------------------------------------ */

export interface CaptureEnginePort {
  status(): Promise<CaptureStatus>;
  startBuffer(): Promise<CaptureStatus>;
  stopBuffer(): Promise<CaptureStatus>;
  saveRetroactive(seconds: number, meta?: { title?: string; game?: string }): Promise<unknown>;
  startSession(): Promise<CaptureStatus>;
  stopSession(): Promise<CaptureStatus>;
  pause(): Promise<CaptureStatus>;
  resume(): Promise<CaptureStatus>;
  updateSettings(settings: CaptureSettings): Promise<CaptureStatus>;
}

/* ------------------------------------------------------------------ */
/* Hotkeys                                                            */
/* ------------------------------------------------------------------ */

export interface HotkeyPort {
  defaults(): NativeHotkeyBinding[];
  register(action: HotkeyAction, combo: string, enabled?: boolean): Promise<NativeHotkeyBinding>;
  unregister(action: HotkeyAction): Promise<void>;
}

/* ------------------------------------------------------------------ */
/* Diagnostics                                                        */
/* ------------------------------------------------------------------ */

export interface DiagnosticsPort {
  run(): Promise<DiagnosticReport>;
}
