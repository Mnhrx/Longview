// ============================================
// Version, release notes and the guide.
//
// All three live together because they're the same job: telling someone what
// this app is and what changed. Keeping the version here rather than scattered
// through the code means one line to edit per release, and the service worker
// reads the same constant so a deploy can't half-update.
//
// TO SHIP A RELEASE:
//   1. Bump APP_VERSION.
//   2. Add an entry to the TOP of RELEASES.
//   3. Bump CACHE_NAME in service-worker.js to match.
// That's it. The "What's new" card and the once-per-version popup follow.
// ============================================

import { openOverlay, dismissLayer, escapeHtml } from "./ui.js";
import { ICONS } from "./icons.js";

export const APP_VERSION = "3.0.1";

/** Where the last-seen version is remembered, so the popup shows once. */
const SEEN_KEY = "stackt-seen-version";

/**
 * Newest first. `highlights` are the two or three things worth a sentence;
 * `notes` is the rest. Keep both in plain language — this is read by someone
 * who wants to know what's different, not a commit log.
 */
export const RELEASES = [
  {
    version: "3.0.1",
    date: "September 2026",
    title: "Words, tracklists and a guide",
    highlights: [
      "A Words module: look up a word, keep it with the book you were reading.",
      "Records can carry their tracklist, with a rating and a heart per song.",
      "A guide in Settings, and these release notes.",
    ],
    notes: [
      "Words opens straight on the lookup — no + to press first.",
      "Example sentences now come through: most are real quotations from books, with the year and author.",
      "A book's page lists the words you looked up while reading it.",
      "Grouping words by book lists the books, and you tap one to see its words.",
      "Album ratings stay yours — the track average is shown beside them, never instead of them.",
      "Tracklists ask which pressing you own rather than guessing, since reissues change the track list.",
      "Covers repair themselves when a stored image goes stale, and Settings can check every one.",
      "MusicBrainz lookups are paced and retried, so a busy server no longer reads as \"nothing found\".",
      "Song stars were drawn at double their size and overlapping — fixed, along with the tap targets.",
      "Version numbers now read 3.0.1 rather than counting up by one.",
    ],
  },
];

/** The release someone is running right now. */
export function currentRelease() {
  return RELEASES.find((r) => r.version === APP_VERSION) || RELEASES[0];
}

// ---------- the guide ----------

/**
 * Written as "what you'd want to know in the first five minutes", per module,
 * so it works as a first read AND as a refresher on one part. Sections open
 * one at a time — a wall of every instruction at once is what makes people
 * close a guide.
 */
export const GUIDE = [
  {
    key: "start",
    title: "Getting around",
    icon: "books",
    steps: [
      ["The home screen is the menu", "Each tile is a section. Tap one to open it full screen; the arrow at the top left brings you back."],
      ["The + adds things", "It appears in the sections where adding makes sense — Books and Records."],
      ["Everything stays on this phone", "There's no account and no server. Your library lives in this browser, which is why the backup in Settings matters."],
      ["Add it to your home screen", "In Safari, Share → Add to Home Screen. It then opens like an app and works offline."],
    ],
  },
  {
    key: "books",
    title: "Books",
    icon: "books",
    steps: [
      ["Add by scanning", "Tap the camera in the search row and point it at the barcode on the back. The title, author and cover are filled in for you. No barcode? Type the details in yourself."],
      ["Three shelves", "Library is what you own, Wishlist is what you want, Borrowed is what someone lent you. The heart tab is your favourites, which cut across all three."],
      ["Mark where you are", "To Read, Reading, Read. Setting a book to Reading is also what makes new words file under it."],
      ["Reviews and ratings", "Tap the pencil in Your notes. Stars go in halves — tap the left or right side of a star. A review belongs to the book, so it shows on every copy or edition you own."],
      ["Lending", "Each copy tracks who has it and since when. Add a second copy if you own two."],
      ["Renaming an author", "Editing an author offers to rename every other book by them — useful when you want a name written one particular way."],
    ],
  },
  {
    key: "lps",
    title: "Records",
    icon: "lps",
    steps: [
      ["Add by barcode or by hand", "Same as books. Sleeve art comes from the Cover Art Archive; if the automatic one is wrong, Change art lets you pick or photograph your own."],
      ["Condition", "Each copy can be graded Mint through Good. You can sort the shelf by it."],
      ["Tracklists", "Open a record and tap Get tracklist. It asks which pressing you own — the track count is usually what tells them apart — and remembers your answer."],
      ["Rating songs", "Every track has stars and a heart. Your album rating stays your own; the track average is shown next to it so you can see where they disagree."],
      ["Prices", "Stackt links out to Discogs rather than quoting a price, because a price it stored would be wrong within a week."],
    ],
  },
  {
    key: "words",
    title: "Words",
    icon: "words",
    steps: [
      ["Look one up", "Type the word and tap Look up. You get the meaning, how it's said, and usually a real sentence from a book."],
      ["It files itself", "The word is saved under whatever you're reading. Reading two books? Both are offered as chips — tap the other one to switch. Another book… reaches everything else on your shelf."],
      ["No entry found", "Some words aren't in the dictionary. Write the meaning yourself and it's saved just the same."],
      ["My words", "The button at the top right is everything you've saved. Search it, sort it, or group it by book."],
      ["From a book", "A book's page lists the words you looked up while reading it, with a button through to the rest."],
    ],
  },
  {
    key: "share",
    title: "Sharing",
    icon: "share",
    steps: [
      ["Share a shelf", "The share icon next to + makes a picture of your collection — a wall of covers, or your numbers."],
      ["Choose what goes in", "Tap Choose to pick individual books or records. There's a search box and filters for rating, favourites and author."],
      ["Two shapes", "Square for a post, tall for a story."],
      ["Share one thing", "Books and records have their own share icon, and a reviewed book can share the review as a card."],
    ],
  },
  {
    key: "storage",
    title: "Storage and backups",
    icon: "settings",
    steps: [
      ["Back up regularly", "Settings → Back up my library saves a file with everything in it. Do it before clearing Safari's data or moving phones — there's no copy anywhere else."],
      ["Photos versus covers", "Photos you took are kept forever and travel in your backup. Covers downloaded from the web are only a cache and can be cleared safely; they come back as you browse."],
      ["Covers missing?", "Settings → Check covers tests every one and says which are fine, which need refetching, and which are broken."],
      ["Restore", "The same Settings screen takes a backup file back in. It replaces what's there, so back up first if you're unsure."],
    ],
  },
];

