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
  const formats = [
    window.Html5QrcodeSupportedFormats.EAN_13,
    window.Html5QrcodeSupportedFormats.EAN_8,
    window.Html5QrcodeSupportedFormats.UPC_A,
    window.Html5QrcodeSupportedFormats.UPC_E,
  ];

  const html5Qrcode = new window.Html5Qrcode(containerId, {
    formatsToSupport: formats,
    verbose: false,
  });
  activeScanner = html5Qrcode;

  let detected = false;

  await html5Qrcode.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: { width: 280, height: 140 }, disableFlip: false },
    (decodedText) => {
      if (detected) return; // ignore extra frames after the first hit
      detected = true;
      onDetect(decodedText.trim());
    },
    () => {
      // fires continuously while no code is in frame — not a real error
    }
  );

  let zoom = null;
  let torch = null;
  try {
    const caps = html5Qrcode.getRunningTrackCameraCapabilities();
    const zoomFeature = caps.zoomFeature();
    if (zoomFeature.isSupported()) {
      zoom = {
        min: zoomFeature.min(),
        max: zoomFeature.max(),
        step: zoomFeature.step() || 0.1,
        apply: (v) => zoomFeature.apply(v),
      };
    }
    const torchFeature = caps.torchFeature();
    if (torchFeature.isSupported()) {
      torch = { apply: (on) => torchFeature.apply(on) };
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
 * Looks up an ISBN against the Open Library API (free, no key required).
 * Returns { title, creator, isbn } or null if nothing was found.
 */
export async function lookupIsbn(isbn) {
  try {
    const res = await fetch(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&jscmd=data&format=json`
    );
    const data = await res.json();
    const entry = data[`ISBN:${isbn}`];
    if (!entry) return null;
    return {
      title: entry.title || "",
      creator: (entry.authors || []).map((a) => a.name).join(", "),
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

/** Open Library's free cover image URL, built directly from an ISBN — no lookup call needed. */
export function coverUrl(isbn, size = "M") {
  if (!isbn) return null;
  return `https://covers.openlibrary.org/b/isbn/${isbn}-${size}.jpg?default=false`;
}
