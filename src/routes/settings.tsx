import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  HardDrive,
  Keyboard,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Volume2,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Module, StatusChip } from "@/components/Module";
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

type Category = "hotkeys" | "capture" | "audio" | "storage";

const CATEGORIES = [
  { id: "hotkeys", label: "Atalhos", icon: Keyboard, keywords: "atalho hotkey tecla combo" },
  {
    id: "capture",
    label: "Captura",
    icon: SlidersHorizontal,
    keywords: "buffer resolução fps codec bitrate qualidade",
  },
  { id: "audio", label: "Áudio e overlay", icon: Volume2, keywords: "microfone som overlay telemetria" },
  { id: "storage", label: "Armazenamento", icon: HardDrive, keywords: "pasta disco limite gb exclusão" },
] as const;

function SettingsPage() {
  const { settings, update, reset } = useSettings();
  const [capturing, setCapturing] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>("hotkeys");
  const [query, setQuery] = useState("");
  const [dirty, setDirty] = useState(false);
  const issues = hotkeyIssues(settings.hotkeys);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CATEGORIES.map((c) => c.id);
    return CATEGORIES.filter((c) => `${c.label} ${c.keywords}`.toLowerCase().includes(q)).map(
      (c) => c.id,
    );
  }, [query]);

  function touch<K extends Parameters<typeof update>[0]>(key: K, value: Parameters<typeof update>[1]) {
    update(key, value);
    setDirty(true);
  }

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
    touch(
      "hotkeys",
      settings.hotkeys.map((h) => (h.id === id ? { ...h, combo: parts.join("+") } : h)),
    );
    setCapturing(null);
  }

  const perMinute = estimateSizePerMinute(settings.bitrateMbps);
  const shown = matches.includes(category) ? category : (matches[0] ?? category);

  return (
    <AppShell
      title="Configurações"
      subtitle="Aplicadas e salvas automaticamente neste dispositivo"
      actions={
        dirty ? (
          <StatusChip tone="success">
            <Check className="size-3" /> alterações aplicadas
          </StatusChip>
        ) : (
          <StatusChip tone="muted">sem alterações</StatusChip>
        )
      }
    >
      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <Module className="h-fit p-4 lg:sticky lg:top-32">
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar ajuste"
              className="pl-9"
              aria-label="Buscar configurações"
            />
          </div>
          <nav className="flex flex-col gap-1.5">
            {CATEGORIES.filter((c) => matches.includes(c.id)).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setCategory(id)}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition-all duration-200 ${
                  shown === id
                    ? "bg-elevated text-foreground shadow-[0_0_0_1px_oklch(0.63_0.235_302_/_28%)]"
                    : "text-muted-foreground hover:bg-elevated/60 hover:text-foreground"
                }`}
              >
                <Icon className="size-4 shrink-0 text-primary" />
                {label}
              </button>
            ))}
          </nav>
          <Button variant="ghost" size="sm" className="mt-5 w-full" onClick={() => { reset(); setDirty(true); }}>
            <RotateCcw /> Restaurar padrões
          </Button>
        </Module>

        <div className="min-w-0 space-y-6">
          {shown === "hotkeys" ? (
            <Module
              icon={Keyboard}
              title="Atalhos globais"
              hint="Clique em um atalho e pressione a combinação desejada"
            >
              <ul className="space-y-2.5">
                {settings.hotkeys.map((h) => (
                  <li
                    key={h.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-background/40 px-4 py-3"
                  >
                    <span className="truncate text-sm">{h.label}</span>
                    <div className="flex shrink-0 items-center gap-2">
                      {issues[h.id] ? (
                        <span className="flex items-center gap-1 text-xs text-warning">
                          <AlertTriangle className="size-3.5" /> {issues[h.id]}
                        </span>
                      ) : null}
                      <Button
                        variant={capturing === h.id ? "default" : "outline"}
                        size="sm"
                        className="min-w-28 font-mono"
                        onClick={() => setCapturing(capturing === h.id ? null : h.id)}
                        onKeyDown={(e) => capturing === h.id && captureCombo(h.id, e)}
                      >
                        {capturing === h.id ? "Pressione…" : h.combo}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </Module>
          ) : null}

          {shown === "capture" ? (
            <Module icon={SlidersHorizontal} title="Captura">
              <div className="space-y-5">
                <div>
                  <Label className="label-caps">Buffer retroativo</Label>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {BUFFER_OPTIONS.map((s) => (
                      <Button
                        key={s}
                        size="sm"
                        className="rounded-full"
                        variant={settings.bufferSeconds === s ? "default" : "outline"}
                        onClick={() => touch("bufferSeconds", s)}
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
                  onChange={(v) => touch("resolution", v as typeof settings.resolution)}
                />
                <Selector
                  label="FPS"
                  value={String(settings.fps)}
                  options={["30", "60", "120", "144"]}
                  onChange={(v) => touch("fps", Number(v) as typeof settings.fps)}
                />
                <Selector
                  label="Codec"
                  value={settings.codec}
                  options={["h264", "h265", "av1"]}
                  onChange={(v) => touch("codec", v as typeof settings.codec)}
                />
                <div>
                  <Label htmlFor="bitrate" className="label-caps">
                    Bitrate: {settings.bitrateMbps} Mbps · ~{formatBytes(perMinute)} por minuto
                  </Label>
                  <input
                    id="bitrate"
                    type="range"
                    min={5}
                    max={80}
                    step={1}
                    value={settings.bitrateMbps}
                    onChange={(e) => touch("bitrateMbps", Number(e.target.value))}
                    className="mt-3 w-full accent-[var(--primary)]"
                  />
                </div>
              </div>
            </Module>
          ) : null}

          {shown === "audio" ? (
            <Module icon={Volume2} title="Áudio e overlay">
              <div className="space-y-3">
                <Toggle
                  label="Microfone"
                  checked={settings.micEnabled}
                  onChange={(v) => touch("micEnabled", v)}
                />
                <Toggle
                  label="Áudio do sistema"
                  checked={settings.systemAudio}
                  onChange={(v) => touch("systemAudio", v)}
                />
                <Selector
                  label="Overlay"
                  value={settings.overlayMode}
                  options={["full", "compact", "notifications", "off"]}
                  onChange={(v) => touch("overlayMode", v as typeof settings.overlayMode)}
                />
                <Toggle
                  label="Telemetria (desativada por padrão)"
                  checked={settings.telemetry}
                  onChange={(v) => touch("telemetry", v)}
                />
              </div>
            </Module>
          ) : null}

          {shown === "storage" ? (
            <Module icon={HardDrive} title="Armazenamento">
              <div className="space-y-5">
                <div>
                  <Label htmlFor="folder" className="label-caps">
                    Pasta dos clipes
                  </Label>
                  <Input
                    id="folder"
                    className="mt-2.5 font-mono text-xs"
                    value={settings.folder}
                    onChange={(e) => touch("folder", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="max" className="label-caps">
                    Limite máximo (GB)
                  </Label>
                  <Input
                    id="max"
                    type="number"
                    min={10}
                    className="mt-2.5"
                    value={settings.maxStorageGb}
                    onChange={(e) => touch("maxStorageGb", Math.max(10, Number(e.target.value)))}
                  />
                </div>
                <Toggle
                  label="Excluir clipes antigos automaticamente (nunca favoritos)"
                  checked={settings.autoDelete}
                  onChange={(v) => touch("autoDelete", v)}
                />
              </div>
            </Module>
          ) : null}
        </div>
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
      <Label className="label-caps">{label}</Label>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {options.map((o) => (
          <Button
            key={o}
            size="sm"
            className="rounded-full"
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
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-background/40 px-4 py-3 text-sm transition-colors hover:bg-elevated/50">
      <span className="min-w-0">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 shrink-0 accent-[var(--primary)]"
      />
    </label>
  );
}
