/**
 * Shared contracts mirroring the Rust structs exposed by the Tauri commands.
 * Kept in sync manually; the source of truth is `apps/desktop/src-tauri/src`.
 */
export type CaptureState =
  | "idle"
  | "detecting"
  | "buffering"
  | "recording_session"
  | "saving_clip"
  | "paused"
  | "degraded"
  | "error"
  | "shutting_down";

export type ClipType = "retroactive" | "session" | "screenshot" | "export";

export interface NativeError {
  code: string;
  message: string;
}

export const TAURI_COMMANDS = [
  "get_capture_state",
  "start_buffer",
  "stop_buffer",
  "save_retroactive_clip",
  "start_session_recording",
  "stop_session_recording",
  "pause_recording",
  "resume_recording",
  "list_capture_sources",
  "list_audio_devices",
  "list_encoders",
  "detect_games",
  "get_storage_status",
  "update_capture_settings",
  "register_hotkey",
  "unregister_hotkey",
  "run_native_diagnostics",
  "generate_thumbnail",
  "list_local_clips",
  "rename_clip",
  "favorite_clip",
  "delete_clip",
  "restore_clip",
  "export_clip",
] as const;

export type TauriCommand = (typeof TAURI_COMMANDS)[number];
