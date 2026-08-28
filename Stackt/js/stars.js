// ============================================
// Star ratings, in halves.
//
// A rating is a number stepping by 0.5, from 0 to 5. Whole-star ratings saved
// before this existed are already valid values, so nothing needs migrating.
//
// A half star is drawn as two stacked copies — a hollow one, and a filled one
// inside a box clipped to the right width. That beats an SVG clipPath here
// because clipPaths need unique ids, and these get rendered dozens at a time
// into innerHTML where a duplicated id would silently clip the wrong star.
// ============================================

export const MAX_STARS = 5;

const STAR_PATH =
  "M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.5L12 17.5 6.2 20.5l1.1-6.5-4.7-4.6 6.5-.95L12 2.6z";

const svg = (cls) =>
  `<svg viewBox="0 0 24 24" class="star ${cls}"><path d="${STAR_PATH}"/></svg>`;

/** Clamps to the 0–5 range and snaps to the nearest half. */
export function normaliseRating(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(MAX_STARS, Math.round(n * 2) / 2);
}

/** "4", "4.5" — whole numbers don't get a pointless ".0". */
export function formatRating(value) {
  const n = normaliseRating(value);
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/**
 * One star's fill, 0–1, for the nth star (1-based) at a given rating.
 * At 3.5: stars 1–3 are full, star 4 is half, star 5 is empty.
 */
function fillFor(n, rating) {
  return Math.max(0, Math.min(1, rating - (n - 1)));
}

function starHtml(fill) {
  const pct = Math.round(fill * 100);
  return `
    <span class="star-wrap">
      ${svg("base")}
      ${pct > 0 ? `<span class="star-fill" style="width:${pct}%">${svg("on")}</span>` : ""}
    </span>
  `;
}

/**
 * `interactive` gives each star two hit zones — left half and right half — so
 * 3.5 is a tap, not a long-press or a drag.
 */
export function starsHtml(rating, interactive = false) {
  const r = normaliseRating(rating);
  const items = [];
  for (let n = 1; n <= MAX_STARS; n++) {
    const fill = fillFor(n, r);
    if (!interactive) {
      items.push(starHtml(fill));
      continue;
    }
    items.push(`
      <span class="star-btn" data-star="${n}">
        ${starHtml(fill)}
        <button type="button" class="star-half left" data-rate="${n - 0.5}"
                aria-label="${n - 0.5} stars"></button>
        <button type="button" class="star-half right" data-rate="${n}"
                aria-label="${n} star${n === 1 ? "" : "s"}"></button>
      </span>
    `);
  }
  return `<span class="star-row${interactive ? " interactive" : ""}">${items.join("")}</span>`;
}

/** Repaints an existing star row to a new rating, without rebuilding it. */
export function paintStars(root, rating) {
  if (!root) return;
  const r = normaliseRating(rating);
  root.querySelectorAll(".star-wrap").forEach((wrap, i) => {
    const fill = fillFor(i + 1, r);
    let fillEl = wrap.querySelector(".star-fill");
    if (fill > 0 && !fillEl) {
      fillEl = document.createElement("span");
      fillEl.className = "star-fill";
      fillEl.innerHTML = svg("on");
      wrap.appendChild(fillEl);
    }
    if (fillEl) fillEl.style.width = `${Math.round(fill * 100)}%`;
  });
}

/**
 * Wires an interactive row. `onChange(rating)` fires on every tap.
 * Tapping the value you're already on clears it, which is how you undo a
 * rating without hunting for a separate control.
 */
export function wireStars(root, current, onChange) {
  if (!root) return;
  let value = normaliseRating(current);
  root.querySelectorAll(".star-half").forEach((half) => {
    half.addEventListener("click", (e) => {
      e.preventDefault();
      const tapped = Number(half.dataset.rate);
      value = value === tapped ? 0 : tapped;
      paintStars(root, value);
      onChange(value);
    });
  });
}
