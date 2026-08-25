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
    items: [],           // books, lps, music, photos all live here (type: field)
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

    transitionSwap(() => {
      const container = document.getElementById("view");
      container.innerHTML = "";
      this.modules[view].render(container, store);
    }, direction);

    if (this.onNavigate) this.onNavigate(view, opts);

    const isHome = view === "home";
    const mod = this.modules[view];
    const supportsAdd = !isHome && mod.openAddForm && !mod.openAddForm.isPlaceholder;

    const addBtn = document.getElementById("addBtn");
    if (addBtn) addBtn.classList.toggle("hidden", !supportsAdd);

    const backArrow = document.getElementById("backArrow");
    if (backArrow) backArrow.classList.toggle("hidden", isHome);
  },
};
