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
  { key: "photos", label: "Photos", bg: "var(--blue)", tone: "dark" },
  { key: "finance", label: "Finance", bg: "var(--mint)", tone: "light" },
];

function render(container, store, opts = {}) {
  const wrap = document.createElement("div");
  wrap.className = "home-screen";

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

  // The menu comes back as ONE piece scaling up from the centre of the screen,
  // rather than five tiles popping separately — that separate-pops version is
  // what read as jitter, especially layered under iOS's own swipe animation.
  // Held back until `startMenuIntro()` so it can't run behind the splash.
  if (opts.animate === false) {
    // Land already settled — no intro to play.
    wrap.classList.add("intro", "no-anim");
    return;
  }
  wrap.dataset.introPending = "1";
  if (!window.__stacktSplashUp) startMenuIntro();
}

/** Plays the menu's zoom-out. Called on render, or by main.js once the splash
 *  has actually cleared — otherwise the animation finishes unseen underneath it. */
export function startMenuIntro() {
  const wrap = document.querySelector(".home-screen[data-intro-pending]");
  if (!wrap) return;
  delete wrap.dataset.introPending;
  requestAnimationFrame(() => wrap.classList.add("intro"));
}

function subtitleFor(key, store) {
  if (key === "books") {
    const books = store.itemsByType("book");
    // Books physically with you: owned plus still-borrowed. Wishlist excluded —
    // you don't have those. Borrowed is called out separately so the number is
    // never ambiguous.
    const owned = books.filter((b) => (b.copies || []).length > 0).length;
    const borrowed = books.filter(
      (b) => !(b.copies || []).length && b.borrowed && !b.borrowed.returnedDate
    ).length;

    if (!owned && !borrowed) return "Tap to start";
    const main = `${owned} book${owned === 1 ? "" : "s"}`;
    return borrowed
      ? `${main} <span class="sub-accent">· ${borrowed} borrowed</span>`
      : main;
  }
  return "Coming soon";
}

export default { render };
