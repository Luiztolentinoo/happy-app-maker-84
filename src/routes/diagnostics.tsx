import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, CircleAlert, Cpu, RefreshCw, XCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Module, Gauge, StatusChip } from "@/components/Module";
import { Button } from "@/components/ui/button";
import { type DiagnosticResult, runDemoDiagnostics } from "@/lib/clipcore";

export const Route = createFileRoute("/diagnostics")({
  head: () => ({
    meta: [
      { title: "Painel de diagnóstico — ClipCore" },
      {
        name: "description",
        content:
          "Monitor futurista de GPU, encoder, áudio, atalhos, disco, reprodução e rede, com status e soluções recomendadas.",
      },
      { property: "og:title", content: "Painel de diagnóstico — ClipCore" },
      {
        property: "og:description",
        content: "Testes de ambiente com status aprovado, aviso ou falha e detalhes técnicos.",
      },
    ],
  }),
  component: DiagnosticsPage,
});

const ICONS = { pass: CheckCircle2, warn: CircleAlert, fail: XCircle } as const;
const TONES = { pass: "success", warn: "warning", fail: "destructive" } as const;
const STATUS_TEXT = { pass: "online", warn: "check", fail: "offline" } as const;

const HARDWARE = [
  { label: "GPU · NVENC", value: "ONLINE", percent: 88, tone: "primary" as const },
  { label: "CPU", value: "18%", percent: 18, tone: "electric" as const },
  { label: "Storage", value: "GOOD", percent: 72, tone: "success" as const },
  { label: "Encoder", value: "READY", percent: 95, tone: "primary" as const },
  { label: "Áudio", value: "READY", percent: 64, tone: "success" as const },
  { label: "Rede", value: "STABLE", percent: 80, tone: "electric" as const },
];

function DiagnosticsPage() {
  const [results, setResults] = useState<DiagnosticResult[]>(() => runDemoDiagnostics());
  const [running, setRunning] = useState(false);

  function rerun() {
    setRunning(true);
    setTimeout(() => {
      setResults(runDemoDiagnostics());
      setRunning(false);
    }, 700);
  }

  return (
    <AppShell
      title="Diagnóstico"
      subtitle="Itens marcados como aviso dependem da camada nativa no Windows"
      actions={
        <Button size="sm" variant="outline" onClick={rerun} disabled={running}>
          <RefreshCw className={running ? "animate-spin" : ""} /> Reexecutar
        </Button>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_28rem]">
        <Module icon={Cpu} title="Monitor de hardware">
          <div className="grid gap-3 sm:grid-cols-2">
            {HARDWARE.map((h) => (
              <Gauge key={h.label} {...h} />
            ))}
          </div>
        </Module>

        <Module title="Verificações do ambiente">
          <ul className="space-y-3">
            {results.map((r) => {
              const Icon = ICONS[r.status];
              return (
                <li
                  key={r.id}
                  className="grid animate-rise grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-xl border border-border bg-background/40 p-4"
                >
                  <Icon className={`mt-0.5 size-4 shrink-0 text-${TONES[r.status]}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{r.label}</p>
                    <p className="text-xs text-muted-foreground">{r.detail}</p>
                    {r.fix ? <p className="mt-1 text-xs text-primary">Solução: {r.fix}</p> : null}
                  </div>
                  <StatusChip tone={TONES[r.status]}>{STATUS_TEXT[r.status]}</StatusChip>
                </li>
              );
            })}
          </ul>
          <p className="mt-5 rounded-xl border border-border bg-background/40 p-4 text-xs text-muted-foreground">
            O pacote de suporte nunca inclui senhas, tokens, teclas digitadas ou vídeos.
          </p>
        </Module>
      </div>
    </AppShell>
  );
}
