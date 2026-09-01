// ============================================
// Books module — to-read / reading / read, grouped by author or searched,
// with a Book -> Copies model, real covers, price-check links, and a
// barcode scanner with a view/edit split on the detail screen.
// ============================================

import { openModal, updateModal, closeModal, dismissLayer, openOverlay, escapeHtml, makeClearable, debounce, wireDateField, isModalOpen } from "./ui.js";
import { confettiBurst, bounceTap, nudge } from "./animations.js";
import { uid, router } from "./core.js";
import { askWhatYouPaid } from "./purchase.js";
import { isScanSupported, startScanner, lookupIsbn, lookupGoogleBooksPrice, coverUrl, coverIdUrl, findCoverOptions } from "./barcode.js";
import { ICONS } from "./icons.js";
import { createSorter, collator, yearValue, titleSortKey, workKey, openSortSheet } from "./sorting.js";
import { starsHtml, wireStars, paintStars, formatRating, normaliseRating } from "./stars.js";
import { openShareSheet } from "./share.js";
import { setCoverSrc, ownKey, putBlob, encodeCover, deleteBlob } from "./covers.js";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "to-read", label: "To Read" },
  { key: "reading", label: "Reading" },
  { key: "read", label: "Read" },
  { key: "lent-out", label: "Lent Out" },
];

const STATUS_LABELS = { "to-read": "To Read", reading: "Reading", read: "Read" };

let activeFilter = "all";
let shelf = "library";     // 'library' | 'wishlist' | 'borrowed'
let groupByAuthor = false; // a way of viewing a shelf, not a shelf itself
let authorFilter = null;
let searchQuery = "";
let ratingFilter = null;
// Favourites cuts ACROSS shelves — a book is in your library AND hearted — so
// it's a view flag rather than a fourth value of `shelf`.
let favesOnly = false;  // 5, 4.5, 4 … or null for any

function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Dates are stored as YYYY-MM-DD (sortable, unambiguous) but always shown
 *  as DD/MM/YYYY. Note the tap-to-pick calendar itself is drawn by iOS and
 *  follows the phone's region setting — a web page can't override that. */
function fmtDate(iso) {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}
function loanedCopies(book) {
  return (book.copies || []).filter((c) => c.currentLoan);
}
function hasLoan(book) {
  return loanedCopies(book).length > 0;
}
function isOwned(book) {
  return (book.copies || []).length > 0;
}

/**
 * Which shelf a book stands on, inferred rather than stored — so nothing in
 * your existing data needs migrating.
 *   owns a copy            -> library   (even if you once borrowed it)
 *   has a borrow record    -> borrowed
 *   neither                -> wishlist
 */
function shelfOf(book) {
  if (isOwned(book)) return "library";
  if (book.borrowed) return "borrowed";
  return "wishlist";
}
function borrowedBooks(store) {
  return store.itemsByType("book").filter((b) => shelfOf(b) === "borrowed");
}
/** Borrowed books still physically with you (not yet given back). */
function stillHolding(book) {
  return !!(book.borrowed && !book.borrowed.returnedDate);
}

/** Whole days between two YYYY-MM-DD strings, counting both ends
 *  (finishing the same day you started reads as "1 day", not "0"). */
/**
 * ELAPSED days between two dates — not calendar days touched.
 *
 * This used to add one, so a book started yesterday and finished today read as
 * "took 2 days". Counting the span rather than the days it spanned is what
 * people mean, so a same-day read is 0 and the label says "same day".
 * Math.round absorbs DST, where a day is 23 or 25 hours.
 */
function daysBetween(startStr, endStr) {
  if (!startStr || !endStr) return null;
  const a = new Date(startStr + "T00:00:00");
  const b = new Date(endStr + "T00:00:00");
  if (isNaN(a) || isNaN(b)) return null;
  const diff = Math.round((b - a) / 86400000);
  return diff < 0 ? null : diff;
}

function daysLabel(n) {
  if (n == null) return "";
  if (n === 0) return "same day";
  return n === 1 ? "1 day" : `${n} days`;
}

/** How a reading span should read in the UI, given whatever dates exist. */
function readingSpanText(book) {
  const { startedDate, finishedDate } = book;
  if (startedDate && finishedDate) {
    return `${fmtDate(startedDate)} → ${fmtDate(finishedDate)} · took ${daysLabel(daysBetween(startedDate, finishedDate))}`;
  }
  if (startedDate) {
    const running = daysBetween(startedDate, today());
    return `Started ${fmtDate(startedDate)}${running ? ` · ${daysLabel(running)} so far` : ""}`;
  }
  if (finishedDate) return `Finished ${fmtDate(finishedDate)}`;
  return null;
}

/** Books you actually own — one or more physical copies. */
function ownedBooks(store) {
  return store.itemsByType("book").filter(isOwned);
}
/** Books you want but don't have yet — no copies, no borrow record. */
function wishlistBooks(store) {
  return store.itemsByType("book").filter((b) => shelfOf(b) === "wishlist");
}

/** Search matches the title, the sorting name AND the original-script name —
 *  so typing either 村上春樹 or Murakami finds the same books. */
function matchesQuery(book, q) {
  return (
    String(book.title || "").toLowerCase().includes(q) ||
    String(book.creator || "").toLowerCase().includes(q) ||
    String(book.creatorAlt || "").toLowerCase().includes(q)
  );
}

function getBooks(store) {
  // Favourites deliberately ignores the shelf tabs: a hearted wishlist book is
  // still a favourite, and hiding it behind "which shelf" would defeat the point.
  let books = favesOnly
    ? store.itemsByType("book").filter((b) => b.favourite)
    : shelf === "wishlist" ? wishlistBooks(store)
    : shelf === "borrowed" ? borrowedBooks(store)
    : ownedBooks(store);
  if (authorFilter) books = books.filter((b) => (b.creator || "Unknown") === authorFilter);
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    books = books.filter(
      (b) => matchesQuery(b, q)
    );
  }
  if (activeFilter !== "all") {
    books = activeFilter === "lent-out"
      ? books.filter(hasLoan)
      : books.filter((b) => b.readingStatus === activeFilter);
  }
  if (ratingFilter != null) {
    books = books.filter((b) => normaliseRating(b.rating) === ratingFilter);
  }
  return sortBooks(books);
}

// ---------- sorting ----------

const SORT_CRITERIA = [
  { key: "title", label: "Title", asc: "A–Z", desc: "Z–A", note: "Default" },
  {
    key: "author", label: "Author", asc: "A–Z", desc: "Z–A",
    value: (b) => b.creator || null,
    compare: (x, y) => collator.compare(x, y),
  },
  {
    key: "added", label: "Date added", asc: "newest first", desc: "oldest first",
    value: (b) => b.addedDate || null,
    compare: (x, y) => (x < y ? 1 : x > y ? -1 : 0), // newest first by default
    describe: (b) => (b.addedDate ? `Added ${fmtDate(b.addedDate)}` : ""),
  },
  {
    key: "year", label: "Year published", asc: "oldest first", desc: "newest first",
    value: yearValue,
    compare: (x, y) => x - y,
    describe: (b) => (b.year ? `Published ${b.year}` : ""),
  },
  {
    key: "longest", label: "Time to read", asc: "longest first", desc: "quickest first",
    value: readingDays,
    compare: (x, y) => y - x,
    describe: (b) => {
      const d = readingDays(b);
      return d == null ? "" : `Took ${daysLabel(d)}`;
    },
  },
  {
    key: "favourite", label: "Favourites", asc: "hearted first", desc: "hearted last",
    value: (b) => (b.favourite ? 1 : null),  // null = not hearted, so it sinks
    compare: () => 0,                          // all favourites are equal; title breaks the tie
  },
  {
    key: "rating", label: "Rating", asc: "highest first", desc: "lowest first",
    value: (b) => b.rating || null,
    compare: (x, y) => y - x,
    describe: (b) => (b.rating ? `${b.rating}/5` : ""),
  },
];

const sorter = createSorter(SORT_CRITERIA, "title");

function readingDays(book) {
  return daysBetween(book.startedDate, book.finishedDate);
}

function sortBooks(list) {
  return sorter.sort(list);
}

// ---------- edition grouping ----------

/**
 * Two rows are the same WORK when title and author match after case,
 * punctuation, accents and a leading article are stripped.
 *
 * This is presentation only — the books themselves are untouched, so each
 * edition keeps its own cover, ISBN, reading status, copies and loans, and
 * every count in the app still counts editions individually.
 */


/** [{ lead, editions }] — order preserved, so whatever sort ran still holds. */
function groupEditions(list) {
  const groups = new Map();
  list.forEach((book) => {
    const key = workKey(book);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(book);
  });
  return [...groups.values()].map((editions) => ({ lead: editions[0], editions }));
}

// ---------- share ----------

/** Which cards make sense for THIS book. A book with no review shouldn't be
 *  offered a review card that renders an empty quote. */
function shareCardsForBook(book) {
  const cards = [
    {
      key: "item", label: "This book", sub: "Cover, rating, dates",
      type: "item",
      data: { item: book, coverSrc: bookCoverSrc(book, "L"), kindLabel: shelfLabel(book) },
    },
  ];
  if (book.review && book.review.trim()) {
    cards.push({
      key: "review", label: "My review", sub: "What you wrote",
      type: "review",
      data: { item: book, coverSrc: bookCoverSrc(book, "L") },
    });
  }
  return cards;
}

function shelfLabel(book) {
  const kind = shelfOf(book);
  if (kind === "wishlist") return "On my wishlist";
  if (kind === "borrowed") return stillHolding(book) ? "Borrowed" : "Returned";
  return STATUS_LABELS[book.readingStatus] || "In my library";
}

/**
 * Sets the view flags directly. Exists for the tests: several headline
 * combinations (a rating filter inside the wishlist, for one) have no UI path
 * to them, and a heading only checked where you can click to it is a heading
 * that goes wrong everywhere else. Nothing in the app calls this.
 */
export function __setViewState(patch = {}) {
  if ("shelf" in patch) shelf = patch.shelf;
  if ("favesOnly" in patch) favesOnly = patch.favesOnly;
  if ("authorFilter" in patch) authorFilter = patch.authorFilter;
  if ("activeFilter" in patch) activeFilter = patch.activeFilter;
  if ("searchQuery" in patch) searchQuery = patch.searchQuery;
  if ("ratingFilter" in patch) ratingFilter = patch.ratingFilter;
}

/**
 * What the card calls itself.
 *
 * The heading has to follow the screen, or it lies: sharing from Favourites
 * and getting "My bookshelf" was the version of this that shipped, and a card
 * of six Murakami novels announcing itself as the whole shelf is the same
 * mistake with a different filter.
 *
 * Two parts. WHERE you are — a shelf, or favourites, which cut across shelves
 * — gives the base. Then the strongest thing you've narrowed by (a search you
 * typed beats an author you tapped beats a rating beats a status chip) is
 * phrased against that base, so "5★" reads correctly whether you're in the
 * library or the wishlist. Only one qualifier is used: two would make it a
 * sentence, and this is a headline.
 */
export function shelfShareTitle() {
  const where = favesOnly ? "faves" : shelf;
  const BASE = {
    faves: "My favourites",
    library: "My bookshelf",
    wishlist: "My wishlist",
    borrowed: "Books I've borrowed",
  };

  const q = searchQuery.trim();
  if (q) {
    const IN = {
      faves: "in my favourites",
      library: "on my shelf",
      wishlist: "on my wishlist",
      borrowed: "among my borrowed",
    };
    return `“${q}” ${IN[where]}`;
  }

  if (authorFilter) {
    return {
      faves: `My favourite ${authorFilter}`,
      library: `${authorFilter}, on my shelf`,
      wishlist: `${authorFilter}, on my wishlist`,
      borrowed: `${authorFilter}, borrowed`,
    }[where];
  }

  if (ratingFilter != null) {
    const stars = `${formatRating(ratingFilter)}★`;
    return {
      faves: `My ${stars} favourites`,
      library: `My ${stars} books`,
      wishlist: `${stars} on my wishlist`,
      borrowed: `${stars}, borrowed`,
    }[where];
  }

  if (activeFilter !== "all") {
    const PLAIN = {
      "to-read": "Next on my shelf",
      reading: "What I'm reading",
      read: "Books I've read",
      "lent-out": "Books I've lent out",
    };
    const FAVE = {
      "to-read": "Favourites I've yet to read",
      reading: "Favourites I'm reading now",
      read: "Favourites I've read",
      "lent-out": "Favourites I've lent out",
    };
    if (where === "library" && PLAIN[activeFilter]) return PLAIN[activeFilter];
    if (where === "faves" && FAVE[activeFilter]) return FAVE[activeFilter];
    const chip = FILTERS.find((f) => f.key === activeFilter);
    if (chip) return `${BASE[where]} · ${chip.label}`;
  }

  return BASE[where];
}

