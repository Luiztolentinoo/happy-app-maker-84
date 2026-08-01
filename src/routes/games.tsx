import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Gamepad2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Module, Badge } from "@ds";
import { useClips } from "@/hooks/use-clips";
import { formatBytes, formatDuration } from "@/lib/clipcore";

export const Route = createFileRoute("/games")({
  head: () => ({
    meta: [
      { title: "Jogos detectados — ClipCore" },
      {
        name: "description",
        content:
          "Jogos detectados pelo ClipCore com contagem de clipes, tempo capturado e espaço em disco por título.",
      },
      { property: "og:title", content: "Jogos detectados — ClipCore" },
      {
        property: "og:description",
        content: "Perfis automáticos por jogo com estatísticas de captura.",
      },
    ],
  }),
  component: GamesPage,
});

function GamesPage() {
  const { clips } = useClips();

  const games = useMemo(() => {
    const map = new Map<string, { count: number; ms: number; bytes: number }>();
    for (const c of clips) {
      const entry = map.get(c.game) ?? { count: 0, ms: 0, bytes: 0 };
      entry.count += 1;
      entry.ms += c.durationMs;
      entry.bytes += c.fileSize;
      map.set(c.game, entry);
    }
    return [...map.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [clips]);

  return (
    <AppShell
      title="Jogos"
      subtitle="Perfis automáticos detectados pelo motor de captura"
      actions={<Badge tone="purple">{games.length} títulos</Badge>}
    >
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {games.map(([game, stats]) => (
          <Module key={game} icon={Gamepad2} title={game}>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Cell label="Clipes" value={String(stats.count)} />
              <Cell label="Tempo" value={formatDuration(stats.ms)} />
              <Cell label="Disco" value={formatBytes(stats.bytes)} />
            </div>
          </Module>
        ))}
        {games.length === 0 ? (
          <Module>
            <p className="text-sm text-muted-foreground">Nenhum jogo detectado ainda.</p>
          </Module>
        ) : null}
      </div>
    </AppShell>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 p-3">
      <p className="label-caps">{label}</p>
      <p className="mt-1 font-display text-base font-semibold">{value}</p>
    </div>
  );
}
