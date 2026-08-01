import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Input as BaseInput } from "@/components/ui/input";
import { Button as DSButton } from "./Button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Campo padronizado: rótulo + controle + dica. */
export function Field({
  label,
  hint,
  htmlFor,
  action,
  className,
  children,
}: {
  label: string;
  hint?: string | undefined;
  htmlFor?: string | undefined;
  action?: ReactNode | undefined;
  className?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={htmlFor} className="label-caps">
          {label}
        </Label>
        {action}
      </div>
      {children}
      {hint ? <p className="text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}

const CONTROL =
  "border-border-primary bg-surface-primary/60 text-ink placeholder:text-ink-muted focus-visible:border-border-glow";

export function TextInput({
  className,
  ...props
}: React.ComponentProps<typeof BaseInput>) {
  return <BaseInput className={cn(CONTROL, className)} {...props} />;
}

export function SelectInput({
  value,
  onValueChange,
  options,
  placeholder,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
  placeholder?: string | undefined;
  className?: string | undefined;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={cn(CONTROL, className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="glass-strong">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ToggleField({
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  label: string;
  hint?: string | undefined;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border-primary bg-surface-primary/50 p-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        {hint ? <p className="mt-0.5 text-xs text-ink-muted">{hint}</p> : null}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number | undefined;
  format?: (value: number) => string | undefined;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={label} action={<span className="font-mono text-xs text-ink-secondary">{format ? format(value) : value}</span>}>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(next) => onChange(next[0] ?? value)}
      />
    </Field>
  );
}

/** Campo de atalho (hotkey) somente leitura com aparência de tecla. */
export function HotkeyInput({
  value,
  onCapture,
  invalid,
}: {
  value: string;
  onCapture?: () => void | undefined;
  invalid?: boolean | undefined;
}) {
  return (
    <button
      type="button"
      onClick={onCapture}
      className={cn(
        "w-full rounded-lg border bg-surface-primary/60 px-3 py-2 text-left font-mono text-sm text-ink transition-colors",
        invalid ? "border-accent-red text-accent-red" : "border-border-primary hover:border-border-glow",
      )}
    >
      {value}
    </button>
  );
}

export { Label, Switch, Slider };

/** Grupo segmentado de opções (pills) — substitui seletores ad-hoc. */
export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label?: string | undefined;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
  hint?: string | undefined;
}) {
  const pills = (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <DSButton
          key={String(option.value)}
          size="sm"
          className="rounded-full"
          variant={option.value === value ? "primary" : "secondary"}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </DSButton>
      ))}
    </div>
  );

  if (!label) return pills;
  return (
    <Field label={label} {...(hint ? { hint } : {})}>
      {pills}
    </Field>
  );
}
