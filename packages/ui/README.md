Shared UI layer.

The approved ClipCore components (AppShell, dashboard cards, library grid,
settings panels) live in `/src/components` and are consumed by both the desktop
shell and the web preview. This package exists as the extraction target once a
second app needs the same components independently.
