# CineSnap

CineSnap is an Electron app for fast LUT preview, grading, snapshotting, and exporting.

## Key Behavior (Updated)

- `P` captures a **snapshot image** (JPEG frame), not a video export.
- `Cmd/Ctrl+Up` jumps to previous saved snapshot timestamp.
- `Cmd/Ctrl+Down` jumps to next saved snapshot timestamp.
- Export button exports **videos** from the playlist (full clips).
- Grading is **per video** (Lightroom-style): each clip stores its own grade profile.
- Per-video grade profiles are persisted across restarts.
- New videos start with neutral grade (no adjustments).
- Grade supports **Copy / Paste / Reset** for quickly matching looks between clips.

## Export Workflow (Updated)

- Export target is controlled per clip in the Files tab (checkboxes + `All / None / Current`).
- Export button is selection-aware and disabled when nothing is selected.
- `Smart LUT Apply on Export` setting:
  - `rec709` clips: LUT skipped
  - `rec709` in `BT.2020` clips: LUT skipped
  - `hlg` clips: LUT applied
  - `s-log3` / `apple-log` clips: LUT applied
  - `unknown` clips: asks every time per clip
- If a clip has no LUT and no grade changes, export skips processing for that clip.
- Auto-clear after export removes successfully exported clips from playlist.

## Quick Start

```bash
npm install
npm run dev
```

## Build

```bash
npm run build:mac
npm run build:win
npm run build:linux
```

## Validation

```bash
npm run typecheck
node --test tests/*.mjs
```

## Stack

- Electron + React + TypeScript
- Tailwind CSS
- WebGL/GLSL rendering
- Zustand state management

## License

MIT