/** Collection-wide cards, built from whatever shelf you're looking at. */
function shareCardsForShelf(store) {
  const list = getBooks(store);
  const all = store.itemsByType("book");
  const owned = all.filter(isOwned);
  const read = owned.filter((b) => b.readingStatus === "read");
  const rated = owned.filter((b) => b.rating);

  const longest = read
    .map((b) => ({ b, d: readingDays(b) }))
    .filter((x) => x.d != null)
    .sort((x, y) => y.d - x.d)[0];

  const authorCounts = {};
  owned.forEach((b) => {
    const n = b.creator || "Unknown";
    authorCounts[n] = (authorCounts[n] || 0) + 1;
  });
  const topAuthor = Object.keys(authorCounts).sort((a, b) => authorCounts[b] - authorCounts[a])[0];

  // Every stat the data can support. Only ones with something to say are
  // offered — a "longest read" row is noise if nothing has both dates.
  const thisYear = String(new Date().getFullYear());
  const readThisYear = read.filter((b) => (b.finishedDate || "").startsWith(thisYear));
  const quickest = read
    .map((b) => ({ b, d: readingDays(b) }))
    .filter((x) => x.d != null)
    .sort((x, y) => x.d - y.d)[0];
  const fiveStars = owned.filter((b) => b.rating === 5).length;
  const favourites = all.filter((b) => b.favourite).length;
  const distinctAuthors = new Set(owned.map((b) => b.creator || "Unknown")).size;
  const wishlist = all.filter((b) => shelfOf(b) === "wishlist").length;
  const lentOut = owned.filter(hasLoan).length;
  const totalCopies = owned.reduce((n, b) => n + (b.copies || []).length, 0);
  const years = owned.map((b) => parseInt(b.year, 10)).filter(Number.isFinite);

  const maybe = (cond, stat) => (cond ? [stat] : []);
  const stats = [
    // the basics
    { key: "owned", value: owned.length, label: "books owned" },
    { key: "read", value: read.length, label: "books read" },
    ...maybe(wishlist, { key: "wishlist", value: wishlist, label: "on the wishlist" }),
    ...maybe(rated.length, {
      key: "avg",
      value: (rated.reduce((n, b) => n + b.rating, 0) / rated.length).toFixed(1),
      label: "average rating",
    }),
    // reading milestones
    ...maybe(readThisYear.length, { key: "year", value: readThisYear.length, label: `books read in ${thisYear}` }),
    ...maybe(longest, { key: "longest", value: `${longest && longest.d}d`, label: `longest read · ${longest && longest.b.title}` }),
    ...maybe(quickest, { key: "quickest", value: `${quickest && quickest.d}d`, label: `quickest read · ${quickest && quickest.b.title}` }),
    // people and taste
    ...maybe(topAuthor, { key: "topAuthor", value: authorCounts[topAuthor], label: `by ${topAuthor}` }),
    ...maybe(distinctAuthors > 1, { key: "authors", value: distinctAuthors, label: "different authors" }),
    ...maybe(fiveStars, { key: "fivestar", value: fiveStars, label: "five-star books" }),
    ...maybe(favourites, { key: "faves", value: favourites, label: "favourites" }),
    // collection facts
    ...maybe(years.length, { key: "oldest", value: Math.min(...years), label: "oldest book" }),
    ...maybe(totalCopies > owned.length, { key: "copies", value: totalCopies, label: "physical copies" }),
    ...maybe(lentOut, { key: "lent", value: lentOut, label: "out on loan" }),
  ];

  const shareTitle = shelfShareTitle();

  /**
   * Describes the SELECTION, not the library.
   *
   * "12 read" belongs on a card showing your whole shelf and nowhere else — on
   * four hand-picked books it's a non-sequitur, which is exactly how it read.
   * So the read count only appears when the card really is everything.
   */
  const shareSubtitleFor = (picked) => {
    const n = picked.length;
    const noun = favesOnly
      ? `${n} favourite${n === 1 ? "" : "s"}`
      : `${n} book${n === 1 ? "" : "s"}`;
    if (ratingFilter != null) return `${noun}, all ${formatRating(ratingFilter)}★`;
    if (authorFilter || favesOnly) return noun;
    // "12 read" is only true of the whole shelf. Any narrowing at all — a
    // status chip, a search — and it stops describing what's on the card.
    const whole =
      n === list.length &&
      shelf === "library" &&
      activeFilter === "all" &&
      !searchQuery.trim() &&
      n === owned.length;
    if (whole && read.length) return `${noun} · ${read.length} read`;
    return noun;
  };

  return [
    {
      key: "grid", label: "My shelf", sub: "A wall of covers",
      type: "grid",
      pickable: true,
      data: {
        items: list,
        // "L" is what the list cards already requested, so these come out of
        // cache instead of costing another rate-limited fetch each.
        coverSrcs: list.map((b) => bookCoverSrc(b, "L")),
        srcFor: (b) => bookCoverSrc(b, "L"),
        title: shareTitle,
        subtitleFor: shareSubtitleFor,
        subtitle: shareSubtitleFor(list),
      },
    },
    {
      key: "stats", label: "My numbers", sub: "No covers, just stats",
      type: "stats",
      data: { title: "My reading", stats },
    },
  ];
}

// ---------- main render ----------

/** `opts` is only passed by the router, so its presence means "the module was
 *  just opened from the menu" rather than an internal redraw. Entering always
 *  starts alphabetical, as asked. */
function render(container, store, opts) {
  if (opts !== undefined) {
    sorter.reset();
    ratingFilter = null;
    favesOnly = false;
  }

  const wrap = document.createElement("div");

  const title = document.createElement("p");
  title.className = "view-title";
  // The tab says where you are; the heading says what you're looking at.
  const SHELF_TABS = { library: "Library", wishlist: "Wishlist", borrowed: "Borrowed" };
  const SHELF_TITLES = { library: "Books", wishlist: "Wishlist", borrowed: "Borrowed" };
  title.textContent = favesOnly
    ? "Favourites"
    : authorFilter ? `Books by ${authorFilter}` : SHELF_TITLES[shelf];
  wrap.appendChild(title);

  if (authorFilter) {
    const back = document.createElement("button");
    back.className = "back-chip";
    back.textContent = "← All Authors";
    back.addEventListener("click", () => {
      authorFilter = null;
      render(container, store);
    });
    wrap.appendChild(back);
  }

  const searchRow = document.createElement("div");
  searchRow.className = "search-row";
  searchRow.innerHTML = `
    <input type="text" class="search-input" id="searchInput" placeholder="Search title or author..." value="${escapeHtml(searchQuery)}">
    <button class="icon-btn ${sorter.isDefault && ratingFilter == null ? "" : "on"}" id="sortBtn" type="button" aria-label="Sort">${ICONS.sort}</button>
    <button class="icon-btn ${groupByAuthor ? "on" : ""}" id="authorBtn" type="button" aria-label="Group by author" aria-pressed="${groupByAuthor}">${ICONS.author}</button>
    <button class="scan-btn" id="scanBtn" type="button" aria-label="Scan barcode">${ICONS.camera}</button>
  `;
  wrap.appendChild(searchRow);

  // Only worth naming the order when it isn't the default one.
  if ((!sorter.isDefault || ratingFilter != null) && !groupByAuthor) {
    const note = document.createElement("p");
    note.className = "sort-note";
    note.textContent =
      (ratingFilter != null ? `${formatRating(ratingFilter)}★ only · ` : "") +
      `Sorted by ${sorter.label()}`;
    wrap.appendChild(note);
  }

  if (!authorFilter) {
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

  wrap.querySelector("#authorBtn").addEventListener("click", (e) => {
    bounceTap(e.currentTarget);
    groupByAuthor = !groupByAuthor;
    authorFilter = null;
    render(container, store);
  });

  wrap.querySelector("#sortBtn").addEventListener("click", (e) => {
    bounceTap(e.currentTarget);
    openBookSortSheet(store, container);
  });


  if (!authorFilter) {
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
        activeFilter = "all"; // don't carry a hidden status filter across shelves
        render(container, store);
      });
    });
  }

  renderBody(bodyHolder, store, container);
}

/** Sort picker. A sheet rather than more chips in the header — it's a choice
 *  you make occasionally, and the header already carries three controls. */
function openBookSortSheet(store, container) {
  const pool = ownedBooks(store);
  openSortSheet(
    sorter,
    () => render(container, store),
    "Books with nothing to sort on — no year, never finished, unrated — go to the end either way.",
    {
      value: ratingFilter,
      countFor: (v) => pool.filter((b) => normaliseRating(b.rating) === v).length,
      onChange: (v) => { ratingFilter = v; },
    }
  );
}

function renderBody(bodyHolder, store, container) {
  bodyHolder.innerHTML = "";

  // "By Author" groups whichever shelf you're on, rather than being a shelf.
  if (groupByAuthor && !authorFilter) {
    renderAuthorList(bodyHolder, store, container);
    return;
  }

  // Those two are shelf-specific screens; favourites spans all of them, so it
  // uses the ordinary grid instead.
  if (shelf === "wishlist" && !authorFilter && !favesOnly) {
    renderWishlist(bodyHolder, store, container);
    return;
  }

  if (shelf === "borrowed" && !authorFilter && !favesOnly) {
    renderBorrowed(bodyHolder, store, container);
    return;
  }

  if (!favesOnly) renderFilterRow(bodyHolder, store, container);

  const listHolder = document.createElement("div");
  bodyHolder.appendChild(listHolder);
  renderBookGrid(listHolder, getBooks(store), (book) => openDetail(book, store, container));
}

/**
 * Status filter row. Deliberately lighter than the shelf tabs above it — those
 * are navigation you use constantly, these are a filter you set occasionally,
 * and drawing both at full weight is what made the screen feel cluttered.
 * Filters with nothing behind them aren't rendered at all, so the row shrinks
 * itself and never offers a tap that leads to an empty list.
 */
function renderFilterRow(bodyHolder, store, container) {
  const pool = ownedBooks(store);
  const countFor = (key) => {
    if (key === "all") return pool.length;
    if (key === "lent-out") return pool.filter(hasLoan).length;
    return pool.filter((b) => b.readingStatus === key).length;
  };

  const live = FILTERS.filter((f) => f.key === "all" || countFor(f.key) > 0);
  if (live.length <= 1) return; // nothing worth filtering

  const filterRow = document.createElement("div");
  filterRow.className = "filter-row";

  live.forEach((f) => {
    // Lent Out describes where the object is, not how far through it you are —
    // a divider keeps the three reading states reading as one group.
    if (f.key === "lent-out") {
      const sep = document.createElement("span");
      sep.className = "filter-sep";
      filterRow.appendChild(sep);
    }
    const chip = document.createElement("button");
    chip.className = "filter-chip" + (activeFilter === f.key ? " active" : "");
    chip.type = "button";
    chip.innerHTML = `${f.label}<span class="chip-count">${countFor(f.key)}</span>`;
    chip.addEventListener("click", () => {
      activeFilter = f.key;
      renderBody(bodyHolder, store, container);
    });
    filterRow.appendChild(chip);
  });

  bodyHolder.appendChild(filterRow);
}

/** Borrowed shelf — the mirror of lending. Split by whether you still have it. */
function renderBorrowed(bodyHolder, store, container) {
  let books = borrowedBooks(store);
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    books = books.filter(
      (b) => matchesQuery(b, q)
    );
  }

  if (books.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `<div class="empty-state-icon">${ICONS.lend}</div><p>No borrowed books yet — add one and pick "Borrowed"</p>`;
    bodyHolder.appendChild(empty);
    return;
  }

  books = sortBooks(books);
  const holding = books.filter(stillHolding);
  const given = books.filter((b) => !stillHolding(b));

  const section = (label, list) => {
    if (!list.length) return;
    const h = document.createElement("p");
    h.className = "shelf-section-title";
    h.textContent = `${label} (${list.length})`;
    bodyHolder.appendChild(h);
    bodyHolder.appendChild(
      buildGroupedGrid(list, (x) => openDetail(x, store, container))
    );
  };

  section("Still have it", holding);
  section("Given back", given);
}

