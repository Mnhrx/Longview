// ============================================
// Books module — to-read / reading / read, grouped by author or searched,
// with a Book -> Copies model, real covers, price-check links, and a
// barcode scanner with a view/edit split on the detail screen.
// ============================================

import { openModal, closeModal, escapeHtml } from "./ui.js";
import { confettiBurst, bounceTap, nudge, staggerIn } from "./animations.js";
import { uid } from "./core.js";
import { isScanSupported, startScanner, lookupIsbn, lookupGoogleBooksPrice, coverUrl } from "./barcode.js";

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
function loanedCopies(book) {
  return (book.copies || []).filter((c) => c.currentLoan);
}
function hasLoan(book) {
  return loanedCopies(book).length > 0;
}
function isOwned(book) {
  return (book.copies || []).length > 0;
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
    <button class="scan-btn" id="scanBtn" type="button" aria-label="Scan barcode">📷</button>
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
    empty.innerHTML = `<div class="empty-state-emoji">✍️</div><p>No authors yet</p>`;
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
  staggerIn(grid.querySelectorAll(".author-btn"));
}

// ---------- cards ----------

function renderBookGrid(container, books, onTap) {
  if (books.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `<div class="empty-state-emoji">🗂️</div><p>No books match — tap 📷 or + to add one</p>`;
    container.appendChild(empty);
    return;
  }
  const grid = document.createElement("div");
  grid.className = "card-grid";
  books.forEach((book) => grid.appendChild(buildBookCard(book, onTap)));
  container.appendChild(grid);
  staggerIn(grid.querySelectorAll(".item-card"));
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
    ? `<span class="swatch-emoji">📖</span><img class="swatch-img" alt="">`
    : `📖`;

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
    img.src = coverUrl(book.isbn, "S");
  }

  return card;
}

// ---------- shared cover block (detail view, scan-match, add form) ----------

function coverBlockHtml(book) {
  return `
    <div class="detail-cover-wrap">
      <img class="detail-cover" id="coverImg" alt="">
      <div class="detail-cover-fallback ${book.isbn ? "shimmer" : ""}" id="coverFallback" style="background:${book.color || "#eee"}">📖</div>
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
        <div class="lightbox-fallback shimmer" id="lightboxFallback" style="background:${book.color || "#eee"}">📖</div>
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
  const blackwells = `https://www.google.com/search?q=site:blackwells.co.uk+${q}`;
  return `
    <div class="price-links">
      <a class="price-link" href="${kino}" target="_blank" rel="noopener">Check Kinokuniya</a>
      <a class="price-link" href="${blackwells}" target="_blank" rel="noopener">Check Blackwell's</a>
    </div>
    <p class="google-price-note" id="googlePriceNote"></p>
  `;
}
async function wirePriceNote(sheet, book) {
  const note = sheet.querySelector("#googlePriceNote");
  if (!note || !book.isbn) return;
  const price = await lookupGoogleBooksPrice(book.isbn);
  if (price) note.textContent = `Google Books lists this around ${price.currency} ${price.amount}`;
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

      if (mode === "view") wireViewMode(sheet, book, store, container);
      else wireEditMode(sheet, book, store, container);
    }

    draw();
  });
}

function viewModeHtml(book, opts) {
  const copies = book.copies || [];
  const owned = copies.length > 0;

  return `
    ${opts.foundViaScan ? `<div class="found-banner"><span>📖 Already in your library</span></div>` : ""}
    <div class="detail-top-row">
      <h2>${escapeHtml(book.title)}</h2>
      <button class="edit-toggle-btn" id="toggleEditBtn" type="button">✏️ Edit</button>
    </div>
    ${book.isbn ? `
      <div class="cover-tap-target" id="coverTapTarget">
        ${coverBlockHtml(book)}
        <span class="cover-zoom-badge">🔍</span>
      </div>
    ` : coverBlockHtml(book)}
    <p class="detail-author">${escapeHtml(book.creator || "Unknown author")}</p>

    <div class="status-toggle-row" id="statusToggleRow">
      ${["to-read", "reading", "read"].map((s) => `
        <button type="button" class="status-toggle-btn ${s} ${book.readingStatus === s ? "active " + s : ""}" data-status="${s}">${STATUS_LABELS[s]}</button>
      `).join("")}
    </div>

    ${owned ? `
      <div class="copies-section">
        <p class="copies-heading">Your Copies (${copies.length})</p>
        ${copies.map((c) => buildCopyRow(c)).join("")}
        <button class="add-copy-btn" id="addCopyBtn" type="button">+ Add another copy</button>
      </div>
    ` : `
      <div class="status-pill status-to-read" style="margin-bottom:10px;">Wishlist${book.price != null ? ` · $${Number(book.price).toFixed(2)}` : ""}</div>
      ${priceLinksHtml(book)}
      <button class="btn btn-secondary" id="gotCopyBtn" type="button" style="margin-top:14px;">I got a copy — mark as owned</button>
    `}
  `;
}

