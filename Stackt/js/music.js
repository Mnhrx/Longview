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
export async function lookupBarcode(barcode) {
  try {
    const res = await fetch(
      `${MB}/release?query=barcode:${encodeURIComponent(barcode)}&fmt=json&limit=5&app=stackt`
    );
    const data = await res.json();
    const hit = (data.releases || [])[0];
    if (!hit) return null;
    const shaped = toRelease(hit);
    if (shaped) shaped.barcode = barcode;
    return shaped;
  } catch (err) {
    console.warn("Barcode lookup failed", err);
    return null;
  }
}

/**
 * Searches releases. Pass `{title, creator}` for a structured search, or
 * `{free}` for whatever someone typed into the picker's search box.
 * A plain string still works and is treated as free text.
 */
export async function searchReleases(spec, limit = 25) {
  const shape = typeof spec === "string" ? { free: spec } : spec || {};
  const q = buildQuery(shape);
  if (!q) return [];
  try {
    const res = await fetch(
      `${MB}/release?query=${encodeURIComponent(q)}&fmt=json&limit=${limit}&app=stackt`
    );
    const data = await res.json();
    return (data.releases || []).map(toRelease).filter(Boolean);
  } catch (err) {
    console.warn("Release search failed", err);
    return [];
  }
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

/** Discogs is where vinyl prices actually live — linked out, not scraped. */
export function discogsUrl(record) {
  if (record.barcode) {
    return `https://www.discogs.com/search/?q=${encodeURIComponent(record.barcode)}&type=release`;
  }
  const q = [record.creator, record.title].filter(Boolean).join(" ");
  return `https://www.discogs.com/search/?q=${encodeURIComponent(q)}&type=release&format=Vinyl`;
}
