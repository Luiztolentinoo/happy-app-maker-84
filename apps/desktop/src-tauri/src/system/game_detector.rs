use serde::{Deserialize, Serialize};

use crate::errors::Result;
use crate::system::processes::{MockProcessInspector, ProcessInspector};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedGame {
    pub id: String,
    pub name: String,
    pub executable: String,
    pub pid: Option<u32>,
    pub running: bool,
    pub fullscreen: bool,
    /// Per-game profile id, when the user configured one.
    pub profile_id: Option<String>,
}

/// Matches running processes against the known-games list.
pub trait GameDetector: Send + Sync {
    fn known_executables(&self) -> Vec<String>;
    fn detect(&self) -> Result<Vec<DetectedGame>>;
    fn active_game(&self) -> Result<Option<DetectedGame>>;
}

pub struct ProcessGameDetector {
    inspector: Box<dyn ProcessInspector>,
    known: Vec<String>,
}

impl ProcessGameDetector {
    pub fn new(known: Vec<String>) -> Self {
        Self { inspector: Box::new(MockProcessInspector), known }
    }

    pub fn default_known() -> Vec<String> {
        vec![
            "valorant.exe".into(),
            "cs2.exe".into(),
            "leagueoflegends.exe".into(),
            "fortniteclient-win64-shipping.exe".into(),
            "javaw.exe".into(),
            "dota2.exe".into(),
            "r5apex.exe".into(),
            "eldenring.exe".into(),
        ]
    }

    fn normalize(name: &str) -> String {
        name.to_ascii_lowercase()
    }
}

impl GameDetector for ProcessGameDetector {
    fn known_executables(&self) -> Vec<String> {
        self.known.clone()
    }

    fn detect(&self) -> Result<Vec<DetectedGame>> {
        let procs = self.inspector.list()?;
        Ok(procs
            .into_iter()
            .filter(|p| self.known.contains(&Self::normalize(&p.name)))
            .map(|p| DetectedGame {
                id: Self::normalize(&p.name),
                name: p.name.trim_end_matches(".exe").to_string(),
                executable: p.executable,
                pid: Some(p.pid),
                running: true,
                fullscreen: p.fullscreen,
                profile_id: None,
            })
            .collect())
    }

    fn active_game(&self) -> Result<Option<DetectedGame>> {
        let fg = self.inspector.foreground()?;
        Ok(fg.and_then(|p| {
            if self.known.contains(&Self::normalize(&p.name)) {
                Some(DetectedGame {
                    id: Self::normalize(&p.name),
                    name: p.name.trim_end_matches(".exe").to_string(),
                    executable: p.executable,
                    pid: Some(p.pid),
                    running: true,
                    fullscreen: p.fullscreen,
                    profile_id: None,
                })
            } else {
                None
            }
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mock_inspector_yields_no_games() {
        let d = ProcessGameDetector::new(ProcessGameDetector::default_known());
        assert!(d.detect().unwrap().is_empty());
        assert!(!d.known_executables().is_empty());
    }
}
