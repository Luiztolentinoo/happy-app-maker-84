import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import {
  Film,
  FolderOpen,
  Heart,
  MoreHorizontal,
  Pencil,
  Play,
  RotateCcw,
  Scissors,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Module, Badge } from "@ds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useClips } from "@/hooks/use-clips";
import { type Clip, formatBytes, formatDateTime, formatDuration } from "@/lib/clipcore";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "Galeria de clipes — ClipCore" },
      {
        name: "description",
        content:
          "Galeria moderna de clipes com miniaturas grandes, favoritos, filtros rápidos, ordenação, agrupamento e player integrado.",
      },
      { property: "og:title", content: "Galeria de clipes — ClipCore" },
      {
        property: "og:description",
        content: "Reproduza, edite, exporte e favorite clipes em uma galeria de alta densidade.",
      },
    ],
  }),
  component: LibraryPage,
});

type Filter = "all" | "favorites" | "recent" | "retroactive" | "session" | "uploaded";
type Sort = "recent" | "duration" | "size" | "title";

function LibraryPage() {
  const { clips, trash, ready, rename, toggleFavorite, remove, restore, resetDemo } = useClips();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("recent");
  const [grouped, setGrouped] = useState(true);
  const [selected, setSelected] = useState<Clip | null>(null);
  const [localSrc, setLocalSrc] = useState<string | null>(null);
  const [localName, setLocalName] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const cutoff = Date.now() - 86_400_000;
    const list = clips.filter((c) => {
      if (q && !`${c.title} ${c.game} ${c.tags.join(" ")}`.toLowerCase().includes(q)) return false;
      if (filter === "favorites") return c.favorite;
      if (filter === "recent") return new Date(c.capturedAt).getTime() >= cutoff;
      if (filter === "retroactive") return c.type === "retroactive";
      if (filter === "session") return c.type === "session";
      if (filter === "uploaded") return c.uploadStatus === "uploaded";
      return true;
    });
    return [...list].sort((a, b) => {
      if (sort === "duration") return b.durationMs - a.durationMs;
      if (sort === "size") return b.fileSize - a.fileSize;
      if (sort === "title") return a.title.localeCompare(b.title);
      return new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime();
    });
  }, [clips, query, filter, sort]);

  const groups = useMemo(() => {
    if (!grouped) return [["Todos os clipes", visible]] as Array<[string, Clip[]]>;
    const map = new Map<string, Clip[]>();
    for (const clip of visible) {
      const list = map.get(clip.game) ?? [];
      list.push(clip);
      map.set(clip.game, list);
    }
    return [...map.entries()];
  }, [visible, grouped]);

  const active = selected ?? visible[0] ?? null;

  function pickLocalFile(file: File | undefined) {
    if (!file) return;
    if (localSrc) URL.revokeObjectURL(localSrc);
    setLocalSrc(URL.createObjectURL(file));
    setLocalName(file.name);
  }

  return (
    <AppShell
      title="Biblioteca"
      subtitle={`${clips.length} clipes · ${trash.length} na lixeira`}
      actions={<Badge tone="blue">{visible.length} visíveis</Badge>}
    >
      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_25rem]">
        <div className="min-w-0 space-y-6">
          <Module>
            <div className="grid gap-4">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por título, jogo ou tag"
                  className="h-11 pl-10"
                  aria-label="Buscar clipes"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    ["all", "Todos"],
                    ["favorites", "Favoritos"],
                    ["recent", "Recentes"],
                    ["retroactive", "Retroativos"],
                    ["session", "Sessões"],
                    ["uploaded", "Enviados"],
                  ] as Array<[Filter, string]>
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    size="sm"
                    variant={filter === value ? "default" : "outline"}
                    className="rounded-full"
                    onClick={() => setFilter(value)}
                  >
                    {label}
                  </Button>
                ))}
                <span className="mx-1 hidden h-6 w-px bg-border sm:block" />
                {(
                  [
                    ["recent", "Mais recentes"],
                    ["duration", "Duração"],
                    ["size", "Tamanho"],
                    ["title", "A–Z"],
                  ] as Array<[Sort, string]>
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    size="sm"
                    variant={sort === value ? "secondary" : "ghost"}
                    className="rounded-full"
                    onClick={() => setSort(value)}
                  >
                    {label}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant={grouped ? "secondary" : "ghost"}
                  className="rounded-full"
                  onClick={() => setGrouped((g) => !g)}
                >
                  Agrupar por jogo
                </Button>
              </div>
            </div>
          </Module>

          {!ready ? (
            <div className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-3">
              {[0, 1, 2, 3].map((i) => (
                <SkeletonMedia key={i} />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <Module>
              <EmptyState
                icon={Film}
                title="Nenhum clipe encontrado"
                description="Ajuste os filtros, salve um clipe no centro de comando ou restaure os dados de demonstração."
                action={
                  <DSButton variant="secondary" size="sm" icon={RotateCcw} onClick={resetDemo}>
                    Restaurar demonstração
                  </DSButton>
                }
              />
            </Module>
          ) : (
            groups.map(([group, items]) => (
              <section key={group} className="space-y-4">
                <h2 className="label-caps">
                  {group} · {items.length}
                </h2>
                <ul className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-3">
                  {items.map((clip) => (
                    <li key={clip.id}>
                      <MediaCard
                        title={clip.title}
                        meta={`${clip.game} · ${formatDateTime(clip.capturedAt)} · ${formatBytes(clip.fileSize)}`}
                        duration={clip.durationMs > 0 ? formatDuration(clip.durationMs) : "imagem"}
                        onClick={() => setSelected(clip)}
                        thumbnail={
                          <div
                            className="absolute inset-0"
                            style={{
                              background: `linear-gradient(140deg, ${clip.accent} 0%, var(--background) 88%)`,
                            }}
                          >
                            <span className="absolute top-3 left-3 rounded-full bg-background/70 px-2 py-0.5 text-[11px] backdrop-blur-sm">
                              {clip.height}p{clip.fps}
                            </span>
                          </div>
                        }
                        overlay={
                          <>
                            <DSButton
                              variant="primary"
                              size="iconMd"
                              icon={Play}
                              iconSize="sm"
                              aria-label={`Reproduzir ${clip.title}`}
                              onClick={() => setSelected(clip)}
                            />
                            <DSButton
                              variant="glass"
                              size="iconMd"
                              icon={Scissors}
                              iconSize="sm"
                              aria-label={`Editar ${clip.title}`}
                              onClick={() => {
                                const next = window.prompt("Novo título", clip.title);
                                if (next && next.trim()) rename(clip.id, next.trim());
                              }}
                            />
                            <DSButton
                              variant="glass"
                              size="iconMd"
                              icon={Upload}
                              iconSize="sm"
                              aria-label={`Exportar ${clip.title}`}
                              onClick={() => setSelected(clip)}
                            />
                            <DSButton
                              variant="glass"
                              size="iconMd"
                              icon={Heart}
                              iconSize="sm"
                              aria-label={`Favoritar ${clip.title}`}
                              onClick={() => toggleFavorite(clip.id)}
                            />
                            <DSButton
                              variant="danger"
                              size="iconMd"
                              icon={Trash2}
                              iconSize="sm"
                              aria-label={`Excluir ${clip.title}`}
                              onClick={() => {
                                remove(clip.id);
                                if (selected?.id === clip.id) setSelected(null);
                              }}
                            />
                          </>
                        }
                        footer={
                          <div className="flex items-center gap-2">
                            {clip.favorite ? <Chip tone="red">favorito</Chip> : null}
                            {clip.uploadStatus === "uploaded" ? (
                              <Chip tone="green">enviado</Chip>
                            ) : null}
                          </div>
                        }
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}


          {trash.length > 0 ? (
            <Module icon={Trash2} title="Lixeira">
              <ul className="space-y-2">
                {trash.map((clip) => (
                  <li
                    key={clip.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border bg-background/40 px-3.5 py-2.5 text-sm"
                  >
                    <span className="truncate text-muted-foreground">{clip.title}</span>
                    <Button size="sm" variant="outline" onClick={() => restore(clip.id)}>
                      <RotateCcw /> Restaurar
                    </Button>
                  </li>
                ))}
              </ul>
            </Module>
          ) : null}
        </div>

        <aside className="h-fit space-y-6 2xl:sticky 2xl:top-32">
          <Module icon={Play} title="Player">
            <div className="relative overflow-hidden rounded-xl border border-border">
              <div
                className="absolute inset-0 scale-110 blur-2xl"
                style={{
                  background: `linear-gradient(140deg, ${active?.accent ?? "oklch(0.3 0.03 264)"} 0%, oklch(0.16 0.02 265) 85%)`,
                  opacity: 0.7,
                }}
              />
              <div className="relative">
                {localSrc ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video src={localSrc} controls className="aspect-video w-full bg-black" />
                ) : (
                  <div className="grid aspect-video place-items-center p-5 text-center text-xs text-foreground/70">
                    Miniatura simulada — abra um arquivo de vídeo local para reproduzir.
                  </div>
                )}
              </div>
            </div>

            {!localSrc ? (
              <div className="mt-4">
                <div className="group relative h-2.5 cursor-pointer overflow-hidden rounded-full bg-background/70">
                  <div
                    className="h-full rounded-full transition-[width] duration-300"
                    style={{
                      width: "38%",
                      background: "linear-gradient(90deg, var(--primary), var(--electric))",
                      boxShadow: "0 0 16px -2px var(--primary)",
                    }}
                  />
                  <div className="pointer-events-none absolute inset-y-0 left-[38%] w-px bg-foreground/70" />
                </div>
                <div className="mt-2 flex justify-between font-mono text-[11px] text-muted-foreground">
                  <span>00:11</span>
                  <span>{active ? formatDuration(active.durationMs) : "00:00"}</span>
                </div>
              </div>
            ) : null}

            <p className="mt-4 truncate text-sm font-semibold">
              {localName ?? active?.title ?? "Nenhum clipe selecionado"}
            </p>
            {active && !localName ? (
              <dl className="mt-3 grid grid-cols-2 gap-y-1.5 text-xs text-muted-foreground">
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
            <Button
              variant="outline"
              className="mt-5 w-full"
              onClick={() => fileInput.current?.click()}
            >
              <FolderOpen /> Abrir vídeo local
            </Button>
          </Module>
        </aside>
      </div>
    </AppShell>
  );
}
