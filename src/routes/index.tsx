import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Activity,
  HardDrive,
  Keyboard,
  Mic,
  MicOff,
  Play,
  Save,
  Timer,
  Cpu,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useClips } from "@/hooks/use-clips";
import { useSettings } from "@/hooks/use-settings";
import {
  APP_NAME,
  type CaptureState,
  formatBytes,
  formatDateTime,
  formatDuration,
} from "@/lib/clipcore";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ClipCore — Painel de captura de clipes de jogos" },
      {
        name: "description",
        content:
          "Painel do ClipCore: estado do buffer retroativo, jogo detectado, atalhos, espaço em disco e últimos clipes salvos.",
      },
      { property: "og:title", content: "ClipCore — Painel de captura de clipes" },
      {
        property: "og:description",
        content: "Capture seus melhores momentos sem perder FPS, sem bagunça e sem depender da nuvem.",
      },
    ],
  }),
  component: Dashboard,
});

const STATE_LABEL: Record<CaptureState, string> = {
  idle: "Inativo",
  detecting: "Detectando jogo",
  buffering: "Buffer ativo",
  recording_session: "Gravando sessão",
  saving_clip: "Salvando clipe",
  degraded: "Modo degradado",
  error: "Erro",
};

function Dashboard() {
  const { settings } = useSettings();
  const { clips, addSimulated } = useClips();
  const [state, setState] = useState<CaptureState>("buffering");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const usedBytes = useMemo(() => clips.reduce((sum, c) => sum + c.fileSize, 0), [clips]);
  const capacity = settings.maxStorageGb * 1024 ** 3;
  const usedPercent = Math.min(100, (usedBytes / capacity) * 100);
  const saveHotkey = settings.hotkeys.find((h) => h.id === "save_clip")?.combo ?? "F8";

  function simulateClip() {
    setState("saving_clip");
    const durationMs = settings.bufferSeconds * 1000;
    setTimeout(() => {
      addSimulated({
        id: `clip-${Date.now()}`,
        title: `Clipe simulado ${new Date().toLocaleTimeString("pt-BR")}`,
        game: "Tactical Strike",
        capturedAt: new Date().toISOString(),
        durationMs,
        width: 1920,
        height: 1080,
        fps: settings.fps,
        codec: settings.codec.toUpperCase().replace("H", "H."),
        fileSize: Math.round((settings.bitrateMbps * 1_000_000 * settings.bufferSeconds) / 8),
        type: "retroactive",
        favorite: false,
        uploadStatus: "local",
        tags: ["simulado"],
        accent: "oklch(0.62 0.19 265)",
      });
      setState("buffering");
      setSavedAt(new Date().toLocaleTimeString("pt-BR"));
    }, 900);
  }

  const recent = clips.slice(0, 4);

  return (
    <AppShell title="Início" subtitle={`${APP_NAME} — visão geral da captura`}>
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="panel glow p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Activity className="size-4 text-primary" /> Estado do motor
              </p>
              <p className="mt-1 font-display text-3xl font-semibold">{STATE_LABEL[state]}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Jogo detectado: <span className="text-foreground">Tactical Strike</span> · fonte:
                monitor principal
              </p>
            </div>
            <div className="flex flex-col items-start gap-2">
              <Button onClick={simulateClip} disabled={state === "saving_clip"}>
                <Save /> Salvar clipe simulado ({saveHotkey})
              </Button>
              <Button variant="outline" asChild>
                <Link to="/library">
                  <Play /> Abrir biblioteca
                </Link>
              </Button>
            </div>
          </div>
          {savedAt ? (
            <p className="mt-4 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
              Clipe simulado salvo às {savedAt} e adicionado à biblioteca.
            </p>
          ) : null}
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Metric icon={Timer} label="Buffer retroativo" value={`${settings.bufferSeconds}s`} />
            <Metric icon={Keyboard} label="Atalho principal" value={saveHotkey} />
            <Metric
              icon={Cpu}
              label="Encoder"
              value={settings.codec === "h264" ? "H.264 (auto)" : settings.codec.toUpperCase()}
            />
          </div>
        </section>

        <section className="panel p-5">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <HardDrive className="size-4 text-primary" /> Armazenamento
          </p>
          <p className="mt-2 font-display text-2xl font-semibold">{formatBytes(usedBytes)}</p>
          <p className="text-sm text-muted-foreground">de {settings.maxStorageGb} GB reservados</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${usedPercent}%` }} />
          </div>
          <p className="mt-4 flex items-center gap-2 text-sm">
            {settings.micEnabled ? (
              <>
                <Mic className="size-4 text-success" /> Microfone ativo
              </>
            ) : (
              <>
                <MicOff className="size-4 text-muted-foreground" /> Microfone desativado
              </>
            )}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Pasta: {settings.folder}</p>
        </section>

        <section className="panel p-5 lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Últimos clipes</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/library">Ver tudo</Link>
            </Button>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum clipe ainda. Use o botão acima para gerar um clipe simulado.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {recent.map((clip) => (
                <li key={clip.id} className="overflow-hidden rounded-lg border border-border">
                  <div
                    className="flex h-24 items-end p-3 text-xs text-foreground/80"
                    style={{
                      background: `linear-gradient(140deg, ${clip.accent} 0%, oklch(0.2 0.02 265) 85%)`,
                    }}
                  >
                    {clip.durationMs > 0 ? formatDuration(clip.durationMs) : "imagem"}
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-medium">{clip.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {clip.game} · {formatDateTime(clip.capturedAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Timer;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/40 p-3">
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </p>
      <p className="mt-1 font-display text-lg font-semibold">{value}</p>
    </div>
  );
}
