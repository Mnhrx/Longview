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

import { openModal, dismissLayer, escapeHtml, makeClearable } from "./ui.js";

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
function loadOnce(src, bust) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    // A cache-busting param forces a fresh CORS request, which is the way past
    // an entry Safari cached in the wrong mode before the app was consistent.
    img.src = bust ? src + (src.includes("?") ? "&" : "?") + "_cors=1" : src;
  });
}

function loadImage(src) {
  if (!src) return Promise.resolve(null);
  if (String(src).startsWith("data:")) return loadOnce(src, false);
  return loadOnce(src, false).then((img) => img || loadOnce(src, true));
}

/**
 * Loads a batch of covers a few at a time.
 *
 * Open Library rate-limits cover-by-ISBN to 100 requests per IP per 5 minutes
 * and 403s past that — firing 25 at once for a grid card is a good way to get
 * half of them refused, which is exactly what "only some load" looked like.
 * Four in flight is polite and still fast.
 */
async function loadImages(srcs, concurrency = 4) {
  const out = new Array(srcs.length).fill(null);
  let next = 0;
  const worker = async () => {
    while (next < srcs.length) {
      const i = next++;
      out[i] = await loadImage(srcs[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, srcs.length) }, worker));
  return out;
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

/**
 * Draws the artwork, or — when it couldn't be fetched — a tile carrying the
 * title and creator instead. A bare colour block reads as a bug; a typeset one
 * reads as a design, and you can still tell which book it is.
 */
function artBlock(ctx, img, x, y, w, h, color, radius = 24, item = null) {
  if (img) {
    drawCover(ctx, img, x, y, w, h, radius);
  } else {
    ctx.fillStyle = color || PALETTE.pink;
    roundRect(ctx, x, y, w, h, radius);
    ctx.fill();

    if (item && w >= 120) {
      ctx.save();
      roundRect(ctx, x, y, w, h, radius);
      ctx.clip();
      const pad = Math.round(w * 0.1);
      const titleSize = Math.max(15, Math.round(w * 0.11));
      ctx.fillStyle = "rgba(26,26,46,0.92)";
      setFont(ctx, titleSize, 900);
      const lines = wrapText(ctx, item.title, w - pad * 2, w >= 260 ? 4 : 3);
      let ty = y + pad + titleSize;
      lines.forEach((l, i) => ctx.fillText(l, x + pad, ty + i * titleSize * 1.16));
      if (item.creator && w >= 200) {
        setFont(ctx, Math.round(titleSize * 0.66), 700);
        ctx.fillStyle = "rgba(26,26,46,0.6)";
        const cl = wrapText(ctx, item.creator, w - pad * 2, 1);
        ctx.fillText(cl[0] || "", x + pad, ty + lines.length * titleSize * 1.16 + titleSize * 0.5);
      }
      ctx.restore();
    }
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

/** Draws a 0–5 rating, halves included. */
function drawStars(ctx, rating, x, y, size, gap = 8) {
  const outline = (cx, cy, r) => {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? r : r * 0.45;
      const a = (Math.PI / 5) * i - Math.PI / 2;
      const px = cx + Math.cos(a) * rad;
      const py = cy + Math.sin(a) * rad;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
  };

  const star = (cx, cy, r, fill) => {
    outline(cx, cy, r);
    ctx.fillStyle = "rgba(26,26,46,0.14)";
    ctx.fill();

    // A partial star is the full shape, filled through a clip cut to the
    // fraction earned — so a half star is a half star, not a smaller one.
    if (fill > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx - r, cy - r, r * 2 * fill, r * 2);
      ctx.clip();
      outline(cx, cy, r);
      ctx.fillStyle = PALETTE.yellow;
      ctx.fill();
      ctx.restore();
    }

    outline(cx, cy, r);
    ctx.lineWidth = 4;
    ctx.strokeStyle = PALETTE.ink;
    ctx.stroke();
  };

  const r = Math.max(0, Math.min(5, Number(rating) || 0));
  for (let i = 0; i < 5; i++) {
    const fill = Math.max(0, Math.min(1, r - i));
    star(x + size / 2 + i * (size + gap), y + size / 2, size / 2, fill);
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
  const x = new Date(a + "T00:00:00");
  const y = new Date(b + "T00:00:00");
  if (isNaN(x) || isNaN(y)) return null;
  const n = Math.round((y - x) / 86400000);
  return n < 0 ? null : n;
}

/** The one line under an item that says what you did with it and when. */
export function spanLine(item) {
  if (item.startedDate && item.finishedDate) {
    const d = daysBetween(item.startedDate, item.finishedDate);
    const took =
      d == null ? "" : d === 0 ? " · same day" : ` · took ${d} day${d === 1 ? "" : "s"}`;
    return `Read ${fmt(item.startedDate)} – ${fmt(item.finishedDate)}${took}`;
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
  const M = 72;
  const PAD = 52;              // inside the panel — text never sits on the border
  const panelW = W - M * 2;
  const innerW = panelW - PAD * 2;
  const innerX = M + PAD;

  const img = await loadImage(coverSrc);
  const missing = img ? 0 : 1;

  // Measure first, draw second. The panel can only be sized to its content if
  // we know the content height before we paint the panel — the old version
  // guessed (artSize + 520), which is why the pill hung out of the bottom.
  const artSize = story ? innerW : Math.round(panelW * 0.42);
  const titleSize = story ? 62 : 50;
  const titleLead = story ? 74 : 60;
  const creatorSize = story ? 36 : 30;
  const starSize = story ? 50 : 42;
  const lineSize = story ? 30 : 26;

  setFont(ctx, titleSize, 900);
  const titleLines = wrapText(ctx, item.title, story ? innerW : innerW - artSize - 40, 3);
  setFont(ctx, creatorSize, 700);
  const creatorLines = item.creator
    ? wrapText(ctx, item.creator, story ? innerW : innerW - artSize - 40, 1) : [];
  const line = spanLine(item);
  setFont(ctx, lineSize, 700);
  const spanLines = line
    ? wrapText(ctx, line, story ? innerW : innerW - artSize - 40, 2) : [];

  // Each block costs its first-line ascent PLUS a line-height per line — the
  // baseline of line one sits `size` below where the block starts. Leaving the
  // ascent out under-counted by ~128px, which is exactly how far the status
  // pill used to hang below the panel.
  const textH =
    titleSize + titleLines.length * titleLead +
    (creatorLines.length ? 20 + creatorSize + creatorLines.length * (creatorSize + 8) : 0) +
    (item.rating ? 30 + starSize : 0) +
    (spanLines.length ? 18 + lineSize + spanLines.length * 38 : 0) +
    (kindLabel ? 22 + 62 : 0);

  const contentH = story ? artSize + 52 + textH : Math.max(artSize, textH);
  const panelH = contentH + PAD * 2;
  const panelY = Math.round((H - panelH) / 2) - (story ? 40 : 0);

  if (!onPhoto) panel(ctx, M, panelY, panelW, panelH, "#fff");

  const artX = story ? innerX : innerX;
  const artY = panelY + PAD;
  artBlock(ctx, img, artX, artY, artSize, artSize, item.color, 28, item);

  const textX = story ? innerX : innerX + artSize + 40;
  let y = story ? artY + artSize + 52 : panelY + PAD + Math.round((contentH - textH) / 2);

  ctx.textAlign = "left";
  ctx.fillStyle = onPhoto ? "#fff" : PALETTE.ink;
  setFont(ctx, titleSize, 900);
  y = drawLines(ctx, titleLines, textX, y + titleSize, titleLead);

  if (creatorLines.length) {
    setFont(ctx, creatorSize, 700);
    ctx.fillStyle = onPhoto ? "rgba(255,255,255,0.85)" : "rgba(26,26,46,0.62)";
    y = drawLines(ctx, creatorLines, textX, y + 20 + creatorSize, creatorSize + 8);
  }

  if (item.rating) {
    y += 30;
    drawStars(ctx, item.rating, textX, y, starSize);
    y += starSize;
  }

  if (spanLines.length) {
    setFont(ctx, lineSize, 700);
    ctx.fillStyle = onPhoto ? "rgba(255,255,255,0.8)" : "rgba(26,26,46,0.55)";
    y = drawLines(ctx, spanLines, textX, y + 18 + lineSize, 38);
  }

  if (kindLabel) pill(ctx, kindLabel, textX, y + 22, PALETTE.yellow);

  watermark(ctx, W, H, onPhoto);
  return { missing };
}

/** The review, big, with the cover small alongside. */
async function renderReviewCard(ctx, W, H, { item, coverSrc, photo }) {
  const onPhoto = await background(ctx, W, H, photo);
  const story = H > W;
  const M = 72;
  const PAD = 48;
  const panelW = W - M * 2;
  const innerW = panelW - PAD * 2;
  const innerX = M + PAD;

  const img = await loadImage(coverSrc);
  const missing = img ? 0 : 1;

  const thumb = story ? 190 : 150;
  const headSize = story ? 46 : 40;
  const creatorSize = story ? 30 : 26;
  const starSize = story ? 54 : 44;
  const dateSize = 26;

  // The quote is the point of the card, so it gets whatever room is left —
  // and the type steps DOWN until it fits rather than running through the
  // bottom border, which is what a fixed size did on the square format.
  const headW = panelW - PAD * 2 - thumb - 40;
  setFont(ctx, headSize, 900);
  const titleLines = wrapText(ctx, item.title, headW, 2);
  setFont(ctx, creatorSize, 700);
  const creatorLines = item.creator ? wrapText(ctx, item.creator, headW, 1) : [];

  const line = spanLine(item);
  const headBlock = Math.max(
    thumb,
    headSize + titleLines.length * (headSize + 8) + (creatorLines.length ? 16 + creatorSize : 0)
  );
  const fixedH =
    headBlock + 40 +
    (item.rating ? starSize + 34 : 0) +
    (line ? dateSize + 30 : 0);

  const maxPanelH = H - 150 - Math.round(H * (story ? 0.12 : 0.08)) * 2;
  const quoteText = `“${String(item.review || "").trim()}”`;

  let quoteSize = story ? 52 : 44;
  let quoteLines = [];
  let quoteH = 0;
  const roomForQuote = maxPanelH - PAD * 2 - fixedH;
  while (quoteSize >= 22) {
    setFont(ctx, quoteSize, 800);
    const lead = Math.round(quoteSize * 1.3);
    // A generous line cap so we shrink before we truncate — losing words is
    // worse than losing a couple of points of type size.
    const lines = wrapText(ctx, quoteText, innerW, 40);
    if (lines.length * lead <= roomForQuote || quoteSize === 22) {
      quoteLines = lines;
      quoteH = lines.length * lead;
      break;
    }
    quoteSize -= 3;
  }
  const quoteLead = Math.round(quoteSize * 1.3);

  const panelH = Math.min(maxPanelH, fixedH + quoteH + PAD * 2);
  const panelY = Math.round((H - panelH) / 2);

  if (!onPhoto) panel(ctx, M, panelY, panelW, panelH, "#fff");

  const top = panelY + PAD;
  artBlock(ctx, img, innerX, top, thumb, thumb, item.color, 22, item);

  ctx.textAlign = "left";
  ctx.fillStyle = onPhoto ? "#fff" : PALETTE.ink;
  setFont(ctx, headSize, 900);
  const headX = innerX + thumb + 40;
  let y = drawLines(ctx, titleLines, headX, top + headSize, headSize + 8);
  if (creatorLines.length) {
    setFont(ctx, creatorSize, 700);
    ctx.fillStyle = onPhoto ? "rgba(255,255,255,0.85)" : "rgba(26,26,46,0.6)";
    drawLines(ctx, creatorLines, headX, y + 16, creatorSize + 6);
  }

  y = top + headBlock + 40;
  if (item.rating) {
    drawStars(ctx, item.rating, innerX, y, starSize);
    y += starSize + 34;
  }

  ctx.fillStyle = onPhoto ? "#fff" : PALETTE.ink;
  setFont(ctx, quoteSize, 800);
  y = drawLines(ctx, quoteLines, innerX, y + quoteSize, quoteLead) - quoteLead + quoteLead;

  if (line) {
    setFont(ctx, dateSize, 700);
    ctx.fillStyle = onPhoto ? "rgba(255,255,255,0.78)" : "rgba(26,26,46,0.5)";
    ctx.fillText(wrapText(ctx, line, innerW, 1)[0] || "", innerX, y + 12 + dateSize);
  }

  watermark(ctx, W, H, onPhoto);
  return { missing };
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
  let missing = 0;
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

  const imgs = await loadImages(coverSrcs.slice(0, count));
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const inRow = Math.min(cols, count - row * cols);
    const rowW = inRow * cell + (inRow - 1) * gap;
    const rowX = M + Math.round((gridW - rowW) / 2); // centres a short last row
    const cx = rowX + (i % cols) * (cell + gap);
    const cy = gridTop + row * (cell + gap);
    artBlock(ctx, imgs[i], cx, cy, cell, cell, items[i].color, 18, items[i]);
    if (!imgs[i]) missing++;
  }

  const more = items.length - count;
  if (more > 0) {
    setFont(ctx, 32, 800);
    ctx.fillStyle = onPhoto ? "rgba(255,255,255,0.85)" : "rgba(26,26,46,0.55)";
    ctx.fillText(`+ ${more} more`, M, gridTop + gridH + 52);
  }

  watermark(ctx, W, H, onPhoto);
  return { missing };
}

/** Numbers only — the year-in-review shape. */
const MAX_STATS = 5;

async function renderStatsCard(ctx, W, H, { title, stats, chosen, photo, accent = PALETTE.mint }) {
  // `chosen` is a Set of keys; without one, take the first few.
  const picked = chosen
    ? stats.filter((st) => chosen.has(st.key))
    : stats.slice(0, MAX_STATS);
  stats = picked.length ? picked : stats.slice(0, 1);

  const onPhoto = await background(ctx, W, H, photo);
  const M = 84;
  const cardW = W - M * 2;

  ctx.textAlign = "left";
  ctx.fillStyle = onPhoto ? "#fff" : PALETTE.ink;
  setFont(ctx, 66, 900);
  let y = Math.round(H * (H > W ? 0.13 : 0.12));
  y = drawLines(ctx, wrapText(ctx, title, cardW, 2), M, y, 76);
  y += 40;

  const gap = 22;
  const shown = stats.slice(0, MAX_STATS);
  // Rows shrink as you add more — and so must the type inside them, or five
  // stats on a square push their own labels through the bottom border.
  const rowH = H > W ? 190 : Math.max(112, Math.round((H * 0.52 - gap * shown.length) / shown.length));
  const valueSize = Math.round(Math.min(H > W ? 78 : 62, rowH * 0.42));
  const labelSize = Math.round(Math.min(H > W ? 30 : 26, rowH * 0.19));
  const valueBaseline = Math.round(rowH * 0.52);
  const labelBaseline = Math.round(rowH * 0.78);

  // Centre the stack in what's left, so a short list doesn't hang off the top.
  const blockH = shown.length * rowH + (shown.length - 1) * gap;
  const availH = H - y - 150;
  const top0 = y + Math.max(0, Math.round((availH - blockH) / 2));

  shown.forEach((s, i) => {
    const top = top0 + i * (rowH + gap);
    panel(ctx, M, top, cardW, rowH, i % 2 ? "#fff" : accent, { radius: 28, offset: 10, border: 6 });

    ctx.fillStyle = PALETTE.ink;
    setFont(ctx, valueSize, 900);
    ctx.fillText(String(s.value), M + 40, top + valueBaseline);

    // Ellipsised rather than hard-sliced, so a long author name says so.
    setFont(ctx, labelSize, 800);
    ctx.fillStyle = "rgba(26,26,46,0.6)";
    const label = wrapText(ctx, String(s.label).toUpperCase(), cardW - 80, 1);
    ctx.fillText(label[0] || "", M + 40, top + labelBaseline);
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
  const meta = (await draw(ctx, f.w, f.h, data)) || {};

  let blob = null;
  let tainted = false;
  try {
    blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  } catch (err) {
    tainted = true;
  }
  return { canvas, blob, tainted, missing: meta.missing || 0 };
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
  const chosenStats = new Map(); // card key -> Set of stat keys
  const chosenItems = new Map(); // card key -> Set of item ids, or null for "all"
  let picking = false;           // is the item chooser open?
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

      <div class="share-scope" id="shareScope" hidden>
        <button type="button" class="share-scope-btn active" data-scope="all">Everything</button>
        <button type="button" class="share-scope-btn" data-scope="pick">Choose…</button>
      </div>

      <div class="share-options" id="shareOptions" hidden></div>

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
    const options = sheet.querySelector("#shareOptions");
    const scope = sheet.querySelector("#shareScope");
    const status = sheet.querySelector("#shareStatus");
    const goBtn = sheet.querySelector("#shareGoBtn");
    const photoInput = sheet.querySelector("#sharePhoto");
    const photoLabel = sheet.querySelector("#sharePhotoLabel");

    /** Which items end up on the card: all of them, or the ones you ticked. */
    function selectionFor(card) {
      const all = (card.data && card.data.items) || [];
      const chosen = chosenItems.get(card.key);
      // No chooser open, or nothing ticked yet: the card shows everything, so
      // the preview is never blank while you decide.
      if (!chosen || chosen.size === 0) return all;
      return all.filter((it) => chosen.has(it.id));
    }

    let pickQuery = "";
    let pickFilter = "all"; // all | fave | 5 | 4.5 | … | shelf keys | author name

    /** The items the picker currently shows, after search and filter. */
    function visibleItems(all) {
      const q = pickQuery.trim().toLowerCase();
      return all.filter((it) => {
        if (q) {
          const hay = `${it.title || ""} ${it.creator || ""} ${it.creatorAlt || ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (pickFilter === "all") return true;
        if (pickFilter === "fave") return !!it.favourite;
        if (pickFilter.startsWith("rating:")) {
          return (Number(it.rating) || 0) === Number(pickFilter.slice(7));
        }
        if (pickFilter.startsWith("author:")) {
          return (it.creator || "") === pickFilter.slice(7);
        }
        return true;
      });
    }

    /**
     * The item tick-list.
     *
     * Two things it deliberately does NOT do: it doesn't start with everything
     * ticked (you came here to choose), and it doesn't rebuild itself when you
     * tick a row. Rebuilding threw away the scroll position of this box, so
     * tapping the tenth book bounced you back to the first — you had to scroll
     * down again for every single choice.
     */
    function paintItemPicker() {
      const card = cards.find((c) => c.key === cardKey) || cards[0];
      const all = (card.data && card.data.items) || [];
      const chosen = chosenItems.get(card.key) || new Set();
      chosenItems.set(card.key, chosen);

      const shown = visibleItems(all);
      const authors = [...new Set(all.map((i) => i.creator).filter(Boolean))];
      const ratings = [...new Set(all.map((i) => Number(i.rating) || 0).filter(Boolean))]
        .sort((a, b) => b - a);
      const anyFave = all.some((i) => i.favourite);

      options.hidden = false;
      options.innerHTML = `
        <p class="share-options-head">
          What goes on the card
          <span class="share-options-count" id="pickCount"></span>
        </p>
        <div class="picker-search">
          <input type="search" id="pickSearch" placeholder="Search by title or author" value="${escapeHtml(pickQuery)}">
        </div>
        <div class="rating-filter-row pick-filters">
          <button type="button" class="rating-chip ${pickFilter === "all" ? "active" : ""}" data-pf="all">All</button>
          ${anyFave ? `<button type="button" class="rating-chip ${pickFilter === "fave" ? "active" : ""}" data-pf="fave">♥ Loved</button>` : ""}
          ${ratings.map((r) => `
            <button type="button" class="rating-chip ${pickFilter === "rating:" + r ? "active" : ""}" data-pf="rating:${r}">${r}★</button>
          `).join("")}
          ${authors.length > 1 ? authors.slice(0, 8).map((a) => `
            <button type="button" class="rating-chip ${pickFilter === "author:" + a ? "active" : ""}" data-pf="author:${escapeHtml(a)}">${escapeHtml(a)}</button>
          `).join("") : ""}
        </div>
        <div class="share-pick-actions">
          <button type="button" class="link-btn" id="pickAll">Select all shown</button>
          <button type="button" class="link-btn" id="pickNone">Clear</button>
        </div>
        <div class="stat-picks" id="pickList">
          ${shown.length ? shown.map((it) => `
            <button type="button" class="stat-pick ${chosen.has(it.id) ? "on" : ""}" data-item="${escapeHtml(it.id)}">
              <span class="stat-pick-tick">${chosen.has(it.id) ? "✓" : ""}</span>
              <span class="stat-pick-label">${escapeHtml(it.title || "Untitled")}</span>
              <span class="stat-pick-value">${it.favourite ? "♥ " : ""}${it.rating ? `${it.rating}★` : ""}</span>
            </button>
          `).join("") : `<p class="cover-picker-note">Nothing matches that.</p>`}
        </div>
      `;

      const countEl = options.querySelector("#pickCount");
      const syncCount = () => {
        countEl.textContent = chosen.size
          ? `${chosen.size} selected`
          : "none selected";
        goBtn.disabled = chosen.size === 0;
      };
      syncCount();

      // Toggle in place. No innerHTML, so the list stays exactly where it was.
      options.querySelectorAll("[data-item]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.dataset.item;
          const on = chosen.has(id);
          if (on) chosen.delete(id);
          else chosen.add(id);
          btn.classList.toggle("on", !on);
          btn.querySelector(".stat-pick-tick").textContent = on ? "" : "✓";
          syncCount();
          draw();
        });
      });

      const search = options.querySelector("#pickSearch");
      makeClearable(search, () => { pickQuery = ""; paintItemPicker(); });
      search.addEventListener("input", () => {
        pickQuery = search.value;
        const at = search.selectionStart;
        paintItemPicker();
        // Repainting replaces the field, so put the caret back where it was.
        const again = options.querySelector("#pickSearch");
        again.focus();
        try { again.setSelectionRange(at, at); } catch (e) { /* not all types allow it */ }
      });

      options.querySelectorAll("[data-pf]").forEach((chip) => {
        chip.addEventListener("click", () => {
          pickFilter = chip.dataset.pf;
          paintItemPicker();
        });
      });

      options.querySelector("#pickAll").addEventListener("click", () => {
        shown.forEach((i) => chosen.add(i.id));
        paintItemPicker();
        draw();
      });
      options.querySelector("#pickNone").addEventListener("click", () => {
        chosen.clear();
        paintItemPicker();
        draw();
      });
    }

    /** The stat tick-list, shown only for the stats card. */
    function paintOptions() {
      const card = cards.find((c) => c.key === cardKey) || cards[0];

      // Scope toggle only makes sense for a card built from a list of items.
      const canPick = !!card.pickable && ((card.data && card.data.items) || []).length > 1;
      scope.hidden = !canPick;
      if (canPick && picking) {
        paintItemPicker();
        return;
      }

      const all = (card.data && card.data.stats) || [];
      if (card.type !== "stats" || all.length <= 1) {
        options.hidden = true;
        options.innerHTML = "";
        return;
      }
      const chosen = chosenStats.get(card.key);
      options.hidden = false;
      options.innerHTML = `
        <p class="share-options-head">
          What goes on the card
          <span class="share-options-count" id="statCount"></span>
        </p>
        <div class="stat-picks">
          ${all.map((st) => `
            <button type="button" class="stat-pick ${chosen.has(st.key) ? "on" : ""}"
                    data-stat="${st.key}">
              <span class="stat-pick-tick">${chosen.has(st.key) ? "✓" : ""}</span>
              <span class="stat-pick-label">${escapeHtml(st.label)}</span>
              <span class="stat-pick-value">${escapeHtml(String(st.value))}</span>
            </button>
          `).join("")}
        </div>
      `;
      options.querySelector("#statCount").textContent = `${chosen.size} of ${MAX_STATS}`;

      options.querySelectorAll("[data-stat]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const key = btn.dataset.stat;
          if (chosen.has(key)) {
            if (chosen.size === 1) return; // never leave the card empty
            chosen.delete(key);
          } else {
            if (chosen.size >= MAX_STATS) {
              const count = options.querySelector("#statCount");
              count.classList.add("full");
              setTimeout(() => count.classList.remove("full"), 700);
              return;
            }
            chosen.add(key);
          }
          paintOptions();
          draw();
        });
      });
    }

    async function draw() {
      const mine = ++run;
      goBtn.disabled = true;
      preview.innerHTML = `<div class="share-spinner">Drawing your card…</div>`;
      const card = cards.find((c) => c.key === cardKey) || cards[0];

      if (card.type === "stats" && !chosenStats.has(card.key)) {
        const all = (card.data && card.data.stats) || [];
        chosenStats.set(card.key, new Set(all.slice(0, MAX_STATS).map((st) => st.key)));
        paintOptions();
      }
      // Deliberately NOT repainting the options here. draw() runs on every
      // tick, and repainting rebuilt the tick-list's innerHTML — which threw
      // away its scroll position, bouncing you to the top of the list after
      // each choice. The picker updates itself in place instead.

      const picked = selectionFor(card);
      const result = await renderCard(card.type, format, {
        ...card.data,
        photo,
        chosen: chosenStats.get(card.key) || null,
        ...(card.pickable
          ? {
              items: picked,
              coverSrcs: card.data.srcFor ? picked.map(card.data.srcFor) : card.data.coverSrcs,
              subtitle: card.data.subtitleFor
                ? card.data.subtitleFor(picked)
                : card.data.subtitle,
            }
          : {}),
      });
      if (mine !== run) return; // a newer draw already started
      current = result;

      preview.innerHTML = "";
      result.canvas.className = "share-canvas " + format;
      preview.appendChild(result.canvas);

      const chosenNow = chosenItems.get(card.key);
      const nothingPicked = picking && chosenNow && chosenNow.size === 0;

      if (nothingPicked) {
        // The preview still shows everything, so the sheet isn't blank while
        // you decide — but there's nothing chosen to send yet.
        status.textContent = "Showing everything — tick the ones you want.";
        status.className = "share-status";
        goBtn.disabled = true;
        return;
      }

      if (result.tainted || !result.blob) {
        // Honest about it rather than offering a button that does nothing.
        status.textContent =
          "One of the cover images wouldn't allow copying, so this card can only be previewed here — long-press it to save.";
        status.className = "share-status bad";
        goBtn.disabled = true;
      } else {
        // Say so rather than letting a colour tile look like a broken render.
        status.textContent = result.missing
          ? `${result.missing} cover${result.missing === 1 ? "" : "s"} couldn't be fetched — those show the title instead.`
          : "";
        status.className = "share-status";
        goBtn.disabled = false;
      }
    }

    scope.querySelectorAll("[data-scope]").forEach((btn) => {
      btn.addEventListener("click", () => {
        picking = btn.dataset.scope === "pick";
        scope.querySelectorAll("[data-scope]").forEach((b) => b.classList.toggle("active", b === btn));
        const card = cards.find((c) => c.key === cardKey) || cards[0];
        if (!picking) {
          chosenItems.delete(card.key); // back to everything
          goBtn.disabled = false;
        } else {
          // Start from nothing: you opened the chooser to choose.
          chosenItems.set(card.key, new Set());
        }
        paintOptions();
        draw();
      });
    });

    sheet.querySelectorAll("[data-card]").forEach((btn) => {
      btn.addEventListener("click", () => {
        cardKey = btn.dataset.card;
        picking = false;
        scope.querySelectorAll("[data-scope]").forEach((b) =>
          b.classList.toggle("active", b.dataset.scope === "all")
        );
        sheet.querySelectorAll("[data-card]").forEach((b) => b.classList.toggle("active", b === btn));
        const card = cards.find((c) => c.key === cardKey);
        if (card && card.type === "stats" && !chosenStats.has(card.key)) {
          const all = (card.data && card.data.stats) || [];
          chosenStats.set(card.key, new Set(all.slice(0, MAX_STATS).map((st) => st.key)));
        }
        paintOptions();
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
