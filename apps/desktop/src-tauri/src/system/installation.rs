//! Verificação de integridade da instalação e reparos seguros.
//!
//! Toda a lógica é `std`-only e testável: recebe caminhos e devolve um relatório.
//! Nada aqui apaga vídeos do usuário — apenas caches e artefatos internos.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::errors::{ClipCoreError, Result};

/// Marcador gravado nos diretórios criados pelo ClipCore.
/// Só diretórios marcados podem ser removidos por um reparo/desinstalação.
pub const OWNED_MARKER: &str = ".clipcore-owned";

/// Sidecars obrigatórios, com o nome exato empacotado pelo instalador.
pub const REQUIRED_SIDECARS: [&str; 2] = ["ffmpeg", "ffprobe"];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum CheckStatus {
    Ok,
    Warning,
    Error,
}

#[derive(Debug, Clone, Serialize)]
pub struct InstallationCheck {
    pub id: String,
    pub label: String,
    pub status: CheckStatus,
    pub detail: String,
    pub action: Option<String>,
    pub repairable: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct InstallationReport {
    pub generated_at: String,
    pub version: String,
    pub channel: String,
    pub identifier: String,
    pub signed: bool,
    pub install_dir: Option<String>,
    pub data_dir: Option<String>,
    pub logs_dir: Option<String>,
    pub checks: Vec<InstallationCheck>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RepairAction {
    RestoreSidecars,
    RestoreShortcuts,
    RebuildConfig,
    RunMigrations,
    ValidateDatabase,
    ClearCache,
    RebuildIndex,
}

#[derive(Debug, Clone, Serialize)]
pub struct RepairOutcome {
    pub action: RepairAction,
    pub ok: bool,
    pub message: String,
}

fn check(
    id: &str,
    label: &str,
    status: CheckStatus,
    detail: impl Into<String>,
    action: Option<&str>,
    repairable: bool,
) -> InstallationCheck {
    InstallationCheck {
        id: id.into(),
        label: label.into(),
        status,
        detail: detail.into(),
        action: action.map(|a| a.into()),
        repairable,
    }
}

/// Nome de arquivo do sidecar dentro do diretório de instalação.
pub fn sidecar_file_name(name: &str) -> String {
    if cfg!(windows) {
        format!("{name}.exe")
    } else {
        name.to_string()
    }
}

/// Um sidecar só é aceito quando está ao lado do executável instalado.
/// Nunca resolvemos pelo `PATH`.
pub fn sidecar_path(install_dir: &Path, name: &str) -> PathBuf {
    install_dir.join(sidecar_file_name(name))
}

/// Verifica sidecars, banco, diretórios de dados e permissão de escrita.
pub fn inspect(install_dir: &Path, data_dir: &Path, db_file: &Path) -> Vec<InstallationCheck> {
    let mut checks = Vec::new();

    for name in REQUIRED_SIDECARS {
        let path = sidecar_path(install_dir, name);
        checks.push(if path.is_file() {
            check(
                name,
                name,
                CheckStatus::Ok,
                format!("Encontrado em {}", path.display()),
                None,
                false,
            )
        } else {
            check(
                name,
                name,
                CheckStatus::Error,
                format!("{} ausente na instalação.", sidecar_file_name(name)),
                Some("Reparar instalação (restaurar componentes)"),
                true,
            )
        });
    }

    checks.push(if data_dir.is_dir() {
        check(
            "data_dir",
            "Diretório de dados",
            CheckStatus::Ok,
            data_dir.display().to_string(),
            None,
            false,
        )
    } else {
        check(
            "data_dir",
            "Diretório de dados",
            CheckStatus::Error,
            "Diretório de dados ausente.",
            Some("Reparar instalação (recriar configuração)"),
            true,
        )
    });

    checks.push(if db_file.is_file() {
        check(
            "database",
            "Banco local",
            CheckStatus::Ok,
            db_file.display().to_string(),
            None,
            false,
        )
    } else {
        check(
            "database",
            "Banco local",
            CheckStatus::Warning,
            "Banco será criado na próxima inicialização.",
            Some("Executar migrations"),
            true,
        )
    });

    checks.push(match writable(data_dir) {
        true => check(
            "writable",
            "Permissão de escrita",
            CheckStatus::Ok,
            "Gravação no diretório de dados confirmada.",
            None,
            false,
        ),
        false => check(
            "writable",
            "Permissão de escrita",
            CheckStatus::Error,
            "Sem permissão de escrita no diretório de dados.",
            Some("Verificar permissões da pasta do usuário"),
            false,
        ),
    });

    // Nada mutável pode morar dentro do diretório de instalação.
    checks.push(if data_dir.starts_with(install_dir) {
        check(
            "separation",
            "Separação instalação/dados",
            CheckStatus::Error,
            "Dados do usuário estão dentro do diretório de instalação.",
            Some("Mover dados para %APPDATA%"),
            false,
        )
    } else {
        check(
            "separation",
            "Separação instalação/dados",
            CheckStatus::Ok,
            "Dados e instalação separados.",
            None,
            false,
        )
    });

    checks
}

fn writable(dir: &Path) -> bool {
    if !dir.is_dir() {
        return false;
    }
    let probe = dir.join(".clipcore-write-probe");
    let ok = std::fs::write(&probe, b"ok").is_ok();
    let _ = std::fs::remove_file(&probe);
    ok
}

/// Marca um diretório como pertencente ao ClipCore (desinstalação segura).
pub fn mark_owned(dir: &Path) -> Result<()> {
    std::fs::create_dir_all(dir)?;
    std::fs::write(dir.join(OWNED_MARKER), b"clipcore")?;
    Ok(())
}

pub fn is_owned(dir: &Path) -> bool {
    dir.join(OWNED_MARKER).is_file()
}

/// Remove o conteúdo de um diretório somente se ele for do ClipCore.
/// Recusa qualquer caminho não marcado — vídeos nunca são apagados por engano.
pub fn purge_owned(dir: &Path) -> Result<u64> {
    if !dir.is_dir() {
        return Ok(0);
    }
    if !is_owned(dir) {
        return Err(ClipCoreError::Io(format!(
            "{} não é um diretório do ClipCore: remoção recusada",
            dir.display()
        )));
    }
    let mut removed = 0;
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        if entry.file_name() == OWNED_MARKER {
            continue;
        }
        let path = entry.path();
        let meta = entry.metadata()?;
        if meta.is_dir() {
            std::fs::remove_dir_all(&path)?;
        } else {
            removed += meta.len();
            std::fs::remove_file(&path)?;
        }
    }
    Ok(removed)
}

/// Ações destrutivas exigem confirmação explícita na interface.
pub fn is_destructive(action: RepairAction) -> bool {
    matches!(action, RepairAction::ClearCache | RepairAction::RebuildIndex)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_sidecar_is_repairable_error() {
        let tmp = tempfile::tempdir().unwrap();
        let checks = inspect(tmp.path(), tmp.path(), &tmp.path().join("clipcore.db"));
        let ffmpeg = checks.iter().find(|c| c.id == "ffmpeg").unwrap();
        assert_eq!(ffmpeg.status, CheckStatus::Error);
        assert!(ffmpeg.repairable);
    }

    #[test]
    fn data_inside_install_dir_is_flagged() {
        let tmp = tempfile::tempdir().unwrap();
        let data = tmp.path().join("data");
        std::fs::create_dir_all(&data).unwrap();
        let checks = inspect(tmp.path(), &data, &data.join("clipcore.db"));
        let sep = checks.iter().find(|c| c.id == "separation").unwrap();
        assert_eq!(sep.status, CheckStatus::Error);
    }

    #[test]
    fn purge_refuses_unmarked_directory() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::write(tmp.path().join("video.mp4"), b"data").unwrap();
        assert!(purge_owned(tmp.path()).is_err());
        assert!(tmp.path().join("video.mp4").is_file());
    }

    #[test]
    fn purge_clears_marked_directory_only() {
        let tmp = tempfile::tempdir().unwrap();
        mark_owned(tmp.path()).unwrap();
        std::fs::write(tmp.path().join("a.tmp"), b"12345").unwrap();
        assert_eq!(purge_owned(tmp.path()).unwrap(), 5);
        assert!(is_owned(tmp.path()));
    }

    #[test]
    fn sidecar_is_resolved_next_to_executable() {
        let dir = PathBuf::from("/opt/clipcore");
        assert_eq!(sidecar_path(&dir, "ffmpeg"), dir.join(sidecar_file_name("ffmpeg")));
    }

    #[test]
    fn destructive_actions_are_marked() {
        assert!(is_destructive(RepairAction::ClearCache));
        assert!(is_destructive(RepairAction::RebuildIndex));
        assert!(!is_destructive(RepairAction::RunMigrations));
    }
}
