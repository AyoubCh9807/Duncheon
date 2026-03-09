import { invoke } from "@tauri-apps/api/core";

interface Room {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Dungeon {
  width: number;
  height: number;
  grid: number[][];
  rooms: Room[];
}

class DungeonRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dungeon: Dungeon | null = null;
  private zoom = 1.0;
  private offsetX = 0;
  private offsetY = 0;
  private isDragging = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private tileSize = 24;

  constructor(canvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d")!;
    this.setupEventListeners();
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  private setupEventListeners() {
    this.canvas.addEventListener("mousedown", (e) => {
      this.isDragging = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    });

    window.addEventListener("mousemove", (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.offsetX += dx;
      this.offsetY += dy;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.render();
    });

    window.addEventListener("mouseup", () => {
      this.isDragging = false;
    });

    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.handleZoom(e.deltaY < 0 ? 1.1 : 0.9);
    }, { passive: false });

    document.getElementById("zoom-in")?.addEventListener("click", () => this.handleZoom(1.2));
    document.getElementById("zoom-out")?.addEventListener("click", () => this.handleZoom(0.8));
    document.getElementById("reset-view")?.addEventListener("click", () => this.resetView());
  }

  private handleZoom(factor: number) {
    this.zoom *= factor;
    this.zoom = Math.max(0.1, Math.min(10, this.zoom));
    this.updateStatus();
    this.render();
  }

  private resetView() {
    if (!this.dungeon) return;
    this.zoom = 0.8;
    this.offsetX = (this.canvas.width - this.dungeon.width * this.tileSize * this.zoom) / 2;
    this.offsetY = (this.canvas.height - this.dungeon.height * this.tileSize * this.zoom) / 2;
    this.updateStatus();
    this.render();
  }

  private updateStatus() {
    const display = document.getElementById("zoom-status");
    if (display) display.textContent = `${Math.round(this.zoom * 100)}%`;
  }

  private resize() {
    const parent = this.canvas.parentElement!;
    this.canvas.width = parent.clientWidth;
    this.canvas.height = parent.clientHeight;
    this.render();
  }

  setDungeon(dungeon: Dungeon) {
    this.dungeon = dungeon;
    this.resetView();
  }

  render() {
    if (!this.dungeon) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.save();
    this.ctx.translate(this.offsetX, this.offsetY);
    this.ctx.scale(this.zoom, this.zoom);

    const accentColor = getComputedStyle(document.body).getPropertyValue('--accent-main').trim();

    // Draw corridors/caves
    for (let y = 0; y < this.dungeon.height; y++) {
      for (let x = 0; x < this.dungeon.width; x++) {
        const cell = this.dungeon.grid[y][x];
        if (cell === 2) {
          this.drawPipe(x, y);
        } else if (cell === 3) {
          this.drawCave(x, y, accentColor);
        }
      }
    }

    // Draw rooms
    for (const room of this.dungeon.rooms) {
      this.drawCrystalRoom(room, accentColor);
    }

    this.ctx.restore();
  }

  private drawPipe(x: number, y: number) {
    const size = this.tileSize;
    const px = x * size;
    const py = y * size;
    this.ctx.fillStyle = "#4a5568";
    this.ctx.fillRect(px + size / 4, py + size / 4, size / 2, size / 2);

    const grid = this.dungeon!.grid;
    if (y > 0 && grid[y - 1][x] !== 0) this.ctx.fillRect(px + size / 4, py, size / 2, size / 4);
    if (y < this.dungeon!.height - 1 && grid[y + 1][x] !== 0) this.ctx.fillRect(px + size / 4, py + size * 3 / 4, size / 2, size / 4);
    if (x > 0 && grid[y][x - 1] !== 0) this.ctx.fillRect(px, py + size / 4, size / 4, size / 2);
    if (x < this.dungeon!.width - 1 && grid[y][x + 1] !== 0) this.ctx.fillRect(px + size * 3 / 4, py + size / 4, size / 4, size / 2);
  }

  private drawCave(x: number, y: number, color: string) {
    const size = this.tileSize;
    this.ctx.fillStyle = color;
    this.ctx.globalAlpha = 0.4;
    this.ctx.fillRect(x * size, y * size, size, size);
    this.ctx.globalAlpha = 1.0;
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x * size + 2, y * size + 2, size - 4, size - 4);
  }

  private drawCrystalRoom(room: Room, color: string) {
    const size = this.tileSize;
    const rx = room.x * size;
    const ry = room.y * size;
    const rw = room.width * size;
    const rh = room.height * size;

    this.ctx.shadowBlur = 10;
    this.ctx.shadowColor = color;
    this.ctx.fillStyle = color;
    this.ctx.globalAlpha = 0.8;
    this.ctx.fillRect(rx, ry, rw, rh);
    this.ctx.globalAlpha = 1.0;
    this.ctx.shadowBlur = 0;

    this.ctx.strokeStyle = "rgba(255,255,255,0.4)";
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(rx + 4, ry + 4, rw - 8, rh - 8);
  }

  getDungeon() { return this.dungeon; }
}

