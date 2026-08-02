import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";
import { DSTooltip } from "./Overlay";
import { TopProgress } from "./Motion";

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  hint?: string | undefined;
};

/** Sidebar oficial: ícones grandes, tooltip e indicador luminoso de rota ativa. */
export function Sidebar({
  items,
  brand,
  footer,
  collapsed = false,
  className,
  onNavHover,
}: {
  items: NavItem[];
  brand?: ReactNode | undefined;
  footer?: ReactNode | undefined;
  collapsed?: boolean | undefined;
  className?: string | undefined;
  onNavHover?: (() => void) | undefined;
}) {
  return (
    <aside
      className={cn(
        "glass-2 sticky top-0 hidden h-screen shrink-0 flex-col rounded-none border-y-0 border-l-0 p-4 lg:flex",
        collapsed ? "w-20" : "w-64",
        className,
      )}
    >
      {brand ? <div className="mb-6 px-2">{brand}</div> : null}
      <nav className="flex flex-1 flex-col gap-1" aria-label="Navegação principal">
        {items.map((item) => (
          <DSTooltip key={item.to} content={item.hint ?? item.label}>
            <Link
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              preload="intent"
              onPointerEnter={onNavHover}
              className="group relative flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium text-ink-secondary transition-all duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:translate-x-1 hover:bg-surface-secondary/70 hover:text-ink active:scale-[0.985]"
              activeProps={{
                className:
                  "bg-surface-secondary/90 text-ink glow-purple before:absolute before:left-0 before:top-1/2 before:h-7 before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:bg-accent-purple",
              }}
            >
              <Icon
                icon={item.icon}
                size="md"
                className="transition-all duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-110 group-hover:text-accent-purple group-hover:drop-shadow-[0_0_10px_var(--accent-purple)]"
              />
              {collapsed ? null : <span className="truncate">{item.label}</span>}
            </Link>
          </DSTooltip>
        ))}
      </nav>
      {footer ? <div className="mt-4 px-2">{footer}</div> : null}
    </aside>
  );
}

/** Navegação móvel derivada dos mesmos itens (sem duplicar configuração). */
export function MobileNav({ items, className }: { items: NavItem[]; className?: string }) {
  return (
    <nav
      className={cn(
        "glass-strong fixed inset-x-0 bottom-0 z-40 flex items-center justify-around rounded-none border-x-0 border-b-0 px-2 py-2 lg:hidden",
        className,
      )}
      aria-label="Navegação"
    >
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          activeOptions={{ exact: item.to === "/" }}
          preload="intent"
          className="flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-lg py-1 text-[11px] text-ink-muted transition-all duration-200 active:scale-95"
          activeProps={{ className: "text-accent-purple" }}
        >
          <Icon icon={item.icon} size="md" />
          <span className="max-w-14 truncate">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}

/** Topbar oficial. */
export function Topbar({
  title,
  subtitle,
  actions,
  className,
  loading = false,
}: {
  title: string;
  subtitle?: string | undefined;
  actions?: ReactNode | undefined;
  className?: string | undefined;
  loading?: boolean | undefined;
}) {
  return (
    <header
      className={cn(
        "glass-1 sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 rounded-none border-x-0 border-t-0 px-6 py-4",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="truncate font-display text-lg font-semibold text-ink">{title}</h1>
        {subtitle ? <p className="truncate text-xs text-ink-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      <TopProgress active={loading} />
    </header>
  );
}
