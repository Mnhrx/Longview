// ============================================
// LPs — records you own, want, and have borrowed.
//
// Built on the same bones as Books: three shelves, a record holding physical
// copies, lending with history, ratings and reviews. Two deliberate departures:
//
//   * No reading status. You don't finish an album, so To Read / Reading / Read
//     has no honest equivalent. Condition takes its place — and it belongs to a
//     COPY, not the record, because an original press and a reissue of the same
//     album are in different shape.
//   * "Edition" is one free-text line rather than separate label and catalogue
//     fields. "Blue Note · BST 84003" is how you'd say it out loud.
// ============================================

import { openModal, updateModal, dismissLayer, openOverlay, escapeHtml, makeClearable, debounce, wireDateField } from "./ui.js";
import { confettiBurst, bounceTap, nudge } from "./animations.js";
import { uid } from "./core.js";
import { isScanSupported, startScanner } from "./barcode.js";
import { lookupBarcode, searchReleases, artCandidates, coverArtUrl, discogsUrl } from "./music.js";
import { ICONS } from "./icons.js";
import { createSorter, collator, yearValue, openSortSheet } from "./sorting.js";
import { starsHtml, wireStars, paintStars, formatRating, normaliseRating } from "./stars.js";
import { openShareSheet } from "./share.js";
import { setCoverSrc, ownKey, putBlob, encodeCover, deleteBlob } from "./covers.js";

const CONDITIONS = [
  { key: "mint", label: "Mint", short: "M" },
  { key: "near-mint", label: "Near Mint", short: "NM" },
  { key: "vg-plus", label: "VG+", short: "VG+" },
  { key: "vg", label: "VG", short: "VG" },
  { key: "good", label: "Good", short: "G" },
];
const CONDITION_LABELS = Object.fromEntries(CONDITIONS.map((c) => [c.key, c.label]));

let shelf = "library";      // 'library' | 'wishlist' | 'borrowed'
let groupByArtist = false;
let activeFilter = "all";
let artistFilter = null;
let searchQuery = "";
let ratingFilter = null;
// Favourites cuts ACROSS shelves — a book is in your library AND hearted — so
// it's a view flag rather than a fourth value of `shelf`.
let favesOnly = false;

function today() {
  return new Date().toISOString().slice(0, 10);
}
function fmtDate(iso) {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}
/**
 * ELAPSED days between two dates — not calendar days touched.
 *
 * This used to add one, so a book started yesterday and finished today read as
 * "took 2 days". Counting the span rather than the days it spanned is what
 * people mean, so a same-day read is 0 and the label says "same day".
 * Math.round absorbs DST, where a day is 23 or 25 hours.
 */
function daysBetween(a, b) {
  if (!a || !b) return null;
  const d1 = new Date(a + "T00:00:00");
  const d2 = new Date(b + "T00:00:00");
  if (isNaN(d1) || isNaN(d2)) return null;
  const diff = Math.round((d2 - d1) / 86400000);
  return diff < 0 ? null : diff;
}
function daysLabel(n) {
  if (n == null) return "";
  if (n === 0) return "same day";
  return n === 1 ? "1 day" : `${n} days`;
}

function isOwned(rec) {
  return (rec.copies || []).length > 0;
}
function shelfOf(rec) {
  if (isOwned(rec)) return "library";
  if (rec.borrowed) return "borrowed";
  return "wishlist";
}
function stillHolding(rec) {
  return !!(rec.borrowed && !rec.borrowed.returnedDate);
}
function loanedCopies(rec) {
  return (rec.copies || []).filter((c) => c.currentLoan);
}
function hasLoan(rec) {
  return loanedCopies(rec).length > 0;
}

function allRecords(store) {
  return store.itemsByType("lp");
}
function ownedRecords(store) {
  return allRecords(store).filter(isOwned);
}
function wishlistRecords(store) {
  return allRecords(store).filter((r) => shelfOf(r) === "wishlist");
}
function borrowedRecords(store) {
  return allRecords(store).filter((r) => shelfOf(r) === "borrowed");
}

function matchesSearch(rec) {
  if (!searchQuery.trim()) return true;
  const q = searchQuery.trim().toLowerCase();
  return (
    rec.title.toLowerCase().includes(q) ||
    (rec.creator || "").toLowerCase().includes(q) ||
    (rec.edition || "").toLowerCase().includes(q)
  );
}

/** Best condition across a record's copies — what the card shows. */
function bestCondition(rec) {
  const order = CONDITIONS.map((c) => c.key);
  const found = (rec.copies || []).map((c) => c.condition).filter(Boolean);
  if (!found.length) return null;
  found.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return found[0];
}

function getRecords(store) {
  let list = favesOnly
    ? store.itemsByType("lp").filter((r) => r.favourite)
    : shelf === "wishlist" ? wishlistRecords(store)
    : shelf === "borrowed" ? borrowedRecords(store)
    : ownedRecords(store);

  if (artistFilter) list = list.filter((r) => (r.creator || "Unknown") === artistFilter);
  list = list.filter(matchesSearch);

  if (activeFilter !== "all") {
    list = activeFilter === "lent-out"
      ? list.filter(hasLoan)
      : list.filter((r) => (r.copies || []).some((c) => c.condition === activeFilter));
  }
  if (ratingFilter != null) {
    list = list.filter((r) => normaliseRating(r.rating) === ratingFilter);
  }
  return sorter.sort(list);
}

// ---------- sorting ----------

const SORT_CRITERIA = [
  { key: "title", label: "Album", asc: "A–Z", desc: "Z–A", note: "Default" },
  {
    key: "creator", label: "Artist", asc: "A–Z", desc: "Z–A",
    value: (r) => r.creator || null,
    compare: (x, y) => collator.compare(x, y),
  },
  {
    key: "added", label: "Date added", asc: "newest first", desc: "oldest first",
    value: (r) => r.addedDate || null,
    compare: (x, y) => (x < y ? 1 : x > y ? -1 : 0),
    describe: (r) => (r.addedDate ? `Added ${fmtDate(r.addedDate)}` : ""),
  },
  {
    key: "year", label: "Year", asc: "oldest first", desc: "newest first",
    value: yearValue,
    compare: (x, y) => x - y,
    describe: (r) => (r.year ? `Released ${r.year}` : ""),
  },
  {
    key: "favourite", label: "Favourites", asc: "hearted first", desc: "hearted last",
    value: (r) => (r.favourite ? 1 : null),  // null = not hearted, so it sinks
    compare: () => 0,                          // all favourites are equal; title breaks the tie
  },
  {
    key: "rating", label: "Rating", asc: "highest first", desc: "lowest first",
    value: (r) => r.rating || null,
    compare: (x, y) => y - x,
    describe: (r) => (r.rating ? `${r.rating}/5` : ""),
  },
  {
    key: "condition", label: "Condition", asc: "best first", desc: "roughest first",
    // CONDITIONS is already ordered mint -> good, so its index IS the grade.
    value: (r) => {
      const best = bestCondition(r);
      if (!best) return null;
      return CONDITIONS.findIndex((c) => c.key === best);
    },
    compare: (x, y) => x - y,
    describe: (r) => {
      const best = bestCondition(r);
      return best ? CONDITION_LABELS[best] : "";
    },
  },
];

const sorter = createSorter(SORT_CRITERIA, "title");

function openRecordSortSheet(store, container) {
  const pool = ownedRecords(store);
  openSortSheet(
    sorter,
    () => render(container, store),
    "Records with nothing to sort on — no year, no condition, unrated — go to the end either way.",
    {
      value: ratingFilter,
      countFor: (v) => pool.filter((r) => normaliseRating(r.rating) === v).length,
      onChange: (v) => { ratingFilter = v; },
    }
  );
}


/**
 * Every remote cover is loaded with crossOrigin="anonymous", app-wide.
 *
 * Not for this screen's benefit — for the share cards'. Safari keys its image
 * cache loosely across CORS modes, so a cover fetched here WITHOUT the flag can
 * poison the entry the share canvas later needs, and the canvas ends up tainted
 * or the load just fails. Keeping every request in the same mode avoids it.
 * Data URLs (your own photos) are same-origin and skip it.
 */
function corsImage() {
  // crossOrigin is NOT set here any more — setCoverSrc decides, because it is
  // the only place that knows what the URL turns out to be. Setting it blanket
  // meant cached covers were loaded as blob: URLs *with* crossOrigin, and
  // WebKit refuses that combination: covers appeared on a first visit and then
  // vanished once they'd been cached, which is exactly the reported symptom.
  return new Image();
}

// ---------- covers ----------

function recordCoverSrc(rec, size = 500) {
  if (!rec) return null;
  if (rec.coverRef) return rec.coverRef; // your own photo, from the blob store
  if (rec.customCover) return rec.customCover;
  // A picked release-group is the album's canonical art; a picked release is
  // one specific pressing. Both beat whatever the barcode scan happened to hit.
  if (rec.coverRgid) return coverArtUrl(rec.coverRgid, size, "release-group");
  if (rec.coverMbid) return coverArtUrl(rec.coverMbid, size);
  if (rec.rgid) return coverArtUrl(rec.rgid, size, "release-group");
  if (rec.mbid) return coverArtUrl(rec.mbid, size);
  return null;
}
function hasCover(rec) {
  return !!(rec && (rec.coverRef || rec.customCover || rec.coverRgid || rec.coverMbid || rec.rgid || rec.mbid));
}

