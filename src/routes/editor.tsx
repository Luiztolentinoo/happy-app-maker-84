import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, Scissors } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Module, StatusChip } from "@/components/Module";
import { Button } from "@/components/ui/button";
import { useClips } from "@/hooks/use-clips";
import { formatDuration } from "@/lib/clipcore";

export const Route = createFileRoute("/editor")({
  head: () => ({
    meta: [
      { title: "Editor não destrutivo — ClipCore" },
      {
        name: "description",
        content:
          "Editor não destrutivo do ClipCore: recorte por timeline, pontos de entrada e saída e exportação sem alterar o arquivo original.",
      },
      { property: "og:title", content: "Editor não destrutivo — ClipCore" },
      {
        property: "og:description",
        content: "Recorte, marque e exporte clipes preservando o arquivo original.",
      },
    ],
  }),
  component: EditorPage,
});

function EditorPage() {
  const { clips } = useClips();
  const [index, setIndex] = useState(0);
  const clip = clips[index];
  const [trim, setTrim] = useState({ start: 10, end: 80 });

  const duration = useMemo(() => clip?.durationMs ?? 0, [clip]);

  return (
    <AppShell
      title="Editor"
      subtitle="Recortes não destrutivos — o arquivo original nunca é alterado"
      actions={<StatusChip tone="primary">timeline</StatusChip>}
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Module icon={Scissors} title="Timeline">
          {!clip ? (
            <p className="text-sm text-muted-foreground">Nenhum clipe disponível para editar.</p>
          ) : (
            <>
              <div
                className="relative aspect-video overflow-hidden rounded-xl"
                style={{
                  background: `linear-gradient(140deg, ${clip.accent} 0%, oklch(0.19 0.022 264) 88%)`,
                }}
              />
              <div className="mt-6 space-y-4">
                <div className="relative h-14 overflow-hidden rounded-xl border border-border bg-background/50">
                  <div
                    className="absolute inset-y-0 border-x border-primary/70 bg-primary/20"
                    style={{ left: `${trim.start}%`, right: `${100 - trim.end}%` }}
                  />
                  <div className="absolute inset-0 flex">
                    {Array.from({ length: 40 }).map((_, i) => (
                      <span key={i} className="flex-1 border-r border-border/40" />
                    ))}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-xs text-muted-foreground">
                    Início · {formatDuration((duration * trim.start) / 100)}
                    <input
                      type="range"
                      min={0}
                      max={trim.end - 1}
                      value={trim.start}
                      onChange={(e) => setTrim((t) => ({ ...t, start: Number(e.target.value) }))}
                      className="mt-2 w-full accent-[var(--primary)]"
                    />
                  </label>
                  <label className="block text-xs text-muted-foreground">
                    Fim · {formatDuration((duration * trim.end) / 100)}
                    <input
                      type="range"
                      min={trim.start + 1}
                      max={100}
                      value={trim.end}
                      onChange={(e) => setTrim((t) => ({ ...t, end: Number(e.target.value) }))}
                      className="mt-2 w-full accent-[var(--electric)]"
                    />
                  </label>
                </div>
                <Button className="w-full sm:w-auto">
                  <Download /> Exportar recorte
                </Button>
              </div>
            </>
          )}
        </Module>

        <Module title="Clipes" hint="Escolha o clipe a editar">
          <ul className="space-y-2">
            {clips.map((c, i) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setIndex(i)}
                  className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors ${
                    i === index
                      ? "border-primary/50 bg-elevated text-foreground"
                      : "border-border bg-background/40 text-muted-foreground hover:bg-elevated/60"
                  }`}
                >
                  <span className="truncate">{c.title}</span>
                  <span className="shrink-0 font-mono text-xs">{formatDuration(c.durationMs)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Module>
      </div>
    </AppShell>
  );
}
