// ============================================
// Record lookup — MusicBrainz + Cover Art Archive.
//
// The vinyl equivalent of Open Library. Free, no key, no account. Two things
// worth knowing:
//
//   * MusicBrainz asks for a maximum of one request per second. Every call
//     here is user-initiated (a scan, a typed barcode, opening the art picker),
//     so we're nowhere near that — but don't add anything that loops.
//   * They also ask for a descriptive User-Agent. A browser sends its own and
//     won't let us override it, so we identify the app in the query string
//     instead, which is the best a client-side app can do.
// ============================================

const MB = "https://musicbrainz.org/ws/2";

// ---------- pacing, and telling a refusal from an empty shelf ----------

/**
 * MusicBrainz allows one request per second per IP, and answers 503 when you
 * exceed it. Two things made that bite:
 *
 *   * Nothing here checked res.ok, so a 503 fell through to `data.releases ||
 *     []` and came back as "no results". The app then told you the album
 *     didn't exist, when the server had simply said "not so fast". Tapping
 *     again a second later worked, which is exactly what it looked like from
 *     the outside: random.
 *   * Two calls could fire back-to-back inside a single tap, so the app could
 *     trip the limit by itself.
 *
 * Everything now goes through one queue that keeps calls at least MIN_GAP
 * apart, and a 503 is retried rather than reported as emptiness. The limit is
 * per IP, not per device — on mobile data you share one with everyone else
 * behind the carrier's NAT — so being refused is normal and worth surviving
 * quietly.
 */
const MIN_GAP_MS = 1100;
let queue = Promise.resolve();
let lastCallAt = 0;

function paced(run) {
  const next = queue.then(async () => {
    const wait = MIN_GAP_MS - (Date.now() - lastCallAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallAt = Date.now();
    return run();
  });
  // The queue must survive a rejection, or one failed lookup wedges every
  // request after it for the life of the page.
  queue = next.catch(() => {});
  return next;
}

/** A failure worth telling the user apart from "nothing found". */
export class LookupError extends Error {
  constructor(message, { busy = false, status = 0 } = {}) {
    super(message);
    this.name = "LookupError";
    this.busy = busy;
    this.status = status;
  }
}

/**
 * One paced request, retrying while MusicBrainz is asking us to wait.
 * `onBusy` fires before each retry so the UI can say what's happening rather
 * than sitting there looking broken.
 */
async function mbFetch(path, { retries = 2, onBusy = null } = {}) {
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await paced(() => fetch(`${MB}${path}`));
    } catch (err) {
      throw new LookupError("Couldn't reach MusicBrainz.", { status: 0 });
    }
    if (res.ok) return res.json();

    const busy = res.status === 503 || res.status === 429;
    if (busy && attempt < retries) {
      if (onBusy) onBusy(attempt + 1);
      // Retry-After is in seconds when they send it; a beat over the rate
      // limit when they don't.
      const after = Number(res.headers.get("Retry-After"));
      const waitMs = Number.isFinite(after) && after > 0 ? Math.min(after * 1000, 5000) : 1200;
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }
    throw new LookupError(
      busy ? "MusicBrainz is busy." : `MusicBrainz answered ${res.status}.`,
      { busy, status: res.status }
    );
  }
}

/**
 * Wraps a lookup for callers that would rather have an empty list than an
 * exception. `strict` opts out — the tracklist picker uses it, because
 * "couldn't ask" and "nothing there" need different words on screen.
 */
async function forgiving(fn, fallback, strict) {
  try {
    return await fn();
  } catch (err) {
    if (strict) throw err;
    console.warn("Lookup failed:", err);
    return fallback;
  }
}

