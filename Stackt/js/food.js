// ============================================
// Food — places you've eaten, and what you ate there.
//
// The shape is the Records module wearing a different hat:
//
//     record  -> copies (dated, with what you paid) -> tracks (rated, hearted)
//     place   -> visits (dated, with what you spent) -> dishes (rated, hearted)
//
// which is why so little here is new. The stars, the rating-versus-average
// line, the price handling and the card grid all came across.
//
// The one rule everything else bends around: A PHOTO AND A NAME IS A COMPLETE
// ENTRY. You are at a table, your food is getting cold, and any field the app
// insists on is a field that makes you stop using it — that's how the old
// spending tracker died. Everything past those two is offered later, on the
// place itself, and nothing ever goes red for being empty.
//
// Dishes hang off the PLACE rather than off a visit. "Their rendang is a 5"
// should stay true across fifteen trips instead of being buried inside
// whichever evening you happened to record it on.
// ============================================

import { uid } from "./core.js";
import {
  openModal, updateModal, openOverlay, dismissLayer, escapeHtml,
  makeClearable, debounce,
} from "./ui.js";
import { bounceTap, nudge } from "./animations.js";
import { ICONS } from "./icons.js";
import { createSorter, collator, openSortSheet } from "./sorting.js";
import { starsHtml, wireStars, formatRating } from "./stars.js";
import { openShareSheet } from "./share.js";
import { setCoverSrc, ownKey, putBlob, encodeCover, deleteBlob } from "./covers.js";
import { openMapPicker } from "./mapper.js";

// ---------- vocabulary ----------

/**
 * Kinds of place. Deliberately short: a list you scan in one look beats a
 * taxonomy you scroll. "Other" is there so nothing is unfileable.
 */
const KINDS = [
  { key: "restaurant", label: "Restaurant" },
  { key: "hawker", label: "Hawker / stall" },
  { key: "cafe", label: "Café" },
  { key: "bakery", label: "Bakery" },
  { key: "dessert", label: "Dessert" },
  { key: "bar", label: "Bar" },
  { key: "other", label: "Other" },
];
const KIND_LABELS = Object.fromEntries(KINDS.map((k) => [k.key, k.label]));

/**
 * Tags are the only part of a food entry you can search on afterwards.
 *
 * A written review is better to read and useless to query — "everything I
 * tagged spicy and rated 4+" is a real question and no amount of prose
 * answers it. So the vocabulary is fixed and tappable rather than free text:
 * two people typing "crispy" and "Crispy" would split the same idea in half.
 */
const DISH_TAGS = [
  "rich", "light", "crispy", "tender", "fresh", "comforting",
  "spicy", "sweet", "salty", "sour", "smoky", "greasy",
  "too sweet", "too salty", "bland", "dry",
  "generous", "small portion", "worth queueing",
];

const PLACE_TAGS = [
  "cheap", "good value", "pricey",
  "great service", "slow service", "friendly",
  "quiet", "noisy", "cosy", "cramped",
  "clean", "cash only", "long queue",
  "good for groups", "good alone", "late night", "worth the trip",
];

/**
 * Prompts, not a form.
 *
 * A blank review box gets you nothing — you open it, you have nothing to say
 * on demand, you close it. A question you can answer in one line gets a real
 * sentence. They're tappable and skippable: you answer whichever has an
 * answer tonight, and the rest aren't asked again.
 */
const DISH_PROMPTS = [
  "Would you order it again?",
  "What surprised you?",
  "How would you describe it to someone?",
  "What let it down?",
];

const PLACE_PROMPTS = [
  "First impression?",
  "How was the pricing?",
  "How was getting there?",
  "How was the service?",
  "Who would you bring here?",
];

/* The card colour a place gets when it has no photo yet. Straight from the
   app palette so a photoless shelf still looks like Stackt. */
const SWATCH_COLOURS = ["#D6249F", "#FF3B6B", "#FFC738", "#00D9A3", "#8B5CF6", "#3D5AFE"];

// ---------- module state ----------

let shelf = "been";        // 'been' | 'totry'
let favesOnly = false;
let searchQuery = "";
let tagFilter = null;

// ---------- small helpers ----------

/**
 * Today, in the phone's own timezone.
 *
 * NOT toISOString().slice(0,10), which the other modules use — that's UTC, and
 * east of Greenwich it reads as yesterday for the first hours of the morning.
 * A record bought at 7am filed a day early is a curiosity; breakfast filed on
 * the wrong day is the module getting its one job wrong.
 */
function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function money(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "";
  return Math.abs(v) >= 1000 ? `$${Math.round(v).toLocaleString()}` : `$${v.toFixed(2)}`;
}

