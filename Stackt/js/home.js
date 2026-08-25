// ============================================
// Home — the landing screen. Replaces the old persistent tab bar: each
// section is a tile here, tapping one opens it full-screen (no tab bar
// visible while inside), and the header logo/back-arrow returns here.
// Each tile carries its own abstract mark + a saturated "mosaic" color.
// ============================================

import { router } from "./core.js";
import { bounceTap, staggerIn } from "./animations.js";

const ICONS = {
  books: `<svg viewBox="0 0 48 48"><rect x="7" y="11" width="10" height="29" rx="2" fill="#fff" stroke="#1A1A2E" stroke-width="3" transform="rotate(-8 12 25)"/><rect x="19" y="8" width="10" height="32" rx="2" fill="#fff" stroke="#1A1A2E" stroke-width="3"/><rect x="31" y="12" width="10" height="28" rx="2" fill="#fff" stroke="#1A1A2E" stroke-width="3" transform="rotate(8 36 26)"/></svg>`,
  lps: `<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="18" fill="#fff" stroke="#1A1A2E" stroke-width="3"/><circle cx="24" cy="24" r="11" fill="none" stroke="#1A1A2E" stroke-width="2" opacity="0.45"/><circle cx="24" cy="24" r="6" fill="#1A1A2E"/><circle cx="24" cy="24" r="2" fill="#fff"/></svg>`,
  music: `<svg viewBox="0 0 48 48"><rect x="7" y="21" width="7" height="19" rx="3" fill="#fff" stroke="#1A1A2E" stroke-width="3"/><rect x="20" y="9" width="7" height="31" rx="3" fill="#fff" stroke="#1A1A2E" stroke-width="3"/><rect x="33" y="16" width="7" height="24" rx="3" fill="#fff" stroke="#1A1A2E" stroke-width="3"/></svg>`,
  photos: `<svg viewBox="0 0 48 48"><rect x="9" y="12" width="26" height="22" rx="3" fill="#fff" stroke="#1A1A2E" stroke-width="3" transform="rotate(-7 22 23)"/><rect x="13" y="14" width="26" height="22" rx="3" fill="#fff" stroke="#1A1A2E" stroke-width="3" transform="rotate(6 26 25)"/><circle cx="26" cy="25" r="5" fill="none" stroke="#1A1A2E" stroke-width="2.5"/></svg>`,
  finance: `<svg viewBox="0 0 48 48"><rect x="7" y="27" width="8" height="13" rx="2" fill="#fff" stroke="#1A1A2E" stroke-width="3"/><rect x="20" y="18" width="8" height="22" rx="2" fill="#fff" stroke="#1A1A2E" stroke-width="3"/><rect x="33" y="8" width="8" height="32" rx="2" fill="#fff" stroke="#1A1A2E" stroke-width="3"/></svg>`,
};

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
  staggerIn(grid.querySelectorAll(".home-tile"), 60);
}

function subtitleFor(key, store) {
  if (key === "books") {
    const n = store.itemsByType("book").length;
    return n === 0 ? "Tap to start" : `${n} book${n === 1 ? "" : "s"}`;
  }
  return "Coming soon";
}

export default { render };