let renderer: DungeonRenderer;
let currentSeed: string = "";
let currentRoomSize = "medium";

function updateLabels() {
  const rangeInputs = ["room-count", "corridor-density", "map-width", "map-height", "room-padding"];
  rangeInputs.forEach(id => {
    const input = document.getElementById(id) as HTMLInputElement;
    const display = document.getElementById(`${id.split('-').pop()}-val`) || document.getElementById(`${id}-val`);
    if (input && display) display.textContent = input.value;
  });
}

async function generate() {
  const alg = (document.getElementById("algorithm") as HTMLSelectElement).value;
  const seedInput = document.getElementById("seed") as HTMLInputElement;
  const roomCount = parseInt((document.getElementById("room-count") as HTMLInputElement).value);
  const corridorWidth = parseInt((document.getElementById("corridor-density") as HTMLInputElement).value);
  const width = parseInt((document.getElementById("map-width") as HTMLInputElement).value);
  const height = parseInt((document.getElementById("map-height") as HTMLInputElement).value);
  const padding = parseInt((document.getElementById("room-padding") as HTMLInputElement).value);

  currentSeed = seedInput.value || Math.floor(Math.random() * 1000000000).toString();
  seedInput.value = currentSeed;

  let hash = 0;
  for (let i = 0; i < currentSeed.length; i++) {
    hash = (hash << 5) - hash + currentSeed.charCodeAt(i);
    hash |= 0;
  }
  const numericSeed = Math.abs(hash);

  try {
    const dungeon = await invoke<Dungeon>("generate_dungeon", {
      seed: numericSeed,
      roomCount: roomCount,
      corridorWidth: corridorWidth,
      roomSize: currentRoomSize,
      width: width,
      height: height,
      algorithm: alg,
      roomPadding: padding
    });
    renderer.setDungeon(dungeon);
  } catch (err) {
    console.error("Failed to generate:", err);
  }
}

function exportJSON() {
  const dungeon = renderer.getDungeon();
  if (!dungeon) return;

  const data = {
    dungeon,
    settings: {
      algorithm: (document.getElementById("algorithm") as HTMLSelectElement).value,
      roomCount: (document.getElementById("room-count") as HTMLInputElement).value,
      density: (document.getElementById("corridor-density") as HTMLInputElement).value,
      width: (document.getElementById("map-width") as HTMLInputElement).value,
      height: (document.getElementById("map-height") as HTMLInputElement).value,
      padding: (document.getElementById("room-padding") as HTMLInputElement).value,
      roomSize: currentRoomSize,
      seed: (document.getElementById("seed") as HTMLInputElement).value
    }
  };

  const status = document.getElementById("main-status")!;
  status.textContent = "EXPORTING JSON...";

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `dungeon_${data.settings.seed}.json`;
  link.click();
  URL.revokeObjectURL(url);

  status.textContent = "READY";
  closeAllModals();
}

