// ============================================
// Settings — backup, restore, and reset.
//
// Everything Stackt knows lives in this browser's storage. That's what makes
// the app work offline with no account, but it also means clearing Safari's
// website data, or re-adding the app to the home screen on a new phone, can
// take the whole library with it. Backup exists so that's recoverable.
// ============================================

import { store } from "./core.js";
import { bounceTap } from "./animations.js";
import {
  usage, clearCache, CACHE_CAP_BYTES,
  getRecord, localUrl, rebuildUrl, remoteKey, liveUrlCount,
} from "./covers.js";
import { bookCoverSrc } from "./books.js";
import { recordCoverSrc } from "./lps.js";

function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Same shelf rules as the modules use: copies means owned, a borrow record
 *  means borrowed, neither means wishlist. */
function tally(items) {
  const owned = items.filter((i) => (i.copies || []).length > 0).length;
  const borrowed = items.filter((i) => !(i.copies || []).length && i.borrowed).length;
  return { total: items.length, owned, borrowed, wishlist: items.length - owned - borrowed };
}
function counts() {
  return {
    books: tally(store.itemsByType("book")),
    records: tally(store.itemsByType("lp")),
  };
}

/** Rough size of what's stored, so "how much am I carrying" is answerable. */
function storedSize() {
  try {
    const raw = localStorage.getItem("stackt-state-v1") || "";
    const kb = new Blob([raw]).size / 1024;
    return kb < 1024 ? `${kb.toFixed(0)} KB` : `${(kb / 1024).toFixed(1)} MB`;
  } catch (e) {
    return "unknown";
  }
}

