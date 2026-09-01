// ============================================
// Words — the vocabulary book.
//
// A separate module rather than a section inside Books, because it's used at a
// different tempo: you meet a word mid-sentence with the book in your other
// hand, and three taps into a book's detail sheet is too slow for that.
//
// It opens on the LOOKUP, not on the list. The thing you came here to do is
// find out what a word means; the words you've already saved are the thing you
// browse occasionally. Making the list the front door meant every lookup cost
// a tap on + first, which is a tap for nothing.
//
// It still knows about Books: a new word lands in what you're reading. Folders
// ARE books here, plus Unfiled — no invented folder system, because the shelf
// you already keep is the one that means anything.
// ============================================

import { openModal, dismissLayer, openOverlay, escapeHtml, makeClearable, debounce } from "./ui.js";
import { bounceTap, nudge, confettiBurst } from "./animations.js";
import { ICONS } from "./icons.js";
import { createSorter, collator, openSortSheet } from "./sorting.js";
import { lookupWord, WordLookupError } from "./dictionary.js";

// Which of the module's two screens you're on.
let view = "lookup";        // "lookup" | "library"

// Lookup screen state, kept at module level so a redraw — picking a book,
// say — doesn't throw away what you typed or what came back.
let term = "";
let result = null;          // trimmed lookup result
let statusText = "";
let statusKind = "";        // "" | "good" | "warn"
let chosenBookId;           // undefined = follow the default; null = Unfiled

// Library screen state.
let searchQuery = "";
let bookFilter = null;      // null = everything, "unfiled", or a book's id
let favesOnly = false;
let groupByBook = false;

// createSorter's `compare` receives the values `value` extracted, not the
// items — getting that backwards silently sorts by the tiebreaker instead.
const SORT_CRITERIA = [
  {
    key: "recent",
    label: "Recently added",
    asc: "Newest first",
    desc: "Oldest first",
    note: "Default",
    value: (w) => w.addedDate || null,
    // Reversed on purpose: "ascending" here means newest at the top, because
    // that is what "recently added" is asking for.
    compare: (a, b) => String(b).localeCompare(String(a)),
  },
  {
    key: "word",
    label: "Word",
    asc: "A–Z",
    desc: "Z–A",
    value: (w) => w.word || "",
    compare: (a, b) => collator.compare(a, b),
  },
];

const sorter = createSorter(SORT_CRITERIA, "recent");

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ---------- reading the shelf ----------

/** Books you're on right now, most recently started first. */
export function readingNow(store) {
  return store
    .itemsByType("book")
    .filter((b) => b.readingStatus === "reading")
    .sort((a, b) =>
      String(b.startedDate || b.addedDate || "").localeCompare(
        String(a.startedDate || a.addedDate || "")
      )
    );
}

/**
 * Where a new word goes if you say nothing.
 *
 * The book you picked up most recently, because that's the one most likely to
 * be in your other hand. With two on the go both are offered as chips, so
 * "most recent" only decides which starts selected — never which you're stuck
 * with.
 */
export function currentBook(store) {
  return readingNow(store)[0] || null;
}

function bookById(store, id) {
  if (!id) return null;
  return store.get().items.find((it) => it.id === id && it.type === "book") || null;
}

function folderName(store, word) {
  const book = bookById(store, word.bookId);
  return book ? book.title : "Unfiled";
}

/** The book id a save would use right now. */
function effectiveBookId(store) {
  if (chosenBookId !== undefined) return chosenBookId;
  const b = currentBook(store);
  return b ? b.id : null;
}

// ============================================
// the lookup screen
// ============================================

/**
 * Sentences for one sense.
 *
 * Words saved before v34 carry `examples` — plain strings, no citation. Newer
 * ones carry `sentences`, most of which come from Wiktionary's quotes and know
 * where they came from. Both render; nothing needs migrating.
 */
function sentencesOf(sense) {
  if (Array.isArray(sense.sentences)) return sense.sentences;
  return (sense.examples || []).map((text) => ({ text, ref: null }));
}

