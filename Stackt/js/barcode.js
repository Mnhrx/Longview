// ============================================
// Barcode scanning + ISBN lookup.
//
// Uses html5-qrcode (vendored in js/vendor/) rather than the browser-native
// BarcodeDetector API — Safari/iOS has never implemented BarcodeDetector,
// so relying on it meant the scanner silently couldn't work on iPhone.
// html5-qrcode decodes frames itself (camera + canvas), so it works the
// same way on iOS, Android, and desktop.
//
// It also exposes real camera zoom/torch control when the device supports
// it (Html5Qrcode.getRunningTrackCameraCapabilities()) — same mechanism
// Longview's scanner uses. Support is inconsistent on iOS specifically, so
// the zoom/torch controls simply don't appear when the hardware/browser
// doesn't expose them, rather than showing something that doesn't work.
// ============================================

let activeScanner = null;

export function isScanSupported() {
  return !!(
    navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia &&
    typeof window.Html5Qrcode !== "undefined"
  );
}

/**
 * Starts the camera inside the element with id `containerId` and scans for
 * a book barcode. Calls onDetect(isbn) once, the first time a code is read.
 * Throws if the camera can't be opened at all (caller should fall back to
 * manual entry).
 *
 * Resolves to a controller: { stop(), zoom: RangeControl|null, torch: BoolControl|null }
 * - zoom / torch are null when the device/browser doesn't expose them.
 */
export async function startScanner(containerId, onDetect) {
  const formats = (typeof window.Html5QrcodeSupportedFormats !== "undefined")
    ? [
        window.Html5QrcodeSupportedFormats.EAN_13,
        window.Html5QrcodeSupportedFormats.EAN_8,
        window.Html5QrcodeSupportedFormats.UPC_A,
        window.Html5QrcodeSupportedFormats.UPC_E,
        window.Html5QrcodeSupportedFormats.CODE_128,
        window.Html5QrcodeSupportedFormats.CODE_39,
        window.Html5QrcodeSupportedFormats.CODE_93,
        window.Html5QrcodeSupportedFormats.CODABAR,
        window.Html5QrcodeSupportedFormats.ITF,
        window.Html5QrcodeSupportedFormats.QR_CODE,
      ]
    : undefined;

  const html5Qrcode = new window.Html5Qrcode(
    containerId,
    formats ? { formatsToSupport: formats, verbose: false } : undefined
  );
  activeScanner = html5Qrcode;

  let detected = false;

  // Config matches Longview's scanner exactly (proven working on iOS Safari):
  // no qrbox — scanning the full camera frame avoids a cropped-region/video-sizing
  // mismatch that's a known cause of html5-qrcode silently failing to start on iOS.
  await html5Qrcode.start(
    { facingMode: "environment" },
    { fps: 15, disableFlip: false },
    (decodedText) => {
      if (detected) return; // ignore extra frames after the first hit
      detected = true;
      onDetect(decodedText.trim());
    },
    () => {
      // fires continuously while no code is in frame — not a real error
    }
  );

  // Zoom/torch: read/apply directly on the underlying MediaStreamTrack rather than
  // through html5-qrcode's own capabilities wrapper — this is what Longview does,
  // and it's the more broadly-supported path across browsers.
  let zoom = null;
  let torch = null;
  try {
    const videoEl = document.querySelector(`#${containerId} video`);
    const track = videoEl && videoEl.srcObject && videoEl.srcObject.getVideoTracks()[0];
    if (track) {
      const caps = track.getCapabilities ? track.getCapabilities() : {};
      if (caps.zoom) {
        zoom = {
          min: caps.zoom.min,
          max: Math.min(caps.zoom.max, 8),
          step: caps.zoom.step || 0.1,
          apply: (v) => track.applyConstraints({ advanced: [{ zoom: v }] }),
        };
      }
      if (caps.torch) {
        torch = { apply: (on) => track.applyConstraints({ advanced: [{ torch: on }] }) };
      }
    }
  } catch (e) {
    // capabilities API not available on this device/browser — no controls, scanning still works
  }

  async function stop() {
    if (activeScanner !== html5Qrcode) return; // already stopped
    activeScanner = null;
    try {
      if (html5Qrcode.isScanning) await html5Qrcode.stop();
      html5Qrcode.clear();
    } catch (e) {
      // already stopped/cleared — fine
    }
  }

  return { stop, zoom, torch };
}

/**
 * Does this string use the Latin alphabet? Used to decide which spelling of an
 * author's name to sort by — kanji and Cyrillic sort by code point, so mixing
 * them into an A–Z list dumps them all in a clump at the end.
 */
export function isLatinName(s) {
  if (!s) return true;
  const letters = String(s).replace(/[^\p{L}]/gu, "");
  if (!letters) return true;
  return /^\p{Script=Latin}+$/u.test(letters);
}

/** Pulls a 4-digit year out of whatever Open Library put in publish_date. */
function yearFrom(text) {
  const m = String(text || "").match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
  return m ? m[1] : "";
}

/** search.json carries two things the books API doesn't: a normalised first
 *  publication year, and the author's alternative spellings. */
async function lookupSearchMeta(isbn) {
  try {
    const res = await fetch(
      `https://openlibrary.org/search.json?q=isbn:${encodeURIComponent(isbn)}` +
      `&fields=first_publish_year,author_name,author_alternative_name&limit=1`
    );
    const data = await res.json();
    return (data.docs || [])[0] || null;
  } catch (err) {
    return null;
  }
}

