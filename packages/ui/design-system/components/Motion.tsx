import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Tone, toneVar } from "../tokens";
import { Icon } from "./Icon";

/** Transição de página: fade + leve subida + blur na troca de rota. */
export function RouteTransition({
  routeKey,
  className,
  children,
}: {
  routeKey: string;
  className?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div key={routeKey} className={cn("animate-ds-route-in", className)}>
      {children}
    </div>
  );
}

/** Entrada escalonada: cada filho aparece com um pequeno atraso. */
export function Stagger({
  step = 60,
  className,
  children,
}: {
  step?: number | undefined;
  className?: string | undefined;
  children: ReactNode[] | ReactNode;
}) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <>
      {items.map((child, index) => (
        <div
          key={index}
          className={cn("animate-ds-slide", className)}
          style={{ animationDelay: `${index * step}ms` }}
        >
          {child}
        </div>
      ))}
    </>
  );
}

/** Parallax discreto guiado pelo ponteiro (desativado em toque). */
export function Parallax({
  depth = 8,
  className,
  children,
}: {
  depth?: number | undefined;
  className?: string | undefined;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const onMove = (event: PointerEvent) => {
      const rect = node.getBoundingClientRect();
      const x = (event.clientX - (rect.left + rect.width / 2)) / rect.width;
      const y = (event.clientY - (rect.top + rect.height / 2)) / rect.height;
      setOffset({ x: x * depth, y: y * depth });
    };
    const onLeave = () => setOffset({ x: 0, y: 0 });

    node.addEventListener("pointermove", onMove);
    node.addEventListener("pointerleave", onLeave);
    return () => {
      node.removeEventListener("pointermove", onMove);
      node.removeEventListener("pointerleave", onLeave);
    };
  }, [depth]);

  return (
    <div
      ref={ref}
      className={cn("will-change-transform", className)}
      style={{
        transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
        transition: "transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      {children}
    </div>
  );
}

/** Indicador vivo: ponto com halo pulsante (estado em tempo real). */
export function LiveDot({
  tone = "green",
  label,
  className,
}: {
  tone?: Tone | undefined;
  label?: string | undefined;
  className?: string | undefined;
}) {
  const color = toneVar[tone];
  return (
    <span className={cn("inline-flex items-center gap-2 text-xs text-ink-secondary", className)}>
      <span className="relative grid size-2.5 place-items-center">
        <span
          aria-hidden
          className="absolute inset-0 rounded-full animate-ds-live"
          style={{ background: color }}
        />
        <span aria-hidden className="size-2 rounded-full" style={{ background: color }} />
      </span>
      {label}
    </span>
  );
}

/** Barra fina de carregamento (navegação/preload). */
export function TopProgress({ active, className }: { active: boolean; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 h-[2px] overflow-hidden transition-opacity duration-300",
        active ? "opacity-100" : "opacity-0",
        className,
      )}
    >
      <div
        className="h-full w-full animate-ds-progress rounded-full"
        style={{
          background: `linear-gradient(90deg, transparent, ${toneVar.purple}, ${toneVar.blue}, transparent)`,
        }}
      />
    </div>
  );
}

/** Brilho que percorre a superfície — usado em estados de processamento. */
export function Sheen({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 w-1/3 animate-ds-sheen bg-[linear-gradient(90deg,transparent,oklch(0.98_0.01_300/18%),transparent)]",
        className,
      )}
    />
  );
}

/**
 * Confirmação de ação: aparece ao incrementar `trigger`.
 * `tone` define sucesso (verde) ou erro (vermelho).
 */
export function ActionFlash({
  trigger,
  kind = "success",
  message,
  className,
}: {
  trigger: number;
  kind?: "success" | "error" | undefined;
  message?: string | undefined;
  className?: string | undefined;
}) {
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    if (!trigger) return;
    setVisible(trigger);
    const timer = setTimeout(() => setVisible(0), 1600);
    return () => clearTimeout(timer);
  }, [trigger]);

  if (!visible) return null;

  const success = kind === "success";
  const style: CSSProperties = {
    borderColor: success ? toneVar.green : toneVar.red,
    color: success ? toneVar.green : toneVar.red,
  };

  return (
    <div
      key={visible}
      role="status"
      className={cn(
        "inline-flex items-center gap-2 rounded-full border bg-surface-primary/70 px-3 py-1 text-xs font-semibold backdrop-blur-md",
        success ? "animate-ds-success" : "animate-ds-error",
        className,
      )}
      style={style}
    >
      <Icon icon={success ? CheckCircle2 : XCircle} size="xs" />
      {message ?? (success ? "Concluído" : "Falhou")}
    </div>
  );
}
