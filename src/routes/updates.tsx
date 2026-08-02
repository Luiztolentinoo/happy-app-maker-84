import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Clock,
  DownloadCloud,
  Info,
  RefreshCw,
  RotateCw,
  ShieldCheck,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge, Button as DSButton, Module, ProgressBar, type Tone } from "@ds";
import {
  APP_CHANNEL,
  APP_VERSION,
  CHANNEL_LABEL,
  appDisplayName,
  installerArtifacts,
} from "@/lib/distribution";
import { updateService, type UpdateInfo, type UpdateStatus } from "@/services/updateService";
import { formatBytes } from "@/lib/clipcore";

export const Route = createFileRoute("/updates")({
  head: () => ({
    meta: [
      { title: "Atualizações do ClipCore — canal, versão e assinatura" },
      {
        name: "description",
        content:
          "Veja a versão instalada, o canal de release, a última verificação, notas da versão e o progresso de download das atualizações assinadas do ClipCore.",
      },
      { property: "og:title", content: "Atualizações do ClipCore" },
      {
        property: "og:description",
        content:
          "Canal, versão, assinatura e progresso das atualizações do aplicativo desktop de captura.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UpdatesPage,
});

const STATUS_META: Record<UpdateStatus, { label: string; tone: Tone }> = {
  up_to_date: { label: "atualizado", tone: "green" },
  checking: { label: "verificando", tone: "blue" },
  available: { label: "disponível", tone: "purple" },
  downloading: { label: "baixando", tone: "blue" },
  ready_to_install: { label: "pronto para instalar", tone: "green" },
  installing: { label: "instalando", tone: "blue" },
  failed: { label: "falhou", tone: "red" },
  blocked_unsigned: { label: "bloqueado por assinatura", tone: "yellow" },
  unavailable_in_browser: { label: "indisponível no navegador", tone: "yellow" },
};

function UpdatesPage() {
  const [info, setInfo] = useState<UpdateInfo>(() => updateService.base());
  const [busy, setBusy] = useState(false);
  const blocked = updateService.blockReason();

  const check = useCallback(async () => {
    setBusy(true);
    setInfo((prev) => ({ ...prev, status: "checking", error: null }));
    try {
      setInfo(await updateService.check());
    } catch (error) {
      setInfo((prev) => ({
        ...prev,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      }));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  async function download() {
    setBusy(true);
    setInfo((prev) => ({ ...prev, status: "downloading", progress: 0 }));
    try {
      setInfo(await updateService.download((p) => setInfo((prev) => ({ ...prev, progress: p }))));
    } catch (error) {
      setInfo((prev) => ({
        ...prev,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      }));
    } finally {
      setBusy(false);
    }
  }

  async function install() {
    setInfo((prev) => ({ ...prev, status: "installing" }));
    try {
      await updateService.installAndRestart();
    } catch (error) {
      setInfo((prev) => ({
        ...prev,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  const meta = STATUS_META[info.status];
  const recommended = installerArtifacts().find((a) => a.recommended)!;

  return (
    <AppShell
      title="Atualizações"
      subtitle={appDisplayName()}
      actions={
        <DSButton size="sm" variant="secondary" icon={RefreshCw} disabled={busy} onClick={check}>
          Verificar agora
        </DSButton>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <Module
          icon={DownloadCloud}
          title="Estado da atualização"
          action={<Badge tone={meta.tone}>{meta.label}</Badge>}
        >
          <dl className="grid gap-3 sm:grid-cols-2">
            <Row label="Versão instalada" value={APP_VERSION} />
            <Row label="Canal" value={CHANNEL_LABEL[APP_CHANNEL]} />
            <Row
              label="Última verificação"
              value={
                info.lastCheckedAt ? new Date(info.lastCheckedAt).toLocaleString("pt-BR") : "nunca"
              }
            />
            <Row label="Nova versão" value={info.availableVersion ?? "—"} />
            <Row label="Tamanho" value={info.sizeBytes ? formatBytes(info.sizeBytes) : "—"} />
            <Row
              label="Assinatura"
              value={info.signatureVerified ? "verificada" : "não verificada"}
            />
          </dl>

          {info.status === "downloading" || info.status === "ready_to_install" ? (
            <div className="mt-6 space-y-2">
              <ProgressBar percent={info.progress} label="Progresso do download" />
              <p className="text-xs text-muted-foreground">{Math.round(info.progress)}%</p>
            </div>
          ) : null}

          {info.notes ? (
            <div className="mt-6 rounded-xl border border-border bg-background/40 p-4 text-xs whitespace-pre-line text-muted-foreground">
              {info.notes}
            </div>
          ) : null}

          {info.error ? (
            <p className="mt-6 flex items-start gap-2 rounded-xl border border-border bg-background/40 p-4 text-xs text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {info.error}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-2">
            <DSButton
              icon={DownloadCloud}
              disabled={busy || info.status !== "available"}
              onClick={download}
            >
              Baixar atualização
            </DSButton>
            <DSButton
              variant="secondary"
              icon={RotateCw}
              disabled={info.status !== "ready_to_install"}
              onClick={install}
            >
              Instalar e reiniciar
            </DSButton>
            <DSButton
              variant="ghost"
              icon={Clock}
              disabled={info.status === "unavailable_in_browser"}
              onClick={() =>
                setInfo((prev) => ({ ...prev, postponedUntil: updateService.postpone() }))
              }
            >
              Adiar 24h
            </DSButton>
          </div>
          {info.postponedUntil ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Adiada até {new Date(info.postponedUntil).toLocaleString("pt-BR")}.
            </p>
          ) : null}
        </Module>

        <div className="space-y-6">
          <Module icon={ShieldCheck} title="Segurança da atualização">
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>Manifesto servido por HTTPS e verificado com a chave pública embutida.</li>
              <li>Nenhuma release sem assinatura válida é aceita ou instalada.</li>
              <li>
                Download em diretório temporário; a instalação atual só é trocada após validação.
              </li>
              <li>A chave privada nunca fica no repositório — apenas em secrets do CI.</li>
            </ul>
            {blocked ? (
              <p className="mt-4 flex items-start gap-2 rounded-xl border border-border bg-background/40 p-4 text-xs text-warning">
                <Info className="mt-0.5 size-4 shrink-0" />
                {blocked}
              </p>
            ) : null}
          </Module>

          <Module icon={Info} title="Instalador recomendado">
            <p className="font-mono text-xs break-all text-ink">{recommended.fileName}</p>
            <p className="mt-2 text-xs text-muted-foreground">{recommended.audience}</p>
            <p className="mt-3 text-xs text-muted-foreground">
              O MSI corporativo ({installerArtifacts()[1]!.fileName}) instala por máquina e exige
              administrador.
            </p>
          </Module>
        </div>
      </div>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-4">
      <dt className="label-caps">{label}</dt>
      <dd className="mt-1 text-sm font-semibold break-words text-ink">{value}</dd>
    </div>
  );
}