function downscaleImage(file, maxEdge = 500, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file"));
    reader.onload = () => {
      const img = corsImage();
      img.onerror = () => reject(new Error("That file isn't an image we can read"));
      img.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function coverBlockHtml(rec) {
  return `
    <div class="detail-cover-wrap sleeve">
      <img class="detail-cover" id="coverImg" alt="">
      <div class="detail-cover-fallback ${hasCover(rec) ? "shimmer" : ""}" id="coverFallback" style="background:${rec.color || "#eee"}">${ICONS.lps}</div>
    </div>
  `;
}
function wireCover(sheet, rec) {
  if (!hasCover(rec)) return;
  const img = sheet.querySelector("#coverImg");
  const fallback = sheet.querySelector("#coverFallback");
  if (!img || !fallback) return;
  img.addEventListener("load", () => {
    img.classList.add("loaded");
    fallback.classList.add("fade-out");
  });
  img.addEventListener("error", () => fallback.classList.remove("shimmer"));
  setCoverSrc(img, recordCoverSrc(rec, 500));
}

function openSleeveLightbox(rec) {
  openOverlay("lightbox-backdrop", (overlay) => {
    overlay.innerHTML = `
      <button class="lightbox-close" type="button" aria-label="Close"><span class="btn-icon">${ICONS.close}</span></button>
      <div class="lightbox-content">
        <div class="lightbox-cover-wrap sleeve">
          <img class="lightbox-img" id="lbImg" alt="${escapeHtml(rec.title)} sleeve">
          <div class="lightbox-fallback shimmer" id="lbFallback" style="background:${rec.color || "#eee"}">${ICONS.lps}</div>
        </div>
        <p class="lightbox-caption" id="lbCaption">Front sleeve</p>
      </div>
    `;
    overlay.addEventListener("click", (e) => { if (e.target === overlay) dismissLayer(); });
    overlay.querySelector(".lightbox-close").addEventListener("click", () => dismissLayer());

    const img = overlay.querySelector("#lbImg");
    const fb = overlay.querySelector("#lbFallback");
    const cap = overlay.querySelector("#lbCaption");
    img.addEventListener("load", () => { img.classList.add("loaded"); fb.classList.add("fade-out"); });
    img.addEventListener("error", () => {
      fb.classList.remove("shimmer");
      cap.textContent = "No sleeve art found for this pressing";
    });
    setCoverSrc(img, recordCoverSrc(rec, 1200));
  });
}

/** Turns a picker result into a patch, filing any photo in the blob store. */
async function applyArtPick(itemId, pick) {
  const key = ownKey(itemId);
  if (pick.ownBlob) {
    await putBlob(key, pick.ownBlob, { permanent: true });
    return { coverRef: key, customCover: null, coverMbid: null, coverRgid: null };
  }
  await deleteBlob(key);
  return {
    coverRef: null,
    customCover: null,
    coverMbid: pick.coverMbid ?? null,
    coverRgid: pick.coverRgid ?? null,
  };
}

/** Art picker: other pressings of the same album, or your own photo. */
function openArtPicker(recordish, onPick) {
  openOverlay("cover-picker-backdrop", (overlay) => {
    overlay.innerHTML = `
      <div class="cover-picker">
        <div class="cover-picker-head">
          <h2>Choose sleeve art</h2>
          <button class="lightbox-close" id="apClose" type="button" aria-label="Close"><span class="btn-icon">${ICONS.close}</span></button>
        </div>
        <label class="cover-upload">
          <input type="file" id="apFile" accept="image/*" hidden>
          <span class="cover-upload-icon">${ICONS.lens}</span>
          <span>
            <strong>Photograph your copy</strong>
            <small>Take one now or pick from your library</small>
          </span>
        </label>
        <div class="picker-search">
          <input type="search" id="apSearch" placeholder="Search by artist and album"
                 value="${escapeHtml([recordish.creator, recordish.title].filter(Boolean).join(" "))}">
          <button class="btn btn-secondary" id="apSearchBtn" type="button">Search</button>
        </div>
        <p class="cover-picker-label" id="apLabel">Sleeve art</p>
        <div class="cover-options" id="apOptions"></div>
      </div>
    `;

    overlay.querySelector("#apClose").addEventListener("click", () => dismissLayer());
    overlay.addEventListener("click", (e) => { if (e.target === overlay) dismissLayer(); });

    const fileInput = overlay.querySelector("#apFile");
    const label = overlay.querySelector("#apLabel");
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      label.textContent = "Processing your photo…";
      try {
        // The blob, not a data URL — see the note in books.js.
        onPick({ ownBlob: await encodeCover(file), customCover: null, coverMbid: null, coverRgid: null });
        dismissLayer();
      } catch (err) {
        label.textContent = err.message || "Couldn't use that image.";
      }
    });

    const grid = overlay.querySelector("#apOptions");
    const searchBox = overlay.querySelector("#apSearch");
    makeClearable(searchBox, () => load(null));
    const searchBtn = overlay.querySelector("#apSearchBtn");
    let run = 0;

    /** Sleeves arrive slower than book covers — MusicBrainz first, then Cover
     *  Art Archive redirecting out to archive.org. Grey boxes hold the shape so
     *  the wait doesn't read as a broken screen. */
    function showSkeletons(n = 8) {
      grid.innerHTML = "";
      for (let i = 0; i < n; i++) {
        const sk = document.createElement("div");
        sk.className = "cover-option sleeve skeleton";
        grid.appendChild(sk);
      }
    }

    function load(free) {
      const mine = ++run;

      // Reachable before anything's been typed — say so rather than running an
      // empty search and reporting "nothing found".
      if (!free && !recordish.title && !recordish.creator) {
        label.textContent = "Sleeve art";
        grid.innerHTML = `<p class="cover-picker-note">Type an album or artist in the box above to search — or photograph your copy.</p>`;
        return;
      }

      label.textContent = "Looking for sleeve art…";
      showSkeletons();

      const spec = free
        ? { free }
        : { title: recordish.title, creator: recordish.creator };

      searchReleases(spec, 25).then((releases) => {
        if (mine !== run) return;
        const candidates = artCandidates(releases, 24);
        grid.innerHTML = "";
        if (!candidates.length) {
          label.textContent = "Sleeve art";
          grid.innerHTML = `<p class="cover-picker-note">Nothing found — try just the album name, or photograph your copy.</p>`;
          return;
        }
        label.textContent = free ? `Results for “${free}”` : "Sleeve art";

        if (recordish.customCover || recordish.coverMbid || recordish.coverRgid) {
          const reset = document.createElement("button");
          reset.type = "button";
          reset.className = "cover-option reset";
          reset.innerHTML = `<span>Use the default</span>`;
          reset.addEventListener("click", () => {
            onPick({ customCover: null, coverMbid: null, coverRgid: null });
            dismissLayer();
          });
          grid.appendChild(reset);
        }

        candidates.forEach((r) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "cover-option sleeve";
          const img = corsImage();
          img.alt = "";
          img.loading = "lazy";
          img.addEventListener("load", () => btn.classList.add("loaded"));
          img.addEventListener("error", () => btn.remove()); // no art filed for this one
          setCoverSrc(img, coverArtUrl(r.artId, 250, r.artKind));
          btn.appendChild(img);
          const capText = r.artKind === "release-group"
            ? [r.creator, "album art"].filter(Boolean).join(" · ")
            : [r.year, r.edition, r.country].filter(Boolean).join(" · ");
          if (capText) {
            const cap = document.createElement("span");
            cap.className = "cover-option-cap";
            cap.textContent = capText;
            btn.appendChild(cap);
          }
          btn.addEventListener("click", () => {
            onPick(
              r.artKind === "release-group"
                ? { customCover: null, coverMbid: null, coverRgid: r.artId }
                : { customCover: null, coverMbid: r.artId, coverRgid: null }
            );
            dismissLayer();
          });
          grid.appendChild(btn);
        });
      });
    }

    searchBtn.addEventListener("click", () => load(searchBox.value.trim()));
    searchBox.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        searchBox.blur();
        load(searchBox.value.trim());
      }
    });

    load(null);
  });
}

// ---------- share ----------

function recordShelfLabel(rec) {
  const kind = shelfOf(rec);
  if (kind === "wishlist") return "On my wishlist";
  if (kind === "borrowed") return stillHolding(rec) ? "Borrowed" : "Returned";
  const cond = bestCondition(rec);
  return cond ? CONDITION_LABELS[cond] : "In my collection";
}

function shareCardsForRecord(rec) {
  const cards = [
    {
      key: "item", label: "This record", sub: "Sleeve, rating, dates",
      type: "item",
      data: { item: rec, coverSrc: recordCoverSrc(rec, 500), kindLabel: recordShelfLabel(rec) },
    },
  ];
  if (rec.review && rec.review.trim()) {
    cards.push({
      key: "review", label: "My notes", sub: "What you wrote",
      type: "review",
      data: { item: rec, coverSrc: recordCoverSrc(rec, 500) },
    });
  }
  return cards;
}

