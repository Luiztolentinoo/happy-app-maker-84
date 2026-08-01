import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Video } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Module, Badge } from "@ds";
import { useClips } from "@/hooks/use-clips";
import { formatBytes, formatDateTime, formatDuration } from "@/lib/clipcore";

export const Route = createFileRoute("/recordings")({
  head: () => ({
    meta: [
      { title: "Gravações de sessão — ClipCore" },
      {
        name: "description",
        content:
          "Sessões completas gravadas pelo ClipCore, com duração, tamanho, codec e data de captura.",
      },
      { property: "og:title", content: "Gravações de sessão — ClipCore" },
      {
        property: "og:description",
        content: "Acompanhe as gravações longas de sessão separadas dos clipes retroativos.",
      },
    ],
  }),
  component: RecordingsPage,
});

function RecordingsPage() {
  const { clips } = useClips();
  const sessions = useMemo(() => clips.filter((c) => c.type === "session"), [clips]);
  const totalMs = sessions.reduce((s, c) => s + c.durationMs, 0);

  return (
    <AppShell
      title="Gravações"
      subtitle="Sessões completas capturadas do início ao fim"
      actions={<Badge tone="blue">{formatDuration(totalMs)} totais</Badge>}
    >
      <Module icon={Video} title="Sessões">
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma gravação de sessão ainda. Use o atalho de iniciar/parar gravação.
          </p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {sessions.map((c) => (
              <li
                key={c.id}
                className="animate-rise rounded-xl border border-border bg-background/40 p-4 transition-colors hover:bg-elevated/50"
              >
                <p className="truncate text-sm font-semibold">{c.title}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {c.game} · {formatDateTime(c.capturedAt)}
                </p>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                  <Stat label="Duração" value={formatDuration(c.durationMs)} />
                  <Stat label="Tamanho" value={formatBytes(c.fileSize)} />
                  <Stat label="Codec" value={c.codec} />
                </dl>
              </li>
            ))}
          </ul>
        )}
      </Module>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/50 p-2.5">
      <dt className="label-caps">{label}</dt>
      <dd className="mt-1 font-display text-sm font-semibold">{value}</dd>
    </div>
  );
}
