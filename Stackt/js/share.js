// ============================================
// Share cards — renders a shelf, a book or a record to a PNG you can post.
//
// Everything happens on-device: a <canvas> is drawn, turned into a Blob, and
// handed to the OS share sheet. Nothing is uploaded, and it works offline
// apart from the cover images themselves.
//
// The one real hazard is canvas tainting. Drawing a remote image onto a canvas
// without CORS permission poisons it, and toBlob() then throws a SecurityError
// — you'd get a share button that silently does nothing. So every remote image
// is loaded with crossOrigin="anonymous", and any that refuses is dropped in
// favour of a colour block. See loadImage().
// ============================================

import { openModal, dismissLayer, escapeHtml } from "./ui.js";

const PALETTE = {
  bg: "#FFF8F0",
  ink: "#1A1A2E",
  pink: "#FF3B6B",
  blue: "#3D5AFE",
  yellow: "#FFC738",
  mint: "#00D9A3",
  purple: "#8B5CF6",
  red: "#E8102D",
};

export const FORMATS = {
  square: { key: "square", label: "Square", sub: "1:1 · feed", w: 1080, h: 1080 },
  story: { key: "story", label: "Story", sub: "9:16 · full screen", w: 1080, h: 1920 },
};

const FONT = `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

/**
 * Loads an image for canvas use.
 *
 * Resolves to null rather than rejecting — a missing cover should cost you a
 * colour block, never the whole card. Data URLs (your own photos) are same
 * origin and skip the CORS dance entirely.
 */
function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    if (!src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// ---------- drawing helpers ----------

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** The neubrutalist signature: hard offset shadow, thick border, no blur. */
function panel(ctx, x, y, w, h, fill, { radius = 34, offset = 14, border = 8 } = {}) {
  ctx.fillStyle = PALETTE.ink;
  roundRect(ctx, x + offset, y + offset, w, h, radius);
  ctx.fill();

  ctx.fillStyle = fill;
  roundRect(ctx, x, y, w, h, radius);
  ctx.fill();

  ctx.lineWidth = border;
  ctx.strokeStyle = PALETTE.ink;
  roundRect(ctx, x, y, w, h, radius);
  ctx.stroke();
}

/** object-fit: cover, in canvas terms. */
function drawCover(ctx, img, x, y, w, h, radius) {
  ctx.save();
  roundRect(ctx, x, y, w, h, radius);
  ctx.clip();
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

function artBlock(ctx, img, x, y, w, h, color, radius = 24) {
  if (img) {
    drawCover(ctx, img, x, y, w, h, radius);
  } else {
    ctx.fillStyle = color || PALETTE.pink;
    roundRect(ctx, x, y, w, h, radius);
    ctx.fill();
  }
  ctx.lineWidth = 6;
  ctx.strokeStyle = PALETTE.ink;
  roundRect(ctx, x, y, w, h, radius);
  ctx.stroke();
}

function setFont(ctx, size, weight = 800) {
  ctx.font = `${weight} ${size}px ${FONT}`;
}

/**
 * Wraps text to at most `maxLines`, ellipsising when it runs out of room.
 *
 * The ellipsis matters: a one-line author field silently dropping half a name
 * ("An Author With A Fairly") looks like a rendering bug, not a truncation.
 */
function wrapText(ctx, text, maxWidth, maxLines) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  let used = 0;

  for (const word of words) {
    const next = line ? line + " " + word : word;
    if (ctx.measureText(next).width <= maxWidth || !line) {
      line = next;
      used++;
    } else {
      lines.push(line);
      line = word;
      used++;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);

  const dropped = used < words.length || lines.length < 1;
  if (dropped && lines.length) {
    let last = lines[lines.length - 1];
    while (last.length && ctx.measureText(last + "…").width > maxWidth) {
      last = last.replace(/\s*\S$/, "");
      if (!last) break;
    }
    lines[lines.length - 1] = (last || lines[lines.length - 1]) + "…";
  }
  return lines;
}

function drawLines(ctx, lines, x, y, lineHeight) {
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
  return y + lines.length * lineHeight;
}

function drawStars(ctx, rating, x, y, size, gap = 8) {
  const star = (cx, cy, r, filled) => {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? r : r * 0.45;
      const a = (Math.PI / 5) * i - Math.PI / 2;
      const px = cx + Math.cos(a) * rad;
      const py = cy + Math.sin(a) * rad;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = filled ? PALETTE.yellow : "rgba(26,26,46,0.14)";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = PALETTE.ink;
    ctx.stroke();
  };
  for (let i = 0; i < 5; i++) {
    star(x + size / 2 + i * (size + gap), y + size / 2, size / 2, i < rating);
  }
  return x + 5 * (size + gap);
}

function pill(ctx, text, x, y, bg, fg = PALETTE.ink) {
  setFont(ctx, 30, 800);
  const padX = 26;
  const w = ctx.measureText(text).width + padX * 2;
  const h = 62;
  ctx.fillStyle = bg;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = PALETTE.ink;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.stroke();
  ctx.fillStyle = fg;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + padX, y + h / 2 + 1);
  ctx.textBaseline = "alphabetic";
  return w;
}

/** The wordmark, bottom-left on every card. */
function watermark(ctx, W, H, onDark) {
  setFont(ctx, 40, 900);
  ctx.fillStyle = onDark ? "rgba(255,255,255,0.92)" : PALETTE.ink;
  const label = "Stackt";
  ctx.fillText(label, 84, H - 78);
  ctx.fillStyle = PALETTE.red;
  ctx.fillText(".", 84 + ctx.measureText(label).width, H - 78);
}

/** Paints the ground: the user's photo if they picked one, else the cream. */
async function background(ctx, W, H, photo) {
  if (photo) {
    const img = await loadImage(photo);
    if (img) {
      drawCover(ctx, img, 0, 0, W, H, 0);
      // Without this the text has to compete with whatever's in the photo.
      ctx.fillStyle = "rgba(10,10,25,0.42)";
      ctx.fillRect(0, 0, W, H);
      return true;
    }
  }
  ctx.fillStyle = PALETTE.bg;
  ctx.fillRect(0, 0, W, H);
  return false;
}

// ---------- date + label helpers ----------

function fmt(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function daysBetween(a, b) {
  if (!a || !b) return null;
  const x = new Date(a + "T00:00:00");
  const y = new Date(b + "T00:00:00");
  if (isNaN(x) || isNaN(y)) return null;
  const n = Math.round((y - x) / 86400000);
  return n < 0 ? null : n + 1;
}

/** The one line under an item that says what you did with it and when. */
export function spanLine(item) {
  if (item.startedDate && item.finishedDate) {
    const d = daysBetween(item.startedDate, item.finishedDate);
    return `Read ${fmt(item.startedDate)} – ${fmt(item.finishedDate)}${d ? ` · took ${d} day${d === 1 ? "" : "s"}` : ""}`;
  }
  if (item.startedDate) return `Started ${fmt(item.startedDate)}`;
  if (item.finishedDate) return `Finished ${fmt(item.finishedDate)}`;
  const acquired = (item.copies || [])[0] && item.copies[0].acquiredDate;
  if (acquired) return `In the collection since ${fmt(acquired)}`;
  if (item.borrowed && item.borrowed.borrowedDate) return `Borrowed ${fmt(item.borrowed.borrowedDate)}`;
  return "";
}

// ---------- the cards ----------

/** One book or record: art, title, creator, rating, dates. */
async function renderItemCard(ctx, W, H, { item, coverSrc, photo, kindLabel }) {
  const onPhoto = await background(ctx, W, H, photo);
  const story = H > W;
  const M = 84;
  const cardW = W - M * 2;

  const img = await loadImage(coverSrc);
  const artSize = story ? Math.round(cardW * 0.82) : Math.round(cardW * 0.46);
  const artX = story ? Math.round((W - artSize) / 2) : M + 28;
  const artY = story ? Math.round(H * 0.16) : Math.round((H - artSize) / 2);

  if (!onPhoto) {
    // A soft panel behind everything keeps the neubrutalist frame readable.
    panel(ctx, M - 24, artY - 56, cardW + 48, story ? artSize + 520 : artSize + 112, "#fff");
  }

  artBlock(ctx, img, artX, artY, artSize, artSize, item.color, 28);

  const textX = story ? M : artX + artSize + 48;
  const textW = story ? cardW : W - textX - M - 24;
  let y = story ? artY + artSize + 90 : artY + 18;

  ctx.textAlign = "left";
  ctx.fillStyle = onPhoto ? "#fff" : PALETTE.ink;

  setFont(ctx, story ? 66 : 52, 900);
  y = drawLines(ctx, wrapText(ctx, item.title, textW, 3), textX, y + (story ? 0 : 46), story ? 76 : 60);

  setFont(ctx, story ? 40 : 32, 700);
  ctx.fillStyle = onPhoto ? "rgba(255,255,255,0.85)" : "rgba(26,26,46,0.62)";
  y = drawLines(ctx, wrapText(ctx, item.creator || "", textW, 1), textX, y + 22, 44);

  if (item.rating) {
    y += 34;
    drawStars(ctx, item.rating, textX, y, story ? 52 : 42);
    y += story ? 74 : 60;
  }

  const line = spanLine(item);
  if (line) {
    setFont(ctx, story ? 32 : 26, 700);
    ctx.fillStyle = onPhoto ? "rgba(255,255,255,0.8)" : "rgba(26,26,46,0.55)";
    y = drawLines(ctx, wrapText(ctx, line, textW, 2), textX, y + 12, 40);
  }

  if (kindLabel) {
    pill(ctx, kindLabel, textX, y + 26, PALETTE.yellow);
  }

  watermark(ctx, W, H, onPhoto);
}

/** The review, big, with the cover small alongside. */
async function renderReviewCard(ctx, W, H, { item, coverSrc, photo }) {
  const onPhoto = await background(ctx, W, H, photo);
  const M = 84;
  const cardW = W - M * 2;
  const img = await loadImage(coverSrc);

  const thumb = 190;
  const top = Math.round(H * (H > W ? 0.14 : 0.12));

  if (!onPhoto) panel(ctx, M - 24, top - 48, cardW + 48, H - top - 200, "#fff");

  artBlock(ctx, img, M + 8, top, thumb, thumb, item.color, 22);

  ctx.textAlign = "left";
  ctx.fillStyle = onPhoto ? "#fff" : PALETTE.ink;
  setFont(ctx, 46, 900);
  const headX = M + 8 + thumb + 40;
  const headW = cardW - thumb - 60;
  let y = drawLines(ctx, wrapText(ctx, item.title, headW, 2), headX, top + 58, 54);
  setFont(ctx, 30, 700);
  ctx.fillStyle = onPhoto ? "rgba(255,255,255,0.85)" : "rgba(26,26,46,0.6)";
  drawLines(ctx, wrapText(ctx, item.creator || "", headW, 1), headX, y + 16, 38);

  y = top + thumb + 84;
  if (item.rating) {
    drawStars(ctx, item.rating, M + 8, y, 54);
    y += 96;
  }

  // The quote is the point of this card, so it gets the room.
  ctx.fillStyle = onPhoto ? "#fff" : PALETTE.ink;
  setFont(ctx, H > W ? 52 : 44, 800);
  const maxLines = H > W ? 12 : 7;
  const quote = `“${String(item.review || "").trim()}”`;
  y = drawLines(ctx, wrapText(ctx, quote, cardW - 16, maxLines), M + 8, y + 20, H > W ? 68 : 58);

  const line = spanLine(item);
  if (line) {
    setFont(ctx, 28, 700);
    ctx.fillStyle = onPhoto ? "rgba(255,255,255,0.78)" : "rgba(26,26,46,0.5)";
    drawLines(ctx, wrapText(ctx, line, cardW - 16, 2), M + 8, y + 46, 36);
  }

  watermark(ctx, W, H, onPhoto);
}

/** A mosaic of covers with a count strip. */
async function renderGridCard(ctx, W, H, { items, coverSrcs, photo, title, subtitle }) {
  const onPhoto = await background(ctx, W, H, photo);
  const M = 76;
  const gridW = W - M * 2;

  ctx.textAlign = "left";
  ctx.fillStyle = onPhoto ? "#fff" : PALETTE.ink;
  setFont(ctx, 62, 900);
  let y = Math.round(H * (H > W ? 0.11 : 0.1));
  y = drawLines(ctx, wrapText(ctx, title, gridW, 2), M, y, 72);

  if (subtitle) {
    setFont(ctx, 34, 700);
    ctx.fillStyle = onPhoto ? "rgba(255,255,255,0.85)" : "rgba(26,26,46,0.6)";
    y = drawLines(ctx, wrapText(ctx, subtitle, gridW, 1), M, y + 18, 42);
  }

  // The point of this card is HOW MANY you have, so showing more covers beats
  // showing bigger ones: take the fewest columns that still fits everything,
  // which is also the largest cell size that does. A partial last row is fine —
  // it's centred, so it reads as deliberate rather than as a gap.
  const gap = 20;
  const top = y + 56;
  const availH = H - top - 150; // room for the watermark
  const cap = H > W ? 25 : 16;
  const want = Math.min(items.length, cap);

  let grid = null;
  for (const cols of [2, 3, 4, 5]) {
    const cell = Math.floor((gridW - gap * (cols - 1)) / cols);
    const rows = Math.ceil(want / cols);
    if (rows * cell + (rows - 1) * gap <= availH) {
      grid = { cols, cell, rows, count: want };
      break;
    }
  }
  if (!grid) {
    // Too many to fit even at five across — fill what we can and say so.
    const cols = 5;
    const cell = Math.floor((gridW - gap * (cols - 1)) / cols);
    const rows = Math.max(1, Math.floor((availH + gap) / (cell + gap)));
    grid = { cols, cell, rows, count: Math.min(want, cols * rows) };
  }

  const { cols, cell, rows, count } = grid;
  const gridH = rows * cell + (rows - 1) * gap;
  const gridTop = top + Math.max(0, Math.round((availH - gridH) / 2));

  const imgs = await Promise.all(coverSrcs.slice(0, count).map(loadImage));
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const inRow = Math.min(cols, count - row * cols);
    const rowW = inRow * cell + (inRow - 1) * gap;
    const rowX = M + Math.round((gridW - rowW) / 2); // centres a short last row
    const cx = rowX + (i % cols) * (cell + gap);
    const cy = gridTop + row * (cell + gap);
    artBlock(ctx, imgs[i], cx, cy, cell, cell, items[i].color, 18);
  }

  const more = items.length - count;
  if (more > 0) {
    setFont(ctx, 32, 800);
    ctx.fillStyle = onPhoto ? "rgba(255,255,255,0.85)" : "rgba(26,26,46,0.55)";
    ctx.fillText(`+ ${more} more`, M, gridTop + gridH + 52);
  }

  watermark(ctx, W, H, onPhoto);
}

/** Numbers only — the year-in-review shape. */
async function renderStatsCard(ctx, W, H, { title, stats, photo, accent = PALETTE.mint }) {
  const onPhoto = await background(ctx, W, H, photo);
  const M = 84;
  const cardW = W - M * 2;

  ctx.textAlign = "left";
  ctx.fillStyle = onPhoto ? "#fff" : PALETTE.ink;
  setFont(ctx, 66, 900);
  let y = Math.round(H * (H > W ? 0.13 : 0.12));
  y = drawLines(ctx, wrapText(ctx, title, cardW, 2), M, y, 76);
  y += 40;

  const rowH = H > W ? 190 : 150;
  const gap = 22;
  const shown = stats.slice(0, H > W ? 6 : 4);

  // Centre the stack in what's left, so a short list doesn't hang off the top.
  const blockH = shown.length * rowH + (shown.length - 1) * gap;
  const availH = H - y - 150;
  const top0 = y + Math.max(0, Math.round((availH - blockH) / 2));

  shown.forEach((s, i) => {
    const top = top0 + i * (rowH + gap);
    panel(ctx, M, top, cardW, rowH, i % 2 ? "#fff" : accent, { radius: 28, offset: 10, border: 6 });

    ctx.fillStyle = PALETTE.ink;
    setFont(ctx, H > W ? 78 : 62, 900);
    ctx.fillText(String(s.value), M + 40, top + (H > W ? 100 : 82));

    // Ellipsised rather than hard-sliced, so a long author name says so.
    setFont(ctx, H > W ? 30 : 26, 800);
    ctx.fillStyle = "rgba(26,26,46,0.6)";
    const label = wrapText(ctx, String(s.label).toUpperCase(), cardW - 80, 1);
    ctx.fillText(label[0] || "", M + 40, top + (H > W ? 148 : 120));
  });

  watermark(ctx, W, H, onPhoto);
}

const RENDERERS = {
  item: renderItemCard,
  review: renderReviewCard,
  grid: renderGridCard,
  stats: renderStatsCard,
};

/**
 * Renders a card and returns { canvas, blob, tainted }.
 *
 * `tainted` is true when a cover refused CORS and poisoned the canvas — the
 * caller can then tell you the image is preview-only rather than handing you a
 * broken share button.
 */
export async function renderCard(type, format, data) {
  const f = FORMATS[format] || FORMATS.square;
  const canvas = document.createElement("canvas");
  canvas.width = f.w;
  canvas.height = f.h;
  const ctx = canvas.getContext("2d");
  ctx.textBaseline = "alphabetic";

  const draw = RENDERERS[type] || RENDERERS.item;
  await draw(ctx, f.w, f.h, data);

  let blob = null;
  let tainted = false;
  try {
    blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  } catch (err) {
    tainted = true;
  }
  return { canvas, blob, tainted };
}

/**
 * Hands the PNG to the OS. Share sheet first (the only reliable way to get a
 * file out of iOS), then a download, then the image itself on screen so
 * long-press-to-save always works as a last resort.
 */
export async function shareBlob(blob, filename) {
  if (!blob) return { ok: false, how: "none" };

  try {
    const file = new File([blob], filename, { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: "Stackt" });
      return { ok: true, how: "share" };
    }
  } catch (err) {
    if (err && err.name === "AbortError") return { ok: true, how: "cancelled" };
  }

  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return { ok: true, how: "download" };
  } catch (err) {
    return { ok: false, how: "longpress" };
  }
}

// ---------- the share sheet ----------

/**
 * The share screen: pick a card, pick a shape, see it, send it.
 *
 * `cards` is [{ key, label, sub, type, data }] — the caller decides which are
 * offered (a book with no review doesn't get the review card).
 */
export function openShareSheet(cards, { filename = "stackt" } = {}) {
  if (!cards.length) return;

  let cardKey = cards[0].key;
  let format = "square";
  let photo = null;
  let run = 0;
  let current = null;

  openModal((sheet) => {
    sheet.innerHTML = `
      <h2>Share</h2>

      ${cards.length > 1 ? `
        <div class="share-types" id="shareTypes">
          ${cards.map((c) => `
            <button type="button" class="share-type ${c.key === cardKey ? "active" : ""}" data-card="${c.key}">
              <span class="share-type-label">${escapeHtml(c.label)}</span>
              ${c.sub ? `<span class="share-type-sub">${escapeHtml(c.sub)}</span>` : ""}
            </button>
          `).join("")}
        </div>
      ` : ""}

      <div class="destination-row" id="shareFormat">
        ${Object.values(FORMATS).map((f) => `
          <button type="button" class="destination-btn ${f.key === format ? "active" : ""}" data-format="${f.key}">
            <span class="destination-title">${f.label}</span>
            <span class="destination-sub">${f.sub}</span>
          </button>
        `).join("")}
      </div>

      <div class="share-preview" id="sharePreview">
        <div class="share-spinner">Drawing your card…</div>
      </div>
      <p class="share-status" id="shareStatus"></p>

      <label class="btn btn-secondary share-photo-btn" style="margin-top:0;">
        <input type="file" id="sharePhoto" accept="image/*" hidden>
        <span id="sharePhotoLabel">Use my own photo behind it</span>
      </label>

      <div class="btn-row">
        <button class="btn btn-primary" id="shareGoBtn" type="button">Share this</button>
      </div>
    `;

    const preview = sheet.querySelector("#sharePreview");
    const status = sheet.querySelector("#shareStatus");
    const goBtn = sheet.querySelector("#shareGoBtn");
    const photoInput = sheet.querySelector("#sharePhoto");
    const photoLabel = sheet.querySelector("#sharePhotoLabel");

    async function draw() {
      const mine = ++run;
      goBtn.disabled = true;
      preview.innerHTML = `<div class="share-spinner">Drawing your card…</div>`;
      const card = cards.find((c) => c.key === cardKey) || cards[0];
      const result = await renderCard(card.type, format, { ...card.data, photo });
      if (mine !== run) return; // a newer draw already started
      current = result;

      preview.innerHTML = "";
      result.canvas.className = "share-canvas " + format;
      preview.appendChild(result.canvas);

      if (result.tainted || !result.blob) {
        // Honest about it rather than offering a button that does nothing.
        status.textContent =
          "One of the cover images wouldn't allow copying, so this card can only be previewed here — long-press it to save.";
        status.className = "share-status bad";
        goBtn.disabled = true;
      } else {
        status.textContent = "";
        status.className = "share-status";
        goBtn.disabled = false;
      }
    }

    sheet.querySelectorAll("[data-card]").forEach((btn) => {
      btn.addEventListener("click", () => {
        cardKey = btn.dataset.card;
        sheet.querySelectorAll("[data-card]").forEach((b) => b.classList.toggle("active", b === btn));
        draw();
      });
    });

    sheet.querySelectorAll("[data-format]").forEach((btn) => {
      btn.addEventListener("click", () => {
        format = btn.dataset.format;
        sheet.querySelectorAll("[data-format]").forEach((b) => b.classList.toggle("active", b === btn));
        draw();
      });
    });

    photoInput.addEventListener("change", async () => {
      const file = photoInput.files && photoInput.files[0];
      if (!file) return;
      photoLabel.textContent = "Reading your photo…";
      try {
        photo = await readPhoto(file);
        photoLabel.textContent = "Change the photo · tap to remove";
        photoLabel.parentElement.classList.add("has-photo");
        await draw();
      } catch (err) {
        photoLabel.textContent = "Couldn't use that image";
      }
    });

    // Second tap on a chosen photo clears it, so there's a way back to plain.
    photoLabel.parentElement.addEventListener("click", (e) => {
      if (!photo) return;
      e.preventDefault();
      photo = null;
      photoLabel.textContent = "Use my own photo behind it";
      photoLabel.parentElement.classList.remove("has-photo");
      photoInput.value = "";
      draw();
    });

    goBtn.addEventListener("click", async () => {
      if (!current || !current.blob) return;
      goBtn.disabled = true;
      const res = await shareBlob(current.blob, `${filename}-${format}.png`);
      goBtn.disabled = false;
      if (res.how === "download") {
        status.textContent = "Saved to your downloads.";
        status.className = "share-status good";
      } else if (res.how === "share") {
        dismissLayer();
      } else if (res.how === "longpress") {
        status.textContent = "Couldn't hand it over — long-press the image above to save it.";
        status.className = "share-status bad";
      }
    });

    draw();
  });
}

/** Share backgrounds are drawn at up to 1080px, so anything bigger is waste. */
function readPhoto(file, maxEdge = 1400, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Not an image we can read"));
      img.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
