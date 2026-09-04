// ============================================
// The map picker — drop a pin where a thing actually is.
//
// Used by Food (where a place is) and by the Wishlist price hunt (where a shop
// is). Both have the same problem: the phone's own GPS puts you within a few
// metres of where you're standing, which is right for the stall you're queueing
// at and wrong for the shop you're remembering from this morning. So there are
// two ways in — stamp your location, or move the pin yourself.
//
// WHY LEAFLET IS VENDORED AND LAZY. Every other dependency in this app is
// vendored so the whole thing works offline off GitHub Pages; Leaflet follows
// that. But it's 148KB and most sessions never open a map, so the <script> is
// only injected the first time one is asked for. The service worker has it in
// its asset list, which means that first injection is a cache hit rather than
// a download, and it works with no signal.
//
// WHAT DOESN'T WORK OFFLINE: the tiles. They come from OpenStreetMap's servers
// and there's no honest way to bundle them — bulk-downloading tiles is exactly
// what their usage policy forbids. With no signal you get the app's own grid
// and a line saying so, and dragging the pin still works, because the
// coordinates are the thing being captured, not the picture.
// ============================================

import { openOverlay, dismissLayer, escapeHtml } from "./ui.js";
import { bounceTap } from "./animations.js";
import { ICONS } from "./icons.js";

const LEAFLET_SRC = "js/vendor/leaflet.min.js";

/** Where the map opens when it has nothing else to go on. */
const FALLBACK = { lat: 3.139, lon: 101.6869, zoom: 11 };
const PLACED_ZOOM = 17;

let loading = null;

/** Injects Leaflet once. Resolves with the global `L`. */
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const tag = document.createElement("script");
    tag.src = LEAFLET_SRC;
    tag.async = true;
    tag.onload = () => (window.L ? resolve(window.L) : reject(new Error("Leaflet loaded but did not register")));
    tag.onerror = () => {
      loading = null; // let a later attempt try again
      reject(new Error("Could not load the map library"));
    };
    document.head.appendChild(tag);
  });
  return loading;
}

/** The app's own pin, so the marker doesn't arrive in a different visual language. */
function pinIcon(L) {
  return L.divIcon({
    className: "map-pin",
    html: `<span class="map-pin-inner">${ICONS.pin}</span>`,
    iconSize: [40, 40],
    iconAnchor: [20, 38],
  });
}

function fmtCoord(n) {
  return Number(n).toFixed(5);
}

/**
 * Opens the picker.
 *
 * `onPick` gets `{ lat, lon }` when you save, and is not called if you back
 * out — an accidental drag shouldn't silently move a place you already
 * positioned.
 */
