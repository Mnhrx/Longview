// ============================================
// Shared UI pieces — item card + modal sheet.
// Every module builds its list out of createItemCard() so they all look
// and move the same way, even though each module owns its own data.
// ============================================

import { bounceTap, popIn } from "./animations.js";
import { ICONS } from "./icons.js";

/** Emoji fallback used by the generic item card's swatch (module-specific
 *  screens like Books draw their own richer card). */
const SWATCH_EMOJI = { book: "📖", lp: "💿", music: "🎧", photo: "📷" };

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

/** Number of layers currently open — mirrored into history state as `depth`. */
export function layerDepth() {
  return layers.length;
}

/** Registers a layer and gives it a history entry so back can pop it. */
function pushLayer(kind, teardown) {
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

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export { popIn };