function shareCardsForShelf(store) {
  const list = getRecords(store);
  const all = store.itemsByType("lp");
  const owned = all.filter(isOwned);
  const rated = owned.filter((r) => r.rating);

  const shelfName =
    shelf === "wishlist" ? "My wishlist"
    : shelf === "borrowed" ? "Records I've borrowed"
    : "My record collection";

  const artistCounts = {};
  owned.forEach((r) => {
    const n = r.creator || "Unknown";
    artistCounts[n] = (artistCounts[n] || 0) + 1;
  });
  const topArtist = Object.keys(artistCounts).sort((a, b) => artistCounts[b] - artistCounts[a])[0];

  const years = owned.map(yearValue).filter((y) => y != null);
  const oldest = years.length ? Math.min(...years) : null;

  const distinctArtists = new Set(owned.map((r) => r.creator || "Unknown")).size;
  const fiveStars = owned.filter((r) => r.rating === 5).length;
  const wishlist = all.filter((r) => shelfOf(r) === "wishlist").length;
  const lentOut = owned.filter(hasLoan).length;
  const totalCopies = owned.reduce((n, r) => n + (r.copies || []).length, 0);
  const mint = owned.filter((r) => bestCondition(r) === "mint").length;
  const newest = years.length ? Math.max(...years) : null;

  const maybe = (cond, stat) => (cond ? [stat] : []);
  const stats = [
    { key: "owned", value: owned.length, label: "records owned" },
    ...maybe(wishlist, { key: "wishlist", value: wishlist, label: "on the wishlist" }),
    ...maybe(rated.length, {
      key: "avg",
      value: (rated.reduce((n, r) => n + r.rating, 0) / rated.length).toFixed(1),
      label: "average rating",
    }),
    ...maybe(topArtist, { key: "topArtist", value: artistCounts[topArtist], label: `by ${topArtist}` }),
    ...maybe(distinctArtists > 1, { key: "artists", value: distinctArtists, label: "different artists" }),
    ...maybe(fiveStars, { key: "fivestar", value: fiveStars, label: "five-star records" }),
    ...maybe(oldest, { key: "oldest", value: oldest, label: "oldest pressing" }),
    ...maybe(newest && newest !== oldest, { key: "newest", value: newest, label: "newest pressing" }),
    ...maybe(mint, { key: "mint", value: mint, label: "in mint condition" }),
    ...maybe(totalCopies > owned.length, { key: "copies", value: totalCopies, label: "physical copies" }),
    ...maybe(lentOut, { key: "lent", value: lentOut, label: "out on loan" }),
  ];

  const shareTitle =
    artistFilter ? `${artistFilter}, on my shelf`
    : ratingFilter != null ? `My ${formatRating(ratingFilter)}★ records`
    : shelfName;

  /** Describes the SELECTION, not the whole collection. */
  const shareSubtitleFor = (picked) => {
    const n = picked.length;
    const noun = `${n} record${n === 1 ? "" : "s"}`;
    return ratingFilter != null ? `${noun}, all ${formatRating(ratingFilter)}★` : noun;
  };

  return [
    {
      key: "grid", label: "My shelf", sub: "A wall of sleeves",
      type: "grid",
      pickable: true,
      data: {
        items: list,
        // 250 is the size the list cards already fetched — a cache hit here.
        coverSrcs: list.map((r) => recordCoverSrc(r, 250)),
        srcFor: (r) => recordCoverSrc(r, 250),
        title: shareTitle,
        subtitleFor: shareSubtitleFor,
        subtitle: shareSubtitleFor(list),
      },
    },
    {
      key: "stats", label: "My numbers", sub: "No sleeves, just stats",
      type: "stats",
      data: { title: "My collection", stats, accent: "#8B5CF6" },
    },
  ];
}

// ---------- main render ----------

/** `opts` is only passed by the router, so its presence means the module was
 *  just opened from the menu rather than redrawn in place. */
function render(container, store, opts) {
  if (opts !== undefined) {
    sorter.reset();
    ratingFilter = null;
    favesOnly = false;
  }

  const wrap = document.createElement("div");

  const SHELF_TABS = { library: "Collection", wishlist: "Wishlist", borrowed: "Borrowed" };
  const SHELF_TITLES = { library: "Records", wishlist: "Wishlist", borrowed: "Borrowed" };

  const title = document.createElement("p");
  title.className = "view-title";
  title.textContent = favesOnly
    ? "Favourites"
    : artistFilter ? `Records by ${artistFilter}` : SHELF_TITLES[shelf];
  wrap.appendChild(title);

  if (artistFilter) {
    const back = document.createElement("button");
    back.className = "back-chip";
    back.textContent = "← All Artists";
    back.addEventListener("click", () => {
      artistFilter = null;
      render(container, store);
    });
    wrap.appendChild(back);
  }

  const searchRow = document.createElement("div");
  searchRow.className = "search-row";
  searchRow.innerHTML = `
    <input type="text" class="search-input" id="searchInput" placeholder="Search album, artist or edition..." value="${escapeHtml(searchQuery)}">
    <button class="icon-btn ${sorter.isDefault && ratingFilter == null ? "" : "on"}" id="sortBtn" type="button" aria-label="Sort">${ICONS.sort}</button>
    <button class="icon-btn ${groupByArtist ? "on" : ""}" id="artistBtn" type="button" aria-label="Group by artist" aria-pressed="${groupByArtist}">${ICONS.author}</button>
    <button class="scan-btn" id="scanBtn" type="button" aria-label="Scan barcode">${ICONS.camera}</button>
  `;
  wrap.appendChild(searchRow);

  if ((!sorter.isDefault || ratingFilter != null) && !groupByArtist) {
    const note = document.createElement("p");
    note.className = "sort-note";
    note.textContent =
      (ratingFilter != null ? `${formatRating(ratingFilter)}★ only · ` : "") +
      `Sorted by ${sorter.label()}`;
    wrap.appendChild(note);
  }

  if (!artistFilter) {
    const modeToggle = document.createElement("div");
    modeToggle.className = "mode-toggle";
    modeToggle.innerHTML =
      ["library", "wishlist", "borrowed"]
        .map((k) => `<button class="mode-btn ${shelf === k && !favesOnly ? "active" : ""}" data-shelf="${k}" type="button">${SHELF_TABS[k]}</button>`)
        .join("") +
      `<button class="mode-btn faves-btn ${favesOnly ? "active" : ""}" data-faves="1" type="button" aria-label="Favourites">
         <span class="faves-icon">${ICONS.heart}</span>
       </button>`;
    wrap.appendChild(modeToggle);
  }

  const bodyHolder = document.createElement("div");
  wrap.appendChild(bodyHolder);

  container.innerHTML = "";
  container.appendChild(wrap);

  // Rebuilding every card (and restarting every cover fetch) on each keystroke
  // is what made typing feel sticky; the caret survived, but the main thread
  // didn't. Debounced, so the list catches up once you pause.
  const searchInput = wrap.querySelector("#searchInput");
  const runSearch = debounce(() => renderBody(bodyHolder, store, container), 180);
  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    runSearch();
  });
  makeClearable(searchInput);
  wrap.querySelector("#scanBtn").addEventListener("click", () => openScanModal(store, container));
  wrap.querySelector("#sortBtn").addEventListener("click", (e) => {
    bounceTap(e.currentTarget);
    openRecordSortSheet(store, container);
  });

  wrap.querySelector("#artistBtn").addEventListener("click", (e) => {
    bounceTap(e.currentTarget);
    groupByArtist = !groupByArtist;
    artistFilter = null;
    render(container, store);
  });

  if (!artistFilter) {
    wrap.querySelectorAll(".mode-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        bounceTap(btn);
        if (btn.dataset.faves) {
          favesOnly = !favesOnly;   // a toggle, so you can come back out of it
          render(container, store);
          return;
        }
        favesOnly = false;
        shelf = btn.dataset.shelf;
        activeFilter = "all";
        render(container, store);
      });
    });
  }

  renderBody(bodyHolder, store, container);
}

function renderBody(bodyHolder, store, container) {
  bodyHolder.innerHTML = "";

  if (groupByArtist && !artistFilter) {
    renderArtistList(bodyHolder, store, container);
    return;
  }
  if (shelf === "wishlist" && !artistFilter) {
    renderWishlist(bodyHolder, store, container);
    return;
  }
  if (shelf === "borrowed" && !artistFilter) {
    renderBorrowed(bodyHolder, store, container);
    return;
  }

  renderFilterRow(bodyHolder, store, container);
  const listHolder = document.createElement("div");
  bodyHolder.appendChild(listHolder);
  renderGrid(listHolder, getRecords(store), (rec) => openDetail(rec, store, container));
}

/** Condition filters, same light treatment as the Books status chips, and the
 *  same rule: a filter with nothing behind it isn't drawn. */
function renderFilterRow(bodyHolder, store, container) {
  const pool = ownedRecords(store);
  const countFor = (key) => {
    if (key === "all") return pool.length;
    if (key === "lent-out") return pool.filter(hasLoan).length;
    return pool.filter((r) => (r.copies || []).some((c) => c.condition === key)).length;
  };

  const keys = ["all", ...CONDITIONS.map((c) => c.key), "lent-out"];
  const live = keys.filter((k) => k === "all" || countFor(k) > 0);
  if (live.length <= 1) return;

  const row = document.createElement("div");
  row.className = "filter-row";
  live.forEach((k) => {
    if (k === "lent-out") {
      const sep = document.createElement("span");
      sep.className = "filter-sep";
      row.appendChild(sep);
    }
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "filter-chip" + (activeFilter === k ? " active" : "");
    const label = k === "all" ? "All" : k === "lent-out" ? "Lent Out" : CONDITION_LABELS[k];
    chip.innerHTML = `${label}<span class="chip-count">${countFor(k)}</span>`;
    chip.addEventListener("click", () => {
      activeFilter = k;
      renderBody(bodyHolder, store, container);
    });
    row.appendChild(chip);
  });
  bodyHolder.appendChild(row);
}

function renderGrid(container, records, onTap) {
  if (records.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `<div class="empty-state-icon">${ICONS.lps}</div><p>No records here — tap the scanner or + to add one</p>`;
    container.appendChild(empty);
    return;
  }
  const grid = document.createElement("div");
  grid.className = "card-grid";
  records.forEach((rec) => grid.appendChild(buildCard(rec, onTap)));
  container.appendChild(grid);
}

