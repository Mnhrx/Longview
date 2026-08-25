// ============================================
// Entry point — wires Core, registers modules, hooks up header + add button,
// registers the service worker, and connects navigation to browser history
// so iOS edge-swipe-back and Android's back button work natively.
// ============================================

import { store, router } from "./core.js";
import homeModule from "./home.js";
import booksModule from "./books.js";
import { makePlaceholder } from "./placeholder.js";
import { bounceTap } from "./animations.js";
import { closeTopLayer } from "./ui.js";

router.register("home", homeModule);
router.register("books", booksModule);
router.register("lps", makePlaceholder("lps", "LPs"));
router.register("music", makePlaceholder("music", "Music"));
router.register("photos", makePlaceholder("photos", "Photos"));
router.register("finance", makePlaceholder("finance", "Finance"));

async function boot() {
  await store.init();

  // ---- history-driven navigation ----
  // Every screen change pushes a history entry, so the platform's own back
  // affordances (iOS edge-swipe, Android back button, desktop back) just work.
  // No custom gesture handling to fight Safari over.
  router.onNavigate = (view, opts = {}) => {
    if (opts.fromPopState) return; // already a history event, don't re-push
    const state = { view };
    if (opts.replace) history.replaceState(state, "", `#${view}`);
    else history.pushState(state, "", `#${view}`);
  };

  window.addEventListener("popstate", (e) => {
    // Overlays are layers of their own: back peels off the topmost one
    // (cover lightbox, then modal sheet) before it changes screens.
    if (closeTopLayer()) {
      // re-push so the screen itself stays put after the layer closes
      history.pushState({ view: router.current }, "", `#${router.current}`);
      return;
    }
    const view = (e.state && e.state.view) || viewFromHash() || "home";
    router.navigate(view, { fromPopState: true, direction: "back" });
  });

  document.getElementById("homeBtn").addEventListener("click", () => {
    if (router.current === "home") return;
    history.back(); // let the history stack drive it, same as a swipe
  });

  document.getElementById("addBtn").addEventListener("click", (e) => {
    bounceTap(e.currentTarget);
    const mod = router.modules[router.current];
    if (mod && mod.openAddForm) {
      mod.openAddForm(store, document.getElementById("view"));
    }
  });

  const initial = viewFromHash() || "home";
  router.navigate(initial, { replace: true });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
}

function viewFromHash() {
  const raw = (location.hash || "").replace(/^#/, "");
  return router.modules[raw] ? raw : null;
}

boot();
