/**
 * Painel de propriedades do editor: recorte, velocidade, áudio, proporção,
 * textos e exportação. Só emite operações declarativas.
 */

import { useMemo, useState } from "react";
import { Crop, Download, Gauge, Plus, Scissors, Trash2, Type, Volume2 } from "lucide-react";
import {
  Badge,
  Button,
  Field,
  Panel,
  ProgressBar,
  SectionTitle,
  Segmented,
  SliderField,
  TextInput,
} from "@ds";
import { formatDuration } from "@/lib/clipcore";
import { ASPECT_PRESET_LIST, EXPORT_PRESETS, FIT_MODE_LABELS } from "@/editor/presets";
import { nextId } from "@/editor/timeline";
import type { AspectFitMode, AspectRatioPreset, ExportJob, Timeline } from "@/editor/types";
import type { UseEditorResult } from "@/hooks/useEditor";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

function selectedSegment(timeline: Timeline) {
  const track = timeline.tracks.find((item) => item.type === "video");
  if (!track) return undefined;
  const id = timeline.selection[0];
  return track.segments.find((segment) => segment.id === id) ?? track.segments[0];
}

export function EditorProperties({ editor }: { editor: UseEditorResult }) {
  const { timeline, project, dispatch, playheadMs, durationMs } = editor;
  const [overlayText, setOverlayText] = useState("");

  const segment = useMemo(() => (timeline ? selectedSegment(timeline) : undefined), [timeline]);

  if (!timeline || !project) return null;

  return (
    <div className="space-y-5">
      <Panel level={2} className="space-y-4 p-5">
        <SectionTitle icon={Scissors} title="Recorte" hint="Não destrutivo" />
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => dispatch({ kind: "trim", edge: "start", atMs: playheadMs })}
          >
            Início aqui
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => dispatch({ kind: "trim", edge: "end", atMs: playheadMs })}
          >
            Fim aqui
          </Button>
          <Button size="sm" variant="secondary" onClick={() => dispatch({ kind: "split", atMs: playheadMs })}>
            Cortar
          </Button>
          <Button
            size="sm"
            variant="danger"
            icon={Trash2}
            disabled={!segment}
            onClick={() => segment && dispatch({ kind: "remove", segmentIds: [segment.id] })}
          >
            Remover
          </Button>
        </div>
        <p className="text-xs text-ink-muted">
          Duração final · <span className="font-mono text-ink-secondary">{formatDuration(durationMs)}</span>
        </p>
      </Panel>

      {segment ? (
        <Panel level={2} className="space-y-4 p-5">
          <SectionTitle icon={Gauge} title="Trecho selecionado" />
          <SliderField
            label="Velocidade"
            value={segment.speed}
            min={0.25}
            max={4}
            step={0.05}
            format={(value) => `${value.toFixed(2)}x`}
            onChange={(speed) => dispatch({ kind: "speed", segmentIds: [segment.id], speed })}
          />
          <SliderField
            label="Volume"
            value={segment.volume}
            min={0}
            max={2}
            step={0.05}
            format={(value) => `${Math.round(value * 100)}%`}
            onChange={(volume) => dispatch({ kind: "volume", segmentIds: [segment.id], volume })}
          />
          <Button
            size="sm"
            variant={segment.muted ? "primary" : "secondary"}
            icon={Volume2}
            onClick={() => dispatch({ kind: "mute", segmentIds: [segment.id], muted: !segment.muted })}
          >
            {segment.muted ? "Reativar áudio" : "Silenciar trecho"}
          </Button>
        </Panel>
      ) : null}

      <Panel level={2} className="space-y-4 p-5">
        <SectionTitle icon={Crop} title="Proporção" hint="Redes sociais" />
        <Segmented<AspectRatioPreset>
          label="Formato"
          value={timeline.crop.aspect}
          options={ASPECT_PRESET_LIST.map((preset) => ({ value: preset.id, label: preset.label }))}
          onChange={(aspect) => dispatch({ kind: "aspect", patch: { aspect } })}
        />
        <Segmented<AspectFitMode>
          label="Ajuste"
          value={timeline.crop.fit}
          options={(Object.keys(FIT_MODE_LABELS) as AspectFitMode[]).map((fit) => ({
            value: fit,
            label: FIT_MODE_LABELS[fit],
          }))}
          onChange={(fit) => dispatch({ kind: "aspect", patch: { fit } })}
        />
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant={timeline.crop.safeAreas ? "primary" : "secondary"}
            onClick={() => dispatch({ kind: "aspect", patch: { safeAreas: !timeline.crop.safeAreas } })}
          >
            Safe areas
          </Button>
          <Button
            size="sm"
            variant={timeline.crop.grid ? "primary" : "secondary"}
            onClick={() => dispatch({ kind: "aspect", patch: { grid: !timeline.crop.grid } })}
          >
            Grade
          </Button>
        </div>
      </Panel>

      <Panel level={2} className="space-y-4 p-5">
        <SectionTitle icon={Type} title="Textos" hint={`${timeline.overlays.length} ativo(s)`} />
        <Field label="Novo texto">
          <div className="flex gap-2">
            <TextInput
              value={overlayText}
              maxLength={240}
              placeholder="Ex.: ACE 1v5"
              onChange={(event) => setOverlayText(event.target.value)}
            />
            <Button
              size="sm"
              icon={Plus}
              disabled={overlayText.trim().length === 0}
              onClick={() => {
                dispatch({
                  kind: "text_add",
                  overlay: {
                    id: nextId("txt"),
                    text: overlayText.trim().slice(0, 240),
                    startMs: playheadMs,
                    endMs: Math.min(durationMs, playheadMs + 2500),
                    x: 0.5,
                    y: 0.12,
                    fontSize: 48,
                    fontFamily: "display",
                    fontWeight: 700,
                    color: "#F4F7FF",
                    background: null,
                    align: "center",
                    opacity: 1,
                    fadeInMs: 180,
                    fadeOutMs: 180,
                    shadow: true,
                  },
                });
                setOverlayText("");
              }}
            >
              Add
            </Button>
          </div>
        </Field>
        {timeline.overlays.map((overlay) => (
          <div key={overlay.id} className="space-y-2 rounded-lg border border-border-primary p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm text-ink">{overlay.text}</span>
              <Button
                size="iconSm"
                variant="ghost"
                icon={Trash2}
                aria-label={`Remover ${overlay.text}`}
                onClick={() => dispatch({ kind: "text_remove", id: overlay.id })}
              />
            </div>
            <SliderField
              label="Tamanho"
              value={overlay.fontSize}
              min={8}
              max={160}
              onChange={(fontSize) => dispatch({ kind: "text_update", id: overlay.id, patch: { fontSize } })}
            />
            <SliderField
              label="Posição vertical"
              value={overlay.y}
              min={0}
              max={1}
              step={0.01}
              format={(value) => `${Math.round(value * 100)}%`}
              onChange={(y) => dispatch({ kind: "text_update", id: overlay.id, patch: { y } })}
            />
          </div>
        ))}
      </Panel>

      <ExportPanel editor={editor} />
    </div>
  );
}

