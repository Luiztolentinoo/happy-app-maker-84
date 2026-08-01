import { NATIVE_EVENTS, nativeInvoke, nativeListen } from "./nativeClient";

export interface StorageStatus {
  clips_dir: string;
  temp_dir: string;
  used_bytes: number;
  free_bytes: number;
  total_bytes: number;
  clip_count: number;
  quota_bytes: number;
  low_space: boolean;
}

export const storageService = {
  getStatus: () =>
    nativeInvoke<StorageStatus>("get_storage_status", undefined, () => ({
      clips_dir: "(prévia no navegador)",
      temp_dir: "(prévia no navegador)",
      used_bytes: 0,
      free_bytes: 0,
      total_bytes: 0,
      clip_count: 0,
      quota_bytes: 0,
      low_space: false,
    })),
  onWarning: (handler: (payload: unknown) => void) =>
    nativeListen(NATIVE_EVENTS.storageWarning, handler),
};
