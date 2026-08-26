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

  // Scan — four viewfinder corners with a sweep line through the middle.
  // Abstract and minimal: it says "scan", not "camera hardware".
  camera: `<svg viewBox="0 0 48 48" fill="none" stroke="#1A1A2E" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17V10a3 3 0 0 1 3-3h7"/><path d="M31 7h7a3 3 0 0 1 3 3v7"/><path d="M41 31v7a3 3 0 0 1-3 3h-7"/><path d="M17 41h-7a3 3 0 0 1-3-3v-7"/><line x1="13" y1="24" x2="35" y2="24"/></svg>`,

  // Magnifier — used for zoom controls and the tap-to-enlarge cover badge.
  zoom: `<svg viewBox="0 0 48 48"><circle cx="21" cy="21" r="13" ${S}/><line x1="30" y1="30" x2="41" y2="41" stroke="#1A1A2E" stroke-width="4" stroke-linecap="round"/></svg>`,

  // Torch / flash — a lightning bolt.
  torch: `<svg viewBox="0 0 48 48"><path d="M27 4 12 27h10l-3 17 17-24H26l1-16z" ${S}/></svg>`,

  // Empty-state marker — a stack of trays.
  empty: `<svg viewBox="0 0 48 48"><path d="M6 30l18-9 18 9-18 9-18-9z" ${S}/><path d="M6 20l18-9 18 9" fill="none" stroke="#1A1A2E" stroke-width="3" stroke-linejoin="round" opacity="0.45"/></svg>`,

  // Edit — a nib/pencil reduced to two strokes.
  edit: `<svg viewBox="0 0 48 48" fill="none" stroke="#1A1A2E" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M31 8.5a4.6 4.6 0 0 1 6.5 6.5L17 35.5 8 39l3.5-9L31 8.5z"/><line x1="28" y1="12" x2="36" y2="20"/></svg>`,

  // View — an eye, for flipping back out of edit mode.
  eye: `<svg viewBox="0 0 48 48" fill="none" stroke="#1A1A2E" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 24s7.5-12 21-12 21 12 21 12-7.5 12-21 12S3 24 3 24z"/><circle cx="24" cy="24" r="5.5"/></svg>`,

  // Lend — an arrow handing something across.
  lend: `<svg viewBox="0 0 48 48" fill="none" stroke="#1A1A2E" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="24" x2="38" y2="24"/><polyline points="28,14 38,24 28,34"/></svg>`,

  // Lens — a bare aperture. Used where "photo" is meant rather than "scan".
  lens: `<svg viewBox="0 0 48 48" fill="none" stroke="#1A1A2E" stroke-width="3.5"><circle cx="24" cy="24" r="15"/><circle cx="24" cy="24" r="6"/></svg>`,

  // Settings — sliders rather than a cog; simpler at small sizes.
  settings: `<svg viewBox="0 0 48 48" fill="none" stroke="#1A1A2E" stroke-width="3.5" stroke-linecap="round"><line x1="8" y1="15" x2="40" y2="15"/><line x1="8" y1="33" x2="40" y2="33"/><circle cx="19" cy="15" r="5" fill="#fff"/><circle cx="31" cy="33" r="5" fill="#fff"/></svg>`,

  // Close — two strokes, matching the drawn-icon language.
  close: `<svg viewBox="0 0 48 48" fill="none" stroke="#1A1A2E" stroke-width="4.5" stroke-linecap="round"><line x1="12" y1="12" x2="36" y2="36"/><line x1="36" y1="12" x2="12" y2="36"/></svg>`,

  // Author / signature mark.
  author: `<svg viewBox="0 0 48 48"><path d="M8 34c6-2 10-8 14-15s7-11 10-11 4 4 1 9-9 11-14 15-8 5-11 2z" ${S}/><line x1="8" y1="40" x2="40" y2="40" stroke="#1A1A2E" stroke-width="3" stroke-linecap="round"/></svg>`,
};

/** Wraps an icon in a sized span. `size` is any CSS length. */
export function icon(name, size = "24px") {
  return `<span class="icon" style="width:${size};height:${size}">${ICONS[name] || ""}</span>`;
}