function ExportPanel({ editor }: { editor: UseEditorResult }) {
  const { project, exporting, jobs, runExport, abortExport, applyExportPreset, updateExportSettings } = editor;
  if (!project) return null;
  const settings = project.exportSettings;

  return (
    <Panel level={3} className="space-y-4 p-5">
      <SectionTitle icon={Download} title="Exportar" hint={editor.runtime.label} />
      <Segmented<string>
        label="Preset"
        value={settings.presetId}
        options={EXPORT_PRESETS.map((preset) => ({ value: preset.id, label: preset.label }))}
        onChange={applyExportPreset}
      />
      <Field label="Nome do arquivo">
        <TextInput
          value={settings.fileName}
          maxLength={160}
          onChange={(event) => updateExportSettings({ fileName: event.target.value })}
        />
      </Field>
      <SliderField
        label="Bitrate de vídeo"
        value={settings.videoBitrateKbps}
        min={500}
        max={80_000}
        step={500}
        format={(value) => `${(value / 1000).toFixed(1)} Mbps`}
        onChange={(videoBitrateKbps) => updateExportSettings({ videoBitrateKbps })}
      />
      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-ink-muted">Resolução</dt>
          <dd className="font-mono text-ink-secondary">
            {settings.width}×{settings.height} · {settings.fps}fps
          </dd>
        </div>
        <div>
          <dt className="text-ink-muted">Tamanho estimado</dt>
          <dd className="font-mono text-ink-secondary">{formatBytes(editor.estimatedBytes)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Tempo estimado</dt>
          <dd className="font-mono text-ink-secondary">{formatDuration(editor.estimatedMs)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Codec</dt>
          <dd className="font-mono uppercase text-ink-secondary">{settings.videoCodec}</dd>
        </div>
      </dl>
      <Button
        variant="primary"
        icon={Download}
        className="w-full"
        disabled={exporting || editor.problems.length > 0}
        onClick={() => void runExport()}
      >
        {exporting ? "Exportando…" : "Exportar clipe"}
      </Button>
      {editor.runtime.simulatedExport ? (
        <p className="text-xs text-ink-muted">
          Modo demonstração: a fila roda a simulação completa, mas nenhum arquivo é gravado.
        </p>
      ) : null}
      <div className="space-y-2">
        {jobs.slice(0, 4).map((job) => (
          <JobRow key={job.id} job={job} onCancel={abortExport} />
        ))}
      </div>
    </Panel>
  );
}

function JobRow({ job, onCancel }: { job: ExportJob; onCancel: (id: string) => Promise<void> }) {
  const tone =
    job.stage === "failed" ? "red" : job.stage === "completed" ? "green" : job.stage === "cancelled" ? "amber" : "purple";
  return (
    <div className="space-y-1.5 rounded-lg border border-border-primary p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-mono text-[11px] text-ink-secondary">{job.outputPath}</span>
        <Badge tone={tone}>{job.stage}</Badge>
      </div>
      <ProgressBar percent={job.progress * 100} tone={tone} label={`Exportação ${job.stage}`} />
      {job.cancellable ? (
        <Button size="sm" variant="ghost" onClick={() => void onCancel(job.id)}>
          Cancelar
        </Button>
      ) : null}
    </div>
  );
}