function parseAmount(raw) {
  const text = String(raw == null ? "" : raw).trim();
  if (!text) return null;
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function placesOf(store) {
  return store.get().items.filter((it) => it.type === "place");
}

function visitsOf(place) {
  return [...(place.visits || [])].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

function lastVisit(place) {
  const v = visitsOf(place);
  return v.length ? v[0].date : null;
}

/**
 * Days since you were last there — the number behind "haven't been in a while".
 *
 * Counted between two calendar dates, not from elapsed milliseconds. Rounding
 * the elapsed time called a visit from this morning "yesterday" the moment the
 * clock passed midday, which is a small wrongness you'd notice immediately.
 */
function daysSinceVisit(place) {
  const last = lastVisit(place);
  if (!last) return null;
  const [ly, lm, ld] = last.split("-").map(Number);
  if (!ly || !lm || !ld) return null;
  const then = Date.UTC(ly, lm - 1, ld);
  const [ty, tm, td] = today().split("-").map(Number);
  const now = Date.UTC(ty, tm - 1, td);
  return Math.max(0, Math.round((now - then) / 86400000));
}

function agoLabel(days) {
  if (days == null) return "";
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  if (months < 18) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.round(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

/** What a visit here usually costs. Only visits you priced count. */
function typicalSpend(place) {
  const spends = (place.visits || []).map((v) => Number(v.spent)).filter((n) => Number.isFinite(n) && n > 0);
  if (!spends.length) return null;
  return spends.reduce((a, b) => a + b, 0) / spends.length;
}

/**
 * The dish average, and how many of them you've actually rated.
 *
 * Same contract as the record's track average: your rating of the place stays
 * yours, and this sits next to it so you can see where they disagree. Great
 * food and miserable service is a real thing and the app shouldn't average it
 * away.
 */
function dishAverage(place) {
  const dishes = place.dishes || [];
  const rated = dishes.filter((d) => d.rating != null);
  if (!rated.length) return null;
  const mean = rated.reduce((n, d) => n + Number(d.rating), 0) / rated.length;
  return { mean: Math.round(mean * 2) / 2, count: rated.length, of: dishes.length };
}

/** Best dishes first — that's the whole answer to "what do I order here". */
function dishesByBest(place) {
  return [...(place.dishes || [])].sort((a, b) => {
    if (!!b.favourite !== !!a.favourite) return b.favourite ? 1 : -1;
    const ar = a.rating == null ? -1 : Number(a.rating);
    const br = b.rating == null ? -1 : Number(b.rating);
    if (br !== ar) return br - ar;
    return collator.compare(a.name || "", b.name || "");
  });
}

function placePhotoKey(place) {
  return ownKey(place.id);
}
function dishPhotoKey(place, dish) {
  // Same `own:` namespace as every other photo you took, so backups and the
  // storage report pick these up without knowing what a dish is.
  return ownKey(`${place.id}-${dish.id}`);
}

function hasPhoto(place) {
  return !!(place && place.coverRef);
}

function allTags(store) {
  const counts = new Map();
  placesOf(store).forEach((p) => {
    const seen = new Set([...(p.tags || [])]);
    (p.dishes || []).forEach((d) => (d.tags || []).forEach((t) => seen.add(t)));
    seen.forEach((t) => counts.set(t, (counts.get(t) || 0) + 1));
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || collator.compare(a[0], b[0]));
}

function matchesSearch(place) {
  const q = searchQuery.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    place.title,
    place.area,
    KIND_LABELS[place.kind],
    ...(place.tags || []),
    ...(place.dishes || []).map((d) => d.name),
    ...(place.dishes || []).flatMap((d) => d.tags || []),
  ].filter(Boolean).join(" ").toLowerCase();
  return hay.includes(q);
}

function matchesTag(place) {
  if (!tagFilter) return true;
  if ((place.tags || []).includes(tagFilter)) return true;
  return (place.dishes || []).some((d) => (d.tags || []).includes(tagFilter));
}

// ---------- sorting ----------

const SORT_CRITERIA = [
  { key: "title", label: "Name", asc: "A–Z", desc: "Z–A", note: "Default" },
  {
    key: "rating", label: "Rating", asc: "highest first", desc: "lowest first",
    value: (p) => p.rating || null,
    compare: (x, y) => y - x,
    describe: (p) => (p.rating ? `${formatRating(p.rating)}/5` : ""),
  },
  {
    // The real answer to "where tonight" is usually somewhere you liked and
    // haven't been to lately, so this direction is the useful one by default.
    key: "lastVisit", label: "Last visited", asc: "longest ago first", desc: "most recent first",
    value: (p) => lastVisit(p),
    compare: (x, y) => (x < y ? -1 : x > y ? 1 : 0),
    describe: (p) => {
      const d = daysSinceVisit(p);
      return d == null ? "" : `Last went ${agoLabel(d)}`;
    },
  },
  {
    key: "visits", label: "Most visited", asc: "most first", desc: "fewest first",
    value: (p) => (p.visits || []).length || null,
    compare: (x, y) => y - x,
    describe: (p) => {
      const n = (p.visits || []).length;
      return n ? `${n} visit${n === 1 ? "" : "s"}` : "";
    },
  },
  {
    key: "spend", label: "Typical spend", asc: "cheapest first", desc: "priciest first",
    value: (p) => typicalSpend(p),
    compare: (x, y) => x - y,
    describe: (p) => {
      const s = typicalSpend(p);
      return s == null ? "" : `Usually ${money(s)}`;
    },
  },
  {
    key: "favourite", label: "Favourites", asc: "hearted first", desc: "hearted last",
    value: (p) => (p.favourite ? 1 : null),
    compare: () => 0,
  },
  {
    key: "added", label: "Date added", asc: "newest first", desc: "oldest first",
    value: (p) => p.addedDate || null,
    compare: (x, y) => (x < y ? 1 : x > y ? -1 : 0),
    describe: (p) => (p.addedDate ? `Added ${fmtDate(p.addedDate)}` : ""),
  },
];

const sorter = createSorter(SORT_CRITERIA, "title");

// ---------- the shelf ----------

function render(container, store, opts) {
  if (opts !== undefined) {
    sorter.reset();
    favesOnly = false;
    tagFilter = null;
  }

  const wrap = document.createElement("div");

  const title = document.createElement("p");
  title.className = "view-title";
  title.textContent = favesOnly ? "Favourites" : shelf === "totry" ? "Want to try" : "Food";
  wrap.appendChild(title);

  const searchRow = document.createElement("div");
  searchRow.className = "search-row";
  searchRow.innerHTML = `
    <input type="text" class="search-input" id="searchInput"
           placeholder="Search a place, a dish or a tag..." value="${escapeHtml(searchQuery)}">
    <button class="icon-btn ${sorter.isDefault ? "" : "on"}" id="sortBtn" type="button" aria-label="Sort">${ICONS.sort}</button>
  `;
  wrap.appendChild(searchRow);

  if (!sorter.isDefault) {
    const note = document.createElement("p");
    note.className = "sort-note";
    note.textContent = `Sorted by ${sorter.label()}`;
    wrap.appendChild(note);
  }

  const modeToggle = document.createElement("div");
  modeToggle.className = "mode-toggle";
  modeToggle.innerHTML =
    [["been", "Been"], ["totry", "Want to try"]]
      .map(([k, label]) =>
        `<button class="mode-btn ${shelf === k && !favesOnly ? "active" : ""}" data-shelf="${k}" type="button">${label}</button>`)
      .join("") +
    `<button class="mode-btn faves-btn ${favesOnly ? "active" : ""}" data-faves="1" type="button" aria-label="Favourites">
       <span class="faves-icon">${ICONS.heart}</span>
     </button>`;
  wrap.appendChild(modeToggle);

  const bodyHolder = document.createElement("div");
  wrap.appendChild(bodyHolder);

  container.innerHTML = "";
  container.appendChild(wrap);

  const searchInput = wrap.querySelector("#searchInput");
  const runSearch = debounce(() => renderBody(bodyHolder, store, container), 180);
  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    runSearch();
  });
  makeClearable(searchInput);

  wrap.querySelector("#sortBtn").addEventListener("click", (e) => {
    bounceTap(e.currentTarget);
    openSortSheet(sorter, () => render(container, store), "Places");
  });

  wrap.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      bounceTap(btn);
      if (btn.dataset.faves) {
        favesOnly = !favesOnly;
        render(container, store);
        return;
      }
      favesOnly = false;
      shelf = btn.dataset.shelf;
      render(container, store);
    });
  });

  renderBody(bodyHolder, store, container);
}

