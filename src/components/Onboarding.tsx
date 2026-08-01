import { useEffect, useState } from "react";
import { Check, Cpu, Loader2, Mic, MonitorPlay } from "lucide-react";
import { APP_NAME } from "@/lib/clipcore";
import { Button } from "@/components/ui/button";

const KEY = "clipcore.onboarding.v1";

const STEPS = [
  { icon: MonitorPlay, label: "Verificando GPU" },
  { icon: Cpu, label: "Verificando encoder" },
  { icon: Mic, label: "Verificando áudio" },
] as const;

/**
 * Onboarding cinematográfico exibido apenas na primeira execução.
 * Não altera estado global nem contratos existentes: usa localStorage próprio.
 */
export function Onboarding() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setVisible(true);
    } catch {
      /* storage indisponível: segue sem onboarding */
    }
  }, []);

  useEffect(() => {
    if (!visible || step >= STEPS.length) return;
    const t = setTimeout(() => setStep((s) => s + 1), 850);
    return () => clearTimeout(t);
  }, [visible, step]);

  if (!visible) return null;

  function dismiss() {
    try {
      localStorage.setItem(KEY, "done");
    } catch {
      /* ignora */
    }
    setVisible(false);
  }

  const done = step >= STEPS.length;

  return (
    <div className="fixed inset-0 z-50 grid animate-fade-in place-items-center bg-background/92 px-6 backdrop-blur-2xl">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60rem 40rem at 70% -10%, oklch(0.63 0.235 302 / 22%), transparent 70%), radial-gradient(50rem 34rem at 0% 100%, oklch(0.75 0.14 232 / 16%), transparent 72%)",
        }}
      />
      <div className="glass-floating relative w-full max-w-xl animate-ds-slide p-10 text-center">
        <p className="label-caps">{APP_NAME}</p>
        <h2 className="mt-4 font-display text-3xl leading-tight font-semibold text-glow">
          Bem-vindo ao futuro da captura de gameplay.
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Detectando computador… preparando o motor de captura para os seus melhores momentos.
        </p>

        <ul className="mt-8 space-y-3 text-left">
          {STEPS.map(({ icon: Icon, label }, i) => {
            const state = i < step ? "done" : i === step ? "running" : "idle";
            return (
              <li
                key={label}
                className="flex items-center gap-3 rounded-xl border border-border-primary bg-background/40 px-4 py-3 text-sm"
                style={{ opacity: state === "idle" ? 0.5 : 1 }}
              >
                <Icon className="size-4 shrink-0 text-accent-purple" />
                <span className="min-w-0 flex-1 truncate">{label}</span>
                {state === "done" ? (
                  <Check className="size-4 text-accent-green" />
                ) : state === "running" ? (
                  <Loader2 className="size-4 animate-spin text-accent-blue" />
                ) : null}
              </li>
            );
          })}
        </ul>

        <Button className="mt-8 w-full" size="lg" disabled={!done} onClick={dismiss}>
          {done ? "Entrar no ClipCore" : "Analisando sistema…"}
        </Button>
      </div>
    </div>
  );
}
