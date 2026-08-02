import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Activity,
  Cpu,
  Gamepad2,
  HardDrive,
  Keyboard,
  MemoryStick,
  Mic,
  MicOff,
  MonitorPlay,
  Play,
  Timer,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Module, Gauge, Badge, ActionFlash, LiveDot, Parallax, Skeleton } from "@ds";
import { CoreOrb, orbToneFor } from "@/components/CoreOrb";
import { SaveClipButton } from "@/components/SaveClipButton";
import { Onboarding } from "@/components/Onboarding";
import { Button } from "@/components/ui/button";
import { useClips } from "@/hooks/use-clips";
import { useSettings } from "@/hooks/use-settings";
import { useSound } from "@/lib/sound";
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
      { title: "ClipCore — Centro de comando de captura de gameplay" },
      {
        name: "description",
        content:
          "Centro de comando do ClipCore: Core Orb com estado do motor, encoder, GPU, CPU, RAM, microfone, espaço livre e últimos clipes.",
      },
      { property: "og:title", content: "ClipCore — Centro de comando de captura" },
      {
        property: "og:description",
        content:
          "Capture seus melhores momentos sem perder FPS, sem bagunça e sem depender da nuvem.",
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
  const { clips, ready, addSimulated } = useClips();
  const { play } = useSound();
  const [state, setState] = useState<CaptureState>("buffering");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);
  const [flash, setFlash] = useState(0);

  const usedBytes = useMemo(() => clips.reduce((sum, c) => sum + c.fileSize, 0), [clips]);
  const capacity = settings.maxStorageGb * 1024 ** 3;
  const usedPercent = Math.min(100, (usedBytes / capacity) * 100);
  const lowSpace = usedPercent > 85;
  const saveHotkey = settings.hotkeys.find((h) => h.id === "save_clip")?.combo ?? "F8";

  function simulateClip() {
    setState("saving_clip");
    play("save");
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
        accent: "oklch(0.63 0.235 302)",
      });
      setState("buffering");
      setSavedAt(new Date().toLocaleTimeString("pt-BR"));
      setBurst((b) => b + 1);
      setFlash((f) => f + 1);
      play("success");
    }, 900);
  }

  const recent = clips.slice(0, 4);

  return (
    <>
      <Onboarding />
      <AppShell
        title="Centro de comando"
        subtitle={`${APP_NAME} — motor de captura, hardware e clipes recentes`}
        actions={
          <span className="flex items-center gap-2">
            <LiveDot tone={state === "error" ? "red" : "green"} />
            <Badge tone={state === "error" ? "red" : "green"}>{STATE_LABEL[state]}</Badge>
          </span>
        }
      >
        <div className="grid gap-6 xl:grid-cols-3">
          <Module className="glow ds-depth xl:col-span-2" icon={Activity} title="Motor de captura">
            <div className="grid items-center gap-8 md:grid-cols-[auto_minmax(0,1fr)_auto]">
              <Parallax depth={7}>
                <CoreOrb tone={orbToneFor(state, lowSpace)} burstKey={burst} />
              </Parallax>
              <div className="min-w-0">
                <p className="font-display text-4xl leading-tight font-semibold">
                  {STATE_LABEL[state]}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Jogo detectado <span className="text-foreground">Tactical Strike</span> · fonte
                  monitor principal
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <Metric icon={Timer} label="Buffer" value={`${settings.bufferSeconds}s`} />
                  <Metric icon={Keyboard} label="Atalho" value={saveHotkey} />
                  <Metric
                    icon={Cpu}
                    label="Encoder"
                    value={settings.codec === "h264" ? "H.264 auto" : settings.codec.toUpperCase()}
                  />
                </div>
                <div className="mt-4 flex min-h-7 items-center">
                  <ActionFlash trigger={flash} kind="success" message="Clipe salvo na biblioteca" />
                </div>
                {savedAt ? (
                  <p className="mt-5 animate-fade-in rounded-xl border border-success/30 bg-success/10 px-4 py-2.5 text-sm text-success">
                    Clipe simulado salvo às {savedAt} e adicionado à biblioteca.
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col items-center gap-4">
                <SaveClipButton
                  onClick={simulateClip}
                  disabled={state === "saving_clip"}
                  hotkey={saveHotkey}
                />
                <Button variant="outline" asChild>
                  <Link to="/library">
                    <Play /> Biblioteca
                  </Link>
                </Button>
              </div>
            </div>
          </Module>

          <Module icon={MonitorPlay} title="Telemetria de hardware">
            <div className="grid gap-3">
              <Gauge label="GPU · NVENC" value="42%" percent={42} tone="purple" />
              <Gauge label="CPU" value="18%" percent={18} tone="blue" />
              <Gauge label="RAM" value="9,4 GB" percent={58} tone="green" />
            </div>
          </Module>

          <Module icon={HardDrive} title="Armazenamento">
            <p className="font-display text-3xl font-semibold">{formatBytes(usedBytes)}</p>
            <p className="text-sm text-muted-foreground">
              de {settings.maxStorageGb} GB reservados
            </p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-background/60">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${usedPercent}%`,
                  background: "linear-gradient(90deg, var(--primary), var(--electric))",
                  boxShadow: "0 0 18px -2px var(--primary)",
                }}
              />
            </div>
            <p className="mt-5 flex items-center gap-2 text-sm">
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
            <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
              {settings.folder}
            </p>
          </Module>

          <Module icon={Gamepad2} title="Jogo atual">
            <p className="font-display text-2xl font-semibold">Tactical Strike</p>
            <p className="mt-1 text-sm text-muted-foreground">Perfil automático · DX12 · 1440p</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Metric icon={MemoryStick} label="Resolução" value={settings.resolution} />
              <Metric icon={Timer} label="FPS alvo" value={`${settings.fps}`} />
            </div>
          </Module>

          <Module
            className="xl:col-span-1"
            icon={Play}
            title="Últimos clipes"
            action={
              <Button variant="ghost" size="sm" asChild>
                <Link to="/library">Ver tudo</Link>
              </Button>
            }
          >
            {!ready ? (
              <ul className="space-y-3">
                {[0, 1, 2].map((row) => (
                  <li key={row} className="flex items-center gap-3">
                    <Skeleton className="h-12 w-20" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </li>
                ))}
              </ul>
            ) : recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum clipe ainda. Use o botão Salvar para gerar um clipe simulado.
              </p>
            ) : (
              <ul className="space-y-3">
                {recent.map((clip) => (
                  <li
                    key={clip.id}
                    className="ds-hover-smart flex items-center gap-3 rounded-xl border border-border bg-background/40 p-2.5 hover:bg-elevated/60"
                  >
                    <span
                      className="grid h-12 w-20 shrink-0 place-items-center rounded-lg text-[11px] text-foreground/80"
                      style={{
                        background: `linear-gradient(140deg, ${clip.accent} 0%, oklch(0.2 0.024 264) 88%)`,
                      }}
                    >
                      {clip.durationMs > 0 ? formatDuration(clip.durationMs) : "img"}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{clip.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {clip.game} · {formatDateTime(clip.capturedAt)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Module>
        </div>
      </AppShell>
    </>
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
    <div className="rounded-xl border border-border bg-background/40 p-3.5">
      <p className="label-caps flex items-center gap-2">
        <Icon className="size-3.5 text-primary" /> {label}
      </p>
      <p className="mt-1.5 font-display text-lg font-semibold">{value}</p>
    </div>
  );
}
