// ============================================
// Books module — to-read / reading / read, grouped by author or searched,
// with a Book -> Copies model, real covers, price-check links, and a
// barcode scanner with a view/edit split on the detail screen.
// ============================================

import { openModal, closeModal, escapeHtml } from "./ui.js";
import { confettiBurst, bounceTap, nudge } from "./animations.js";
import { uid } from "./core.js";
import { isScanSupported, startScanner, lookupIsbn, lookupGoogleBooksPrice, coverUrl } from "./barcode.js";
import { ICONS } from "./icons.js";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "to-read", label: "To Read" },
  { key: "reading", label: "Reading" },
  { key: "read", label: "Read" },
  { key: "lent-out", label: "Lent Out" },
];

const STATUS_LABELS = { "to-read": "To Read", reading: "Reading", read: "Read" };

let activeFilter = "all";
let viewMode = "list"; // 'list' | 'authors'
let authorFilter = null;
let searchQuery = "";

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

/** Whole days between two YYYY-MM-DD strings, counting both ends
 *  (finishing the same day you started reads as "1 day", not "0"). */
function daysBetween(startStr, endStr) {
  if (!startStr || !endStr) return null;
  const a = new Date(startStr + "T00:00:00");
  const b = new Date(endStr + "T00:00:00");
  if (isNaN(a) || isNaN(b)) return null;
  const diff = Math.round((b - a) / 86400000);
  return diff < 0 ? null : diff + 1;
}

function daysLabel(n) {
  if (n == null) return "";
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

function getBooks(store) {
  let books = store.itemsByType("book");
  if (authorFilter) books = books.filter((b) => (b.creator || "Unknown") === authorFilter);
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    books = books.filter(
      (b) => b.title.toLowerCase().includes(q) || (b.creator || "").toLowerCase().includes(q)
    );
  }
  if (activeFilter !== "all") {
    books = activeFilter === "lent-out"
      ? books.filter(hasLoan)
      : books.filter((b) => b.readingStatus === activeFilter);
  }
  return books;
}

// ---------- main render ----------

