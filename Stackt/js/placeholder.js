// ============================================
// Placeholder module factory — used for modules not built out yet
// (LPs, Music, Photos, Finance). Keeps the tab bar fully working end-to-end
// while those get built module-by-module.
// ============================================

export function makePlaceholder(emoji, label) {
  function openAddForm() {
    // no-op until this module is built
  }
  openAddForm.isPlaceholder = true;

  return {
    render(container) {
      container.innerHTML = `
        <div class="coming-soon">
          <span class="coming-soon-emoji">${emoji}</span>
          <h2>${label}</h2>
          <p>This module is coming soon — same app, same data, new screen.</p>
        </div>
      `;
    },
    openAddForm,
  };
}
