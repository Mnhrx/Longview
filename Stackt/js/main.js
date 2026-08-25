// ============================================
// Entry point — wires Core, registers modules, hooks up header + add button,
// registers the service worker.
// ============================================

import { store, router } from "./core.js";
import homeModule from "./home.js";
import booksModule from "./books.js";
import { makePlaceholder } from "./placeholder.js";
import { bounceTap } from "./animations.js";

router.register("home", homeModule);
router.register("books", booksModule);
router.register("lps", makePlaceholder("💿", "LPs"));
router.register("music", makePlaceholder("🎧", "Music"));
router.register("photos", makePlaceholder("📷", "Photos"));
router.register("finance", makePlaceholder("💰", "Finance"));

async function boot() {
  await store.init();

  document.getElementById("homeBtn").addEventListener("click", () => {
    router.navigate("home");
  });

  document.getElementById("addBtn").addEventListener("click", (e) => {
    bounceTap(e.currentTarget);
    const mod = router.modules[router.current];
    if (mod && mod.openAddForm) {
      mod.openAddForm(store, document.getElementById("view"));
    }
  });

  router.navigate("home");

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
}

boot();