/** Shapes one MusicBrainz release into the fields the LPs module stores. */
function toRelease(r) {
  if (!r) return null;
  const labelInfo = (r["label-info"] || [])[0] || {};
  const label = (labelInfo.label && labelInfo.label.name) || "";
  const catalog = labelInfo["catalog-number"] || "";
  const format = ((r.media || [])[0] || {}).format || "";

  // "Edition" is deliberately one human-readable line rather than three fields —
  // Blue Note · BST 84003 is how you'd actually describe a pressing.
  const edition = [label, catalog].filter(Boolean).join(" · ");

  return {
    mbid: r.id || null,
    title: r.title || "",
    creator: (r["artist-credit"] || []).map((a) => a.name).join(", "),
    year: (r.date || "").slice(0, 4) || "",
    edition: edition || format || "",
    barcode: r.barcode || null,
    // The release *group* is the album as an idea — every pressing, reissue and
    // remaster shares one. Art gets filed against the group far more often than
    // against an individual pressing, so this is what makes most of "I can't
    // find this album's cover" go away.
    rgid: (r["release-group"] || {}).id || null,
    country: r.country || null,
    // How many tracks this pressing has, and on how many discs. It's the one
    // fact that lets you tell your copy from the reissue with three bonus
    // cuts, so the pressing picker leads with it.
    trackCount: (r.media || []).reduce((n, m) => n + (m["track-count"] || 0), 0) || null,
    discCount: (r.media || []).length || null,
    format: format || null,
  };
}

/**
 * Builds a Lucene query for MusicBrainz. A bare "coltrane blue train" is scored
 * as loose words across every field, which buries the pressing you meant under
 * compilations and singles. Naming the fields fixes the ranking.
 */
