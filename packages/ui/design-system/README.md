# ClipCore Design System

Fonte única de verdade da interface. **Nunca** crie componentes isolados nem use
cores literais: importe sempre de `@ds`.

```tsx
import { Button, MetricCard, CoreOrb, Badge } from "@ds";
```

## Fundações

| Camada      | Arquivo        | Conteúdo                                                                 |
| ----------- | -------------- | ------------------------------------------------------------------------ |
| Cores/Glass | `tokens.css`   | `surface-*`, `ink*`, `border-*`, `accent-*`, sombras, glows, glass, keyframes |
| Tokens TS   | `tokens.ts`    | `tones`, `toneVar`, `toneClass`, `spacing`, `radius`, `glass`, `shadow`   |
| Animações   | `animations.ts`| `fade, slide, scale, pulse, glow, orbPulse, orbExplosion, buttonRipple, notificationSlide, panelExpand, cardHover` |
| Tipografia  | `components/Typography.tsx` | `Text` (hero/title/subtitle/body/small/mono/caps), `DefinitionList` |

Sombras: `shadow-ds-xs|sm|md|lg`. Glows: `glow-purple|blue|green|red`.
Glass: `glass-1`, `glass-2`, `glass-strong`, `glass-floating`.

## Componentes

- **Icon** — tamanhos fixos `xs..xl`, peso 1.9. `<Icon icon={Cpu} size="md" tone="blue" />`
- **Button** — `primary, secondary, ghost, danger, glass, icon, circular, floating, capture` + `CaptureButton`
- **Panel / Module / SectionTitle** — superfícies de vidro com cabeçalho padronizado
- **Cards** — `MetricCard, StatusCard, GlassCard, HardwareCard, MediaCard, GameCard, DiagnosticCard`
- **Badge** — `Badge`, `StatusBadge` (online, offline, recording, saving, paused, warning, error, success), `Chip`
- **StatusIndicator** — estado único do motor: idle, buffering, recording, saving, encoding, uploading, completed, warning, error
- **Progress** — `ProgressBar, Meter, Gauge, RadialGauge, Sparkline`
- **Charts** — `BarChart`, `AreaChart`
- **Inputs** — `Field, TextInput, SelectInput, ToggleField, SliderField, HotkeyInput, Segmented`
- **Player** — `MediaPlayer` (vídeo, timeline, controles, metadados)
- **Navegação** — `Sidebar, MobileNav, Topbar`
- **Overlays** — `DSDialog, DSDropdown, DSContextMenu, DSTooltip`, `notify`
- **Feedback** — `Loading, Skeleton, SkeletonCard, SkeletonMedia, EmptyState, ErrorState`
- **CoreOrb** — orbe do motor de captura

## Exemplos

```tsx
// Dashboard
<MetricCard icon={HardDrive} label="Armazenamento" value="128 GB" tone="blue" />
<CoreOrb state="buffering" intensity={1.2} size={180} burstKey={burst} />
<Gauge label="CPU" value="34%" percent={34} tone="purple" />
<AreaChart values={fps} tone="green" label="FPS" />

// Biblioteca
<MediaCard title={clip.title} subtitle={clip.game} accent={clip.accent} onPlay={...} />
<EmptyState icon={Film} title="Nenhum clipe" hint="Pressione o atalho no jogo." />

// Player
<MediaPlayer title={clip.title} src={url} accent={clip.accent}
  meta={[{ label: "Codec", value: clip.codec }]} onOpenLocal={open} />

// Configurações
<Field label="Buffer">
  <Segmented value={buffer} options={bufferOptions} onChange={setBuffer} />
</Field>
<HotkeyInput value={hotkey} onChange={setHotkey} />

// Diagnóstico
<DiagnosticCard title="Encoder NVENC" status="completed" detail="H.264 / HEVC" />
<StatusIndicator status="encoding" />
```

## Regras

1. Nenhuma cor literal, nenhum keyframe local, nenhum estilo inline de cor.
2. Ícones apenas via `Icon` (ou props `icon` dos componentes).
3. Estados sempre via `StatusIndicator` / `StatusBadge`.
4. O Design System é puramente apresentacional — regras de negócio ficam em
   `src/hooks`, `src/services` e no backend Rust.
