import { Save } from "lucide-react";
import { useState } from "react";

/** Botão premium circular de salvar clipe. Mantém o contrato onClick/disabled. */
export function SaveClipButton({
  onClick,
  disabled,
  hotkey,
}: {
  onClick: () => void;
  disabled?: boolean;
  hotkey: string;
}) {
  const [pulse, setPulse] = useState(0);

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        disabled={disabled}
        aria-label={`Salvar clipe (${hotkey})`}
        onClick={() => {
          setPulse((p) => p + 1);
          onClick();
        }}
        className="group relative grid size-28 place-items-center rounded-full transition-transform duration-200 hover:scale-[1.04] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        style={{
          background:
            "radial-gradient(circle at 34% 26%, oklch(0.78 0.2 300), oklch(0.55 0.23 302) 62%, oklch(0.3 0.12 300) 100%)",
          boxShadow:
            "0 0 0 1px oklch(0.72 0.2 300 / 55%), 0 22px 46px -20px oklch(0.63 0.235 302 / 85%)",
        }}
      >
        {pulse ? (
          <span
            key={pulse}
            className="pointer-events-none absolute inset-0 rounded-full animate-orb-burst"
            style={{
              background: "radial-gradient(circle, oklch(0.72 0.2 300) 0%, transparent 70%)",
            }}
          />
        ) : null}
        <span className="pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity duration-200 group-hover:opacity-100" style={{ boxShadow: "0 0 40px 4px oklch(0.72 0.2 300 / 45%)" }} />
        <span className="relative flex flex-col items-center gap-1 text-primary-foreground">
          <Save className="size-7" />
          <span className="text-[11px] font-semibold tracking-[0.12em]">SALVAR</span>
        </span>
      </button>
      <span className="rounded-full border border-border bg-panel/60 px-2.5 py-0.5 font-mono text-[11px] text-muted-foreground">
        {hotkey}
      </span>
    </div>
  );
}
