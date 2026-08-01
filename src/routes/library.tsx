import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import {
  Film,
  FolderOpen,
  Heart,
  Pencil,
  RotateCcw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useClips } from "@/hooks/use-clips";
import { type Clip, formatBytes, formatDateTime, formatDuration } from "@/lib/clipcore";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "Biblioteca de clipes — ClipCore" },
      {
        name: "description",
        content:
          "Organize, renomeie, favorite, exclua e restaure seus clipes. Reproduza arquivos de vídeo locais direto no player do ClipCore.",
      },
      { property: "og:title", content: "Biblioteca de clipes — ClipCore" },
      {
        property: "og:description",
        content: "Filtros por jogo, favoritos e tipo, com lixeira e player integrado.",
      },
    ],
  }),
  component: LibraryPage,
});

type Filter = "all" | "favorites" | "retroactive" | "session" | "uploaded";

function LibraryPage() {
  const { clips, trash, ready, rename, toggleFavorite, remove, restore, resetDemo } = useClips();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Clip | null>(null);
  const [localSrc, setLocalSrc] = useState<string | null>(null);
  const [localName, setLocalName] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clips.filter((c) => {
      if (q && !`${c.title} ${c.game} ${c.tags.join(" ")}`.toLowerCase().includes(q)) return false;
      if (filter === "favorites") return c.favorite;
      if (filter === "retroactive") return c.type === "retroactive";
      if (filter === "session") return c.type === "session";
      if (filter === "uploaded") return c.uploadStatus === "uploaded";
      return true;
    });
  }, [clips, query, filter]);

  const active = selected ?? visible[0] ?? null;

  function pickLocalFile(file: File | undefined) {
    if (!file) return;
    if (localSrc) URL.revokeObjectURL(localSrc);
    setLocalSrc(URL.createObjectURL(file));
    setLocalName(file.name);
  }

  return (
    <AppShell title="Biblioteca" subtitle={`${clips.length} itens · ${trash.length} na lixeira`}>
      <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        <section className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-52 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por título, jogo ou tag"
                className="pl-9"
                aria-label="Buscar clipes"
              />
            </div>
            {(
              [
                ["all", "Todos"],
                ["favorites", "Favoritos"],
                ["retroactive", "Retroativos"],
                ["session", "Sessões"],
                ["uploaded", "Enviados"],
              ] as Array<[Filter, string]>
            ).map(([value, label]) => (
              <Button
                key={value}
                size="sm"
                variant={filter === value ? "default" : "outline"}
                onClick={() => setFilter(value)}
              >
                {label}
              </Button>
            ))}
          </div>

          {!ready ? (
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-44 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="panel flex flex-col items-center gap-3 p-10 text-center">
              <Film className="size-8 text-muted-foreground" />
              <p className="font-medium">Nenhum clipe encontrado</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Ajuste os filtros, gere um clipe simulado no painel inicial ou restaure os dados de
                demonstração.
              </p>
              <Button variant="outline" size="sm" onClick={resetDemo}>
                <RotateCcw /> Restaurar demonstração
              </Button>
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {visible.map((clip) => (
                <li key={clip.id} className="panel overflow-hidden">
                  <button
                    onClick={() => setSelected(clip)}
                    className="block w-full cursor-pointer text-left"
                    aria-label={`Selecionar ${clip.title}`}
                  >
                    <div
                      className="flex h-28 items-end justify-between p-3 text-xs"
                      style={{
                        background: `linear-gradient(140deg, ${clip.accent} 0%, oklch(0.2 0.02 265) 85%)`,
                      }}
                    >
                      <span className="rounded bg-background/60 px-1.5 py-0.5">
                        {clip.durationMs > 0 ? formatDuration(clip.durationMs) : "imagem"}
                      </span>
                      <span className="rounded bg-background/60 px-1.5 py-0.5">
                        {clip.height}p{clip.fps}
                      </span>
                    </div>
                  </button>
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{clip.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {clip.game} · {formatDateTime(clip.capturedAt)} ·{" "}
                          {formatBytes(clip.fileSize)}
                        </p>
                      </div>
                      {clip.uploadStatus === "uploaded" ? (
                        <Upload className="size-3.5 shrink-0 text-success" aria-label="Enviado" />
                      ) : null}
                    </div>
                    <div className="mt-3 flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Favoritar"
                        onClick={() => toggleFavorite(clip.id)}
                      >
                        <Heart
                          className={clip.favorite ? "fill-destructive text-destructive" : ""}
                        />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Renomear"
                        onClick={() => {
                          const next = window.prompt("Novo título", clip.title);
                          if (next && next.trim()) rename(clip.id, next.trim());
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Mover para a lixeira"
                        onClick={() => {
                          remove(clip.id);
                          if (selected?.id === clip.id) setSelected(null);
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {trash.length > 0 ? (
            <div className="panel mt-4 p-4">
              <h2 className="mb-2 text-sm font-semibold">Lixeira</h2>
              <ul className="space-y-2">
                {trash.map((clip) => (
                  <li key={clip.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate text-muted-foreground">{clip.title}</span>
                    <Button size="sm" variant="outline" onClick={() => restore(clip.id)}>
                      <RotateCcw /> Restaurar
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <aside className="panel h-fit p-4">
          <h2 className="mb-3 text-sm font-semibold">Player</h2>
          <div className="overflow-hidden rounded-lg border border-border bg-black">
            {localSrc ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video src={localSrc} controls className="aspect-video w-full" />
            ) : (
              <div
                className="grid aspect-video place-items-center p-4 text-center text-xs text-foreground/70"
                style={{
                  background: `linear-gradient(140deg, ${active?.accent ?? "oklch(0.3 0.03 265)"} 0%, oklch(0.16 0.02 265) 85%)`,
                }}
              >
                Miniatura simulada — abra um arquivo de vídeo local para reproduzir.
              </div>
            )}
          </div>
          <p className="mt-3 truncate text-sm font-medium">
            {localName ?? active?.title ?? "Nenhum clipe selecionado"}
          </p>
          {active && !localName ? (
            <dl className="mt-2 grid grid-cols-2 gap-y-1 text-xs text-muted-foreground">
              <dt>Jogo</dt>
              <dd className="text-right text-foreground">{active.game}</dd>
              <dt>Duração</dt>
              <dd className="text-right text-foreground">{formatDuration(active.durationMs)}</dd>
              <dt>Resolução</dt>
              <dd className="text-right text-foreground">
                {active.width}×{active.height}
              </dd>
              <dt>Codec</dt>
              <dd className="text-right text-foreground">{active.codec}</dd>
              <dt>Tamanho</dt>
              <dd className="text-right text-foreground">{formatBytes(active.fileSize)}</dd>
            </dl>
          ) : null}
          <input
            ref={fileInput}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => pickLocalFile(e.target.files?.[0])}
          />
          <Button variant="outline" className="mt-4 w-full" onClick={() => fileInput.current?.click()}>
            <FolderOpen /> Abrir vídeo local
          </Button>
        </aside>
      </div>
    </AppShell>
  );
}