/**
 * Looks up an ISBN against the Open Library API (free, no key required).
 * Returns { title, creator, creatorAlt, year, isbn } or null if nothing matched.
 *
 * `creator` is always the Latin spelling when one exists anywhere in the record,
 * so the alphabetical sort and the author list behave; `creatorAlt` keeps the
 * original script so nothing is thrown away.
 */
export async function lookupIsbn(isbn) {
  try {
    const [entry, meta] = await Promise.all([
      fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&jscmd=data&format=json`)
        .then((r) => r.json())
        .then((d) => d[`ISBN:${isbn}`] || null),
      lookupSearchMeta(isbn),
    ]);
    if (!entry) return null;

    const primary = (entry.authors || []).map((a) => a.name).join(", ");
    const alternatives = [
      ...(meta && meta.author_name ? meta.author_name : []),
      ...(meta && meta.author_alternative_name ? meta.author_alternative_name : []),
    ];

    let creator = primary;
    let creatorAlt = "";
    if (primary && !isLatinName(primary)) {
      const latin = alternatives.find((n) => n && isLatinName(n));
      if (latin) {
        creator = latin;      // sortable
        creatorAlt = primary; // original script, kept and shown
      }
    } else if (primary) {
      const other = alternatives.find((n) => n && !isLatinName(n));
      if (other) creatorAlt = other;
    }

    return {
      title: entry.title || "",
      creator,
      creatorAlt,
      year: String((meta && meta.first_publish_year) || yearFrom(entry.publish_date) || ""),
      isbn,
    };
  } catch (err) {
    console.warn("ISBN lookup failed", err);
    return null;
  }
}

/**
 * Best-effort retail/list price from Google Books — coverage is
 * inconsistent (not every book has one), so this is a bonus reference,
 * never the only price source.
 */
export async function lookupGoogleBooksPrice(isbn) {
  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
    const data = await res.json();
    const item = (data.items || [])[0];
    const saleInfo = item && item.saleInfo;
    const price = saleInfo && (saleInfo.retailPrice || saleInfo.listPrice);
    if (!price) return null;
    return { amount: price.amount, currency: price.currencyCode };
  } catch (err) {
    return null;
  }
}

/** Open Library's free cover image URL, built directly from an ISBN — no lookup call needed.
 *  Note: ISBN lookups are rate-limited (100 per IP per 5 min) and return 403 past
 *  that; cover-ID lookups are exempt, which is why the picker prefers them. */
export function coverUrl(isbn, size = "M") {
  if (!isbn) return null;
  return `https://covers.openlibrary.org/b/isbn/${isbn}-${size}.jpg?default=false`;
}

/** Cover by Open Library cover ID — not rate-limited, so preferred once known. */
export function coverIdUrl(id, size = "M") {
  if (!id) return null;
  return `https://covers.openlibrary.org/b/id/${id}-${size}.jpg?default=false`;
}

/**
 * Finds cover candidates for a title/author across Open Library editions.
 * An ISBN identifies one printing, and its cover is sometimes wrong or missing —
 * this surfaces the other editions' art so you can pick the one that matches
 * the book in your hands. Returns an array of cover IDs, most relevant first.
 */
async function searchCoverIds(q, limit) {
  const res = await fetch(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&fields=title,author_name,cover_i&limit=${limit}`
  );
  const data = await res.json();
  const ids = [];
  (data.docs || []).forEach((d) => {
    if (d.cover_i && !ids.includes(d.cover_i)) ids.push(d.cover_i);
  });
  return ids;
}

/**
 * The picker's job is BREADTH — show as many plausible covers as possible and
 * let the eye decide. An earlier version made the fielded query (title:"…" AND
 * author:"…") the primary and only widened when it returned under six results;
 * precision is the wrong goal here and it emptied the grid.
 *
 * So: the loose word search is the primary and always runs — that is what v19
 * did, and it is the one behaviour known to fill the grid. The fielded query
 * runs alongside it purely to reorder, its hits moving to the front. The result
 * is always a superset of the loose search, never smaller.
 */
export async function findCoverOptions(title, creator, opts = {}) {
  // The picker's search box overrides the book's own fields — the escape hatch
  // for when the catalogued title isn't what's printed on the cover.
  const free = opts.free ? String(opts.free).trim() : "";
  const loose = free || [title, creator].filter(Boolean).join(" ").trim();
  if (!loose) return [];

  const esc = (s) => String(s).replace(/["]/g, " ").replace(/\s+/g, " ").trim();
  const strict = free
    ? ""
    : [
        title ? `title:"${esc(title)}"` : "",
        creator ? `author:"${esc(creator)}"` : "",
      ].filter(Boolean).join(" AND ");

  // Both go out at once; a failure on either side must not lose the other.
  const [looseIds, strictIds] = await Promise.all([
    searchCoverIds(loose, 40).catch((err) => {
      console.warn("Cover search failed", err);
      return [];
    }),
    strict
      ? searchCoverIds(strict, 20).catch(() => [])
      : Promise.resolve([]),
  ]);

  const ids = [];
  strictIds.forEach((id) => { if (!ids.includes(id)) ids.push(id); });
  looseIds.forEach((id) => { if (!ids.includes(id)) ids.push(id); });
  return ids.slice(0, 24);
}
