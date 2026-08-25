// ============================================
// Home — the landing screen. Replaces the old persistent tab bar: each
// section is a tile here, tapping one opens it full-screen (no tab bar
// visible while inside), and the header logo/back-arrow returns here.
// Each tile carries its own abstract mark + a saturated "mosaic" color.
// ============================================

import { router } from "./core.js";
import { bounceTap } from "./animations.js";
import { ICONS } from "./icons.js";

const TILES = [
  { key: "books", label: "Books", bg: "var(--pink)", tone: "dark" },
  { key: "lps", label: "LPs", bg: "var(--purple)", tone: "dark" },
  { key: "music", label: "Music", bg: "var(--blue)", tone: "dark" },
  { key: "photos", label: "Photos", bg: "var(--mint)", tone: "light" },
  { key: "finance", label: "Finance", bg: "var(--yellow)", tone: "light" },
];

function render(container, store) {
  const wrap = document.createElement("div");

  const title = document.createElement("p");
  title.className = "view-title";
  title.textContent = "Your Library";
  wrap.appendChild(title);

  const grid = document.createElement("div");
  grid.className = "home-grid";

  TILES.forEach((tile) => {
    const btn = document.createElement("button");
    btn.className = "home-tile";
    btn.type = "button";
    btn.dataset.tone = tile.tone;
    btn.style.setProperty("--tile-bg", tile.bg);
    btn.innerHTML = `
      <span class="home-tile-icon">${ICONS[tile.key]}</span>
      <span class="home-tile-label">${tile.label}</span>
      <span class="home-tile-sub">${subtitleFor(tile.key, store)}</span>
    `;
    btn.addEventListener("click", () => {
      bounceTap(btn);
      router.navigate(tile.key);
    });
    grid.appendChild(btn);
  });

  wrap.appendChild(grid);
  container.innerHTML = "";
  container.appendChild(wrap);
}

function subtitleFor(key, store) {
  if (key === "books") {
    const n = store.itemsByType("book").length;
    return n === 0 ? "Tap to start" : `${n} book${n === 1 ? "" : "s"}`;
  }
  return "Coming soon";
}

export default { render };
