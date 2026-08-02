/** Biblioteca central de animações. Nenhum componente deve declarar keyframes próprio. */
export const animations = {
  fade: "animate-ds-fade",
  slide: "animate-ds-slide",
  scale: "animate-ds-scale",
  pulse: "animate-ds-pulse",
  glow: "animate-ds-glow",
  orbPulse: "animate-ds-orb-pulse",
  orbExplosion: "animate-ds-orb-explosion",
  buttonRipple: "animate-ds-ripple",
  notificationSlide: "animate-ds-notification",
  panelExpand: "animate-ds-panel-expand",
  routeIn: "animate-ds-route-in",
  shimmer: "ds-shimmer",
  success: "animate-ds-success",
  error: "animate-ds-error",
  live: "animate-ds-live",
  sheen: "animate-ds-sheen",
  orbDrift: "animate-ds-orb-drift",
  orbRing: "animate-ds-orb-ring",
  hover: "transition-colors duration-200",
  cardHover: "ds-hover-smart",
} as const;

export type AnimationName = keyof typeof animations;

export function anim(...names: AnimationName[]) {
  return names.map((n) => animations[n]).join(" ");
}
