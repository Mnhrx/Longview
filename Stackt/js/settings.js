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

function today() {
  return new Date().toISOString().slice(0, 10);
}

function counts() {
  const books = store.itemsByType("book");
  const owned = books.filter((b) => (b.copies || []).length > 0).length;
  const borrowed = books.filter((b) => !(b.copies || []).length && b.borrowed).length;
  const wishlist = books.length - owned - borrowed;
  return { total: books.length, owned, borrowed, wishlist };
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
        <strong>${c.total}</strong> book${c.total === 1 ? "" : "s"} ·
        ${c.owned} owned · ${c.borrowed} borrowed · ${c.wishlist} wishlist
      </p>
      <p class="settings-note">Stored on this device · ${storedSize()}</p>
    </div>

    <div class="settings-card">
      <p class="settings-heading">Back up</p>
      <p class="settings-note">
        Saves everything to a file you keep — books, copies, loans, reviews, dates.
        Worth doing before you clear Safari data or move to a new phone.
      </p>
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
        Empties the app completely — every book, loan and review. This can't be
        undone, and the sample books won't come back.
      </p>
      <button class="btn btn-secondary danger-btn" id="resetBtn" type="button">Reset library</button>
      <p class="settings-status" id="resetStatus"></p>
    </div>
  `;

  container.innerHTML = "";
  container.appendChild(wrap);

  wireBackup(wrap);
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
    const bundle = store.exportBundle();
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

// ---------- restore ----------

function wireRestore(wrap, container) {
  const fileInput = wrap.querySelector("#restoreFile");
  const status = wrap.querySelector("#restoreStatus");
  const pasteToggle = wrap.querySelector("#pasteToggle");
  const pasteWrap = wrap.querySelector("#pasteWrap");
  const pasteBox = wrap.querySelector("#restoreJson");
  const pasteBtn = wrap.querySelector("#restorePasteBtn");

  function apply(text) {
    let bundle;
    try {
      bundle = JSON.parse(text);
    } catch (e) {
      status.textContent = "That isn't valid JSON — check you copied the whole file.";
      status.className = "settings-status bad";
      return;
    }
    try {
      const n = store.importBundle(bundle);
      // Re-render so the counts at the top reflect what just landed, carrying
      // the confirmation across so it isn't wiped by the redraw.
      render(container, {
        selector: "#restoreStatus",
        text: `Restored ${n} book${n === 1 ? "" : "s"}.`,
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
    store.resetAll();
    render(container, { selector: "#resetStatus", text: "Library erased.", kind: "good" });
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
