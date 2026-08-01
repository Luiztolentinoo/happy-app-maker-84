import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, CircleAlert, RefreshCw, XCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { type DiagnosticResult, runDemoDiagnostics } from "@/lib/clipcore";

export const Route = createFileRoute("/diagnostics")({
  head: () => ({
    meta: [
      { title: "Centro de diagnóstico — ClipCore" },
      {
        name: "description",
        content:
          "Verifique motor de captura, encoder, áudio, atalhos, disco, reprodução e rede, com resultados e soluções recomendadas.",
      },
      { property: "og:title", content: "Centro de diagnóstico — ClipCore" },
      {
        property: "og:description",
        content: "Testes de ambiente com status aprovado, aviso ou falha e detalhes técnicos.",
      },
    ],
  }),
  component: DiagnosticsPage,
});

const ICONS = {
  pass: CheckCircle2,
  warn: CircleAlert,
  fail: XCircle,
} as const;

const COLORS = {
  pass: "text-success",
  warn: "text-warning",
  fail: "text-destructive",
} as const;

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
    >
      <div className="panel max-w-3xl p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Verificações do ambiente</h2>
          <Button size="sm" variant="outline" onClick={rerun} disabled={running}>
            <RefreshCw className={running ? "animate-spin" : ""} /> Executar novamente
          </Button>
        </div>
        <ul className="divide-y divide-border">
          {results.map((r) => {
            const Icon = ICONS[r.status];
            return (
              <li key={r.id} className="flex gap-3 py-3">
                <Icon className={`mt-0.5 size-4 shrink-0 ${COLORS[r.status]}`} />
                <div>
                  <p className="text-sm font-medium">{r.label}</p>
                  <p className="text-xs text-muted-foreground">{r.detail}</p>
                  {r.fix ? <p className="mt-1 text-xs text-primary">Solução: {r.fix}</p> : null}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 rounded-md border border-border bg-background/40 p-3 text-xs text-muted-foreground">
          O pacote de suporte nunca inclui senhas, tokens, teclas digitadas ou vídeos.
        </p>
      </div>
    </AppShell>
  );
}