function renderPreview(dungeon: any) {
  const canvas = document.getElementById("preview-canvas") as HTMLCanvasElement;
  if (!canvas || !dungeon) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const scale = 4;
  canvas.width = dungeon.width * scale;
  canvas.height = dungeon.height * scale;

  ctx.fillStyle = "#0b0d17";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < dungeon.height; y++) {
    for (let x = 0; x < dungeon.width; x++) {
      const cell = dungeon.grid[y][x];
      if (cell === 0) continue;

      ctx.fillStyle = (cell === 1) ? "#00d4ff" : (cell === 2 ? "#4a5568" : "#329632");
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
}

let pendingLoadData: any = null;

function handleJSONLoad(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target?.result as string);
      if (data.dungeon && data.settings) {
        pendingLoadData = data;

        // Show preview info
        const previewEl = document.getElementById("load-preview")!;
        const filename = document.getElementById("preview-filename")!;
        const details = document.getElementById("preview-details")!;

        filename.textContent = file.name;
        details.textContent = `${data.dungeon.width}x${data.dungeon.height} | ${data.dungeon.rooms.length} Rooms | Seed: ${data.settings.seed}`;

        renderPreview(data.dungeon);
        previewEl.style.display = "flex";
        document.getElementById("drop-zone")!.style.display = "none";
      }
    } catch (err) {
      console.error("Failed to parse JSON:", err);
      alert("Invalid Dungeon JSON file.");
    }
  };
  reader.readAsText(file);
}

function confirmLoad() {
  if (!pendingLoadData) return;
  const data = pendingLoadData;
  const s = data.settings;

  (document.getElementById("algorithm") as HTMLSelectElement).value = s.algorithm;
  (document.getElementById("room-count") as HTMLInputElement).value = s.roomCount;
  (document.getElementById("corridor-density") as HTMLInputElement).value = s.density;
  (document.getElementById("map-width") as HTMLInputElement).value = s.width;
  (document.getElementById("map-height") as HTMLInputElement).value = s.height;
  (document.getElementById("room-padding") as HTMLInputElement).value = s.padding;
  (document.getElementById("seed") as HTMLInputElement).value = s.seed;
  currentRoomSize = s.roomSize;

  document.querySelectorAll(".size-btn").forEach(b => {
    b.classList.toggle("active", (b as HTMLElement).dataset.size === currentRoomSize);
  });

  updateLabels();
  toggleControls();
  renderer.setDungeon(data.dungeon);
  currentSeed = s.seed;

  closeAllModals();
  (document.getElementById("main-status")!).textContent = "RESTORED";
  setTimeout(() => { (document.getElementById("main-status")!).textContent = "READY"; }, 3000);
}

function closeAllModals() {
  document.querySelectorAll(".modal-overlay").forEach(m => m.classList.remove("active"));
  // Reset load modal state
  document.getElementById("load-preview")!.style.display = "none";
  document.getElementById("drop-zone")!.style.display = "block";
  pendingLoadData = null;
}

function applyTheme(theme: string) {
  document.body.dataset.theme = theme;
  document.querySelectorAll(".theme-dot").forEach(d => {
    d.classList.toggle("active", (d as HTMLElement).dataset.theme === theme);
  });
  renderer?.render();
}

function toggleControls() {
  const alg = (document.getElementById("algorithm") as HTMLSelectElement).value;
  document.getElementById("rooms-controls")!.style.display = (alg === "ca") ? "none" : "block";
}

