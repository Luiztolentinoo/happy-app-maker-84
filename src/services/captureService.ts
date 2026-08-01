import { NATIVE_EVENTS, isDesktopRuntime, nativeInvoke, nativeListen } from "./nativeClient";

export type NativeCaptureState =
  | "idle"
  | "detecting"
  | "buffering"
  | "recording_session"
  | "saving_clip"
  | "paused"
  | "degraded"
  | "error"
  | "shutting_down";

export interface CaptureSettings {
  buffer_seconds: number;
  width: number;
  height: number;
  fps: number;
  bitrate_kbps: number;
  codec: "h264" | "hevc";
  segment_ms: number;
  audio_device_ids: string[];
  source_id: string | null;
}

export interface CaptureStatus {
  state: NativeCaptureState;
  buffer_seconds: number;
  buffered_ms: number;
  buffered_bytes: number;
  settings: CaptureSettings;
  degraded_reason: string | null;
  native_capture_available: boolean;
}

const demoStatus = (): CaptureStatus => ({
  state: "degraded",
  buffer_seconds: 60,
  buffered_ms: 60_000,
  buffered_bytes: 0,
  settings: {
    buffer_seconds: 60,
    width: 1920,
    height: 1080,
    fps: 60,
    bitrate_kbps: 30_000,
    codec: "h264",
    segment_ms: 2_000,
    audio_device_ids: ["loopback-default"],
    source_id: null,
  },
  degraded_reason: "Prévia no navegador: captura nativa indisponível.",
  native_capture_available: false,
});

export const captureService = {
  isNative: isDesktopRuntime,
  getStatus: () => nativeInvoke<CaptureStatus>("get_capture_state", undefined, demoStatus),
  startBuffer: () => nativeInvoke<CaptureStatus>("start_buffer", undefined, demoStatus),
  stopBuffer: () =>
    nativeInvoke<CaptureStatus>("stop_buffer", undefined, () => ({ ...demoStatus(), state: "idle" })),
  saveRetroactiveClip: (seconds: number, title?: string, game?: string) =>
    nativeInvoke<unknown>("save_retroactive_clip", { args: { seconds, title, game } }),
  startSession: () => nativeInvoke<CaptureStatus>("start_session_recording"),
  stopSession: () => nativeInvoke<CaptureStatus>("stop_session_recording"),
  pause: () => nativeInvoke<CaptureStatus>("pause_recording"),
  resume: () => nativeInvoke<CaptureStatus>("resume_recording"),
  listSources: () => nativeInvoke("list_capture_sources", undefined, () => []),
  listAudioDevices: () => nativeInvoke("list_audio_devices", undefined, () => []),
  listEncoders: () => nativeInvoke("list_encoders", undefined, () => []),
  detectGames: () => nativeInvoke("detect_games", undefined, () => []),
  updateSettings: (settings: CaptureSettings) =>
    nativeInvoke<CaptureStatus>("update_capture_settings", { settings }),
  onStateChange: (handler: (payload: unknown) => void) =>
    nativeListen(NATIVE_EVENTS.captureState, handler),
};