/** Wishlist gets its own screen: no reading-status chips (you haven't got it
 *  yet), and price is the thing worth surfacing. */
function renderWishlist(bodyHolder, store, container) {
  let books = wishlistBooks(store);
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    books = books.filter(
      (b) => matchesQuery(b, q)
    );
  }

  if (books.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `<div class="empty-state-icon">${ICONS.empty}</div><p>Nothing on the wishlist yet — add a book and pick "Wishlist"</p>`;
    bodyHolder.appendChild(empty);
    return;
  }

  books = sortBooks(books);

  const priced = books.filter((b) => b.price != null);
  if (priced.length) {
    const total = priced.reduce((sum, b) => sum + Number(b.price), 0);
    const summary = document.createElement("p");
    summary.className = "wishlist-total";
    summary.textContent =
      `${books.length} book${books.length === 1 ? "" : "s"} · $${total.toFixed(2)} for the ${priced.length} you've priced`;
    bodyHolder.appendChild(summary);
  }

  bodyHolder.appendChild(
    buildGroupedGrid(books, (b) => openDetail(b, store, container))
  );
}

function renderAuthorList(bodyHolder, store, container) {
  // Deliberately NOT getBooks(): the reading-status chips aren't on screen here,
  // so letting them filter this list meant invisible state silently dropping
  // authors. Groups whichever shelf you're currently on.
  let books =
    shelf === "wishlist" ? wishlistBooks(store)
    : shelf === "borrowed" ? borrowedBooks(store)
    : ownedBooks(store);
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    books = books.filter(
      (b) => matchesQuery(b, q)
    );
  }
  const counts = {};
  books.forEach((b) => {
    const name = b.creator || "Unknown";
    counts[name] = (counts[name] || 0) + 1;
  });
  // Most-read/most-owned authors first — fully automatic, no pinning needed.
  const authors = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));

  if (authors.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `<div class="empty-state-icon">${ICONS.author}</div><p>No authors yet</p>`;
    bodyHolder.appendChild(empty);
    return;
  }

  const grid = document.createElement("div");
  grid.className = "author-grid";
  authors.forEach((name) => {
    const btn = document.createElement("button");
    btn.className = "author-btn";
    btn.type = "button";
    btn.innerHTML = `<span>${escapeHtml(name)}</span><span class="author-count">${counts[name]}</span>`;
    btn.addEventListener("click", () => {
      bounceTap(btn);
      authorFilter = name;
      sorter.reset(); // drilling into an author starts alphabetical too
      render(container, store);
    });
    // Long-press to rename: this list is where a wrong spelling is obvious,
    // and it's the only place you can see every book it affects at once.
    let held = null;
    const startHold = () => {
      held = setTimeout(() => {
        held = null;
        openAuthorRename(store, container, name, counts[name]);
      }, 550);
    };
    const cancelHold = () => { if (held) clearTimeout(held); held = null; };
    btn.addEventListener("pointerdown", startHold);
    ["pointerup", "pointerleave", "pointercancel"].forEach((e) =>
      btn.addEventListener(e, cancelHold)
    );
    grid.appendChild(btn);
  });
  bodyHolder.appendChild(grid);
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

// ---------- cards ----------

/** Rename an author across every book of theirs, in one go. */
function openAuthorRename(store, container, name, count) {
  openModal((sheet) => {
    sheet.innerHTML = `
      <h2>Rename author</h2>
      <p class="field-hint" style="margin:-6px 0 16px;">
        Changes the name on ${count} book${count === 1 ? "" : "s"}. Handy when a
        lookup catalogued it in a different script from the one you read in.
      </p>
      <div class="field">
        <label>Name</label>
        <input type="text" id="renameTo" value="${escapeHtml(name)}">
        <p class="field-hint">This is what the list sorts and groups by.</p>
      </div>
      <div class="field">
        <label>Original script (optional)</label>
        <input type="text" id="renameAlt" placeholder="村上春樹">
        <p class="field-hint">Kept on every one of their books and matched by search.</p>
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" id="renameGo" type="button">Rename ${count} book${count === 1 ? "" : "s"}</button>
      </div>
    `;
    const input = sheet.querySelector("#renameTo");
    const alt = sheet.querySelector("#renameAlt");
    makeClearable(input);
    makeClearable(alt);

    sheet.querySelector("#renameGo").addEventListener("click", () => {
      const to = input.value.trim();
      if (!to) return nudge(input);
      renameAuthorEverywhere(store, name, to, alt.value.trim() || undefined);
      if (authorFilter === name) authorFilter = to;
      dismissLayer();
      render(container, store);
    });
  });
}

function renderBookGrid(container, books, onTap) {
  if (books.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `<div class="empty-state-icon">${ICONS.empty}</div><p>No books match — tap the camera or + to add one</p>`;
    container.appendChild(empty);
    return;
  }
  container.appendChild(buildGroupedGrid(books, onTap));
}

/** Same list, with editions of one work collapsed into a single row. */
function buildGroupedGrid(books, onTap) {
  const grid = document.createElement("div");
  grid.className = "card-grid";
  groupEditions(books).forEach(({ lead, editions }) => {
    const tap =
      editions.length > 1
        ? () => openEditionChooser(editions, onTap)
        : onTap;
    grid.appendChild(buildBookCard(lead, tap, editions));
  });
  return grid;
}

/**
 * Which printing did you mean? Only ever shown for a row that collapsed more
 * than one edition — a single book still opens straight into its detail.
 */
function openEditionChooser(editions, onPick) {
  openModal((sheet) => {
    const work = editions[0];
    sheet.innerHTML = `
      <h2>${escapeHtml(work.title)}</h2>
      <p class="field-hint" style="margin:-6px 0 16px;">
        You have ${editions.length} editions of this. Which one?
      </p>
      <div class="edition-list">
        ${editions.map((b, i) => {
          const bits = [
            b.year ? `Published ${escapeHtml(b.year)}` : "",
            b.isbn ? `ISBN ${escapeHtml(b.isbn)}` : "",
            (b.copies || []).length > 1 ? `${b.copies.length} copies` : "",
            STATUS_LABELS[b.readingStatus] || "",
          ].filter(Boolean).join(" · ");
          return `
            <button type="button" class="edition-row" data-idx="${i}">
              <span class="edition-swatch" style="background:${b.color || "#eee"}">
                <span class="swatch-emoji">${ICONS.books}</span>
                ${hasCover(b) ? `<img class="swatch-img" alt="" data-src="${escapeHtml(bookCoverSrc(b, "M") || "")}">` : ""}
              </span>
              <span class="edition-meta">
                <span class="edition-title">${escapeHtml(b.creator || "Unknown")}</span>
                <span class="edition-sub">${bits || "No edition details"}</span>
              </span>
            </button>
          `;
        }).join("")}
      </div>
    `;

    sheet.querySelectorAll(".edition-row").forEach((row) => {
      row.addEventListener("click", () => {
        // Straight handoff — openModal swaps this sheet's content in place.
        // Dismissing first would pop the layer out from under the detail sheet
        // that's about to open, which is the bug that ate the lend sheet once.
        onPick(editions[Number(row.dataset.idx)]);
      });
    });

    // Same load-then-swap the cards use, so a dead cover leaves the icon.
    sheet.querySelectorAll(".swatch-img[data-src]").forEach((el) => {
      const src = el.dataset.src;
      if (!src) return;
      const probe = corsImage();
      probe.onload = () => {
        el.src = src;
        el.classList.add("loaded");
        const emoji = el.parentElement.querySelector(".swatch-emoji");
        if (emoji) emoji.classList.add("hidden");
      };
      setCoverSrc(probe, src);
    });
  });
}

/** `editions` is every book collapsed into this row — usually just [book]. */
function buildBookCard(book, onTap, editions = [book]) {
  const card = document.createElement("div");
  card.className = "item-card";
  const owned = isOwned(book);
  const onLoan = loanedCopies(book);

  const shelfKind = shelfOf(book);
  const pillHtml =
    shelfKind === "library"
      ? `<span class="status-pill status-${book.readingStatus}">${STATUS_LABELS[book.readingStatus] || book.readingStatus}</span>`
      : shelfKind === "borrowed"
        ? `<span class="status-pill status-borrowed">${stillHolding(book) ? "Borrowed" : "Returned"}</span>`
        : `<span class="status-pill status-to-read">Wishlist</span>`;

  // Two different things, deliberately worded differently: EDITIONS are separate
  // printings of the same work collapsed into this row; COPIES are duplicates of
  // one printing sitting on your shelf.
  const editionCount = editions.length;
  const grouped = editionCount > 1;

  let extraHtml = "";
  const sub = sorter.describe(book);
  if (sub) extraHtml += `<div class="lent-note">${escapeHtml(sub)}</div>`;
  if (grouped) {
    const copyTotal = editions.reduce((n, e) => n + (e.copies || []).length, 0);
    extraHtml += `<div class="lent-note">${editionCount} editions${copyTotal > editionCount ? ` · ${copyTotal} copies` : ""}</div>`;
  } else if ((book.copies || []).length > 1) {
    extraHtml += `<div class="lent-note">${book.copies.length} copies</div>`;
  }
  if (onLoan.length > 0) {
    const who = onLoan.length === 1
      ? `lent to ${escapeHtml(onLoan[0].currentLoan.lentTo || "someone")}`
      : `${onLoan.length} copies lent out`;
    extraHtml += `<div class="lent-note">→ ${who}</div>`;
  }
  if (!owned && book.price != null) {
    extraHtml += `<div class="price-tag">$${Number(book.price).toFixed(2)} · wishlist</div>`;
  }
  if (shelfKind === "borrowed" && book.borrowed) {
    const who = escapeHtml(book.borrowed.from || "someone");
    extraHtml += stillHolding(book)
      ? `<div class="lent-note">← from ${who}</div>`
      : `<div class="lent-note">was ${who}'s · returned ${fmtDate(book.borrowed.returnedDate)}</div>`;
  }
  if (book.rating) {
    extraHtml += `<div class="card-stars">${starsHtml(book.rating)}</div>`;
  }

  // Always wrapped: a bare <svg> here has no sizing rule and renders nearly
  // edge-to-edge, so its stroke collides with the swatch border and reads as a
  // doubled outline.
  const swatchInner = hasCover(book)
    ? `<span class="swatch-emoji">${ICONS.books}</span><img class="swatch-img" alt="">`
    : `<span class="swatch-emoji">${ICONS.books}</span>`;

  const faveMark = book.favourite
    ? `<span class="card-fave" aria-label="Favourite">${ICONS.heart}</span>`
    : "";

  card.innerHTML = `
    <div class="item-swatch ${hasCover(book) ? "shimmer" : ""}" style="background:${book.color || "#eee"}">${swatchInner}</div>
    <div class="item-body">
      <p class="item-title">${escapeHtml(book.title)}</p>
      <p class="item-creator">${escapeHtml(book.creator || "")}</p>
      ${pillHtml}
      ${extraHtml}
    </div>
    ${faveMark}
  `;
  card.addEventListener("click", () => {
    bounceTap(card);
    onTap(book);
  });

  if (hasCover(book)) {
    const swatch = card.querySelector(".item-swatch");
    const swatchImg = swatch.querySelector(".swatch-img");
    const swatchEmoji = swatch.querySelector(".swatch-emoji");

    // Pointed straight at the visible <img>, not at an off-screen probe that
    // copies its src across once it loads. The probe was there to avoid a
    // broken-image flash, but the swatch is already transparent until .loaded
    // adds it — so it bought nothing, and it cost everything: setCoverSrc's
    // recovery has to be attached to the element that actually fails, and with
    // a probe in the way the thing on screen had nobody listening to it.
    swatchImg.addEventListener("load", () => {
      swatchImg.classList.add("loaded");
      if (swatchEmoji) swatchEmoji.classList.add("hidden");
      swatch.classList.remove("shimmer");
    });
    swatchImg.addEventListener("error", () => {
      swatch.classList.remove("shimmer");
    });
    // Request Open Library's largest cover size even for the small card thumbnail —
    // a browser shrinking a big image down looks sharp; stretching the "S" size up to
    // fit a retina-density 52px box is what was causing the blurry/soft covers.
    setCoverSrc(swatchImg, bookCoverSrc(book, "L"));
  }

  return card;
}

// ---------- shared cover block (detail view, scan-match, add form) ----------

/**
 * Where a book's cover comes from, in priority order:
 *   1. a photo you added yourself   2. a cover you picked from other editions
 *   3. the ISBN's own cover         4. nothing (fall back to the icon)
 */
