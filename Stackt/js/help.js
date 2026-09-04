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

export const APP_VERSION = "4.1.0";

/** Where the last-seen version is remembered, so the popup shows once. */
const SEEN_KEY = "stackt-seen-version";

/**
 * Newest first. `highlights` are the two or three things worth a sentence;
 * `notes` is the rest. Keep both in plain language — this is read by someone
 * who wants to know what's different, not a commit log.
 */
export const RELEASES = [
  {
    version: "4.1.0",
    date: "September 2026",
    title: "Which shop was the cheap one?",
    highlights: [
      "Price hunt: note what each shop charges for the same thing, and the cheapest is worked out and marked for you.",
      "Locations are a real map now — use where you are, or drag the pin to where the place actually is.",
      "Food has changed colour, and the examples are food you'd actually eat.",
    ],
    notes: [
      "Open anything on your wishlist and add a shop: who, where, how much, and when you saw it. Add as many as you visited.",
      "The list sorts cheapest first and each row shows what it costs you over the best price, so you're comparing the decision rather than doing subtraction.",
      "The saving is measured against the SECOND cheapest, not the dearest — the dearest was never the choice you were going to make.",
      "The cheapest quote becomes the price the plan runs on, so the schedule and the noted-versus-paid comparison follow the hunt without you doing anything.",
      "Correct a price and the order re-sorts; remove the winner and the next one takes over. Buying it clears the hunt.",
      "A shop can be pinned on the map too, because \"the one in Mid Valley\" stops meaning anything three months later.",
      "The map is OpenStreetMap and it's drawn on your phone; nothing about where you are is sent anywhere. The map images need a connection, but the pin works without one.",
      "Food's colour is now magenta.",
    ],
  },
  {
    version: "4.0.0",
    date: "September 2026",
    title: "Food, and what Stackt is now",
    highlights: [
      "A new Food section: places you've eaten, the dishes there, and whether you'd go back.",
      "A photo and a name is a whole entry. Everything else — the rating, the dishes, what you spent — waits until you feel like it.",
      "Stackt isn't only a library any more. It's what you've read, heard, learned and eaten.",
    ],
    notes: [
      "Open a place and its best dishes are at the top, because \"what do I order here again\" is the question you opened it to answer.",
      "Dishes belong to the place rather than to one visit, so \"their rendang is a 5\" stays true however many times you go.",
      "Tags are tappable and fixed rather than typed, which is what makes them the one thing you can filter the shelf by later.",
      "Writing gives you questions to answer instead of an empty box — first impression, the pricing, the service, who you'd bring.",
      "Sort by longest-since-visited to answer \"where tonight\" out of your own history.",
      "A want-to-try list sits on the same shelf, with no prices and no planning. One tap moves a place across once you've been.",
      "Your phone can stamp where you are, so a stall that appears on no map still gets a location. Nothing is sent anywhere, and you can open the place in Maps later.",
      "Meal photos are shrunk on the way in, the same as covers, and travel in your backups.",
      "What you spend on a meal is kept well away from the wishlist budget — that pot is for things you're saving up for.",
      "The Photos tile is gone. It said \"coming soon\" for six versions and never had a job; photos now live inside food entries, doing one.",
    ],
  },
  {
    version: "3.5.0",
    date: "September 2026",
    title: "Fixing it where you found it",
    highlights: [
      "Tap anything on the wishlist to open it — mark it as bought, and say what you paid, without leaving the planner.",
      "Picked the wrong pressing? The tracklist can be swapped now, and your song ratings come across with it.",
      "Buttons that came out bright blue on iPhone are black again.",
    ],
    notes: [
      "Marking something as bought from the wishlist records it exactly as marking it from Books or Records does — same copy, same benchmark, same effect on the balance.",
      "A wrongly-typed price is editable in the same sheet, so a 40 that should have been 400 costs one tap rather than a trip through another module.",
      "Pinning an item as next is a labelled button now instead of an unmarked tap on the row, which used to reshuffle the plan without saying so.",
      "Buying the pinned item clears the pin, and removing a priced want still records that you decided against it.",
      "Changing a pressing warns first, shows which one you have now, and carries ratings and hearts across by song title — then says how many didn't match.",
      "The track title and length boxes were bare browser textboxes; they now match every other field in the app, and no longer make iOS zoom in when you tap them.",
      "The blue text was iOS Safari's default for any button with no colour set. It's now set once for every button rather than one selector at a time, so it can't come back on the next thing that gets added.",
    ],
  },
  {
    version: "3.4.0",
    date: "September 2026",
    title: "The budget pushes back",
    highlights: [
      "What you buy now comes off the budget, so going over shows as overdrawn instead of being ignored.",
      "An overdrawn balance slides the whole plan later, which is the budget actually doing its job.",
      "The price on a copy is tappable — fix a wrong one without moving the item back to the wishlist.",
    ],
    notes: [
      "Before this, a bargain that blew the budget still showed green: the app only compared what you paid to the price you'd noted, and never to what you could afford. Those are different questions.",
      "The balance is a running pot, not a calendar-month comparison — saving for four months and then spending it isn't overspending, and a month-by-month check would have called it that.",
      "Changing the budget keeps the balance you're on and starts accruing at the new rate from that day, rather than recalculating your history at a rate you only just chose.",
      "Tapping the price on a copy reopens the sheet from the till, with both the noted price and what you paid editable.",
      "The price used to be buried behind the pencil next to the dates, which is why a typo meant a round trip through the wishlist.",
    ],
  },
  {
    version: "3.3.0",
    date: "September 2026",
    title: "A plan, not a report",
    highlights: [
      "Set one monthly budget and the wishlist becomes a schedule — what you can get now, and when the rest arrive.",
      "Unspent budget rolls over, so the expensive ones do eventually come round.",
      "Everything about past spending is gone. No more filling in what a paperback cost you in 2019.",
    ],
    notes: [
      "The plan is simulated month by month rather than dividing by the budget — lumpy prices push things later than the arithmetic suggests, and dividing hid that.",
      "Longest-wanted goes first; tap any item to pin it as next instead, or switch to cheapest-first.",
      "The queue holds rather than skipping ahead, so cheap things can't keep eating the budget while the one you've wanted for a year never arrives.",
      "It still tells you what jumping the queue would cost.",
      "Wants with no price are listed separately — a guess there would corrupt every date below it.",
      "Noted price against what you actually paid is now a side-by-side chart.",
      "Removed: total spent, the month and year figures, the twelve-month spending chart, and the fill-in-what-you-paid list.",
    ],
  },
  {
    version: "3.2.0",
    date: "September 2026",
    title: "The hunt",
    highlights: [
      "The Ledger is now a Wishlist — what you want, and how well you bought it.",
      "Note a price before you buy; when you find it cheaper, the difference is counted.",
      "Overs are counted the same as unders, so the net figure is worth believing.",
    ],
    notes: [
      "The price you note is a benchmark you set before knowing what you'd pay — which is what makes beating it a real result, unlike beating a budget you can quietly raise.",
      "Buying something off the wishlist now asks what you actually paid, with the noted price shown beside it.",
      "Both numbers are kept on the copy, so editing a price later can't rewrite what you saved.",
      "Wants are ordered by how long you've wanted them, and priced in weeks at your usual rate.",
      "Deleting a priced want without buying it is tallied as something you decided against.",
      "The twelve-month chart stays, with your usual month marked across it.",
      "A benchmark older than four months is flagged before it's trusted.",
      "No 'total saved' anywhere — a figure that only ever grows is one that stops meaning anything.",
    ],
  },
  {
    version: "3.1.0",
    date: "September 2026",
    title: "The Ledger",
    highlights: [
      "A Ledger: what your collection has cost, month by month.",
      "What you paid is now kept on each copy — it used to be thrown away the moment you bought something.",
      "A fill-in list for everything you already own.",
    ],
    notes: [
      "Finance is now Ledger. It records what you spent; it was never going to be a budgeting app, and the old name promised one.",
      "A wishlist price becomes what you paid when the item joins your shelf, instead of being deleted.",
      "Each copy carries its own price, so two copies of the same record can differ.",
      "Spending is split between books and records, with the last twelve months as a chart.",
      "Totals say how many copies they cover, so a partial total never pretends to be complete.",
      "The wishlist total shows what finishing it would cost.",
      "No valuation of what things are worth now — that needs live market data a private app can't get, so the Discogs and Kinokuniya links remain the honest answer.",
    ],
  },
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
      ["The + adds things", "It appears in the sections where adding makes sense — Books, Records and Food."],
      ["What Stackt is for", "Things you've read, heard, learned and eaten. Books and Records are what you own; Words is what you've looked up; Food is where you've been and what you thought of it."],
      ["Everything stays on this phone", "There's no account and no server. All of it lives in this browser, which is why the backup in Settings matters."],
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
      ["Wrong pressing", "Tap the pencil on the tracklist and choose Wrong pressing? Pick another. It shows which one you picked before, and ratings you've already given move across wherever the song titles match."],
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
    key: "food",
    title: "Food",
    icon: "food",
    steps: [
      ["A photo and a name is enough", "Tap +, photograph what you're eating, type where you are, save. That's a finished entry — nothing else is ever required, and nothing goes red for being empty."],
      ["The rest can wait", "Open the place later and add the rating, the dishes, what you spent, whatever you want to say. On the sofa, next morning, or never."],
      ["Dishes are the point", "Add what you ate, give it stars and a heart. They're listed best-first, so opening a place answers \"what do I order here again\" without scrolling."],
      ["A dish belongs to the place", "Not to one evening. Rate the rendang once and it stays rated however many times you go back."],
      ["Tags, not just writing", "Tap words like cheap, spicy or long queue. They're the only part you can filter the shelf by afterwards — a paragraph can't answer \"everything spicy I rated 4 or more\"."],
      ["It gives you questions", "Writing a note offers things to answer — first impression, the pricing, the service, who you'd bring. Answer one, ignore the rest."],
      ["Where tonight?", "Sort by Last visited, longest ago first: somewhere you liked and haven't been to lately. Your own history, not a review site's."],
      ["Want to try", "The second tab. Add a place you haven't been to yet, and tap I've been now once you go — it moves across and records the visit."],
      ["Put it on the map", "Use your location while you're standing there, or drag the pin to where the place actually is — handy for the stall you're remembering from this morning. Nothing about where you are is sent anywhere, and you get an Open in Maps link on the place."],
      ["No signal, no problem", "The map pictures need a connection, but the pin doesn't. You can still place somewhere with no bars; you just won't see the streets."],
      ["Your money stays separate", "What a meal cost is recorded on the visit and kept away from the Wishlist budget. That pot is for things you're saving up for, and dinner coming out of it would make the plan meaningless."],
      ["Photos are shrunk", "Every picture is re-encoded smaller on the way in, the same as covers, and goes with your backup. Settings shows how much room they're taking."],
    ],
  },
  {
    key: "wishlist",
    title: "Wishlist",
    icon: "wishlist",
    steps: [
      ["Set a budget", "One number: what you can put aside each month. The wishlist turns into a schedule — what's within reach now, and which month the rest come round."],
      ["It saves up", "Unspent budget carries over, so something costing more than a month's budget still arrives; it just takes a few months."],
      ["And it keeps count", "What you buy through the app comes off the balance. Spend more than you have and it shows as overdrawn, and everything on the plan slides later until you've caught up."],
      ["Tap any row", "Opening an item from the wishlist is how you mark it as bought, say what you paid, fix a wrong price, pin it as next, or drop it. You never have to go and find it in Books or Records to do that."],
      ["Price hunt", "Been round four shops? Add each one — who, where, how much, when you saw it. They're listed cheapest first with the best marked, and each row shows what it would cost you over that best price."],
      ["It picks the price for you", "The cheapest quote becomes the price the plan runs on. Correct one and the order re-sorts; delete the winner and the next takes over. You never keep two numbers in step by hand."],
      ["Cheaper than what?", "The saving is against the second cheapest, not the dearest. Comparing to the dearest would flatter you with a price you were never going to pay."],
      ["Pin the shop", "A shop can go on the map, because \"the one in Mid Valley\" stops meaning anything three months later."],
      ["Fixing a price", "Tap the price on any copy to correct what you paid — or the price you'd noted, if that was the wrong one."],
      ["Note the price first", "Add something to your wishlist with the price you found online. That number is the point: it's what you're trying to beat."],
      ["Then go hunting", "Find it cheaper — a secondhand copy, a good preloved pressing — and the difference is counted when you add it to your shelf."],
      ["It asks what you paid", "Tapping I got a copy shows the price you'd noted and asks what it actually cost. One tap, and the win is recorded while you remember it."],
      ["It counts the overs too", "Pay more than you noted and it says so. A tally that only ever congratulates you isn't one you'd believe."],
      ["Wanted since", "The queue runs longest-wanted first. Open one and choose Get this one next to pin it, or switch the whole list to cheapest-first."],
      ["It won't skip ahead", "The plan waits rather than buying cheaper things out of turn — otherwise the expensive record you've wanted all year never arrives. It does tell you what jumping would cost."],
      ["Talked yourself out of it", "Delete a priced want without buying it and it's tallied separately — decisions you made, which isn't quite the same as money saved."],
      ["What it won't tell you", "What your collection is worth now. That needs live market prices this app can't fetch, and a stale valuation is worse than none — the Discogs and Kinokuniya links are there for that."],
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
