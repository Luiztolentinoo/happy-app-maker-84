import { Link, useRouterState } from "@tanstack/react-router";
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
  Volume2,
  VolumeX,
} from "lucide-react";
import { APP_NAME, isDemoMode } from "@/lib/clipcore";
import { useSound } from "@/lib/sound";
import { cn } from "@/lib/utils";
import {
  Badge,
  Button,
  DSTooltip,
  Icon,
  MobileNav,
  RouteTransition,
  Sidebar,
  Topbar,
  type NavItem,
} from "@ds";

/** Fonte única de navegação — sidebar e navegação móvel derivam desta lista. */
const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/library", label: "Biblioteca", icon: Library },
  { to: "/editor", label: "Editor", icon: Scissors },
  { to: "/recordings", label: "Gravações", icon: Video },
  { to: "/games", label: "Jogos", icon: Gamepad2 },
  { to: "/uploads", label: "Uploads", icon: UploadCloud },
  { to: "/diagnostics", label: "Diagnóstico", icon: Stethoscope },
  { to: "/settings", label: "Configurações", icon: Settings },
  { to: "/account", label: "Conta", icon: UserRound },
];

const MOBILE_NAV = NAV.filter((item) =>
  ["/", "/library", "/recordings", "/diagnostics", "/settings"].includes(item.to),
);

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[radial-gradient(circle_at_32%_26%,oklch(0.78_0.2_300),oklch(0.55_0.23_302)_70%)] text-primary-foreground glow-purple">
        <Icon icon={Gamepad2} size="md" />
      </span>
      <span className="min-w-0">
        <span className="block font-display text-xl font-semibold tracking-tight text-ink">
          {APP_NAME}
        </span>
        <span className="label-caps block">capture engine</span>
      </span>
    </Link>
  );
}

function DemoNotice() {
  return (
    <div className="rounded-xl border border-border-primary bg-background/50 p-4 text-xs text-ink-muted">
      <p className="mb-1.5 flex items-center gap-1.5 font-semibold text-accent-yellow">
        <Icon icon={Radio} size="xs" /> Modo demonstração
      </p>
      Captura nativa, encoders e atalhos globais exigem o build desktop no Windows.
    </div>
  );
}

function SoundToggle() {
  const { enabled, toggle } = useSound();
  return (
    <DSTooltip
      side="bottom"
      content={enabled ? "Feedback sonoro ativo" : "Feedback sonoro desativado"}
    >
      <Button
        variant="icon"
        size="iconSm"
        icon={enabled ? Volume2 : VolumeX}
        onClick={toggle}
        aria-pressed={enabled}
        aria-label="Alternar feedback sonoro"
      />
    </DSTooltip>
  );
}

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
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isLoading = useRouterState({ select: (state) => state.isLoading || state.isTransitioning });
  const { play } = useSound();

  return (
    <div className="flex min-h-screen">
      <Sidebar
        items={NAV}
        brand={<Brand />}
        footer={<DemoNotice />}
        onNavHover={() => play("hover")}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          title={title}
          loading={isLoading}
          {...(subtitle ? { subtitle } : {})}
          actions={
            <>
              {actions}
              {isDemoMode() ? <Badge tone="yellow">demo</Badge> : null}
              <SoundToggle />
            </>
          }
        />
        <main
          className={cn(
            "ds-scroll flex-1 px-6 py-8 pb-24 transition-[filter,opacity] duration-300 md:px-10 lg:pb-8",
            isLoading && "opacity-70 blur-[3px]",
          )}
        >
          <RouteTransition routeKey={pathname}>{children}</RouteTransition>
        </main>
        <MobileNav items={MOBILE_NAV} />
      </div>
    </div>
  );
}