function sensesHtml(word) {
  const senses = word.senses || [];
  if (!senses.length) {
    return `<p class="word-empty-def">No definition saved — tap the pencil to write one.</p>`;
  }
  return senses
    .map((s) => {
      const sentences = sentencesOf(s);
      return `
      <div class="sense">
        ${s.pos ? `<span class="sense-pos">${escapeHtml(s.pos)}</span>` : ""}
        <p class="sense-def">${escapeHtml(s.definition)}</p>
        ${sentences.length
          ? `<div class="sense-quotes">${sentences
              .map(
                (q) => `
              <blockquote class="sense-quote">
                <p class="sense-quote-text">${escapeHtml(q.text)}</p>
                ${q.ref ? `<cite class="sense-quote-ref">${escapeHtml(q.ref)}</cite>` : ""}
              </blockquote>
            `
              )
              .join("")}</div>`
          : ""}
        ${(s.synonyms || []).length
          ? `<p class="sense-syn">also: ${s.synonyms.map(escapeHtml).join(", ")}</p>`
          : ""}
      </div>
    `;
    })
    .join("");
}

/**
 * The book chips.
 *
 * Everything you're reading is on screen at once, so the common case — one or
 * two books — is a single tap with nothing to open. Anything older lives
 * behind "Another book", which is where the shelf you've finished is.
 */
