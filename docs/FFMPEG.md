# FFmpeg sidecar

ClipCore uses FFmpeg only for segment concatenation, thumbnails and exports.

## Placement

Put the Windows binary here:

```
apps/desktop/src-tauri/binaries/ffmpeg-x86_64-pc-windows-msvc.exe
```

The target-triple suffix is required by Tauri's `externalBin`. `scripts/fetch-ffmpeg.ps1`
does this in CI when the `FFMPEG_URL` repository variable points to an authorized build.

## Rules

- The installer ships the binary. The app never downloads FFmpeg silently at runtime.
- The path is resolved next to the executable only, never from `PATH`.
- A SHA-256 is written next to the binary and can be enforced by `FfmpegSidecar::new(path, Some(sha))`.
- Arguments are always passed as a separated argv list — never through a shell string.

## Licensing

FFmpeg is licensed under LGPL-2.1+ (GPL for some builds). Ship an LGPL build,
include the FFmpeg license text in the installer, and state any changes made.
GPL builds would force ClipCore itself to be GPL — do not bundle those.
