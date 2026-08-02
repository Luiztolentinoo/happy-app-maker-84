/**
 * Structured logging for the Capture Engine.
 *
 * Keeps a bounded in-memory ring so the Diagnostics screen can show recent
 * activity without touching the filesystem, mirrors entries to the console in
 * development, and republishes them on the event bus.
 */

import { engineBus, type EventBus } from "./eventBus";

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error";

const ORDER: Record<LogLevel, number> = { trace: 10, debug: 20, info: 30, warn: 40, error: 50 };

export interface LogEntry {
  at: number;
  level: LogLevel;
  scope: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface LoggerOptions {
  capacity?: number;
  minLevel?: LogLevel;
  bus?: EventBus;
  mirrorToConsole?: boolean;
  now?: () => number;
}

export class EngineLogger {
  private entries: LogEntry[] = [];
  private readonly capacity: number;
  private minLevel: LogLevel;
  private readonly bus: EventBus;
  private readonly mirror: boolean;
  private readonly now: () => number;

  constructor(options: LoggerOptions = {}) {
    this.capacity = options.capacity ?? 500;
    this.minLevel = options.minLevel ?? "debug";
    this.bus = options.bus ?? engineBus;
    this.mirror = options.mirrorToConsole ?? import.meta.env.DEV;
    this.now = options.now ?? (() => Date.now());
  }

  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  child(scope: string): ScopedLogger {
    return new ScopedLogger(this, scope);
  }

  log(level: LogLevel, scope: string, message: string, data?: Record<string, unknown>): void {
    if (ORDER[level] < ORDER[this.minLevel]) return;
    const entry: LogEntry = { at: this.now(), level, scope, message, ...(data ? { data } : {}) };
    this.entries.push(entry);
    if (this.entries.length > this.capacity)
      this.entries.splice(0, this.entries.length - this.capacity);
    if (this.mirror) {
      const line = `[clipcore:${scope}] ${message}`;
      if (level === "error") console.error(line, data ?? "");
      else if (level === "warn") console.warn(line, data ?? "");
      else console.info(line, data ?? "");
    }
    this.bus.emit("log:entry", { level, scope, message, at: entry.at });
  }

  /** Newest entries first, optionally filtered by minimum level. */
  recent(limit = 100, minLevel: LogLevel = "trace"): LogEntry[] {
    return this.entries
      .filter((entry) => ORDER[entry.level] >= ORDER[minLevel])
      .slice(-limit)
      .reverse();
  }

  clear(): void {
    this.entries = [];
  }
}

export class ScopedLogger {
  constructor(
    private readonly logger: EngineLogger,
    private readonly scope: string,
  ) {}

  trace(message: string, data?: Record<string, unknown>) {
    this.logger.log("trace", this.scope, message, data);
  }
  debug(message: string, data?: Record<string, unknown>) {
    this.logger.log("debug", this.scope, message, data);
  }
  info(message: string, data?: Record<string, unknown>) {
    this.logger.log("info", this.scope, message, data);
  }
  warn(message: string, data?: Record<string, unknown>) {
    this.logger.log("warn", this.scope, message, data);
  }
  error(message: string, data?: Record<string, unknown>) {
    this.logger.log("error", this.scope, message, data);
  }
}

export const engineLogger = new EngineLogger();