function renderBody(bodyHolder, store, container) {
  bodyHolder.innerHTML = "";

  const pool = placesOf(store).filter((p) =>
    favesOnly ? p.favourite : shelf === "totry" ? p.wantToTry : !p.wantToTry
  );
  const list = sorter.sort(pool.filter(matchesSearch).filter(matchesTag));

  renderTagRow(bodyHolder, store, container);

  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `
      <div class="empty-state-icon">${ICONS.food}</div>
      <p>${
        searchQuery.trim() || tagFilter
          ? "Nothing matches that."
          : favesOnly
          ? "No favourites yet — heart a place you'd go back to."
          : shelf === "totry"
          ? "Nowhere on the list yet. Add a place and mark it as one to try."
          : "Nothing here yet. Tap + the next time you eat somewhere — a photo and a name is enough."
      }</p>`;
    bodyHolder.appendChild(empty);
    return;
  }

  const grid = document.createElement("div");
  grid.className = "card-grid";
  list.forEach((place) => grid.appendChild(buildCard(place, () => openDetail(place, store, container))));
  bodyHolder.appendChild(grid);
}

/** Tag chips, but only once there are tags — an empty filter row is furniture. */
function renderTagRow(bodyHolder, store, container) {
  const tags = allTags(store);
  if (!tags.length) return;

  const row = document.createElement("div");
  row.className = "filter-row";
  row.innerHTML =
    `<button class="filter-chip ${tagFilter ? "" : "active"}" data-tag="" type="button">All</button>` +
    tags.slice(0, 14)
      .map(([t, n]) =>
        `<button class="filter-chip ${tagFilter === t ? "active" : ""}" data-tag="${escapeHtml(t)}" type="button">` +
        `${escapeHtml(t)}<span class="chip-count">${n}</span></button>`)
      .join("");
  row.querySelectorAll(".filter-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      tagFilter = chip.dataset.tag || null;
      render(container, store);
    });
  });
  bodyHolder.appendChild(row);
}

function buildCard(place, onTap) {
  const card = document.createElement("div");
  card.className = "item-card";

  const pill = place.wantToTry
    ? `<span class="status-pill status-to-read">Want to try</span>`
    : `<span class="status-pill status-read">${escapeHtml(KIND_LABELS[place.kind] || "Been")}</span>`;

  let extra = "";
  const sub = sorter.describe(place);
  if (sub) extra += `<div class="lent-note">${escapeHtml(sub)}</div>`;

  if (!place.wantToTry) {
    const visits = (place.visits || []).length;
    const days = daysSinceVisit(place);
    if (visits && sorter.key !== "visits" && sorter.key !== "lastVisit") {
      extra += `<div class="lent-note">${visits} visit${visits === 1 ? "" : "s"}${
        days != null ? ` · ${agoLabel(days)}` : ""
      }</div>`;
    }
    const best = dishesByBest(place).find((d) => d.rating != null || d.favourite);
    if (best) {
      extra += `<div class="lent-note">Best: ${escapeHtml(best.name)}</div>`;
    }
  }
  if (place.rating) extra += `<div class="card-stars">${starsHtml(place.rating)}</div>`;

  const inner = hasPhoto(place)
    ? `<span class="swatch-emoji">${ICONS.food}</span><img class="swatch-img" alt="">`
    : `<span class="swatch-emoji">${ICONS.food}</span>`;

  const faveMark = place.favourite
    ? `<span class="card-fave" aria-label="Favourite">${ICONS.heart}</span>`
    : "";

  card.innerHTML = `
    <div class="item-swatch ${hasPhoto(place) ? "shimmer" : ""}" style="background:${place.color || "#eee"}">${inner}</div>
    <div class="item-body">
      <p class="item-title">${escapeHtml(place.title)}</p>
      <!-- Just the area: the pill underneath already says what kind of place
           it is, and falling back to the kind here printed it twice. -->
      <p class="item-creator">${escapeHtml(place.area || "")}</p>
      ${pill}
      ${extra}
    </div>
    ${faveMark}
  `;
  card.addEventListener("click", () => {
    bounceTap(card);
    onTap(place);
  });

  if (hasPhoto(place)) {
    const swatch = card.querySelector(".item-swatch");
    const img = swatch.querySelector(".swatch-img");
    const emoji = swatch.querySelector(".swatch-emoji");
    img.addEventListener("load", () => {
      img.classList.add("loaded");
      if (emoji) emoji.classList.add("hidden");
      swatch.classList.remove("shimmer");
    });
    img.addEventListener("error", () => swatch.classList.remove("shimmer"));
    setCoverSrc(img, place.coverRef);
  }
  return card;
}

// ---------- photos ----------

/**
 * Files a photo against a key, shrinking it on the way in.
 *
 * 1000px rather than the 400px covers use: you have to be able to see the
 * dish. That lands around 100KB of WebP, so a few thousand meals still fit
 * inside the blob store's budget.
 */
async function storePhoto(key, file) {
  const blob = await encodeCover(file, 1000, 0.75);
  await putBlob(key, blob, { permanent: true });
  return key;
}

/** A file input dressed as a button, matching the art picker's. */
function photoField(id, label, sub) {
  return `
    <label class="cover-upload" for="${id}">
      <input type="file" id="${id}" accept="image/*" hidden>
      <span class="cover-upload-icon">${ICONS.lens}</span>
      <span>
        <strong>${escapeHtml(label)}</strong>
        <small>${escapeHtml(sub)}</small>
      </span>
    </label>
  `;
}

/**
 * Wires a photo field to a live preview.
 *
 * The file is held rather than written: an add form you abandon halfway
 * shouldn't leave an orphaned image in the blob store.
 */
function wirePhotoField(root, id, onPicked) {
  const input = root.querySelector(`#${id}`);
  if (!input) return;
  input.addEventListener("change", () => {
    const file = input.files && input.files[0];
    if (!file) return;
    const label = input.closest(".cover-upload");
    const url = URL.createObjectURL(file);
    if (label) {
      label.classList.add("has-photo");
      label.style.backgroundImage = `url(${url})`;
      const strong = label.querySelector("strong");
      if (strong) strong.textContent = "Photo added";
      const small = label.querySelector("small");
      if (small) small.textContent = "Tap to choose a different one";
    }
    onPicked(file);
  });
}

// ---------- location ----------

// The phone's own GPS used to be the only way to place somewhere, which was
// right for the stall you're standing in and useless for the shop you're
// remembering from this morning. Both now go through the map picker, which
// offers your location AND a pin you can drag. See js/mapper.js.

function mapsUrl(place) {
  if (place.lat == null || place.lon == null) return null;
  return `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lon}`;
}

