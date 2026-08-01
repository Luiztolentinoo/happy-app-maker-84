import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  LayoutDashboard,
  Library,
  Settings,
  Stethoscope,
  Gamepad2,
  Radio,
} from "lucide-react";
import { APP_NAME, isDemoMode } from "@/lib/clipcore";

const NAV = [
  { to: "/", label: "Início", icon: LayoutDashboard },
  { to: "/library", label: "Biblioteca", icon: Library },
  { to: "/settings", label: "Configurações", icon: Settings },
  { to: "/diagnostics", label: "Diagnóstico", icon: Stethoscope },
] as const;

export function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-5 md:flex">
        <Link to="/" className="mb-8 flex items-center gap-2 px-2">
          <span className="grid size-8 place-items-center rounded-md bg-primary/15 text-primary">
            <Gamepad2 className="size-4" />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">{APP_NAME}</span>
        </Link>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto rounded-lg border border-sidebar-border bg-card/60 p-3 text-xs text-muted-foreground">
          <p className="mb-1 flex items-center gap-1.5 font-medium text-warning">
            <Radio className="size-3.5" /> Modo demonstração
          </p>
          Captura nativa, encoders e atalhos globais exigem o build desktop no Windows.
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-5 py-4 md:px-8">
          <div>
            <h1 className="text-2xl font-semibold">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
          {isDemoMode() ? (
            <span className="rounded-full border border-warning/40 bg-warning/10 px-3 py-1 text-xs font-medium text-warning">
              Dados simulados
            </span>
          ) : null}
        </header>
        <main className="flex-1 px-5 py-6 md:px-8">{children}</main>
        <nav className="sticky bottom-0 flex border-t border-border bg-sidebar md:hidden">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="flex flex-1 flex-col items-center gap-1 py-2 text-[11px] text-muted-foreground"
              activeProps={{ className: "text-primary" }}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