function buildCard(rec, onTap) {
  const card = document.createElement("div");
  card.className = "item-card";
  const kind = shelfOf(rec);
  const onLoan = loanedCopies(rec);
  const cond = bestCondition(rec);

  const pill =
    kind === "library"
      ? (cond
          ? `<span class="status-pill status-cond-${cond}">${CONDITION_LABELS[cond]}</span>`
          : `<span class="status-pill status-read">In collection</span>`)
      : kind === "borrowed"
        ? `<span class="status-pill status-borrowed">${stillHolding(rec) ? "Borrowed" : "Returned"}</span>`
        : `<span class="status-pill status-to-read">Wishlist</span>`;

  let extra = "";
  const sub = sorter.describe(rec);
  if (sub) extra += `<div class="lent-note">${escapeHtml(sub)}</div>`;
  const meta = [rec.year, rec.edition].filter(Boolean).join(" · ");
  if (meta) extra += `<div class="lent-note">${escapeHtml(meta)}</div>`;
  if ((rec.copies || []).length > 1) extra += `<div class="lent-note">${rec.copies.length} copies</div>`;
  if (onLoan.length) {
    const who = onLoan.length === 1
      ? `lent to ${escapeHtml(onLoan[0].currentLoan.lentTo || "someone")}`
      : `${onLoan.length} copies lent out`;
    extra += `<div class="lent-note">→ ${who}</div>`;
  }
  if (kind === "borrowed" && rec.borrowed) {
    const who = escapeHtml(rec.borrowed.from || "someone");
    extra += stillHolding(rec)
      ? `<div class="lent-note">← from ${who}</div>`
      : `<div class="lent-note">was ${who}'s · returned ${fmtDate(rec.borrowed.returnedDate)}</div>`;
  }
  if (kind === "wishlist" && rec.price != null) {
    extra += `<div class="price-tag">$${Number(rec.price).toFixed(2)} · wishlist</div>`;
  }
  if (rec.rating) extra += `<div class="card-stars">${starsHtml(rec.rating)}</div>`;

  // Always wrapped — see the note in books.js; the record icon's outer ring
  // made the unsized version especially obvious.
  const inner = hasCover(rec)
    ? `<span class="swatch-emoji">${ICONS.lps}</span><img class="swatch-img" alt="">`
    : `<span class="swatch-emoji">${ICONS.lps}</span>`;

  const faveMark = rec.favourite
    ? `<span class="card-fave" aria-label="Favourite">${ICONS.heart}</span>`
    : "";

  card.innerHTML = `
    <div class="item-swatch sleeve ${hasCover(rec) ? "shimmer" : ""}" style="background:${rec.color || "#eee"}">${inner}</div>
    <div class="item-body">
      <p class="item-title">${escapeHtml(rec.title)}</p>
      <p class="item-creator">${escapeHtml(rec.creator || "")}</p>
      ${pill}
      ${extra}
    </div>
    ${faveMark}
  `;
  card.addEventListener("click", () => {
    bounceTap(card);
    onTap(rec);
  });

  if (hasCover(rec)) {
    const swatch = card.querySelector(".item-swatch");
    const swatchImg = swatch.querySelector(".swatch-img");
    const swatchEmoji = swatch.querySelector(".swatch-emoji");
    const img = corsImage();
    img.onload = () => {
      swatchImg.src = img.src;
      swatchImg.classList.add("loaded");
      if (swatchEmoji) swatchEmoji.classList.add("hidden");
      swatch.classList.remove("shimmer");
    };
    img.onerror = () => swatch.classList.remove("shimmer");
    setCoverSrc(img, recordCoverSrc(rec, 250));
  }
  return card;
}

function renderArtistList(bodyHolder, store, container) {
  const pool =
    shelf === "wishlist" ? wishlistRecords(store)
    : shelf === "borrowed" ? borrowedRecords(store)
    : ownedRecords(store);
  const list = pool.filter(matchesSearch);

  const counts = {};
  list.forEach((r) => {
    const name = r.creator || "Unknown";
    counts[name] = (counts[name] || 0) + 1;
  });
  const artists = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));

  if (!artists.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `<div class="empty-state-icon">${ICONS.author}</div><p>No artists yet</p>`;
    bodyHolder.appendChild(empty);
    return;
  }

  const grid = document.createElement("div");
  grid.className = "author-grid";
  artists.forEach((name) => {
    const btn = document.createElement("button");
    btn.className = "author-btn";
    btn.type = "button";
    btn.innerHTML = `<span>${escapeHtml(name)}</span><span class="author-count">${counts[name]}</span>`;
    btn.addEventListener("click", () => {
      bounceTap(btn);
      artistFilter = name;
      sorter.reset(); // drilling into an artist starts alphabetical too
      render(container, store);
    });
    grid.appendChild(btn);
  });
  bodyHolder.appendChild(grid);
}

function renderWishlist(bodyHolder, store, container) {
  const list = wishlistRecords(store).filter(matchesSearch);
  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `<div class="empty-state-icon">${ICONS.empty}</div><p>Nothing on the wishlist yet — add a record and pick "Wishlist"</p>`;
    bodyHolder.appendChild(empty);
    return;
  }
  const priced = list.filter((r) => r.price != null);
  if (priced.length) {
    const total = priced.reduce((sum, r) => sum + Number(r.price), 0);
    const p = document.createElement("p");
    p.className = "wishlist-total";
    p.textContent = `${list.length} record${list.length === 1 ? "" : "s"} · $${total.toFixed(2)} for the ${priced.length} you've priced`;
    bodyHolder.appendChild(p);
  }
  const grid = document.createElement("div");
  grid.className = "card-grid";
  list.forEach((r) => grid.appendChild(buildCard(r, (x) => openDetail(x, store, container))));
  bodyHolder.appendChild(grid);
}

function renderBorrowed(bodyHolder, store, container) {
  const list = borrowedRecords(store).filter(matchesSearch);
  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `<div class="empty-state-icon">${ICONS.lend}</div><p>No borrowed records yet — add one and pick "Borrowed"</p>`;
    bodyHolder.appendChild(empty);
    return;
  }
  const holding = list.filter(stillHolding);
  const given = list.filter((r) => !stillHolding(r));

  const section = (label, arr) => {
    if (!arr.length) return;
    const h = document.createElement("p");
    h.className = "shelf-section-title";
    h.textContent = `${label} (${arr.length})`;
    bodyHolder.appendChild(h);
    const grid = document.createElement("div");
    grid.className = "card-grid";
    arr.forEach((r) => grid.appendChild(buildCard(r, (x) => openDetail(x, store, container))));
    bodyHolder.appendChild(grid);
  };
  section("Still have it", holding);
  section("Given back", given);
}

// ---------- stars / review ----------



function reviewHtml(rec) {
  const has = (rec.review && rec.review.trim()) || rec.rating;
  return `
    <div class="review-block" id="reviewBlock">
      <div class="review-head">
        <span class="review-title">Your notes</span>
        <button class="mini-edit" id="reviewEditBtn" type="button" aria-label="Edit notes"><span class="btn-icon">${ICONS.edit}</span></button>
      </div>
      <div class="review-read" id="reviewRead">
        ${rec.rating ? `<div class="review-stars">${starsHtml(rec.rating)}<span class="review-score">${formatRating(rec.rating)}/5</span></div>` : ""}
        ${rec.review && rec.review.trim()
          ? `<p class="review-text">${escapeHtml(rec.review)}</p>`
          : (rec.rating ? "" : `<p class="review-empty">Nothing noted yet — tap the pencil to add something.</p>`)}
        ${rec.reviewDate && has ? `<p class="review-date">Noted ${fmtDate(rec.reviewDate)}</p>` : ""}
      </div>
      <div class="review-edit" id="reviewEdit" hidden>
        <div class="review-rate-row">
          <span class="review-rate-label">Rating</span>
          ${starsHtml(rec.rating, true)}
          <span class="draft-score" id="draftScore">${rec.rating ? formatRating(rec.rating) + "/5" : ""}</span>
          <button type="button" class="clear-rating" id="clearRating">Clear</button>
        </div>
        <textarea id="reviewInput" class="review-input" rows="4" placeholder="How does it sound? Pressing quality, favourite side, where you found it…">${escapeHtml(rec.review || "")}</textarea>
        <button class="btn btn-primary" id="saveReviewBtn" type="button">Save notes</button>
      </div>
    </div>
  `;
}

// ---------- detail ----------

function openDetail(rec, store, container, opts = {}) {
  openModal((sheet) => paintDetail(sheet, rec, store, container, opts));
}
function drawDetailInto(rec, store, container, opts = {}) {
  return updateModal((sheet) => paintDetail(sheet, rec, store, container, opts));
}
function refreshDetail(store, container, id, opts = {}) {
  const fresh = store.get().items.find((it) => it.id === id);
  if (!fresh) {
    dismissLayer();
    render(container, store);
    return;
  }
  const view = document.getElementById("view");
  const keep = view ? view.scrollTop : 0;
  render(container, store);
  if (view) view.scrollTop = keep;
  if (!drawDetailInto(fresh, store, container, opts)) openDetail(fresh, store, container, opts);
}

function paintDetail(sheet, rec, store, container, opts = {}) {
  let mode = opts.mode === "edit" ? "edit" : "view";

  function draw() {
    sheet.innerHTML = mode === "view" ? viewHtml(rec, opts) : editHtml(rec);
    const toggle = sheet.querySelector("#toggleEditBtn");
    if (toggle) {
      toggle.addEventListener("click", () => {
        mode = mode === "view" ? "edit" : "view";
        draw();
      });
    }
    if (mode === "view") wireView(sheet, rec, store, container, opts);
    else wireEdit(sheet, rec, store, container);
  }
  draw();
}

