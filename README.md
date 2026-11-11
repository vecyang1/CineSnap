# CineSnap — Smart Log Video Viewer & Color Grading Snapshot Tool

[![Platform: macOS](https://img.shields.io/badge/Platform-macOS-000000?logo=apple)](https://github.com/vecyang1/CineSnap)
[![Engine: Electron & Vite](https://img.shields.io/badge/Engine-Electron%20%26%20Vite-47848F?logo=electron)](https://github.com/vecyang1/CineSnap)
[![Language: TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?logo=typescript)](https://github.com/vecyang1/CineSnap)
[![Tailwind CSS: v4](https://img.shields.io/badge/UI-Tailwind%20v4-38B2AC?logo=tailwindcss)](https://github.com/vecyang1/CineSnap)
[![Author: Vec Yang](https://img.shields.io/badge/Author-Vec%20Yang-419EFF)](https://vecyang.com)

CineSnap is a specialized macOS desktop tool for filmmakers, colorists, and video creators who shoot in Log formats (**Apple Log**, **Sony S-Log3**, **Canon C-Log**, **DJI D-Log**). It functions as a lightweight, intelligent "Quick Look" that instantly normalizes flat footage with .CUBE LUTs for side-by-side comparison, clip inspection, and instant frame snapshot exports.

---

## ⚡ Key Architecture & Features

- **Instant LUT Previewing**: Bypass heavy NLE startup times (Premiere Pro, DaVinci Resolve) to quickly audition creative .cube LUTs across video takes.
- **Hardware-Accelerated Playback**: Leverages Apple Silicon VideoToolbox and WebGL texture shaders for real-time 4K/60fps color transformation.
- **Apple Log & S-Log3 Intelligence**: Built-in normalization profiles for modern mobile and cinema workflows (iPhone 15/16 Pro Apple Log, Sony FX3/A7S3 S-Log3/S-Gamut3.Cine).
- **Pixel-Accurate Frame Snapshots**: Extract high-resolution still frames with embedded ColorSync ICC color profiles (Display P3 / sRGB).
- **Sandboxed Security & MAS Entitlements**: Designed for macOS App Store compliance with security-scoped bookmarks and strict permission boundaries.

---

## 📁 Repository Structure

```
├── lut-viewer-app/       # Production Electron + React application source
│   ├── src/main/         # Node.js Electron main process, VideoToolbox & ffmpeg runners
│   ├── src/preload/      # Context bridge and typesafe IPC channels
│   ├── src/renderer/     # React 19 UI, WebGL LUT shaders, Zustand store
│   └── MACOS_PUBLISHING.md # Direct distribution & Mac App Store build guide
├── marketing/            # Launch collateral, positioning, and monetization strategy
├── reference/            # Color space specifications, LUT benchmarks, and specs
└── web/                  # Web-based WebGL LUT preview engine
```

---

## 🚀 Quick Start

To run the application locally:

```bash
# 1. Navigate to application root
cd lut-viewer-app

# 2. Install dependencies
npm install

# 3. Launch live development environment
npm run dev
```

### Packaging & macOS Builds

```bash
# Build production macOS binary
npm run build:mac

# Unpacked directory inspection
npm run build:unpack
```

---

## 👤 Author & Architecture

Engineered by **[Vec Yang](https://vecyang.com)** ([@vecyang1](https://github.com/vecyang1))  
Digital Hub: [vecyang.com](https://vecyang.com) • [vecyang.com/#open-source](https://vecyang.com/#open-source)

## Agentic Usage and Distributed Contribution

> Agent接入后可自行推理, 也可以完善和提交回改进。

AI coding agents can autonomously reason over this repository and are welcomed to submit improvements back upstream.

- **Autonomous Reasoning**: Agents can inspect CLI flags, JSON schemas, and test contracts to reason and execute workflows without manual intervention.
- **Distributed Contribution**: When your agent fixes an edge case, adds an adapter, or improves a workflow in real-world usage, ask your agent to run the test suite and submit a Pull Request via `gh pr create`.
