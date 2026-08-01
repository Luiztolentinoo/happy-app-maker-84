/**
 * Tokens expostos ao TypeScript.
 * Sempre referenciar variáveis CSS — nunca literais de cor.
 */

export const tones = ["purple", "blue", "green", "red", "yellow", "muted"] as const;
export type Tone = (typeof tones)[number];

export const toneVar: Record<Tone, string> = {
  purple: "var(--accent-purple)",
  blue: "var(--accent-blue)",
  green: "var(--accent-green)",
  red: "var(--accent-red)",
  yellow: "var(--accent-yellow)",
  muted: "var(--text-muted)",
};

/** Classes utilitárias por tom (texto + fundo + borda). */
export const toneClass: Record<Tone, string> = {
  purple: "text-accent-purple border-accent-purple/40 bg-accent-purple/10",
  blue: "text-accent-blue border-accent-blue/40 bg-accent-blue/10",
  green: "text-accent-green border-accent-green/40 bg-accent-green/10",
  red: "text-accent-red border-accent-red/40 bg-accent-red/10",
  yellow: "text-accent-yellow border-accent-yellow/40 bg-accent-yellow/10",
  muted: "text-ink-muted border-border-primary bg-surface-primary/50",
};

export const glowClass: Record<Tone, string> = {
  purple: "glow-purple",
  blue: "glow-blue",
  green: "glow-green",
  red: "glow-red",
  yellow: "glow-purple",
  muted: "shadow-ds-sm",
};

/** Escala de espaçamento (classes Tailwind padronizadas). */
export const spacing = {
  xs: "gap-2",
  sm: "gap-3",
  md: "gap-4",
  lg: "gap-6",
  xl: "gap-8",
} as const;

/** Raio padrão por tipo de superfície. */
export const radius = {
  chip: "rounded-full",
  control: "rounded-lg",
  card: "rounded-xl",
  panel: "rounded-2xl",
} as const;

/** Níveis de glass. */
export const glass = {
  1: "glass-1",
  2: "glass-2",
  strong: "glass-strong",
  floating: "glass-floating",
} as const;
export type GlassLevel = keyof typeof glass;

/** Sombras. */
export const shadow = {
  xs: "shadow-ds-xs",
  sm: "shadow-ds-sm",
  md: "shadow-ds-md",
  lg: "shadow-ds-lg",
} as const;
