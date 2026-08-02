//! ClipCore desktop backend.
//!
//! The crate is split into four layers:
//! - `capture`: capture engine, state machine, circular buffer, encoders.
//! - `system`: game detection, global hotkeys, storage, devices, performance.
//! - `database`: local SQLite schema, migrations and repositories.
//! - `media`: FFmpeg sidecar, thumbnails and exports.

pub mod capture;
pub mod commands;
pub mod database;
pub mod errors;
pub mod events;
pub mod media;
pub mod runtime;
pub mod state;
pub mod system;

pub use errors::{ClipCoreError, Result};
pub use state::AppState;

/// Builds and runs the Tauri application.
pub fn run() {
    tracing_subscriber::fmt().with_env_filter("info").init();

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .setup(|app| {
            let state = AppState::bootstrap(app.handle())?;
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_capture_state,
            commands::start_buffer,
            commands::stop_buffer,
            commands::save_retroactive_clip,
            commands::start_session_recording,
            commands::stop_session_recording,
            commands::pause_recording,
            commands::resume_recording,
            commands::list_capture_sources,
            commands::list_audio_devices,
            commands::list_encoders,
            commands::detect_games,
            commands::get_storage_status,
            commands::update_capture_settings,
            commands::register_hotkey,
            commands::unregister_hotkey,
            commands::run_native_diagnostics,
            commands::generate_thumbnail,
            commands::list_local_clips,
            commands::rename_clip,
            commands::favorite_clip,
            commands::delete_clip,
            commands::restore_clip,
            commands::export_clip,
            commands::get_installation_report,
            commands::repair_installation,
            commands::check_for_update,
            commands::download_update,
            commands::install_update,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ClipCore");
}
