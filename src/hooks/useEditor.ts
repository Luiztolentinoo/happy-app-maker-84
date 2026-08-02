/**
 * useEditor — estado reativo do editor.
 *
 * Concentra projeto, histórico (undo/redo), autosave com debounce, playhead e
 * exportação. A UI só despacha operações declarativas; nenhuma regra de edição
 * vive nos componentes.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorHistory } from "@/editor/history";
import { estimateExportBytes, estimateExportMs, resolveExportSettings } from "@/editor/presets";
import { computeDurationMs, snap, timelineToSource, validateTimeline } from "@/editor/timeline";
import type {
  EditProject,
  EditorOperation,
  ExportJob,
  ExportSettings,
  Timeline,
} from "@/editor/types";
import {
  applyProjectOperation,
  autosaveEditProject,
  cancelExport,
  createEditProject,
  discardRecovery,
  editorRuntime,
  generateAudioWaveform,
  listExportJobs,
  onExportProgress,
  pendingRecovery,
  restoreEditProject,
  startExport,
  validateSourceMedia,
} from "@/services/editorService";
import type { Clip } from "@/lib/clipcore";
import { notify } from "@ds";

const AUTOSAVE_DEBOUNCE_MS = 900;

export type EditorStatus = "idle" | "loading" | "ready" | "error";

export interface UseEditorResult {
  status: EditorStatus;
  error: string | null;
  project: EditProject | null;
  timeline: Timeline | null;
  durationMs: number;
  runtime: ReturnType<typeof editorRuntime>;
  saving: boolean;
  lastSavedAt: string | null;
  problems: string[];
  waveform: number[];
  sourceAvailable: boolean | null;
  sourceReason: string | null;
  recoveryAvailable: boolean;
  historyLabels: string[];
  canUndo: boolean;
  canRedo: boolean;
  playheadMs: number;
  sourcePlayheadMs: number | null;
  dispatch: (operation: EditorOperation) => void;
  setPlayhead: (ms: number, options?: { snap?: boolean }) => void;
  setZoom: (zoom: number) => void;
  setSelection: (ids: string[]) => void;
  undo: () => void;
  redo: () => void;
  rename: (title: string) => void;
  updateExportSettings: (patch: Partial<ExportSettings>) => void;
  applyExportPreset: (presetId: string) => void;
  estimatedBytes: number;
  estimatedMs: number;
  jobs: ExportJob[];
  exporting: boolean;
  runExport: () => Promise<void>;
  abortExport: (jobId: string) => Promise<void>;
  acceptRecovery: () => Promise<void>;
  dismissRecovery: () => void;
}

export function useEditor(clip: Clip | undefined): UseEditorResult {
  const [status, setStatus] = useState<EditorStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<EditProject | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [waveform, setWaveform] = useState<number[]>([]);
  const [sourceAvailable, setSourceAvailable] = useState<boolean | null>(null);
  const [sourceReason, setSourceReason] = useState<string | null>(null);
  const [recoveryAvailable, setRecoveryAvailable] = useState(false);
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [historyVersion, setHistoryVersion] = useState(0);

  const historyRef = useRef<EditorHistory | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runtime = useMemo(() => editorRuntime(), []);

  /* ------------------------------------------------------------- carregamento */

  useEffect(() => {
    if (!clip) {
      setProject(null);
      setStatus("idle");
      return;
    }
    let active = true;
    setStatus("loading");
    setError(null);

    void (async () => {
      try {
        const loaded = await createEditProject({ clip });
        if (!active) return;
        historyRef.current = new EditorHistory(loaded.timeline);
        setProject(loaded);
        setRecoveryAvailable(pendingRecovery(loaded.id) !== null);
        setStatus("ready");

        const [media, wave] = await Promise.all([
          validateSourceMedia(loaded.source),
          generateAudioWaveform(loaded.id, 240),
        ]);
        if (!active) return;
        setSourceAvailable(media.available);
        setSourceReason(media.reason);
        setWaveform(wave);
      } catch (cause) {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : String(cause));
        setStatus("error");
      }
    })();

    return () => {
      active = false;
    };
  }, [clip?.id]);

  /* ---------------------------------------------------------------- autosave */

  const scheduleSave = useCallback((next: EditProject) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setSaving(true);
      void autosaveEditProject(next)
        .then((saved) => {
          setProject((current) => (current && current.id === saved.id ? { ...current, updatedAt: saved.updatedAt } : current));
          setLastSavedAt(saved.updatedAt);
          setRecoveryAvailable(false);
        })
        .catch((cause: unknown) => {
          notify.error(
            "Não foi possível salvar o projeto",
            cause instanceof Error ? cause.message : String(cause),
          );
        })
        .finally(() => setSaving(false));
    }, AUTOSAVE_DEBOUNCE_MS);
  }, []);

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  const commit = useCallback(
    (next: EditProject, options: { persist?: boolean } = {}) => {
      setProject(next);
      if (options.persist !== false) scheduleSave(next);
    },
    [scheduleSave],
  );

  /* -------------------------------------------------------------- operações */

  const dispatch = useCallback(
    (operation: EditorOperation) => {
      const history = historyRef.current;
      if (!history || !project) return;
      try {
        const next = applyProjectOperation(project, operation);
        history.push(operation, next.timeline);
        setHistoryVersion((v) => v + 1);
        commit(next);
      } catch (cause) {
        notify.error(
          "Operação não aplicada",
          cause instanceof Error ? cause.message : String(cause),
        );
      }
    },
    [commit, project],
  );

  /** Mudanças de viewport (playhead, zoom, seleção) não entram no histórico. */
  const patchTimeline = useCallback(
    (patch: Partial<Timeline>) => {
      const history = historyRef.current;
      if (!history || !project) return;
      const timeline = { ...project.timeline, ...patch };
      history.replace(timeline);
      commit({ ...project, timeline }, { persist: false });
    },
    [commit, project],
  );

  const setPlayhead = useCallback(
    (ms: number, options: { snap?: boolean } = {}) => {
      if (!project) return;
      const duration = computeDurationMs(project.timeline);
      const raw = Math.min(duration, Math.max(0, ms));
      patchTimeline({ playheadMs: options.snap ? snap(project.timeline, raw) : raw });
    },
    [patchTimeline, project],
  );

  const setZoom = useCallback(
    (zoom: number) => patchTimeline({ zoom: Math.min(400, Math.max(4, zoom)) }),
    [patchTimeline],
  );

  const setSelection = useCallback((ids: string[]) => patchTimeline({ selection: ids }), [patchTimeline]);

  const undo = useCallback(() => {
    const history = historyRef.current;
    if (!history || !project || !history.canUndo()) return;
    const timeline = history.undo();
    setHistoryVersion((v) => v + 1);
    commit({ ...project, timeline });
  }, [commit, project]);

  const redo = useCallback(() => {
    const history = historyRef.current;
    if (!history || !project || !history.canRedo()) return;
    const timeline = history.redo();
    setHistoryVersion((v) => v + 1);
    commit({ ...project, timeline });
  }, [commit, project]);

  const rename = useCallback(
    (title: string) => {
      if (!project) return;
      const clean = title.trim().slice(0, 160);
      if (!clean) return;
      commit({ ...project, title: clean });
    },
    [commit, project],
  );

  /* -------------------------------------------------------------- exportação */

  const updateExportSettings = useCallback(
    (patch: Partial<ExportSettings>) => {
      if (!project) return;
      commit({ ...project, exportSettings: { ...project.exportSettings, ...patch } });
    },
    [commit, project],
  );

  const applyExportPreset = useCallback(
    (presetId: string) => {
      if (!project) return;
      const settings = resolveExportSettings(presetId, project.source, {
        fileName: project.exportSettings.fileName,
        outputDir: project.exportSettings.outputDir,
      });
      commit({ ...project, exportSettings: settings });
    },
    [commit, project],
  );

  const refreshJobs = useCallback(() => {
    void listExportJobs().then(setJobs);
  }, []);

  useEffect(() => {
    refreshJobs();
    return onExportProgress(() => refreshJobs());
  }, [refreshJobs]);

  const runExport = useCallback(async () => {
    if (!project) return;
    try {
      const job = await startExport({ project });
      setJobs((current) => [job, ...current.filter((item) => item.id !== job.id)]);
      notify.info(
        runtime.simulatedExport ? "Exportação simulada iniciada" : "Exportação iniciada",
        runtime.simulatedExport
          ? "Nenhum arquivo é gravado no modo demonstração."
          : job.outputPath,
      );
    } catch (cause) {
      notify.error(
        "Exportação não iniciada",
        cause instanceof Error ? cause.message : String(cause),
      );
    }
  }, [project, runtime.simulatedExport]);

  const abortExport = useCallback(async (jobId: string) => {
    await cancelExport(jobId);
    void listExportJobs().then(setJobs);
  }, []);

  /* ------------------------------------------------------------- recuperação */

  const acceptRecovery = useCallback(async () => {
    if (!project) return;
    try {
      const restored = await restoreEditProject(project.id);
      if (restored) {
        historyRef.current = new EditorHistory(restored.timeline);
        setHistoryVersion((v) => v + 1);
        setProject(restored);
        notify.success("Sessão anterior recuperada");
      }
    } catch (cause) {
      notify.error(
        "Recuperação falhou",
        cause instanceof Error ? cause.message : String(cause),
      );
    } finally {
      setRecoveryAvailable(false);
    }
  }, [project]);

  const dismissRecovery = useCallback(() => {
    if (project) discardRecovery(project.id);
    setRecoveryAvailable(false);
  }, [project]);

  /* -------------------------------------------------------------- derivados */

  const timeline = project?.timeline ?? null;
  const durationMs = timeline ? computeDurationMs(timeline) : 0;
  const problems = useMemo(() => (timeline ? validateTimeline(timeline) : []), [timeline]);
  const exportSettings = project?.exportSettings;
  const estimatedBytes = exportSettings ? estimateExportBytes(exportSettings, durationMs) : 0;
  const estimatedMs = exportSettings ? estimateExportMs(exportSettings, durationMs) : 0;
  const exporting = jobs.some(
    (job) => job.stage !== "completed" && job.stage !== "failed" && job.stage !== "cancelled",
  );
  const history = historyRef.current;

  return {
    status,
    error,
    project,
    timeline,
    durationMs,
    runtime,
    saving,
    lastSavedAt,
    problems,
    waveform,
    sourceAvailable,
    sourceReason,
    recoveryAvailable,
    historyLabels: historyVersion >= 0 && history ? history.labels() : [],
    canUndo: Boolean(history?.canUndo()),
    canRedo: Boolean(history?.canRedo()),
    playheadMs: timeline?.playheadMs ?? 0,
    sourcePlayheadMs: timeline ? timelineToSource(timeline, timeline.playheadMs) : null,
    dispatch,
    setPlayhead,
    setZoom,
    setSelection,
    undo,
    redo,
    rename,
    updateExportSettings,
    applyExportPreset,
    estimatedBytes,
    estimatedMs,
    jobs,
    exporting,
    runExport,
    abortExport,
    acceptRecovery,
    dismissRecovery,
  };
}
