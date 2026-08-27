// ============================================
// Shared UI pieces — item card + modal sheet.
// Every module builds its list out of createItemCard() so they all look
// and move the same way, even though each module owns its own data.
// ============================================

import { bounceTap, popIn } from "./animations.js";
import { ICONS } from "./icons.js";

/** Emoji fallback used by the generic item card's swatch (module-specific
 *  screens like Books draw their own richer card). */
const SWATCH_EMOJI = { book: "📖", lp: "💿", photo: "📷" };

const STATUS_LABEL = {
  "to-read": "To Read",
  "reading": "Reading",
  "read": "Read",
  "lent-out": "Lent Out",
  "owned": "Owned",
  "wishlist": "Wishlist",
};

/** Builds a single item card element. `onTap` receives the item. */
export function createItemCard(item, onTap) {
  const card = document.createElement("div");
  card.className = "item-card";
  card.style.borderColor = "var(--ink)";

  const statusClass = `status-${item.status}`;

  card.innerHTML = `
    <div class="item-swatch" style="background:${item.color || "#eee"}">
      ${SWATCH_EMOJI[item.type] || "✦"}
    </div>
    <div class="item-body">
      <p class="item-title">${escapeHtml(item.title)}</p>
      <p class="item-creator">${escapeHtml(item.creator || "")}</p>
      <span class="status-pill ${statusClass}">${STATUS_LABEL[item.status] || item.status}</span>
      ${item.status === "lent-out" && item.lentTo
        ? `<div class="lent-note">→ lent to ${escapeHtml(item.lentTo)}${item.lentDate ? " on " + item.lentDate : ""}</div>`
        : ""}
      ${!item.owned && item.price != null
        ? `<div class="price-tag">$${Number(item.price).toFixed(2)} · wishlist</div>`
        : ""}
    </div>
  `;

  card.addEventListener("click", () => {
    bounceTap(card);
    onTap && onTap(item, card);
  });

  return card;
}

/** Renders a grid of item cards into `container`. */
export function renderCardGrid(container, items, onTap, emptyMessage = "Nothing here yet") {
  const grid = document.createElement("div");
  grid.className = "card-grid";

  if (items.length === 0) {
    container.appendChild(grid);
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `<div class="empty-state-icon">${ICONS.empty}</div><p>${emptyMessage}</p>`;
    container.appendChild(empty);
    return;
  }

  items.forEach((item) => grid.appendChild(createItemCard(item, onTap)));
  container.appendChild(grid);
}

// ============================================
// Layer stack — modals and the cover lightbox are "layers" stacked over the
// current screen. Each open layer owns ONE browser history entry, so the back
// gesture pops it the way the platform expects.
//
// Why this matters: the previous approach let back navigate away and then
// tried to undo it with pushState. That survives a programmatic history.back()
// but loses against a real iOS edge-swipe, which the browser has already
// committed to — leaving the URL on one screen and the DOM on another.
// ============================================

let layers = []; // [{ kind, teardown }] innermost last
let lockedScrollTop = 0;

/**
 * Freezes the screen behind an overlay.
 *
 * A fixed backdrop stops the page *receiving* taps but doesn't stop it
 * scrolling: a drag over the backdrop, or a flick that runs past the end of the
 * sheet's own scroll, still moves the list underneath. Locking the scroller
 * while any layer is open is what actually pins it.
 */
function lockBackgroundScroll() {
  const view = document.getElementById("view");
  if (!view) return;
  lockedScrollTop = view.scrollTop;
  view.classList.add("scroll-locked");
  view.style.top = `-${lockedScrollTop}px`;
}

function unlockBackgroundScroll() {
  const view = document.getElementById("view");
  if (!view) return;
  view.classList.remove("scroll-locked");
  view.style.top = "";
  view.scrollTop = lockedScrollTop; // put them back where they were
}

/** Number of layers currently open — mirrored into history state as `depth`. */
export function layerDepth() {
  return layers.length;
}

/** Registers a layer and gives it a history entry so back can pop it. */
function pushLayer(kind, teardown) {
  if (layers.length === 0) lockBackgroundScroll();
  layers.push({ kind, teardown });
  const view = (history.state && history.state.view) || "";
  history.pushState({ view, depth: layers.length }, "", location.hash || "");
}

/** Tears down the innermost layer WITHOUT touching history. Called by the
 *  popstate handler once the browser has already popped the entry. */
export function popLayer() {
  const layer = layers.pop();
  if (!layer) return false;
  try { layer.teardown(); } catch (e) { console.warn(e); }
  if (layers.length === 0) unlockBackgroundScroll();
  return true;
}

/** Syncs the visible layers down to `depth` — used on popstate. */
export function syncLayersTo(depth) {
  let closed = false;
  while (layers.length > depth) {
    popLayer();
    closed = true;
  }
  return closed;
}

/** User-initiated close (X button, backdrop tap, Save). Goes through history
 *  so the stack never drifts out of sync with what's on screen. */
