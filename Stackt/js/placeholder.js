// ============================================
// Placeholder module factory — used for modules not built out yet
// (LPs, Music, Photos, Finance). Keeps navigation working end-to-end
// while those get built module-by-module.
// ============================================

import { ICONS } from "./icons.js";

export function makePlaceholder(iconKey, label) {
  function openAddForm() {
    // no-op until this module is built
  }
  openAddForm.isPlaceholder = true;

  return {
    render(container) {
      container.innerHTML = `
        <div class="coming-soon">
          <span class="coming-soon-icon">${ICONS[iconKey] || ""}</span>
          <h2>${label}</h2>
          <p>This module is coming soon — same app, same data, new screen.</p>
        </div>
      `;
    },
    openAddForm,
  };
}