function render(container, store) {
  const wrap = document.createElement("div");

  const title = document.createElement("p");
  title.className = "view-title";
  title.textContent = authorFilter ? `Books by ${authorFilter}` : "Books";
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
    <button class="scan-btn" id="scanBtn" type="button" aria-label="Scan barcode">${ICONS.camera}</button>
  `;
  wrap.appendChild(searchRow);

  if (!authorFilter) {
    const modeToggle = document.createElement("div");
    modeToggle.className = "mode-toggle";
    modeToggle.innerHTML = `
      <button class="mode-btn ${viewMode === "list" ? "active" : ""}" data-mode="list" type="button">All Books</button>
      <button class="mode-btn ${viewMode === "authors" ? "active" : ""}" data-mode="authors" type="button">By Author</button>
    `;
    wrap.appendChild(modeToggle);
  }

  const bodyHolder = document.createElement("div");
  wrap.appendChild(bodyHolder);

  container.innerHTML = "";
  container.appendChild(wrap);

  wrap.querySelector("#searchInput").addEventListener("input", (e) => {
    searchQuery = e.target.value;
    renderBody(bodyHolder, store, container);
  });
  wrap.querySelector("#scanBtn").addEventListener("click", () => openScanModal(store, container));

  if (!authorFilter) {
    wrap.querySelectorAll(".mode-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        bounceTap(btn);
        viewMode = btn.dataset.mode;
        render(container, store);
      });
    });
  }

  renderBody(bodyHolder, store, container);
}

function renderBody(bodyHolder, store, container) {
  bodyHolder.innerHTML = "";

  if (viewMode === "authors" && !authorFilter) {
    renderAuthorList(bodyHolder, store, container);
    return;
  }

  const filterRow = document.createElement("div");
  filterRow.className = "filter-row";
  FILTERS.forEach((f) => {
    const chip = document.createElement("button");
    chip.className = "filter-chip" + (activeFilter === f.key ? " active" : "");
    chip.textContent = f.label;
    chip.addEventListener("click", () => {
      bounceTap(chip);
      activeFilter = f.key;
      renderBody(bodyHolder, store, container);
    });
    filterRow.appendChild(chip);
  });
  bodyHolder.appendChild(filterRow);

  const listHolder = document.createElement("div");
  bodyHolder.appendChild(listHolder);
  renderBookGrid(listHolder, getBooks(store), (book) => openDetail(book, store, container));
}

function renderAuthorList(bodyHolder, store, container) {
  const books = getBooks(store);
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
      render(container, store);
    });
    grid.appendChild(btn);
  });
  bodyHolder.appendChild(grid);
}

// ---------- cards ----------

function renderBookGrid(container, books, onTap) {
  if (books.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `<div class="empty-state-icon">${ICONS.empty}</div><p>No books match — tap the camera or + to add one</p>`;
    container.appendChild(empty);
    return;
  }
  const grid = document.createElement("div");
  grid.className = "card-grid";
  books.forEach((book) => grid.appendChild(buildBookCard(book, onTap)));
  container.appendChild(grid);
}

function buildBookCard(book, onTap) {
  const card = document.createElement("div");
  card.className = "item-card";
  const owned = isOwned(book);
  const onLoan = loanedCopies(book);

  const pillHtml = owned
    ? `<span class="status-pill status-${book.readingStatus}">${STATUS_LABELS[book.readingStatus] || book.readingStatus}</span>`
    : `<span class="status-pill status-to-read">Wishlist</span>`;

  let extraHtml = "";
  if ((book.copies || []).length > 1) {
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

  const swatchInner = book.isbn
    ? `<span class="swatch-emoji">${ICONS.books}</span><img class="swatch-img" alt="">`
    : ICONS.books;

  card.innerHTML = `
    <div class="item-swatch ${book.isbn ? "shimmer" : ""}" style="background:${book.color || "#eee"}">${swatchInner}</div>
    <div class="item-body">
      <p class="item-title">${escapeHtml(book.title)}</p>
      <p class="item-creator">${escapeHtml(book.creator || "")}</p>
      ${pillHtml}
      ${extraHtml}
    </div>
  `;
  card.addEventListener("click", () => {
    bounceTap(card);
    onTap(book);
  });

  if (book.isbn) {
    const swatch = card.querySelector(".item-swatch");
    const swatchImg = swatch.querySelector(".swatch-img");
    const swatchEmoji = swatch.querySelector(".swatch-emoji");
    const img = new Image();
    img.onload = () => {
      swatchImg.src = img.src;
      swatchImg.classList.add("loaded");
      if (swatchEmoji) swatchEmoji.classList.add("hidden");
      swatch.classList.remove("shimmer");
    };
    img.onerror = () => {
      swatch.classList.remove("shimmer");
    };
    // Request Open Library's largest cover size even for the small card thumbnail —
    // a browser shrinking a big image down looks sharp; stretching the "S" size up to
    // fit a retina-density 52px box is what was causing the blurry/soft covers.
    img.src = coverUrl(book.isbn, "L");
  }

  return card;
}

// ---------- shared cover block (detail view, scan-match, add form) ----------

function coverBlockHtml(book) {
  return `
    <div class="detail-cover-wrap">
      <img class="detail-cover" id="coverImg" alt="">
      <div class="detail-cover-fallback ${book.isbn ? "shimmer" : ""}" id="coverFallback" style="background:${book.color || "#eee"}">${ICONS.books}</div>
    </div>
  `;
}
function wireCover(sheet, book) {
  if (!book.isbn) return;
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
  img.src = coverUrl(book.isbn, "L");
}

// Opens a fullscreen lightbox of the front cover. Open Library (our free
// cover source) only reliably has front covers, so this is front-only —
// the caption says so rather than pretending a back cover exists.
function openCoverLightbox(book) {
  const overlay = document.createElement("div");
  overlay.className = "lightbox-backdrop";
  overlay.innerHTML = `
    <button class="lightbox-close" type="button" aria-label="Close">✕</button>
    <div class="lightbox-content">
      <div class="lightbox-cover-wrap">
        <img class="lightbox-img" id="lightboxImg" alt="${escapeHtml(book.title)} cover">
        <div class="lightbox-fallback shimmer" id="lightboxFallback" style="background:${book.color || "#eee"}">${ICONS.books}</div>
      </div>
      <p class="lightbox-caption" id="lightboxCaption">Front cover</p>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector(".lightbox-close").addEventListener("click", close);

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
  img.src = coverUrl(book.isbn, "L");
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


// ---------- detail modal: view mode + edit mode ----------

function openDetail(book, store, container, opts = {}) {
  let mode = "view";

  openModal((sheet) => {
    function draw() {
      sheet.innerHTML = mode === "view" ? viewModeHtml(book, opts) : editModeHtml(book);

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
  });
}

function viewModeHtml(book, opts) {
  const copies = book.copies || [];
  const owned = copies.length > 0;

  return `
    ${opts.foundViaScan ? `<div class="found-banner"><span>Already in your library</span></div>` : ""}
    <div class="detail-top-row">
      <h2>${escapeHtml(book.title)}</h2>
      <button class="edit-toggle-btn" id="toggleEditBtn" type="button"><span class="btn-icon">${ICONS.edit}</span>Edit</button>
    </div>
    ${book.isbn ? `
      <div class="cover-tap-target" id="coverTapTarget">
        ${coverBlockHtml(book)}
        <span class="cover-zoom-badge">${ICONS.zoom}</span>
      </div>
    ` : coverBlockHtml(book)}
    <p class="detail-author">${escapeHtml(book.creator || "Unknown author")}</p>

    <div class="status-toggle-row" id="statusToggleRow">
      ${["to-read", "reading", "read"].map((s) => `
        <button type="button" class="status-toggle-btn ${s} ${book.readingStatus === s ? "active " + s : ""}" data-status="${s}">${STATUS_LABELS[s]}</button>
      `).join("")}
    </div>

    ${readingDatesHtml(book)}

    ${owned ? `
      <div class="copies-section">
        <p class="copies-heading">Your Copies (${copies.length})</p>
        ${copies.map((c) => buildCopyRow(c)).join("")}
        <button class="add-copy-btn" id="addCopyBtn" type="button">+ Add another copy</button>
      </div>
    ` : `
      <div class="status-pill status-to-read" style="margin-bottom:6px;">Wishlist${book.price != null ? ` · $${Number(book.price).toFixed(2)}` : ""}</div>
      ${book.price != null && book.priceCheckedDate ? `<p class="price-checked-note">You checked this price on ${fmtDate(book.priceCheckedDate)}</p>` : ""}
      ${priceLinksHtml(book)}
      <button class="btn btn-secondary" id="gotCopyBtn" type="button" style="margin-top:14px;">I got a copy — mark as owned</button>
    `}
  `;
}

/** Reading-dates block: a summary line plus always-editable date inputs.
 *  Shown once a book is Reading or Read — a to-read book has nothing to date yet. */
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
    </div>
    <div class="field">
      <label>ISBN</label>
      <input type="text" id="f-isbn" placeholder="9780099448822" value="${escapeHtml(book.isbn || "")}">
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
      reopenDetail(store, container, book.id);
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
    if (!input) return;
    input.addEventListener("change", () => {
      store.updateItem(book.id, {
        startedDate: startedInput.value || null,
        finishedDate: finishedInput.value || null,
      });
      reopenDetail(store, container, book.id);
    });
  });

  const gotCopyBtn = sheet.querySelector("#gotCopyBtn");
  if (gotCopyBtn) {
    gotCopyBtn.addEventListener("click", () => {
      const newCopy = { id: uid(), acquiredDate: today(), currentLoan: null, history: [] };
      store.updateItem(book.id, { copies: [...(book.copies || []), newCopy], price: null });
      reopenDetail(store, container, book.id);
    });
  }

  const addCopyBtn = sheet.querySelector("#addCopyBtn");
  if (addCopyBtn) {
    addCopyBtn.addEventListener("click", () => {
      const newCopy = { id: uid(), acquiredDate: today(), currentLoan: null, history: [] };
      store.updateItem(book.id, { copies: [...(book.copies || []), newCopy] });
      reopenDetail(store, container, book.id);
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
        const dueDate = row.querySelector(".due-date-input").value || null;
        const updatedCopies = copies.map((cc) =>
          cc.id === c.id ? { ...cc, currentLoan: { lentTo, lentDate, dueDate } } : cc
        );
        store.updateItem(book.id, { copies: updatedCopies });
        reopenDetail(store, container, book.id);
      });
    }

    // An active loan's borrower and dates stay editable — fix a typo or a
    // wrong start date without having to return and re-lend the copy.
    const loanWho = row.querySelector(".loan-who");
    const loanStart = row.querySelector(".loan-start");
    const loanDue = row.querySelector(".loan-due");
    [loanWho, loanStart, loanDue].forEach((input) => {
      if (!input) return;
      input.addEventListener("change", () => {
        const updatedCopies = copies.map((cc) =>
          cc.id === c.id
            ? {
                ...cc,
                currentLoan: {
                  ...cc.currentLoan,
                  lentTo: loanWho.value.trim() || cc.currentLoan.lentTo,
                  lentDate: loanStart.value || null,
                  dueDate: loanDue.value || null,
                },
              }
            : cc
        );
        store.updateItem(book.id, { copies: updatedCopies });
        reopenDetail(store, container, book.id);
      });
    });

    // When a copy actually joined your shelf is editable — a book bought
    // years ago shouldn't be stamped with the day you happened to add it.
    const acquiredInput = row.querySelector(".copy-acquired");
    if (acquiredInput) {
      acquiredInput.addEventListener("change", () => {
        const updatedCopies = copies.map((cc) =>
          cc.id === c.id ? { ...cc, acquiredDate: acquiredInput.value || null } : cc
        );
        store.updateItem(book.id, { copies: updatedCopies });
        reopenDetail(store, container, book.id);
      });
    }

    // Past loans are editable too, so a return date can be corrected later.
    row.querySelectorAll(".loan-history-row").forEach((histRow) => {
      const idx = Number(histRow.dataset.historyIndex);
      const hStart = histRow.querySelector(".hist-start");
      const hEnd = histRow.querySelector(".hist-end");
      [hStart, hEnd].forEach((input) => {
        if (!input) return;
        input.addEventListener("change", () => {
          const updatedCopies = copies.map((cc) => {
            if (cc.id !== c.id) return cc;
            const hist = [...(cc.history || [])];
            if (!hist[idx]) return cc;
            hist[idx] = { ...hist[idx], lentDate: hStart.value || null, returnedDate: hEnd.value || null };
            return { ...cc, history: hist };
          });
          store.updateItem(book.id, { copies: updatedCopies });
          reopenDetail(store, container, book.id);
        });
      });
    });

    if (returnBtn) {
      returnBtn.addEventListener("click", () => {
        const updatedCopies = copies.map((cc) => {
          if (cc.id !== c.id) return cc;
          const historyEntry = { ...cc.currentLoan, returnedDate: today() };
          return { ...cc, currentLoan: null, history: [...(cc.history || []), historyEntry] };
        });
        store.updateItem(book.id, { copies: updatedCopies });
        reopenDetail(store, container, book.id);
      });
    }

    if (removeBtn) {
      removeBtn.addEventListener("click", () => {
        const updatedCopies = copies.filter((cc) => cc.id !== c.id);
        store.updateItem(book.id, { copies: updatedCopies });
        reopenDetail(store, container, book.id);
      });
    }
  });
}

