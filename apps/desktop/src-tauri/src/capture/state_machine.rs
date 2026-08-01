use serde::{Deserialize, Serialize};

use crate::errors::{ClipCoreError, Result};

/// Every lifecycle state of the capture pipeline.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CaptureState {
    Idle,
    Detecting,
    Buffering,
    RecordingSession,
    SavingClip,
    Paused,
    Degraded,
    Error,
    ShuttingDown,
}

impl CaptureState {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Idle => "idle",
            Self::Detecting => "detecting",
            Self::Buffering => "buffering",
            Self::RecordingSession => "recording_session",
            Self::SavingClip => "saving_clip",
            Self::Paused => "paused",
            Self::Degraded => "degraded",
            Self::Error => "error",
            Self::ShuttingDown => "shutting_down",
        }
    }
}

/// Guarded state machine. Invalid transitions return `InvalidTransition`
/// instead of silently mutating state.
#[derive(Debug)]
pub struct CaptureStateMachine {
    state: CaptureState,
    previous: Option<CaptureState>,
    reason: Option<String>,
}

impl Default for CaptureStateMachine {
    fn default() -> Self {
        Self::new()
    }
}

impl CaptureStateMachine {
    pub fn new() -> Self {
        Self { state: CaptureState::Idle, previous: None, reason: None }
    }

    pub fn state(&self) -> CaptureState {
        self.state
    }

    pub fn reason(&self) -> Option<&str> {
        self.reason.as_deref()
    }

    pub fn can_transition(&self, to: CaptureState) -> bool {
        use CaptureState::*;
        if to == ShuttingDown || to == Error {
            return self.state != ShuttingDown;
        }
        match (self.state, to) {
            (Idle, Detecting) | (Idle, Buffering) => true,
            (Detecting, Buffering) | (Detecting, Idle) => true,
            (Buffering, RecordingSession)
            | (Buffering, SavingClip)
            | (Buffering, Paused)
            | (Buffering, Degraded)
            | (Buffering, Idle) => true,
            (RecordingSession, SavingClip)
            | (RecordingSession, Paused)
            | (RecordingSession, Degraded)
            | (RecordingSession, Buffering)
            | (RecordingSession, Idle) => true,
            // Saving a clip never stops the buffer: it returns to the state it
            // came from once the segments are flushed.
            (SavingClip, Buffering) | (SavingClip, RecordingSession) | (SavingClip, Degraded) => true,
            (Paused, Buffering) | (Paused, RecordingSession) | (Paused, Idle) => true,
            (Degraded, Buffering) | (Degraded, Idle) | (Degraded, SavingClip) => true,
            (Error, Idle) => true,
            _ => false,
        }
    }

    pub fn transition(&mut self, to: CaptureState) -> Result<CaptureState> {
        if !self.can_transition(to) {
            return Err(ClipCoreError::InvalidTransition {
                from: self.state.as_str().into(),
                to: to.as_str().into(),
            });
        }
        self.previous = Some(self.state);
        self.state = to;
        if to != CaptureState::Degraded && to != CaptureState::Error {
            self.reason = None;
        }
        Ok(self.state)
    }

    pub fn degrade(&mut self, reason: impl Into<String>) -> Result<CaptureState> {
        self.reason = Some(reason.into());
        self.transition(CaptureState::Degraded)
    }

    pub fn fail(&mut self, reason: impl Into<String>) -> Result<CaptureState> {
        self.reason = Some(reason.into());
        self.transition(CaptureState::Error)
    }

    /// State the machine was in before the current one, used to resume after
    /// `SavingClip`.
    pub fn previous(&self) -> Option<CaptureState> {
        self.previous
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn starts_idle() {
        assert_eq!(CaptureStateMachine::new().state(), CaptureState::Idle);
    }

    #[test]
    fn valid_happy_path() {
        let mut m = CaptureStateMachine::new();
        m.transition(CaptureState::Detecting).unwrap();
        m.transition(CaptureState::Buffering).unwrap();
        m.transition(CaptureState::SavingClip).unwrap();
        m.transition(CaptureState::Buffering).unwrap();
        m.transition(CaptureState::RecordingSession).unwrap();
        m.transition(CaptureState::Idle).unwrap();
        assert_eq!(m.state(), CaptureState::Idle);
    }

    #[test]
    fn rejects_invalid_transition() {
        let mut m = CaptureStateMachine::new();
        let err = m.transition(CaptureState::SavingClip).unwrap_err();
        assert_eq!(err.code(), "invalid_transition");
        assert_eq!(m.state(), CaptureState::Idle);
    }

    #[test]
    fn degraded_keeps_reason_and_recovers() {
        let mut m = CaptureStateMachine::new();
        m.transition(CaptureState::Buffering).unwrap();
        m.degrade("encoder fell back to software").unwrap();
        assert_eq!(m.state(), CaptureState::Degraded);
        assert!(m.reason().is_some());
        m.transition(CaptureState::Buffering).unwrap();
        assert!(m.reason().is_none());
    }

    #[test]
    fn error_recovers_only_to_idle() {
        let mut m = CaptureStateMachine::new();
        m.fail("device lost").unwrap();
        assert!(m.transition(CaptureState::Buffering).is_err());
        m.transition(CaptureState::Idle).unwrap();
    }

    #[test]
    fn shutdown_is_terminal() {
        let mut m = CaptureStateMachine::new();
        m.transition(CaptureState::ShuttingDown).unwrap();
        assert!(m.transition(CaptureState::Idle).is_err());
    }
}