export function bookCoverSrc(book, size = "L") {
  if (!book) return null;
  // coverRef is a key into the blob store — your own photo, kept locally.
  // customCover is the old inline form, still honoured for anything a
  // migration couldn't move.
  if (book.coverRef) return book.coverRef;
  if (book.customCover) return book.customCover;
  if (book.coverId) return coverIdUrl(book.coverId, size);
  if (book.isbn) return coverUrl(book.isbn, size);
  return null;
}
function hasCover(book) {
  return !!(book && (book.coverRef || book.customCover || book.coverId || book.isbn));
}

/** Shrinks a picked photo before storing it. Browser storage is ~5MB for the
 *  whole app, and a full-size iPhone photo would eat most of that on its own. */
function downscaleImage(file, maxEdge = 500, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file"));
    reader.onload = () => {
      const img = corsImage();
      img.onerror = () => reject(new Error("That file isn't an image we can read"));
      img.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Cover picker. Opens as its own layer over whatever sheet you came from, so
 * the back gesture closes just the picker. `onPick({customCover, coverId})`.
 */
function openCoverPicker(bookish, onPick) {
  openOverlay("cover-picker-backdrop", (overlay) => {
    overlay.innerHTML = `
      <div class="cover-picker">
        <div class="cover-picker-head">
          <h2>Choose a cover</h2>
          <button class="lightbox-close" id="cpClose" type="button" aria-label="Close"><span class="btn-icon">${ICONS.close}</span></button>
        </div>

        <label class="cover-upload">
          <input type="file" id="cpFile" accept="image/*" hidden>
          <span class="cover-upload-icon">${ICONS.lens}</span>
          <span>
            <strong>Use your own photo</strong>
            <small>Take one now or pick from your library</small>
          </span>
        </label>

        <div class="picker-search">
          <input type="search" id="cpSearch" placeholder="Search covers by title or author"
                 value="${escapeHtml([bookish.title, bookish.creator].filter(Boolean).join(" "))}">
          <button class="btn btn-secondary" id="cpSearchBtn" type="button">Search</button>
        </div>

        <p class="cover-picker-label" id="cpLabel">Other editions</p>
        <div class="cover-options" id="cpOptions"></div>
      </div>
    `;

    overlay.querySelector("#cpClose").addEventListener("click", () => dismissLayer());
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) dismissLayer();
    });

    const fileInput = overlay.querySelector("#cpFile");
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      const label = overlay.querySelector("#cpLabel");
      label.textContent = "Processing your photo…";
      try {
        // Hands back the encoded BLOB, not a data URL. Where it gets filed
        // depends on the caller: an existing book keys it by id, while the add
        // form has to hold it until the book exists and has one.
        const blob = await encodeCover(file);
        onPick({ ownBlob: blob, customCover: null, coverId: null });
        dismissLayer();
      } catch (err) {
        label.textContent = err.message || "Couldn't use that image.";
      }
    });

    const grid = overlay.querySelector("#cpOptions");
    const label = overlay.querySelector("#cpLabel");
    const searchBox = overlay.querySelector("#cpSearch");
    makeClearable(searchBox, () => load(null));
    const searchBtn = overlay.querySelector("#cpSearchBtn");
    let run = 0;

    /** Grey boxes while the search is out, so the sheet has its final shape
     *  immediately instead of jumping when results land. */
    function showSkeletons(n = 8) {
      grid.innerHTML = "";
      for (let i = 0; i < n; i++) {
        const sk = document.createElement("div");
        sk.className = "cover-option skeleton";
        grid.appendChild(sk);
      }
    }

    function load(query) {
      const mine = ++run;

      // The picker is reachable before anything's been typed. Say so, rather
      // than running an empty search and showing a bare "nothing found".
      if (!query && !bookish.title && !bookish.creator) {
        label.textContent = "Other editions";
        grid.innerHTML = `<p class="cover-picker-note">Type a title in the box above to search for covers — or use your own photo.</p>`;
        return;
      }

      label.textContent = "Looking for covers…";
      showSkeletons();
      findCoverOptions(bookish.title, bookish.creator, query ? { free: query } : {}).then((ids) => {
        if (mine !== run) return; // a newer search has already started
        grid.innerHTML = "";
        if (!ids.length) {
          label.textContent = "Other editions";
          grid.innerHTML = `<p class="cover-picker-note">Nothing found — try searching for just the title, or use your own photo.</p>`;
          return;
        }
        label.textContent = query ? `Results for “${query}”` : "Other editions";

        if (bookish.customCover || bookish.coverId) {
          const reset = document.createElement("button");
          reset.type = "button";
          reset.className = "cover-option reset";
          reset.innerHTML = `<span>Use the default</span>`;
          reset.addEventListener("click", () => {
            onPick({ customCover: null, coverId: null });
            dismissLayer();
          });
          grid.appendChild(reset);
        }

        ids.forEach((id) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "cover-option";
          const img = corsImage();
          img.alt = "";
          img.loading = "lazy";
          img.addEventListener("load", () => btn.classList.add("loaded"));
          img.addEventListener("error", () => btn.remove()); // drop dead thumbnails
          setCoverSrc(img, coverIdUrl(id, "M"));
          btn.appendChild(img);
          btn.addEventListener("click", () => {
            onPick({ customCover: null, coverId: id });
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

/**
 * Turns a picker result into a patch, storing any photo in the blob store.
 *
 * Picking anything at all clears the previous photo: one cover per item, and a
 * stale blob nobody references would sit there forever otherwise.
 */
async function applyCoverPick(itemId, pick) {
  const key = ownKey(itemId);
  if (pick.ownBlob) {
    await putBlob(key, pick.ownBlob, { permanent: true });
    return { coverRef: key, customCover: null, coverId: null };
  }
  await deleteBlob(key);
  return { coverRef: null, customCover: null, coverId: pick.coverId ?? null };
}

function coverBlockHtml(book) {
  return `
    <div class="detail-cover-wrap">
      <img class="detail-cover" id="coverImg" alt="">
      <div class="detail-cover-fallback ${hasCover(book) ? "shimmer" : ""}" id="coverFallback" style="background:${book.color || "#eee"}">${ICONS.books}</div>
    </div>
  `;
}
function wireCover(sheet, book) {
  if (!hasCover(book)) return;
  const img = sheet.querySelector("#coverImg");
  const fallback = sheet.querySelector("#coverFallback");
  if (!img || !fallback) return;
  img.addEventListener("load", () => {
    img.classList.add("loaded");
    fallback.classList.add("fade-out");
  });
  img.addEventListener("error", () => {
    fallback.classList.remove("shimmer");
  });
  setCoverSrc(img, bookCoverSrc(book, "L"));
}

// Opens a fullscreen lightbox of the front cover. Open Library (our free
// cover source) only reliably has front covers, so this is front-only —
// the caption says so rather than pretending a back cover exists.
function openCoverLightbox(book) {
  // Registered as a real layer so it owns a history entry — the back gesture
  // pops it like any other screen instead of leaving it stranded on top.
  openOverlay("lightbox-backdrop", (overlay) => {
    overlay.innerHTML = `
      <button class="lightbox-close" type="button" aria-label="Close"><span class="btn-icon">${ICONS.close}</span></button>
      <div class="lightbox-content">
        <div class="lightbox-cover-wrap">
          <img class="lightbox-img" id="lightboxImg" alt="${escapeHtml(book.title)} cover">
          <div class="lightbox-fallback shimmer" id="lightboxFallback" style="background:${book.color || "#eee"}">${ICONS.books}</div>
        </div>
        <p class="lightbox-caption" id="lightboxCaption">Front cover</p>
      </div>
    `;

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) dismissLayer();
    });
    overlay.querySelector(".lightbox-close").addEventListener("click", () => dismissLayer());

    const img = overlay.querySelector("#lightboxImg");
    const fallback = overlay.querySelector("#lightboxFallback");
    const caption = overlay.querySelector("#lightboxCaption");
    img.addEventListener("load", () => {
      img.classList.add("loaded");
      fallback.classList.add("fade-out");
    });
    img.addEventListener("error", () => {
      fallback.classList.remove("shimmer");
      caption.textContent = "No cover image found for this edition";
    });
    setCoverSrc(img, bookCoverSrc(book, "L"));
  });
}

function priceLinksHtml(book) {
  const q = encodeURIComponent(`${book.title} ${book.creator || ""}`.trim());
  const kino = book.isbn
    ? `https://singapore.kinokuniya.com/bw/${encodeURIComponent(book.isbn)}`
    : `https://www.google.com/search?q=site:singapore.kinokuniya.com+${q}`;
  // Blackwell's product URLs are /bookshop/product/{any-slug}/{isbn} — the slug text is
  // cosmetic/SEO-only, the server resolves purely off the trailing ISBN. Confirmed by
  // fetching the pattern with a throwaway slug and a real ISBN and getting the right book back.
  const blackwells = book.isbn
    ? `https://blackwells.co.uk/bookshop/product/book/${encodeURIComponent(book.isbn)}`
    : `https://www.google.com/search?q=site:blackwells.co.uk+${q}`;
  return `
    <div class="price-links">
      <a class="price-link" href="${kino}" target="_blank" rel="noopener">Check Kinokuniya</a>
      <a class="price-link" href="${blackwells}" target="_blank" rel="noopener">Check Blackwell's</a>
    </div>
  `;
}


/**
 * Words you looked up while reading this book.
 *
 * The Words module already records which book each word belongs to; this is
 * that same link read from the other end, so a book becomes a way into its own
 * vocabulary instead of the two sitting side by side and never meeting. Only a
 * few are listed — the sheet is long already, and the rest is one tap away.
 */
function bookWordsHtml(book, store) {
  const words = store.get().items
    .filter((it) => it.type === "word" && it.bookId === book.id)
    .sort((a, b) => String(b.addedDate || "").localeCompare(String(a.addedDate || "")));
  if (!words.length) return "";

  const shown = words.slice(0, 4);
  const firstDef = (w) => {
    const sense = (w.senses || [])[0];
    return (sense && sense.definition) || w.note || "";
  };

  return `
    <div class="book-words">
      <div class="review-head">
        <span class="review-title">Words from this book</span>
        <span class="book-words-count">${words.length}</span>
      </div>
      <div class="book-words-list">
        ${shown
          .map(
            (w) => `
          <div class="book-word">
            <span class="book-word-term">${escapeHtml(w.word)}</span>
            <span class="book-word-def">${escapeHtml(firstDef(w))}</span>
          </div>
        `
          )
          .join("")}
      </div>
      <button class="btn btn-accent block-btn" id="viewAllWordsBtn" type="button">
        <span class="btn-icon">${ICONS.words}</span>
        <span>${words.length > shown.length ? `View all ${words.length} words` : "Open in Words"}</span>
      </button>
    </div>
  `;
}

// ---------- detail modal: view mode + edit mode ----------

function openDetail(book, store, container, opts = {}) {
  openModal((sheet) => paintDetail(sheet, book, store, container, opts));
}

/** Redraws the detail into an already-open sheet. Returns false if none is up. */
function drawDetailInto(book, store, container, opts = {}) {
  return updateModal((sheet) => paintDetail(sheet, book, store, container, opts));
}

function paintDetail(sheet, book, store, container, opts = {}) {
  let mode = opts.mode === "edit" ? "edit" : "view";

  function draw() {
    sheet.innerHTML = mode === "view" ? viewModeHtml(book, opts, store) : editModeHtml(book);

    const editBtn = sheet.querySelector("#toggleEditBtn");
    if (editBtn) {
      editBtn.addEventListener("click", () => {
        mode = mode === "view" ? "edit" : "view";
        draw();
      });
    }

    if (mode === "view") wireViewMode(sheet, book, store, container, opts);
    else wireEditMode(sheet, book, store, container);
  }

  draw();
}

function viewModeHtml(book, opts, store) {
  const copies = book.copies || [];
  const owned = copies.length > 0;

  return `
    ${opts.foundViaScan ? `<div class="found-banner"><span>Already in your library</span></div>` : ""}
    <div class="detail-top-row">
      <h2>${escapeHtml(book.title)}</h2>
      <button class="icon-btn detail-fave ${book.favourite ? "on" : ""}" id="faveBtn" type="button"
              aria-pressed="${!!book.favourite}" aria-label="Favourite">${ICONS.heart}</button>
      <button class="icon-btn detail-share" id="shareItemBtn" type="button" aria-label="Share this book">${ICONS.share}</button>
      <button class="edit-toggle-btn" id="toggleEditBtn" type="button"><span class="btn-icon">${ICONS.edit}</span>Edit</button>
    </div>
    ${hasCover(book) ? `
      <div class="cover-tap-target" id="coverTapTarget">
        ${coverBlockHtml(book)}
        <span class="cover-zoom-badge">${ICONS.zoom}</span>
      </div>
    ` : coverBlockHtml(book)}
    <p class="detail-author">${escapeHtml(book.creator || "Unknown author")}</p>
    ${book.creatorAlt || book.year ? `
      <p class="detail-subline">
        ${book.creatorAlt ? escapeHtml(book.creatorAlt) : ""}${book.creatorAlt && book.year ? " · " : ""}${book.year ? `Published ${escapeHtml(book.year)}` : ""}
      </p>
    ` : ""}

    <div class="status-toggle-row" id="statusToggleRow">
      ${["to-read", "reading", "read"].map((s) => `
        <button type="button" class="status-toggle-btn ${s} ${book.readingStatus === s ? "active " + s : ""}" data-status="${s}">${STATUS_LABELS[s]}</button>
      `).join("")}
    </div>

    ${readingDatesHtml(book)}
    ${reviewHtml(book)}

    ${bookWordsHtml(book, store)}

    ${shelfOf(book) === "borrowed" ? borrowedBlockHtml(book) : ""}

    ${owned ? `
      <div class="copies-section">
        <p class="copies-heading">Your Copies (${copies.length})</p>
        ${copies.map((c) => buildCopyRow(c)).join("")}
        <button class="add-copy-btn" id="addCopyBtn" type="button">+ Add another copy</button>
      </div>
    ` : shelfOf(book) === "borrowed" ? "" : `
      <div class="status-pill status-to-read" style="margin-bottom:6px;">Wishlist${book.price != null ? ` · $${Number(book.price).toFixed(2)}` : ""}</div>
      ${book.price != null && book.priceCheckedDate ? `<p class="price-checked-note">You checked this price on ${fmtDate(book.priceCheckedDate)}</p>` : ""}
      ${priceLinksHtml(book)}
      <button class="btn btn-secondary" id="gotCopyBtn" type="button" style="margin-top:14px;">I got a copy — mark as owned</button>
    `}
  `;
}

/** Reading-dates block: a summary line plus always-editable date inputs.
 *  Shown once a book is Reading or Read — a to-read book has nothing to date yet. */
/** Renders a 1-5 star row. `interactive` makes each star a button. */


/** Review + rating. Sits under the reading log, so it turns up once a book is
 *  actually in play — a To Read book has nothing to review yet. */
function reviewHtml(book) {
  if (book.readingStatus !== "reading" && book.readingStatus !== "read") return "";
  const hasReview = (book.review && book.review.trim()) || book.rating;

  return `
    <div class="review-block" id="reviewBlock">
      <div class="review-head">
        <span class="review-title">Your review</span>
        <button class="mini-edit" id="reviewEditBtn" type="button" aria-label="Edit review"><span class="btn-icon">${ICONS.edit}</span></button>
      </div>

      <div class="review-read" id="reviewRead">
        ${book.rating ? `<div class="review-stars">${starsHtml(book.rating)}<span class="review-score">${formatRating(book.rating)}/5</span></div>` : ""}
        ${book.review && book.review.trim()
          ? `<p class="review-text">${escapeHtml(book.review)}</p>`
          : (book.rating ? "" : `<p class="review-empty">Not reviewed yet — tap the pencil to add one.</p>`)}
        ${book.reviewDate && hasReview ? `<p class="review-date">Reviewed ${fmtDate(book.reviewDate)}</p>` : ""}
      </div>

      <div class="review-edit" id="reviewEdit" hidden>
        <div class="review-rate-row">
          <span class="review-rate-label">Rating</span>
          ${starsHtml(book.rating, true)}
          <span class="draft-score" id="draftScore">${book.rating ? formatRating(book.rating) + "/5" : ""}</span>
          <button type="button" class="clear-rating" id="clearRating">Clear</button>
        </div>
        <textarea id="reviewInput" class="review-input" rows="4" placeholder="What did you make of it?">${escapeHtml(book.review || "")}</textarea>
        <button class="btn btn-primary" id="saveReviewBtn" type="button">Save review</button>
      </div>
    </div>
  `;
}

function readingDatesHtml(book) {
  if (book.readingStatus !== "reading" && book.readingStatus !== "read") return "";
  const span = readingSpanText(book);
  return `
    <div class="reading-dates" id="readingDates">
      <div class="reading-dates-head">
        <span class="reading-dates-title">Reading log</span>
        ${span ? `<span class="reading-dates-span">${escapeHtml(span)}</span>` : ""}
      </div>
      <div class="date-pair">
        <label class="date-field">
          <span>Started</span>
          <input type="date" id="d-started" value="${book.startedDate || ""}">
        </label>
        <label class="date-field">
          <span>Finished</span>
          <input type="date" id="d-finished" value="${book.finishedDate || ""}">
        </label>
      </div>
    </div>
  `;
}

/** Borrowed detail — the mirror of a lent-out copy. Reads as information
 *  until you tap the pencil, same as everything else. */
function borrowedBlockHtml(book) {
  const b = book.borrowed || {};
  const holding = stillHolding(book);
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
          <p class="field-hint">Filling in a return date marks it as given back — clear it if you still have it.</p>
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

function editModeHtml(book) {
  const owned = isOwned(book);
  return `
    <div class="detail-top-row">
      <h2>Edit Details</h2>
      <button class="edit-toggle-btn" id="toggleEditBtn" type="button"><span class="btn-icon">${ICONS.eye}</span>View</button>
    </div>
    <div class="field">
      <label>Title</label>
      <input type="text" id="f-title" value="${escapeHtml(book.title)}">
    </div>
    <div class="field">
      <label>Author</label>
      <input type="text" id="f-creator" value="${escapeHtml(book.creator || "")}">
      <p class="field-hint">This is the name the list sorts and groups by.</p>
      <label class="settings-check bulk-rename" id="bulkRenameWrap" hidden>
        <input type="checkbox" id="bulkRename">
        <span id="bulkRenameLabel"></span>
      </label>
    </div>
    <div class="field">
      <label>Author, original script</label>
      <input type="text" id="f-creator-alt" placeholder="村上春樹" value="${escapeHtml(book.creatorAlt || "")}">
      <p class="field-hint">
        Optional. Shown on the book and matched by search, but never used for
        sorting — mixed scripts don't sort into an A–Z list.
        ${book.creatorAlt ? `<button type="button" class="link-btn" id="swapNamesBtn" style="margin-top:4px;">Swap the two</button>` : ""}
      </p>
    </div>
    <div class="field">
      <label>Year published</label>
      <input type="text" id="f-year" inputmode="numeric" placeholder="1987" value="${escapeHtml(book.year || "")}">
    </div>
    <div class="field">
      <label>ISBN</label>
      <input type="text" id="f-isbn" placeholder="9780099448822" value="${escapeHtml(book.isbn || "")}">
    </div>
    ${shelfSwitcherHtml(book, "book")}
    <div class="field">
      <label>Cover</label>
      <button class="btn btn-secondary" id="changeCoverBtn" type="button" style="margin-top:0;">
        ${book.customCover ? "Change cover (using your photo)" : book.coverId ? "Change cover (using a picked edition)" : "Change cover"}
      </button>
    </div>
    ${!owned ? `
      <div class="field">
        <label>Price ($) — wishlist</label>
        <input type="number" step="0.01" id="f-price" value="${book.price ?? ""}" placeholder="18.90">
      </div>
    ` : ""}
    <div class="btn-row">
      <button class="btn btn-primary" id="saveBtn" type="button">Save Changes</button>
    </div>
    <div class="danger-zone">
      <button class="btn btn-secondary" id="deleteBtn" type="button">Remove from library</button>
    </div>
  `;
}

function wireViewMode(sheet, book, store, container, opts = {}) {
  wireCover(sheet, book);

  const viewWords = sheet.querySelector("#viewAllWordsBtn");
  if (viewWords) {
    viewWords.addEventListener("click", () => {
      const go = () => router.navigate("words", { bookId: book.id });
      // The sheet has to close first, and closing it is a history.back() —
      // which is asynchronous. Navigating straight after it meant the popstate
      // landed AFTER the navigation, found no layer left to absorb it, and
      // dutifully sent us back to Books. So: close, let the pop be handled,
      // then go.
      if (!isModalOpen()) return go();
      window.addEventListener("popstate", () => setTimeout(go, 0), { once: true });
      dismissLayer();
    });
  }

  const faveBtn = sheet.querySelector("#faveBtn");
  if (faveBtn) {
    faveBtn.addEventListener("click", () => {
      bounceTap(faveBtn);
      // Favouriting is about the book, so it travels with the review across
      // every edition you own.
      updateWork(store, book, { favourite: !book.favourite });
      refreshDetail(store, container, book.id);
    });
  }

  const shareItemBtn = sheet.querySelector("#shareItemBtn");
  if (shareItemBtn) {
    shareItemBtn.addEventListener("click", () => {
      bounceTap(shareItemBtn);
      openShareSheet(shareCardsForBook(book), {
        filename: `stackt-${(book.title || "book").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`,
      });
    });
  }

  const coverTapTarget = sheet.querySelector("#coverTapTarget");
  if (coverTapTarget) {
    coverTapTarget.addEventListener("click", () => openCoverLightbox(book));
  }

  sheet.querySelectorAll(".status-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const wasRead = book.readingStatus === "read";
      const newStatus = btn.dataset.status;
      const patch = { readingStatus: newStatus };

      // Auto-stamp the obvious dates so the common path needs no typing —
      // but never overwrite a date that's already set, since the user may
      // have corrected it by hand.
      if (newStatus === "reading" && !book.startedDate) patch.startedDate = today();
      if (newStatus === "read") {
        if (!book.startedDate) patch.startedDate = today();
        if (!book.finishedDate) patch.finishedDate = today();
      }
      // Going back to "to-read" means you haven't read it — clear the log.
      if (newStatus === "to-read") {
        patch.startedDate = null;
        patch.finishedDate = null;
      }
      // Re-reading: moving Read -> Reading clears the finish date only.
      if (newStatus === "reading" && wasRead) patch.finishedDate = null;

      store.updateItem(book.id, patch);
      refreshDetail(store, container, book.id);
      if (!wasRead && newStatus === "read") {
        confettiBurst(window.innerWidth / 2, window.innerHeight / 2);
      }
    });
  });

  // Reading dates stay editable at any time — change either one and it saves
  // immediately, with the "took N days" line recomputed.
  const startedInput = sheet.querySelector("#d-started");
  const finishedInput = sheet.querySelector("#d-finished");
  [startedInput, finishedInput].forEach((input) => {
    wireDateField(input, () => {
      store.updateItem(book.id, {
        startedDate: startedInput.value || null,
        finishedDate: finishedInput.value || null,
      });
      refreshDetail(store, container, book.id);
    });
  });

  // ---- review + rating ----
  const reviewEditBtn = sheet.querySelector("#reviewEditBtn");
  const reviewRead = sheet.querySelector("#reviewRead");
  const reviewEdit = sheet.querySelector("#reviewEdit");
  if (reviewEditBtn && reviewRead && reviewEdit) {
    // Local draft so tapping stars re-paints without writing to the store on
    // every tap — the save button commits.
    let draftRating = normaliseRating(book.rating);
    const starRow = reviewEdit.querySelector(".star-row");

    reviewEditBtn.addEventListener("click", () => {
      const opening = reviewEdit.hidden;
      reviewEdit.hidden = !opening;
      reviewRead.hidden = opening;
      reviewEditBtn.classList.toggle("open", opening);
      if (opening) {
        paintStars(starRow, draftRating);
        makeClearable(reviewEdit.querySelector("#reviewInput"));
      }
    });

    wireStars(starRow, draftRating, (value) => {
      draftRating = value;
      const score = reviewEdit.querySelector("#draftScore");
      if (score) score.textContent = value ? `${formatRating(value)}/5` : "";
    });

    const clearBtn = sheet.querySelector("#clearRating");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        draftRating = 0;
        paintStars(starRow, 0);
        const score = reviewEdit.querySelector("#draftScore");
        if (score) score.textContent = "";
      });
    }

    sheet.querySelector("#saveReviewBtn").addEventListener("click", () => {
      const text = sheet.querySelector("#reviewInput").value.trim();
      const had = !!(book.review && book.review.trim()) || !!book.rating;
      const has = !!text || !!draftRating;
      // Every edition of this book, not just the copy you happened to open.
      updateWork(store, book, {
        rating: draftRating || null,
        review: text || null,
        reviewDate: has ? (book.reviewDate && had ? book.reviewDate : today()) : null,
      });
      refreshDetail(store, container, book.id);
    });
  }

  // ---- borrowed book controls ----
  const borrowEditBtn = sheet.querySelector("#borrowEditBtn");
  const borrowDates = sheet.querySelector("#borrowDates");
  if (borrowEditBtn && borrowDates) {
    borrowEditBtn.addEventListener("click", () => {
      borrowDates.hidden = !borrowDates.hidden;
      borrowEditBtn.classList.toggle("open", !borrowDates.hidden);
    });
    ["#b-from", "#b-start", "#b-returned"].forEach((sel) => {
      const input = sheet.querySelector(sel);
      wireDateField(input, () => {
        store.updateItem(book.id, {
          borrowed: {
            ...book.borrowed,
            from: sheet.querySelector("#b-from").value.trim() || null,
            borrowedDate: sheet.querySelector("#b-start").value || null,
            returnedDate: sheet.querySelector("#b-returned").value || null,
          },
        });
        refreshDetail(store, container, book.id);
      });
    });
  }

  const giveBackBtn = sheet.querySelector("#giveBackBtn");
  if (giveBackBtn) {
    giveBackBtn.addEventListener("click", () => {
      store.updateItem(book.id, { borrowed: { ...book.borrowed, returnedDate: today() } });
      refreshDetail(store, container, book.id);
    });
  }

  const reborrowBtn = sheet.querySelector("#reborrowBtn");
  if (reborrowBtn) {
    reborrowBtn.addEventListener("click", () => {
      store.updateItem(book.id, { borrowed: { ...book.borrowed, borrowedDate: today(), returnedDate: null } });
      refreshDetail(store, container, book.id);
    });
  }

  // Borrowed it, loved it, bought your own — moves to Library, borrow record kept.
  const boughtItBtn = sheet.querySelector("#boughtItBtn");
  if (boughtItBtn) {
    boughtItBtn.addEventListener("click", () => {
      const newCopy = { id: uid(), acquiredDate: today(), currentLoan: null, history: [] };
      store.updateItem(book.id, { copies: [newCopy] });
      refreshDetail(store, container, book.id);
    });
  }

  const gotCopyBtn = sheet.querySelector("#gotCopyBtn");
  if (gotCopyBtn) {
    gotCopyBtn.addEventListener("click", () => {
      // Asked, not assumed. Carrying the wishlist price straight across
      // recorded every purchase as having cost exactly what you expected —
      // the one outcome that makes the whole comparison meaningless.
      askWhatYouPaid({
        title: book.title,
        benchmark: book.price != null ? Number(book.price) : null,
        checkedDate: book.priceCheckedDate,
        onDone: ({ paid, expected }) => {
          const newCopy = {
            id: uid(), acquiredDate: today(), currentLoan: null, history: [],
            paid, expected,
          };
          store.updateItem(book.id, {
            copies: [...(book.copies || []), newCopy],
            price: null,
            priceCheckedDate: null,
          });
          refreshDetail(store, container, book.id);
        },
      });
    });
  }

  const addCopyBtn = sheet.querySelector("#addCopyBtn");
  if (addCopyBtn) {
    addCopyBtn.addEventListener("click", () => {
      const newCopy = { id: uid(), acquiredDate: today(), currentLoan: null, history: [] };
      store.updateItem(book.id, { copies: [...(book.copies || []), newCopy] });
      refreshDetail(store, container, book.id);
    });
  }

  const copies = book.copies || [];
  copies.forEach((c) => {
    const row = sheet.querySelector(`[data-copy-id="${c.id}"]`);
    if (!row) return;

    const lendBtn = row.querySelector(".lend-trigger");
    const returnBtn = row.querySelector(".return-trigger");
    const removeBtn = row.querySelector(".remove-copy");
    const inlineForm = row.querySelector(".lend-inline-form");
    const confirmBtn = row.querySelector(".confirm-lend");

    if (lendBtn) lendBtn.addEventListener("click", () => inlineForm.classList.toggle("open"));

    // Dates stay read-only until you ask to change them.
    const miniEdit = row.querySelector(".mini-edit");
    const dateBlock = row.querySelector(".copy-dates");
    if (miniEdit && dateBlock) {
      miniEdit.addEventListener("click", () => {
        dateBlock.hidden = !dateBlock.hidden;
        miniEdit.classList.toggle("open", !dateBlock.hidden);
      });
    }

    // Arrived here from "Lend it to someone" on the scan screen — open the
    // form for that copy and put the cursor in the borrower field.
    if (opts.openLendFor === c.id && inlineForm) {
      inlineForm.classList.add("open");
      const who = inlineForm.querySelector(".lend-to-input");
      if (who) setTimeout(() => who.focus(), 250);
      setTimeout(() => row.scrollIntoView({ block: "center", behavior: "smooth" }), 120);
    }

    if (confirmBtn) {
      confirmBtn.addEventListener("click", () => {
        const lentTo = row.querySelector(".lend-to-input").value.trim();
        if (!lentTo) {
          nudge(row.querySelector(".lend-to-input"));
          return;
        }
        const lentDate = row.querySelector(".lend-start-input").value || today();
        const updatedCopies = copies.map((cc) =>
          cc.id === c.id ? { ...cc, currentLoan: { lentTo, lentDate } } : cc
        );
        store.updateItem(book.id, { copies: updatedCopies });
        refreshDetail(store, container, book.id);
      });
    }

    // An active loan's borrower and start date stay editable — fix a typo or a
    // wrong start date without having to return and re-lend the copy.
    const loanWho = row.querySelector(".loan-who");
    const loanStart = row.querySelector(".loan-start");
    [loanWho, loanStart].forEach((input) => {
      wireDateField(input, () => {
        const updatedCopies = copies.map((cc) =>
          cc.id === c.id
            ? {
                ...cc,
                currentLoan: {
                  ...cc.currentLoan,
                  lentTo: loanWho.value.trim() || cc.currentLoan.lentTo,
                  lentDate: loanStart.value || null,
                },
              }
            : cc
        );
        store.updateItem(book.id, { copies: updatedCopies });
        refreshDetail(store, container, book.id);
      });
    });

    // There's no deadline in this model, so a return date isn't a target —
    // it's the record of the loan ending. Setting it closes the loan, which
    // also lets you record a book that came back last week.
    const loanReturned = row.querySelector(".loan-returned");
    wireDateField(loanReturned, () => {
      if (!loanReturned.value) return;
      closeLoan(store, container, book, copies, c.id, loanReturned.value);
    });

    // When a copy actually joined your shelf is editable — a book bought
    // years ago shouldn't be stamped with the day you happened to add it.
    const acquiredInput = row.querySelector(".copy-acquired");
    wireDateField(acquiredInput, () => {
      const updatedCopies = copies.map((cc) =>
        cc.id === c.id ? { ...cc, acquiredDate: acquiredInput.value || null } : cc
      );
      store.updateItem(book.id, { copies: updatedCopies });
      refreshDetail(store, container, book.id);
    });

    // The price opens the same sheet you saw at the till, with both numbers
    // editable — the noted price can be wrong too, and the whole comparison
    // rests on it.
    const priceBtn = row.querySelector("[data-price-for]");
    if (priceBtn) {
      priceBtn.addEventListener("click", () => {
        bounceTap(priceBtn);
        askWhatYouPaid({
          title: book.title,
          benchmark: c.expected != null ? Number(c.expected) : null,
          paid: c.paid != null ? Number(c.paid) : null,
          editing: true,
          onDone: ({ paid, expected }) => {
            const updatedCopies = copies.map((cc) =>
              cc.id === c.id ? { ...cc, paid, expected } : cc
            );
            store.updateItem(book.id, { copies: updatedCopies });
            refreshDetail(store, container, book.id);
          },
        });
      });
    }

    // Past loans are editable too, so a return date can be corrected later.
    row.querySelectorAll(".loan-history-row").forEach((histRow) => {
      const idx = Number(histRow.dataset.historyIndex);
      const hStart = histRow.querySelector(".hist-start");
      const hEnd = histRow.querySelector(".hist-end");
      [hStart, hEnd].forEach((input) => {
        wireDateField(input, () => {
          const updatedCopies = copies.map((cc) => {
            if (cc.id !== c.id) return cc;
            const hist = [...(cc.history || [])];
            if (!hist[idx]) return cc;
            hist[idx] = { ...hist[idx], lentDate: hStart.value || null, returnedDate: hEnd.value || null };
            return { ...cc, history: hist };
          });
          store.updateItem(book.id, { copies: updatedCopies });
          refreshDetail(store, container, book.id);
        });
      });
    });

    if (returnBtn) {
      // One tap = came back today. The date field above handles any other day.
      returnBtn.addEventListener("click", () => {
        closeLoan(store, container, book, copies, c.id, today());
      });
    }

    if (removeBtn) {
      removeBtn.addEventListener("click", () => {
        const updatedCopies = copies.filter((cc) => cc.id !== c.id);
        store.updateItem(book.id, { copies: updatedCopies });
        refreshDetail(store, container, book.id);
      });
    }
  });
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

      // Stamped when it becomes a want, so "wanted 8 months" is measured from
      // when you started wanting it rather than when the item first appeared.
      const patch = {
        copies: [], borrowed: null, price: null, priceCheckedDate: null,
        wantedSince: today(),
      };
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