export function openMapPicker({ lat = null, lon = null, title = "Where is it?", onPick }) {
  openOverlay("cover-picker-backdrop map-backdrop", (overlay) => {
    const hasStart = lat != null && lon != null;

    overlay.innerHTML = `
      <div class="cover-picker map-picker">
        <div class="cover-picker-head">
          <h2>${escapeHtml(title)}</h2>
          <button class="lightbox-close" id="mpClose" type="button" aria-label="Close"><span class="btn-icon">${ICONS.close}</span></button>
        </div>

        <p class="cp-note" id="mpHint">Drag the pin, or tap anywhere on the map.</p>

        <div class="map-canvas" id="mpCanvas">
          <div class="map-loading" id="mpLoading">Loading the map…</div>
        </div>

        <p class="map-coords" id="mpCoords">${hasStart ? `${fmtCoord(lat)}, ${fmtCoord(lon)}` : "No pin yet"}</p>

        <button class="btn btn-secondary block-btn" id="mpHere" type="button">
          <span class="btn-icon">${ICONS.pin}</span> Use my location
        </button>
        <button class="btn btn-primary block-btn" id="mpSave" type="button">Save this spot</button>
        ${hasStart ? `<button class="link-btn" id="mpClear" type="button">Remove the location</button>` : ""}
      </div>
    `;

    overlay.addEventListener("click", (e) => { if (e.target === overlay) dismissLayer(); });
    overlay.querySelector("#mpClose").addEventListener("click", () => dismissLayer());

    const canvas = overlay.querySelector("#mpCanvas");
    const coordsOut = overlay.querySelector("#mpCoords");
    const hint = overlay.querySelector("#mpHint");
    const saveBtn = overlay.querySelector("#mpSave");
    const hereBtn = overlay.querySelector("#mpHere");

    let chosen = hasStart ? { lat: Number(lat), lon: Number(lon) } : null;
    let map = null;
    let marker = null;
    let L = null;

    const paintCoords = () => {
      coordsOut.textContent = chosen
        ? `${fmtCoord(chosen.lat)}, ${fmtCoord(chosen.lon)}`
        : "No pin yet";
      saveBtn.disabled = !chosen;
      saveBtn.classList.toggle("is-disabled", !chosen);
    };
    paintCoords();

    // Rounded once, here, rather than again on save. Rounding the raw value
    // to 5dp for the readout and separately to 6dp for storage meant the
    // number you looked at could differ from the number you kept in its last
    // digit — about a metre, and impossible to explain if you noticed.
    const place = (ll, { fly = false } = {}) => {
      const rawLon = ll.lng != null ? ll.lng : ll.lon;
      chosen = { lat: Number(Number(ll.lat).toFixed(6)), lon: Number(Number(rawLon).toFixed(6)) };
      if (marker) marker.setLatLng([chosen.lat, chosen.lon]);
      else if (map && L) {
        marker = L.marker([chosen.lat, chosen.lon], { icon: pinIcon(L), draggable: true }).addTo(map);
        marker.on("dragend", () => place(marker.getLatLng()));
      }
      if (map && fly) map.setView([chosen.lat, chosen.lon], Math.max(map.getZoom(), PLACED_ZOOM));
      paintCoords();
    };

    // Location works whether or not the map library ever arrives — the
    // coordinates are the point, the picture is the convenience.
    hereBtn.addEventListener("click", () => {
      bounceTap(hereBtn);
      if (!navigator.geolocation) {
        hint.textContent = "This phone won't share a location.";
        return;
      }
      const original = hereBtn.innerHTML;
      hereBtn.disabled = true;
      hereBtn.textContent = "Finding you…";
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          hereBtn.disabled = false;
          hereBtn.innerHTML = original;
          place({ lat: pos.coords.latitude, lon: pos.coords.longitude }, { fly: true });
          hint.textContent = "That's you. Drag the pin if the shop is next door.";
        },
        () => {
          hereBtn.disabled = false;
          hereBtn.innerHTML = original;
          hint.textContent = "Couldn't get your location — move the pin by hand instead.";
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
      );
    });

    saveBtn.addEventListener("click", () => {
      if (!chosen) return;
      bounceTap(saveBtn);
      dismissLayer();
      onPick({ lat: chosen.lat, lon: chosen.lon });
    });

    const clear = overlay.querySelector("#mpClear");
    if (clear) clear.addEventListener("click", () => {
      dismissLayer();
      onPick(null);
    });

    loadLeaflet()
      .then((lib) => {
        L = lib;
        const loadingNote = overlay.querySelector("#mpLoading");
        if (loadingNote) loadingNote.remove();

        map = L.map(canvas, {
          zoomControl: true,
          attributionControl: true,
          // The sheet under it scrolls; a two-finger gesture on the map should
          // pan the map rather than the page behind it.
          tap: false,
        }).setView(
          chosen ? [chosen.lat, chosen.lon] : [FALLBACK.lat, FALLBACK.lon],
          chosen ? PLACED_ZOOM : FALLBACK.zoom
        );

        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          // Required by the tile usage policy, and fair regardless — this map
          // is other people's survey work.
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
        }).addTo(map);

        if (chosen) place(chosen);
        map.on("click", (e) => place(e.latlng));

        // Leaflet measures its container on creation, and the sheet is still
        // animating in at that point — without this the map paints into a box
        // of the wrong size and the tiles land crooked.
        setTimeout(() => map.invalidateSize(), 60);
        setTimeout(() => map.invalidateSize(), 400);

        let missed = 0;
        map.on("tileerror", () => {
          missed += 1;
          if (missed === 4) {
            canvas.classList.add("tiles-out");
            hint.textContent = navigator.onLine
              ? "The map images won't load, but the pin still works."
              : "You're offline, so there's no map to show — the pin still works.";
          }
        });
      })
      .catch(() => {
        const loadingNote = overlay.querySelector("#mpLoading");
        if (loadingNote) {
          loadingNote.textContent = "The map wouldn't load. You can still use your location.";
        }
        hint.textContent = "No map — but Use my location still works.";
      });
  });
}
