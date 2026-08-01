import { describe, expect, it } from "vitest";

import { findConflict, isReserved, DEFAULT_HOTKEYS } from "../src/services/hotkeyService";
import { isDemoRuntime, isDesktopRuntime } from "../src/services/nativeClient";

describe("hotkey rules", () => {
  it("ships the documented defaults", () => {
    expect(DEFAULT_HOTKEYS.find((b) => b.action === "save_clip")?.combo).toBe("F8");
    expect(DEFAULT_HOTKEYS).toHaveLength(6);
  });

  it("detects conflicts against other actions", () => {
    expect(findConflict(DEFAULT_HOTKEYS, "marker", "F8")).toBe("save_clip");
    expect(findConflict(DEFAULT_HOTKEYS, "save_clip", "F8")).toBeNull();
  });

  it("blocks reserved OS combos", () => {
    expect(isReserved("alt + f4")).toBe(true);
    expect(isReserved("F8")).toBe(false);
  });
});

describe("runtime detection", () => {
  it("reports demo mode outside the Tauri shell", () => {
    expect(isDesktopRuntime()).toBe(false);
    expect(isDemoRuntime()).toBe(true);
  });
});
