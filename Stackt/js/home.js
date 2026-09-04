// ============================================
// Home — the landing screen. Replaces the old persistent tab bar: each
// section is a tile here, tapping one opens it full-screen (no tab bar
// visible while inside), and the header logo/back-arrow returns here.
// Each tile carries its own abstract mark + a saturated "mosaic" color.
// ============================================

import { router } from "./core.js";
import { potOf } from "./wishlist.js";
import { bounceTap } from "./animations.js";
import { ICONS } from "./icons.js";

const TILES = [
  { key: "books", label: "Books", bg: "var(--pink)", tone: "dark" },
  { key: "lps", label: "LPs", bg: "var(--purple)", tone: "dark" },
  { key: "words", label: "Words", bg: "var(--yellow)", tone: "light" },
  { key: "food", label: "Food", bg: "var(--food)", tone: "dark" },
  { key: "wishlist", label: "Wishlist", bg: "var(--mint)", tone: "light" },
];

function render(container, store, opts = {}) {
  const wrap = document.createElement("div");
  wrap.className = "home-screen";

  // "Your Library" was right for three shelves of things you own. Food is
  // neither owned nor a shelf, and calling a plate of nasi lemak part of
  // your library would be the app lying about what it is. What actually
  // connects all four is that you were there and want to remember it — so the
  // heading names the app and the line underneath says the rest.
  const title = document.createElement("p");
  title.className = "view-title";
  title.textContent = "Your Stackt";
  wrap.appendChild(title);

  const sub = document.createElement("p");
  sub.className = "home-sub";
  sub.textContent = "Read, heard, learned, eaten.";
  wrap.appendChild(sub);

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
  if (key === "lps") {
    const recs = store.itemsByType("lp");
    const owned = recs.filter((r) => (r.copies || []).length > 0).length;
    const borrowed = recs.filter(
      (r) => !(r.copies || []).length && r.borrowed && !r.borrowed.returnedDate
    ).length;
    if (!owned && !borrowed) return "Tap to start";
    const main = `${owned} record${owned === 1 ? "" : "s"}`;
    return borrowed ? `${main} <span class="sub-accent">· ${borrowed} borrowed</span>` : main;
  }
  if (key === "wishlist") {
    const wanted = store.get().items.filter(
      (i) => (i.type === "book" || i.type === "lp") && !(i.copies || []).length && !i.borrowed
    );
    if (!wanted.length) return "Tap to start";
    const label = `${wanted.length} wanted`;
    const budget = Number((store.get().budget || {}).monthly) || 0;
    if (!budget) return `${label} <span class="sub-accent">· set a budget</span>`;

    // The same running balance the module works from, so the tile can't
    // disagree with the screen behind it.
    let pot = potOf(store);
    if (pot < 0) {
      const amount = `$${Math.abs(pot) >= 1000
        ? Math.round(Math.abs(pot)).toLocaleString()
        : Math.abs(pot).toFixed(0)}`;
      return `${label} <span class="sub-accent">· ${amount} overdrawn</span>`;
    }
    const priced = wanted.filter((i) => i.price != null).map((i) => Number(i.price));
    let now = 0;
    priced.sort((a, b) => a - b).forEach((p) => {
      if (pot >= p) { pot -= p; now++; }
    });
    return now
      ? `${label} <span class="sub-accent">· ${now} within reach</span>`
      : label;
  }
  if (key === "words") {
    const words = store.itemsByType("word");
    if (!words.length) return "Tap to start";
    const faves = words.filter((w) => w.favourite).length;
    const main = `${words.length} word${words.length === 1 ? "" : "s"}`;
    return faves ? `${main} <span class="sub-accent">· ${faves} loved</span>` : main;
  }
  if (key === "food") {
    const places = store.itemsByType("place");
    const been = places.filter((p) => !p.wantToTry);
    const toTry = places.length - been.length;
    if (!places.length) return "Tap to start";
    // Places you've been is the headline; the to-try list is the nudge, so it
    // reads the same way "borrowed" does on Books.
    const main = `${been.length} place${been.length === 1 ? "" : "s"}`;
    return toTry
      ? `${main} <span class="sub-accent">· ${toTry} to try</span>`
      : main;
  }
  return "Coming soon";
}

export default { render };