function viewHtml(rec, opts) {
  const copies = rec.copies || [];
  const kind = shelfOf(rec);
  const meta = [rec.year, rec.edition].filter(Boolean).join(" · ");

  return `
    ${opts.foundViaScan ? `<div class="found-banner"><span>Already in your collection</span></div>` : ""}
    <div class="detail-top-row">
      <h2>${escapeHtml(rec.title)}</h2>
      <button class="icon-btn detail-fave ${rec.favourite ? "on" : ""}" id="faveBtn" type="button"
              aria-pressed="${!!rec.favourite}" aria-label="Favourite">${ICONS.heart}</button>
      <button class="icon-btn detail-share" id="shareItemBtn" type="button" aria-label="Share this record">${ICONS.share}</button>
      <button class="edit-toggle-btn" id="toggleEditBtn" type="button"><span class="btn-icon">${ICONS.edit}</span>Edit</button>
    </div>
    ${hasCover(rec) ? `
      <div class="cover-tap-target" id="coverTapTarget">
        ${coverBlockHtml(rec)}
        <span class="cover-zoom-badge">${ICONS.zoom}</span>
      </div>
    ` : coverBlockHtml(rec)}
    <p class="detail-author">${escapeHtml(rec.creator || "Unknown artist")}</p>
    ${meta ? `<p class="detail-meta">${escapeHtml(meta)}</p>` : ""}

    ${reviewHtml(rec)}

    ${kind === "borrowed" ? borrowedBlockHtml(rec) : ""}

    ${copies.length ? `
      <div class="copies-section">
        <p class="copies-heading">Your Copies (${copies.length})</p>
        ${copies.map((c) => copyRowHtml(c)).join("")}
        <button class="add-copy-btn" id="addCopyBtn" type="button">+ Add another copy</button>
      </div>
    ` : kind === "borrowed" ? "" : `
      <div class="status-pill status-to-read" style="margin-bottom:6px;">Wishlist${rec.price != null ? ` · $${Number(rec.price).toFixed(2)}` : ""}</div>
      ${rec.price != null && rec.priceCheckedDate ? `<p class="price-checked-note">You checked this price on ${fmtDate(rec.priceCheckedDate)}</p>` : ""}
      <div class="price-links">
        <a class="price-link" href="${discogsUrl(rec)}" target="_blank" rel="noopener">Check Discogs</a>
      </div>
      <button class="btn btn-secondary" id="gotCopyBtn" type="button" style="margin-top:14px;">I got a copy — add to collection</button>
    `}
  `;
}

function copyRowHtml(copy) {
  const onLoan = !!copy.currentLoan;
  const loan = copy.currentLoan;
  const out = onLoan ? daysBetween(loan.lentDate, today()) : null;
  const history = copy.history || [];

  return `
    <div class="copy-row" data-copy-id="${copy.id}">
      <div class="copy-line">
        <div class="copy-status ${onLoan ? "on-loan" : "on-shelf"}">
          ${onLoan
            ? `→ Lent to ${escapeHtml(loan.lentTo)}${out ? ` · out ${daysLabel(out)}` : ""}`
            : `On your shelf since ${fmtDate(copy.acquiredDate)}`}
        </div>
        <button class="mini-edit" type="button" aria-label="Edit copy"><span class="btn-icon">${ICONS.edit}</span></button>
      </div>

      <div class="condition-row">
        ${CONDITIONS.map((c) => `
          <button type="button" class="cond-btn ${copy.condition === c.key ? "active" : ""}" data-cond="${c.key}" title="${c.label}">${c.short}</button>
        `).join("")}
      </div>

      <div class="copy-dates" hidden>
        <div class="date-pair">
          <label class="date-field">
            <span>Added to shelf</span>
            <input type="date" class="copy-acquired" value="${copy.acquiredDate || ""}">
          </label>
        </div>
        ${onLoan ? `
          <label class="date-field">
            <span>Borrower</span>
            <input type="text" class="loan-who" value="${escapeHtml(loan.lentTo || "")}">
          </label>
          <div class="date-pair">
            <label class="date-field">
              <span>Lent on</span>
              <input type="date" class="loan-start" value="${loan.lentDate || ""}">
            </label>
            <label class="date-field">
              <span>Returned on</span>
              <input type="date" class="loan-returned" value="">
            </label>
          </div>
          <p class="field-hint">Filling in a return date is what closes the loan.</p>
        ` : ""}
      </div>

      <div class="copy-actions">
        ${onLoan
          ? `<button class="return-trigger" type="button">Mark Returned</button>`
          : `<button class="lend-trigger" type="button">Lend This Copy</button>`}
        <button class="remove-copy danger" type="button">Remove</button>
      </div>

      ${!onLoan ? `
        <div class="lend-inline-form">
          <input type="text" class="lend-to-input" placeholder="Who's borrowing it?">
          <div class="date-pair">
            <label class="date-field">
              <span>Lent on</span>
              <input type="date" class="lend-start-input" value="${today()}">
            </label>
          </div>
          <button class="btn btn-primary confirm-lend" type="button" style="margin-top:2px;">Confirm Loan</button>
        </div>
      ` : ""}

      ${history.length ? `
        <div class="loan-history">
          <p class="loan-history-title">Past loans (${history.length})</p>
          ${history.map((h, i) => {
            const span = daysBetween(h.lentDate, h.returnedDate);
            return `
              <div class="loan-history-row" data-history-index="${i}">
                <span class="loan-history-who">${escapeHtml(h.lentTo || "someone")}</span>
                <span class="loan-history-span">${fmtDate(h.lentDate) || "?"} → ${fmtDate(h.returnedDate) || "?"}${span ? ` · ${daysLabel(span)}` : ""}</span>
              </div>
            `;
          }).join("")}
        </div>
      ` : ""}
    </div>
  `;
}

