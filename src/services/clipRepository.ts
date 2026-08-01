import { isDesktopRuntime, nativeInvoke } from "./nativeClient";

export interface NativeClipRecord {
  id: string;
  title: string;
  game: string | null;
  filePath: string;
  thumbnailPath: string | null;
  capturedAt: string;
  durationMs: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  fileSize: number;
  clipType: string;
  favorite: boolean;
  deletedAt: string | null;
  tags: string[];
}

/**
 * Clip library access. Inside the desktop app every operation hits SQLite
 * through Rust; in the browser the existing local hook keeps working and this
 * repository reports that it is not authoritative.
 */
export const clipRepository = {
  isNative: isDesktopRuntime,
  list: (includeDeleted = false) =>
    nativeInvoke<NativeClipRecord[]>("list_local_clips", { includeDeleted }, () => []),
  rename: (id: string, title: string) =>
    nativeInvoke<NativeClipRecord>("rename_clip", { id, title }),
  favorite: (id: string, favorite: boolean) =>
    nativeInvoke<NativeClipRecord>("favorite_clip", { id, favorite }),
  remove: (id: string) => nativeInvoke<void>("delete_clip", { id }),
  restore: (id: string) => nativeInvoke<NativeClipRecord>("restore_clip", { id }),
  generateThumbnail: (clipId: string, atMs = 1_000) =>
    nativeInvoke<{ path: string }>("generate_thumbnail", { args: { clipId, atMs } }),
  export: (clipId: string, startMs: number, endMs: number) =>
    nativeInvoke<string>("export_clip", { args: { clipId, startMs, endMs } }),
};
