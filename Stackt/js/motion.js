// ============================================
// The motion language.
//
// One rule decides everything in here: EXTRAVAGANCE IS SPENT WHERE IT'S RARE.
// Opening a module happens a few times a session, so it gets a second of
// choreography. Tapping a card happens fifty times, so it gets 100ms and stays
// out of the way. That's the same reasoning the Food module runs on — a photo
// and a name is a complete entry, because anything slower and you stop using
// the app.
//
// WHY THIS ISN'T GSAP. The plan called for it, and for SplitText, MorphSVG and
// Flip it still will. But the module entry is a FIXED sequence over known
// elements: no runtime-computed targets, no physics. CSS keyframes run on the
// compositor and can't stutter while the main thread is decoding a photo out
// of IndexedDB, which is the one real performance risk on this screen. So the
// primitives are CSS and this file is only the conductor — it starts them in
// order, calls the DOM swap at the right beat, and cleans up. A dependency
// buys nothing here and costs 25KB plus a main-thread animation loop.
//
// WHAT WAS LEARNED THE LAST TIME. animations.js carries a note: a veil that
// expanded a coloured rectangle out of the tapped tile was tried and removed,
// because it "reads as a flat block sliding over the screen rather than an app
// opening", and because it covered the menu's own zoom-out on the way back.
// Both are addressed rather than ignored:
//
//   1. The colour is not a curtain that covers and uncovers. It sweeps up
//      THROUGH the screen and keeps going off the top — one direction, never
//      reversed. A curtain reads as a curtain because it comes back the way it
//      came; something that passes through reads as a scene change.
//
//      The first build of this got it wrong in the other direction: it grew
//      the colour out of the tile and then contracted it back into the header.
//      Two gestures pointing opposite ways, cancelling in the middle, and the
//      contraction target had to be guessed — it landed on the search bar.
//      A sweep has nothing to aim at, which is why it cannot miss.
//   2. Nothing wipes on the way back. Going home is still carried by the
//      menu's zoom-out, untouched.
// ============================================

const LEVEL_KEY = "stackt-motion";

/** 'full' plays the set pieces; 'plain' is the app exactly as it was. */
export function motionLevel() {
  try {
    return localStorage.getItem(LEVEL_KEY) === "plain" ? "plain" : "full";
  } catch (e) {
    return "full";
  }
}

export function setMotionLevel(level) {
  try {
    localStorage.setItem(LEVEL_KEY, level === "plain" ? "plain" : "full");
  } catch (e) {
    /* a private window can refuse; the default is fine */
  }
}

function prefersReduced() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {
    return false;
  }
}

/** Whether a set piece should play at all. */
export function bigMotionOn() {
  return motionLevel() === "full" && !prefersReduced();
}

// ---------- the conductor ----------

/* The beats, in milliseconds from the tap. Named because the relationships
   between them are the design, and editing one without the others breaks it:

     0      the tile lifts, the menu heading fades
     50-162 the other four are thrown, staggered
     220    the colour starts up from below the screen   (CSS delay)
     560    the colour has covered the screen            (CSS 43.5%)
     600    SWAP — the router paints, entirely unseen
     700    the colour leaves off the top                (CSS 61.5%)
     700    the new heading and rows cascade in behind it
     1300   teardown

   The 220ms of stillness before the colour moves is what makes the scatter
   visible at all; the 140ms hold at full cover is the window the paint has to
   finish in. Both are matched to percentages in the moWipe keyframe, so if you
   change these, change those. */
const T_SWAP = 600;
const T_REVEAL = 700;
const T_DONE = 1300;

/**
 * Which way each tile flies when its neighbour is chosen.
 *
 * Fixed vectors rather than computed ones: the home grid is a known five-tile
 * layout, and hand-picked directions read as deliberate where a formula reads
 * as a formula. Each gets its own rotation so nothing moves in lockstep — that
 * lockstep is what made the earlier version look mechanical.
 */
function scatterVector(index, heroIndex, total) {
  const dirs = [
    { x: -120, y: -90, r: -26 },
    { x: 118, y: -74, r: 22 },
    { x: -112, y: 96, r: 19 },
    { x: 114, y: 104, r: -24 },
    { x: -20, y: 150, r: 12 },
    { x: 24, y: -150, r: -14 },
  ];
  // Tiles below the chosen one push down, above push up — so the scatter
  // reads as being shoved aside BY the tile you touched.
  const offset = index < heroIndex ? index : index - 1;
  const v = dirs[offset % dirs.length];
  return total > 4 ? v : { x: v.x * 0.8, y: v.y * 0.8, r: v.r };
}