// ---------- the sheets ----------

function releaseHtml(release, { heading }) {
  return `
    <div class="cover-picker-head">
      <h2>${escapeHtml(heading)}</h2>
      <button class="lightbox-close" id="wnClose" type="button" aria-label="Close"><span class="btn-icon">${ICONS.close}</span></button>
    </div>
    <p class="release-version">Version ${escapeHtml(release.version)} · ${escapeHtml(release.date)}</p>
    <p class="release-title">${escapeHtml(release.title)}</p>
    ${release.highlights && release.highlights.length
      ? `<ul class="release-highlights">${release.highlights
          .map((h) => `<li>${escapeHtml(h)}</li>`)
          .join("")}</ul>`
      : ""}
    ${release.notes && release.notes.length
      ? `<p class="cover-picker-label">Everything in this release</p>
         <ul class="release-notes">${release.notes
           .map((n) => `<li>${escapeHtml(n)}</li>`)
           .join("")}</ul>`
      : ""}
  `;
}

/**
 * The release notes.
 *
 * `firstRun` swaps the changelog for a welcome — a brand-new user has nothing
 * to compare against, and "what's changed" is a strange first thing to read.
 */
export function openWhatsNew({ firstRun = false, onGuide = null } = {}) {
  const release = currentRelease();
  openOverlay("cover-picker-backdrop", (overlay) => {
    overlay.innerHTML = `
      <div class="cover-picker whats-new">
        ${firstRun
          ? `
          <div class="cover-picker-head">
            <h2>Welcome to Stackt</h2>
            <button class="lightbox-close" id="wnClose" type="button" aria-label="Close"><span class="btn-icon">${ICONS.close}</span></button>
          </div>
          <p class="release-blurb">
            A catalogue for the things on your shelves — books, records, and the
            words you meet while reading. Everything stays on this phone.
          </p>
          <ul class="release-highlights">
            ${currentRelease().highlights.map((h) => `<li>${escapeHtml(h)}</li>`).join("")}
          </ul>
          <p class="release-version">Version ${escapeHtml(APP_VERSION)}</p>
        `
          : releaseHtml(release, { heading: "What's new" })}
        <div class="wn-actions">
          <button class="btn btn-primary block-btn" id="wnGuide" type="button">
            ${firstRun ? "Show me how it works" : "Open the guide"}
          </button>
          <button class="btn btn-secondary block-btn" id="wnDone" type="button">
            ${firstRun ? "I'll explore myself" : "Done"}
          </button>
        </div>
      </div>
    `;
    overlay.addEventListener("click", (e) => { if (e.target === overlay) dismissLayer(); });
    overlay.querySelector("#wnClose").addEventListener("click", () => dismissLayer());
    overlay.querySelector("#wnDone").addEventListener("click", () => dismissLayer());
    overlay.querySelector("#wnGuide").addEventListener("click", () => {
      dismissLayer();
      // Let the overlay finish tearing down before the next one opens, or the
      // second sheet lands under the first one's backdrop.
      setTimeout(() => (onGuide ? onGuide() : openGuide()), 60);
    });
  });
  markSeen();
}

