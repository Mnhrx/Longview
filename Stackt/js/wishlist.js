// ============================================
// Wishlist — what you want, and when you can have it.
//
// A PLANNER, not a spending tracker. Two earlier attempts got this wrong by
// leading with what you'd already spent, which meant opening the screen with a
// demand: fill in what a paperback cost you in 2019. Nobody remembers, and a
// module that starts with a chore is one you close.
//
// So the only number you ever type is a monthly budget, and everything else is
// arithmetic on prices you were already noting down.
//
// The scheduling model is a POT, not a per-month allowance: unspent budget
// rolls over. Without rollover nothing costing more than one month's budget
// could ever be bought, which would be nonsense. And the plan is simulated
// month by month rather than dividing the total by the budget — $860 at $200 a
// month is 4.3 months, but lumpy prices can push the last item into the fifth,
// and dividing would quietly lie about that.
// ============================================

import { openOverlay, dismissLayer, escapeHtml } from "./ui.js";
import { bounceTap, nudge } from "./animations.js";
import { ICONS } from "./icons.js";
import { outcome, askWhatYouPaid, parseAmount } from "./purchase.js";
import { uid } from "./core.js";
import { openMapPicker } from "./mapper.js";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
                "August", "September", "October", "November", "December"];
const DAY = 86400000;

/** Far enough out that a date stops being useful and becomes discouraging. */
const HORIZON = 24;

function money(n) {
  const v = Number(n) || 0;
  return Math.abs(v) >= 1000
    ? `$${Math.round(v).toLocaleString()}`
    : `$${v.toFixed(2)}`;
}

function daysSince(date) {
  if (!date) return null;
  const then = new Date(date).getTime();
  if (!Number.isFinite(then)) return null;
  return Math.max(0, Math.round((Date.now() - then) / DAY));
}

function since(days) {
  if (days == null) return "";
  if (days < 14) return `${days} day${days === 1 ? "" : "s"}`;
  if (days < 70) return `${Math.round(days / 7)} weeks`;
  if (days < 730) return `${Math.round(days / 30)} months`;
  return `${(days / 365).toFixed(1)} years`;
}

