import { nativeInvoke } from "./nativeClient";

export type HotkeyAction =
  | "save_clip"
  | "toggle_session_recording"
  | "marker"
  | "screenshot"
  | "toggle_microphone"
  | "toggle_overlay";

export interface NativeHotkeyBinding {
  action: HotkeyAction;
  combo: string;
  enabled: boolean;
  profile_id: string | null;
}

export const DEFAULT_HOTKEYS: NativeHotkeyBinding[] = [
  { action: "save_clip", combo: "F8", enabled: true, profile_id: null },
  { action: "toggle_session_recording", combo: "F9", enabled: true, profile_id: null },
  { action: "marker", combo: "F10", enabled: true, profile_id: null },
  { action: "screenshot", combo: "F7", enabled: true, profile_id: null },
  { action: "toggle_microphone", combo: "Ctrl+M", enabled: true, profile_id: null },
  { action: "toggle_overlay", combo: "Shift+F8", enabled: true, profile_id: null },
];

export const RESERVED_COMBOS = [
  "Ctrl+Alt+Delete",
  "Ctrl+Shift+Escape",
  "Alt+Tab",
  "Alt+F4",
  "Super+L",
];

const normalize = (combo: string) => combo.replace(/\s+/g, "").toLowerCase();

export function isReserved(combo: string): boolean {
  return RESERVED_COMBOS.some((r) => normalize(r) === normalize(combo));
}

export function findConflict(
  bindings: NativeHotkeyBinding[],
  action: HotkeyAction,
  combo: string,
): HotkeyAction | null {
  const hit = bindings.find((b) => b.action !== action && normalize(b.combo) === normalize(combo));
  return hit ? hit.action : null;
}

export const hotkeyService = {
  register: (action: HotkeyAction, combo: string, enabled = true) =>
    nativeInvoke<NativeHotkeyBinding>("register_hotkey", { args: { action, combo, enabled } }),
  unregister: (action: HotkeyAction) => nativeInvoke<void>("unregister_hotkey", { action }),
  defaults: () => DEFAULT_HOTKEYS,
};
