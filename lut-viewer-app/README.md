# CineSnap - Smart Log Video Viewer & Snapshot Tool

CineSnap is a specialized tool for video creators who shoot in Log (S-Log3, Apple Log, etc.). It acts as a lightweight, intelligent viewer that instantly normalizes flat footage for preview without the overhead of a full NLE.

Designed for specialized workflows:
- **Smart Log Viewer**: Automatically detects and corrects Log footage (S-Log3, Apple Log, HLG) for viewing.
- **Instant High-Res Snapshots**: Extract full-resolution photo snapshots (JPEGs) from your video frames with a single keystroke (`P`).
- **Look Comparison**: Apply and compare different LUTs or grades per clip to find the perfect look.
- **Batch Export**: Export clips with your baked-in look for quick sharing or client review.

## Key Features

- **Smart Preview**: Intelligent color space handing ensures your Log footage looks correct instantly.
- **Snapshot Workflow**:
  - `P`: Capture **high-res snapshot image** (JPEG frame) at current timecode.
  - `Cmd/Ctrl+Up/Down`: Jump between captured snapshot timestamps.
- **Grading & LUTs**:
  - Per-clip grading profiles (Exposure, Contrast, Saturation).
  - Support for custom LUTs (.cube).
  - Copy / Paste / Reset grades across clips.
- **Export Control**:
  - `Smart LUT Apply`: Automatically applies LUTs only to Log footage (Log/HLG) while skipping Rec.709 clips.
  - Selective export via checkboxes.

## Installation for Collaborators

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- Git

### Quick Start

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/vecyang1/CineSnap.git
    cd CineSnap/lut-viewer-app
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```

3.  **Run the app in development mode:**
    ```bash
    npm run dev
    ```
    The app window should appear shortly.

## Build for Distribution

To create a standalone application file (`.dmg`, `.exe`, `.AppImage`):

```bash
# macOS (Universal / Intel / Apple Silicon)
npm run build:mac

# Windows
npm run build:win

# Linux
npm run build:linux
```

The built application can be found in the `dist` or `release` folder (depending on configuration).

## Tech Stack

- **Core**: Electron, React, TypeScript
- **Styling**: Tailwind CSS
- **Performance**: WebGL/GLSL rendering, Zustand state management
- **Media**: FFmpeg (via fluent-ffmpeg/ffmpeg-static)

## License

MIT
