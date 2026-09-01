// ============================================
// Core — shared state store + router.
// Every module reads/writes through `store`, and switches screens through
// `router.navigate()`. Nothing else in the app touches localStorage directly.
// ============================================

import { transitionSwap } from "./animations.js";
import { clearAllLayers } from "./ui.js";
import { ownKey, putBlob, deleteBlob, dataUrlToBlob, blobToDataUrl, getRecord, allOwnRecords, encodeCover } from "./covers.js";
import { workKey } from "./sorting.js";

const STORAGE_KEY = "stackt-state-v1";

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export const store = {
  state: {
    items: [],           // books, lps, words, photos all live here (type: field)
    declined: [],        // priced wants you deleted without buying
    budget: {},          // { monthly, setAside, order, pinned } — the wishlist plan
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

  /**
   * Moves photos out of localStorage and into the blob store.
   *
   * Own-photo covers were saved as base64 data URLs alongside the text, which
   * is what put the 5MB ceiling within reach. Each one moves across, gets
   * re-encoded smaller, and leaves behind only a key — so a library that was
   * close to the limit drops back to a few KB of text.
   *
   * Deliberately forgiving: any photo that won't move is left exactly where it
   * is and still displays. A migration that loses a picture would be far worse
   * than one that doesn't finish.
   */
  async migrateCovers() {
    const withPhotos = this.state.items.filter(
      (it) => typeof it.customCover === "string" && it.customCover.startsWith("data:")
    );
    if (!withPhotos.length) return 0;

    let moved = 0;
    for (const item of withPhotos) {
      try {
        const raw = await dataUrlToBlob(item.customCover);
        let blob = raw;
        try { blob = await encodeCover(raw); } catch (e) { /* keep the original */ }
        const key = ownKey(item.id);
        if (await putBlob(key, blob, { permanent: true })) {
          item.coverRef = key;
          item.customCover = null;
          moved++;
        }
      } catch (err) {
        console.warn("Left a photo where it was:", err);
      }
    }
    if (moved) this.save();
    return moved;
  },

  /**
   * Brings existing per-edition reviews up to the work.
   *
   * Reviews used to belong to one printing, so owning two editions could hide
   * the review you wrote. Each work's editions are reconciled to a single
   * review and rating. Where two editions disagree the LONGER review wins and
   * the higher rating is kept — silently binning something you wrote would be
   * the one unforgivable outcome here.
   */
  mergeWorkReviews() {
    const groups = new Map();
    this.state.items
      .filter((it) => it.type === "book")
      .forEach((b) => {
        const k = workKey(b);
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(b);
      });

    let changed = 0;
    groups.forEach((editions) => {
      if (editions.length < 2) return;
      const reviewed = editions
        .filter((b) => (b.review && b.review.trim()) || b.rating)
        .sort((a, b) => (b.review || "").length - (a.review || "").length);
      if (!reviewed.length) return;

      const best = {
        review: reviewed[0].review || null,
        rating: Math.max(...editions.map((b) => Number(b.rating) || 0)) || null,
        reviewDate: reviewed[0].reviewDate || null,
      };
      editions.forEach((b) => {
        if (b.review === best.review && b.rating === best.rating) return;
        b.review = best.review;
        b.rating = best.rating;
        b.reviewDate = best.reviewDate;
        changed++;
      });
    });
    if (changed) this.save();
    return changed;
  },

  get() {
    return this.state;
  },

  /**
   * Persists to localStorage, which is capped at ~5MB.
   *
   * That cap used to be able to break the app silently: once it was reached
   * every subsequent write threw, so adding a book, ticking one as read and
   * saving a review all failed with nothing on screen to say why. Images are
   * the only thing large enough to get near it — they now live in IndexedDB
   * (see covers.js) — but the guard stays, because a store that can fail
   * quietly is worse than one that says so.
   */
  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      this.saveError = null;
      return true;
    } catch (err) {
      const full =
        err &&
        (err.name === "QuotaExceededError" ||
          err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
          err.code === 22);
      this.saveError = full
        ? "This device's storage for Stackt is full, so that change wasn't saved. Settings → Storage can free some up."
        : "That change couldn't be saved to this device.";
      console.warn("Save failed:", err);
      this.listeners.forEach((fn) => {
        try { fn(this.state); } catch (e) { /* a listener must not mask this */ }
      });
      return false;
    }
  },

  /** Set when the last save failed; null when all is well. */
  saveError: null,

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

  /**
   * Deleting a priced wishlist item is a decision, so it's recorded.
   *
   * It's the only thing the Wishlist module can't read off an item, because
   * the item is about to stop existing. Kept deliberately small — a name and
   * a number — and honest about what it is: things you decided against, which
   * is not quite the same as money saved. You might have lost interest, or
   * bought it somewhere the app never saw.
   */
  removeItem(id) {
    const item = this.state.items.find((it) => it.id === id);
    const wasAWant =
      item &&
      (item.type === "book" || item.type === "lp") &&
      !(item.copies || []).length &&
      !item.borrowed &&
      item.price != null;

    const patch = { items: this.state.items.filter((it) => it.id !== id) };
    if (wasAWant) {
      patch.declined = [
        {
          id: uid(),
          title: item.title,
          type: item.type,
          price: Number(item.price),
          date: new Date().toISOString().slice(0, 10),
        },
        ...(this.state.declined || []),
      ].slice(0, 200); // a tally, not an archive
    }
    this.update(patch);
  },

  itemsByType(type) {
    return this.state.items.filter((it) => it.type === type);
  },

  /** Find an existing item of a given type by its ISBN (or other barcode-ish id). */
  findByIsbn(type, isbn) {
    if (!isbn) return null;
    return this.state.items.find((it) => it.type === type && it.isbn === isbn) || null;
  },


  /** Everything worth keeping, in a versioned envelope so a future build can
   *  recognise and migrate an older backup. */
  /**
   * A backup.
   *
   * Photos you took are irreplaceable, so they're inlined as data URLs and go
   * in every time. Downloaded covers are NOT: the source still has them, and
   * including a few hundred would turn a ~50KB text file into tens of
   * megabytes for no gain. `withPhotos: false` skips even your own, for when
   * you just want the catalogue.
   */
  async exportBundle({ withPhotos = true } = {}) {
    const bundle = {
      app: "stackt",
      formatVersion: 2,
      exportedAt: new Date().toISOString(),
      state: this.state,
    };
    if (!withPhotos) return bundle;

    const photos = {};
    for (const rec of await allOwnRecords()) {
      try {
        photos[rec.key] = await blobToDataUrl(rec.blob);
      } catch (err) {
        console.warn("Could not include a photo in the backup:", err);
      }
    }
    if (Object.keys(photos).length) bundle.photos = photos;
    return bundle;
  },

  /** Replaces everything from a backup. Throws with a readable message if the
   *  file isn't one of ours, so the UI can say what's wrong. */
  async importBundle(bundle) {
    if (!bundle || typeof bundle !== "object") throw new Error("That file isn't readable.");
    if (bundle.app !== "stackt") throw new Error("That doesn't look like a Stackt backup.");
    const incoming = bundle.state;
    if (!incoming || !Array.isArray(incoming.items)) throw new Error("That backup is missing its library.");

    // A v1/v2 backup may carry a `finance` block. It held a balance and a
    // spending log that nothing ever wrote to, so it is read and dropped
    // rather than carried forward.
    this.state = {
      items: incoming.items,
      declined: Array.isArray(incoming.declined) ? incoming.declined : [],
      budget: incoming.budget && typeof incoming.budget === "object" ? incoming.budget : {},
    };
    this.save();

    // Put the photos back where the items expect to find them. Downloaded
    // covers aren't in the file and don't need to be — they re-fetch on sight.
    if (bundle.photos) {
      for (const [key, dataUrl] of Object.entries(bundle.photos)) {
        try {
          await putBlob(key, await dataUrlToBlob(dataUrl), { permanent: true });
        } catch (err) {
          console.warn("Could not restore a photo:", err);
        }
      }
    }
    // A v1 backup still carries its photos inline, so move them across too.
    await this.migrateCovers();

    this.listeners.forEach((fn) => fn(this.state));
    return this.state.items.length;
  },

  /** Back to a blank app. The seed deliberately does NOT run again — it only
   *  fills a first launch, and re-seeding demo books here would be a surprise. */
  async resetAll() {
    // Take the photos with it — a reset that leaves 40MB of orphaned images
    // behind isn't a reset.
    for (const item of this.state.items) await deleteBlob(ownKey(item.id));
    this.state = { items: [], declined: [], budget: {} };
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
      // opts is forwarded, so one module can hand another a parameter — a book
      // detail sheet opening Words filtered to that book, say. `animate` is
      // written last so a caller's stray value can't override the gesture
      // handling above.
      this.modules[view].render(container, store, { ...opts, animate: !opts.viaGesture });
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

  // Sharing the whole shelf is a screen-level action, so it lives up here with
  // the +, not down in the list's search row where it crowded the search box.
  const supportsShare = !isHome && typeof mod.openShelfShare === "function";
  const shareBtn = document.getElementById("shareShelfBtn");
  if (shareBtn) shareBtn.classList.toggle("hidden", !supportsShare);

  // Home has nothing to add, so it carries settings instead.
  const settingsBtn = document.getElementById("settingsBtn");
  if (settingsBtn) settingsBtn.classList.toggle("hidden", !isHome);

  const backArrow = document.getElementById("backArrow");
  if (backArrow) backArrow.classList.toggle("hidden", isHome);
}