// ---------- adding ----------

/**
 * The add form, and the whole design in one screen.
 *
 * Photo and name, then Save. Everything else on this sheet is optional and
 * visibly so. The Save button is live from the moment there's a name — if you
 * ever find yourself unable to save because a second field is empty, that's a
 * bug in this function.
 */
function openAddForm(store, container, prefill = {}) {
  let photoFile = null;
  let coords = null;

  openModal((sheet) => {
    sheet.innerHTML = `
      <h2>Somewhere new</h2>
      <p class="add-hint">A photo and a name is enough. The rest can wait.</p>

      ${photoField("fdPhoto", "Photograph what you ate", "Or pick one from your library")}

      <div class="field">
        <label for="fdName">Where were you?</label>
        <input type="text" id="fdName" placeholder="Nasi Lemak Wanjo"
               value="${escapeHtml(prefill.title || "")}">
      </div>

      <p class="cover-picker-label">What kind of place <span class="field-hint">optional</span></p>
      <div class="filter-row" id="fdKinds">
        ${KINDS.map((k, i) => `
          <button type="button" class="filter-chip ${i === 0 ? "active" : ""}" data-kind="${k.key}">${k.label}</button>
        `).join("")}
      </div>

      <div class="field">
        <label for="fdArea">Area <span class="field-hint">optional</span></label>
        <input type="text" id="fdArea" placeholder="Kampung Baru" value="${escapeHtml(prefill.area || "")}">
      </div>

      <button class="btn btn-secondary block-btn" id="fdWhere" type="button">
        <span class="btn-icon">${ICONS.pin}</span> Put it on the map
      </button>
      <p class="settings-note" id="fdWhereNote">
        Use your location, or drag the pin to where the place actually is.
        Nothing is sent anywhere.
      </p>

      <label class="switch-row">
        <input type="checkbox" id="fdToTry">
        <span>I haven't been yet — this is one to try</span>
      </label>

      <button class="btn btn-primary block-btn" id="fdSave" type="button">Save</button>
    `;

    const name = sheet.querySelector("#fdName");
    let kind = KINDS[0].key;

    wirePhotoField(sheet, "fdPhoto", (file) => { photoFile = file; });

    sheet.querySelectorAll("#fdKinds .filter-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        sheet.querySelectorAll("#fdKinds .filter-chip").forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        kind = chip.dataset.kind;
      });
    });

    const whereBtn = sheet.querySelector("#fdWhere");
    whereBtn.addEventListener("click", () => {
      bounceTap(whereBtn);
      openMapPicker({
        lat: coords ? coords.lat : null,
        lon: coords ? coords.lon : null,
        title: name.value.trim() || "Where is it?",
        onPick: (c) => {
          coords = c;
          whereBtn.innerHTML = c
            ? `<span class="btn-icon">${ICONS.pin}</span> On the map`
            : `<span class="btn-icon">${ICONS.pin}</span> Put it on the map`;
          whereBtn.classList.toggle("btn-accent", !!c);
          sheet.querySelector("#fdWhereNote").textContent = c
            ? "Saved. You can open this place in Maps from its page."
            : "Use your location, or drag the pin to where the place actually is.";
        },
      });
    });

    sheet.querySelector("#fdSave").addEventListener("click", async () => {
      const title = name.value.trim();
      if (!title) return nudge(name);

      const wantToTry = sheet.querySelector("#fdToTry").checked;
      const place = store.addItem({
        type: "place",
        title,
        kind,
        area: sheet.querySelector("#fdArea").value.trim() || null,
        lat: coords ? coords.lat : null,
        lon: coords ? coords.lon : null,
        color: SWATCH_COLOURS[Math.floor(Math.random() * SWATCH_COLOURS.length)],
        coverRef: null,
        rating: null,
        review: null,
        reviewDate: null,
        favourite: false,
        tags: [],
        dishes: [],
        // Somewhere you've been gets its first visit dated now; somewhere you
        // only want to try has none, which is exactly what separates the two
        // shelves without a second flag to keep in sync.
        visits: wantToTry ? [] : [{ id: uid(), date: today(), spent: null, note: null }],
        wantToTry,
      });

      if (photoFile) {
        try {
          const key = placePhotoKey(place);
          await storePhoto(key, photoFile);
          store.updateItem(place.id, { coverRef: key });
        } catch (err) {
          console.warn("Could not save that photo:", err);
        }
      }

      dismissLayer();
      shelf = wantToTry ? "totry" : "been";
      favesOnly = false;
      render(container, store);
    });

    setTimeout(() => name.focus(), 80);
  });
}

// ---------- the place ----------

function openDetail(place, store, container) {
  openModal((sheet) => paintDetail(sheet, place, store, container));
}

function refreshDetail(store, container, id) {
  const fresh = store.get().items.find((it) => it.id === id);
  if (!fresh) {
    dismissLayer();
    render(container, store);
    return;
  }
  updateModal((sheet) => paintDetail(sheet, fresh, store, container));
  render(container, store);
}

