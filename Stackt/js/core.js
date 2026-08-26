// ============================================
// Core — shared state store + router.
// Every module reads/writes through `store`, and switches screens through
// `router.navigate()`. Nothing else in the app touches localStorage directly.
// ============================================

import { transitionSwap } from "./animations.js";
import { clearAllLayers } from "./ui.js";

const STORAGE_KEY = "stackt-state-v1";

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export const store = {
  state: {
    items: [],           // books, lps, photos all live here (type: field)
    finance: {
      balance: 0,
      spendingLog: [],    // { id, date, amount, note, itemId }
    },
  },
  listeners: [],

  async init() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      this.state = JSON.parse(saved);
      return;
    }
    // first run: seed from data/seed.json so the app isn't empty
    try {
      const res = await fetch("data/seed.json");
      const seed = await res.json();
      this.state.items = seed.books || [];
      this.save();
    } catch (e) {
      console.warn("No seed data loaded, starting empty.", e);
    }
  },

  get() {
    return this.state;
  },

  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  },

  /** Merge a partial state patch, persist, and notify subscribers. */
  update(patch) {
    this.state = { ...this.state, ...patch };
    this.save();
    this.listeners.forEach((fn) => fn(this.state));
  },

  addItem(item) {
    const full = { id: uid(), addedDate: new Date().toISOString().slice(0, 10), ...item };
    this.update({ items: [...this.state.items, full] });
    return full;
  },

  updateItem(id, patch) {
    this.update({
      items: this.state.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    });
  },

  removeItem(id) {
    this.update({ items: this.state.items.filter((it) => it.id !== id) });
  },

  itemsByType(type) {
    return this.state.items.filter((it) => it.type === type);
  },

  /** Find an existing item of a given type by its ISBN (or other barcode-ish id). */
  findByIsbn(type, isbn) {
    if (!isbn) return null;
    return this.state.items.find((it) => it.type === type && it.isbn === isbn) || null;
  },

  logSpend(amount, note, itemId = null) {
    const entry = { id: uid(), date: new Date().toISOString().slice(0, 10), amount, note, itemId };
    this.update({
      finance: {
        ...this.state.finance,
        balance: this.state.finance.balance - amount,
        spendingLog: [entry, ...this.state.finance.spendingLog],
      },
    });
    return entry;
  },

  /** Everything worth keeping, in a versioned envelope so a future build can
   *  recognise and migrate an older backup. */
  exportBundle() {
    return {
      app: "stackt",
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      state: this.state,
    };
  },

  /** Replaces everything from a backup. Throws with a readable message if the
   *  file isn't one of ours, so the UI can say what's wrong. */
  importBundle(bundle) {
    if (!bundle || typeof bundle !== "object") throw new Error("That file isn't readable.");
    if (bundle.app !== "stackt") throw new Error("That doesn't look like a Stackt backup.");
    const incoming = bundle.state;
    if (!incoming || !Array.isArray(incoming.items)) throw new Error("That backup is missing its library.");

    this.state = {
      items: incoming.items,
      finance: incoming.finance || { balance: 0, spendingLog: [] },
    };
    this.save();
    this.listeners.forEach((fn) => fn(this.state));
    return this.state.items.length;
  },

  /** Back to a blank app. The seed deliberately does NOT run again — it only
   *  fills a first launch, and re-seeding demo books here would be a surprise. */
  resetAll() {
    this.state = { items: [], finance: { balance: 0, spendingLog: [] } };
    this.save();
    this.listeners.forEach((fn) => fn(this.state));
  },

  subscribe(fn) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  },
};

export const router = {
  // null until the first navigate() — otherwise booting straight to "home"
  // would look like a no-op navigation and never render.
  current: null,
  modules: {}, // registered as { home: { render }, books: { render, openAddForm }, ... }
  onNavigate: null, // main.js hooks history into this

  register(name, mod) {
    this.modules[name] = mod;
  },

  navigate(view, opts = {}) {
    if (!this.modules[view]) return;
    if (view === this.current && !opts.force) {
      if (this.onNavigate) this.onNavigate(view, opts);
      return;
    }

    // Nothing outlives a screen change — a stray overlay left floating would
    // block every tap on the new screen.
    clearAllLayers();

    // Home is the root, so anything leaving it goes "forward" and anything
    // returning to it goes "back" — that drives which way the screen slides.
    const direction = opts.direction || (view === "home" ? "back" : "forward");
    this.current = view;

    const isHome = view === "home";
    const paint = () => {
      const container = document.getElementById("view");
      container.innerHTML = "";
      // A back *gesture* is already animated by iOS, which paints its own
      // snapshot of the previous screen first. Replaying our animation on top
      // is the "static, then re-animates" flash — so the menu sits still for
      // gesture-backs and animates for taps and fresh loads.
      this.modules[view].render(container, store, { animate: !opts.viaGesture });
      applyChrome(view, isHome, this.modules[view]);
    };

    // Going home is carried by the menu's own zoom-out, so no slide on top of it.
    transitionSwap(paint, direction, { silent: !!opts.fromPopState || isHome });

    if (this.onNavigate) this.onNavigate(view, opts);
  },
};

/** Header + theming that follows the active screen. Runs inside the paint so
 *  it lands on the same frame as the new content, not a frame later. */
function applyChrome(view, isHome, mod) {
  const app = document.getElementById("app");
  if (app) {
    if (isHome) app.removeAttribute("data-module");
    else app.dataset.module = view;
  }

  const supportsAdd = !isHome && mod.openAddForm && !mod.openAddForm.isPlaceholder;
  const addBtn = document.getElementById("addBtn");
  if (addBtn) addBtn.classList.toggle("hidden", !supportsAdd);

  // Home has nothing to add, so it carries settings instead.
  const settingsBtn = document.getElementById("settingsBtn");
  if (settingsBtn) settingsBtn.classList.toggle("hidden", !isHome);

  const backArrow = document.getElementById("backArrow");
  if (backArrow) backArrow.classList.toggle("hidden", isHome);
}
