import type { ReactNode } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const OVERLAY_SURFACE = "glass-strong border-border-primary text-ink";

/** Diálogo padronizado do Design System. */
export function DSDialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  footer,
  className,
  children,
}: {
  open?: boolean | undefined;
  onOpenChange?: (open: boolean) => void | undefined;
  trigger?: ReactNode | undefined;
  title: string;
  description?: string | undefined;
  footer?: ReactNode | undefined;
  className?: string | undefined;
  children?: ReactNode | undefined;
}) {
  return (
    <Dialog
      {...(open === undefined ? {} : { open })}
      {...(onOpenChange ? { onOpenChange } : {})}
    >
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className={cn(OVERLAY_SURFACE, className)}>
        <DialogHeader>
          <DialogTitle className="font-display">{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {children}
        {footer ? <DialogFooter>{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  );
}

export type MenuAction = {
  label: string;
  onSelect: () => void;
  danger?: boolean | undefined;
  separatorBefore?: boolean | undefined;
};

/** Dropdown padronizado. */
export function DSDropdown({
  trigger,
  label,
  actions,
}: {
  trigger: ReactNode;
  label?: string | undefined;
  actions: MenuAction[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent className={OVERLAY_SURFACE} align="end">
        {label ? <DropdownMenuLabel className="label-caps">{label}</DropdownMenuLabel> : null}
        {actions.map((action) => (
          <div key={action.label}>
            {action.separatorBefore ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem
              onSelect={action.onSelect}
              className={action.danger ? "text-accent-red" : undefined}
            >
              {action.label}
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Context menu padronizado. */
export function DSContextMenu({
  children,
  actions,
}: {
  children: ReactNode;
  actions: MenuAction[];
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className={OVERLAY_SURFACE}>
        {actions.map((action) => (
          <div key={action.label}>
            {action.separatorBefore ? <ContextMenuSeparator /> : null}
            <ContextMenuItem
              onSelect={action.onSelect}
              className={action.danger ? "text-accent-red" : undefined}
            >
              {action.label}
            </ContextMenuItem>
          </div>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** Tooltip padronizado. */
export function DSTooltip({
  content,
  side = "right",
  children,
}: {
  content: ReactNode;
  side?: "top" | "right" | "bottom" | "left" | undefined;
  children: ReactNode;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side} className={OVERLAY_SURFACE}>
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Notificações — camada única sobre sonner. */
export const notify = {
  info: (message: string, description?: string) =>
    toast(message, description ? { description } : undefined),
  success: (message: string, description?: string) =>
    toast.success(message, description ? { description } : undefined),
  warning: (message: string, description?: string) =>
    toast.warning(message, description ? { description } : undefined),
  error: (message: string, description?: string) =>
    toast.error(message, description ? { description } : undefined),
};