function render(container, flash = null) {
  const c = counts();

  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <p class="view-title">Settings</p>

    <div class="settings-card">
      <p class="settings-heading">Your library</p>
      <p class="settings-stat">
        <strong>${c.books.total}</strong> book${c.books.total === 1 ? "" : "s"} ·
        ${c.books.owned} owned · ${c.books.borrowed} borrowed · ${c.books.wishlist} wishlist
      </p>
      <p class="settings-stat">
        <strong>${c.records.total}</strong> record${c.records.total === 1 ? "" : "s"} ·
        ${c.records.owned} owned · ${c.records.borrowed} borrowed · ${c.records.wishlist} wishlist
      </p>
      <p class="settings-note">Stored on this device · ${storedSize()}</p>
    </div>

    <div class="settings-card">
      <p class="settings-heading">Storage</p>
      <p class="settings-note">
        Your photos are kept forever and travel in your backups. Covers
        downloaded from the web are only a cache — clearing them frees space
        and they come back next time you look at the book.
      </p>
      <p class="settings-stat" id="storageStat">Measuring…</p>
      <div class="storage-bar" id="storageBar" hidden><span></span></div>
      <button class="btn btn-secondary" id="clearCacheBtn" type="button">Clear downloaded covers</button>
      <p class="settings-status" id="storageStatus"></p>
    </div>

    <div class="settings-card">
      <p class="settings-heading">Check covers</p>
      <p class="settings-note">
        If covers have gone missing, run this. It tests every one and says
        where it stands — stored, loading, or broken — so a fix can be aimed at
        the real problem instead of guessed at.
      </p>
      <button class="btn btn-secondary" id="coverCheckBtn" type="button">Run the check</button>
      <p class="settings-status" id="coverCheckStatus"></p>
      <pre class="settings-readout" id="coverCheckOut" hidden></pre>
      <button class="btn btn-secondary" id="coverCopyBtn" type="button" hidden>Copy the report</button>
    </div>

    <div class="settings-card">
      <p class="settings-heading">Back up</p>
      <p class="settings-note">
        Saves everything to a file you keep — books, records, copies, loans,
        reviews, dates. Worth doing before you clear Safari data or move to a
        new phone.
      </p>
      <label class="settings-check">
        <input type="checkbox" id="backupPhotos" checked>
        <span>Include the photos I took (bigger file, but nothing is lost)</span>
      </label>
      <button class="btn btn-primary" id="backupBtn" type="button">Back up my library</button>
      <p class="settings-status" id="backupStatus"></p>
      <textarea class="settings-json" id="backupJson" readonly hidden></textarea>
    </div>

    <div class="settings-card">
      <p class="settings-heading">Restore</p>
      <p class="settings-note">
        Loads a backup file. This <strong>replaces</strong> everything currently
        in the app, so back up first if there's anything here you want to keep.
      </p>
      <label class="btn btn-secondary settings-file-btn" style="margin-top:0;">
        <input type="file" id="restoreFile" accept="application/json,.json" hidden>
        Choose a backup file
      </label>
      <button class="link-btn" id="pasteToggle" type="button">or paste a backup instead</button>
      <div id="pasteWrap" hidden>
        <textarea class="settings-json" id="restoreJson" placeholder="Paste the contents of a backup file here"></textarea>
        <button class="btn btn-secondary" id="restorePasteBtn" type="button">Restore from pasted text</button>
      </div>
      <p class="settings-status" id="restoreStatus"></p>
    </div>

    <div class="settings-card danger-card">
      <p class="settings-heading">Reset</p>
      <p class="settings-note">
        Empties the app completely — every book, record, loan and review. This
        can't be undone, and the sample books won't come back.
      </p>
      <button class="btn btn-secondary danger-btn" id="resetBtn" type="button">Reset library</button>
      <p class="settings-status" id="resetStatus"></p>
    </div>
  `;

  container.innerHTML = "";
  container.appendChild(wrap);

  wireBackup(wrap);
  wireStorage(wrap);
  wireCoverCheck(wrap);
  wireRestore(wrap, container);
  wireReset(wrap, container);

  // A confirmation raised before this re-render would otherwise be wiped by it.
  if (flash) {
    const el = wrap.querySelector(flash.selector);
    if (el) {
      el.textContent = flash.text;
      el.className = `settings-status ${flash.kind || ""}`.trim();
    }
  }
}

// ---------- backup ----------

function wireBackup(wrap) {
  const btn = wrap.querySelector("#backupBtn");
  const status = wrap.querySelector("#backupStatus");
  const jsonBox = wrap.querySelector("#backupJson");

  btn.addEventListener("click", async () => {
    bounceTap(btn);
    const withPhotos = btn.closest(".settings-card").querySelector("#backupPhotos").checked;
    status.textContent = withPhotos ? "Gathering your photos…" : "Preparing…";
    const bundle = await store.exportBundle({ withPhotos });
    const text = JSON.stringify(bundle, null, 2);
    const filename = `stackt-backup-${today()}.json`;

    // iOS's share sheet is the most reliable way to get a file off the phone —
    // it can save to Files, mail it, or AirDrop it. Try that first.
    try {
      const file = new File([text], filename, { type: "application/json" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Stackt backup" });
        status.textContent = "Backup shared.";
        return;
      }
    } catch (err) {
      if (err && err.name === "AbortError") return; // user dismissed the sheet
    }

    // Otherwise fall back to a normal download.
    try {
      const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      status.textContent = `Saved as ${filename}.`;
      return;
    } catch (err) {
      /* fall through */
    }

    // Last resort: put it on screen so it can be copied by hand. Never leave
    // someone with no way to get their data out.
    jsonBox.hidden = false;
    jsonBox.value = text;
    jsonBox.focus();
    jsonBox.select();
    status.textContent = "Couldn't save a file here — copy the text below and keep it somewhere safe.";
  });
}

// ---------- storage ----------

function fmtBytes(n) {
  if (!n) return "0 KB";
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function wireStorage(wrap) {
  const stat = wrap.querySelector("#storageStat");
  const bar = wrap.querySelector("#storageBar");
  const btn = wrap.querySelector("#clearCacheBtn");
  const status = wrap.querySelector("#storageStatus");

  async function paint() {
    const u = await usage();
    stat.innerHTML =
      `<strong>${fmtBytes(u.ownBytes)}</strong> your photos (${u.ownCount}) · ` +
      `<strong>${fmtBytes(u.cachedBytes)}</strong> downloaded covers (${u.cachedCount})`;

    // Measured against OUR cap, not the browser's quota — the cap is the number
    // that actually governs anything, and it's the one we can promise.
    const pct = Math.min(100, Math.round((u.cachedBytes / CACHE_CAP_BYTES) * 100));
    bar.hidden = false;
    bar.firstElementChild.style.width = `${Math.max(pct, u.cachedBytes ? 2 : 0)}%`;
    bar.title = `${pct}% of the ${fmtBytes(CACHE_CAP_BYTES)} cover cache`;
    btn.disabled = !u.cachedCount;
  }

  btn.addEventListener("click", async () => {
    bounceTap(btn);
    btn.disabled = true;
    status.textContent = "Clearing…";
    const n = await clearCache();
    status.textContent = n
      ? `Cleared ${n} cover${n === 1 ? "" : "s"}. They'll come back as you browse.`
      : "Nothing cached to clear.";
    status.className = "settings-status good";
    paint();
  });

  paint();
}