/** Every release, for someone who wants the history. */
export function openReleaseHistory() {
  openOverlay("cover-picker-backdrop", (overlay) => {
    overlay.innerHTML = `
      <div class="cover-picker">
        <div class="cover-picker-head">
          <h2>Release notes</h2>
          <button class="lightbox-close" id="rhClose" type="button" aria-label="Close"><span class="btn-icon">${ICONS.close}</span></button>
        </div>
        ${RELEASES.map(
          (r) => `
          <div class="release-entry">
            <p class="release-version">Version ${escapeHtml(r.version)} · ${escapeHtml(r.date)}</p>
            <p class="release-title">${escapeHtml(r.title)}</p>
            <ul class="release-notes">${(r.notes || r.highlights || [])
              .map((n) => `<li>${escapeHtml(n)}</li>`)
              .join("")}</ul>
          </div>
        `
        ).join("")}
      </div>
    `;
    overlay.addEventListener("click", (e) => { if (e.target === overlay) dismissLayer(); });
    overlay.querySelector("#rhClose").addEventListener("click", () => dismissLayer());
  });
}

/**
 * The guide. `openKey` jumps straight to one section, so "remind me how
 * tracklists work" doesn't mean reading about the home screen first.
 */
export function openGuide({ openKey = null } = {}) {
  openOverlay("cover-picker-backdrop", (overlay) => {
    overlay.innerHTML = `
      <div class="cover-picker guide-sheet">
        <div class="cover-picker-head">
          <h2>How to use Stackt</h2>
          <button class="lightbox-close" id="gdClose" type="button" aria-label="Close"><span class="btn-icon">${ICONS.close}</span></button>
        </div>
        <p class="release-blurb">Pick the part you want. Nothing here is required reading.</p>
        <div class="guide-sections">
          ${GUIDE.map(
            (section) => `
            <div class="guide-section ${openKey === section.key ? "open" : ""}" data-section="${escapeHtml(section.key)}">
              <button class="guide-head" type="button" aria-expanded="${openKey === section.key}">
                <span class="guide-icon">${ICONS[section.icon] || ""}</span>
                <span class="guide-title">${escapeHtml(section.title)}</span>
                <span class="guide-chevron" aria-hidden="true"></span>
              </button>
              <div class="guide-body">
                ${section.steps
                  .map(
                    ([heading, body]) => `
                  <div class="guide-step">
                    <p class="guide-step-title">${escapeHtml(heading)}</p>
                    <p class="guide-step-body">${escapeHtml(body)}</p>
                  </div>
                `
                  )
                  .join("")}
              </div>
            </div>
          `
          ).join("")}
        </div>
      </div>
    `;
    overlay.addEventListener("click", (e) => { if (e.target === overlay) dismissLayer(); });
    overlay.querySelector("#gdClose").addEventListener("click", () => dismissLayer());

    overlay.querySelectorAll(".guide-section").forEach((section) => {
      const head = section.querySelector(".guide-head");
      head.addEventListener("click", () => {
        const wasOpen = section.classList.contains("open");
        // One at a time. Six open sections is the wall of text this is meant
        // to avoid.
        overlay.querySelectorAll(".guide-section").forEach((s) => {
          s.classList.remove("open");
          s.querySelector(".guide-head").setAttribute("aria-expanded", "false");
        });
        if (!wasOpen) {
          section.classList.add("open");
          head.setAttribute("aria-expanded", "true");
        }
      });
    });
  });
}

// ---------- has this version been seen? ----------

function readSeen() {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch (err) {
    return null; // private browsing: treat as never seen, but never crash
  }
}

export function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, APP_VERSION);
  } catch (err) {
    /* nothing we can do, and nothing worth breaking the app over */
  }
}

/**
 * What, if anything, to show on launch.
 *
 * "first" for someone who has never opened it, "update" when the version moved
 * since last time, and null when they're up to date — so the popup appears
 * exactly once per release and never nags.
 */
export function launchPrompt() {
  const seen = readSeen();
  if (!seen) return "first";
  if (seen !== APP_VERSION) return "update";
  return null;
}
