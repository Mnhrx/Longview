// ============================================
// Cover storage — the pictures, kept in IndexedDB.
//
// Why not localStorage, where the rest of the state lives: it holds ~5MB and
// only holds text, so an image has to be base64'd, which inflates it by a
// third. A 38KB cover becomes 51KB of string, ~70 of them fill the whole
// budget, and then EVERY write fails — including saving a review. IndexedDB
// takes blobs as blobs and offers hundreds of megabytes.
//
// Two kinds of entry, and the difference matters:
//
//   * PERMANENT — photos you took yourself. Irreplaceable, never evicted,
//     included in backups.
//   * CACHED — covers downloaded from Open Library or Cover Art Archive.
//     Disposable by definition: the source still has them, so losing one costs
//     a refetch and nothing else.
//
// Because the cached half is evictable, the cache is capped well under
// whatever the browser offers and drops least-recently-shown entries when it
// fills. That's what makes this sustainable — not a bigger quota, but never
// needing to approach one.
// ============================================

const DB_NAME = "stackt-covers";
const DB_VERSION = 1;
const STORE = "covers";

/** Cached covers only. Own photos sit outside this and are never evicted. */
export const CACHE_CAP_BYTES = 150 * 1024 * 1024;

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no indexedDB"));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: "key" });
        os.createIndex("lastUsed", "lastUsed");
        os.createIndex("permanent", "permanent");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).catch((err) => {
    // Private browsing and locked-down configurations can refuse outright.
    // Everything below degrades to "no cache", which is just today's behaviour.
    console.warn("Cover store unavailable:", err);
    return null;
  });
  return dbPromise;
}

function tx(db, mode) {
  return db.transaction(STORE, mode).objectStore(STORE);
}

function wrap(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ---------- reading ----------

/** The stored record, or null. Bumps lastUsed so eviction knows what's live. */
export async function getRecord(key) {
  const db = await openDb();
  if (!db || !key) return null;
  try {
    const rec = await wrap(tx(db, "readonly").get(key));
    if (!rec) return null;
    // Fire-and-forget: a read shouldn't wait on its own bookkeeping.
    touch(key);
    return rec;
  } catch (err) {
    return null;
  }
}

let touchQueue = new Set();
let touchTimer = null;

/** Batched, because scrolling a list touches a lot of covers at once. */
function touch(key) {
  touchQueue.add(key);
  if (touchTimer) return;
  touchTimer = setTimeout(async () => {
    const keys = [...touchQueue];
    touchQueue = new Set();
    touchTimer = null;
    const db = await openDb();
    if (!db) return;
    try {
      const store = tx(db, "readwrite");
      const now = Date.now();
      keys.forEach((k) => {
        const g = store.get(k);
        g.onsuccess = () => {
          if (g.result) store.put({ ...g.result, lastUsed: now });
        };
      });
    } catch (err) {
      /* bookkeeping only */
    }
  }, 1500);
}

const urlCache = new Map(); // key -> object URL, so we don't re-create per render

/**
 * How many object URLs we'll hold open at once.
 *
 * This used to be unbounded, which was a slow poison: every cover you had ever
 * scrolled past kept a live handle for the whole session, so an afternoon of
 * browsing a few hundred covers left a few hundred blob handles pinned. iOS
 * reclaims that kind of memory without asking, and a reclaimed handle is a
 * cover that silently never loads again. Holding fewer is the actual fix; the
 * retry below is the safety net for when one dies anyway.
 */
const URL_CACHE_MAX = 200;

/**
 * A URL you can put straight into an <img>, or null if we don't hold this one.
 *
 * Object URLs are kept in a map rather than created per call: making a fresh
 * one on every render leaks a handle each time, and revoking eagerly races
 * against images that haven't decoded yet.
 */
export async function localUrl(key) {
  if (!key) return null;
  if (urlCache.has(key)) {
    const url = urlCache.get(key);
    // Re-insert so the map stays in least-recently-used order.
    urlCache.delete(key);
    urlCache.set(key, url);
    return url;
  }
  const rec = await getRecord(key);
  if (!rec || !rec.blob) return null;
  const url = URL.createObjectURL(rec.blob);
  urlCache.set(key, url);
  trimUrlCache();
  return url;
}

/** Is anything on screen currently pointed at this URL? */
function onScreen(url) {
  if (typeof document === "undefined") return false;
  try {
    return !!document.querySelector(`img[src="${url}"]`);
  } catch (err) {
    return false; // an unusual URL that won't go in a selector: assume in use
  }
}

/**
 * Releases the oldest handles once we're over the cap.
 *
 * Deliberately skips anything still displayed — revoking the URL out from
 * under a visible <img> is precisely the failure we're here to stop, and it
 * would be a poor joke to cause it ourselves.
 */
function trimUrlCache() {
  if (urlCache.size <= URL_CACHE_MAX) return;
  for (const [key, url] of [...urlCache]) {
    if (urlCache.size <= URL_CACHE_MAX) break;
    if (onScreen(url)) continue;
    URL.revokeObjectURL(url);
    urlCache.delete(key);
  }
}

function forgetUrl(key) {
  const url = urlCache.get(key);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(key);
  }
}

