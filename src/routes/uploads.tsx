import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { CloudUpload } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Module, Badge } from "@ds";
import { useClips } from "@/hooks/use-clips";
import { formatBytes, formatDateTime } from "@/lib/clipcore";

export const Route = createFileRoute("/uploads")({
  head: () => ({
    meta: [
      { title: "Fila de uploads — ClipCore" },
      {
        name: "description",
        content:
          "Acompanhe o estado de envio dos clipes do ClipCore: local, enviando, enviado ou falha.",
      },
      { property: "og:title", content: "Fila de uploads — ClipCore" },
      {
        property: "og:description",
        content: "Status de envio por clipe, sem depender da nuvem por padrão.",
      },
    ],
  }),
  component: UploadsPage,
});

const TONE = {
  local: "muted",
  uploading: "blue",
  uploaded: "green",
  failed: "red",
} as const;

const LABEL = {
  local: "local",
  uploading: "enviando",
  uploaded: "enviado",
  failed: "falha",
} as const;

function UploadsPage() {
  const { clips } = useClips();
  const pending = useMemo(() => clips.filter((c) => c.uploadStatus !== "local").length, [clips]);

  return (
    <AppShell
      title="Uploads"
      subtitle="Envio opcional — por padrão tudo permanece local"
      actions={<Badge tone="blue">{pending} na fila</Badge>}
    >
      <Module icon={CloudUpload} title="Fila de envio">
        <ul className="space-y-2.5">
          {clips.map((c) => (
            <li
              key={c.id}
              className="grid animate-rise grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-background/40 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{c.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {c.game} · {formatDateTime(c.capturedAt)} · {formatBytes(c.fileSize)}
                </p>
              </div>
              <Badge tone={TONE[c.uploadStatus]}>{LABEL[c.uploadStatus]}</Badge>
            </li>
          ))}
        </ul>
      </Module>
    </AppShell>
  );
}
