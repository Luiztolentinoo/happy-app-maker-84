import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, RotateCcw, Save } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSettings } from "@/hooks/use-settings";
import { BUFFER_OPTIONS, estimateSizePerMinute, formatBytes, hotkeyIssues } from "@/lib/clipcore";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Configurações de captura — ClipCore" },
      {
        name: "description",
        content:
          "Ajuste buffer retroativo, resolução, FPS, codec, bitrate, áudio, overlay, pasta de clipes e atalhos personalizáveis com detecção de conflito.",
      },
      { property: "og:title", content: "Configurações de captura — ClipCore" },
      {
        property: "og:description",
        content: "Atalhos personalizáveis, perfis de qualidade e limites de armazenamento.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { settings, update, reset } = useSettings();
  const [capturing, setCapturing] = useState<string | null>(null);
  const issues = hotkeyIssues(settings.hotkeys);

  function captureCombo(id: string, event: React.KeyboardEvent<HTMLButtonElement>) {
    event.preventDefault();
    const parts: string[] = [];
    if (event.ctrlKey) parts.push("Ctrl");
    if (event.altKey) parts.push("Alt");
    if (event.shiftKey) parts.push("Shift");
    if (event.metaKey) parts.push("Win");
    const key = event.key;
    if (!["Control", "Alt", "Shift", "Meta"].includes(key)) {
      parts.push(key.length === 1 ? key.toUpperCase() : key);
    }
    if (parts.length === 0) return;
    update(
      "hotkeys",
      settings.hotkeys.map((h) => (h.id === id ? { ...h, combo: parts.join("+") } : h)),
    );
    setCapturing(null);
  }

  const perMinute = estimateSizePerMinute(settings.bitrateMbps);

  return (
    <AppShell title="Configurações" subtitle="Salvas automaticamente neste dispositivo">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-5">
          <h2 className="text-lg font-semibold">Atalhos</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Clique em um atalho e pressione a combinação desejada. Conflitos e teclas reservadas são
            detectados.
          </p>
          <ul className="mt-4 space-y-2">
            {settings.hotkeys.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3">
                <span className="text-sm">{h.label}</span>
                <div className="flex items-center gap-2">
                  {issues[h.id] ? (
                    <span className="flex items-center gap-1 text-xs text-warning">
                      <AlertTriangle className="size-3.5" /> {issues[h.id]}
                    </span>
                  ) : null}
                  <Button
                    variant={capturing === h.id ? "default" : "outline"}
                    size="sm"
                    className="min-w-24 font-mono"
                    onClick={() => setCapturing(capturing === h.id ? null : h.id)}
                    onKeyDown={(e) => capturing === h.id && captureCombo(h.id, e)}
                  >
                    {capturing === h.id ? "Pressione…" : h.combo}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <Button variant="ghost" size="sm" className="mt-4" onClick={reset}>
            <RotateCcw /> Restaurar padrões
          </Button>
        </section>

        <section className="panel p-5">
          <h2 className="text-lg font-semibold">Captura</h2>
          <div className="mt-4 space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Buffer retroativo</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {BUFFER_OPTIONS.map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={settings.bufferSeconds === s ? "default" : "outline"}
                    onClick={() => update("bufferSeconds", s)}
                  >
                    {s < 60 ? `${s}s` : `${s / 60}min`}
                  </Button>
                ))}
              </div>
            </div>
            <Selector
              label="Resolução"
              value={settings.resolution}
              options={["720p", "1080p", "1440p", "2160p", "native"]}
              onChange={(v) => update("resolution", v as typeof settings.resolution)}
            />
            <Selector
              label="FPS"
              value={String(settings.fps)}
              options={["30", "60", "120", "144"]}
              onChange={(v) => update("fps", Number(v) as typeof settings.fps)}
            />
            <Selector
              label="Codec"
              value={settings.codec}
              options={["h264", "h265", "av1"]}
              onChange={(v) => update("codec", v as typeof settings.codec)}
            />
            <div>
              <Label htmlFor="bitrate" className="text-xs text-muted-foreground">
                Bitrate: {settings.bitrateMbps} Mbps · ~{formatBytes(perMinute)} por minuto
              </Label>
              <input
                id="bitrate"
                type="range"
                min={5}
                max={80}
                step={1}
                value={settings.bitrateMbps}
                onChange={(e) => update("bitrateMbps", Number(e.target.value))}
                className="mt-2 w-full accent-[var(--primary)]"
              />
            </div>
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="text-lg font-semibold">Áudio e overlay</h2>
          <div className="mt-4 space-y-3">
            <Toggle
              label="Microfone"
              checked={settings.micEnabled}
              onChange={(v) => update("micEnabled", v)}
            />
            <Toggle
              label="Áudio do sistema"
              checked={settings.systemAudio}
              onChange={(v) => update("systemAudio", v)}
            />
            <Selector
              label="Overlay"
              value={settings.overlayMode}
              options={["full", "compact", "notifications", "off"]}
              onChange={(v) => update("overlayMode", v as typeof settings.overlayMode)}
            />
            <Toggle
              label="Telemetria (desativada por padrão)"
              checked={settings.telemetry}
              onChange={(v) => update("telemetry", v)}
            />
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="text-lg font-semibold">Armazenamento</h2>
          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="folder" className="text-xs text-muted-foreground">
                Pasta dos clipes
              </Label>
              <Input
                id="folder"
                className="mt-2 font-mono text-xs"
                value={settings.folder}
                onChange={(e) => update("folder", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="max" className="text-xs text-muted-foreground">
                Limite máximo (GB)
              </Label>
              <Input
                id="max"
                type="number"
                min={10}
                className="mt-2"
                value={settings.maxStorageGb}
                onChange={(e) => update("maxStorageGb", Math.max(10, Number(e.target.value)))}
              />
            </div>
            <Toggle
              label="Excluir clipes antigos automaticamente (nunca favoritos)"
              checked={settings.autoDelete}
              onChange={(v) => update("autoDelete", v)}
            />
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Save className="size-3.5" /> Alterações são persistidas imediatamente.
            </p>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function Selector({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => (
          <Button
            key={o}
            size="sm"
            variant={value === o ? "default" : "outline"}
            onClick={() => onChange(o)}
          >
            {o}
          </Button>
        ))}
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-[var(--primary)]"
      />
    </label>
  );
}