/**
 * Same bytes, a brand-new object URL.
 *
 * The second rung of the retry ladder: when a cached URL stops working, the
 * blob behind it is usually still perfectly good and only the handle has gone
 * stale, so rebuilding costs one IndexedDB read and fixes it outright.
 */
export async function rebuildUrl(key) {
  if (!key) return null;
  forgetUrl(key);
  return localUrl(key);
}

/** How many handles we're holding — for the Settings cover check. */
export function liveUrlCount() {
  return urlCache.size;
}

// ---------- writing ----------

export async function putBlob(key, blob, { permanent = false } = {}) {
  const db = await openDb();
  if (!db || !key || !blob) return false;
  try {
    await wrap(
      tx(db, "readwrite").put({
        key,
        blob,
        bytes: blob.size,
        permanent: permanent ? 1 : 0,
        lastUsed: Date.now(),
      })
    );
    forgetUrl(key); // the next read rebuilds it from the new bytes
    if (!permanent) enforceCap();
    return true;
  } catch (err) {
    console.warn("Could not store cover:", err);
    return false;
  }
}

export async function deleteBlob(key) {
  const db = await openDb();
  if (!db || !key) return;
  try {
    await wrap(tx(db, "readwrite").delete(key));
    forgetUrl(key);
  } catch (err) {
    /* nothing to do */
  }
}

// ---------- encoding ----------

/**
 * Re-encodes an image to WebP at a sensible size for a cover.
 *
 * WebP is ~35% smaller than JPEG at the same quality and iOS has supported it
 * since iOS 14; if a browser can't produce it, toBlob falls back to PNG and we
 * try JPEG instead rather than storing something enormous.
 */
export function encodeCover(source, maxEdge = 400, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const draw = (img) => {
      const scale = Math.min(1, maxEdge / Math.max(img.width || 1, img.height || 1));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round((img.width || maxEdge) * scale));
      canvas.height = Math.max(1, Math.round((img.height || maxEdge) * scale));
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (blob && blob.type === "image/webp") return resolve(blob);
          canvas.toBlob(
            (jpg) => (jpg ? resolve(jpg) : reject(new Error("Could not encode that image"))),
            "image/jpeg",
            quality
          );
        },
        "image/webp",
        quality
      );
    };

    if (source instanceof HTMLImageElement && source.complete) return draw(source);

    const img = new Image();
    img.onload = () => draw(img);
    img.onerror = () => reject(new Error("That file isn't an image we can read"));
    if (source instanceof Blob) {
      const url = URL.createObjectURL(source);
      img.onload = () => { draw(img); URL.revokeObjectURL(url); };
      img.src = url;
    } else {
      img.src = source;
    }
  });
}

// ---------- remote covers ----------

/** A stable key for a downloaded cover: the URL it came from. */
export function remoteKey(url) {
  return url ? `remote:${url}` : null;
}

/** A key for a photo the user supplied, tied to the item it belongs to. */
export function ownKey(itemId) {
  return itemId ? `own:${itemId}` : null;
}

/**
 * Downloads a cover and files it in the cache.
 *
 * Uses fetch, which needs CORS permission — the same permission the share
 * canvas needs. When it's refused we simply don't cache: the app carries on
 * pointing <img> at the remote URL exactly as before, so a strict source costs
 * you the offline copy, not the cover.
 */
export async function cacheRemote(url) {
  if (!url || String(url).startsWith("data:")) return null;
  const key = remoteKey(url);
  const existing = await localUrl(key);
  if (existing) return existing;
  try {
    const res = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!res.ok) return null;
    const raw = await res.blob();
    if (!raw || !raw.size) return null;
    let blob = raw;
    try {
      blob = await encodeCover(raw);
    } catch (e) {
      /* store what we fetched if re-encoding fails */
    }
    await putBlob(key, blob, { permanent: false });
    return localUrl(key);
  } catch (err) {
    return null; // CORS refusal, offline, rate limit — all the same to us
  }
}

// ---------- accounting + eviction ----------

export async function usage() {
  const db = await openDb();
  if (!db) return { cachedBytes: 0, cachedCount: 0, ownBytes: 0, ownCount: 0, quotaBytes: null };
  const out = { cachedBytes: 0, cachedCount: 0, ownBytes: 0, ownCount: 0, quotaBytes: null };
  try {
    const all = await wrap(tx(db, "readonly").getAll());
    all.forEach((rec) => {
      if (rec.permanent) {
        out.ownBytes += rec.bytes || 0;
        out.ownCount++;
      } else {
        out.cachedBytes += rec.bytes || 0;
        out.cachedCount++;
      }
    });
  } catch (err) {
    /* report zeroes rather than fail */
  }
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const est = await navigator.storage.estimate();
      out.quotaBytes = est.quota || null;
    } catch (e) { /* optional */ }
  }
  return out;
}

let enforcing = false;