function bookChipsHtml(store) {
  const reading = readingNow(store);
  const active = effectiveBookId(store);
  const chip = (id, label, sub) => `
    <button type="button" class="book-chip ${active === id ? "on" : ""}"
            data-book-chip="${id === null ? "" : escapeHtml(id)}" aria-pressed="${active === id}">
      <span class="book-chip-title">${escapeHtml(label)}</span>
      ${sub ? `<span class="book-chip-sub">${escapeHtml(sub)}</span>` : ""}
    </button>
  `;

  const chips = reading.map((b) => chip(b.id, b.title, b.creator || ""));
  // Whatever is currently chosen but isn't a reading book still needs to show
  // as selected — otherwise picking an older book from the sheet looks like it
  // did nothing.
  const chosenBook = active ? bookById(store, active) : null;
  if (chosenBook && !reading.some((b) => b.id === active)) {
    chips.push(chip(chosenBook.id, chosenBook.title, chosenBook.creator || ""));
  }
  chips.push(chip(null, "Unfiled", "No book"));

  return `
    <p class="cover-picker-label">Save it under</p>
    <div class="book-chips">${chips.join("")}</div>
    <button type="button" class="link-btn" id="otherBookBtn">Another book…</button>
    ${reading.length > 1 && chosenBookId === undefined
      ? `<p class="folder-hint">You're reading ${reading.length} books — this is the one you started most recently.</p>`
      : reading.length === 1 && chosenBookId === undefined
      ? `<p class="folder-hint">Because you're reading it right now.</p>`
      : ""}
  `;
}

function lookupScreenHtml(store) {
  const savedCount = store.itemsByType("word").length;
  return `
    <div class="word-top-row">
      <p class="view-title">Words</p>
      <button class="btn btn-secondary library-btn" id="libraryBtn" type="button">
        <span class="btn-icon">${ICONS.books}</span>
        <span>My words${savedCount ? ` (${savedCount})` : ""}</span>
      </button>
    </div>

    <div class="word-lookup-row">
      <input type="text" id="wordInput" class="search-input" placeholder="Look up a word…"
             autocapitalize="none" autocorrect="off" spellcheck="false"
             enterkeyhint="search" value="${escapeHtml(term)}">
      <button class="btn btn-primary lookup-btn" id="lookupBtn" type="button">Look up</button>
    </div>
    <p class="settings-status ${statusKind}" id="lookupStatus">${escapeHtml(statusText)}</p>

    <div id="lookupResult">${
      result
        ? `
      <div class="word-preview">
        <div class="word-preview-head">
          <span class="word-term">${escapeHtml(result.word)}</span>
          ${result.pronunciation ? `<span class="word-ipa">${escapeHtml(result.pronunciation)}</span>` : ""}
        </div>
        ${sensesHtml(result)}
        ${result.sourceUrl
          ? `<a class="word-source" href="${escapeHtml(result.sourceUrl)}" target="_blank" rel="noopener">Full entry on Wiktionary</a>`
          : ""}
      </div>
      ${bookChipsHtml(store)}
      <button class="btn btn-primary block-btn" id="saveWordBtn" type="button">Save this word</button>
      <button class="link-btn" id="ownDefBtn" type="button">Write the meaning myself instead</button>
    `
        : `
      <div class="lookup-idle">
        <span class="empty-icon">${ICONS.words}</span>
        <p class="empty-text">${
          savedCount
            ? "Type a word to look it up. It'll be filed under whatever you're reading."
            : "Type a word you don't know. The meaning comes back, and it's saved under the book you're reading."
        }</p>
        <button class="link-btn" id="ownDefBtn" type="button">Add one with my own meaning</button>
      </div>
    `
    }</div>
  `;
}

function wireLookupScreen(wrap, store, container) {
  const input = wrap.querySelector("#wordInput");
  const status = wrap.querySelector("#lookupStatus");

  const redraw = () => render(container, store);

  input.addEventListener("input", () => {
    term = input.value;
    // A definition fetched for one word must not survive into another, or you
    // could look up "serendipity", retype "kismet", and save the second under
    // the first one's meaning.
    if (result && result.word.toLowerCase() !== term.trim().toLowerCase()) {
      result = null;
      statusText = "";
      statusKind = "";
      redraw();
      const fresh = wrap.querySelector("#wordInput") || document.querySelector("#wordInput");
      if (fresh) {
        fresh.focus();
        fresh.setSelectionRange(fresh.value.length, fresh.value.length);
      }
    }
  });
  makeClearable(input, () => {
    term = "";
    result = null;
    statusText = "";
    statusKind = "";
    redraw();
  });

  const doLookup = async () => {
    term = input.value;
    const query = term.trim();
    if (!query) return nudge(input);
    input.blur(); // get the keyboard out of the way of the answer
    statusKind = "";
    statusText = "Looking it up…";
    status.className = "settings-status";
    status.textContent = statusText;
    try {
      const hit = await lookupWord(query);
      if (!hit.found) {
        result = null;
        statusKind = "warn";
        statusText = "No dictionary entry for that. You can still save it with your own meaning.";
      } else {
        result = hit;
        chosenBookId = undefined; // a new word follows the default again
        statusKind = "good";
        statusText = `${hit.senses.length} meaning${hit.senses.length === 1 ? "" : "s"} found.`;
      }
    } catch (err) {
      result = null;
      statusKind = "warn";
      statusText =
        err instanceof WordLookupError ? err.message : "Something went wrong looking that up.";
    }
    redraw();
  };

  const lookupBtn = wrap.querySelector("#lookupBtn");
  lookupBtn.addEventListener("click", () => {
    bounceTap(lookupBtn);
    doLookup();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      doLookup();
    }
  });

  wrap.querySelector("#libraryBtn").addEventListener("click", () => {
    view = "library";
    render(container, store);
  });

  wrap.querySelectorAll("[data-book-chip]").forEach((chip) => {
    chip.addEventListener("click", () => {
      chosenBookId = chip.dataset.bookChip || null;
      redraw();
    });
  });

  const other = wrap.querySelector("#otherBookBtn");
  if (other) other.addEventListener("click", () => {
    openFolderPicker(store, effectiveBookId(store), (id) => {
      chosenBookId = id;
      redraw();
    });
  });

  const ownDef = wrap.querySelector("#ownDefBtn");
  if (ownDef) ownDef.addEventListener("click", () => {
    term = input.value;
    const written = term.trim();
    if (!written) return nudge(input);
    openOwnDefinition(written, (definition) => {
      result = {
        found: true,
        word: written,
        pronunciation: null,
        senses: [{ pos: null, definition, examples: [], synonyms: [] }],
        sourceUrl: null,
      };
      statusKind = "good";
      statusText = "Your own meaning — ready to save.";
      redraw();
    });
  });

  const save = wrap.querySelector("#saveWordBtn");
  if (save) save.addEventListener("click", () => {
    if (!result) return;
    store.addItem({
      type: "word",
      word: result.word,
      // Also as `title`, because the shared sorter breaks ties on it and every
      // other item in the store has one.
      title: result.word,
      lang: "en",
      bookId: effectiveBookId(store),
      senses: result.senses,
      pronunciation: result.pronunciation,
      sourceUrl: result.sourceUrl,
      note: null,
      favourite: false,
      addedDate: today(),
    });
    const where = effectiveBookId(store);
    const book = bookById(store, where);
    confettiBurst();
    // Cleared and ready for the next word — you're usually adding more than one
    // in a sitting, and re-clearing the field by hand each time is friction.
    term = "";
    result = null;
    chosenBookId = undefined;
    statusKind = "good";
    statusText = `Saved${book ? ` under ${book.title}` : " to Unfiled"}.`;
    render(container, store);
  });
}

// ============================================
// the library screen
// ============================================

function getWords(store) {
  let words = store.itemsByType("word");
  if (favesOnly) words = words.filter((w) => w.favourite);
  if (bookFilter === "unfiled") words = words.filter((w) => !w.bookId);
  else if (bookFilter) words = words.filter((w) => w.bookId === bookFilter);

  const q = searchQuery.trim().toLowerCase();
  if (q) {
    words = words.filter(
      (w) =>
        (w.word || "").toLowerCase().includes(q) ||
        (w.senses || []).some((s) => (s.definition || "").toLowerCase().includes(q)) ||
        (w.note || "").toLowerCase().includes(q)
    );
  }
  return sorter.sort(words);
}

function firstDefinition(word) {
  const sense = (word.senses || [])[0];
  return sense ? sense.definition : word.note || "";
}

function buildCard(store, word, onTap) {
  const card = document.createElement("button");
  card.className = "word-card";
  card.type = "button";
  const sense = (word.senses || [])[0];
  const meta = [sense && sense.pos, word.pronunciation].filter(Boolean).join(" · ");

  card.innerHTML = `
    <div class="word-card-head">
      <span class="word-term">${escapeHtml(word.word)}</span>
      ${word.favourite ? `<span class="word-fave-mark">${ICONS.heart}</span>` : ""}
    </div>
    ${meta ? `<p class="word-meta">${escapeHtml(meta)}</p>` : ""}
    <p class="word-def">${escapeHtml(firstDefinition(word))}</p>
    <p class="word-from">${escapeHtml(folderName(store, word))}</p>
  `;
  card.addEventListener("click", () => {
    bounceTap(card);
    onTap(word);
  });
  return card;
}

function renderLibraryBody(bodyHolder, store, container) {
  const words = getWords(store);
  bodyHolder.innerHTML = "";

  if (!words.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const has = store.itemsByType("word").length;
    empty.innerHTML = `
      <span class="empty-icon">${ICONS.words}</span>
      <p class="empty-text">${
        searchQuery.trim()
          ? "No words match that."
          : favesOnly
          ? "No favourites yet — tap the heart on a word you want to keep close."
          : has
          ? "Nothing filed here yet."
          : "No words saved yet. Look one up to start."
      }</p>
    `;
    bodyHolder.appendChild(empty);
    return;
  }

  const open = (w) => openDetail(w, store, container);

  if (groupByBook && !bookFilter) {
    // A LIST OF BOOKS, not every word under a set of headings. The previous
    // version printed the whole flat list with dividers in it, which is not
    // grouping — it's the same wall of words plus more scrolling. Tap a book
    // to open its words.
    const groups = new Map();
    words.forEach((w) => {
      const key = w.bookId || "unfiled";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(w);
    });
    const keys = [...groups.keys()].sort((a, b) => {
      if (a === "unfiled") return 1;   // the leftovers pile goes last
      if (b === "unfiled") return -1;
      return collator.compare(
        (bookById(store, a) || {}).title || "",
        (bookById(store, b) || {}).title || ""
      );
    });

    const list = document.createElement("div");
    list.className = "book-word-list";
    keys.forEach((key) => {
      const entries = groups.get(key);
      const book = key === "unfiled" ? null : bookById(store, key);
      const row = document.createElement("button");
      row.className = "book-word-row";
      row.type = "button";
      // A couple of the words themselves, so the row says something about the
      // book rather than just counting it.
      const peek = entries.slice(0, 3).map((w) => w.word).join(" · ");
      row.innerHTML = `
        <span class="bwr-main">
          <span class="bwr-title">${escapeHtml(book ? book.title : "Unfiled")}</span>
          ${book && book.creator ? `<span class="bwr-sub">${escapeHtml(book.creator)}</span>` : ""}
          <span class="bwr-peek">${escapeHtml(peek)}</span>
        </span>
        <span class="bwr-count">${entries.length}</span>
      `;
      row.addEventListener("click", () => {
        bounceTap(row);
        bookFilter = key;
        render(container, store);
      });
      list.appendChild(row);
    });
    bodyHolder.appendChild(list);
    return;
  }

  const grid = document.createElement("div");
  grid.className = "word-grid";
  words.forEach((w) => grid.appendChild(buildCard(store, w, open)));
  bodyHolder.appendChild(grid);
}

function renderLibrary(wrap, store, container) {
  const title = document.createElement("p");
  title.className = "view-title";
  title.textContent = favesOnly
    ? "Favourite words"
    : bookFilter === "unfiled"
    ? "Unfiled words"
    : bookFilter
    ? `From ${(bookById(store, bookFilter) || {}).title || "a book"}`
    : "My words";
  wrap.appendChild(title);

  const back = document.createElement("button");
  back.className = "back-chip";
  back.textContent = bookFilter ? "← All words" : "← Look up a word";
  back.addEventListener("click", () => {
    if (bookFilter) bookFilter = null;
    else view = "lookup";
    render(container, store);
  });
  wrap.appendChild(back);

  const searchRow = document.createElement("div");
  searchRow.className = "search-row";
  searchRow.innerHTML = `
    <input type="text" class="search-input" id="wordSearch" placeholder="Search saved words..." value="${escapeHtml(searchQuery)}">
    <button class="icon-btn ${sorter.isDefault ? "" : "on"}" id="wordSortBtn" type="button" aria-label="Sort">${ICONS.sort}</button>
    <button class="icon-btn ${groupByBook ? "on" : ""}" id="wordGroupBtn" type="button"
            aria-label="Group by book" aria-pressed="${groupByBook}">${ICONS.books}</button>
    <button class="icon-btn ${favesOnly ? "on" : ""}" id="wordFaveBtn" type="button"
            aria-label="Favourites" aria-pressed="${favesOnly}">${ICONS.heart}</button>
  `;
  wrap.appendChild(searchRow);

  if (!sorter.isDefault) {
    const note = document.createElement("p");
    note.className = "sort-note";
    note.textContent = `Sorted by ${sorter.label()}`;
    wrap.appendChild(note);
  }

  const bodyHolder = document.createElement("div");
  wrap.appendChild(bodyHolder);

  // appended by the caller; wiring happens after it's in the document
  return () => {
    const searchInput = wrap.querySelector("#wordSearch");
    const runSearch = debounce(() => renderLibraryBody(bodyHolder, store, container), 180);
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      runSearch();
    });
    makeClearable(searchInput, () => {
      searchQuery = "";
      renderLibraryBody(bodyHolder, store, container);
    });
    wrap.querySelector("#wordSortBtn").addEventListener("click", () => {
      openSortSheet(sorter, () => render(container, store));
    });
    wrap.querySelector("#wordGroupBtn").addEventListener("click", () => {
      groupByBook = !groupByBook;
      render(container, store);
    });
    wrap.querySelector("#wordFaveBtn").addEventListener("click", () => {
      favesOnly = !favesOnly;
      render(container, store);
    });
    renderLibraryBody(bodyHolder, store, container);
  };
}

// ============================================

function render(container, store, opts) {
  // Arriving from the menu starts at the lookup with a clean slate; an
  // internal redraw keeps whatever you were doing.
  if (opts !== undefined) {
    view = "lookup";
    term = "";
    result = null;
    statusText = "";
    statusKind = "";
    chosenBookId = undefined;
    sorter.reset();
    favesOnly = false;
    bookFilter = null;
    groupByBook = false;
    searchQuery = "";

    // Arrived from a book's detail sheet ("View all 12 words") — open straight
    // onto that book's words rather than the lookup.
    if (opts.bookId) {
      view = "library";
      bookFilter = opts.bookId;
    }
  }

  const wrap = document.createElement("div");
  wrap.className = "words-screen";

  if (view === "lookup") {
    wrap.innerHTML = lookupScreenHtml(store);
    container.innerHTML = "";
    container.appendChild(wrap);
    wireLookupScreen(wrap, store, container);
    return;
  }

  const finishWiring = renderLibrary(wrap, store, container);
  container.innerHTML = "";
  container.appendChild(wrap);
  finishWiring();
}

// ---------- pickers ----------

/**
 * Any book on the shelf, grouped by where it stands.
 *
 * Reading now first because that's almost always the answer; finished books
 * next, because a word you're only now looking up often came from something
 * you read last month.
 */
function openFolderPicker(store, currentId, onPick) {
  openOverlay("cover-picker-backdrop", (overlay) => {
    const books = store.itemsByType("book");
    const SECTIONS = [
      { label: "Reading now", match: (b) => b.readingStatus === "reading" },
      { label: "Read before", match: (b) => b.readingStatus === "read" },
      { label: "Not started", match: (b) => b.readingStatus !== "reading" && b.readingStatus !== "read" },
    ];

    const sectionsHtml = SECTIONS.map(({ label, match }) => {
      const rows = books.filter(match);
      if (!rows.length) return "";
      return `
        <p class="shelf-section-title">${label}</p>
        <div class="tp-list">
          ${rows
            .map(
              (b) => `
            <button type="button" class="tp-row ${currentId === b.id ? "on" : ""}" data-book="${escapeHtml(b.id)}">
              <span class="tp-main">${escapeHtml(b.title)}</span>
              <span class="tp-sub">${escapeHtml(b.creator || "")}</span>
            </button>
          `
            )
            .join("")}
        </div>
      `;
    }).join("");

    overlay.innerHTML = `
      <div class="cover-picker">
        <div class="cover-picker-head">
          <h2>Save it under</h2>
          <button class="lightbox-close" id="fpClose" type="button" aria-label="Close"><span class="btn-icon">${ICONS.close}</span></button>
        </div>
        <div class="tp-list">
          <button type="button" class="tp-row ${!currentId ? "on" : ""}" data-book="">
            <span class="tp-main">Unfiled</span>
            <span class="tp-sub">Not tied to a book</span>
          </button>
        </div>
        ${sectionsHtml}
        ${books.length ? "" : `<p class="cp-note">No books on your shelf yet — words sit in Unfiled until there are.</p>`}
      </div>
    `;
    overlay.addEventListener("click", (e) => { if (e.target === overlay) dismissLayer(); });
    overlay.querySelector("#fpClose").addEventListener("click", () => dismissLayer());
    overlay.querySelectorAll("[data-book]").forEach((btn) => {
      btn.addEventListener("click", () => {
        dismissLayer();
        onPick(btn.dataset.book || null);
      });
    });
  });
}

/** Writing your own meaning — for words the dictionary doesn't carry. */
function openOwnDefinition(word, onSave, existing = "") {
  openOverlay("cover-picker-backdrop", (overlay) => {
    overlay.innerHTML = `
      <div class="cover-picker">
        <div class="cover-picker-head">
          <h2>${escapeHtml(word)}</h2>
          <button class="lightbox-close" id="odClose" type="button" aria-label="Close"><span class="btn-icon">${ICONS.close}</span></button>
        </div>
        <p class="cover-picker-label">What does it mean?</p>
        <textarea id="odInput" class="review-input" rows="4"
                  placeholder="In your own words…">${escapeHtml(existing)}</textarea>
        <button class="btn btn-primary block-btn" id="odSave" type="button">Save meaning</button>
      </div>
    `;
    overlay.addEventListener("click", (e) => { if (e.target === overlay) dismissLayer(); });
    overlay.querySelector("#odClose").addEventListener("click", () => dismissLayer());
    const input = overlay.querySelector("#odInput");
    setTimeout(() => input.focus(), 60);
    overlay.querySelector("#odSave").addEventListener("click", () => {
      const text = input.value.trim();
      if (!text) return nudge(input);
      dismissLayer();
      onSave(text);
    });
  });
}

// ---------- one word ----------

function openDetail(word, store, container) {
  openModal((sheet) => {
    const draw = () => {
      const fresh = store.get().items.find((it) => it.id === word.id) || word;
      sheet.innerHTML = `
        <div class="detail-top-row">
          <h2>${escapeHtml(fresh.word)}</h2>
          <button class="icon-btn detail-fave ${fresh.favourite ? "on" : ""}" id="wFaveBtn" type="button"
                  aria-pressed="${!!fresh.favourite}" aria-label="Favourite">${ICONS.heart}</button>
        </div>
        ${fresh.pronunciation ? `<p class="word-ipa detail-meta">${escapeHtml(fresh.pronunciation)}</p>` : ""}

        <div class="word-senses">${sensesHtml(fresh)}</div>

        ${fresh.sourceUrl
          ? `<a class="word-source" href="${escapeHtml(fresh.sourceUrl)}" target="_blank" rel="noopener">Full entry on Wiktionary</a>`
          : ""}

        <div class="review-block">
          <div class="review-head">
            <span class="review-title">Your note</span>
            <button class="mini-edit" id="wNoteBtn" type="button" aria-label="Edit note"><span class="btn-icon">${ICONS.edit}</span></button>
          </div>
          ${fresh.note
            ? `<p class="review-text">${escapeHtml(fresh.note)}</p>`
            : `<p class="review-empty">Nothing noted — where you met it, how it was used.</p>`}
        </div>

        <p class="cover-picker-label">Filed under</p>
        <button class="folder-chip" id="wFolderChip" type="button">
          <span class="folder-chip-name">${escapeHtml(folderName(store, fresh))}</span>
          <span class="folder-chip-change">Change</span>
        </button>

        <p class="word-added">Added ${escapeHtml(fresh.addedDate || "")}</p>

        <div class="track-actions">
          <button class="link-btn" id="wRelookup" type="button">${
            (fresh.senses || []).length ? "Look it up again" : "Look it up"
          }</button>
          <button class="link-btn danger-btn" id="wDelete" type="button">Remove</button>
        </div>
      `;

      sheet.querySelector("#wFaveBtn").addEventListener("click", () => {
        const btn = sheet.querySelector("#wFaveBtn");
        bounceTap(btn);
        store.updateItem(fresh.id, { favourite: !fresh.favourite });
        draw();
        render(container, store);
      });

      sheet.querySelector("#wNoteBtn").addEventListener("click", () => {
        openOwnDefinition(fresh.word, (text) => {
          store.updateItem(fresh.id, { note: text });
          draw();
        }, fresh.note || "");
      });

      sheet.querySelector("#wFolderChip").addEventListener("click", () => {
        openFolderPicker(store, fresh.bookId, (id) => {
          store.updateItem(fresh.id, { bookId: id });
          draw();
          render(container, store);
        });
      });

      sheet.querySelector("#wRelookup").addEventListener("click", async () => {
        const btn = sheet.querySelector("#wRelookup");
        btn.disabled = true;
        const original = btn.textContent;
        btn.textContent = "Looking…";
        try {
          const hit = await lookupWord(fresh.word);
          if (hit.found) {
            store.updateItem(fresh.id, {
              senses: hit.senses,
              pronunciation: hit.pronunciation,
              sourceUrl: hit.sourceUrl,
            });
            draw();
            return;
          }
          btn.textContent = "No entry found";
        } catch (err) {
          btn.textContent = "Couldn't reach the dictionary";
        }
        btn.disabled = false;
        setTimeout(() => { btn.textContent = original; }, 2600);
      });

      sheet.querySelector("#wDelete").addEventListener("click", () => {
        store.removeItem(fresh.id);
        dismissLayer();
        render(container, store);
      });
    };
    draw();
  });
}

// No openAddForm on purpose: the lookup IS the way in, so the header's + would
// be a second door to the same room.
export default { render };
