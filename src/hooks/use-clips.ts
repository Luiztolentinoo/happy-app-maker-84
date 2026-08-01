import { useCallback, useEffect, useState } from "react";
import { type Clip, makeDemoClips } from "@/lib/clipcore";

const KEY = "clipcore.library.v1";

export function useClips() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [trash, setTrash] = useState<Clip[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { clips: Clip[]; trash: Clip[] };
        setClips(parsed.clips ?? []);
        setTrash(parsed.trash ?? []);
      } else {
        setClips(makeDemoClips());
      }
    } catch {
      setClips(makeDemoClips());
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(KEY, JSON.stringify({ clips, trash }));
  }, [clips, trash, ready]);

  const rename = useCallback((id: string, title: string) => {
    setClips((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setClips((prev) => prev.map((c) => (c.id === id ? { ...c, favorite: !c.favorite } : c)));
  }, []);

  const remove = useCallback((id: string) => {
    setClips((prev) => {
      const target = prev.find((c) => c.id === id);
      if (target) setTrash((t) => [target, ...t]);
      return prev.filter((c) => c.id !== id);
    });
  }, []);

  const restore = useCallback((id: string) => {
    setTrash((prev) => {
      const target = prev.find((c) => c.id === id);
      if (target) setClips((c) => [target, ...c]);
      return prev.filter((c) => c.id !== id);
    });
  }, []);

  const addSimulated = useCallback((clip: Clip) => {
    setClips((prev) => [clip, ...prev]);
  }, []);

  const resetDemo = useCallback(() => {
    setClips(makeDemoClips());
    setTrash([]);
  }, []);

  return { clips, trash, ready, rename, toggleFavorite, remove, restore, addSimulated, resetDemo };
}
