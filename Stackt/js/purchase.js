// ============================================
// The moment of purchase.
//
// One sheet, shared by books and records, shown when something moves from
// your wishlist onto your shelf.
//
// It exists because of a single asymmetry that makes the whole Wishlist module
// work: the price you'd written down was recorded BEFORE you knew what you'd
// end up paying. That makes it a benchmark you can't argue with after the
// fact — unlike a budget, which is a number you can quietly raise. The gap
// between the two is the only saving this app can honestly claim to have
// witnessed, so it is worth one extra tap to capture it while you remember.
//
// Both halves are kept on the copy: `expected` is the benchmark frozen at the
// moment of sale, `paid` is what actually left your pocket. Freezing the
// benchmark matters — the item's own price gets cleared once it's yours, and
// editing a wishlist price later must never rewrite history.
// ============================================

import { openOverlay, dismissLayer, escapeHtml } from "./ui.js";
import { ICONS } from "./icons.js";
import { bounceTap } from "./animations.js";

/** Parses a typed amount. Blank or nonsense becomes null rather than zero. */
export function parseAmount(raw) {
  const text = String(raw == null ? "" : raw).trim();
  if (!text) return null;
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * How a purchase landed against its benchmark.
 * Positive `diff` means under — you paid less than you expected to.
 */
export function outcome(copy) {
  if (!copy || copy.paid == null || copy.expected == null) return null;
  const diff = Number(copy.expected) - Number(copy.paid);
  return {
    expected: Number(copy.expected),
    paid: Number(copy.paid),
    diff,
    under: diff > 0,
    over: diff < 0,
  };
}

/**
 * Asks what you actually paid.
 *
 * `benchmark` is the wishlist price, or null if there wasn't one — an impulse
 * buy has nothing to be measured against, and the sheet says so rather than
 * pretending zero is a comparison.
 */
export function askWhatYouPaid({ title, benchmark, checkedDate, paid = null, editing = false, onDone }) {
  openOverlay("cover-picker-backdrop", (overlay) => {
    // Older than this and the benchmark is worth a second look before it's
    // treated as the price you'd have paid today.
    const stale =
      checkedDate &&
      (Date.now() - new Date(checkedDate).getTime()) / 86400000 > 120;

    overlay.innerHTML = `
      <div class="cover-picker paid-sheet">
        <div class="cover-picker-head">
          <h2>${editing ? "What it cost" : "What did you pay?"}</h2>
          <button class="lightbox-close" id="pdClose" type="button" aria-label="Close"><span class="btn-icon">${ICONS.close}</span></button>
        </div>

        <p class="paid-title">${escapeHtml(title)}</p>

        ${editing
          ? `<p class="cover-picker-label">The price you'd noted <span class="field-hint">optional</span></p>
             <div class="paid-input-row small">
               <span class="paid-currency">$</span>
               <input type="number" step="0.01" inputmode="decimal" id="notedInput"
                      value="${benchmark != null ? Number(benchmark).toFixed(2) : ""}"
                      placeholder="—" aria-label="The price you had noted">
             </div>
             <p class="cover-picker-label">What you actually paid</p>`
          : benchmark != null
          ? `<div class="paid-benchmark">
               <span class="pb-label">You'd noted</span>
               <span class="pb-value">$${Number(benchmark).toFixed(2)}</span>
               ${stale ? `<span class="pb-stale">checked a while ago</span>` : ""}
             </div>`
          : `<p class="paid-none">No price noted for this one, so there's nothing to compare against — just record what it cost.</p>`}

        <div class="paid-input-row">
          <span class="paid-currency">$</span>
          <input type="number" step="0.01" inputmode="decimal" id="paidInput"
                 value="${editing
                   ? (paid != null ? Number(paid).toFixed(2) : "")
                   : (benchmark != null ? Number(benchmark).toFixed(2) : "")}"
                 placeholder="0.00" aria-label="What you paid">
        </div>
        <p class="paid-verdict" id="paidVerdict"></p>

        <button class="btn btn-primary block-btn" id="paidSave" type="button">${
          editing ? "Save" : "Add to my shelf"
        }</button>
        <button class="link-btn" id="paidSkip" type="button">${
          editing ? "Clear the price" : "I'd rather not say"
        }</button>
      </div>
    `;

    const input = overlay.querySelector("#paidInput");
    const verdict = overlay.querySelector("#paidVerdict");

    const notedInput = overlay.querySelector("#notedInput");
    const noted = () => (notedInput ? parseAmount(notedInput.value) : benchmark);

    const say = () => {
      const paid = parseAmount(input.value);
      const benchmark = noted();
      if (benchmark == null || paid == null) {
        verdict.textContent = "";
        verdict.className = "paid-verdict";
        return;
      }
      const diff = Number(benchmark) - paid;
      if (Math.abs(diff) < 0.005) {
        verdict.textContent = "Exactly what you expected.";
        verdict.className = "paid-verdict level";
      } else if (diff > 0) {
        verdict.textContent = `$${diff.toFixed(2)} under what you'd noted.`;
        verdict.className = "paid-verdict under";
      } else {
        verdict.textContent = `$${Math.abs(diff).toFixed(2)} over what you'd noted.`;
        verdict.className = "paid-verdict over";
      }
    };
    input.addEventListener("input", say);
    if (notedInput) notedInput.addEventListener("input", say);
    say();

    setTimeout(() => {
      input.focus();
      input.select();
    }, 80);

    const finish = (paid) => {
      const expected = noted();
      dismissLayer();
      // The benchmark is frozen here on purpose. Editing the WISHLIST price
      // afterwards must not retroactively change what you "saved" — correcting
      // it deliberately, from this sheet, is a different thing and is allowed.
      onDone({ paid, expected: expected != null ? Number(expected) : null });
    };

    overlay.addEventListener("click", (e) => { if (e.target === overlay) dismissLayer(); });
    overlay.querySelector("#pdClose").addEventListener("click", () => dismissLayer());
    overlay.querySelector("#paidSave").addEventListener("click", () => {
      bounceTap(overlay.querySelector("#paidSave"));
      finish(parseAmount(input.value));
    });
    overlay.querySelector("#paidSkip").addEventListener("click", () => finish(null));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        finish(parseAmount(input.value));
      }
    });
  });
}
