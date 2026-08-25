// ============================================
// Animation helpers — the "playful & bold" motion vocabulary.
// Every module calls into these instead of inventing its own motion,
// so the whole app feels like one consistent system.
// ============================================

const PALETTE = ["#FF3B6B", "#3D5AFE", "#FFC738", "#00D9A3", "#8B5CF6"];

/** Quick scale-down/up tap feedback on any element. */
export function bounceTap(el) {
  if (!el) return;
  el.style.transition = "transform .12s cubic-bezier(.5,1.8,.6,1)";
  el.style.transform = "scale(0.9)";
  requestAnimationFrame(() => {
    setTimeout(() => { el.style.transform = "scale(1)"; }, 100);
  });
}

/** Pop-in entrance for a single element (e.g. a newly added card). */
export function popIn(el) {
  if (!el) return;
  el.animate(
    [
      { transform: "scale(0.4)", opacity: 0 },
      { transform: "scale(1.08)", opacity: 1, offset: 0.7 },
      { transform: "scale(1)", opacity: 1 },
    ],
    { duration: 420, easing: "cubic-bezier(.34,1.56,.64,1)" }
  );
}

/* staggerIn was removed: per-card entrance animations replayed on every
   render and fought the page-level view transition, which is what read as
   jitter. Screen changes are carried by the directional slide instead. */

/** Small celebratory confetti burst from a point on screen (e.g. after
 * marking something "read" or hitting a savings goal). Cleans itself up. */
export function confettiBurst(x, y, count = 18) {
  const root = document.getElementById("celebrationRoot");
  if (!root) return;
  for (let i = 0; i < count; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    piece.style.background = PALETTE[i % PALETTE.length];
    piece.style.left = `${x}px`;
    piece.style.top = `${y}px`;
    root.appendChild(piece);

    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 90;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 40; // bias upward a bit
    const rot = (Math.random() - 0.5) * 720;

    const anim = piece.animate(
      [
        { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
        {
          transform: `translate(${dx}px, ${dy + 140}px) rotate(${rot}deg)`,
          opacity: 0,
        },
      ],
      { duration: 900 + Math.random() * 400, easing: "cubic-bezier(.2,.7,.3,1)" }
    );
    anim.onfinish = () => piece.remove();
  }
}

/** Wraps a DOM-swapping render function in the View Transitions API when
 * available, falling back to a CSS class-based slide.
 * `direction` is "forward" (going deeper) or "back" (returning) — the screen
 * slides in from the right going forward and from the left coming back, which
 * reads as real navigation rather than a generic cross-fade. */
export function transitionSwap(renderFn, direction = "forward", opts = {}) {
  const view = document.getElementById("view");

  // Deliberately NOT using document.startViewTransition. It snapshots the whole
  // page, which Safari handles badly alongside a sticky header and 100dvh — that
  // was the flicker. Animating just the content container is predictable.
  view.classList.remove("view-enter-fwd", "view-enter-back");
  renderFn();

  // A back-gesture is already being animated by iOS itself; adding our own on
  // top is the double-animation that read as jitter.
  if (opts.silent) return;

  void view.offsetWidth; // force reflow so the animation replays
  view.classList.add(direction === "back" ? "view-enter-back" : "view-enter-fwd");
}

export function nudge(el) {
  if (!el) return;
  el.animate(
    [
      { transform: "translateX(0)" },
      { transform: "translateX(-6px)" },
      { transform: "translateX(6px)" },
      { transform: "translateX(-3px)" },
      { transform: "translateX(0)" },
    ],
    { duration: 340, easing: "cubic-bezier(.34,1.56,.64,1)" }
  );
}
