import { forwardRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { animations } from "../animations";
import { Icon, type IconSize } from "./Icon";

export const dsButtonVariants = cva(
  "relative inline-flex items-center justify-center overflow-hidden font-medium tracking-tight transition-all duration-200 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-55 active:scale-[0.97]",
  {
    variants: {
      variant: {
        primary:
          "bg-accent-purple text-primary-foreground shadow-ds-sm hover:glow-purple hover:brightness-110",
        secondary:
          "bg-surface-secondary text-ink border border-border-primary hover:border-border-glow hover:bg-elevated",
        ghost: "text-ink-secondary hover:bg-surface-secondary/70 hover:text-ink",
        danger: "bg-accent-red text-destructive-foreground shadow-ds-sm hover:glow-red",
        glass: "glass-1 text-ink hover:border-border-glow hover:shadow-ds-md",
        icon: "text-ink-secondary hover:bg-surface-secondary/70 hover:text-ink",
        circular:
          "rounded-full bg-surface-secondary text-ink border border-border-primary hover:border-border-glow",
        floating: "glass-floating text-ink hover:brightness-110",
        capture:
          "rounded-full text-primary-foreground bg-[radial-gradient(circle_at_34%_26%,oklch(0.78_0.2_300),oklch(0.55_0.23_302)_62%,oklch(0.3_0.12_300)_100%)] glow-purple hover:scale-[1.04]",
      },
      size: {
        sm: "h-8 gap-1.5 rounded-lg px-3 text-xs",
        md: "h-10 gap-2 rounded-lg px-4 text-sm",
        lg: "h-12 gap-2.5 rounded-xl px-6 text-base",
        iconSm: "size-8 rounded-lg",
        iconMd: "size-10 rounded-lg",
        iconLg: "size-12 rounded-xl",
        orb: "size-28 flex-col gap-1",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type DSButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof dsButtonVariants> & {
    icon?: LucideIcon;
    iconSize?: IconSize;
    trailingIcon?: LucideIcon;
    /** Efeito ripple ao clicar (padrão: ligado). */
    ripple?: boolean;
    children?: ReactNode;
  };

export const Button = forwardRef<HTMLButtonElement, DSButtonProps>(function Button(
  { className, variant, size, icon, trailingIcon, iconSize = "sm", ripple = true, children, onClick, ...props },
  ref,
) {
  const [wave, setWave] = useState(0);

  return (
    <button
      ref={ref}
      type={props.type ?? "button"}
      className={cn(dsButtonVariants({ variant, size }), className)}
      onClick={(event) => {
        if (ripple) setWave((w) => w + 1);
        onClick?.(event);
      }}
      {...props}
    >
      {wave ? (
        <span
          key={wave}
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 rounded-[inherit] bg-primary-foreground/25",
            animations.buttonRipple,
          )}
        />
      ) : null}
      {icon ? <Icon icon={icon} size={iconSize} /> : null}
      {children}
      {trailingIcon ? <Icon icon={trailingIcon} size={iconSize} /> : null}
    </button>
  );
});

/** Botão de captura premium (salvar clipe). Mantém contrato onClick/disabled. */
export function CaptureButton({
  onClick,
  disabled,
  hotkey,
  icon,
  label = "SALVAR",
}: {
  onClick: () => void;
  disabled?: boolean;
  hotkey?: string;
  icon: LucideIcon;
  label?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        variant="capture"
        size="orb"
        onClick={onClick}
        disabled={disabled}
        aria-label={hotkey ? `${label} (${hotkey})` : label}
      >
        <Icon icon={icon} size="xl" />
        <span className="text-[11px] font-semibold tracking-[0.12em]">{label}</span>
      </Button>
      {hotkey ? (
        <span className="rounded-full border border-border-primary bg-surface-primary/60 px-2.5 py-0.5 font-mono text-[11px] text-ink-muted">
          {hotkey}
        </span>
      ) : null}
    </div>
  );
}