function wireEditMode(sheet, book, store, container) {
  wireShelfSwitcher(sheet, book, store, container, "book");
  ["#f-title", "#f-creator", "#f-creator-alt"].forEach((sel) =>
    makeClearable(sheet.querySelector(sel))
  );

  // Offer "apply to all" only once the name has actually been changed, and only
  // when this author has other books — otherwise it's a checkbox that does
  // nothing, which is worse than no checkbox.
  const creatorField = sheet.querySelector("#f-creator");
  const bulkWrap = sheet.querySelector("#bulkRenameWrap");
  const bulkLabel = sheet.querySelector("#bulkRenameLabel");
  const originalAuthor = book.creator || "";
  const siblingCount = store
    .itemsByType("book")
    .filter((b) => (b.creator || "") === originalAuthor && b.id !== book.id).length;

  const refreshBulk = () => {
    const changed = creatorField.value.trim() !== originalAuthor.trim();
    const worth = changed && originalAuthor.trim() && siblingCount > 0;
    bulkWrap.hidden = !worth;
    if (worth) {
      bulkLabel.textContent =
        `Also rename the other ${siblingCount} book${siblingCount === 1 ? "" : "s"} by ${originalAuthor}`;
    }
  };
  creatorField.addEventListener("input", refreshBulk);
  refreshBulk();

  // If the lookup guessed wrong about which spelling should sort, one tap fixes
  // it rather than retyping both names.
  const swapBtn = sheet.querySelector("#swapNamesBtn");
  if (swapBtn) {
    swapBtn.addEventListener("click", () => {
      const main = sheet.querySelector("#f-creator");
      const alt = sheet.querySelector("#f-creator-alt");
      const held = main.value;
      main.value = alt.value;
      alt.value = held;
    });
  }

  const changeCoverBtn = sheet.querySelector("#changeCoverBtn");
  if (changeCoverBtn) {
    changeCoverBtn.addEventListener("click", () => {
      openCoverPicker(book, async (pick) => {
        const patch = await applyCoverPick(book.id, pick);
        store.updateItem(book.id, patch);
        refreshDetail(store, container, book.id, { mode: "edit" });
      });
    });
  }

  sheet.querySelector("#saveBtn").addEventListener("click", () => {
    const titleInput = sheet.querySelector("#f-title");
    if (!titleInput.value.trim()) {
      nudge(titleInput);
      return;
    }
    const bulk = sheet.querySelector("#bulkRename");
    if (bulk && bulk.checked && !bulkWrap.hidden) {
      renameAuthorEverywhere(store, originalAuthor, creatorField.value.trim());
    }

    const patch = {
      title: titleInput.value.trim(),
      creator: sheet.querySelector("#f-creator").value,
      creatorAlt: sheet.querySelector("#f-creator-alt").value.trim() || null,
      year: sheet.querySelector("#f-year").value.trim() || null,
      isbn: sheet.querySelector("#f-isbn").value.trim() || null,
    };
    const priceInput = sheet.querySelector("#f-price");
    if (priceInput) {
      const parsed = parseFloat(priceInput.value);
      patch.price = isNaN(parsed) ? null : parsed;
      // Stamp when you last touched the price so the wishlist view can show its age
      // instead of implying it's live — it's only as fresh as your last manual check.
      patch.priceCheckedDate = patch.price != null ? today() : null;
    }

    store.updateItem(book.id, patch);
    closeModal();
    render(container, store);
  });

  sheet.querySelector("#deleteBtn").addEventListener("click", () => {
    deleteBlob(ownKey(book.id)); // don't leave an orphan photo behind
      store.removeItem(book.id);
    closeModal();
    render(container, store);
  });
}

