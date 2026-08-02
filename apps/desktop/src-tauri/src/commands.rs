use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

use crate::capture::audio::AudioDeviceInfo;
use crate::capture::clip_writer::{ClipWriter, FfmpegClipWriter};
use crate::capture::diagnostics::{DiagnosticReport, DiagnosticRunner, NativeDiagnosticRunner};
use crate::capture::encoder::{available_encoders, EncoderInfo};
use crate::capture::engine::{CaptureEngine, CaptureSettings, CaptureStatus};
use crate::capture::source::CaptureSourceInfo;
use crate::capture::state_machine::CaptureState;
use crate::database::models::{ClipRecord, NewClip};
use crate::database::repositories::{ClipRepository, HotkeyRepository};
use crate::errors::{ClipCoreError, Result};
use crate::events::{self, CaptureStateEvent, ClipSavedEvent};
use crate::media::export::{ExportRequest, Exporter, FfmpegExporter};
use crate::media::ffmpeg::FfmpegSidecar;
use crate::media::thumbnail::{FfmpegThumbnailGenerator, ThumbnailGenerator};
use crate::state::AppState;
use crate::system::devices::{DeviceManager, SystemDeviceManager};
use crate::system::game_detector::{DetectedGame, GameDetector, ProcessGameDetector};
use crate::system::hotkeys::{HotkeyAction, HotkeyBinding};
use crate::system::installation::{
    self, InstallationReport, RepairAction, RepairOutcome,
};
use crate::system::storage::StorageStatus;

fn emit_state(app: &AppHandle, state: &State<'_, AppState>) {
    let status = state.engine.lock().status();
    events::emit(
        app,
        events::names::CAPTURE_STATE,
        CaptureStateEvent {
            state: status.state,
            buffer_seconds: status.buffer_seconds,
            game: None,
            degraded_reason: status.degraded_reason,
        },
    );
}

#[tauri::command]
pub fn get_capture_state(state: State<'_, AppState>) -> Result<CaptureStatus> {
    Ok(state.engine.lock().status())
}

#[tauri::command]
pub fn start_buffer(app: AppHandle, state: State<'_, AppState>) -> Result<CaptureStatus> {
    state.engine.lock().start_buffer()?;
    let status = state.engine.lock().status();
    let _ = state.machine.lock().transition(status.state);
    emit_state(&app, &state);
    Ok(status)
}

