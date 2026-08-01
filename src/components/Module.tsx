/**
 * Compatibilidade: os módulos visuais agora vivem no Design System (@ds).
 * Este arquivo apenas reexporta para não quebrar imports existentes.
 */
import { Badge, type Tone } from "@ds";
import type { ReactNode } from "react";

export { Module, Gauge } from "@ds";

/** Selo de status compacto (mapeia tons legados para os tokens do Design System). */
export function StatusChip({
  children,
  tone = "primary",
}: {
  children: ReactNode;
  tone?: "primary" | "electric" | "success" | "warning" | "destructive" | "muted";
}) {
  const map: Record<string, Tone> = {
    primary: "purple",
    electric: "blue",
    success: "green",
    warning: "yellow",
    destructive: "red",
    muted: "muted",
  };
  return <Badge tone={map[tone] ?? "purple"}>{children}</Badge>;
}
