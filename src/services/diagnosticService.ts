import { isDesktopRuntime, nativeInvoke } from "./nativeClient";

export type CheckStatus = "pass" | "warn" | "fail" | "skipped";

export interface DiagnosticCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  action: string | null;
}

export interface DiagnosticReport {
  generated_at: string;
  checks: DiagnosticCheck[];
}

const browserReport = (): DiagnosticReport => ({
  generated_at: new Date().toISOString(),
  checks: [
    {
      id: "runtime",
      label: "Ambiente de execução",
      status: "warn",
      detail: "Navegador (prévia). Nenhum backend nativo disponível.",
      action: "Instale o ClipCore para Windows para captura real.",
    },
    {
      id: "native_backend",
      label: "Backend Tauri",
      status: "fail",
      detail: "Comandos nativos indisponíveis fora do aplicativo desktop.",
      action: "Execute bun run desktop:dev em uma máquina Windows.",
    },
  ],
});

export const diagnosticService = {
  isNative: isDesktopRuntime,
  run: () => nativeInvoke<DiagnosticReport>("run_native_diagnostics", undefined, browserReport),
};