function buildQuery({ title, creator, free }) {
  const esc = (s) => String(s).replace(/[+\-&|!(){}\[\]^"~*?:\\/]/g, " ").replace(/\s+/g, " ").trim();
  if (free) return esc(free);
  const parts = [];
  if (title) parts.push(`release:"${esc(title)}"`);
  if (creator) parts.push(`artist:"${esc(creator)}"`);
  return parts.join(" AND ");
}

/** Looks up a release by the barcode on the sleeve. */
export async function lookupBarcode(barcode, { strict = false, onBusy = null } = {}) {
  return forgiving(async () => {
    const data = await mbFetch(
      `/release?query=barcode:${encodeURIComponent(barcode)}&fmt=json&limit=5&app=stackt`,
      { onBusy }
    );
    const hit = (data.releases || [])[0];
    if (!hit) return null;
    const shaped = toRelease(hit);
    if (shaped) shaped.barcode = barcode;
    return shaped;
  }, null, strict);
}

/**
 * Searches releases. Pass `{title, creator}` for a structured search, or
 * `{free}` for whatever someone typed into the picker's search box.
 * A plain string still works and is treated as free text.
 */
export async function searchReleases(spec, limit = 25, { strict = false, onBusy = null } = {}) {
  const shape = typeof spec === "string" ? { free: spec } : spec || {};
  const q = buildQuery(shape);
  if (!q) return [];
  return forgiving(async () => {
    const data = await mbFetch(
      `/release?query=${encodeURIComponent(q)}&fmt=json&limit=${limit}&app=stackt`,
      { onBusy }
    );
    return (data.releases || []).map(toRelease).filter(Boolean);
  }, [], strict);
}

/**
 * Turns raw releases into art candidates, best-odds first.
 *
 * One album can come back as thirty near-identical rows (every country's
 * pressing of the same CD), and most of those have no art of their own. So:
 * one candidate per release *group* first — that's the album's canonical
 * artwork and almost always exists — then the distinct pressings after it,
 * for when you want the specific sleeve in your hands rather than the album.
 */
export function artCandidates(releases, max = 24) {
  const out = [];
  const seenGroup = new Set();
  const seenRelease = new Set();

  releases.forEach((r) => {
    if (!r.rgid || seenGroup.has(r.rgid)) return;
    seenGroup.add(r.rgid);
    out.push({ ...r, artId: r.rgid, artKind: "release-group", edition: "Album art" });
  });
  releases.forEach((r) => {
    if (!r.mbid || seenRelease.has(r.mbid)) return;
    seenRelease.add(r.mbid);
    out.push({ ...r, artId: r.mbid, artKind: "release" });
  });

  return out.slice(0, max);
}

/**
 * Sleeve art. `kind` is "release" for one specific pressing or "release-group"
 * for the album's canonical art. Cover Art Archive answers with a 307 to
 * archive.org, so these images take a second hop before any bytes arrive —
 * that redirect, not MusicBrainz, is why sleeves feel slower than book covers.
 */
export function coverArtUrl(id, size = 500, kind = "release") {
  if (!id) return null;
  return `https://coverartarchive.org/${kind}/${id}/front-${size}`;
}

// ---------- tracklists ----------

/**
 * Every pressing of an album, so you can say which one you're holding.
 *
 * This exists because of a distinction that matters here and nowhere else in
 * the app: a release GROUP is "Blue Train, the album" and has no tracks at
 * all — tracks belong to a specific pressing. Reissues add bonus cuts,
 * Japanese pressings reorder sides, the CD runs longer than the LP. Stackt
 * files artwork against the group (that's where art actually lives), so for
 * most records we know the album but not the pressing, and picking one for
 * you would quietly attach the wrong tracklist.
 */
export async function releasesInGroup(rgid, limit = 25, { strict = false, onBusy = null } = {}) {
  if (!rgid) return [];
  return forgiving(async () => {
    const data = await mbFetch(
      `/release?release-group=${encodeURIComponent(rgid)}&fmt=json&limit=${limit}&inc=media&app=stackt`,
      { onBusy }
    );
    return (data.releases || []).map(toRelease).filter(Boolean);
  }, [], strict);
}

/** Total playing time of a shaped tracklist, in ms. Null if nothing is timed. */
export function totalLength(tracks) {
  const timed = (tracks || []).filter((t) => t.ms);
  if (!timed.length) return null;
  return timed.reduce((n, t) => n + t.ms, 0);
}

/** 214000 -> "3:34". Track times are the one place seconds matter. */
export function formatLength(ms) {
  if (!ms && ms !== 0) return "";
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * The tracklist for one specific pressing.
 *
 * Deliberately keeps three fields per track. The raw response also carries
 * artist credits, recording MBIDs, ISRCs and relationship stubs — roughly ten
 * times the bytes — and all of it would land in localStorage, which is the
 * mistake the covers already taught us once.
 *
 * `side` is the medium's position, so a double LP keeps its sides apart
 * instead of running 1–24 in one column.
 */
export async function fetchTracklist(releaseMbid, { strict = false, onBusy = null } = {}) {
  if (!releaseMbid) return null;
  return forgiving(async () => {
    const data = await mbFetch(
      `/release/${encodeURIComponent(releaseMbid)}?inc=recordings+media&fmt=json&app=stackt`,
      { onBusy }
    );
    const media = data.media || [];
    const tracks = [];
    media.forEach((medium, mi) => {
      (medium.tracks || []).forEach((t) => {
        tracks.push({
          pos: tracks.length + 1,
          side: media.length > 1 ? medium.position || mi + 1 : null,
          // Only a real name ("Bonus disc"), never the format — "Side A ·
          // Vinyl" on a vinyl record says nothing you can't already see.
          sideLabel: media.length > 1 ? medium.title || null : null,
          title: t.title || (t.recording && t.recording.title) || "Untitled",
          ms: Number(t.length || (t.recording && t.recording.length)) || null,
        });
      });
    });
    return tracks.length ? tracks : null;
  }, null, strict);
}

/** Discogs is where vinyl prices actually live — linked out, not scraped. */
export function discogsUrl(record) {
  if (record.barcode) {
    return `https://www.discogs.com/search/?q=${encodeURIComponent(record.barcode)}&type=release`;
  }
  const q = [record.creator, record.title].filter(Boolean).join(" ");
  return `https://www.discogs.com/search/?q=${encodeURIComponent(q)}&type=release&format=Vinyl`;
}