function wireEditMode(sheet, book, store, container) {
  sheet.querySelector("#saveBtn").addEventListener("click", () => {
    const titleInput = sheet.querySelector("#f-title");
    if (!titleInput.value.trim()) {
      nudge(titleInput);
      return;
    }
    const patch = {
      title: titleInput.value.trim(),
      creator: sheet.querySelector("#f-creator").value,
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
    store.removeItem(book.id);
    closeModal();
    render(container, store);
  });
}

function reopenDetail(store, container, bookId) {
  closeModal();
  render(container, store); // keep the list behind the modal in sync too
  const fresh = store.get().items.find((it) => it.id === bookId);
  if (fresh) openDetail(fresh, store, container);
}

function buildCopyRow(copy) {
  const onLoan = !!copy.currentLoan;
  const loan = copy.currentLoan;
  const out = onLoan ? daysBetween(loan.lentDate, today()) : null;
  const history = copy.history || [];

  return `
    <div class="copy-row" data-copy-id="${copy.id}">
      <div class="copy-status ${onLoan ? "on-loan" : "on-shelf"}">
        ${onLoan
          ? `→ Lent to ${escapeHtml(loan.lentTo)}${out ? ` · out ${daysLabel(out)}` : ""}${loan.dueDate ? ` · due ${fmtDate(loan.dueDate)}` : ""}`
          : `On your shelf since ${fmtDate(copy.acquiredDate)}`}
      </div>

      <div class="date-pair" style="margin-top:8px;">
        <label class="date-field">
          <span>Added to shelf</span>
          <input type="date" class="copy-acquired" value="${copy.acquiredDate || ""}">
        </label>
      </div>

      ${onLoan ? `
        <div class="loan-edit">
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
              <span>Due</span>
              <input type="date" class="loan-due" value="${loan.dueDate || ""}">
            </label>
          </div>
        </div>
      ` : ""}

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
            <label class="date-field">
              <span>Due</span>
              <input type="date" class="due-date-input">
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
    sheet.innerHTML = `
      <h2 style="text-align:center;">Found it!</h2>
      ${coverBlockHtml(book)}
      <p class="scan-match-title">${escapeHtml(book.title)}</p>
      <p class="scan-match-sub">${escapeHtml(book.creator || "")} · ${copies.length} cop${copies.length === 1 ? "y" : "ies"} in your library</p>
      <div class="btn-row" style="flex-direction:column;">
        <button class="btn btn-primary" id="addCopyMatchBtn" type="button">+ Add Another Copy</button>
        ${shelfCopy ? `<button class="btn btn-secondary" id="lendMatchBtn" type="button">Lend It to Someone</button>` : ""}
        <button class="btn btn-secondary" id="viewDetailsBtn" type="button">View Details</button>
      </div>
      ${!shelfCopy && copies.length ? `<p class="scan-match-note">Every copy is already lent out.</p>` : ""}
    `;
    wireCover(sheet, book);

    sheet.querySelector("#addCopyMatchBtn").addEventListener("click", () => {
      const newCopy = { id: uid(), acquiredDate: today(), currentLoan: null, history: [] };
      store.updateItem(book.id, { copies: [...copies, newCopy] });
      reopenDetail(store, container, book.id);
    });

    // Scanning a book you own is often the moment you're handing it to someone —
    // jump straight into the lend form for the first copy still on the shelf.
    const lendBtn = sheet.querySelector("#lendMatchBtn");
    if (lendBtn) {
      lendBtn.addEventListener("click", () => {
        closeModal();
        openDetail(book, store, container, { openLendFor: shelfCopy.id });
      });
    }
    sheet.querySelector("#viewDetailsBtn").addEventListener("click", () => {
      closeModal();
      openDetail(book, store, container);
    });
  });
}

// ---------- add form ----------

function openAddForm(store, container, prefill = {}) {
  openModal((sheet) => {
    sheet.innerHTML = `
      <h2>Add a Book</h2>

      <div class="destination-row" id="destRow">
        <button type="button" class="destination-btn active" data-dest="library">
          <span class="destination-title">Add to Library</span>
          <span class="destination-sub">I own a copy</span>
        </button>
        <button type="button" class="destination-btn" data-dest="wishlist">
          <span class="destination-title">Add to Wishlist</span>
          <span class="destination-sub">Want to buy it</span>
        </button>
      </div>

      <div id="addCoverBlock" class="${prefill.isbn ? "" : "hidden"}">
        ${coverBlockHtml({ isbn: prefill.isbn, color: "#eee" })}
      </div>
      <div class="field">
        <label>Title</label>
        <input type="text" id="a-title" placeholder="Kafka on the Shore" value="${escapeHtml(prefill.title || "")}">
      </div>
      <div class="field">
        <label>Author</label>
        <input type="text" id="a-creator" placeholder="Haruki Murakami" value="${escapeHtml(prefill.creator || "")}">
      </div>
      <div class="field">
        <label>ISBN (optional)</label>
        <input type="text" id="a-isbn" placeholder="9780099448822" inputmode="numeric" value="${escapeHtml(prefill.isbn || "")}">
        <p class="isbn-lookup-status" id="isbnLookupStatus"></p>
      </div>
      <div class="field">
        <label>Reading Status</label>
        <select id="a-status">
          <option value="to-read">To Read</option>
          <option value="reading">Reading</option>
          <option value="read">Read</option>
        </select>
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
    const isbnInput = sheet.querySelector("#a-isbn");
    const isbnStatus = sheet.querySelector("#isbnLookupStatus");
    const titleInput = sheet.querySelector("#a-title");
    const creatorInput = sheet.querySelector("#a-creator");
    const priceInput = sheet.querySelector("#a-price");
    const priceField = sheet.querySelector("#a-price-field");
    const saveBtn = sheet.querySelector("#addSaveBtn");

    if (prefill.isbn) wireCover(sheet, { isbn: prefill.isbn });

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
        saveBtn.textContent = destination === "wishlist" ? "Add to Wishlist" : "Add to Library";
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
        coverBlock.classList.remove("hidden");
        coverBlock.innerHTML = coverBlockHtml({ isbn: raw, color: "#eee" });
        wireCover(sheet, { isbn: raw });
        isbnStatus.textContent = `Found: ${meta.title || "match"}${meta.creator ? " · " + meta.creator : ""}`;
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
      const price = owned ? null : (parseFloat(priceInput.value) || null);
      // Whatever the source (auto-lookup or typed by hand), saving a price now means
      // it's fresh as of today — same "checked on" convention as the edit screen.
      const priceCheckedDate = price != null ? today() : null;

      store.addItem({
        type: "book",
        title: titleInput.value.trim(),
        creator: creatorInput.value.trim(),
        isbn: isbnInput.value.trim() || null,
        readingStatus: sheet.querySelector("#a-status").value,
        price,
        priceCheckedDate,
        color: randomColor(),
        copies,
      });
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
  closeModal();
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

export default { render, openAddForm };