/**
 * Refreshes an open book sheet after a data change.
 *
 * Redraws the sheet's contents in place rather than closing and reopening it —
 * a teardown replayed the slide-up animation on every status tap, which is what
 * looked like the sheet jumping. Also keeps the list behind it in sync, without
 * re-animating it.
 */
/**
 * Renames an author everywhere.
 *
 * Editing one book's author field only ever fixed that book, so correcting a
 * name you'd catalogued in another script meant opening every title by them.
 * Returns how many changed, so the UI can say.
 */
function renameAuthorEverywhere(store, from, to, altTo = undefined) {
  const before = String(from || "").trim();
  const after = String(to || "").trim();
  if (!before || !after) return 0;
  const matches = store.itemsByType("book").filter((b) => (b.creator || "") === before);
  matches.forEach((b) => {
    const patch = { creator: after };
    if (altTo !== undefined) patch.creatorAlt = altTo || null;
    store.updateItem(b.id, patch);
  });
  return matches.length;
}

/**
 * Applies a patch to every edition of the same work.
 *
 * A review is about the book, not the printing — so writing one on any copy
 * shows it on all of them, and on the grouped row in the list. Each item keeps
 * its own fields (nothing about the data shape changed), they're just kept in
 * step, which means sorting, filtering and the share cards all carry on
 * working without knowing this happens.
 */
