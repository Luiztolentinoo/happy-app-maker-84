/**
 * Port adapters.
 *
 * `createEnginePorts()` returns native adapters inside the desktop shell and
 * simulated ones in the browser preview. Both satisfy the same contracts, which
 * is what keeps the UI identical in either runtime.
 */

import { captureService } from "@/services/captureService";
import { clipRepository } from "@/services/clipRepository";
import { diagnosticService } from "@/services/diagnosticService";
import { hotkeyService } from "@/services/hotkeyService";
import { isDesktopRuntime, nativeInvoke } from "@/services/nativeClient";
import { storageService } from "@/services/storageService";
import type {
  AudioDeviceInfo,
  CaptureEnginePort,
  DetectedGame,
  DiagnosticsPort,
  EncoderInfo,
  EncoderPort,
  GameDetector,
  HotkeyPort,
  RecoverableItem,
  RecoveryPort,
  StoragePort,
  StorageStatus,
} from "./contracts";
import type { EnginePorts } from "./runtime";

const capturePort: CaptureEnginePort = {
  status: () => captureService.getStatus(),
  startBuffer: () => captureService.startBuffer(),
  stopBuffer: () => captureService.stopBuffer(),
  saveRetroactive: (seconds, meta) =>
    captureService.saveRetroactiveClip(seconds, meta?.title, meta?.game),
  startSession: () => captureService.startSession(),
  stopSession: () => captureService.stopSession(),
  pause: () => captureService.pause(),
  resume: () => captureService.resume(),
  updateSettings: (settings) => captureService.updateSettings(settings),
};

const gameDetector: GameDetector = {
  detect: async () => (await captureService.detectGames()) as DetectedGame[],
  active: async () => {
    const games = (await captureService.detectGames()) as DetectedGame[];
    const sorted = [...games].sort((a, b) => b.confidence - a.confidence);
    return sorted[0] ?? null;
  },
};

const encoderPort: EncoderPort = {
  list: async () => (await captureService.listEncoders()) as EncoderInfo[],
  select: async (codec) => {
    const encoders = (await captureService.listEncoders()) as EncoderInfo[];
    const usable = encoders.filter((encoder) => encoder.available && encoder.codec === codec);
    return usable.find((encoder) => encoder.hardware) ?? usable[0] ?? null;
  },
};

const hotkeyPort: HotkeyPort = {
  defaults: () => hotkeyService.defaults(),
  register: (action, combo, enabled) => hotkeyService.register(action, combo, enabled),
  unregister: (action) => hotkeyService.unregister(action),
};

const storagePort: StoragePort = {
  status: async () => (await storageService.getStatus()) as unknown as StorageStatus,
  reclaim: (bytes) => nativeInvoke<number>("reclaim_storage", { bytes }, () => 0),
};

const recoveryPort: RecoveryPort = {
  scan: () => nativeInvoke<RecoverableItem[]>("scan_recoverable", undefined, () => []),
  recover: (path) => nativeInvoke<string>("recover_file", { path }, () => path),
  discard: (path) => nativeInvoke<void>("discard_file", { path }, () => undefined),
};

const diagnosticsPort: DiagnosticsPort = {
  run: () => diagnosticService.run(),
};

/** Queue workers: native commands, or resolved no-ops in the preview. */
function queueHandlers(native: boolean): EnginePorts["queues"] {
  return {
    writeRecording: async (payload) => {
      if (!native) return;
      await nativeInvoke("finalize_recording_job", { args: payload });
    },
    runExport: async (payload) => {
      if (!native) return;
      await clipRepository.export(payload.clipId, payload.startMs, payload.endMs);
    },
    buildThumbnail: async (payload) => {
      if (!native) return;
      await clipRepository.generateThumbnail(payload.clipId, payload.atMs);
    },
  };
}

export function createEnginePorts(native = isDesktopRuntime()): EnginePorts {
  return {
    capture: capturePort,
    games: gameDetector,
    encoders: encoderPort,
    hotkeys: hotkeyPort,
    storage: storagePort,
    recovery: recoveryPort,
    diagnostics: diagnosticsPort,
    queues: queueHandlers(native),
  };
}

export async function listAudioDevices(): Promise<AudioDeviceInfo[]> {
  return (await captureService.listAudioDevices()) as AudioDeviceInfo[];
}