export function dismissLayer() {
  if (layers.length) history.back();
}

/** Drops every layer with no history involvement — for a hard screen change. */
export function clearAllLayers() {
  while (layers.length) popLayer();
  unlockBackgroundScroll(); // belt and braces on a hard screen change
}

export function isModalOpen() {
  return layers.some((l) => l.kind === "modal");
}

let currentOnClose = null;

/**
 * Opens a bottom-sheet modal. `buildContent(el)` fills in the sheet body.
 * Optional `onClose` runs once, right before the sheet is torn down —
 * use it for cleanup like stopping a camera stream.
 */
export function openModal(buildContent, onClose = null) {
  // Reopening while a modal is already up replaces it in place rather than
  // stacking a second history entry.
  if (isModalOpen()) {
    const sheet = document.querySelector("#modalRoot .modal-sheet");
    if (sheet) {
      if (currentOnClose) {
        try { currentOnClose(); } catch (e) { console.warn(e); }
      }
      currentOnClose = onClose;
      sheet.innerHTML = "";
      buildContent(sheet);
      return;
    }
  }

  const root = document.getElementById("modalRoot");
  root.innerHTML = "";
  currentOnClose = onClose;

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) dismissLayer();
  });

  const sheet = document.createElement("div");
  sheet.className = "modal-sheet";

  // Attach to the document BEFORE filling in the content. Anything that needs to
  // find its own element by id — the barcode scanner's container, most notably —
  // fails outright if the sheet is still detached when buildContent runs.
  backdrop.appendChild(sheet);
  root.appendChild(backdrop);

  pushLayer("modal", () => {
    if (currentOnClose) {
      try { currentOnClose(); } catch (e) { console.warn(e); }
      currentOnClose = null;
    }
    root.innerHTML = "";
  });

  buildContent(sheet);
}

/** Swaps a modal's contents without tearing the sheet down — no reopen
 *  animation, no history churn. This is what keeps the sheet from "jumping"
 *  every time you tap a status button. */
export function updateModal(buildContent) {
  const sheet = document.querySelector("#modalRoot .modal-sheet");
  if (!sheet) return false;
  sheet.innerHTML = "";
  buildContent(sheet);
  return true;
}

/** Opens a full-screen overlay as its own layer. `build(el)` fills it in. */
export function openOverlay(className, build) {
  const el = document.createElement("div");
  el.className = className;
  document.body.appendChild(el);
  pushLayer("overlay", () => el.remove());
  build(el);
  return el;
}

/** Programmatic teardown of the modal only (no history move) — used when a
 *  flow replaces one sheet with another, e.g. scan match -> detail. */
export function closeModal() {
  dismissLayer();
}

// ---------- input ergonomics ----------

const CLEAR_ICON =
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round">` +
  `<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>`;

/**
 * Adds a clear (×) button inside a text field.
 *
 * Wraps the input in place, so callers keep their existing querySelector and
 * their own listeners — nothing else has to know this happened. iOS Safari
 * never renders the native type="search" clear button, which is why this
 * exists at all. `onClear` fires after the field is emptied.
 */
export function makeClearable(input, onClear = null) {
  if (!input || input.dataset.clearable) return input;
  input.dataset.clearable = "1";

  const wrap = document.createElement("span");
  wrap.className = "input-wrap" + (input.tagName === "TEXTAREA" ? " textarea" : "");
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "input-clear";
  btn.setAttribute("aria-label", "Clear");
  btn.innerHTML = CLEAR_ICON;
  wrap.appendChild(btn);

  const sync = () => wrap.classList.toggle("has-value", !!input.value);
  sync();
  input.addEventListener("input", sync);
  input.addEventListener("change", sync);

  // pointerdown, not click: click blurs the field first, which closes the
  // keyboard and makes "clear it and keep typing" two taps instead of one.
  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    input.value = "";
    sync();
    input.focus();
    input.dispatchEvent(new Event("input", { bubbles: true }));
    if (onClear) onClear();
  });

  return input;
}

/** Trailing debounce — stops every keystroke rebuilding a whole list. */
export function debounce(fn, ms = 180) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Wires a date field so it commits when you're DONE, not mid-spin.
 *
 * iOS fires `change` on every wheel nudge of an <input type="date">, so
 * committing there re-rendered the sheet, tore the live input out of the DOM
 * and closed the picker under your finger — once per field you wanted to
 * change. Committing on blur instead lets day, month and year all be set in
 * one visit. `commit(value)` only runs when the value actually changed.
 */
export function wireDateField(input, commit) {
  if (!input) return;
  let committed = input.value;

  const flush = () => {
    if (input.value === committed) return;
    committed = input.value;
    commit(input.value);
  };

  input.addEventListener("blur", flush);
  // Desktop pickers and programmatic sets can change the value without the
  // field ever holding focus; those still need to land.
  input.addEventListener("change", () => {
    if (document.activeElement !== input) flush();
  });
}

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export { popIn };