function updateWork(store, book, patch) {
  const key = workKey(book);
  const siblings = store
    .itemsByType("book")
    .filter((b) => workKey(b) === key);
  if (siblings.length <= 1) {
    store.updateItem(book.id, patch);
    return;
  }
  siblings.forEach((b) => store.updateItem(b.id, patch));
}

function refreshDetail(store, container, bookId, opts = {}) {
  const fresh = store.get().items.find((it) => it.id === bookId);
  if (!fresh) {
    dismissLayer();
    render(container, store);
    return;
  }
  renderQuiet(container, store);
  if (!drawDetailInto(fresh, store, container, opts)) {
    openDetail(fresh, store, container, opts);
  }
}

/** Re-renders the list behind the sheet without the entrance animation. */
function renderQuiet(container, store) {
  const view = document.getElementById("view");
  const prevScroll = view ? view.scrollTop : 0;
  render(container, store);
  if (view) view.scrollTop = prevScroll;
}

/** Ends an active loan: moves it into history stamped with the date it
 *  actually came back. Shared by the "Mark Returned" button and the
 *  "Returned on" field so both paths behave identically. */
function closeLoan(store, container, book, copies, copyId, returnedDate) {
  const updatedCopies = copies.map((cc) => {
    if (cc.id !== copyId || !cc.currentLoan) return cc;
    const historyEntry = { ...cc.currentLoan, returnedDate };
    return { ...cc, currentLoan: null, history: [...(cc.history || []), historyEntry] };
  });
  store.updateItem(book.id, { copies: updatedCopies });
  refreshDetail(store, container, book.id);
}

/**
 * " · $32 under" — how a purchase landed against the price you'd noted.
 * Shows overs as readily as unders: a tally that only ever congratulates you
 * is one you stop believing in both directions.
 */
function paidVerdict(copy) {
  if (!copy || copy.paid == null || copy.expected == null) return "";
  const diff = Number(copy.expected) - Number(copy.paid);
  if (Math.abs(diff) < 0.005) return "";
  return diff > 0
    ? `<span class="verdict under">$${diff.toFixed(2)} under</span>`
    : `<span class="verdict over">$${Math.abs(diff).toFixed(2)} over</span>`;
}

function buildCopyRow(copy) {
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
        <button class="mini-edit" type="button" aria-label="Edit dates"><span class="btn-icon">${ICONS.edit}</span></button>
      </div>

      <!-- The price is its own control. It used to live behind the pencil with
           the dates, which meant a typo could only be fixed by moving the item
           back to the wishlist and out again. -->
      <button class="copy-price ${copy.paid != null ? "set" : ""}" type="button" data-price-for="${copy.id}">
        ${copy.paid != null
          ? `<span class="cp-amount">$${Number(copy.paid).toFixed(2)}</span>${paidVerdict(copy)}`
          : `<span class="cp-add">Add what you paid</span>`}
      </button>

      <!-- Dates read as plain information until you tap the pencil. -->
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
          <p class="field-hint">Lending to friends has no deadline — filling in a return date is what closes the loan.</p>
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
                <div class="date-pair">
                  <label class="date-field">
                    <span>Lent</span>
                    <input type="date" class="hist-start" value="${h.lentDate || ""}">
                  </label>
                  <label class="date-field">
                    <span>Returned</span>
                    <input type="date" class="hist-end" value="${h.returnedDate || ""}">
                  </label>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      ` : ""}
    </div>
  `;
}

// ---------- scan-match confirmation ----------

