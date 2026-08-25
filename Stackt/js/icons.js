// ============================================
// Shared icon set — abstract, geometric marks in one consistent style:
// white fill, thick ink stroke, rounded joins. Matches the home tiles so
// nothing in the app falls back to a stray emoji.
// ============================================

const S = 'fill="#fff" stroke="#1A1A2E" stroke-width="3" stroke-linejoin="round"';

export const ICONS = {
  books: `<svg viewBox="0 0 48 48"><rect x="7" y="11" width="10" height="29" rx="2" ${S} transform="rotate(-8 12 25)"/><rect x="19" y="8" width="10" height="32" rx="2" ${S}/><rect x="31" y="12" width="10" height="28" rx="2" ${S} transform="rotate(8 36 26)"/></svg>`,

  lps: `<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="18" ${S}/><circle cx="24" cy="24" r="11" fill="none" stroke="#1A1A2E" stroke-width="2" opacity="0.45"/><circle cx="24" cy="24" r="6" fill="#1A1A2E"/><circle cx="24" cy="24" r="2" fill="#fff"/></svg>`,

  music: `<svg viewBox="0 0 48 48"><rect x="7" y="21" width="7" height="19" rx="3" ${S}/><rect x="20" y="9" width="7" height="31" rx="3" ${S}/><rect x="33" y="16" width="7" height="24" rx="3" ${S}/></svg>`,

  photos: `<svg viewBox="0 0 48 48"><rect x="9" y="12" width="26" height="22" rx="3" ${S} transform="rotate(-7 22 23)"/><rect x="13" y="14" width="26" height="22" rx="3" ${S} transform="rotate(6 26 25)"/><circle cx="26" cy="25" r="5" fill="none" stroke="#1A1A2E" stroke-width="2.5"/></svg>`,

  finance: `<svg viewBox="0 0 48 48"><rect x="7" y="27" width="8" height="13" rx="2" ${S}/><rect x="20" y="18" width="8" height="22" rx="2" ${S}/><rect x="33" y="8" width="8" height="32" rx="2" ${S}/></svg>`,

  // Camera / scan — a body with a lens, plus a small viewfinder bump.
  camera: `<svg viewBox="0 0 48 48"><path d="M6 16h9l3-5h12l3 5h9a2 2 0 0 1 2 2v18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V18a2 2 0 0 1 2-2z" ${S}/><circle cx="24" cy="27" r="8" fill="none" stroke="#1A1A2E" stroke-width="3"/><circle cx="24" cy="27" r="3" fill="#1A1A2E"/></svg>`,

  // Magnifier — used for zoom controls and the tap-to-enlarge cover badge.
  zoom: `<svg viewBox="0 0 48 48"><circle cx="21" cy="21" r="13" ${S}/><line x1="30" y1="30" x2="41" y2="41" stroke="#1A1A2E" stroke-width="4" stroke-linecap="round"/></svg>`,

  // Torch / flash — a lightning bolt.
  torch: `<svg viewBox="0 0 48 48"><path d="M27 4 12 27h10l-3 17 17-24H26l1-16z" ${S}/></svg>`,

  // Empty-state marker — a stack of trays.
  empty: `<svg viewBox="0 0 48 48"><path d="M6 30l18-9 18 9-18 9-18-9z" ${S}/><path d="M6 20l18-9 18 9" fill="none" stroke="#1A1A2E" stroke-width="3" stroke-linejoin="round" opacity="0.45"/></svg>`,

  // Author / signature mark.
  author: `<svg viewBox="0 0 48 48"><path d="M8 34c6-2 10-8 14-15s7-11 10-11 4 4 1 9-9 11-14 15-8 5-11 2z" ${S}/><line x1="8" y1="40" x2="40" y2="40" stroke="#1A1A2E" stroke-width="3" stroke-linecap="round"/></svg>`,
};

/** Wraps an icon in a sized span. `size` is any CSS length. */
export function icon(name, size = "24px") {
  return `<span class="icon" style="width:${size};height:${size}">${ICONS[name] || ""}</span>`;
}