window.addEventListener("DOMContentLoaded", () => {
  renderer = new DungeonRenderer("dungeon-canvas");

  // Sliders
  ["room-count", "corridor-density", "map-width", "map-height", "room-padding"].forEach(id => {
    document.getElementById(id)?.addEventListener("input", updateLabels);
  });

  // Algorithm toggle
  document.getElementById("algorithm")?.addEventListener("change", () => {
    toggleControls();
    generate();
  });

  // Theme dots
  document.querySelectorAll(".theme-dot").forEach(dot => {
    dot.addEventListener("click", () => applyTheme((dot as HTMLElement).dataset.theme!));
  });

  // Room sizes
  document.querySelectorAll(".size-btn[data-size]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".size-btn[data-size]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentRoomSize = (btn as HTMLElement).dataset.size!;
      generate();
    });
  });

  document.getElementById("refresh-seed")?.addEventListener("click", () => {
    document.getElementById("seed")!.setAttribute("value", "");
    (document.getElementById("seed") as HTMLInputElement).value = "";
    generate();
  });

  document.getElementById("generate-btn")?.addEventListener("click", generate);

  // Modal Controls
  document.getElementById("open-save-modal")?.addEventListener("click", () => {
    document.getElementById("save-modal")?.classList.add("active");
  });

  document.getElementById("open-load-modal")?.addEventListener("click", () => {
    document.getElementById("load-modal")?.classList.add("active");
  });

  document.querySelectorAll(".close-modal").forEach(btn => {
    btn.addEventListener("click", closeAllModals);
  });

  window.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).classList.contains("modal-overlay")) {
      closeAllModals();
    }
  });

  // Save Modal Actions
  document.getElementById("export-png-modal")?.addEventListener("click", async () => {
    const dungeon = renderer.getDungeon();
    if (!dungeon) return;
    try {
      const btn = document.getElementById("export-png-modal")!;
      const status = document.getElementById("main-status")!;
      const oldHtml = btn.innerHTML;

      btn.innerHTML = "<span class='opt-icon'>⏳</span><div class='opt-text'><span class='opt-title'>PROCESSING...</span></div>";
      status.textContent = "GENERATING PNG...";

      const base64 = await invoke<string>("export_png", { dungeon });
      const link = document.createElement("a");
      link.href = `data:image/png;base64,${base64}`;
      link.download = `dungeon_${currentSeed}.png`;
      link.click();

      btn.innerHTML = oldHtml;
      status.textContent = "READY";
      closeAllModals();
    } catch (err) {
      console.error("PNG Export failed:", err);
      alert("Failed to generate PNG.");
      (document.getElementById("main-status")!).textContent = "READY";
    }
  });

  document.getElementById("export-json-modal")?.addEventListener("click", exportJSON);

  document.getElementById("export-zip-modal")?.addEventListener("click", async () => {
    const dungeon = renderer.getDungeon();
    if (!dungeon) return;
    try {
      const btn = document.getElementById("export-zip-modal")!;
      const status = document.getElementById("main-status")!;
      const oldHtml = btn.innerHTML;

      btn.innerHTML = "<span class='opt-icon'>⏳</span><div class='opt-text'><span class='opt-title'>PACKAGING...</span></div>";
      status.textContent = "CREATING ARCHIVE...";

      const settings = {
        algorithm: (document.getElementById("algorithm") as HTMLSelectElement).value,
        roomCount: (document.getElementById("room-count") as HTMLInputElement).value,
        density: (document.getElementById("corridor-density") as HTMLInputElement).value,
        width: (document.getElementById("map-width") as HTMLInputElement).value,
        height: (document.getElementById("map-height") as HTMLInputElement).value,
        padding: (document.getElementById("room-padding") as HTMLInputElement).value,
        roomSize: currentRoomSize,
        seed: (document.getElementById("seed") as HTMLInputElement).value
      };

      const base64 = await invoke<string>("export_zip", {
        dungeon,
        settingsJson: JSON.stringify({ dungeon, settings }, null, 2)
      });

      const link = document.createElement("a");
      link.href = `data:application/zip;base64,${base64}`;
      link.download = `dungeon_archive_${currentSeed}.zip`;
      link.click();

      btn.innerHTML = oldHtml;
      status.textContent = "READY";
      closeAllModals();
    } catch (err) {
      console.error("ZIP Export failed:", err);
      alert("Failed to generate ZIP.");
      (document.getElementById("main-status")!).textContent = "READY";
    }
  });

  // Load Modal Actions
  document.getElementById("select-json-btn")?.addEventListener("click", () => {
    document.getElementById("modal-json-input")?.click();
  });

  document.getElementById("modal-json-input")?.addEventListener("change", handleJSONLoad);
  document.getElementById("confirm-load-btn")?.addEventListener("click", confirmLoad);

  document.getElementById("copy-seed")?.addEventListener("click", () => {
    navigator.clipboard.writeText(currentSeed);
  });

  updateLabels();
  generate();
});