/** 0 is this month; after that, the month's name, with a year once it wraps. */
function monthLabel(offset) {
  if (offset === 0) return "This month";
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return d.getFullYear() === now.getFullYear()
    ? MONTHS[d.getMonth()]
    : `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// ---------- state ----------

function budgetOf(store) {
  const b = store.get().budget || {};
  return {
    monthly: Number(b.monthly) || 0,
    opening: Number(b.opening) || 0,   // the balance the day the rate was set
    since: b.since || null,            // when that was
    order: b.order === "cheapest" ? "cheapest" : "wanted",
    pinned: b.pinned || null,
  };
}

/** Whole months from one date to now. Same month is 0. */
function monthsSince(iso) {
  if (!iso) return 0;
  const then = new Date(iso);
  if (!Number.isFinite(then.getTime())) return 0;
  const now = new Date();
  return Math.max(
    0,
    (now.getFullYear() - then.getFullYear()) * 12 + (now.getMonth() - then.getMonth())
  );
}

/** Everything bought since the budget started, at what it actually cost. */
function spentSince(store, iso) {
  if (!iso) return 0;
  let total = 0;
  store.get().items.forEach((item) => {
    (item.copies || []).forEach((copy) => {
      if (copy.paid == null) return;
      if (!copy.acquiredDate || copy.acquiredDate < iso) return;
      total += Number(copy.paid);
    });
  });
  return total;
}

/**
 * What's actually available right now.
 *
 * THIS is the fix for a budget that didn't push back. The plan used to start
 * from `opening + monthly` and never look at what you'd spent, so you could
 * blow the month twice over and still be told you were doing well — because
 * the only comparison on screen was paid-against-noted, which is a different
 * question entirely. A good deal and an affordable one are not the same thing.
 *
 * Deliberately NOT a calendar-month comparison. Saving $50 a month for four
 * months and then spending $180 on one record isn't overspending, it's
 * spending savings — which is what the plan is for. The running balance is the
 * only figure that can tell those apart.
 */
export function potOf(store) {
  const b = budgetOf(store);
  if (!b.monthly) return 0;
  return b.opening + monthsSince(b.since) * b.monthly - spentSince(store, b.since);
}

function saveBudget(store, patch) {
  store.update({ budget: { ...budgetOf(store), ...patch } });
}

/** Everything you want but don't have. */
export function wants(store) {
  return store
    .get()
    .items.filter(
      (it) =>
        (it.type === "book" || it.type === "lp") &&
        !(it.copies || []).length &&
        !it.borrowed
    )
    .map((it) => ({
      id: it.id,
      type: it.type,
      title: it.title,
      creator: it.creator || "",
      price: it.price != null ? Number(it.price) : null,
      days: daysSince(it.wantedSince || it.addedDate),
      // How many shops you've priced it at, so the row can say the number is
      // the best of several rather than a single guess.
      shops: (it.quotes || []).length,
    }));
}

/**
 * Priority order.
 *
 * Longest-wanted by default: the app already knows when each want was added,
 * and the record you've wanted since December shouldn't lose its place to
 * something added on Tuesday. A pin overrides everything, because reordering
 * a list by dragging on a phone is miserable and one exception covers the
 * real need.
 */
function prioritise(list, { order, pinned }) {
  const sorted = list.slice().sort((a, b) =>
    order === "cheapest"
      ? (a.price || 0) - (b.price || 0)
      : (b.days || 0) - (a.days || 0)
  );
  if (!pinned) return sorted;
  const i = sorted.findIndex((w) => w.id === pinned);
  if (i > 0) sorted.unshift(sorted.splice(i, 1)[0]);
  return sorted;
}

/**
 * Walks the months, spending from a running balance.
 *
 * Holds the queue rather than skipping ahead. Skipping has a nasty failure
 * mode: cheap things keep eating the budget and the expensive record you've
 * wanted for a year never arrives. Protecting you from that is the job. What
 * jumping WOULD cost is reported separately instead of hidden.
 */
export function buildPlan(priced, { monthly, pot: opening }) {
  if (!monthly) return { rows: [], surplus: 0, reachable: 0 };
  // Starts from the real balance, which can be negative — an overdrawn pot
  // pushes everything out until the budget has caught up, and that sliding is
  // the budget doing its job.
  let pot = opening;
  let month = 0;
  const rows = [];

  for (const item of priced) {
    while (pot < item.price && month < HORIZON) {
      month++;
      pot += monthly;
    }
    if (pot < item.price) {
      rows.push({ ...item, month: null });   // beyond the horizon
      continue;
    }
    pot -= item.price;
    rows.push({ ...item, month });
  }
  return {
    rows,
    surplus: pot,
    reachable: rows.filter((r) => r.month != null).length,
  };
}

/**
 * What buying out of order would cost.
 *
 * Only worth saying when there IS a temptation — something further down the
 * list you could afford right now while the top item is still months away.
 */
function skipCost(priced, budget, plan) {
  const first = plan.rows[0];
  if (!first || first.month === 0 || first.month == null) return null;

  const potNow = budget.pot;
  const jumper = priced
    .slice(1)
    .filter((w) => w.price <= potNow)
    .sort((a, b) => a.price - b.price)[0];
  if (!jumper) return null;

  const reordered = [jumper, ...priced.filter((w) => w.id !== jumper.id)];
  const after = buildPlan(reordered, budget);
  const pushed = after.rows.find((r) => r.id === first.id);
  if (!pushed || pushed.month === first.month) return null;

  return {
    jumper: jumper.title,
    delayed: first.title,
    from: first.month,
    to: pushed.month,
  };
}

/** How things you've already bought turned out against the price you noted. */
function results(store) {
  const out = [];
  store.get().items.forEach((item) => {
    (item.copies || []).forEach((copy) => {
      const res = outcome(copy);
      if (res) out.push({ title: item.title, type: item.type, ...res });
    });
  });
  return out.sort((a, b) => b.diff - a.diff);
}

// ---------- the screen ----------

function planHtml(store) {
  const budget = { ...budgetOf(store), pot: potOf(store) };
  const behind = budget.monthly && budget.pot < 0
    ? Math.ceil(Math.abs(budget.pot) / budget.monthly)
    : 0;
  const all = wants(store);
  const priced = prioritise(all.filter((w) => w.price != null), budget);
  const unpriced = all.filter((w) => w.price == null);
  const plan = buildPlan(priced, budget);
  const jump = budget.monthly ? skipCost(priced, budget, plan) : null;
  const wins = results(store);
  const net = wins.reduce((n, w) => n + w.diff, 0);
  const worst = wins.length ? Math.max(...wins.map((w) => Math.max(w.expected, w.paid))) : 0;

  // Rows carry their month heading only when it changes.
  let lastMonth;
  const planRows = plan.rows
    .map((r) => {
      const head =
        r.month !== lastMonth
          ? `<p class="plan-month">${r.month == null
              ? "Further off than two years"
              : escapeHtml(monthLabel(r.month))}</p>`
          : "";
      lastMonth = r.month;
      return `
      ${head}
      <div class="plan-row ${budget.pinned === r.id ? "pinned" : ""}" data-want="${escapeHtml(r.id)}" data-month="${r.month == null ? "" : r.month}">
        <span class="wr-icon">${r.type === "book" ? ICONS.books : ICONS.lps}</span>
        <span class="wr-main">
          <span class="wr-title">${escapeHtml(r.title)}</span>
          <span class="wr-meta">${r.days != null ? `Wanted ${since(r.days)}` : ""}${
            budget.pinned === r.id ? " · next up" : ""
          }${r.shops > 1 ? ` · best of ${r.shops} shops` : ""}</span>
        </span>
        <span class="wr-price">${money(r.price)}</span>
      </div>`;
    })
    .join("");

  return `
    <p class="view-title">Wishlist</p>

    ${budget.monthly
      ? `<button class="budget-card ${budget.pot < 0 ? "over" : ""}" id="budgetBtn" type="button">
           <span class="bc-main">
             <span class="bc-label">${budget.pot < 0 ? "Overdrawn" : "Available now"}</span>
             <span class="bc-value">${money(Math.abs(budget.pot))}</span>
             <span class="bc-note">
               ${budget.pot < 0
                 ? `${behind} month${behind === 1 ? "" : "s"} to catch up · ${money(budget.monthly)} a month`
                 : `${money(budget.monthly)} a month`}
             </span>
           </span>
           <span class="folder-chip-change">Edit</span>
         </button>`
      : `<button class="budget-empty" id="budgetBtn" type="button">
           <span class="be-main">Set a monthly budget</span>
           <span class="be-sub">
             One number, and the list below turns into a plan — what you can get
             this month, and when the rest come within reach.
           </span>
         </button>`}

    ${!priced.length
      ? `<p class="settings-note">
           Nothing priced on your wishlist yet. Add a book or record as a
           Wishlist item with the price you found, and it'll appear here.
         </p>`
      : !budget.monthly
      ? `<div class="want-list">${planRows}</div>`
      : `
        ${plan.reachable && plan.rows[0] && plan.rows[0].month === 0
          ? `<p class="plan-lead good">
               You can get ${plan.rows.filter((r) => r.month === 0).length}
               of these right now${plan.surplus > 0 && plan.rows.every((r) => r.month === 0)
                 ? `, with ${money(plan.surplus)} left over`
                 : ""}.
             </p>`
          : ""}
        <div class="plan-list">${planRows}</div>
        ${jump
          ? `<p class="plan-warn">
               Buying ${escapeHtml(jump.jumper)} first would push
               ${escapeHtml(jump.delayed)} from ${escapeHtml(monthLabel(jump.from))}
               to ${escapeHtml(monthLabel(jump.to))}.
             </p>`
          : ""}
        <p class="settings-note">
          Longest-wanted first${budget.order === "cheapest" ? " — currently cheapest first" : ""}.
          Unspent budget carries over, so the expensive ones do arrive.
        </p>
        <div class="plan-controls">
          <button class="guide-chip ${budget.order === "wanted" ? "on" : ""}" id="orderWanted" type="button">Longest wanted</button>
          <button class="guide-chip ${budget.order === "cheapest" ? "on" : ""}" id="orderCheap" type="button">Cheapest first</button>
          ${budget.pinned ? `<button class="guide-chip" id="unpin" type="button">Clear pin</button>` : ""}
        </div>
      `}

    ${unpriced.length
      ? `<p class="section-head">Needs a price</p>
         <div class="want-list">
           ${unpriced
             .map(
               (w) => `
             <div class="want-row" data-want="${escapeHtml(w.id)}">
               <span class="wr-icon">${w.type === "book" ? ICONS.books : ICONS.lps}</span>
               <span class="wr-main">
                 <span class="wr-title">${escapeHtml(w.title)}</span>
                 <span class="wr-meta">Tap to add a price</span>
               </span>
               <span class="wr-price">—</span>
             </div>`
             )
             .join("")}
         </div>`
      : ""}

    ${wins.length
      ? `<p class="section-head">Noted vs paid</p>
         <div class="result-list">
           ${wins
             .map((w) => {
               const scale = (v) => Math.max(3, Math.round((v / worst) * 100));
               return `
             <div class="result-row">
               <span class="rr-title">${escapeHtml(w.title)}</span>
               <div class="rr-bars">
                 <span class="rr-bar noted" style="width:${scale(w.expected)}%">
                   <span class="rr-tag">${money(w.expected)}</span>
                 </span>
                 <span class="rr-bar paid ${w.under ? "under" : w.over ? "over" : ""}"
                       style="width:${scale(w.paid)}%">
                   <span class="rr-tag">${money(w.paid)}</span>
                 </span>
               </div>
               <span class="rr-diff ${w.under ? "under" : w.over ? "over" : ""}">
                 ${Math.abs(w.diff) < 0.005
                   ? "as noted"
                   : `${money(Math.abs(w.diff))} ${w.under ? "under" : "over"}`}
               </span>
             </div>`;
             })
             .join("")}
         </div>
         <p class="settings-note">
           Net ${money(Math.abs(net))} ${net >= 0 ? "under" : "over"} what you'd noted,
           across ${wins.length} purchase${wins.length === 1 ? "" : "s"}.
         </p>`
      : ""}
  `;
}

// ---------- the price hunt ----------
//
// You spend a Saturday walking round four shops writing prices in your Notes
// app, and by Tuesday you can't remember which shop said which number. So a
// want can hold a QUOTE per shop — who, where, how much, when — and the app
// does the only arithmetic that matters: which one is cheapest, and by how
// much.
//
// The quotes are the source of truth for the item's price once any exist. That
// keeps one number in the system rather than two that can disagree: the
// planner, the home tile and the "what you paid" comparison all read `price`,
// and `price` is simply the cheapest quote. Nothing downstream had to change.

/** Quotes, cheapest first. Ties break on the older note — you saw it first. */
function quotesOf(item) {
  return [...(item.quotes || [])].sort(
    (a, b) => Number(a.price) - Number(b.price) || String(a.date).localeCompare(String(b.date))
  );
}

/**
 * What a hunt has found: the winner, and what it saves against the next one.
 *
 * The saving is measured against the SECOND cheapest, not the dearest. Against
 * the dearest it would flatter you with a number you were never going to pay —
 * the real decision is between the best price and the next best.
 */
function huntResult(item) {
  const qs = quotesOf(item);
  if (!qs.length) return null;
  const best = qs[0];
  const runnerUp = qs[1] || null;
  return {
    quotes: qs,
    best,
    runnerUp,
    saving: runnerUp ? Number(runnerUp.price) - Number(best.price) : 0,
    spread: qs.length > 1 ? Number(qs[qs.length - 1].price) - Number(best.price) : 0,
  };
}

/** Writes quotes back, keeping `price` pinned to the cheapest of them. */
function saveQuotes(store, item, quotes) {
  const sorted = [...quotes].sort((a, b) => Number(a.price) - Number(b.price));
  const cheapest = sorted.length ? Number(sorted[0].price) : null;
  const newest = sorted.reduce((d, q) => (q.date > d ? q.date : d), "");
  store.updateItem(item.id, {
    quotes,
    // With no quotes left, the price goes back to being whatever was typed by
    // hand — which is null, because the last quote WAS the price.
    price: cheapest,
    priceCheckedDate: cheapest != null ? newest || todayStr() : null,
  });
}

/**
 * The hunt block.
 *
 * Cheapest first and marked as such, because scanning four numbers for the
 * smallest is exactly the job you came here to hand over. Each row carries the
 * gap to the best price rather than the raw number alone — "$12 more" is the
 * thing you're deciding on, and it saves the mental subtraction the Notes-app
 * version made you do.
 */
function huntHtml(hunt) {
  if (!hunt) {
    return `
      <div class="hunt-block">
        <div class="hunt-head">
          <span class="hunt-title">Price hunt</span>
        </div>
        <p class="hunt-empty">
          Been round a few shops? Note what each one charges and the cheapest
          is worked out for you — and becomes the price the plan runs on.
        </p>
        <button class="link-btn" id="wsAddShop" type="button">Add the first shop</button>
      </div>
    `;
  }

  const rows = hunt.quotes
    .map((q, i) => {
      const gap = Number(q.price) - Number(hunt.best.price);
      return `
        <div class="hunt-row ${i === 0 ? "best" : ""}" data-quote="${escapeHtml(q.id)}">
          <span class="hunt-rank">${i === 0 ? "Best" : `#${i + 1}`}</span>
          <span class="hunt-main">
            <span class="hunt-shop">${escapeHtml(q.shop)}</span>
            <span class="hunt-meta">${[
              q.area,
              q.date ? `noted ${fmtShort(q.date)}` : null,
              q.lat != null ? "pinned" : null,
            ].filter(Boolean).map(escapeHtml).join(" · ")}</span>
            ${q.note ? `<span class="hunt-note">${escapeHtml(q.note)}</span>` : ""}
          </span>
          <span class="hunt-price">
            <span class="hunt-amount">${money(q.price)}</span>
            ${gap > 0 ? `<span class="hunt-gap">+${money(gap)}</span>` : ""}
          </span>
        </div>`;
    })
    .join("");

  return `
    <div class="hunt-block">
      <div class="hunt-head">
        <span class="hunt-title">Price hunt</span>
        <span class="hunt-count">${hunt.quotes.length} shop${hunt.quotes.length === 1 ? "" : "s"}</span>
      </div>

      <div class="hunt-verdict">
        <span class="hv-shop">${escapeHtml(hunt.best.shop)}</span>
        <span class="hv-price">${money(hunt.best.price)}</span>
        <span class="hv-note">${
          hunt.runnerUp
            ? `${money(hunt.saving)} cheaper than ${escapeHtml(hunt.runnerUp.shop)}${
                hunt.quotes.length > 2 ? ` · ${money(hunt.spread)} spread across ${hunt.quotes.length}` : ""
              }`
            : "The only price you've noted so far"
        }</span>
      </div>

      <div class="hunt-rows">${rows}</div>
      <button class="link-btn" id="wsAddShop" type="button">Add another shop</button>
      <p class="settings-note">
        The cheapest is the price the plan runs on, and what you'll be measured
        against when you buy it.
      </p>
    </div>
  `;
}

/** Short form for a row — the year is noise when you noted it last week. */
function fmtShort(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/**
 * One shop's quote.
 *
 * Name and price are the only required parts — you're standing in a shop with
 * your phone out, and anything else can be filled in on the bus. The map pin
 * is offered because "the one in Mid Valley" stops meaning anything three
 * months later.
 */
function openShopSheet(item, store, existing, onDone, { prefillPrice = null } = {}) {
  let coords = existing && existing.lat != null
    ? { lat: existing.lat, lon: existing.lon }
    : null;

  openOverlay("cover-picker-backdrop", (overlay) => {
    overlay.innerHTML = `
      <div class="cover-picker">
        <div class="cover-picker-head">
          <h2>${existing ? "Edit shop" : "What does it cost here?"}</h2>
          <button class="lightbox-close" id="shClose" type="button" aria-label="Close"><span class="btn-icon">${ICONS.close}</span></button>
        </div>

        <div class="field">
          <label for="shName">Shop</label>
          <input type="text" id="shName" placeholder="Kinokuniya KLCC"
                 value="${escapeHtml(existing ? existing.shop : "")}">
        </div>

        <p class="cover-picker-label">What they charge</p>
        <div class="paid-input-row small">
          <span class="paid-currency">$</span>
          <input type="number" step="0.01" inputmode="decimal" id="shPrice"
                 value="${
                   existing && existing.price != null
                     ? Number(existing.price).toFixed(2)
                     : prefillPrice != null ? Number(prefillPrice).toFixed(2) : ""
                 }"
                 placeholder="0.00" aria-label="What they charge">
        </div>

        <div class="field">
          <label for="shArea">Area <span class="field-hint">optional</span></label>
          <input type="text" id="shArea" placeholder="Mid Valley"
                 value="${escapeHtml(existing && existing.area ? existing.area : "")}">
        </div>

        <div class="field">
          <label for="shDate">When you saw it</label>
          <input type="date" id="shDate" value="${escapeHtml(existing ? existing.date : todayStr())}">
        </div>

        <button class="btn btn-secondary block-btn ${coords ? "btn-accent" : ""}" id="shWhere" type="button">
          <span class="btn-icon">${ICONS.pin}</span> ${coords ? "On the map" : "Put it on the map"}
        </button>
        <p class="settings-note" id="shWhereNote">
          ${coords
            ? "Saved. Tap again to move the pin."
            : "Use your location while you're there, or drag the pin later."}
        </p>

        <div class="field">
          <label for="shNote">A note <span class="field-hint">optional</span></label>
          <input type="text" id="shNote" placeholder="Last copy, slightly bumped"
                 value="${escapeHtml(existing && existing.note ? existing.note : "")}">
        </div>

        <button class="btn btn-primary block-btn" id="shSave" type="button">${existing ? "Save" : "Add this shop"}</button>
        ${existing ? `<button class="btn btn-secondary danger-btn block-btn" id="shDelete" type="button">Remove this shop</button>` : ""}
      </div>
    `;

    overlay.addEventListener("click", (e) => { if (e.target === overlay) dismissLayer(); });
    overlay.querySelector("#shClose").addEventListener("click", () => dismissLayer());

    const whereBtn = overlay.querySelector("#shWhere");
    whereBtn.addEventListener("click", () => {
      bounceTap(whereBtn);
      openMapPicker({
        lat: coords ? coords.lat : null,
        lon: coords ? coords.lon : null,
        title: overlay.querySelector("#shName").value.trim() || "Where is this shop?",
        onPick: (c) => {
          coords = c;
          whereBtn.innerHTML = `<span class="btn-icon">${ICONS.pin}</span> ${c ? "On the map" : "Put it on the map"}`;
          whereBtn.classList.toggle("btn-accent", !!c);
          overlay.querySelector("#shWhereNote").textContent = c
            ? "Saved. Tap again to move the pin."
            : "Use your location while you're there, or drag the pin later.";
        },
      });
    });

    overlay.querySelector("#shSave").addEventListener("click", () => {
      const nameInput = overlay.querySelector("#shName");
      const priceInput = overlay.querySelector("#shPrice");
      const shop = nameInput.value.trim();
      const price = parseAmount(priceInput.value);
      if (!shop) return nudge(nameInput);
      if (price == null || price <= 0) return nudge(priceInput);

      const quote = {
        id: existing ? existing.id : uid(),
        shop,
        price,
        area: overlay.querySelector("#shArea").value.trim() || null,
        date: overlay.querySelector("#shDate").value || todayStr(),
        note: overlay.querySelector("#shNote").value.trim() || null,
        lat: coords ? coords.lat : null,
        lon: coords ? coords.lon : null,
      };

      const quotes = existing
        ? (item.quotes || []).map((q) => (q.id === quote.id ? quote : q))
        : [...(item.quotes || []), quote];

      saveQuotes(store, item, quotes);
      dismissLayer();
      onDone();
    });

    const del = overlay.querySelector("#shDelete");
    if (del) del.addEventListener("click", () => {
      saveQuotes(store, item, (item.quotes || []).filter((q) => q.id !== existing.id));
      dismissLayer();
      onDone();
    });

    setTimeout(() => overlay.querySelector("#shName").focus(), 80);
  });
}

/** Closes the sheet that's open, then runs `fn` once the browser has actually
 *  popped it. dismissLayer() goes through history.back(), which is async — do
 *  the next thing immediately and the pending popstate lands on it instead. */
function afterClose(fn) {
  window.addEventListener("popstate", () => setTimeout(fn, 0), { once: true });
  dismissLayer();
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * One wishlist row, opened.
 *
 * The reason this exists: buying something you'd been planning for meant
 * leaving the planner, finding the item in Books or Records, and marking it
 * there — so the screen that told you when you could afford it was the one
 * screen that couldn't record that you had. Everything here routes through the
 * same store calls those modules make, so a purchase recorded from the planner
 * and one recorded from a detail sheet are indistinguishable afterwards.
 *
 * The noted price is editable in place rather than behind another sheet,
 * because "I typed 40 and meant 400" is the common case and it shouldn't cost
 * three taps to fix.
 */
function openWantSheet(item, store, { month = undefined, pinned = false }, onDone) {
  openOverlay("cover-picker-backdrop", (overlay) => {
    const priced = item.price != null;
    const hunt = huntResult(item);
    overlay.innerHTML = `
      <div class="cover-picker">
        <div class="cover-picker-head">
          <h2>${escapeHtml(item.title)}</h2>
          <button class="lightbox-close" id="wsClose" type="button" aria-label="Close"><span class="btn-icon">${ICONS.close}</span></button>
        </div>
        <p class="ws-sub">
          ${escapeHtml(item.creator || (item.type === "book" ? "Book" : "Record"))}${
            month === 0
              ? " · within reach now"
              : month == null
              ? ""
              : ` · ${escapeHtml(monthLabel(month))}`
          }
        </p>

        ${hunt ? "" : `
          <p class="cover-picker-label">Price you noted</p>
          <div class="paid-input-row small">
            <span class="paid-currency">$</span>
            <input type="number" step="0.01" inputmode="decimal" id="wsPrice"
                   value="${priced ? Number(item.price).toFixed(2) : ""}"
                   placeholder="0.00" aria-label="Price you noted">
          </div>
          <p class="settings-note">
            This is what the plan runs on, and what you'll be measured against
            when you buy it.
          </p>
        `}

        ${huntHtml(hunt)}

        <button class="btn btn-primary block-btn" id="wsGot" type="button">I got this</button>
        ${hunt ? "" : `<button class="btn btn-secondary block-btn" id="wsSave" type="button">Save price</button>`}
        <div class="ws-links">
          <button class="link-btn" id="wsPin" type="button">${
            pinned ? "Clear pin" : "Get this one next"
          }</button>
          <button class="link-btn danger-btn" id="wsRemove" type="button">Remove from wishlist</button>
        </div>
      </div>
    `;

    overlay.addEventListener("click", (e) => { if (e.target === overlay) dismissLayer(); });
    overlay.querySelector("#wsClose").addEventListener("click", () => dismissLayer());

    const priceInput = overlay.querySelector("#wsPrice");
    /** Whatever is in the box right now — a correction typed and not yet
     *  saved still counts, otherwise "I got this" would measure you against
     *  the number you just fixed. Once a hunt is running there is no box: the
     *  cheapest quote IS the price, so there's nothing to type over. */
    const typedPrice = () =>
      priceInput ? parseAmount(priceInput.value) : (item.price != null ? Number(item.price) : null);

    const saveBtn = overlay.querySelector("#wsSave");
    if (saveBtn) saveBtn.addEventListener("click", () => {
      const p = typedPrice();
      if (p == null || p <= 0) return nudge(priceInput);
      store.updateItem(item.id, { price: p, priceCheckedDate: todayStr() });
      dismissLayer();
      onDone();
    });

    // The hunt. Rows open the shop they belong to; the button adds one.
    //
    // afterClose() has already taken this sheet down before the shop sheet
    // opens, and the shop sheet dismisses itself on save — so there is nothing
    // left here to close. Dismissing again popped the layer underneath and
    // left you staring at the home screen.
    const redrawSheet = () => onDone();
    overlay.querySelector("#wsAddShop").addEventListener("click", () => {
      // A price typed but never saved would otherwise be lost the moment the
      // first shop is added, and it's almost always the same number.
      const typed = typedPrice();
      const carry = typed != null && typed > 0 && !(item.quotes || []).length ? typed : null;
      afterClose(() => openShopSheet(item, store, null, redrawSheet, { prefillPrice: carry }));
    });
    overlay.querySelectorAll("[data-quote]").forEach((row) => {
      row.addEventListener("click", () => {
        bounceTap(row);
        const q = (item.quotes || []).find((x) => x.id === row.dataset.quote);
        if (q) afterClose(() => openShopSheet(item, store, q, redrawSheet));
      });
    });

    overlay.querySelector("#wsGot").addEventListener("click", () => {
      const benchmark = typedPrice();
      afterClose(() => {
        askWhatYouPaid({
          title: item.title,
          benchmark: benchmark != null && benchmark > 0 ? benchmark : null,
          checkedDate: item.priceCheckedDate,
          onDone: ({ paid, expected }) => {
            // Books carry no condition field and records do — each module's
            // own shape, so a copy made here looks like one made there.
            const copy = item.type === "lp"
              ? { id: uid(), acquiredDate: todayStr(), condition: null,
                  currentLoan: null, history: [], paid, expected }
              : { id: uid(), acquiredDate: todayStr(),
                  currentLoan: null, history: [], paid, expected };
            store.updateItem(item.id, {
              copies: [...(item.copies || []), copy],
              price: null,
              priceCheckedDate: null,
              // The hunt is over. Keeping the quotes would leave a shelf item
              // advertising four shops you no longer need to visit.
              quotes: [],
            });
            // Buying the pinned item satisfies the pin; leaving it set would
            // hold a place in the queue for something already on the shelf.
            if (budgetOf(store).pinned === item.id) saveBudget(store, { pinned: null });
            onDone();
          },
        });
      });
    });

    overlay.querySelector("#wsPin").addEventListener("click", () => {
      saveBudget(store, { pinned: pinned ? null : item.id });
      dismissLayer();
      onDone();
    });

    overlay.querySelector("#wsRemove").addEventListener("click", () => {
      if (!window.confirm(`Remove ${item.title} from your wishlist?`)) return;
      // removeItem files a priced want into `declined` on its own — deciding
      // against something is data, not an absence.
      store.removeItem(item.id);
      if (budgetOf(store).pinned === item.id) saveBudget(store, { pinned: null });
      dismissLayer();
      onDone();
    });
  });
}

/** Two numbers, and nothing else to fill in. */
function openBudgetSheet(store, onSaved) {
  const budget = budgetOf(store);
  openOverlay("cover-picker-backdrop", (overlay) => {
    overlay.innerHTML = `
      <div class="cover-picker">
        <div class="cover-picker-head">
          <h2>Your budget</h2>
          <button class="lightbox-close" id="bgClose" type="button" aria-label="Close"><span class="btn-icon">${ICONS.close}</span></button>
        </div>
        <p class="cover-picker-label">Each month you can put aside</p>
        <div class="paid-input-row">
          <span class="paid-currency">$</span>
          <input type="number" step="1" inputmode="decimal" id="bgMonthly"
                 value="${budget.monthly || ""}" placeholder="200" aria-label="Monthly budget">
        </div>
        ${budget.monthly
          ? `<p class="settings-note">
               You have ${money(potOf(store))} available right now. Changing the
               amount keeps that balance and starts accruing at the new rate
               from today.
             </p>
             <input type="hidden" id="bgSaved" value="">`
          : `<p class="cover-picker-label">Already set aside <span class="field-hint">optional</span></p>
             <div class="paid-input-row small">
               <span class="paid-currency">$</span>
               <input type="number" step="1" inputmode="decimal" id="bgSaved"
                      value="" placeholder="0" aria-label="Already set aside">
             </div>
             <p class="settings-note">
               Nothing leaves any real account — this only works out when the
               things you want come within reach, and what you buy through the
               app comes off it.
             </p>`}
        <button class="btn btn-primary block-btn" id="bgSave" type="button">Save</button>
        ${budget.monthly
          ? `<button class="link-btn" id="bgClear" type="button">Remove the budget</button>`
          : ""}
      </div>
    `;
    const monthly = overlay.querySelector("#bgMonthly");
    setTimeout(() => { monthly.focus(); monthly.select(); }, 80);

    overlay.addEventListener("click", (e) => { if (e.target === overlay) dismissLayer(); });
    overlay.querySelector("#bgClose").addEventListener("click", () => dismissLayer());
    overlay.querySelector("#bgSave").addEventListener("click", () => {
      const m = Number(monthly.value);
      if (!Number.isFinite(m) || m <= 0) return nudge(monthly);
      const typed = Number(overlay.querySelector("#bgSaved").value);
      const today = new Date().toISOString().slice(0, 10);

      // Changing the rate re-bases rather than recalculating history: the
      // balance you have right now is carried over as the new opening, and
      // accrual starts again from today at the new rate. Recomputing months
      // of the past at a rate you only just chose would silently rewrite
      // where you stand.
      // Carrying the bare balance double-counts: anything bought ON the new
      // start date is already baked into that balance, and would then be
      // deducted a second time by spentSince. Adding it back makes the two
      // cancel exactly — and a purchase made LATER the same day still comes
      // off properly.
      const opening = budget.monthly
        ? potOf(store) + spentSince(store, today)
        : (Number.isFinite(typed) && typed > 0 ? typed : 0) + m;

      saveBudget(store, { monthly: m, opening, since: today });
      dismissLayer();
      onSaved();
    });
    const clear = overlay.querySelector("#bgClear");
    if (clear) clear.addEventListener("click", () => {
      saveBudget(store, { monthly: 0, opening: 0, since: null });
      dismissLayer();
      onSaved();
    });
  });
}

function render(container, store) {
  const wrap = document.createElement("div");
  wrap.innerHTML = planHtml(store);
  container.innerHTML = "";
  container.appendChild(wrap);

  const redraw = () => render(container, store);

  wrap.querySelector("#budgetBtn").addEventListener("click", (e) => {
    bounceTap(e.currentTarget);
    openBudgetSheet(store, redraw);
  });

  const orderWanted = wrap.querySelector("#orderWanted");
  if (orderWanted) orderWanted.addEventListener("click", () => {
    saveBudget(store, { order: "wanted" });
    redraw();
  });
  const orderCheap = wrap.querySelector("#orderCheap");
  if (orderCheap) orderCheap.addEventListener("click", () => {
    saveBudget(store, { order: "cheapest" });
    redraw();
  });
  const unpin = wrap.querySelector("#unpin");
  if (unpin) unpin.addEventListener("click", () => {
    saveBudget(store, { pinned: null });
    redraw();
  });

  // Tapping a row opens it. This used to pin and unpin instead — one hidden
  // gesture, no label, and it silently reshuffled the plan. Worse, it was the
  // only thing a row could do, so recording a purchase meant leaving the
  // planner for the module the item happened to live in. Pinning still exists;
  // it's a labelled button inside the sheet now.
  wrap.querySelectorAll("[data-want]").forEach((row) => {
    row.addEventListener("click", () => {
      bounceTap(row);
      const id = row.dataset.want;
      const item = store.get().items.find((it) => it.id === id);
      if (!item) return redraw();
      const month = row.dataset.month === "" || row.dataset.month == null
        ? undefined
        : Number(row.dataset.month);
      openWantSheet(item, store, {
        month: Number.isFinite(month) ? month : undefined,
        pinned: budgetOf(store).pinned === id,
      }, redraw);
    });
  });
}

export default { render };
