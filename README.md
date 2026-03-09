# ⚡ Duncheon: Procedural Dungeon Architect

[![Tauri v2](https://img.shields.io/badge/Tauri-v2-blue?logo=tauri)](https://tauri.app/)
[![Rust](https://img.shields.io/badge/Rust-Performant-orange?logo=rust)](https://www.rust-lang.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Duncheon** is a high-performance, cross-platform procedural dungeon generator built with **Tauri v2** and **Rust**. Designed with a futuristic "Cyberpunk" aesthetic, it combines advanced graph theory algorithms with a seamless native experience to create complex, connected, and visually stunning maps for game developers and RPG enthusiasts.

---

## 🚀 Key Technical Highlights

This project was built to demonstrate proficiency in system-level programming, frontend-backend bridge patterns, and algorithmic optimization.

- **🦀 Rust-Powered Core**: All generation logic is parallelized and executed in the Rust backend for near-instant results, even on large maps.
- **📐 Graph Theory & MST**: Implements **Kruskal's Algorithm** to generate a **Minimum Spanning Tree (MST)** for room connectivity, ensuring every room is reachable with zero redundant "spaghetti" corridors.
- **🧭 BFS Pathfinding**: Uses optimized Breadth-First Search (BFS) to carve corridors through dynamic grids, respecting room boundaries and existing paths.
- **💾 Native Archive System**: A robust save/load system utilizing Tauri's native plugins to export **PNG Maps**, **JSON Metadata**, and **ZIP Archives**.
- **🎨 Visual Preview Engine**: Real-time rendering of dungeon data within a custom-built explorer, featuring a "Visual Preview" mini-map for loading archives.

---

## 🛠️ Stack & Architecture

| Layer | Technology | Role |
| :--- | :--- | :--- |
| **Backend** | Rust | Procedural logic, image processing, archive bundling |
| **Frontend** | TypeScript / Vite / HTML5 | State management, UI rendering, canvas manipulation |
| **Framework** | Tauri v2 | Native OS bridge, window management, CI/CD integration |
| **Styling** | Vanilla CSS | Custom Cyberpunk design system, glassmorphism, animations |
| **CI/CD** | GitHub Actions | Automated cross-platform builds (Windows, Linux, macOS) |

---

## ✨ Features

- **Procedural dual-mode generation**:
    - **Room-based**: Logical room placement with MST connectivity.
    - **Organic**: Cellular Automata for cave-like systems.
- **Interactive Workbench**:
    - Real-time sliders for width, density, and room counts.
    - Seed-based deterministic generation for reproducibility.
- **Futuristic UI/UX**:
    - "Glassmorphic" modals with blur effects.
    - Interactive status bars with operation feedback.
    - Themeable design system (Neon-Blue, Amber-Tech).
- **Export Protocols**:
    - `ARCHIVE.ZIP`: Bundles high-res PNG and structural JSON together.
    - `VISUAL.PNG`: High-fidelity image export for direct use in game engines.

---

## 📦 Getting Started

### Prerequisites
- [Rust](https://rustup.rs/) (Stable)
- [Node.js](https://nodejs.org/) (v20+)
- [pnpm](https://pnpm.io/)

### Development
1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/duncheon.git
   ```
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Run the application in development mode:
   ```bash
   pnpm tauri dev
   ```

---

## 🗺️ Roadmap
- [ ] Adaptive A* pathfinding for multi-level corridors.
- [ ] Export directly to Tiled (.TMX) and Unity formats.
- [ ] Real-time lighting preview on the canvas.

## 📄 License
This project is licensed under the MIT License - see the `LICENSE` file for details.

---

> "Built for performance, polished for the player." — *2026 Developer Portfolio*