/** Drops the least-recently-shown CACHED covers until back under the cap. */
export async function enforceCap() {
  if (enforcing) return;
  enforcing = true;
  try {
    const db = await openDb();
    if (!db) return;
    const all = await wrap(tx(db, "readonly").getAll());
    const cached = all.filter((r) => !r.permanent);
    let total = cached.reduce((n, r) => n + (r.bytes || 0), 0);
    if (total <= CACHE_CAP_BYTES) return;

    cached.sort((a, b) => (a.lastUsed || 0) - (b.lastUsed || 0)); // oldest first
    for (const rec of cached) {
      if (total <= CACHE_CAP_BYTES * 0.9) break; // trim below the line, not to it
      await deleteBlob(rec.key);
      total -= rec.bytes || 0;
    }
  } catch (err) {
    console.warn("Cache trim failed:", err);
  } finally {
    enforcing = false;
  }
}

/** Empties the cached half. Own photos are untouched. */
export async function clearCache() {
  const db = await openDb();
  if (!db) return 0;
  try {
    const all = await wrap(tx(db, "readonly").getAll());
    const cached = all.filter((r) => !r.permanent);
    for (const rec of cached) await deleteBlob(rec.key);
    return cached.length;
  } catch (err) {
    return 0;
  }
}

/** Every own-photo record, for putting real images into a backup. */
export async function allOwnRecords() {
  const db = await openDb();
  if (!db) return [];
  try {
    const all = await wrap(tx(db, "readonly").getAll());
    return all.filter((r) => r.permanent);
  } catch (err) {
    return [];
  }
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}

// ---------- the one entry point the UI uses ----------

/**
 * Points an <img> at the best available source for a cover.
 *
 * Call it exactly where `img.src = …` used to go; handlers already attached
 * still fire normally. Order of preference:
 *
 *   1. an "own:" key   — your photo, straight out of the blob store
 *   2. a cached copy of this remote URL — instant, offline, same-origin
 *   3. the remote URL itself — and if it loads, it's cached for next time
 *
 * Step 3 is why this is a read-THROUGH cache: nothing has to be pre-fetched,
 * the library simply gets faster and more self-sufficient as you browse it.
 */
export async function setCoverSrc(img, src) {
  if (!img || !src) return;

  // Only a genuinely cross-origin URL wants crossOrigin. Setting it on a
  // blob: or data: URL is at best pointless and, in WebKit, fatal — the load
  // just fails. Assigned before src, since changing it afterwards is ignored.
  const isLocal = (url) => /^(blob:|data:)/.test(url);
  const point = (url) => {
    if (isLocal(url)) img.removeAttribute("crossorigin");
    else img.crossOrigin = "anonymous";
    img.src = url;
  };

  const s = String(src);
  const own = s.startsWith("own:");
  const data = s.startsWith("data:");
  const key = own ? s : data ? null : remoteKey(s);

  /**
   * The ladder, most local rung first. Each returns a URL or null.
   *
   *   1. the cached object URL      — instant, and right almost always
   *   2. the same blob, rebuilt     — fixes a handle that went stale
   *   3. the network                — fixes a blob that went bad
   *
   * A photo you took has no third rung; there is nowhere to re-fetch it from.
   */
  const ladder = data
    ? [async () => s]
    : [
        () => localUrl(key),
        () => rebuildUrl(key),
        ...(own
          ? []
          : [
              async () => {
                // We only get here because the stored copy failed twice. It's
                // a cached download, disposable by definition, so bin it and
                // fetch a clean one — the read-through at the bottom has
                // already run by now and would have found the bad record.
                await deleteBlob(key);
                cacheRemote(s);
                return s;
              },
            ]),
      ];

  let rung = 0;
  let rounds = 0;

  const advance = async () => {
    while (rung < ladder.length) {
      let url = null;
      try {
        url = await ladder[rung++]();
      } catch (err) {
        url = null;
      }
      if (url) {
        point(url);
        return true;
      }
    }
    return false;
  };

  /**
   * Recovery is armed for the life of the element, not just the first paint.
   *
   * That matters because the most annoying version of this bug doesn't happen
   * during a render at all: the app sits in the background, the system throws
   * away the decoded images, and when you come back the <img> tries to redraw
   * itself from a handle that no longer works. There's no re-render to hang a
   * fix on — the element just fails on its own. So a successful load resets
   * the ladder rather than closing it, and the picture repairs itself in
   * place. Capped at a few rounds so a genuinely missing cover can't spin.
   */
  img.addEventListener("error", async () => {
    if (rounds > 3) return;
    if (!(await advance())) rounds = 99; // out of rungs; stop trying
  });
  img.addEventListener("load", () => {
    rung = 0;
    rounds++;
  });

  if (!(await advance())) {
    // Nothing to show at all. dispatchEvent rather than calling img.onerror,
    // because half the call sites attach their fallback with addEventListener
    // and a direct call skips those entirely.
    img.dispatchEvent(new Event("error"));
    return;
  }

  // Read-through: keep a private copy for next time. Self-guarding — it
  // returns early if we already hold this one — so it's safe on every path.
  if (!own && !data) cacheRemote(s);
}
