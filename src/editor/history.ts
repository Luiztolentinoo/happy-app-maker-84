/**
 * Histórico de edição (undo/redo).
 *
 * Guarda snapshots da timeline — que é só metadado — nunca vídeo. Ações
 * contínuas do mesmo tipo (arrastar um slider) são agrupadas por janela de
 * tempo para não poluir o histórico.
 */

import type { EditorHistoryEntry, EditorOperation, Timeline } from "./types";
import { OPERATION_LABELS, nextId } from "./timeline";

export interface HistoryOptions {
  /** Máximo de entradas retidas (o mais antigo é descartado). */
  limit?: number;
  /** Janela de agrupamento de ações contínuas, em ms. */
  groupWindowMs?: number;
  now?: () => number;
}

export interface HistoryState {
  past: EditorHistoryEntry[];
  future: EditorHistoryEntry[];
  present: Timeline;
}

/** Operações agrupáveis quando repetidas rapidamente sobre o mesmo alvo. */
const GROUPABLE: ReadonlySet<EditorOperation["kind"]> = new Set([
  "volume",
  "speed",
  "track_gain",
  "text_update",
  "aspect",
]);

export class EditorHistory {
  private past: EditorHistoryEntry[] = [];
  private future: EditorHistoryEntry[] = [];
  private present: Timeline;
  private readonly limit: number;
  private readonly groupWindowMs: number;
  private readonly now: () => number;

  constructor(initial: Timeline, options: HistoryOptions = {}) {
    this.present = initial;
    this.limit = Math.max(1, options.limit ?? 100);
    this.groupWindowMs = Math.max(0, options.groupWindowMs ?? 450);
    this.now = options.now ?? (() => Date.now());
  }

  state(): HistoryState {
    return { past: [...this.past], future: [...this.future], present: this.present };
  }

  current(): Timeline {
    return this.present;
  }

  canUndo(): boolean {
    return this.past.length > 0;
  }

  canRedo(): boolean {
    return this.future.length > 0;
  }

  /** Rótulos das últimas ações, do mais recente para o mais antigo. */
  labels(): string[] {
    return [...this.past].reverse().map((entry) => entry.label);
  }

  /**
   * Registra uma nova timeline resultante de `operation`. Sempre limpa o redo,
   * como manda o modelo linear de histórico.
   */
  push(operation: EditorOperation, next: Timeline): Timeline {
    const at = this.now();
    const last = this.past[this.past.length - 1];
    const groupable =
      last !== undefined &&
      GROUPABLE.has(operation.kind) &&
      last.operation.kind === operation.kind &&
      at - last.at <= this.groupWindowMs;

    if (!groupable) {
      this.past.push({
        id: nextId("hist"),
        label: OPERATION_LABELS[operation.kind] ?? operation.kind,
        operation,
        timeline: this.present,
        at,
      });
      if (this.past.length > this.limit) this.past.shift();
    } else if (last) {
      last.at = at;
      last.operation = operation;
    }

    this.future = [];
    this.present = next;
    return this.present;
  }

  /** Substitui a timeline sem criar entrada (playhead, zoom, seleção). */
  replace(next: Timeline): Timeline {
    this.present = next;
    return this.present;
  }

  undo(): Timeline {
    const entry = this.past.pop();
    if (!entry) return this.present;
    this.future.push({ ...entry, timeline: this.present });
    this.present = entry.timeline;
    return this.present;
  }

  redo(): Timeline {
    const entry = this.future.pop();
    if (!entry) return this.present;
    this.past.push({ ...entry, timeline: this.present });
    this.present = entry.timeline;
    return this.present;
  }

  reset(timeline: Timeline): void {
    this.past = [];
    this.future = [];
    this.present = timeline;
  }
}