let running = null;

/** Stops whatever is mid-flight and puts the DOM back to a resting state. */
export function cancelModuleEntry() {
  if (!running) return;
  const { cleanup } = running;
  running = null;
  try { cleanup(); } catch (e) { /* never let teardown break navigation */ }
}

/**
 * The module-entry set piece.
 *
 * `swap` is the router's real paint. It is called EXACTLY ONCE, whatever
 * happens — covered by the block if the animation runs, immediately if it
 * can't. An animation that can fail to render the screen is not an animation,
 * it's an outage.
 */
export function moduleEntry({ tile, accent, swap }) {
  // `isConnected` is not paranoia. Tap one tile and then another inside the
  // 600ms before the swap: cancelling the first entry paints its module, which
  // wipes the home grid, so the second tile arrives here detached and its
  // scatter would animate elements nobody can see. Take the plain slide
  // instead — the screen is what matters, not the flourish.
  if (!bigMotionOn() || !tile || !accent || !tile.isConnected) {
    swap();
    return;
  }

  cancelModuleEntry();

  const app = document.getElementById("app");
  const grid = tile.parentElement;
  if (!app || !grid) {
    swap();
    return;
  }

  const tiles = [...grid.children];
  const heroIndex = tiles.indexOf(tile);
  const screen = grid.closest(".home-screen");

  // No measuring. The sweep is full-bleed and starts below the viewport, so
  // unlike the grow-out-of-the-tile version it needs no geometry at all —
  // which also means there is no rectangle to get wrong.
  const panel = document.createElement("div");
  panel.className = "mo-panel";
  panel.style.background = accent;

  let swapped = false;
  const doSwap = () => {
    if (swapped) return;
    swapped = true;
    swap();
  };

  const timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));

  const cleanup = () => {
    timers.forEach(clearTimeout);
    tiles.forEach((t) => {
      t.classList.remove("mo-hero", "mo-away");
      t.style.removeProperty("--mo-dx");
      t.style.removeProperty("--mo-dy");
      t.style.removeProperty("--mo-rot");
      t.style.animationDelay = "";
    });
    if (screen) screen.classList.remove("mo-leaving");
    panel.remove();
    const view = document.getElementById("view");
    if (view) view.classList.remove("mo-cascade");
    doSwap(); // the screen must exist even if we were interrupted
  };

  running = { cleanup };

  // ---- beat 1: the tile you touched comes off the page, the menu lets go ----
  tile.classList.add("mo-hero");
  if (screen) screen.classList.add("mo-leaving");

  // ---- beat 2: the others are thrown aside ----
  tiles.forEach((t, i) => {
    if (t === tile) return;
    const v = scatterVector(i, heroIndex, tiles.length);
    t.style.setProperty("--mo-dx", `${v.x}px`);
    t.style.setProperty("--mo-dy", `${v.y}px`);
    t.style.setProperty("--mo-rot", `${v.r}deg`);
    // Last one lands at ~562ms, which is when the colour finishes covering.
    t.style.animationDelay = `${50 + i * 28}ms`;
    t.classList.add("mo-away");
  });

  // ---- beat 3: the colour sweeps up through the screen ----
  // Appended now, but its own CSS delay holds it below the fold for 220ms so
  // the scatter above plays in clear air.
  app.appendChild(panel);
  void panel.offsetWidth; // commit the resting transform before animating
  panel.classList.add("mo-wipe");

  // ---- beat 4: the swap, inside the hold, entirely unseen ----
  later(doSwap, T_SWAP);

  // ---- beat 5: the rows cascade in while the colour is still leaving ----
  later(() => {
    const view = document.getElementById("view");
    if (view) {
      view.classList.remove("mo-cascade");
      void view.offsetWidth;
      view.classList.add("mo-cascade");
    }
  }, T_REVEAL);

  later(() => {
    panel.remove();
    const view = document.getElementById("view");
    if (view) view.classList.remove("mo-cascade");
    tiles.forEach((t) => {
      t.classList.remove("mo-hero", "mo-away");
      t.style.animationDelay = "";
    });
    if (screen) screen.classList.remove("mo-leaving");
    running = null;
  }, T_DONE);
}
