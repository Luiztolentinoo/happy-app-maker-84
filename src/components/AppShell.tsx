import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  LayoutDashboard,
  Library,
  Scissors,
  Video,
  Gamepad2,
  UploadCloud,
  Stethoscope,
  Settings,
  UserRound,
  Radio,
} from "lucide-react";
import { APP_NAME, isDemoMode } from "@/lib/clipcore";
import { Badge, Sidebar, MobileNav, type NavItem } from "@ds";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/library", label: "Biblioteca", icon: Library },
  { to: "/editor", label: "Editor", icon: Scissors },
  { to: "/recordings", label: "Gravações", icon: Video },
  { to: "/games", label: "Jogos", icon: Gamepad2 },
  { to: "/uploads", label: "Uploads", icon: UploadCloud },
  { to: "/diagnostics", label: "Diagnóstico", icon: Stethoscope },
  { to: "/settings", label: "Configurações", icon: Settings },
  { to: "/account", label: "Conta", icon: UserRound },
] as const;

const MOBILE_NAV = NAV.filter((n) =>
  ["/", "/library", "/recordings", "/diagnostics", "/settings"].includes(n.to),
);

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar/80 px-4 py-6 backdrop-blur-xl lg:flex">
        <Link to="/" className="mb-9 flex items-center gap-3 px-2">
          <span
            className="grid size-11 shrink-0 place-items-center rounded-xl text-primary-foreground"
            style={{
              background:
                "radial-gradient(circle at 32% 26%, oklch(0.78 0.2 300), oklch(0.55 0.23 302) 70%)",
              boxShadow: "0 0 28px -8px oklch(0.63 0.235 302 / 85%)",
            }}
          >
            <Gamepad2 className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block font-display text-xl font-semibold tracking-tight text-glow">
              {APP_NAME}
            </span>
            <span className="block text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
              capture engine
            </span>
          </span>
        </Link>

        <nav className="flex flex-col gap-1.5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              title={label}
              activeOptions={{ exact: to === "/" }}
              className="group relative flex items-center gap-3.5 overflow-hidden rounded-xl px-3.5 py-3 text-sm font-medium text-muted-foreground transition-all duration-200 hover:translate-x-0.5 hover:bg-elevated/70 hover:text-foreground"
              activeProps={{
                className:
                  "bg-elevated/90 text-foreground shadow-[0_0_0_1px_oklch(0.63_0.235_302_/_28%),0_14px_30px_-22px_oklch(0.63_0.235_302_/_85%)] before:absolute before:left-0 before:top-1/2 before:h-7 before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:bg-primary before:shadow-[0_0_14px_2px_oklch(0.63_0.235_302_/_75%)]",
              }}
            >
              <Icon className="size-5 shrink-0 transition-colors duration-200 group-hover:text-primary" />
              <span className="truncate">{label}</span>
            </Link>
          ))}
        </nav>

        <div className="mt-auto rounded-xl border border-sidebar-border bg-background/50 p-4 text-xs text-muted-foreground">
          <p className="mb-1.5 flex items-center gap-1.5 font-semibold text-warning">
            <Radio className="size-3.5" /> Modo demonstração
          </p>
          Captura nativa, encoders e atalhos globais exigem o build desktop no Windows.
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 border-b border-border bg-background/70 px-6 py-6 backdrop-blur-xl md:px-10">
          <div className="min-w-0">
            <h1 className="truncate font-display text-3xl font-semibold">{title}</h1>
            {subtitle ? (
              <p className="mt-1.5 truncate text-sm text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {actions}
            {isDemoMode() ? <Badge tone="yellow">demo</Badge> : null}
          </div>
        </header>
        <main className="flex-1 px-6 py-8 md:px-10">{children}</main>
        <nav className="sticky bottom-0 z-20 flex border-t border-border bg-sidebar/90 backdrop-blur-xl lg:hidden">
          {MOBILE_NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="flex min-h-14 flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] text-muted-foreground transition-colors"
              activeProps={{ className: "text-primary" }}
            >
              <Icon className="size-5" />
              <span className="truncate">{label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