function borrowedBlockHtml(rec) {
  const b = rec.borrowed || {};
  const holding = stillHolding(rec);
  const span = holding ? daysBetween(b.borrowedDate, today()) : daysBetween(b.borrowedDate, b.returnedDate);

  return `
    <div class="copies-section">
      <p class="copies-heading">Borrowed</p>
      <div class="copy-row" id="borrowedRow">
        <div class="copy-line">
          <div class="copy-status ${holding ? "on-loan" : "on-shelf"}">
            ${holding
              ? `← From ${escapeHtml(b.from || "someone")}${span ? ` · ${daysLabel(span)} so far` : ""}`
              : `Was ${escapeHtml(b.from || "someone")}'s · returned ${fmtDate(b.returnedDate)}${span ? ` · kept ${daysLabel(span)}` : ""}`}
          </div>
          <button class="mini-edit" id="borrowEditBtn" type="button" aria-label="Edit borrow details"><span class="btn-icon">${ICONS.edit}</span></button>
        </div>
        <div class="copy-dates" id="borrowDates" hidden>
          <label class="date-field">
            <span>Borrowed from</span>
            <input type="text" id="b-from" value="${escapeHtml(b.from || "")}">
          </label>
          <div class="date-pair">
            <label class="date-field">
              <span>Borrowed on</span>
              <input type="date" id="b-start" value="${b.borrowedDate || ""}">
            </label>
            <label class="date-field">
              <span>Returned on</span>
              <input type="date" id="b-returned" value="${b.returnedDate || ""}">
            </label>
          </div>
        </div>
        <div class="copy-actions">
          ${holding
            ? `<button class="return-trigger" id="giveBackBtn" type="button">Give It Back</button>`
            : `<button class="lend-trigger" id="reborrowBtn" type="button">Borrowed It Again</button>`}
          <button class="add-copy-btn" id="boughtItBtn" type="button" style="margin:0;">I own it now</button>
        </div>
      </div>
    </div>
  `;
}


/** Lets you correct the shelf after the fact. Moving out of Library discards
 *  copies (and their loan history), so that direction asks twice. */
function shelfSwitcherHtml(item, kindLabel) {
  const current = shelfOf(item);
  const opts = [
    { key: "library", label: kindLabel === "record" ? "Collection" : "Library" },
    { key: "wishlist", label: "Wishlist" },
    { key: "borrowed", label: "Borrowed" },
  ];
  return `
    <div class="field">
      <label>Shelf</label>
      <div class="destination-row three" id="shelfSwitch">
        ${opts.map((o) => `
          <button type="button" class="destination-btn ${current === o.key ? "active" : ""}" data-shelf-to="${o.key}">
            <span class="destination-title">${o.label}</span>
          </button>
        `).join("")}
      </div>
      <p class="settings-status" id="shelfWarn"></p>
    </div>
  `;
}

function editHtml(rec) {
  const owned = isOwned(rec);
  return `
    <div class="detail-top-row">
      <h2>Edit Details</h2>
      <button class="edit-toggle-btn" id="toggleEditBtn" type="button"><span class="btn-icon">${ICONS.eye}</span>View</button>
    </div>
    <div class="field">
      <label>Album</label>
      <input type="text" id="f-title" value="${escapeHtml(rec.title)}">
    </div>
    <div class="field">
      <label>Artist</label>
      <input type="text" id="f-creator" value="${escapeHtml(rec.creator || "")}">
    </div>
    <div class="field">
      <label>Year</label>
      <input type="text" id="f-year" inputmode="numeric" placeholder="1966" value="${escapeHtml(rec.year || "")}">
    </div>
    <div class="field">
      <label>Edition</label>
      <input type="text" id="f-edition" placeholder="Blue Note · BST 84003, or 2015 reissue" value="${escapeHtml(rec.edition || "")}">
      <p class="field-hint">Whatever tells this pressing apart — label, catalogue number, reissue year.</p>
    </div>
    <div class="field">
      <label>Barcode</label>
      <input type="text" id="f-barcode" inputmode="numeric" value="${escapeHtml(rec.barcode || "")}">
    </div>
    ${shelfSwitcherHtml(rec, "record")}
    <div class="field">
      <label>Sleeve art</label>
      <button class="btn btn-secondary" id="changeArtBtn" type="button" style="margin-top:0;">
        ${rec.customCover ? "Change art (using your photo)" : (rec.coverMbid || rec.coverRgid) ? "Change art (using picked art)" : "Change art"}
      </button>
    </div>
    ${!owned ? `
      <div class="field">
        <label>Price ($) — wishlist</label>
        <input type="number" step="0.01" id="f-price" value="${rec.price ?? ""}" placeholder="34.90">
      </div>
    ` : ""}
    <div class="btn-row">
      <button class="btn btn-primary" id="saveBtn" type="button">Save Changes</button>
    </div>
    <div class="danger-zone">
      <button class="btn btn-secondary" id="deleteBtn" type="button">Remove from collection</button>
    </div>
  `;
}

// ---------- wiring ----------

function wireView(sheet, rec, store, container, opts = {}) {
  wireCover(sheet, rec);

  const faveBtn = sheet.querySelector("#faveBtn");
  if (faveBtn) {
    faveBtn.addEventListener("click", () => {
      bounceTap(faveBtn);
      store.updateItem(rec.id, { favourite: !rec.favourite });
      refreshDetail(store, container, rec.id);
    });
  }

  const shareItemBtn = sheet.querySelector("#shareItemBtn");
  if (shareItemBtn) {
    shareItemBtn.addEventListener("click", () => {
      bounceTap(shareItemBtn);
      openShareSheet(shareCardsForRecord(rec), {
        filename: `stackt-${(rec.title || "record").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`,
      });
    });
  }

  const tap = sheet.querySelector("#coverTapTarget");
  if (tap) tap.addEventListener("click", () => openSleeveLightbox(rec));

  wireReview(sheet, rec, store, container);
  wireBorrowed(sheet, rec, store, container);

  const gotCopy = sheet.querySelector("#gotCopyBtn");
  if (gotCopy) {
    gotCopy.addEventListener("click", () => {
      store.updateItem(rec.id, {
        copies: [{ id: uid(), acquiredDate: today(), condition: null, currentLoan: null, history: [] }],
        price: null,
        priceCheckedDate: null,
      });
      refreshDetail(store, container, rec.id);
    });
  }

  const addCopy = sheet.querySelector("#addCopyBtn");
  if (addCopy) {
    addCopy.addEventListener("click", () => {
      store.updateItem(rec.id, {
        copies: [...(rec.copies || []), { id: uid(), acquiredDate: today(), condition: null, currentLoan: null, history: [] }],
      });
      refreshDetail(store, container, rec.id);
    });
  }

  wireCopies(sheet, rec, store, container, opts);
}

function wireCopies(sheet, rec, store, container, opts) {
  const copies = rec.copies || [];
  copies.forEach((c) => {
    const row = sheet.querySelector(`[data-copy-id="${c.id}"]`);
    if (!row) return;

    const patchCopies = (fn) => {
      store.updateItem(rec.id, { copies: copies.map((cc) => (cc.id === c.id ? fn(cc) : cc)) });
      refreshDetail(store, container, rec.id);
    };

    // Condition lives on the copy, so an original press and a reissue can differ.
    row.querySelectorAll(".cond-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const next = c.condition === btn.dataset.cond ? null : btn.dataset.cond;
        patchCopies((cc) => ({ ...cc, condition: next }));
      });
    });

    const miniEdit = row.querySelector(".mini-edit");
    const dateBlock = row.querySelector(".copy-dates");
    if (miniEdit && dateBlock) {
      miniEdit.addEventListener("click", () => {
        dateBlock.hidden = !dateBlock.hidden;
        miniEdit.classList.toggle("open", !dateBlock.hidden);
      });
    }

    const acquired = row.querySelector(".copy-acquired");
    wireDateField(acquired, () =>
      patchCopies((cc) => ({ ...cc, acquiredDate: acquired.value || null }))
    );

    const inlineForm = row.querySelector(".lend-inline-form");
    const lendBtn = row.querySelector(".lend-trigger");
    if (lendBtn && inlineForm) {
      lendBtn.addEventListener("click", () => inlineForm.classList.toggle("open"));
      if (opts.openLendFor === c.id) {
        inlineForm.classList.add("open");
        const who = inlineForm.querySelector(".lend-to-input");
        if (who) setTimeout(() => who.focus(), 250);
        setTimeout(() => row.scrollIntoView({ block: "center", behavior: "smooth" }), 120);
      }
    }

    const confirm = row.querySelector(".confirm-lend");
    if (confirm) {
      confirm.addEventListener("click", () => {
        const who = row.querySelector(".lend-to-input").value.trim();
        if (!who) return nudge(row.querySelector(".lend-to-input"));
        const lentDate = row.querySelector(".lend-start-input").value || today();
        patchCopies((cc) => ({ ...cc, currentLoan: { lentTo: who, lentDate } }));
      });
    }

    const loanWho = row.querySelector(".loan-who");
    const loanStart = row.querySelector(".loan-start");
    [loanWho, loanStart].forEach((input) => {
      wireDateField(input, () => {
        patchCopies((cc) => ({
          ...cc,
          currentLoan: {
            ...cc.currentLoan,
            lentTo: loanWho.value.trim() || cc.currentLoan.lentTo,
            lentDate: loanStart.value || null,
          },
        }));
      });
    });

    const closeLoanWith = (date) => {
      store.updateItem(rec.id, {
        copies: copies.map((cc) => {
          if (cc.id !== c.id || !cc.currentLoan) return cc;
          return { ...cc, currentLoan: null, history: [...(cc.history || []), { ...cc.currentLoan, returnedDate: date }] };
        }),
      });
      refreshDetail(store, container, rec.id);
    };

    const loanReturned = row.querySelector(".loan-returned");
    wireDateField(loanReturned, () => {
      if (loanReturned.value) closeLoanWith(loanReturned.value);
    });
    const returnBtn = row.querySelector(".return-trigger");
    if (returnBtn && !returnBtn.id) returnBtn.addEventListener("click", () => closeLoanWith(today()));

    const removeBtn = row.querySelector(".remove-copy");
    if (removeBtn) {
      removeBtn.addEventListener("click", () => {
        store.updateItem(rec.id, { copies: copies.filter((cc) => cc.id !== c.id) });
        refreshDetail(store, container, rec.id);
      });
    }
  });
}

function wireReview(sheet, rec, store, container) {
  const editBtn = sheet.querySelector("#reviewEditBtn");
  const read = sheet.querySelector("#reviewRead");
  const edit = sheet.querySelector("#reviewEdit");
  if (!editBtn || !read || !edit) return;

  let draft = normaliseRating(rec.rating);
  const starRow = edit.querySelector(".star-row");
  const score = edit.querySelector("#draftScore");
  const showScore = () => {
    if (score) score.textContent = draft ? `${formatRating(draft)}/5` : "";
  };

  editBtn.addEventListener("click", () => {
    const opening = edit.hidden;
    edit.hidden = !opening;
    read.hidden = opening;
    editBtn.classList.toggle("open", opening);
    if (opening) {
      paintStars(starRow, draft);
      makeClearable(edit.querySelector("#reviewInput"));
    }
  });

  wireStars(starRow, draft, (value) => {
    draft = value;
    showScore();
  });

  const clear = sheet.querySelector("#clearRating");
  if (clear) clear.addEventListener("click", () => { draft = 0; paintStars(starRow, 0); showScore(); });

  sheet.querySelector("#saveReviewBtn").addEventListener("click", () => {
    const text = sheet.querySelector("#reviewInput").value.trim();
    const had = !!(rec.review && rec.review.trim()) || !!rec.rating;
    const has = !!text || !!draft;
    store.updateItem(rec.id, {
      rating: draft || null,
      review: text || null,
      reviewDate: has ? (rec.reviewDate && had ? rec.reviewDate : today()) : null,
    });
    refreshDetail(store, container, rec.id);
  });
}

function wireBorrowed(sheet, rec, store, container) {
  const editBtn = sheet.querySelector("#borrowEditBtn");
  const dates = sheet.querySelector("#borrowDates");
  if (editBtn && dates) {
    editBtn.addEventListener("click", () => {
      dates.hidden = !dates.hidden;
      editBtn.classList.toggle("open", !dates.hidden);
    });
    ["#b-from", "#b-start", "#b-returned"].forEach((sel) => {
      const input = sheet.querySelector(sel);
      wireDateField(input, () => {
        store.updateItem(rec.id, {
          borrowed: {
            ...rec.borrowed,
            from: sheet.querySelector("#b-from").value.trim() || null,
            borrowedDate: sheet.querySelector("#b-start").value || null,
            returnedDate: sheet.querySelector("#b-returned").value || null,
          },
        });
        refreshDetail(store, container, rec.id);
      });
    });
  }

  const giveBack = sheet.querySelector("#giveBackBtn");
  if (giveBack) {
    giveBack.addEventListener("click", () => {
      store.updateItem(rec.id, { borrowed: { ...rec.borrowed, returnedDate: today() } });
      refreshDetail(store, container, rec.id);
    });
  }
  const reborrow = sheet.querySelector("#reborrowBtn");
  if (reborrow) {
    reborrow.addEventListener("click", () => {
      store.updateItem(rec.id, { borrowed: { ...rec.borrowed, borrowedDate: today(), returnedDate: null } });
      refreshDetail(store, container, rec.id);
    });
  }
  const bought = sheet.querySelector("#boughtItBtn");
  if (bought) {
    bought.addEventListener("click", () => {
      store.updateItem(rec.id, {
        copies: [{ id: uid(), acquiredDate: today(), condition: null, currentLoan: null, history: [] }],
      });
      refreshDetail(store, container, rec.id);
    });
  }
}


/** Applies a shelf change, warning first when it would throw data away. */
function wireShelfSwitcher(sheet, item, store, container, kindLabel) {
  const row = sheet.querySelector("#shelfSwitch");
  if (!row) return;
  const warn = sheet.querySelector("#shelfWarn");
  let armedFor = null;

  row.querySelectorAll("[data-shelf-to]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const to = btn.dataset.shelfTo;
      const from = shelfOf(item);
      if (to === from) return;

      const copies = item.copies || [];
      const losesHistory =
        from === "library" && copies.some((c) => c.currentLoan || (c.history || []).length);

      if (losesHistory && armedFor !== to) {
        armedFor = to;
        warn.textContent = `This drops ${copies.length} cop${copies.length === 1 ? "y" : "ies"} and their loan history. Tap again to confirm.`;
        warn.className = "settings-status bad";
        return;
      }

      const patch = { copies: [], borrowed: null, price: null, priceCheckedDate: null };
      if (to === "library") {
        patch.copies = copies.length
          ? copies
          : [{ id: uid(), acquiredDate: today(), condition: null, currentLoan: null, history: [] }];
        patch.borrowed = null;
      } else if (to === "borrowed") {
        // Keep any earlier borrow record rather than wiping who lent it to you.
        patch.borrowed = item.borrowed || { from: null, borrowedDate: today(), returnedDate: null };
      } else {
        patch.price = item.price ?? null;
        patch.priceCheckedDate = item.priceCheckedDate ?? null;
      }

      store.updateItem(item.id, patch);
      refreshDetail(store, container, item.id, { mode: "edit" });
    });
  });
}

function wireEdit(sheet, rec, store, container) {
  wireShelfSwitcher(sheet, rec, store, container, "record");
  ["#f-title", "#f-creator", "#f-edition"].forEach((sel) =>
    makeClearable(sheet.querySelector(sel))
  );
  const artBtn = sheet.querySelector("#changeArtBtn");
  if (artBtn) {
    artBtn.addEventListener("click", () => {
      openArtPicker(rec, async (pick) => {
        store.updateItem(rec.id, await applyArtPick(rec.id, pick));
        refreshDetail(store, container, rec.id, { mode: "edit" });
      });
    });
  }

  sheet.querySelector("#saveBtn").addEventListener("click", () => {
    const titleInput = sheet.querySelector("#f-title");
    if (!titleInput.value.trim()) return nudge(titleInput);

    const patch = {
      title: titleInput.value.trim(),
      creator: sheet.querySelector("#f-creator").value.trim(),
      year: sheet.querySelector("#f-year").value.trim() || null,
      edition: sheet.querySelector("#f-edition").value.trim() || null,
      barcode: sheet.querySelector("#f-barcode").value.trim() || null,
    };
    const priceInput = sheet.querySelector("#f-price");
    if (priceInput) {
      const parsed = parseFloat(priceInput.value);
      patch.price = isNaN(parsed) ? null : parsed;
      patch.priceCheckedDate = patch.price != null ? today() : null;
    }
    store.updateItem(rec.id, patch);
    dismissLayer();
    render(container, store);
  });

  sheet.querySelector("#deleteBtn").addEventListener("click", () => {
    deleteBlob(ownKey(rec.id)); // don't leave an orphan photo behind
      store.removeItem(rec.id);
    dismissLayer();
    render(container, store);
  });
}

// ---------- scanning ----------

function openScanModal(store, container) {
  let controller = null;

  openModal((sheet) => {
    sheet.innerHTML = `
      <h2>Scan a Record</h2>
      <div id="scanArea">
        <div id="lp-qr-reader" class="scan-video-wrap"></div>
        <div class="scan-zoom-wrap hidden" id="zoomWrap">
          <span class="scan-zoom-label">${ICONS.zoom}</span>
          <input type="range" id="zoomSlider" min="1" max="5" step="0.1" value="1">
          <button class="torch-btn hidden" id="torchBtn" type="button" aria-label="Toggle flash">${ICONS.torch}</button>
        </div>
      </div>
      <p class="scan-hint" id="scanHint">Starting camera…</p>
      <button class="link-btn" id="manualEntryBtn" type="button">Enter the barcode manually instead</button>
    `;

    const scanArea = sheet.querySelector("#scanArea");
    const hint = sheet.querySelector("#scanHint");
    const zoomWrap = sheet.querySelector("#zoomWrap");
    const zoomSlider = sheet.querySelector("#zoomSlider");
    const torchBtn = sheet.querySelector("#torchBtn");

    function showManual(message) {
      if (controller) { controller.stop(); controller = null; }
      scanArea.innerHTML = `
        <div class="field">
          <label>Barcode</label>
          <input type="text" id="manualBarcode" placeholder="602547896216" inputmode="numeric">
        </div>
        <button class="btn btn-primary" id="manualLookupBtn" type="button">Look Up</button>
      `;
      hint.textContent = message || "Type the number under the barcode on the sleeve.";
      scanArea.querySelector("#manualLookupBtn").addEventListener("click", () => {
        const code = scanArea.querySelector("#manualBarcode").value.trim();
        if (!code) return nudge(scanArea.querySelector("#manualBarcode"));
        handleScanned(code, store, container);
      });
    }

    sheet.querySelector("#manualEntryBtn").addEventListener("click", () => showManual());

    if (!window.isSecureContext) {
      showManual("Camera needs a secure (HTTPS) connection. Use the deployed link, or enter the barcode manually.");
      return;
    }
    if (!isScanSupported()) {
      showManual("Camera scanning isn't available in this browser — enter the barcode instead.");
      return;
    }

    startScanner("lp-qr-reader", (code) => {
      if (controller) { controller.stop(); controller = null; }
      handleScanned(code, store, container);
    })
      .then((ctrl) => {
        controller = ctrl;
        hint.textContent = "Hold the barcode flat and well-lit, filling most of the frame.";
        if (ctrl.zoom) {
          zoomWrap.classList.remove("hidden");
          zoomSlider.min = ctrl.zoom.min;
          zoomSlider.max = ctrl.zoom.max;
          zoomSlider.step = ctrl.zoom.step;
          zoomSlider.value = ctrl.zoom.min;
          zoomSlider.addEventListener("input", () => ctrl.zoom.apply(parseFloat(zoomSlider.value)));
        }
        if (ctrl.torch) {
          torchBtn.classList.remove("hidden");
          let on = false;
          torchBtn.addEventListener("click", () => {
            on = !on;
            ctrl.torch.apply(on);
            torchBtn.classList.toggle("on", on);
          });
        }
      })
      .catch((err) => {
        console.warn(err);
        showManual("Couldn't access the camera — enter the barcode instead.");
      });
  }, () => {
    if (controller) controller.stop();
  });
}

async function handleScanned(barcode, store, container) {
  const existing = store.get().items.find((it) => it.type === "lp" && it.barcode === barcode);
  if (existing) {
    openScanMatch(existing, store, container);
    return;
  }
  const meta = await lookupBarcode(barcode);
  openAddForm(store, container, meta || { barcode });
}

function openScanMatch(rec, store, container) {
  openModal((sheet) => {
    const copies = rec.copies || [];
    const kind = shelfOf(rec);
    const shelfCopy = copies.find((c) => !c.currentLoan) || null;
    const loaned = copies.find((c) => c.currentLoan) || null;
    const holding = kind === "borrowed" && stillHolding(rec);

    sheet.innerHTML = `
      <h2 style="text-align:center;">${holding ? "You borrowed this" : kind === "wishlist" ? "On your wishlist" : "Found it!"}</h2>
      ${coverBlockHtml(rec)}
      <p class="scan-match-title">${escapeHtml(rec.title)}</p>
      <p class="scan-match-sub">${escapeHtml(rec.creator || "")}${
        holding ? ` · borrowed from ${escapeHtml((rec.borrowed && rec.borrowed.from) || "someone")}`
        : kind === "wishlist" ? " · not in your collection yet"
        : ` · ${copies.length} cop${copies.length === 1 ? "y" : "ies"}`
      }</p>
      <div class="btn-row" style="flex-direction:column;">
        ${holding
          ? `<button class="btn btn-primary" id="giveBackMatch" type="button">Give it back to ${escapeHtml((rec.borrowed && rec.borrowed.from) || "them")}</button>`
          : loaned
          ? `<button class="btn btn-primary" id="returnMatch" type="button">Mark returned — ${escapeHtml(loaned.currentLoan.lentTo || "borrower")} gave it back</button>`
          : kind === "wishlist"
          ? `<button class="btn btn-primary" id="gotItMatch" type="button">I bought it — add to collection</button>`
          : `<button class="btn btn-primary" id="addCopyMatch" type="button">+ Add Another Copy</button>`}
        ${loaned && kind === "library" ? `<button class="btn btn-secondary" id="addCopyMatch2" type="button">+ Add Another Copy</button>` : ""}
        ${shelfCopy ? `<button class="btn btn-secondary" id="lendMatch" type="button">Lend It to Someone</button>` : ""}
        <button class="btn btn-secondary" id="viewMatch" type="button">View Details</button>
      </div>
    `;
    wireCover(sheet, rec);

    const addCopy = () => {
      store.updateItem(rec.id, {
        copies: [...copies, { id: uid(), acquiredDate: today(), condition: null, currentLoan: null, history: [] }],
      });
      refreshDetail(store, container, rec.id);
    };
    const a1 = sheet.querySelector("#addCopyMatch");
    const a2 = sheet.querySelector("#addCopyMatch2");
    if (a1) a1.addEventListener("click", addCopy);
    if (a2) a2.addEventListener("click", addCopy);

    const gotIt = sheet.querySelector("#gotItMatch");
    if (gotIt) {
      gotIt.addEventListener("click", () => {
        store.updateItem(rec.id, {
          copies: [{ id: uid(), acquiredDate: today(), condition: null, currentLoan: null, history: [] }],
          price: null,
          priceCheckedDate: null,
        });
        refreshDetail(store, container, rec.id);
      });
    }

    const giveBack = sheet.querySelector("#giveBackMatch");
    if (giveBack) {
      giveBack.addEventListener("click", () => {
        store.updateItem(rec.id, { borrowed: { ...rec.borrowed, returnedDate: today() } });
        refreshDetail(store, container, rec.id);
      });
    }

    const ret = sheet.querySelector("#returnMatch");
    if (ret) {
      ret.addEventListener("click", () => {
        store.updateItem(rec.id, {
          copies: copies.map((cc) =>
            cc.id === loaned.id
              ? { ...cc, currentLoan: null, history: [...(cc.history || []), { ...cc.currentLoan, returnedDate: today() }] }
              : cc
          ),
        });
        refreshDetail(store, container, rec.id);
      });
    }

    const lend = sheet.querySelector("#lendMatch");
    if (lend) lend.addEventListener("click", () => openDetail(rec, store, container, { openLendFor: shelfCopy.id }));

    sheet.querySelector("#viewMatch").addEventListener("click", () => openDetail(rec, store, container, { foundViaScan: true }));
  });
}

// ---------- add ----------

const PALETTE = ["#FF3B6B", "#3D5AFE", "#FFC738", "#00D9A3", "#8B5CF6"];
function randomColor() {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)];
}

function openAddForm(store, container, prefill = {}) {
  openModal((sheet) => {
    sheet.innerHTML = `
      <h2>Add a Record</h2>

      <div class="destination-row three" id="destRow">
        <button type="button" class="destination-btn active" data-dest="library">
          <span class="destination-title">Collection</span>
          <span class="destination-sub">I own it</span>
        </button>
        <button type="button" class="destination-btn" data-dest="wishlist">
          <span class="destination-title">Wishlist</span>
          <span class="destination-sub">Want it</span>
        </button>
        <button type="button" class="destination-btn" data-dest="borrowed">
          <span class="destination-title">Borrowed</span>
          <span class="destination-sub">Someone lent it</span>
        </button>
      </div>

      <div class="field" id="a-borrow-field" style="display:none">
        <label>Borrowed from</label>
        <input type="text" id="a-borrow-from" placeholder="Who lent it to you?">
      </div>

      <div class="field">
        <label>Sleeve art</label>
        <div id="addArtPreview" class="${prefill.mbid || prefill.rgid ? "" : "hidden"}">
          ${coverBlockHtml({ mbid: prefill.mbid, rgid: prefill.rgid, color: "#eee" })}
        </div>
        <button class="btn btn-secondary" id="addChooseArtBtn" type="button" style="margin-top:0;">Choose sleeve art</button>
        <p class="field-hint">Search the archive, or photograph your own copy.</p>
      </div>

      <div class="field">
        <label>Album</label>
        <input type="text" id="a-title" placeholder="Blue Train" value="${escapeHtml(prefill.title || "")}">
      </div>
      <div class="field">
        <label>Artist</label>
        <input type="text" id="a-creator" placeholder="John Coltrane" value="${escapeHtml(prefill.creator || "")}">
      </div>
      <div class="field">
        <label>Year</label>
        <input type="text" id="a-year" inputmode="numeric" placeholder="1957" value="${escapeHtml(prefill.year || "")}">
      </div>
      <div class="field">
        <label>Edition</label>
        <input type="text" id="a-edition" placeholder="Blue Note · BLP 1577" value="${escapeHtml(prefill.edition || "")}">
      </div>
      <div class="field">
        <label>Barcode (optional)</label>
        <input type="text" id="a-barcode" inputmode="numeric" placeholder="602547896216" value="${escapeHtml(prefill.barcode || "")}">
        <p class="isbn-lookup-status" id="lookupStatus"></p>
      </div>
      <div class="field" id="a-price-field" style="display:none">
        <label>Price ($)</label>
        <input type="number" step="0.01" id="a-price" placeholder="34.90">
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" id="addSaveBtn" type="button">Add to Collection</button>
      </div>
    `;

    const artBlock = sheet.querySelector("#addArtPreview");
    const titleInput = sheet.querySelector("#a-title");
    const creatorInput = sheet.querySelector("#a-creator");
    [titleInput, creatorInput].forEach((el) => makeClearable(el));
    const yearInput = sheet.querySelector("#a-year");
    const editionInput = sheet.querySelector("#a-edition");
    const barcodeInput = sheet.querySelector("#a-barcode");
    const status = sheet.querySelector("#lookupStatus");
    const priceInput = sheet.querySelector("#a-price");
    const priceField = sheet.querySelector("#a-price-field");
    const borrowField = sheet.querySelector("#a-borrow-field");
    const saveBtn = sheet.querySelector("#addSaveBtn");

    let picked = {
      customCover: null,
      coverMbid: prefill.mbid || null,
      coverRgid: prefill.rgid || null,
    };
    let pickedBlob = null;
    let pickedPreviewUrl = null;
    if (prefill.mbid || prefill.rgid) wireCover(sheet, { mbid: prefill.mbid, rgid: prefill.rgid });

    // Repaints the little preview from whatever art is currently picked.
    function repaintArt() {
      const shape = pickedPreviewUrl
        ? { customCover: pickedPreviewUrl, color: "#eee" }
        : { ...picked, color: "#eee" };
      artBlock.classList.toggle("hidden", !hasCover(shape));
      artBlock.innerHTML = coverBlockHtml(shape);
      wireCover(sheet, shape);
    }

    // Always offered, whether or not a barcode was scanned — you can add a
    // record by hand and still give it a sleeve.
    sheet.querySelector("#addChooseArtBtn").addEventListener("click", () => {
      openArtPicker(
        { title: titleInput.value.trim(), creator: creatorInput.value.trim(), ...picked },
        (pick) => {
          if (pickedPreviewUrl) URL.revokeObjectURL(pickedPreviewUrl);
          pickedBlob = pick.ownBlob || null;
          pickedPreviewUrl = pickedBlob ? URL.createObjectURL(pickedBlob) : null;
          picked = {
            customCover: null,
            coverMbid: pick.coverMbid ?? null,
            coverRgid: pick.coverRgid ?? null,
          };
          repaintArt();
        }
      );
    });

    let destination = "library";
    sheet.querySelectorAll(".destination-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        destination = btn.dataset.dest;
        sheet.querySelectorAll(".destination-btn").forEach((b) => b.classList.toggle("active", b === btn));
        priceField.style.display = destination === "wishlist" ? "" : "none";
        borrowField.style.display = destination === "borrowed" ? "" : "none";
        saveBtn.textContent =
          destination === "wishlist" ? "Add to Wishlist"
          : destination === "borrowed" ? "Add to Borrowed"
          : "Add to Collection";
      });
    });

    // Typing or pasting a barcode looks it up the same way scanning does.
    let lastLooked = null;
    barcodeInput.addEventListener("blur", async () => {
      const raw = barcodeInput.value.trim().replace(/[^0-9]/g, "");
      if (!raw || raw.length < 8) {
        status.textContent = raw ? "That doesn't look like a barcode." : "";
        return;
      }
      if (raw === lastLooked) return;
      lastLooked = raw;

      status.textContent = "Looking up this barcode…";
      const meta = await lookupBarcode(raw);
      if (!meta) {
        status.textContent = "No match found — fill in the details manually.";
        return;
      }
      if (!titleInput.value.trim() && meta.title) titleInput.value = meta.title;
      if (!creatorInput.value.trim() && meta.creator) creatorInput.value = meta.creator;
      if (!yearInput.value.trim() && meta.year) yearInput.value = meta.year;
      if (!editionInput.value.trim() && meta.edition) editionInput.value = meta.edition;
      if ((meta.mbid || meta.rgid) && !picked.customCover) {
        // Prefer the album's canonical art over this one pressing's — far more
        // releases have group art filed than have their own.
        picked = { customCover: null, coverMbid: meta.mbid || null, coverRgid: meta.rgid || null };
        repaintArt();
      }
      status.textContent = `Found: ${meta.title}${meta.creator ? " · " + meta.creator : ""}`;
    });

    saveBtn.addEventListener("click", () => {
      if (!titleInput.value.trim()) return nudge(titleInput);

      const owned = destination === "library";
      const price = destination === "wishlist" ? (parseFloat(priceInput.value) || null) : null;

      const created = store.addItem({
        type: "lp",
        title: titleInput.value.trim(),
        creator: creatorInput.value.trim(),
        year: yearInput.value.trim() || null,
        edition: editionInput.value.trim() || null,
        barcode: barcodeInput.value.trim() || null,
        customCover: picked.customCover,
        coverMbid: picked.coverMbid,
        coverRgid: picked.coverRgid,
        price,
        priceCheckedDate: price != null ? today() : null,
        color: randomColor(),
        copies: owned
          ? [{ id: uid(), acquiredDate: today(), condition: null, currentLoan: null, history: [] }]
          : [],
        borrowed:
          destination === "borrowed"
            ? { from: sheet.querySelector("#a-borrow-from").value.trim() || null, borrowedDate: today(), returnedDate: null }
            : null,
      });

      if (pickedBlob) {
        const key = ownKey(created.id);
        putBlob(key, pickedBlob, { permanent: true }).then((stored) => {
          if (stored) store.updateItem(created.id, { coverRef: key });
          if (pickedPreviewUrl) URL.revokeObjectURL(pickedPreviewUrl);
          render(container, store);
        });
      }

      dismissLayer();
      render(container, store);
    });
  });
}

/** Called by the header's share button — see applyChrome in core.js. */
function openShelfShare(store) {
  openShareSheet(shareCardsForShelf(store), { filename: "stackt-records" });
}

export default { render, openAddForm, openShelfShare };
