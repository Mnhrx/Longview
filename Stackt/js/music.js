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
  };
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

/** Free-text search, used when you know the album but not the barcode. */
export async function searchReleases(query, limit = 12) {
  const q = String(query || "").trim();
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
 * Sleeve art for a release. Every pressing has its own MBID, so a reissue with
 * different artwork resolves to different art — which is the whole reason the
 * picker offers other releases of the same album.
 */
export function coverArtUrl(mbid, size = 500) {
  if (!mbid) return null;
  return `https://coverartarchive.org/release/${mbid}/front-${size}`;
}

/** Discogs is where vinyl prices actually live — linked out, not scraped. */
export function discogsUrl(record) {
  if (record.barcode) {
    return `https://www.discogs.com/search/?q=${encodeURIComponent(record.barcode)}&type=release`;
  }
  const q = [record.creator, record.title].filter(Boolean).join(" ");
  return `https://www.discogs.com/search/?q=${encodeURIComponent(q)}&type=release&format=Vinyl`;
}
