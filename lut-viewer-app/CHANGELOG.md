# Changelog

All notable changes to this project are documented in this file.

This changelog is based on:
- Git commit history in `lut-viewer-app` (`1eacd66`, `bf0a4f4`)
- Current unreleased working tree changes after `bf0a4f4`

## [1.1.0] - Unreleased

### Added
- Smart export planner with per-video selection (`All / None / Current`) and selection-aware Export button state.
- Smart color format detection for `rec709`, `rec709-bt2020`, `hlg`, `s-log3`, `apple-log`, and `unknown`.
- Per-video grading profiles (Lightroom-style), including Copy/Paste/Reset grading controls.
- Snapshot timeline marker utilities and keyboard navigation between timestamps:
  - `Cmd/Ctrl+Up` previous timestamp
  - `Cmd/Ctrl+Down` next timestamp
- Expanded test coverage for export planning, color grading, playback behavior, snapshot timeline, shortcuts, and UI states.

### Changed
- Export behavior now skips unnecessary processing when a clip has no LUT and no grade adjustments.
- Smart LUT export decisions now account for color format:
  - `rec709` and `rec709-bt2020` skip LUT
  - `hlg`, `s-log3`, `apple-log` apply LUT
  - `unknown` prompts per clip
- Export UX clarified around snapshot (`P`) vs video export workflows.
- Playback/transport UX polished (shuttle and timeline interactions).
- Timeline slider and marker visuals refined for cleaner alignment and less overlap at playhead.

### Fixed
- Snapshot marker deduplication, ordering, and normalization edge cases.
- Multiple small keyboard handling and timeline-jump edge cases around marker boundaries.

### Docs
- README updated with current export workflow, grading model, shortcut behavior, and validation commands.

## [1.0.0] - 2026-02-05

### Added
- Initial public release of LUT Studio (Electron + React + TypeScript).
- Core LUT preview pipeline with WebGL rendering.
- File drop/import flow and playlist-based video browsing.
- Snapshot capture and basic export pipeline.
- Base desktop packaging configuration and release assets.

