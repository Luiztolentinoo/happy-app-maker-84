/**
 * editorService — único ponto de contato do editor com persistência,
 * FFmpeg e Tauri.
 *
 * No desktop: comandos Tauri + SQLite. No navegador: os MESMOS contratos, com
 * um repositório de localStorage e uma exportação SIMULADA (nenhum arquivo é
 * gerado). Nenhum componente chama localStorage nem invoke diretamente.
 */

import {
  DemoModeError,
  NATIVE_EVENTS,
  isDesktopRuntime,
  nativeInvoke,
  nativeListen,
  toNativeError,
} from "./nativeClient";
import { estimateExportMs, resolveExportSettings, sanitizeFileName } from "@/editor/presets";
import { buildExportPlan } from "@/editor/ffmpeg";
import {
  applyOperation,
  createTimeline,
  nextId,
  computeDurationMs,
  validateTimeline,
} from "@/editor/timeline";
import {
  PROJECT_FORMAT_VERSION,
  parseProject,
  type EditProject,
  type EditorOperation,
  type ExportJob,
  type ExportProgress,
  type ExportSettings,
  type SourceMedia,
  type Timeline,
} from "@/editor/types";
import type { Clip } from "@/lib/clipcore";

const STORAGE_KEY = "clipcore.editor.projects.v2";
const RECOVERY_KEY = "clipcore.editor.recovery.v2";

/** Eventos do editor — reutilizam o namespace `clipcore://` já existente. */
export const EDITOR_EVENTS = {
  projectSaved: "clipcore://editor-project-saved",
  exportStarted: "clipcore://export-started",
  exportProgress: "clipcore://export-progress",
  exportCompleted: "clipcore://export-completed",
  exportFailed: "clipcore://export-failed",
  exportCancelled: "clipcore://export-cancelled",
  thumbnailProgress: "clipcore://thumbnail-progress",
  waveformProgress: "clipcore://waveform-progress",
} as const;

export interface EditorRuntimeInfo {
  desktop: boolean;
  /** true quando a exportação é apenas simulada (navegador/preview). */
  simulatedExport: boolean;
  label: string;
}

export function editorRuntime(): EditorRuntimeInfo {
  const desktop = isDesktopRuntime();
  return {
    desktop,
    simulatedExport: !desktop,
    label: desktop ? "Renderização nativa (FFmpeg)" : "Exportação simulada — sem arquivo gerado",
  };
}

/* ---------------------------------------------------------------- repository */

function readStore(): Record<string, unknown> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function nowIso(): string {
  return new Date().toISOString();
}

function sourceFromClip(clip: Clip): SourceMedia {
  return {
    clipId: clip.id,
    path: `clips/${clip.id}.mp4`,
    durationMs: clip.durationMs,
    width: clip.width,
    height: clip.height,
    fps: clip.fps,
    codec: clip.codec,
    hasMicrophoneTrack: false,
    hasApplicationTrack: false,
    available: null,
  };
}

export interface CreateProjectInput {
  clip: Clip;
  title?: string;
}

/** Cria (ou recupera) o projeto de um clipe. O clipe original fica intacto. */
export async function createEditProject(input: CreateProjectInput): Promise<EditProject> {
  const existing = await findProjectByClip(input.clip.id);
  if (existing) return touchProject(existing);

  const source = sourceFromClip(input.clip);
  const timeline = createTimeline({
    durationMs: source.durationMs,
    hasMicrophoneTrack: source.hasMicrophoneTrack,
    hasApplicationTrack: source.hasApplicationTrack,
  });
  const project: EditProject = {
    version: PROJECT_FORMAT_VERSION,
    id: nextId("proj"),
    title: input.title?.trim() || input.clip.title,
    sourceClipId: input.clip.id,
    source,
    timeline,
    exportSettings: resolveExportSettings("original", source, {
      fileName: sanitizeFileName(`${input.clip.title}-editado`),
    }),
    thumbnail: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    lastOpenedAt: nowIso(),
  };

  return nativeInvoke<EditProject>("create_edit_project", { project }, () => {
    const store = readStore();
    store[project.id] = project;
    writeStore(store);
    return project;
  });
}

export async function getEditProject(id: string): Promise<EditProject | null> {
  const raw = await nativeInvoke<unknown>(
    "get_edit_project",
    { id },
    () => readStore()[id] ?? null,
  );
  if (!raw) return null;
  const parsed = parseProject(raw);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.project;
}

