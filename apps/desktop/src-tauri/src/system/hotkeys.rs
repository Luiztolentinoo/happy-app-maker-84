use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::errors::{ClipCoreError, Result};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HotkeyAction {
    SaveClip,
    ToggleSessionRecording,
    Marker,
    Screenshot,
    ToggleMicrophone,
    ToggleOverlay,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HotkeyBinding {
    pub action: HotkeyAction,
    pub combo: String,
    pub enabled: bool,
    /// Optional per-game profile this binding belongs to.
    pub profile_id: Option<String>,
}

/// Combos the OS or ClipCore reserves; registering them is rejected.
pub const RESERVED_COMBOS: &[&str] = &[
    "Ctrl+Alt+Delete",
    "Ctrl+Shift+Escape",
    "Alt+Tab",
    "Alt+F4",
    "Super+L",
];

pub fn default_bindings() -> Vec<HotkeyBinding> {
    vec![
        (HotkeyAction::SaveClip, "F8"),
        (HotkeyAction::ToggleSessionRecording, "F9"),
        (HotkeyAction::Marker, "F10"),
        (HotkeyAction::Screenshot, "F7"),
        (HotkeyAction::ToggleMicrophone, "Ctrl+M"),
        (HotkeyAction::ToggleOverlay, "Shift+F8"),
    ]
    .into_iter()
    .map(|(action, combo)| HotkeyBinding { action, combo: combo.into(), enabled: true, profile_id: None })
    .collect()
}

/// Global hotkey registration contract. Only enabled, non-conflicting and
/// non-reserved combos are ever registered with the OS.
pub trait HotkeyRegistrar: Send + Sync {
    fn register(&mut self, binding: &HotkeyBinding) -> Result<()>;
    fn unregister(&mut self, combo: &str) -> Result<()>;
    fn unregister_all(&mut self) -> Result<()>;
}

#[derive(Debug, Default)]
pub struct HotkeyManager {
    bindings: HashMap<HotkeyAction, HotkeyBinding>,
    registered: Vec<String>,
}

impl HotkeyManager {
    pub fn new() -> Self {
        let mut manager = Self::default();
        for binding in default_bindings() {
            manager.bindings.insert(binding.action, binding);
        }
        manager
    }

    pub fn bindings(&self) -> Vec<HotkeyBinding> {
        let mut list: Vec<HotkeyBinding> = self.bindings.values().cloned().collect();
        list.sort_by_key(|b| b.combo.clone());
        list
    }

    pub fn restore_defaults(&mut self) {
        self.bindings.clear();
        for binding in default_bindings() {
            self.bindings.insert(binding.action, binding);
        }
    }

    fn normalize(combo: &str) -> String {
        combo.replace(' ', "").to_ascii_lowercase()
    }

    pub fn is_reserved(combo: &str) -> bool {
        RESERVED_COMBOS.iter().any(|r| Self::normalize(r) == Self::normalize(combo))
    }

    pub fn conflict(&self, action: HotkeyAction, combo: &str) -> Option<HotkeyAction> {
        self.bindings
            .values()
            .find(|b| b.action != action && Self::normalize(&b.combo) == Self::normalize(combo))
            .map(|b| b.action)
    }

    /// Validates and stores a binding. Registration with the OS happens through
    /// a `HotkeyRegistrar` so tests stay platform independent.
    pub fn set(&mut self, action: HotkeyAction, combo: &str, enabled: bool) -> Result<HotkeyBinding> {
        if combo.trim().is_empty() {
            return Err(ClipCoreError::Io("empty hotkey combo".into()));
        }
        if Self::is_reserved(combo) {
            return Err(ClipCoreError::ReservedHotkey { combo: combo.into() });
        }
        if let Some(other) = self.conflict(action, combo) {
            return Err(ClipCoreError::HotkeyConflict { combo: format!("{combo} (used by {other:?})") });
        }
        let binding = HotkeyBinding { action, combo: combo.to_string(), enabled, profile_id: None };
        self.bindings.insert(action, binding.clone());
        Ok(binding)
    }

    pub fn disable(&mut self, action: HotkeyAction) -> Result<()> {
        let binding = self
            .bindings
            .get_mut(&action)
            .ok_or_else(|| ClipCoreError::NotFound(format!("hotkey {action:?}")))?;
        binding.enabled = false;
        Ok(())
    }

    /// Combos that should actually be registered with the OS: enabled only.
    pub fn registrable(&self) -> Vec<HotkeyBinding> {
        self.bindings.values().filter(|b| b.enabled).cloned().collect()
    }

    pub fn mark_registered(&mut self, combos: Vec<String>) {
        self.registered = combos;
    }

    pub fn registered(&self) -> &[String] {
        &self.registered
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_match_spec() {
        let m = HotkeyManager::new();
        let save = m.bindings().into_iter().find(|b| b.action == HotkeyAction::SaveClip).unwrap();
        assert_eq!(save.combo, "F8");
        assert_eq!(m.bindings().len(), 6);
    }

    #[test]
    fn rejects_conflict() {
        let mut m = HotkeyManager::new();
        assert_eq!(m.set(HotkeyAction::Marker, "F8", true).unwrap_err().code(), "hotkey_conflict");
    }

    #[test]
    fn rejects_reserved() {
        let mut m = HotkeyManager::new();
        assert_eq!(m.set(HotkeyAction::Marker, "Alt+F4", true).unwrap_err().code(), "reserved_hotkey");
    }

    #[test]
    fn disabled_bindings_are_not_registrable() {
        let mut m = HotkeyManager::new();
        m.disable(HotkeyAction::Screenshot).unwrap();
        assert!(!m.registrable().iter().any(|b| b.action == HotkeyAction::Screenshot));
    }

    #[test]
    fn restore_defaults_resets_changes() {
        let mut m = HotkeyManager::new();
        m.set(HotkeyAction::SaveClip, "F6", true).unwrap();
        m.restore_defaults();
        let save = m.bindings().into_iter().find(|b| b.action == HotkeyAction::SaveClip).unwrap();
        assert_eq!(save.combo, "F8");
    }
}