#[tauri::command]
pub fn stop_buffer(app: AppHandle, state: State<'_, AppState>) -> Result<CaptureStatus> {
    state.engine.lock().stop_buffer()?;
    let _ = state.machine.lock().transition(CaptureState::Idle);
    emit_state(&app, &state);
    Ok(state.engine.lock().status())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveClipArgs {
    pub seconds: u32,
    pub title: Option<String>,
    pub game: Option<String>,
}

#[tauri::command]
pub fn save_retroactive_clip(
    app: AppHandle,
    state: State<'_, AppState>,
    args: SaveClipArgs,
) -> Result<ClipRecord> {
    let (segments, settings, clips_dir) = {
        let mut engine = state.engine.lock();
        let segments = engine.save_retroactive(args.seconds)?;
        let settings = engine.settings();
        let dir = engine.clips_dir().clone();
        (segments, settings, dir)
    };

    let ffmpeg = FfmpegSidecar::resolve()?;
    let writer = FfmpegClipWriter::new(ffmpeg);
    let output = clips_dir.join(format!("clipcore-{}.mp4", chrono::Utc::now().timestamp()));
    let written = writer.write(&segments, &output);

    // Release the pinned segments regardless of the write outcome so the buffer
    // never leaks disk space.
    let ids: Vec<u64> = segments.iter().map(|s| s.id).collect();
    state.engine.lock().buffer_mut().unpin(&ids)?;
    let written = written?;

    let record = ClipRepository::new(&state.database).insert(&NewClip {
        title: args.title.unwrap_or_else(|| "Clipe retroativo".into()),
        game: args.game,
        file_path: written.path.to_string_lossy().into(),
        duration_ms: written.duration_ms,
        width: settings.width,
        height: settings.height,
        fps: settings.fps,
        codec: "h264".into(),
        file_size: written.bytes,
        clip_type: "retroactive".into(),
    })?;

    events::emit(
        &app,
        events::names::CLIP_SAVED,
        ClipSavedEvent {
            id: record.id.clone(),
            path: record.file_path.clone(),
            duration_ms: record.duration_ms,
        },
    );
    emit_state(&app, &state);
    Ok(record)
}

#[tauri::command]
pub fn start_session_recording(app: AppHandle, state: State<'_, AppState>) -> Result<CaptureStatus> {
    state.engine.lock().start_session()?;
    let _ = state.machine.lock().transition(CaptureState::RecordingSession);
    emit_state(&app, &state);
    Ok(state.engine.lock().status())
}

#[tauri::command]
pub fn stop_session_recording(app: AppHandle, state: State<'_, AppState>) -> Result<CaptureStatus> {
    state.engine.lock().stop_session()?;
    let _ = state.machine.lock().transition(CaptureState::Buffering);
    emit_state(&app, &state);
    Ok(state.engine.lock().status())
}

#[tauri::command]
pub fn pause_recording(app: AppHandle, state: State<'_, AppState>) -> Result<CaptureStatus> {
    state.engine.lock().pause()?;
    let _ = state.machine.lock().transition(CaptureState::Paused);
    emit_state(&app, &state);
    Ok(state.engine.lock().status())
}

#[tauri::command]
pub fn resume_recording(app: AppHandle, state: State<'_, AppState>) -> Result<CaptureStatus> {
    state.engine.lock().resume()?;
    let _ = state.machine.lock().transition(CaptureState::Buffering);
    emit_state(&app, &state);
    Ok(state.engine.lock().status())
}

#[tauri::command]
pub fn list_capture_sources(state: State<'_, AppState>) -> Result<Vec<CaptureSourceInfo>> {
    state.engine.lock().list_sources()
}

#[tauri::command]
pub fn list_audio_devices() -> Result<Vec<AudioDeviceInfo>> {
    SystemDeviceManager.audio_devices()
}

#[tauri::command]
pub fn list_encoders() -> Result<Vec<EncoderInfo>> {
    Ok(available_encoders())
}

#[tauri::command]
pub fn detect_games() -> Result<Vec<DetectedGame>> {
    ProcessGameDetector::new(ProcessGameDetector::default_known()).detect()
}

#[tauri::command]
pub fn get_storage_status(state: State<'_, AppState>) -> Result<StorageStatus> {
    state.storage.status()
}

#[tauri::command]
pub fn update_capture_settings(
    app: AppHandle,
    state: State<'_, AppState>,
    settings: CaptureSettings,
) -> Result<CaptureStatus> {
    state.engine.lock().update_settings(settings)?;
    emit_state(&app, &state);
    Ok(state.engine.lock().status())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisterHotkeyArgs {
    pub action: HotkeyAction,
    pub combo: String,
    pub enabled: bool,
}

#[tauri::command]
pub fn register_hotkey(
    state: State<'_, AppState>,
    args: RegisterHotkeyArgs,
) -> Result<HotkeyBinding> {
    let binding = state.hotkeys.lock().set(args.action, &args.combo, args.enabled)?;
    HotkeyRepository::new(&state.database).upsert(
        &serde_json::to_string(&args.action).unwrap_or_default().replace('"', ""),
        None,
        &binding.combo,
        binding.enabled,
    )?;
    Ok(binding)
}

#[tauri::command]
pub fn unregister_hotkey(state: State<'_, AppState>, action: HotkeyAction) -> Result<()> {
    state.hotkeys.lock().disable(action)
}

#[tauri::command]
pub fn run_native_diagnostics(state: State<'_, AppState>) -> Result<DiagnosticReport> {
    let report = NativeDiagnosticRunner { ffmpeg: FfmpegSidecar::resolve()? }.run()?;
    let _ = state.database.with_conn(|c| {
        c.execute(
            "INSERT INTO diagnostics (id, generated_at, report_json) VALUES (?1, ?2, ?3)",
            rusqlite::params![
                uuid::Uuid::new_v4().to_string(),
                report.generated_at,
                serde_json::to_string(&report).unwrap_or_default()
            ],
        )?;
        Ok(())
    });
    Ok(report)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThumbnailArgs {
    pub clip_id: String,
    pub at_ms: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ThumbnailResult {
    pub path: String,
}

#[tauri::command]
pub fn generate_thumbnail(state: State<'_, AppState>, args: ThumbnailArgs) -> Result<ThumbnailResult> {
    let clip = ClipRepository::new(&state.database).get(&args.clip_id)?;
    let generator = FfmpegThumbnailGenerator::new(FfmpegSidecar::resolve()?);
    let output = state.data_dir.join("thumbnails").join(format!("{}.jpg", clip.id));
    if let Some(parent) = output.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let path = generator.generate(&PathBuf::from(&clip.file_path), &output, args.at_ms)?;
    Ok(ThumbnailResult { path: path.to_string_lossy().into() })
}

#[tauri::command]
pub fn list_local_clips(
    state: State<'_, AppState>,
    include_deleted: Option<bool>,
) -> Result<Vec<ClipRecord>> {
    ClipRepository::new(&state.database).list(include_deleted.unwrap_or(false))
}

#[tauri::command]
pub fn rename_clip(state: State<'_, AppState>, id: String, title: String) -> Result<ClipRecord> {
    if title.trim().is_empty() {
        return Err(ClipCoreError::Io("title cannot be empty".into()));
    }
    ClipRepository::new(&state.database).rename(&id, title.trim())
}

#[tauri::command]
pub fn favorite_clip(state: State<'_, AppState>, id: String, favorite: bool) -> Result<ClipRecord> {
    ClipRepository::new(&state.database).set_favorite(&id, favorite)
}

#[tauri::command]
pub fn delete_clip(state: State<'_, AppState>, id: String) -> Result<()> {
    ClipRepository::new(&state.database).soft_delete(&id)
}

#[tauri::command]
pub fn restore_clip(state: State<'_, AppState>, id: String) -> Result<ClipRecord> {
    ClipRepository::new(&state.database).restore(&id)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportClipArgs {
    pub clip_id: String,
    pub start_ms: u64,
    pub end_ms: u64,
    pub width: Option<u32>,
    pub bitrate_kbps: Option<u32>,
    pub mute: Option<bool>,
}

#[tauri::command]
pub fn export_clip(state: State<'_, AppState>, args: ExportClipArgs) -> Result<String> {
    if args.end_ms <= args.start_ms {
        return Err(ClipCoreError::Io("export window is empty".into()));
    }
    let clip = ClipRepository::new(&state.database).get(&args.clip_id)?;
    let clip_path = PathBuf::from(&clip.file_path);
    let output = crate::media::export::default_output(&clip_path, "export");
    let exporter = FfmpegExporter::new(FfmpegSidecar::resolve()?);
    let path = exporter.export(&ExportRequest {
        clip_path,
        output_path: output,
        start_ms: args.start_ms,
        end_ms: args.end_ms,
        width: args.width,
        bitrate_kbps: args.bitrate_kbps,
        mute: args.mute.unwrap_or(false),
    })?;
    Ok(path.to_string_lossy().into())
}

// ------------------------------------------------------- instalação e atualização

fn install_dir() -> Option<PathBuf> {
    std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(|p| p.to_path_buf()))
}

/// Relatório de integridade consumido pelo Centro de Diagnóstico.
#[tauri::command]
pub fn get_installation_report(state: State<'_, AppState>) -> Result<InstallationReport> {
    let dir = install_dir();
    let data_dir = state.data_dir.clone();
    let checks = match &dir {
        Some(d) => installation::inspect(d, &data_dir, &data_dir.join("clipcore.db")),
        None => Vec::new(),
    };
    Ok(InstallationReport {
        generated_at: chrono::Utc::now().to_rfc3339(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        channel: "alpha".into(),
        identifier: "com.clipcore.desktop".into(),
        // Nenhum artefato é assinado ainda: ver docs/CODE_SIGNING.md.
        signed: false,
        install_dir: dir.map(|d| d.to_string_lossy().into_owned()),
        data_dir: Some(data_dir.to_string_lossy().into_owned()),
        logs_dir: Some(state.data_dir.join("logs").to_string_lossy().into_owned()),
        checks,
    })
}

/// Executa um reparo. Ações destrutivas devem ser confirmadas na interface
/// antes da chamada; aqui apenas diretórios do próprio ClipCore são tocados.
#[tauri::command]
pub fn repair_installation(
    state: State<'_, AppState>,
    action: RepairAction,
) -> Result<RepairOutcome> {
    let message = match action {
        RepairAction::ClearCache => {
            let dir = state.data_dir.join("cache");
            installation::mark_owned(&dir)?;
            let bytes = installation::purge_owned(&dir)?;
            format!("Cache limpo ({bytes} bytes).")
        }
        RepairAction::RunMigrations => {
            state.database.migrate()?;
            "Migrations aplicadas.".to_string()
        }
        RepairAction::ValidateDatabase => {
            state.database.migrate()?;
            "Banco íntegro.".to_string()
        }
        RepairAction::RebuildConfig => {
            std::fs::create_dir_all(&state.data_dir)?;
            installation::mark_owned(&state.data_dir.join("cache"))?;
            "Configuração recriada com valores padrão para campos ausentes.".to_string()
        }
        RepairAction::RestoreSidecars => {
            return Err(ClipCoreError::NotImplemented(
                "restaurar sidecars exige reinstalar o ClipCore: o app nunca baixa binários em runtime"
                    .into(),
            ))
        }
        RepairAction::RestoreShortcuts => {
            return Err(ClipCoreError::NotImplemented(
                "recriar atalhos é feito pelo instalador (modo reparo)".into(),
            ))
        }
        RepairAction::RebuildIndex => {
            return Err(ClipCoreError::NotImplemented(
                "reconstrução do índice da biblioteca ainda não implementada".into(),
            ))
        }
    };
    Ok(RepairOutcome { action, ok: true, message })
}

/// O updater permanece desativado enquanto as chaves de assinatura não existirem.
/// Falhar explicitamente é melhor que simular uma verificação.
#[tauri::command]
pub fn check_for_update() -> Result<()> {
    Err(ClipCoreError::NotImplemented(
        "updater desativado: chaves de assinatura ausentes (docs/UPDATER.md)".into(),
    ))
}

#[tauri::command]
pub fn download_update() -> Result<()> {
    Err(ClipCoreError::NotImplemented(
        "download de atualização exige release assinada".into(),
    ))
}

#[tauri::command]
pub fn install_update() -> Result<()> {
    Err(ClipCoreError::NotImplemented(
        "instalação de atualização exige release assinada".into(),
    ))
}