function editModeHtml(book) {
  const owned = isOwned(book);
  return `
    <div class="detail-top-row">
      <h2>Edit Details</h2>
      <button class="edit-toggle-btn" id="toggleEditBtn" type="button">👁️ View</button>
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

function wireViewMode(sheet, book, store, container) {
  wireCover(sheet, book);
  wirePriceNote(sheet, book);

  const coverTapTarget = sheet.querySelector("#coverTapTarget");
  if (coverTapTarget) {
    coverTapTarget.addEventListener("click", () => openCoverLightbox(book));
  }

  sheet.querySelectorAll(".status-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const wasRead = book.readingStatus === "read";
      const newStatus = btn.dataset.status;
      store.updateItem(book.id, { readingStatus: newStatus });
      reopenDetail(store, container, book.id);
      if (!wasRead && newStatus === "read") {
        confettiBurst(window.innerWidth / 2, window.innerHeight / 2);
      }
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

    if (confirmBtn) {
      confirmBtn.addEventListener("click", () => {
        const lentTo = row.querySelector(".lend-to-input").value.trim();
        if (!lentTo) {
          nudge(row.querySelector(".lend-to-input"));
          return;
        }
        const dueDate = row.querySelector(".due-date-input").value || null;
        const updatedCopies = copies.map((cc) =>
          cc.id === c.id ? { ...cc, currentLoan: { lentTo, lentDate: today(), dueDate } } : cc
        );
        store.updateItem(book.id, { copies: updatedCopies });
        reopenDetail(store, container, book.id);
      });
    }

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
    if (priceInput) patch.price = parseFloat(priceInput.value) || null;

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
  return `
    <div class="copy-row" data-copy-id="${copy.id}">
      <div class="copy-status ${onLoan ? "on-loan" : "on-shelf"}">
        ${onLoan
          ? `→ Lent to ${escapeHtml(copy.currentLoan.lentTo)} since ${copy.currentLoan.lentDate}${copy.currentLoan.dueDate ? ` · due ${copy.currentLoan.dueDate}` : ""}`
          : `On your shelf since ${copy.acquiredDate}`}
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
          <input type="date" class="due-date-input">
          <button class="btn btn-primary confirm-lend" type="button" style="margin-top:2px;">Confirm Loan</button>
        </div>
      ` : ""}
    </div>
  `;
}

// ---------- scan-match confirmation ----------

function openScanMatch(book, store, container) {
  openModal((sheet) => {
    const copies = book.copies || [];
    sheet.innerHTML = `
      <h2 style="text-align:center;">Found it!</h2>
      ${coverBlockHtml(book)}
      <p class="scan-match-title">${escapeHtml(book.title)}</p>
      <p class="scan-match-sub">${escapeHtml(book.creator || "")} · ${copies.length} cop${copies.length === 1 ? "y" : "ies"} in your library</p>
      <div class="btn-row" style="flex-direction:column;">
        <button class="btn btn-primary" id="addCopyMatchBtn" type="button">+ Add Another Copy</button>
        <button class="btn btn-secondary" id="viewDetailsBtn" type="button">View Details</button>
      </div>
    `;
    wireCover(sheet, book);

    sheet.querySelector("#addCopyMatchBtn").addEventListener("click", () => {
      const newCopy = { id: uid(), acquiredDate: today(), currentLoan: null, history: [] };
      store.updateItem(book.id, { copies: [...copies, newCopy] });
      reopenDetail(store, container, book.id);
    });
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
      ${prefill.isbn ? coverBlockHtml({ isbn: prefill.isbn, color: "#eee" }) : ""}
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
        <input type="text" id="a-isbn" placeholder="9780099448822" value="${escapeHtml(prefill.isbn || "")}">
      </div>
      <div class="field">
        <label>Reading Status</label>
        <select id="a-status">
          <option value="to-read">To Read</option>
          <option value="reading">Reading</option>
          <option value="read">Read</option>
        </select>
      </div>
      <div class="field">
        <label>Do you own a copy?</label>
        <select id="a-owned">
          <option value="yes">Yes, I own it</option>
          <option value="no">No — on my wishlist</option>
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

    if (prefill.isbn) wireCover(sheet, { isbn: prefill.isbn });

    const ownedSel = sheet.querySelector("#a-owned");
    const priceField = sheet.querySelector("#a-price-field");
    ownedSel.addEventListener("change", () => {
      priceField.style.display = ownedSel.value === "no" ? "" : "none";
    });

    sheet.querySelector("#addSaveBtn").addEventListener("click", () => {
      const titleInput = sheet.querySelector("#a-title");
      if (!titleInput.value.trim()) {
        nudge(titleInput);
        return;
      }
      const owned = ownedSel.value === "yes";
      const copies = owned ? [{ id: uid(), acquiredDate: today(), currentLoan: null, history: [] }] : [];

      store.addItem({
        type: "book",
        title: titleInput.value.trim(),
        creator: sheet.querySelector("#a-creator").value.trim(),
        isbn: sheet.querySelector("#a-isbn").value.trim() || null,
        readingStatus: sheet.querySelector("#a-status").value,
        price: owned ? null : parseFloat(sheet.querySelector("#a-price").value) || null,
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
          <span class="scan-zoom-label">🔍 Zoom</span>
          <input type="range" id="zoomSlider" min="1" max="5" step="0.1" value="1">
          <button class="torch-btn hidden" id="torchBtn" type="button">🔦</button>
        </div>
      </div>
      <p class="scan-hint" id="scanHint">Point your camera at the barcode on the back of the book.</p>
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
