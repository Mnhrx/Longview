// ============================================
// Shared UI pieces — item card + modal sheet.
// Every module builds its list out of createItemCard() so they all look
// and move the same way, even though each module owns its own data.
// ============================================

import { bounceTap, popIn, staggerIn } from "./animations.js";
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

/** Renders a grid of item cards into `container`, staggering their entrance. */
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
  staggerIn(grid.querySelectorAll(".item-card"));
}

let currentOnClose = null;

/**
 * Opens a bottom-sheet modal. `buildContent(el)` fills in the sheet body.
 * Optional `onClose` runs once, right before the sheet is torn down —
 * use it for cleanup like stopping a camera stream.
 */
export function openModal(buildContent, onClose = null) {
  const root = document.getElementById("modalRoot");
  root.innerHTML = "";
  currentOnClose = onClose;

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeModal();
  });

  const sheet = document.createElement("div");
  sheet.className = "modal-sheet";

  // Attach to the document BEFORE filling in the content. Anything that needs to
  // find its own element by id — the barcode scanner's container, most notably —
  // fails outright if the sheet is still detached when buildContent runs.
  backdrop.appendChild(sheet);
  root.appendChild(backdrop);

  buildContent(sheet);
}

/** True while a modal sheet is on screen — used so the back gesture dismisses
 * the modal first instead of navigating away behind it. */
export function isModalOpen() {
  const root = document.getElementById("modalRoot");
  return !!(root && root.childElementCount > 0);
}

export function closeModal() {
  if (currentOnClose) {
    try { currentOnClose(); } catch (e) { console.warn(e); }
    currentOnClose = null;
  }
  const root = document.getElementById("modalRoot");
  root.innerHTML = "";
}

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export { popIn };
