import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Film, Redo2, Save, Scissors, Undo2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EditorTimeline } from "@/components/editor/EditorTimeline";
import { EditorProperties } from "@/components/editor/EditorProperties";
import { Badge, Button, EmptyState, ErrorState, Icon, Module, Panel, SkeletonMedia } from "@ds";
import { useClips } from "@/hooks/use-clips";
import { useEditor } from "@/hooks/useEditor";
import { formatDuration } from "@/lib/clipcore";
import { ASPECT_PRESET_LIST, SAFE_AREAS } from "@/editor/presets";

export const Route = createFileRoute("/editor")({
  head: () => ({
    meta: [
      { title: "Editor não destrutivo — ClipCore" },
      {
        name: "description",
        content:
          "Editor não destrutivo do ClipCore: timeline multifaixa, cortes, velocidade, textos, proporções verticais e exportação com FFmpeg sem alterar o arquivo original.",
      },
      { property: "og:title", content: "Editor não destrutivo — ClipCore" },
      {
        property: "og:description",
        content: "Timeline multifaixa, cortes, textos e exportação preservando o clipe original.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EditorPage,
});

function EditorPage() {
  const { clips } = useClips();
  const [clipId, setClipId] = useState<string | null>(null);
  const clip = useMemo(() => clips.find((item) => item.id === clipId) ?? clips[0], [clips, clipId]);
  const editor = useEditor(clip);

  /* Atalhos de teclado do editor (undo/redo/split/espaço). */
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const meta = event.ctrlKey || event.metaKey;
      if (meta && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) editor.redo();
        else editor.undo();
      } else if (meta && event.key.toLowerCase() === "y") {
        event.preventDefault();
        editor.redo();
      } else if (event.key.toLowerCase() === "s" && !meta) {
        event.preventDefault();
        editor.dispatch({ kind: "split", atMs: editor.playheadMs });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editor]);

  const aspectRatio =
    ASPECT_PRESET_LIST.find((preset) => preset.id === editor.timeline?.crop.aspect)?.ratio ??
    (clip ? clip.width / clip.height : 16 / 9);

  return (
    <AppShell
      title="Editor"
      subtitle="Edição não destrutiva — o arquivo original nunca é alterado"
      actions={
        <div className="flex items-center gap-2">
          <Badge tone={editor.saving ? "yellow" : "green"}>
            {editor.saving ? "salvando" : editor.lastSavedAt ? "salvo" : "auto-save"}
          </Badge>
          <Button
            size="iconSm"
            variant="secondary"
            icon={Undo2}
            aria-label="Desfazer"
            disabled={!editor.canUndo}
            onClick={editor.undo}
          />
          <Button
            size="iconSm"
            variant="secondary"
            icon={Redo2}
            aria-label="Refazer"
            disabled={!editor.canRedo}
            onClick={editor.redo}
          />
        </div>
      }
    >
      {clips.length === 0 ? (
        <Panel level={2} className="p-4">
          <EmptyState
            icon={Film}
            title="Nenhum clipe para editar"
            description="Salve um clipe no painel para abrir o editor."
          />
        </Panel>
      ) : editor.status === "error" ? (
        <Panel level={2} className="p-4">
          <ErrorState title="Projeto não pôde ser aberto" description={editor.error ?? undefined} />
        </Panel>
      ) : (
        <div className="space-y-5">
          {editor.recoveryAvailable ? (
            <Panel level={2} className="flex flex-wrap items-center gap-3 p-4">
              <Icon icon={AlertTriangle} size="sm" tone="yellow" />
              <p className="flex-1 text-sm text-ink-secondary">
                Encontramos alterações não salvas da sessão anterior deste projeto.
              </p>
              <Button size="sm" icon={Save} onClick={() => void editor.acceptRecovery()}>
                Recuperar
              </Button>
              <Button size="sm" variant="ghost" onClick={editor.dismissRecovery}>
                Descartar
              </Button>
            </Panel>
          ) : null}

          {editor.sourceAvailable === false ? (
            <Panel level={2} className="flex items-center gap-3 p-4">
              <Icon icon={AlertTriangle} size="sm" tone="yellow" />
              <p className="text-sm text-ink-muted">
                {editor.sourceReason ?? "Arquivo de origem não verificado."}
              </p>
            </Panel>
          ) : null}

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
            <div className="space-y-5">
              <Module
                icon={Film}
                title={clip?.title ?? "Pré-visualização"}
                hint={`${formatDuration(editor.playheadMs)} / ${formatDuration(editor.durationMs)}`}
                action={
                  clips.length > 1 ? (
                    <select
                      aria-label="Escolher clipe"
                      value={clip?.id ?? ""}
                      onChange={(event) => setClipId(event.target.value)}
                      className="rounded-lg border border-border-primary bg-surface-primary/70 px-2 py-1 text-xs text-ink-secondary"
                    >
                      {clips.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.title}
                        </option>
                      ))}
                    </select>
                  ) : null
                }
              >
                {editor.status !== "ready" || !clip ? (
                  <SkeletonMedia />
                ) : (
                  <div
                    className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-xl border border-border-primary"
                    style={{
                      aspectRatio: `${aspectRatio}`,
                      background: `linear-gradient(140deg, ${clip.accent} 0%, oklch(0.16 0.02 264) 92%)`,
                    }}
                  >
                    {/* Prévia dos textos com posição relativa, igual ao render final. */}
                    {editor.timeline?.overlays
                      .filter(
                        (overlay) =>
                          editor.playheadMs >= overlay.startMs &&
                          editor.playheadMs <= overlay.endMs,
                      )
                      .map((overlay) => (
                        <span
                          key={overlay.id}
                          className="absolute -translate-x-1/2 whitespace-pre font-display font-bold"
                          style={{
                            left: `${overlay.x * 100}%`,
                            top: `${overlay.y * 100}%`,
                            fontSize: `${(overlay.fontSize / 1080) * 100}cqh`,
                            color: overlay.color,
                            opacity: overlay.opacity,
                            textShadow: overlay.shadow ? "0 2px 8px rgba(0,0,0,.65)" : "none",
                          }}
                        >
                          {overlay.text}
                        </span>
                      ))}

                    {editor.timeline?.crop.grid ? (
                      <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3"
                      >
                        {Array.from({ length: 9 }).map((_, index) => (
                          <span key={index} className="border border-ink/10" />
                        ))}
                      </div>
                    ) : null}

                    {editor.timeline?.crop.safeAreas ? (
                      <div
                        aria-hidden
                        className="pointer-events-none absolute border border-dashed border-accent-blue/60"
                        style={{
                          top: `${SAFE_AREAS[0].top * 100}%`,
                          bottom: `${SAFE_AREAS[0].bottom * 100}%`,
                          left: `${SAFE_AREAS[0].left * 100}%`,
                          right: `${SAFE_AREAS[0].right * 100}%`,
                        }}
                      />
                    ) : null}
                  </div>
                )}
              </Module>

              <Module icon={Scissors} title="Timeline" hint="S corta · Ctrl+Z desfaz">
                {editor.timeline && clip ? (
                  <EditorTimeline
                    timeline={editor.timeline}
                    durationMs={editor.durationMs}
                    waveform={editor.waveform}
                    accent={clip.accent}
                    onSeek={(ms) => editor.setPlayhead(ms, { snap: true })}
                    onSelect={editor.setSelection}
                    onToggleTrackMute={(trackId, muted) =>
                      editor.dispatch({ kind: "track_mute", trackId, muted })
                    }
                  />
                ) : (
                  <SkeletonMedia />
                )}
                {editor.problems.length > 0 ? (
                  <p className="mt-4 text-xs text-accent-red">{editor.problems[0]}</p>
                ) : null}
              </Module>
            </div>

            <EditorProperties editor={editor} />
          </div>
        </div>
      )}
    </AppShell>
  );
}
