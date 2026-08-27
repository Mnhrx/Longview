// ============================================
// Shared list sorting for Books and LPs.
//
// Each module hands in its own list of criteria; everything else — the flip,
// the null handling, the tie-breaking — lives here so the two modules can't
// drift apart.
//
// Two rules the whole app relies on:
//
//   * Items with nothing to sort on (no year, never finished, unrated) always
//     collect at the END, in title order, whichever direction you're sorting.
//     Reversing "Rating" should surface your one-star records, not bury them
//     under everything you never rated.
//   * Title is the universal tie-break, so equal values never shuffle around
//     between renders.
// ============================================

import { openModal, dismissLayer } from "./ui.js";

/** Locale-aware, case-insensitive, and "Book 2" before "Book 10". */
export const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

/** Drops a leading article, so The Hobbit files under H the way a shelf would. */
export function titleSortKey(item) {
  return String((item && item.title) || "").replace(/^(the|a|an)\s+/i, "").trim();
}

const byTitle = (a, b) => collator.compare(titleSortKey(a), titleSortKey(b));

/** Number out of a possibly-messy year string; null when there isn't one. */
export function yearValue(item) {
  const n = parseInt(item && item.year, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Creates a sort controller for one module.
 *
 * `criteria` entries look like:
 *   {
 *     key, label,
 *     asc, desc,          // what each direction is CALLED, e.g. "A–Z" / "Z–A"
 *     value(item),        // null means "nothing to sort on" → goes last
 *     compare(a, b),      // ascending comparison of two non-null values
 *     describe(item),     // optional subtitle for the card, e.g. "Took 12 days"
 *     note,               // optional badge, e.g. "Default"
 *   }
 * A criterion with no `value` sorts by title.
 */
export function createSorter(criteria, defaultKey = "title") {
  let key = defaultKey;
  let dir = "asc";

  const find = (k) => criteria.find((c) => c.key === k) || criteria[0];

  return {
    get key() { return key; },
    get dir() { return dir; },
    get criteria() { return criteria; },
    get isDefault() { return key === defaultKey && dir === "asc"; },

    /** Selecting the criterion you're already on flips the direction. */
    select(nextKey) {
      if (nextKey === key) dir = dir === "asc" ? "desc" : "asc";
      else { key = nextKey; dir = "asc"; }
    },
    flip() { dir = dir === "asc" ? "desc" : "asc"; },
    reset() { key = defaultKey; dir = "asc"; },

    /** e.g. "Rating · highest first" — what the header line shows. */
    label() {
      const c = find(key);
      const side = dir === "asc" ? c.asc : c.desc;
      return side ? `${c.label} · ${side}` : c.label;
    },
    directionLabel() {
      const c = find(key);
      return (dir === "asc" ? c.asc : c.desc) || "";
    },

    /** Optional per-card subtitle explaining the current order. */
    describe(item) {
      const c = find(key);
      return c.describe ? c.describe(item) || "" : "";
    },

    sort(list) {
      const c = find(key);
      const flip = dir === "desc" ? -1 : 1;
      const arr = [...list];

      if (!c.value) return arr.sort((a, b) => flip * byTitle(a, b));

      return arr.sort((a, b) => {
        const av = c.value(a);
        const bv = c.value(b);
        // Missing values sit at the bottom in BOTH directions — they aren't
        // "lowest", they're "not applicable".
        if (av == null && bv == null) return byTitle(a, b);
        if (av == null) return 1;
        if (bv == null) return -1;
        const base = c.compare ? c.compare(av, bv) : (av < bv ? -1 : av > bv ? 1 : 0);
        return flip * base || byTitle(a, b);
      });
    },
  };
}

// ---------- the sort sheet ----------

const ARROW_UP = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg>`;

/**
 * One sheet, shared by both modules. Tapping the criterion you're already on
 * reverses it — that's the whole "A–Z / Z–A" mechanic, and it works the same
 * way for dates, ratings and condition without needing a separate control.
 */
export function openSortSheet(sorter, onChange, hint) {
  openModal((sheet) => {
    sheet.innerHTML = `
      <h2>Sort by</h2>
      <div class="sort-list">
        ${sorter.criteria.map((c) => {
          const active = c.key === sorter.key;
          const side = active ? sorter.directionLabel() : c.asc || "";
          return `
            <button type="button" class="sort-option ${active ? "active" : ""}" data-sort="${c.key}">
              <span class="sort-option-label">${c.label}</span>
              <span class="sort-option-side">
                <span class="sort-option-note">${side}</span>
                ${active ? `<span class="sort-arrow ${sorter.dir}">${ARROW_UP}</span>` : ""}
              </span>
            </button>
          `;
        }).join("")}
      </div>
      <p class="field-hint" style="margin-top:14px;">
        Tap the one you're already on to reverse it.
        ${hint || ""}
      </p>
    `;
    sheet.querySelectorAll("[data-sort]").forEach((btn) => {
      btn.addEventListener("click", () => {
        sorter.select(btn.dataset.sort);
        dismissLayer();
        onChange();
      });
    });
  });
}