function openScanMatch(book, store, container) {
  openModal((sheet) => {
    const copies = book.copies || [];
    const shelfCopy = copies.find((c) => !c.currentLoan) || null;
    // A wishlist entry is still a record, so a plain ISBN match would claim you
    // already own a book you've only bookmarked. Split the two cases.
    const kind = shelfOf(book);
    const onWishlist = kind === "wishlist";
    const isBorrowed = kind === "borrowed";
    const holdingIt = isBorrowed && stillHolding(book);
    // Scanning a book that's out on loan almost always means it just came back.
    const loanedCopy = copies.find((c) => c.currentLoan) || null;

    sheet.innerHTML = `
      <h2 style="text-align:center;">${isBorrowed ? "You borrowed this" : onWishlist ? "On your wishlist" : "Found it!"}</h2>
      ${coverBlockHtml(book)}
      <p class="scan-match-title">${escapeHtml(book.title)}</p>
      <p class="scan-match-sub">${escapeHtml(book.creator || "")}${
        isBorrowed
          ? ` · borrowed from ${escapeHtml((book.borrowed && book.borrowed.from) || "someone")}`
          : onWishlist
            ? (book.price != null ? ` · you noted $${Number(book.price).toFixed(2)}` : " · not in your library yet")
            : ` · ${copies.length} cop${copies.length === 1 ? "y" : "ies"} in your library`
      }</p>
      <div class="btn-row" style="flex-direction:column;">
        ${holdingIt
          ? `<button class="btn btn-primary" id="giveBackMatchBtn" type="button">Give it back to ${escapeHtml((book.borrowed && book.borrowed.from) || "them")}</button>`
          : loanedCopy
          ? `<button class="btn btn-primary" id="returnMatchBtn" type="button">Mark returned — ${escapeHtml(loanedCopy.currentLoan.lentTo || "borrower")} gave it back</button>`
          : onWishlist
            ? `<button class="btn btn-primary" id="gotItBtn" type="button">I bought it — move to Library</button>`
            : `<button class="btn btn-primary" id="addCopyMatchBtn" type="button">+ Add Another Copy</button>`}
        ${isBorrowed ? `<button class="btn btn-secondary" id="boughtMatchBtn" type="button">I own it now</button>` : ""}
        ${loanedCopy && !onWishlist ? `<button class="btn btn-secondary" id="addCopyMatchBtn" type="button">+ Add Another Copy</button>` : ""}
        ${shelfCopy ? `<button class="btn btn-secondary" id="lendMatchBtn" type="button">Lend It to Someone</button>` : ""}
        <button class="btn btn-secondary" id="viewDetailsBtn" type="button">View Details</button>
      </div>
      ${loanedCopy ? `<p class="scan-match-note">Dated today — change it in the book's details if it came back earlier.</p>` : ""}
      ${!shelfCopy && copies.length ? `<p class="scan-match-note">Every copy is already lent out.</p>` : ""}
    `;
    wireCover(sheet, book);

    const addCopyBtn = sheet.querySelector("#addCopyMatchBtn");
    if (addCopyBtn) {
      addCopyBtn.addEventListener("click", () => {
        const newCopy = { id: uid(), acquiredDate: today(), currentLoan: null, history: [] };
        store.updateItem(book.id, { copies: [...copies, newCopy] });
        refreshDetail(store, container, book.id);
      });
    }

    // Scanning a book you borrowed is usually the moment you're handing it back.
    const giveBackMatchBtn = sheet.querySelector("#giveBackMatchBtn");
    if (giveBackMatchBtn) {
      giveBackMatchBtn.addEventListener("click", () => {
        store.updateItem(book.id, { borrowed: { ...book.borrowed, returnedDate: today() } });
        refreshDetail(store, container, book.id);
      });
    }

    // One tap closes the loan with today's date; the date stays editable after.
    const returnMatchBtn = sheet.querySelector("#returnMatchBtn");
    if (returnMatchBtn) {
      returnMatchBtn.addEventListener("click", () => {
        closeLoan(store, container, book, copies, loanedCopy.id, today());
      });
    }

    const boughtMatchBtn = sheet.querySelector("#boughtMatchBtn");
    if (boughtMatchBtn) {
      boughtMatchBtn.addEventListener("click", () => {
        const newCopy = { id: uid(), acquiredDate: today(), currentLoan: null, history: [] };
        store.updateItem(book.id, { copies: [newCopy] });
        refreshDetail(store, container, book.id);
      });
    }

    const gotItBtn = sheet.querySelector("#gotItBtn");
    if (gotItBtn) {
      gotItBtn.addEventListener("click", () => {
        const newCopy = { id: uid(), acquiredDate: today(), currentLoan: null, history: [] };
        store.updateItem(book.id, { copies: [newCopy], price: null, priceCheckedDate: null });
        refreshDetail(store, container, book.id);
      });
    }

    // Scanning a book you own is often the moment you're handing it to someone —
    // jump straight into the lend form for the first copy still on the shelf.
    const lendBtn = sheet.querySelector("#lendMatchBtn");
    if (lendBtn) {
      lendBtn.addEventListener("click", () => {
        // openModal swaps the sheet in place; closing first would pop the layer
        // out from under the screen we're about to draw.
        openDetail(book, store, container, { openLendFor: shelfCopy.id });
      });
    }
    sheet.querySelector("#viewDetailsBtn").addEventListener("click", () => {
      openDetail(book, store, container);
    });
  });
}

// ---------- add form ----------

function openAddForm(store, container, prefill = {}) {
  openModal((sheet) => {
    sheet.innerHTML = `
      <h2>Add a Book</h2>

      <div class="destination-row three" id="destRow">
        <button type="button" class="destination-btn active" data-dest="library">
          <span class="destination-title">Library</span>
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
        <label>Cover</label>
        <div id="addCoverBlock" class="${prefill.isbn ? "" : "hidden"}">
          ${coverBlockHtml({ isbn: prefill.isbn, color: "#eee" })}
        </div>
        <button class="btn btn-secondary" id="addChangeCoverBtn" type="button" style="margin-top:0;">Choose a cover</button>
        <p class="field-hint">Search other editions, or use your own photo.</p>
      </div>
      <div class="field">
        <label>Title</label>
        <input type="text" id="a-title" placeholder="Kafka on the Shore" value="${escapeHtml(prefill.title || "")}">
      </div>
      <div class="field">
        <label>Author</label>
        <input type="text" id="a-creator" placeholder="Haruki Murakami" value="${escapeHtml(prefill.creator || "")}">
      </div>
      <div class="field" id="a-alt-field" ${prefill.creatorAlt ? "" : 'style="display:none"'}>
        <label>Author, original script</label>
        <input type="text" id="a-creator-alt" placeholder="村上春樹" value="${escapeHtml(prefill.creatorAlt || "")}">
        <p class="field-hint">Kept and searchable; the name above is what sorts.</p>
      </div>
      <div class="field">
        <label>Year published (optional)</label>
        <input type="text" id="a-year" inputmode="numeric" placeholder="1987" value="${escapeHtml(prefill.year || "")}">
      </div>
      <div class="field">
        <label>ISBN (optional)</label>
        <input type="text" id="a-isbn" placeholder="9780099448822" inputmode="numeric" value="${escapeHtml(prefill.isbn || "")}">
        <p class="isbn-lookup-status" id="isbnLookupStatus"></p>
      </div>
      <div class="field">
        <label>Reading Status</label>
        <div class="status-toggle-row" id="a-status-row">
          <button type="button" class="status-toggle-btn to-read active to-read" data-status="to-read">To Read</button>
          <button type="button" class="status-toggle-btn reading" data-status="reading">Reading</button>
          <button type="button" class="status-toggle-btn read" data-status="read">Read</button>
        </div>
      </div>
      <div class="field" id="a-price-field" style="display:none">
        <label>Price ($)</label>
        <input type="number" step="0.01" id="a-price" placeholder="18.90">
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" id="addSaveBtn" type="button">Add to Library</button>
      </div>
    `;

    const coverBlock = sheet.querySelector("#addCoverBlock");
    // Chosen before the book exists, so it can't be keyed by id yet: the blob
    // is held here and filed the moment addItem hands back an id.
    let pickedCover = { customCover: null, coverId: null };
    let pickedBlob = null;
    let pickedPreviewUrl = null;
    const isbnInput = sheet.querySelector("#a-isbn");
    const isbnStatus = sheet.querySelector("#isbnLookupStatus");
    const titleInput = sheet.querySelector("#a-title");
    const creatorInput = sheet.querySelector("#a-creator");
    [titleInput, creatorInput].forEach((el) => makeClearable(el));
    const altInput = sheet.querySelector("#a-creator-alt");
    const altField = sheet.querySelector("#a-alt-field");
    const yearInput = sheet.querySelector("#a-year");
    const priceInput = sheet.querySelector("#a-price");
    const priceField = sheet.querySelector("#a-price-field");
    const borrowField = sheet.querySelector("#a-borrow-field");
    const saveBtn = sheet.querySelector("#addSaveBtn");

    // Reading status as buttons rather than a dropdown, matching the
    // Library/Wishlist choice above it.
    let addStatus = "to-read";
    sheet.querySelectorAll("#a-status-row .status-toggle-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        addStatus = btn.dataset.status;
        sheet.querySelectorAll("#a-status-row .status-toggle-btn").forEach((b) => {
          const on = b === btn;
          b.classList.toggle("active", on);
          ["to-read", "reading", "read"].forEach((k) => b.classList.toggle(k, b.dataset.status === k));
        });
      });
    });

    if (prefill.isbn) wireCover(sheet, { isbn: prefill.isbn });

    // Re-paints the add form's preview from whatever the current pick is.
    function repaintAddCover(isbn) {
      const shape = pickedPreviewUrl
        ? { customCover: pickedPreviewUrl, color: "#eee" }
        : { isbn: isbn || null, ...pickedCover, color: "#eee" };
      // Only the preview hides when there's nothing to show — the button stays
      // put, so a hand-typed book can still be given a cover.
      coverBlock.classList.toggle("hidden", !hasCover(shape));
      coverBlock.innerHTML = coverBlockHtml(shape);
      wireCover(sheet, shape);
    }

    sheet.querySelector("#addChangeCoverBtn").addEventListener("click", () => {
      openCoverPicker(
        { title: titleInput.value.trim(), creator: creatorInput.value.trim(), ...pickedCover },
        (pick) => {
          if (pickedPreviewUrl) URL.revokeObjectURL(pickedPreviewUrl);
          pickedBlob = pick.ownBlob || null;
          pickedPreviewUrl = pickedBlob ? URL.createObjectURL(pickedBlob) : null;
          pickedCover = { customCover: null, coverId: pick.coverId ?? null };
          repaintAddCover(isbnInput.value.trim() || null);
        }
      );
    });

    // Where the book is headed is the first decision, so it's two plain
    // buttons at the top rather than a dropdown buried in the form.
    let destination = "library";
    sheet.querySelectorAll(".destination-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        destination = btn.dataset.dest;
        sheet.querySelectorAll(".destination-btn").forEach((b) =>
          b.classList.toggle("active", b === btn)
        );
        priceField.style.display = destination === "wishlist" ? "" : "none";
        borrowField.style.display = destination === "borrowed" ? "" : "none";
        saveBtn.textContent =
          destination === "wishlist" ? "Add to Wishlist"
          : destination === "borrowed" ? "Add to Borrowed"
          : "Add to Library";
      });
    });

    // Auto-lookup: fires when you finish typing/pasting an ISBN and move on to the
    // next field — same free Open Library + Google Books sources the scanner uses,
    // just triggered by typing instead of the camera. Never overwrites anything
    // you've already typed yourself.
    let lastLookedUp = null;
    isbnInput.addEventListener("blur", async () => {
      const raw = isbnInput.value.trim().replace(/[^0-9Xx]/g, "");
      if (!raw || (raw.length !== 10 && raw.length !== 13)) {
        isbnStatus.textContent = raw ? "That doesn't look like a 10 or 13-digit ISBN." : "";
        return;
      }
      if (raw === lastLookedUp) return; // already looked this one up
      lastLookedUp = raw;

      isbnStatus.textContent = "Looking up this ISBN…";
      const meta = await lookupIsbn(raw);

      if (meta) {
        if (!titleInput.value.trim() && meta.title) titleInput.value = meta.title;
        if (!creatorInput.value.trim() && meta.creator) creatorInput.value = meta.creator;
        if (!yearInput.value.trim() && meta.year) yearInput.value = meta.year;
        // Only surfaces the second name field when the record actually has two
        // spellings — no point showing an empty box for an English author.
        if (meta.creatorAlt && !altInput.value.trim()) {
          altInput.value = meta.creatorAlt;
          altField.style.display = "";
        }
        repaintAddCover(raw);
        isbnStatus.textContent =
          `Found: ${meta.title || "match"}${meta.creator ? " · " + meta.creator : ""}` +
          `${meta.year ? " · " + meta.year : ""}` +
          `${meta.creatorAlt ? ` (also ${meta.creatorAlt})` : ""}`;
      } else {
        isbnStatus.textContent = "No match found for that ISBN — fill in the details manually.";
      }

      // Only worth checking a price if this is going on the wishlist.
      if (destination === "wishlist") {
        const price = await lookupGoogleBooksPrice(raw);
        if (price && !priceInput.value.trim()) {
          priceInput.value = price.amount;
          isbnStatus.textContent += ` · found a price: ${price.currency} ${price.amount}`;
        }
      }
    });

    saveBtn.addEventListener("click", () => {
      if (!titleInput.value.trim()) {
        nudge(titleInput);
        return;
      }
      const owned = destination === "library";
      const copies = owned ? [{ id: uid(), acquiredDate: today(), currentLoan: null, history: [] }] : [];
      const price = destination === "wishlist" ? (parseFloat(priceInput.value) || null) : null;
      const borrowed =
        destination === "borrowed"
          ? {
              from: sheet.querySelector("#a-borrow-from").value.trim() || null,
              borrowedDate: today(),
              returnedDate: null,
            }
          : null;
      // Whatever the source (auto-lookup or typed by hand), saving a price now means
      // it's fresh as of today — same "checked on" convention as the edit screen.
      const priceCheckedDate = price != null ? today() : null;

      const created = store.addItem({
        type: "book",
        title: titleInput.value.trim(),
        creator: creatorInput.value.trim(),
        creatorAlt: altInput.value.trim() || null,
        year: yearInput.value.trim() || null,
        isbn: isbnInput.value.trim() || null,
        customCover: pickedCover.customCover,
        coverId: pickedCover.coverId,
        readingStatus: addStatus,
        price,
        priceCheckedDate,
        color: randomColor(),
        copies,
        borrowed,
      });

      if (pickedBlob) {
        const key = ownKey(created.id);
        putBlob(key, pickedBlob, { permanent: true }).then((stored) => {
          if (stored) store.updateItem(created.id, { coverRef: key });
          if (pickedPreviewUrl) URL.revokeObjectURL(pickedPreviewUrl);
          render(container, store);
        });
      }

      closeModal();
      render(container, store);
    });
  });
}

// ---------- barcode scan ----------

function openScanModal(store, container) {
  let controller = null;

  openModal((sheet) => {
    sheet.innerHTML = `
      <h2>Scan a Book</h2>
      <div id="scanArea">
        <div id="html5qr-reader" class="scan-video-wrap"></div>
        <div class="scan-zoom-wrap hidden" id="zoomWrap">
          <span class="scan-zoom-label">${ICONS.zoom}</span>
          <input type="range" id="zoomSlider" min="1" max="5" step="0.1" value="1">
          <button class="torch-btn hidden" id="torchBtn" type="button" aria-label="Toggle flash">${ICONS.torch}</button>
        </div>
      </div>
      <p class="scan-hint" id="scanHint">Starting camera…</p>
      <button class="link-btn" id="manualEntryBtn" type="button">Enter ISBN manually instead</button>
    `;

    const scanArea = sheet.querySelector("#scanArea");
    const hint = sheet.querySelector("#scanHint");
    const zoomWrap = sheet.querySelector("#zoomWrap");
    const zoomSlider = sheet.querySelector("#zoomSlider");
    const torchBtn = sheet.querySelector("#torchBtn");

    function showManualEntry(message) {
      if (controller) {
        controller.stop();
        controller = null;
      }
      scanArea.innerHTML = `
        <div class="field">
          <label>ISBN</label>
          <input type="text" id="manualIsbn" placeholder="9780099448822" inputmode="numeric">
        </div>
        <button class="btn btn-primary" id="manualLookupBtn" type="button">Look Up</button>
      `;
      hint.textContent = message || "Type the number under the barcode.";
      scanArea.querySelector("#manualLookupBtn").addEventListener("click", () => {
        const isbn = scanArea.querySelector("#manualIsbn").value.trim();
        if (!isbn) {
          nudge(scanArea.querySelector("#manualIsbn"));
          return;
        }
        handleScannedIsbn(isbn, store, container);
      });
    }

    sheet.querySelector("#manualEntryBtn").addEventListener("click", () => showManualEntry());

    if (!window.isSecureContext) {
      // getUserMedia is blocked outright on insecure origins — this is the #1 cause of
      // "camera never opens" when testing over Live Server's LAN address (http://192.168...).
      // http://localhost / 127.0.0.1 and https:// both count as secure; a LAN IP over http:// doesn't.
      showManualEntry(
        "Camera needs a secure (HTTPS) connection — this page is loaded over plain http://, which browsers block camera access on. Try the deployed GitHub Pages link, or an HTTPS tunnel (e.g. ngrok) pointed at Live Server. Enter the ISBN manually for now."
      );
      return;
    }

    if (!isScanSupported()) {
      showManualEntry("Camera scanning isn't available in this browser — enter the ISBN instead.");
      return;
    }

    startScanner("html5qr-reader", (isbn) => {
      if (controller) {
        controller.stop();
        controller = null;
      }
      handleScannedIsbn(isbn, store, container);
    })
      .then((ctrl) => {
        controller = ctrl;
        hint.textContent = "Hold the barcode flat, well-lit, filling most of the frame — a little further back tends to focus better than very close up.";

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
          let torchOn = false;
          torchBtn.addEventListener("click", () => {
            torchOn = !torchOn;
            ctrl.torch.apply(torchOn);
            torchBtn.classList.toggle("on", torchOn);
          });
        }
      })
      .catch((err) => {
        console.warn(err);
        showManualEntry("Couldn't access the camera — enter the ISBN instead.");
      });
  }, () => {
    if (controller) controller.stop();
  });
}

async function handleScannedIsbn(isbn, store, container) {
  // No closeModal here: the scanner sheet is replaced in place by whichever
  // screen comes next, which keeps the single layer (and its history entry).
  const existing = store.findByIsbn("book", isbn);
  if (existing) {
    openScanMatch(existing, store, container);
    return;
  }
  const meta = await lookupIsbn(isbn);
  openAddForm(store, container, meta || { isbn });
}

function randomColor() {
  const palette = ["#FF3B6B", "#3D5AFE", "#FFC738", "#00D9A3", "#8B5CF6"];
  return palette[Math.floor(Math.random() * palette.length)];
}

/** Called by the header's share button — see applyChrome in core.js. */
function openShelfShare(store) {
  openShareSheet(shareCardsForShelf(store), { filename: "stackt-books" });
}

export default { render, openAddForm, openShelfShare };
