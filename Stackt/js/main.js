// ============================================
// Entry point — wires Core, registers modules, hooks up header + add button,
// registers the service worker, and connects navigation to browser history
// so iOS edge-swipe-back and Android's back button work natively.
// ============================================

import { store, router } from "./core.js";
import homeModule, { startMenuIntro } from "./home.js";
import booksModule from "./books.js";
import lpsModule from "./lps.js";
import settingsModule from "./settings.js";
import { makePlaceholder } from "./placeholder.js";
import { bounceTap } from "./animations.js";
import { ICONS } from "./icons.js";
import { syncLayersTo, layerDepth } from "./ui.js";

router.register("home", homeModule);
router.register("books", booksModule);
router.register("settings", settingsModule);
router.register("lps", lpsModule);
router.register("photos", makePlaceholder("photos", "Photos"));
router.register("finance", makePlaceholder("finance", "Finance"));

async function boot() {
  await store.init();
  // Runs once: after the first launch on this build there's nothing left to
  // move. Deliberately awaited, so no screen renders against half-migrated
  // items and shows a cover that's about to change shape underneath it.
  await store.migrateCovers();

  // ---- history-driven navigation ----
  // Every screen change pushes a history entry, so the platform's own back
  // affordances (iOS edge-swipe, Android back button, desktop back) just work.
  // No custom gesture handling to fight Safari over.
  router.onNavigate = (view, opts = {}) => {
    if (opts.fromPopState) return; // already a history event, don't re-push
    const state = { view, depth: 0 };
    if (opts.replace) history.replaceState(state, "", `#${view}`);
    else history.pushState(state, "", `#${view}`);
  };

  // history.back() fires popstate identically whether it came from our own
  // back button or an edge-swipe, so the button flags itself on the way out.
  let backViaButton = false;

  window.addEventListener("popstate", (e) => {
    // Every open layer owns a history entry, so the entry we've just landed on
    // tells us exactly how many should still be showing. Close down to that —
    // no interception, no re-pushing, nothing that can fight the gesture.
    const targetDepth = (e.state && e.state.depth) || 0;
    if (layerDepth() > targetDepth) {
      syncLayersTo(targetDepth);
      return; // a layer absorbed this back; the screen itself doesn't change
    }

    const view = (e.state && e.state.view) || viewFromHash() || "home";
    const viaGesture = !backViaButton;
    backViaButton = false;
    router.navigate(view, { fromPopState: true, direction: "back", viaGesture });
  });

  document.getElementById("homeBtn").addEventListener("click", () => {
    if (router.current === "home") return;
    backViaButton = true;
    history.back(); // let the history stack drive it, same as a swipe
  });

  const settingsBtn = document.getElementById("settingsBtn");
  settingsBtn.innerHTML = ICONS.settings;
  settingsBtn.addEventListener("click", (e) => {
    bounceTap(e.currentTarget);
    router.navigate("settings");
  });

  const shareShelfBtn = document.getElementById("shareShelfBtn");
  shareShelfBtn.innerHTML = ICONS.share;
  shareShelfBtn.addEventListener("click", (e) => {
    bounceTap(e.currentTarget);
    const mod = router.modules[router.current];
    if (mod && mod.openShelfShare) mod.openShelfShare(store, document.getElementById("view"));
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

  hideSplash();
}

/**
 * Dismisses the splash, then plays the menu's zoom-out.
 *
 * The order matters: previously the menu rendered and animated *underneath*
 * the splash, so by the time the splash faded the animation had already
 * finished and you got a static menu. The intro is held back until the splash
 * is actually out of the way.
 */
function hideSplash() {
  const splash = document.getElementById("splash");
  window.__stacktSplashUp = false;
  if (!splash) {
    document.documentElement.classList.remove("splash-up");
    startMenuIntro();
    return;
  }
  const MIN_MS = 500;
  const wait = Math.max(0, MIN_MS - (Date.now() - BOOT_STARTED));
  setTimeout(() => {
    splash.classList.add("done");
    splash.addEventListener("transitionend", onGone, { once: true });
    setTimeout(onGone, 420); // belt and braces if transitionend doesn't fire
  }, wait);

  let finished = false;
  function onGone() {
    if (finished) return;
    finished = true;
    splash.remove();
    document.documentElement.classList.remove("splash-up");
    startMenuIntro();
  }
}

const BOOT_STARTED = Date.now();
window.__stacktSplashUp = true; // home holds its intro while this is true

function viewFromHash() {
  const raw = (location.hash || "").replace(/^#/, "");
  return router.modules[raw] ? raw : null;
}

boot().catch((err) => {
  console.error("Boot failed", err);
  hideSplash(); // never leave the user staring at a splash that won't clear
});
