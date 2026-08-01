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
import {
  Module,
  Badge,
  Button as DSButton,
  Field,
  HotkeyInput,
  Icon,
  Segmented,
  SliderField,
  TextInput,
  ToggleField,
} from "@ds";
import { type ClipcoreSettings, useSettings } from "@/hooks/use-settings";
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

  function touch<K extends keyof ClipcoreSettings>(key: K, value: ClipcoreSettings[K]) {
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
          <Badge tone="green">
            <Icon icon={Check} size="xs" /> alterações aplicadas
          </Badge>
        ) : (
          <Badge tone="muted">sem alterações</Badge>
        )
      }
    >
      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <Module className="h-fit p-4 lg:sticky lg:top-32">
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
            <TextInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar ajuste"
              className="pl-9"
              aria-label="Buscar configurações"
            />
          </div>
          <nav className="flex flex-col gap-1.5">
            {CATEGORIES.filter((c) => matches.includes(c.id)).map(({ id, label, icon: ItemIcon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setCategory(id)}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition-all duration-200 ${
                  shown === id
                    ? "bg-surface-tertiary text-ink shadow-glow-purple-sm"
                    : "text-ink-secondary hover:bg-surface-hover hover:text-ink"
                }`}
              >
                <Icon icon={ItemIcon} size="sm" className="shrink-0 text-accent-purple" />
                {label}
              </button>
            ))}
          </nav>
          <DSButton
            variant="ghost"
            size="sm"
            icon={RotateCcw}
            className="mt-5 w-full"
            onClick={() => {
              reset();
              setDirty(true);
            }}
          >
            Restaurar padrões
          </DSButton>
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
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border-primary bg-surface-primary/50 px-4 py-3"
                  >
                    <span className="truncate text-sm">{h.label}</span>
                    <div className="flex shrink-0 items-center gap-2">
                      {issues[h.id] ? (
                        <span className="flex items-center gap-1 text-xs text-accent-yellow">
                          <Icon icon={AlertTriangle} size="xs" /> {issues[h.id]}
                        </span>
                      ) : null}
                      <HotkeyInput
                        value={h.combo}
                        capturing={capturing === h.id}
                        invalid={Boolean(issues[h.id])}
                        onCapture={() => setCapturing(capturing === h.id ? null : h.id)}
                        onKeyDown={(e) => {
                          if (capturing === h.id) captureCombo(h.id, e);
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Module>
          ) : null}

          {shown === "capture" ? (
            <Module icon={SlidersHorizontal} title="Captura">
              <div className="space-y-5">
                <Segmented
                  label="Buffer retroativo"
                  value={settings.bufferSeconds}
                  options={BUFFER_OPTIONS.map((s) => ({
                    value: s,
                    label: s < 60 ? `${s}s` : `${s / 60}min`,
                  }))}
                  onChange={(v) => touch("bufferSeconds", v)}
                />
                <Segmented
                  label="Resolução"
                  value={settings.resolution}
                  options={(["720p", "1080p", "1440p", "2160p", "native"] as const).map((v) => ({
                    value: v,
                    label: v,
                  }))}
                  onChange={(v) => touch("resolution", v)}
                />
                <Segmented
                  label="FPS"
                  value={settings.fps}
                  options={([30, 60, 120, 144] as const).map((v) => ({
                    value: v,
                    label: String(v),
                  }))}
                  onChange={(v) => touch("fps", v)}
                />
                <Segmented
                  label="Codec"
                  value={settings.codec}
                  options={(["h264", "h265", "av1"] as const).map((v) => ({ value: v, label: v }))}
                  onChange={(v) => touch("codec", v)}
                />
                <SliderField
                  label="Bitrate"
                  value={settings.bitrateMbps}
                  min={5}
                  max={80}
                  format={(v) => `${v} Mbps · ~${formatBytes(perMinute)}/min`}
                  onChange={(v) => touch("bitrateMbps", v)}
                />
              </div>
            </Module>
          ) : null}

          {shown === "audio" ? (
            <Module icon={Volume2} title="Áudio e overlay">
              <div className="space-y-3">
                <ToggleField
                  label="Microfone"
                  checked={settings.micEnabled}
                  onCheckedChange={(v) => touch("micEnabled", v)}
                />
                <ToggleField
                  label="Áudio do sistema"
                  checked={settings.systemAudio}
                  onCheckedChange={(v) => touch("systemAudio", v)}
                />
                <Segmented
                  label="Overlay"
                  value={settings.overlayMode}
                  options={(["full", "compact", "notifications", "off"] as const).map((v) => ({
                    value: v,
                    label: v,
                  }))}
                  onChange={(v) => touch("overlayMode", v)}
                />
                <ToggleField
                  label="Telemetria"
                  hint="Desativada por padrão — nenhum dado sai do seu PC."
                  checked={settings.telemetry}
                  onCheckedChange={(v) => touch("telemetry", v)}
                />
              </div>
            </Module>
          ) : null}

          {shown === "storage" ? (
            <Module icon={HardDrive} title="Armazenamento">
              <div className="space-y-5">
                <Field label="Pasta dos clipes" htmlFor="folder">
                  <TextInput
                    id="folder"
                    className="font-mono text-xs"
                    value={settings.folder}
                    onChange={(e) => touch("folder", e.target.value)}
                  />
                </Field>
                <Field label="Limite máximo (GB)" htmlFor="max">
                  <TextInput
                    id="max"
                    type="number"
                    min={10}
                    value={settings.maxStorageGb}
                    onChange={(e) => touch("maxStorageGb", Math.max(10, Number(e.target.value)))}
                  />
                </Field>
                <ToggleField
                  label="Exclusão automática"
                  hint="Remove clipes antigos ao atingir o limite — favoritos nunca são apagados."
                  checked={settings.autoDelete}
                  onCheckedChange={(v) => touch("autoDelete", v)}
                />
              </div>
            </Module>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