export async function listEditProjects(): Promise<EditProject[]> {
  const raw = await nativeInvoke<unknown[]>("list_edit_projects", undefined, () =>
    Object.values(readStore()),
  );
  return raw
    .map((item) => parseProject(item))
    .flatMap((result) => (result.ok ? [result.project] : []))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function findProjectByClip(clipId: string): Promise<EditProject | null> {
  const projects = await listEditProjects();
  return projects.find((project) => project.sourceClipId === clipId) ?? null;
}

export async function updateEditProject(project: EditProject): Promise<EditProject> {
  const next: EditProject = { ...project, updatedAt: nowIso(), version: PROJECT_FORMAT_VERSION };
  const parsed = parseProject(next);
  if (!parsed.ok) throw new Error(`Projeto inválido: ${parsed.error}`);
  return nativeInvoke<EditProject>("update_edit_project", { project: parsed.project }, () => {
    const store = readStore();
    store[next.id] = parsed.project;
    writeStore(store);
    return parsed.project;
  });
}

/** Autosave com snapshot de recuperação — nunca sobrescreve com dado inválido. */
export async function autosaveEditProject(project: EditProject): Promise<EditProject> {
  const problems = validateTimeline(project.timeline);
  writeRecoverySnapshot(project, problems);
  if (problems.length > 0) throw new Error(problems[0]!);
  const saved = await updateEditProject(project);
  clearRecoverySnapshot(project.id);
  return saved;
}

async function touchProject(project: EditProject): Promise<EditProject> {
  return updateEditProject({ ...project, lastOpenedAt: nowIso() });
}

export async function deleteEditProject(id: string): Promise<void> {
  await nativeInvoke<void>("delete_edit_project", { id }, () => {
    const store = readStore();
    delete store[id];
    writeStore(store);
  });
  clearRecoverySnapshot(id);
}

export async function duplicateEditProject(id: string): Promise<EditProject> {
  const source = await getEditProject(id);
  if (!source) throw new Error("Projeto não encontrado.");
  const copy: EditProject = {
    ...source,
    id: nextId("proj"),
    title: `${source.title} (cópia)`,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    lastOpenedAt: nowIso(),
  };
  return nativeInvoke<EditProject>("duplicate_edit_project", { id, project: copy }, () => {
    const store = readStore();
    store[copy.id] = copy;
    writeStore(store);
    return copy;
  });
}

/* ------------------------------------------------------------------ recovery */

export interface RecoverySnapshot {
  projectId: string;
  project: EditProject;
  at: string;
  problems: string[];
}

function readRecovery(): Record<string, RecoverySnapshot> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(RECOVERY_KEY) ?? "{}") as Record<
      string,
      RecoverySnapshot
    >;
  } catch {
    return {};
  }
}

function writeRecoverySnapshot(project: EditProject, problems: string[]): void {
  if (typeof window === "undefined") return;
  const store = readRecovery();
  store[project.id] = { projectId: project.id, project, at: nowIso(), problems };
  window.localStorage.setItem(RECOVERY_KEY, JSON.stringify(store));
}

function clearRecoverySnapshot(projectId: string): void {
  if (typeof window === "undefined") return;
  const store = readRecovery();
  delete store[projectId];
  window.localStorage.setItem(RECOVERY_KEY, JSON.stringify(store));
}

/** Snapshot pendente = a sessão anterior terminou antes do save concluir. */
export function pendingRecovery(projectId: string): RecoverySnapshot | null {
  return readRecovery()[projectId] ?? null;
}

export async function restoreEditProject(projectId: string): Promise<EditProject | null> {
  const snapshot = pendingRecovery(projectId);
  if (!snapshot) return null;
  const parsed = parseProject(snapshot.project);
  if (!parsed.ok) {
    clearRecoverySnapshot(projectId);
    throw new Error(`Snapshot de recuperação corrompido: ${parsed.error}`);
  }
  const saved = await updateEditProject(parsed.project);
  clearRecoverySnapshot(projectId);
  return saved;
}

export function discardRecovery(projectId: string): void {
  clearRecoverySnapshot(projectId);
}

/* ---------------------------------------------------------------- operations */

/** Aplica uma operação ao projeto (sem persistir): usado pelos hooks. */
export function applyProjectOperation(
  project: EditProject,
  operation: EditorOperation,
): EditProject {
  const timeline = applyOperation(project.timeline, operation);
  return { ...project, timeline };
}

export function projectDurationMs(timeline: Timeline): number {
  return computeDurationMs(timeline);
}

/* -------------------------------------------------------------------- export */

const simulatedJobs = new Map<string, { job: ExportJob; timer: ReturnType<typeof setInterval> }>();
const progressListeners = new Set<(progress: ExportProgress) => void>();

function emitProgress(progress: ExportProgress): void {
  for (const listener of progressListeners) listener(progress);
}

export interface StartExportInput {
  project: EditProject;
  settings?: Partial<ExportSettings>;
}

/**
 * Inicia a exportação. No desktop delega ao Rust/FFmpeg com o plano validado;
 * no navegador roda um job simulado (claramente marcado com `simulated: true`).
 */
