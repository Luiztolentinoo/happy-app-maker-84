Shared, framework-agnostic helpers used by both the desktop app and the web
preview (formatting, buffer math, hotkey normalization).

Current implementations still live in `/src/lib` so the approved UI keeps working
without churn; move helpers here as they become needed by more than one app.
