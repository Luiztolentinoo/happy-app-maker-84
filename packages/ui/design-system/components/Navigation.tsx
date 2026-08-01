import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";
import { DSTooltip } from "./Overlay";

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  hint?: string;
};

/** Sidebar oficial: ícones grandes, tooltip e indicador luminoso de rota ativa. */
export function Sidebar({
  items,
  brand,
  footer,
  collapsed = false,
  className,
}: {
  items: NavItem[];
  brand?: ReactNode;
  footer?: ReactNode;
  collapsed?: boolean;
  className?: string;
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
              className="group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ink-secondary transition-colors duration-200 hover:bg-surface-secondary/70 hover:text-ink data-[status=active]:bg-accent-purple/12 data-[status=active]:text-ink"
              activeProps={{ "data-status": "active" }}
            >
              <span
                aria-hidden
                className="absolute left-0 h-6 w-0.5 rounded-full bg-accent-purple opacity-0 transition-opacity duration-200 group-data-[status=active]:opacity-100"
              />
              <Icon icon={item.icon} size="md" className="group-data-[status=active]:text-accent-purple" />
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
          className="flex flex-col items-center gap-1 rounded-lg px-2 py-1 text-[10px] text-ink-muted data-[status=active]:text-accent-purple"
          activeProps={{ "data-status": "active" }}
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
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
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
    </header>
  );
}