export async function startExport(input: StartExportInput): Promise<ExportJob> {
  const project: EditProject = input.settings
    ? { ...input.project, exportSettings: { ...input.project.exportSettings, ...input.settings } }
    : input.project;

  const problems = validateTimeline(project.timeline);
  if (problems.length > 0) throw new Error(problems[0]!);
  // Valida caminhos/argumentos ANTES de tocar no backend.
  const plan = buildExportPlan(project);

  if (isDesktopRuntime()) {
    return nativeInvoke<ExportJob>("start_export", {
      projectId: project.id,
      settings: project.exportSettings,
      plan: { argv: plan.argv, outputPath: plan.outputPath },
    });
  }

  const job: ExportJob = {
    id: nextId("job"),
    projectId: project.id,
    outputPath: plan.outputPath,
    presetId: project.exportSettings.presetId,
    progress: 0,
    stage: "queued",
    simulated: true,
    startedAt: nowIso(),
    completedAt: null,
    error: null,
    cancellable: true,
    etaMs: estimateExportMs(project.exportSettings, plan.durationMs),
  };

  const stages: ExportJob["stage"][] = ["preparing", "rendering", "encoding", "finalizing"];
  let ticks = 0;
  const timer = setInterval(() => {
    const entry = simulatedJobs.get(job.id);
    if (!entry) return;
    ticks += 1;
    const progress = Math.min(1, ticks / 20);
    const stage =
      progress >= 1 ? "completed" : stages[Math.min(stages.length - 1, Math.floor(progress * 4))]!;
    entry.job = {
      ...entry.job,
      progress,
      stage,
      completedAt: progress >= 1 ? nowIso() : null,
      cancellable: progress < 1,
      etaMs: progress >= 1 ? 0 : Math.round((job.etaMs ?? 0) * (1 - progress)),
    };
    emitProgress({ jobId: job.id, stage, progress, etaMs: entry.job.etaMs });
    if (progress >= 1) {
      clearInterval(entry.timer);
      simulatedJobs.delete(job.id);
      completedJobs.set(job.id, entry.job);
    }
  }, 220);

  simulatedJobs.set(job.id, { job, timer });
  emitProgress({ jobId: job.id, stage: "queued", progress: 0, etaMs: job.etaMs });
  return job;
}

const completedJobs = new Map<string, ExportJob>();

export async function cancelExport(jobId: string): Promise<ExportJob | null> {
  if (isDesktopRuntime()) return nativeInvoke<ExportJob>("cancel_export", { jobId });
  const entry = simulatedJobs.get(jobId);
  if (!entry) return completedJobs.get(jobId) ?? null;
  clearInterval(entry.timer);
  simulatedJobs.delete(jobId);
  const cancelled: ExportJob = {
    ...entry.job,
    stage: "cancelled",
    cancellable: false,
    completedAt: nowIso(),
  };
  completedJobs.set(jobId, cancelled);
  emitProgress({ jobId, stage: "cancelled", progress: cancelled.progress, etaMs: 0 });
  return cancelled;
}

export async function getExportStatus(jobId: string): Promise<ExportJob | null> {
  if (isDesktopRuntime()) return nativeInvoke<ExportJob | null>("get_export_status", { jobId });
  return simulatedJobs.get(jobId)?.job ?? completedJobs.get(jobId) ?? null;
}

export async function listExportJobs(): Promise<ExportJob[]> {
  if (isDesktopRuntime()) return nativeInvoke<ExportJob[]>("list_export_jobs");
  return [
    ...[...simulatedJobs.values()].map((entry) => entry.job),
    ...[...completedJobs.values()],
  ].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function removeExportJob(jobId: string): void {
  completedJobs.delete(jobId);
}

/** Assina o progresso; devolve o cleanup (usado pelos hooks no unmount). */
export function onExportProgress(listener: (progress: ExportProgress) => void): () => void {
  progressListeners.add(listener);
  let disposeNative: (() => void) | null = null;
  let disposed = false;
  if (isDesktopRuntime()) {
    void nativeListen(EDITOR_EVENTS.exportProgress, (payload) => {
      listener(payload as ExportProgress);
    }).then((dispose) => {
      if (disposed) dispose();
      else disposeNative = dispose;
    });
  }
  return () => {
    disposed = true;
    progressListeners.delete(listener);
    disposeNative?.();
  };
}

export async function revealExportInFolder(path: string): Promise<void> {
  await nativeInvoke<void>("reveal_export_in_folder", { path }, () => {
    throw new DemoModeError("reveal_export_in_folder");
  });
}

/** Verifica se o arquivo original ainda existe e é legível. */
export async function validateSourceMedia(
  source: SourceMedia,
): Promise<{ available: boolean; reason: string | null }> {
  try {
    return await nativeInvoke<{ available: boolean; reason: string | null }>(
      "validate_source_media",
      { path: source.path },
      () => ({ available: false, reason: "Modo demonstração: nenhum arquivo local verificado." }),
    );
  } catch (error) {
    return { available: false, reason: toNativeError(error).message };
  }
}

export async function generateTimelineThumbnails(
  projectId: string,
  count: number,
): Promise<string[]> {
  return nativeInvoke<string[]>("generate_timeline_thumbnails", { projectId, count }, () => []);
}

export async function generateAudioWaveform(projectId: string, buckets: number): Promise<number[]> {
  return nativeInvoke<number[]>("generate_audio_waveform", { projectId, buckets }, () => {
    // Waveform simulada e determinística — identificada como tal na UI.
    return Array.from({ length: buckets }, (_, i) =>
      Math.abs(Math.sin(i * 0.37) * 0.6 + Math.sin(i * 0.11) * 0.4),
    );
  });
}

export const CAPTURE_EVENTS = NATIVE_EVENTS;