function paintDetail(sheet, place, store, container) {
  const avg = dishAverage(place);
  const dishes = dishesByBest(place);
  const visits = visitsOf(place);
  const spend = typicalSpend(place);
  const days = daysSinceVisit(place);
  const maps = mapsUrl(place);

  sheet.innerHTML = `
    <div class="detail-top-row">
      <h2>${escapeHtml(place.title)}</h2>
      <button class="icon-btn detail-fave ${place.favourite ? "on" : ""}" id="fdFave" type="button"
              aria-pressed="${!!place.favourite}" aria-label="Favourite">${ICONS.heart}</button>
      <button class="icon-btn detail-share" id="fdShare" type="button" aria-label="Share this place">${ICONS.share}</button>
      <button class="edit-toggle-btn" id="fdEdit" type="button"><span class="btn-icon">${ICONS.edit}</span>Edit</button>
    </div>

    <!-- With no photo this used to be a huge empty colour block: a lot of
         screen saying nothing, pushing the dishes below the fold. A place
         without one gets an invitation instead, which is both smaller and
         useful. -->
    ${hasPhoto(place) ? `
      <div class="detail-cover-wrap">
        <img class="detail-cover" id="fdHero" alt="">
        <div class="detail-cover-fallback shimmer" id="fdHeroFallback"
             style="background:${place.color || "#eee"}">${ICONS.food}</div>
      </div>
    ` : `
      <button class="cover-upload photo-invite" id="fdAddPhoto" type="button">
        <span class="cover-upload-icon">${ICONS.lens}</span>
        <span>
          <strong>Add a photo</strong>
          <small>The one thing you'll be glad of in two years</small>
        </span>
      </button>
    `}

    <p class="detail-author">${escapeHtml(KIND_LABELS[place.kind] || "Place")}</p>
    ${place.area ? `<p class="detail-meta">${escapeHtml(place.area)}</p>` : ""}

    ${place.wantToTry ? `
      <button class="btn btn-primary block-btn" id="fdBeen" type="button">I've been now</button>
      <p class="settings-note">Marks your first visit and moves it onto your shelf.</p>
    ` : ""}

    <p class="cover-picker-label">How was it</p>
    <div class="star-row interactive" id="fdStars">${starsHtml(place.rating, true)}</div>

    ${avg ? `
      <div class="rate-compare">
        <span class="rate-compare-mine">You: ${place.rating ? `${formatRating(place.rating)}★` : "—"}</span>
        <span class="rate-compare-sep">·</span>
        <span class="rate-compare-tracks">Dishes: ${formatRating(avg.mean)}★</span>
        <span class="rate-compare-count">(${avg.count} of ${avg.of} rated)</span>
      </div>
    ` : ""}

    <!-- Dishes first: "what do I order here again" is the question you open
         this screen with, and it should be answered without scrolling. -->
    <div class="dish-block">
      <div class="track-head">
        <span class="track-title">Dishes</span>
        ${dishes.length ? `<span class="track-runtime">${dishes.length} dish${dishes.length === 1 ? "" : "es"}</span>` : ""}
      </div>
      ${dishes.length
        ? `<div class="dish-rows">${dishes.map((d) => dishRowHtml(place, d)).join("")}</div>`
        : `<p class="track-empty">Nothing listed yet. Add what you ate — a name and a photo will do.</p>`}
      <div class="track-actions">
        <button class="link-btn" id="fdAddDish" type="button">${dishes.length ? "Add a dish" : "Add what you ate"}</button>
      </div>
    </div>

    ${tagBlockHtml(place.tags || [], "fdTags", "How's the place?", { collapsible: true })}

    <div class="review-block">
      <div class="review-head">
        <span class="review-title">Your notes</span>
        <button class="mini-edit" id="fdWrite" type="button" aria-label="Edit notes"><span class="btn-icon">${ICONS.edit}</span></button>
      </div>
      <div class="review-read">
        ${place.review
          ? `<p class="review-text">${escapeHtml(place.review)}</p>
             ${place.reviewDate ? `<p class="review-date">Noted ${fmtDate(place.reviewDate)}</p>` : ""}`
          : `<p class="review-empty">Nothing written yet — tap the pencil and it'll give you something to answer.</p>`}
      </div>
    </div>

    <div class="visit-block">
      <div class="track-head">
        <span class="track-title">Visits</span>
        ${visits.length ? `<span class="track-runtime">${visits.length}${
          spend != null ? ` · usually ${money(spend)}` : ""
        }</span>` : ""}
      </div>
      ${visits.length
        ? `<div class="visit-rows">${visits.map((v) => visitRowHtml(v)).join("")}</div>`
        : `<p class="track-empty">No visits recorded.</p>`}
      <div class="track-actions">
        <button class="link-btn" id="fdAddVisit" type="button">Add a visit</button>
        ${days != null ? `<span class="visit-ago">Last went ${agoLabel(days)}</span>` : ""}
      </div>
    </div>

    ${maps ? `<a class="btn btn-secondary block-btn" id="fdMaps" href="${maps}" target="_blank" rel="noopener">
                <span class="btn-icon">${ICONS.pin}</span> Open in Maps
              </a>
              <button class="link-btn" id="fdStamp" type="button">Move the pin</button>`
           : `<button class="btn btn-secondary block-btn" id="fdStamp" type="button">
                <span class="btn-icon">${ICONS.pin}</span> Put it on the map
              </button>`}

    <button class="btn btn-secondary danger-btn block-btn" id="fdDelete" type="button">Remove this place</button>
  `;

  if (hasPhoto(place)) {
    const img = sheet.querySelector("#fdHero");
    const fallback = sheet.querySelector("#fdHeroFallback");
    img.addEventListener("load", () => {
      img.classList.add("loaded");
      fallback.classList.add("fade-out");
    });
    img.addEventListener("error", () => fallback.classList.remove("shimmer"));
    setCoverSrc(img, place.coverRef);
  }

  wireDetail(sheet, place, store, container);
}

function dishRowHtml(place, dish) {
  return `
    <div class="dish-row" data-dish="${escapeHtml(dish.id)}">
      <div class="dish-thumb ${dish.photoRef ? "shimmer" : ""}" data-thumb="${escapeHtml(dish.id)}">
        ${dish.photoRef
          ? `<span class="dish-thumb-icon">${ICONS.dish}</span><img class="dish-thumb-img" alt="">`
          : `<span class="dish-thumb-icon">${ICONS.dish}</span>`}
      </div>
      <div class="dish-main">
        <p class="dish-name">${escapeHtml(dish.name)}${
          dish.favourite ? `<span class="dish-heart">${ICONS.heart}</span>` : ""
        }</p>
        ${dish.rating != null ? `<div class="card-stars">${starsHtml(dish.rating)}</div>` : ""}
        ${(dish.tags || []).length
          ? `<p class="dish-tags">${dish.tags.map((t) => `<span class="dish-tag">${escapeHtml(t)}</span>`).join("")}</p>`
          : ""}
        ${dish.note ? `<p class="dish-note">${escapeHtml(dish.note)}</p>` : ""}
      </div>
    </div>
  `;
}

function visitRowHtml(visit) {
  return `
    <div class="visit-row" data-visit="${escapeHtml(visit.id)}">
      <span class="visit-date">${escapeHtml(fmtDate(visit.date))}</span>
      <span class="visit-note">${escapeHtml(visit.note || "")}</span>
      <span class="visit-spent">${visit.spent != null ? escapeHtml(money(visit.spent)) : "—"}</span>
    </div>
  `;
}

/**
 * The tag picker, used for both the place and a dish.
 *
 * Collapsed by default on a screen you're reading rather than filling in:
 * seventeen chips is most of a phone screen, and on the place sheet it pushed
 * the dishes — the thing you opened the screen for — below the fold. Collapsed
 * shows only what you've chosen, plus one chip that opens the rest.
 */
function tagBlockHtml(active, id, label, { collapsible = false } = {}) {
  const vocab = id.startsWith("fd") ? PLACE_TAGS : DISH_TAGS;
  const collapsed = collapsible && true;
  return `
    <p class="cover-picker-label">${escapeHtml(label)} <span class="field-hint">tap to tag</span></p>
    <div class="tag-row ${collapsed ? "collapsed" : ""}" id="${id}">
      ${vocab
        .map((t) => `<button type="button" class="tag-chip ${active.includes(t) ? "on" : ""}" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`)
        .join("")}
      ${collapsible
        ? `<button type="button" class="tag-chip tag-more" data-more="1">${active.length ? "More tags" : "Tag this place"}</button>`
        : ""}
    </div>
  `;
}

function wireDetail(sheet, place, store, container) {
  const redraw = () => refreshDetail(store, container, place.id);

  wireStars(sheet.querySelector("#fdStars"), place.rating, (value) => {
    store.updateItem(place.id, { rating: value || null });
    redraw();
  });

  sheet.querySelector("#fdFave").addEventListener("click", (e) => {
    bounceTap(e.currentTarget);
    store.updateItem(place.id, { favourite: !place.favourite });
    redraw();
  });

  sheet.querySelector("#fdShare").addEventListener("click", (e) => {
    bounceTap(e.currentTarget);
    openPlaceShare(place);
  });

  sheet.querySelector("#fdEdit").addEventListener("click", (e) => {
    bounceTap(e.currentTarget);
    openEditForm(place, store, container);
  });

  const addPhoto = sheet.querySelector("#fdAddPhoto");
  if (addPhoto) addPhoto.addEventListener("click", () => {
    bounceTap(addPhoto);
    openEditForm(place, store, container);
  });

  const tagRow = sheet.querySelector("#fdTags");
  const more = tagRow.querySelector(".tag-more");
  if (more) more.addEventListener("click", () => {
    tagRow.classList.remove("collapsed");
    more.remove();
  });

  sheet.querySelectorAll("#fdTags .tag-chip:not(.tag-more)").forEach((chip) => {
    chip.addEventListener("click", () => {
      const t = chip.dataset.tag;
      const has = (place.tags || []).includes(t);
      const tags = has ? place.tags.filter((x) => x !== t) : [...(place.tags || []), t];
      // Toggled in place rather than repainted: a full redraw here would
      // scroll you back to the top of the sheet mid-tag.
      chip.classList.toggle("on", !has);
      store.updateItem(place.id, { tags });
      place.tags = tags;
      render(container, store);
    });
  });

  const been = sheet.querySelector("#fdBeen");
  if (been) been.addEventListener("click", () => {
    bounceTap(been);
    store.updateItem(place.id, {
      wantToTry: false,
      visits: [...(place.visits || []), { id: uid(), date: today(), spent: null, note: null }],
    });
    shelf = "been";
    redraw();
  });

  sheet.querySelector("#fdAddDish").addEventListener("click", () => openDishEditor(place, store, container, null));

  sheet.querySelectorAll("[data-dish]").forEach((row) => {
    row.addEventListener("click", () => {
      bounceTap(row);
      const dish = (place.dishes || []).find((d) => d.id === row.dataset.dish);
      if (dish) openDishEditor(place, store, container, dish);
    });
  });

  sheet.querySelector("#fdAddVisit").addEventListener("click", () => openVisitEditor(place, store, container, null));

  sheet.querySelectorAll("[data-visit]").forEach((row) => {
    row.addEventListener("click", () => {
      bounceTap(row);
      const visit = (place.visits || []).find((v) => v.id === row.dataset.visit);
      if (visit) openVisitEditor(place, store, container, visit);
    });
  });

  sheet.querySelector("#fdWrite").addEventListener("click", () =>
    openWriteSheet({
      title: place.title,
      text: place.review,
      prompts: PLACE_PROMPTS,
      onSave: (text) => {
        store.updateItem(place.id, {
          review: text || null,
          reviewDate: text ? today() : null,
        });
        redraw();
      },
    }));

  const stamp = sheet.querySelector("#fdStamp");
  if (stamp) stamp.addEventListener("click", () => {
    bounceTap(stamp);
    openMapPicker({
      lat: place.lat, lon: place.lon, title: place.title,
      onPick: (c) => {
        store.updateItem(place.id, { lat: c ? c.lat : null, lon: c ? c.lon : null });
        redraw();
      },
    });
  });

  sheet.querySelector("#fdDelete").addEventListener("click", async () => {
    if (!window.confirm(`Remove ${place.title} and everything you wrote about it?`)) return;
    // The photos go with it. A delete that leaves twelve dish pictures behind
    // isn't a delete — it's a slow leak you'd only find in the storage report.
    await forgetPhotos(place);
    store.removeItem(place.id);
    dismissLayer();
    render(container, store);
  });

  // Dish thumbnails load after the sheet is in the DOM, same as the covers.
  sheet.querySelectorAll("[data-thumb]").forEach((holder) => {
    const dish = (place.dishes || []).find((d) => d.id === holder.dataset.thumb);
    if (!dish || !dish.photoRef) return;
    const img = holder.querySelector(".dish-thumb-img");
    img.addEventListener("load", () => {
      img.classList.add("loaded");
      const icon = holder.querySelector(".dish-thumb-icon");
      if (icon) icon.classList.add("hidden");
      holder.classList.remove("shimmer");
    });
    img.addEventListener("error", () => holder.classList.remove("shimmer"));
    setCoverSrc(img, dish.photoRef);
  });
}

async function forgetPhotos(place) {
  await deleteBlob(placePhotoKey(place));
  for (const dish of place.dishes || []) {
    if (dish.photoRef) await deleteBlob(dish.photoRef);
  }
}

// ---------- editing the place itself ----------

function openEditForm(place, store, container) {
  let photoFile = null;

  openOverlay("cover-picker-backdrop", (overlay) => {
    overlay.innerHTML = `
      <div class="cover-picker">
        <div class="cover-picker-head">
          <h2>Edit place</h2>
          <button class="lightbox-close" id="fdeClose" type="button" aria-label="Close"><span class="btn-icon">${ICONS.close}</span></button>
        </div>

        ${photoField("fdePhoto", place.coverRef ? "Replace the photo" : "Add a photo", "Taken or picked from your library")}

        <div class="field">
          <label for="fdeName">Name</label>
          <input type="text" id="fdeName" value="${escapeHtml(place.title)}">
        </div>
        <div class="field">
          <label for="fdeArea">Area</label>
          <input type="text" id="fdeArea" value="${escapeHtml(place.area || "")}">
        </div>

        <p class="cover-picker-label">What kind of place</p>
        <div class="filter-row" id="fdeKinds">
          ${KINDS.map((k) => `
            <button type="button" class="filter-chip ${place.kind === k.key ? "active" : ""}" data-kind="${k.key}">${k.label}</button>
          `).join("")}
        </div>

        <button class="btn btn-primary block-btn" id="fdeSave" type="button">Save</button>
      </div>
    `;

    let kind = place.kind;
    overlay.addEventListener("click", (e) => { if (e.target === overlay) dismissLayer(); });
    overlay.querySelector("#fdeClose").addEventListener("click", () => dismissLayer());
    wirePhotoField(overlay, "fdePhoto", (file) => { photoFile = file; });

    overlay.querySelectorAll("#fdeKinds .filter-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        overlay.querySelectorAll("#fdeKinds .filter-chip").forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        kind = chip.dataset.kind;
      });
    });

    overlay.querySelector("#fdeSave").addEventListener("click", async () => {
      const name = overlay.querySelector("#fdeName");
      const title = name.value.trim();
      if (!title) return nudge(name);

      const patch = { title, kind, area: overlay.querySelector("#fdeArea").value.trim() || null };
      if (photoFile) {
        try {
          const key = placePhotoKey(place);
          await storePhoto(key, photoFile);
          patch.coverRef = key;
        } catch (err) {
          console.warn("Could not save that photo:", err);
        }
      }
      store.updateItem(place.id, patch);
      dismissLayer();
      refreshDetail(store, container, place.id);
    });
  });
}

// ---------- a dish ----------

function openDishEditor(place, store, container, existing) {
  let photoFile = null;
  let tags = [...((existing && existing.tags) || [])];

  openOverlay("cover-picker-backdrop", (overlay) => {
    overlay.innerHTML = `
      <div class="cover-picker">
        <div class="cover-picker-head">
          <h2>${existing ? "Edit dish" : "What did you eat?"}</h2>
          <button class="lightbox-close" id="dsClose" type="button" aria-label="Close"><span class="btn-icon">${ICONS.close}</span></button>
        </div>

        ${photoField("dsPhoto", existing && existing.photoRef ? "Replace the photo" : "Photograph it", "Or pick one from your library")}

        <p class="cover-picker-label">Name</p>
        <input type="text" id="dsName" placeholder="Nasi lemak ayam berempah"
               value="${escapeHtml(existing ? existing.name : "")}">

        <p class="cover-picker-label">How was it</p>
        <div class="star-row interactive" id="dsStars">${starsHtml(existing ? existing.rating : null, true)}</div>

        <button class="tag-chip heart-chip ${existing && existing.favourite ? "on" : ""}" id="dsFave" type="button">
          <span class="heart-chip-icon">${ICONS.heart}</span> One of the best things here
        </button>

        ${tagBlockHtml(tags, "dsTags", "What was it like?")}

        <p class="cover-picker-label">A line about it <span class="field-hint">optional</span></p>
        <input type="text" id="dsNote" placeholder="Sambal has a proper kick"
               value="${escapeHtml(existing && existing.note ? existing.note : "")}">
        <button class="link-btn" id="dsPrompt" type="button">Give me a question to answer</button>

        <button class="btn btn-primary block-btn" id="dsSave" type="button">${existing ? "Save" : "Add"}</button>
        ${existing ? `<button class="btn btn-secondary danger-btn block-btn" id="dsDelete" type="button">Remove this dish</button>` : ""}
      </div>
    `;

    let rating = existing ? existing.rating : null;
    let favourite = !!(existing && existing.favourite);

    overlay.addEventListener("click", (e) => { if (e.target === overlay) dismissLayer(); });
    overlay.querySelector("#dsClose").addEventListener("click", () => dismissLayer());
    wirePhotoField(overlay, "dsPhoto", (file) => { photoFile = file; });

    wireStars(overlay.querySelector("#dsStars"), rating, (v) => { rating = v || null; });

    const fave = overlay.querySelector("#dsFave");
    fave.addEventListener("click", () => {
      favourite = !favourite;
      fave.classList.toggle("on", favourite);
    });

    overlay.querySelectorAll("#dsTags .tag-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const t = chip.dataset.tag;
        if (tags.includes(t)) tags = tags.filter((x) => x !== t);
        else tags.push(t);
        chip.classList.toggle("on", tags.includes(t));
      });
    });

    // The prompt drops a question into the box for you to answer over. Cycling
    // rather than showing all four keeps it a nudge instead of a questionnaire.
    const note = overlay.querySelector("#dsNote");
    let promptAt = 0;
    overlay.querySelector("#dsPrompt").addEventListener("click", () => {
      const q = DISH_PROMPTS[promptAt % DISH_PROMPTS.length];
      promptAt += 1;
      note.placeholder = q;
      note.focus();
    });

    overlay.querySelector("#dsSave").addEventListener("click", async () => {
      const nameInput = overlay.querySelector("#dsName");
      const name = nameInput.value.trim();
      if (!name) return nudge(nameInput);

      const id = existing ? existing.id : uid();
      let photoRef = existing ? existing.photoRef || null : null;
      if (photoFile) {
        try {
          photoRef = await storePhoto(dishPhotoKey(place, { id }), photoFile);
        } catch (err) {
          console.warn("Could not save that photo:", err);
        }
      }

      const dish = { id, name, photoRef, rating, favourite, tags, note: note.value.trim() || null };
      const dishes = existing
        ? (place.dishes || []).map((d) => (d.id === id ? dish : d))
        : [...(place.dishes || []), dish];

      store.updateItem(place.id, { dishes });
      dismissLayer();
      refreshDetail(store, container, place.id);
    });

    const del = overlay.querySelector("#dsDelete");
    if (del) del.addEventListener("click", async () => {
      if (!window.confirm(`Remove ${existing.name}?`)) return;
      if (existing.photoRef) await deleteBlob(existing.photoRef);
      store.updateItem(place.id, { dishes: (place.dishes || []).filter((d) => d.id !== existing.id) });
      dismissLayer();
      refreshDetail(store, container, place.id);
    });

    setTimeout(() => overlay.querySelector("#dsName").focus(), 80);
  });
}

// ---------- a visit ----------

function openVisitEditor(place, store, container, existing) {
  openOverlay("cover-picker-backdrop", (overlay) => {
    overlay.innerHTML = `
      <div class="cover-picker">
        <div class="cover-picker-head">
          <h2>${existing ? "Edit visit" : "Another visit"}</h2>
          <button class="lightbox-close" id="vsClose" type="button" aria-label="Close"><span class="btn-icon">${ICONS.close}</span></button>
        </div>

        <div class="field">
          <label for="vsDate">When</label>
          <input type="date" id="vsDate" value="${escapeHtml(existing ? existing.date : today())}">
        </div>

        <p class="cover-picker-label">What it came to <span class="field-hint">optional</span></p>
        <div class="paid-input-row small">
          <span class="paid-currency">$</span>
          <input type="number" step="0.01" inputmode="decimal" id="vsSpent"
                 value="${existing && existing.spent != null ? Number(existing.spent).toFixed(2) : ""}"
                 placeholder="0.00" aria-label="What you spent">
        </div>
        <p class="settings-note">
          Kept well away from your wishlist budget — that pot is for things
          you're saving up for, and dinner has no business coming out of it.
        </p>

        <p class="cover-picker-label">A note <span class="field-hint">optional</span></p>
        <input type="text" id="vsNote" placeholder="Went with Amir, queued 20 minutes"
               value="${escapeHtml(existing && existing.note ? existing.note : "")}">

        <button class="btn btn-primary block-btn" id="vsSave" type="button">${existing ? "Save" : "Add"}</button>
        ${existing ? `<button class="btn btn-secondary danger-btn block-btn" id="vsDelete" type="button">Remove this visit</button>` : ""}
      </div>
    `;

    overlay.addEventListener("click", (e) => { if (e.target === overlay) dismissLayer(); });
    overlay.querySelector("#vsClose").addEventListener("click", () => dismissLayer());

    overlay.querySelector("#vsSave").addEventListener("click", () => {
      const dateInput = overlay.querySelector("#vsDate");
      const date = dateInput.value;
      if (!date) return nudge(dateInput);

      const visit = {
        id: existing ? existing.id : uid(),
        date,
        spent: parseAmount(overlay.querySelector("#vsSpent").value),
        note: overlay.querySelector("#vsNote").value.trim() || null,
      };
      const visits = existing
        ? (place.visits || []).map((v) => (v.id === visit.id ? visit : v))
        : [...(place.visits || []), visit];

      // Recording a visit to somewhere you'd only meant to try means you went.
      store.updateItem(place.id, { visits, wantToTry: false });
      dismissLayer();
      refreshDetail(store, container, place.id);
    });

    const del = overlay.querySelector("#vsDelete");
    if (del) del.addEventListener("click", () => {
      store.updateItem(place.id, { visits: (place.visits || []).filter((v) => v.id !== existing.id) });
      dismissLayer();
      refreshDetail(store, container, place.id);
    });
  });
}

// ---------- writing ----------

/**
 * The review sheet.
 *
 * The prompts are the whole point. A textarea and a Save button gets you an
 * empty textarea; a question you can answer in a sentence gets you a sentence.
 * Tapping one appends it as a line you write under, and you can ignore the
 * rest — nothing here has to be filled in.
 */
function openWriteSheet({ title, text, prompts, onSave }) {
  openOverlay("cover-picker-backdrop", (overlay) => {
    overlay.innerHTML = `
      <div class="cover-picker">
        <div class="cover-picker-head">
          <h2>${escapeHtml(title)}</h2>
          <button class="lightbox-close" id="wrClose" type="button" aria-label="Close"><span class="btn-icon">${ICONS.close}</span></button>
        </div>

        <p class="cover-picker-label">Something to answer <span class="field-hint">tap one, or don't</span></p>
        <div class="tag-row" id="wrPrompts">
          ${prompts.map((p) => `<button type="button" class="tag-chip" data-prompt="${escapeHtml(p)}">${escapeHtml(p)}</button>`).join("")}
        </div>

        <div class="field">
          <textarea id="wrText" rows="7" placeholder="Whatever you'd want to remember.">${escapeHtml(text || "")}</textarea>
        </div>

        <button class="btn btn-primary block-btn" id="wrSave" type="button">Save</button>
        ${text ? `<button class="link-btn" id="wrClear" type="button">Delete what's here</button>` : ""}
      </div>
    `;

    const area = overlay.querySelector("#wrText");
    overlay.addEventListener("click", (e) => { if (e.target === overlay) dismissLayer(); });
    overlay.querySelector("#wrClose").addEventListener("click", () => dismissLayer());

    overlay.querySelectorAll("#wrPrompts .tag-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const q = chip.dataset.prompt;
        const body = area.value.trim();
        area.value = (body ? `${body}\n\n` : "") + `${q}\n`;
        chip.classList.add("on");
        area.focus();
        area.selectionStart = area.selectionEnd = area.value.length;
      });
    });

    overlay.querySelector("#wrSave").addEventListener("click", () => {
      onSave(area.value.trim());
      dismissLayer();
    });

    const clear = overlay.querySelector("#wrClear");
    if (clear) clear.addEventListener("click", () => {
      onSave("");
      dismissLayer();
    });

    setTimeout(() => area.focus(), 80);
  });
}

// ---------- sharing ----------

/**
 * Reuses the item and review card renderers rather than adding food-specific
 * ones: a place has a name, a line underneath, a rating and a photo, which is
 * exactly what those already draw.
 */
function openPlaceShare(place) {
  const best = dishesByBest(place).find((d) => d.rating != null || d.favourite);
  const cards = [
    {
      key: "place",
      label: "The place",
      sub: best ? `Best: ${best.name}` : KIND_LABELS[place.kind] || "",
      type: "item",
      data: {
        item: {
          title: place.title,
          creator: [KIND_LABELS[place.kind], place.area].filter(Boolean).join(" · "),
          rating: place.rating,
        },
        coverSrc: place.coverRef || null,
        kindLabel: place.wantToTry ? "Want to try" : "Been",
      },
    },
  ];

  if (place.review) {
    cards.push({
      key: "review",
      label: "What you wrote",
      sub: `${place.review.split(/\s+/).length} words`,
      type: "review",
      data: {
        item: {
          title: place.title,
          creator: [KIND_LABELS[place.kind], place.area].filter(Boolean).join(" · "),
          rating: place.rating,
          review: place.review,
        },
        coverSrc: place.coverRef || null,
        kindLabel: "Food",
      },
    });
  }

  openShareSheet(cards, { filename: "stackt-food" });
}

function openShelfShare(store) {
  const places = placesOf(store).filter((p) => (favesOnly ? p.favourite : !p.wantToTry));
  if (!places.length) return;
  const list = sorter.sort(places);
  const subtitleFor = (l) =>
    `${l.length} place${l.length === 1 ? "" : "s"}${favesOnly ? " I'd go back to" : ""}`;

  openShareSheet(
    [{
      key: "grid",
      label: "Where I've eaten",
      sub: "A wall of plates",
      type: "grid",
      pickable: true,
      data: {
        items: list,
        coverSrcs: list.map((p) => p.coverRef || null),
        srcFor: (p) => p.coverRef || null,
        title: favesOnly ? "Places I'd go back to" : "Where I've eaten",
        subtitleFor,
        subtitle: subtitleFor(list),
      },
    }],
    { filename: "stackt-food" }
  );
}

export default { render, openAddForm, openShelfShare };