// ---------- cover check ----------

/** Loads a URL on a throwaway image and says whether it decodes. */
function tryLoad(url, cross) {
  return new Promise((resolve) => {
    const img = new Image();
    let done = false;
    const finish = (ok) => { if (!done) { done = true; resolve(ok); } };
    img.onload = () => finish(true);
    img.onerror = () => finish(false);
    if (cross) img.crossOrigin = "anonymous";
    img.src = url;
    setTimeout(() => finish(false), 8000); // a hung request is a failure too
  });
}

/**
 * Walks every cover and reports where it actually stands.
 *
 * This exists because I could not reproduce the disappearing covers on any
 * browser I have, and diagnosing by hypothesis was costing rounds. It answers
 * the three questions that separate the plausible causes: is the picture in
 * the store at all, does the handle we cached still load, and does a freshly
 * built handle load? A stored cover whose cached handle fails but whose fresh
 * one works is a stale-handle problem; both failing is a bad blob; neither
 * stored is a caching problem. Different fixes, and now they're telling apart.
 */
function wireCoverCheck(wrap) {
  const btn = wrap.querySelector("#coverCheckBtn");
  const status = wrap.querySelector("#coverCheckStatus");
  const out = wrap.querySelector("#coverCheckOut");
  const copyBtn = wrap.querySelector("#coverCopyBtn");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    bounceTap(btn);
    btn.disabled = true;
    out.hidden = true;
    copyBtn.hidden = true;
    status.className = "settings-status";
    status.textContent = "Checking…";

    const items = store.get().items.filter((it) => it.type === "book" || it.type === "lp");
    const tally = { total: 0, none: 0, fine: 0, stale: 0, bad: 0, uncached: 0, remoteOnly: 0 };
    const lines = [];

    for (const it of items) {
      const src = it.type === "book" ? bookCoverSrc(it, "L") : recordCoverSrc(it, 500);
      if (!src) { tally.none++; continue; }
      tally.total++;

      const own = String(src).startsWith("own:");
      const key = own ? src : remoteKey(src);
      const rec = await getRecord(key);
      const name = `${(it.title || "untitled").slice(0, 34)}`;

      if (!rec) {
        // Nothing stored. For a downloaded cover that's normal until you've
        // seen it once; for your own photo it means the picture is gone.
        if (own) { tally.bad++; lines.push(`GONE      ${name} — your photo isn't in the store`); }
        else {
          const net = await tryLoad(src, true);
          if (net) { tally.uncached++; lines.push(`NOT CACHED ${name} — loads from the web`); }
          else { tally.remoteOnly++; lines.push(`NO SOURCE ${name} — not stored and won't download`); }
        }
        continue;
      }

      const cached = await localUrl(key);
      if (cached && (await tryLoad(cached, false))) { tally.fine++; continue; }

      const fresh = await rebuildUrl(key);
      if (fresh && (await tryLoad(fresh, false))) {
        tally.stale++;
        lines.push(`STALE     ${name} — stored fine, its handle had died`);
      } else {
        tally.bad++;
        lines.push(`BAD BLOB  ${name} — stored, but the image won't decode`);
      }
    }

    const u = await usage();
    const report = [
      `Stackt cover check — ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
      `${navigator.userAgent}`,
      "",
      `covers checked   ${tally.total}   (${tally.none} items have no cover set)`,
      `loading fine     ${tally.fine}`,
      `stale handle     ${tally.stale}`,
      `bad blob         ${tally.bad}`,
      `not yet cached   ${tally.uncached}`,
      `no source at all ${tally.remoteOnly}`,
      "",
      `open handles     ${liveUrlCount()}`,
      `store            ${u.ownCount} photos, ${u.cachedCount} cached covers`,
      "",
      ...(lines.length ? lines.slice(0, 60) : ["Nothing to report — every cover loaded."]),
      ...(lines.length > 60 ? [`…and ${lines.length - 60} more`] : []),
    ].join("\n");

    out.textContent = report;
    out.hidden = false;
    copyBtn.hidden = false;
    btn.disabled = false;

    const trouble = tally.stale + tally.bad + tally.remoteOnly;
    status.textContent = trouble
      ? `${trouble} cover${trouble === 1 ? "" : "s"} in trouble out of ${tally.total}.`
      : `All ${tally.total} covers are fine.`;
    status.className = `settings-status ${trouble ? "warn" : "good"}`;

    copyBtn.onclick = async () => {
      bounceTap(copyBtn);
      try {
        await navigator.clipboard.writeText(report);
        copyBtn.textContent = "Copied";
        setTimeout(() => { copyBtn.textContent = "Copy the report"; }, 2000);
      } catch (err) {
        // Clipboard access is refused often enough on iOS that a dead button
        // would be a real dead end — select it instead so it can be copied.
        const range = document.createRange();
        range.selectNodeContents(out);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        copyBtn.textContent = "Selected — copy it";
      }
    };
  });
}

// ---------- restore ----------

function wireRestore(wrap, container) {
  const fileInput = wrap.querySelector("#restoreFile");
  const status = wrap.querySelector("#restoreStatus");
  const pasteToggle = wrap.querySelector("#pasteToggle");
  const pasteWrap = wrap.querySelector("#pasteWrap");
  const pasteBox = wrap.querySelector("#restoreJson");
  const pasteBtn = wrap.querySelector("#restorePasteBtn");

  async function apply(text) {
    let bundle;
    try {
      bundle = JSON.parse(text);
    } catch (e) {
      status.textContent = "That isn't valid JSON — check you copied the whole file.";
      status.className = "settings-status bad";
      return;
    }
    try {
      const n = await store.importBundle(bundle);
      // Re-render so the counts at the top reflect what just landed, carrying
      // the confirmation across so it isn't wiped by the redraw.
      render(container, {
        selector: "#restoreStatus",
        text: `Restored ${n} item${n === 1 ? "" : "s"}.`,
        kind: "good",
      });
    } catch (err) {
      status.textContent = err.message;
      status.className = "settings-status bad";
    }
  }

  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => {
      status.textContent = "Couldn't read that file.";
      status.className = "settings-status bad";
    };
    reader.onload = () => apply(String(reader.result));
    reader.readAsText(file);
  });

  pasteToggle.addEventListener("click", () => {
    pasteWrap.hidden = !pasteWrap.hidden;
    if (!pasteWrap.hidden) pasteBox.focus();
  });

  pasteBtn.addEventListener("click", () => {
    if (!pasteBox.value.trim()) return;
    apply(pasteBox.value);
  });
}

// ---------- reset ----------

function wireReset(wrap, container) {
  const btn = wrap.querySelector("#resetBtn");
  const status = wrap.querySelector("#resetStatus");
  let armed = false;

  btn.addEventListener("click", () => {
    // Two taps rather than a blocking dialog — same protection, no modal.
    if (!armed) {
      armed = true;
      btn.textContent = "Tap again to erase everything";
      btn.classList.add("armed");
      status.textContent = "This will delete every book. Tap anywhere else to cancel.";
      setTimeout(() => {
        document.addEventListener("click", cancel, { once: true });
      }, 0);
      return;
    }
    store.resetAll().then(() => {
      render(container, { selector: "#resetStatus", text: "Library erased.", kind: "good" });
    });
  });

  function cancel(e) {
    if (e.target === btn) return;
    armed = false;
    btn.textContent = "Reset library";
    btn.classList.remove("armed");
    status.textContent = "";
  }
}

export default { render };
