/**
 * Verificação de integridade da instalação e reparo de componentes.
 *
 * O Centro de Diagnóstico usa este serviço para responder "a instalação está
 * completa?" sem que o usuário precise procurar arquivos manualmente.
 */
import {
  APP_CHANNEL,
  APP_IDENTIFIER,
  APP_VERSION,
  channelAllowsAutoUpdate,
  SIDECARS,
  WINDOWS_PATHS,
} from "@/lib/distribution";
import { isDesktopRuntime, nativeInvoke } from "./nativeClient";
import type { CheckStatus } from "./diagnosticService";

export interface InstallationCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  action: string | null;
  /** Reparável automaticamente pelo fluxo de reparo. */
  repairable: boolean;
}

export interface InstallationReport {
  generated_at: string;
  version: string;
  channel: string;
  identifier: string;
  signed: boolean;
  install_dir: string | null;
  data_dir: string | null;
  logs_dir: string | null;
  checks: InstallationCheck[];
}

export type RepairAction =
  | "restore_sidecars"
  | "restore_shortcuts"
  | "rebuild_config"
  | "run_migrations"
  | "validate_database"
  | "clear_cache"
  | "rebuild_index";

export interface RepairOutcome {
  action: RepairAction;
  ok: boolean;
  message: string;
}

/** Ações destrutivas exigem confirmação explícita na interface. */
export const DESTRUCTIVE_REPAIRS: RepairAction[] = ["clear_cache", "rebuild_index"];

const browserReport = (): InstallationReport => ({
  generated_at: new Date().toISOString(),
  version: APP_VERSION,
  channel: APP_CHANNEL,
  identifier: APP_IDENTIFIER,
  signed: false,
  install_dir: null,
  data_dir: null,
  logs_dir: null,
  checks: [
    {
      id: "installation",
      label: "Instalação nativa",
      status: "skipped",
      detail: "A prévia do navegador não possui instalação, sidecars nem banco local.",
      action: "Instale o ClipCore para Windows para validar a instalação.",
      repairable: false,
    },
    ...SIDECARS.map((s) => ({
      id: `sidecar_${s.name}`,
      label: `Sidecar ${s.name}`,
      status: "skipped" as CheckStatus,
      detail: `Esperado em ${WINDOWS_PATHS.installPerUser}\\${s.bundleFile} com checksum SHA-256 validado.`,
      action: null,
      repairable: true,
    })),
    {
      id: "updater",
      label: "Atualizador",
      status: channelAllowsAutoUpdate() ? "warn" : "warn",
      detail: `Canal ${APP_CHANNEL}: atualização automática desativada até que as chaves de assinatura estejam configuradas.`,
      action: "Consulte docs/UPDATER.md para gerar e configurar o par de chaves.",
      repairable: false,
    },
  ],
});

export const installationService = {
  isNative: isDesktopRuntime,
  report: () =>
    nativeInvoke<InstallationReport>("get_installation_report", undefined, browserReport),

  repair: (action: RepairAction) =>
    nativeInvoke<RepairOutcome>("repair_installation", { action }, () => ({
      action,
      ok: false,
      message: "Reparo disponível somente no aplicativo desktop.",
    })),

  openLogsDir: () => nativeInvoke<void>("open_logs_dir", undefined, () => undefined),

  /** Relatório de suporte em texto — sem tokens, chaves ou nomes de arquivos pessoais. */
  supportReport: (report: InstallationReport): string =>
    [
      `ClipCore ${report.version} (${report.channel})`,
      `identificador: ${report.identifier}`,
      `assinado: ${report.signed ? "sim" : "não"}`,
      `gerado em: ${report.generated_at}`,
      "",
      ...report.checks.map((c) => `[${c.status}] ${c.label} — ${c.detail}`),
    ].join("\n"),
};
