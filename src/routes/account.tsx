import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, UserRound } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Module, Badge } from "@ds";
import { useSettings } from "@/hooks/use-settings";
import { APP_NAME, isNativeMode } from "@/lib/clipcore";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Conta e privacidade — ClipCore" },
      {
        name: "description",
        content:
          "Perfil local do ClipCore, estado do runtime, idioma, telemetria e política de privacidade dos dados de captura.",
      },
      { property: "og:title", content: "Conta e privacidade — ClipCore" },
      {
        property: "og:description",
        content: "Perfil local, sem nuvem obrigatória e telemetria desativada por padrão.",
      },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { settings } = useSettings();

  return (
    <AppShell
      title="Conta"
      subtitle="Perfil local — nenhuma conta na nuvem é necessária"
      actions={
        <Badge tone={isNativeMode() ? "green" : "yellow"}>
          {isNativeMode() ? "desktop" : "prévia web"}
        </Badge>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Module icon={UserRound} title="Perfil local">
          <div className="flex items-center gap-4">
            <span
              className="grid size-16 shrink-0 place-items-center rounded-2xl text-primary-foreground"
              style={{
                background:
                  "radial-gradient(circle at 32% 26%, oklch(0.78 0.2 300), oklch(0.55 0.23 302) 70%)",
                boxShadow: "0 0 34px -10px oklch(0.63 0.235 302 / 85%)",
              }}
            >
              <UserRound className="size-7" />
            </span>
            <div className="min-w-0">
              <p className="font-display text-xl font-semibold">Jogador local</p>
              <p className="truncate text-sm text-muted-foreground">
                {APP_NAME} · idioma {settings.language}
              </p>
            </div>
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Pasta de clipes</dt>
            <dd className="truncate text-right font-mono text-xs">{settings.folder}</dd>
            <dt className="text-muted-foreground">Limite de disco</dt>
            <dd className="text-right">{settings.maxStorageGb} GB</dd>
            <dt className="text-muted-foreground">Telemetria</dt>
            <dd className="text-right">{settings.telemetry ? "ativada" : "desativada"}</dd>
          </dl>
        </Module>

        <Module icon={ShieldCheck} title="Privacidade">
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            {[
              "Clipes e metadados ficam apenas neste dispositivo.",
              "Nenhum upload acontece sem ação explícita sua.",
              "Pacotes de suporte nunca incluem senhas, tokens ou vídeos.",
              "Telemetria é opcional e vem desativada por padrão.",
            ].map((line) => (
              <li key={line} className="rounded-xl border border-border bg-background/40 px-4 py-3">
                {line}
              </li>
            ))}
          </ul>
        </Module>
      </div>
    </AppShell>
  );
}
