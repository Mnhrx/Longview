// ============================================
// Word lookup — freedictionaryapi.com, which serves structured English
// Wiktionary. Free, no key, CORS-enabled, 1,000 requests an hour per IP.
//
// Chosen over the older api.dictionaryapi.dev because it's Wiktionary-backed
// (~8.5M words rather than a fixed list), and because it returns example
// sentences and synonyms per sense, which is most of what makes a saved word
// worth having later.
//
// The shape it answers with:
//
//   { word, source: { url },
//     entries: [ { language: {code,name}, partOfSpeech,
//                  pronunciations: [{type,text}],
//                  senses: [{ definition, examples: [], synonyms: [], antonyms: [],
//                             tags: [], subsenses: [],
//                             quotes: [{ text, reference }] }] } ] }
//
// `examples` is empty far more often than not. The sentences worth having are
// in `quotes` — dated, attributed lines from real books — which is why they
// are read here too.
//
// What we KEEP is deliberately much smaller than that — see trim() below.
// ============================================

const API = "https://freedictionaryapi.com/api/v1/entries";

/** How much of a word we're willing to carry forever. See the note on trim(). */
export const MAX_SENSES = 3;
export const MAX_SYNONYMS = 6;
const MAX_DEF_CHARS = 320;

/**
 * Illustrative sentences, counted PER WORD rather than per sense.
 *
 * Wiktionary keeps almost nothing in `examples` — for most words that array is
 * empty and the sentences live in `quotes`, which is where the real ones are:
 * dated, attributed lines out of actual books. Reading only `examples` is why
 * words came back without a single sentence attached.
 *
 * Quotes are long, though (60–200 characters plus a citation), so two per
 * sense across three senses would roughly double a saved word. Two for the
 * whole word keeps the cost near 300 bytes and still illustrates the meanings
 * that matter most.
 */
export const MAX_SENTENCES = 2;
const MAX_SENTENCE_CHARS = 160;
const MAX_REF_CHARS = 38;

/** A failure the UI should describe rather than swallow. */
export class WordLookupError extends Error {
  constructor(message, { busy = false, offline = false, status = 0 } = {}) {
    super(message);
    this.name = "WordLookupError";
    this.busy = busy;
    this.offline = offline;
    this.status = status;
  }
}

// One request at a time, spaced. Nowhere near the hourly limit in normal use,
// but a queue costs nothing and means a fast typist can't stack up calls.
const MIN_GAP_MS = 350;
let queue = Promise.resolve();
let lastAt = 0;

function paced(run) {
  const next = queue.then(async () => {
    const wait = MIN_GAP_MS - (Date.now() - lastAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastAt = Date.now();
    return run();
  });
  queue = next.catch(() => {}); // a rejection must not wedge the queue
  return next;
}

function clip(text, max) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
}

/**
 * "1919, W[illiam] Somerset Maugham, chapter 39, in The Moon and Sixpence,
 *  [New York, N.Y.]: Grosset & Dunlap Publishers […], →OCLC:"
 *                              becomes
 * "1919 · William Somerset Maugham"
 *
 * The full citation is longer than the sentence it belongs to, and a publisher
 * and an OCLC number tell you nothing you wanted to know. Year and who wrote
 * it is the part that makes a quote worth reading.
 */
function shortRef(reference) {
  const raw = String(reference || "")
    .replace(/→\S+/g, "")          // →OCLC, →ISBN and friends
    .replace(/\[…\]/g, "")
    .replace(/[\[\]]/g, "")        // W[illiam] -> William
    .trim();
  if (!raw) return null;

  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  const yearMatch = (parts[0] || "").match(/\b(\d{4})\b/);
  const year = yearMatch ? yearMatch[1] : null;

  // The first fragment that names something rather than locating it.
  const STRUCTURAL = /^(chapter|page|pages|volume|vol\.?|in|number|no\.?|part|book|act|scene|section|line|verse|episode|translated|published|edition|OCLC|ISBN)\b/i;
  let who = null;
  for (let i = year ? 1 : 0; i < parts.length; i++) {
    const p = parts[i].replace(/[:;]+$/, "").trim();
    if (!p || STRUCTURAL.test(p) || /^\d+$/.test(p)) continue;
    who = p;
    break;
  }

  const out = [year, who && clip(who, MAX_REF_CHARS)].filter(Boolean).join(" · ");
  return out || null;
}

/**
 * Cuts a full Wiktionary entry down to something worth storing.
 *
 * A complete response for a common word runs to several KB. The whole library
 * lives in localStorage, which holds about 5MB for everything — so a thousand
 * saved words at 3KB each would be most of the budget, which is exactly the
 * corner the covers painted us into before they moved to IndexedDB.
 *
 * Three senses, six synonyms, a capped definition and two illustrative
 * sentences for the whole word: about 1.3KB, so a thousand words is a little
 * over a megabyte and the rest of the app is left alone. The complete entry is
 * always one tap away on Wiktionary, and the source link is kept so that tap
 * is possible.
 */
function trim(data) {
  const entries = Array.isArray(data && data.entries) ? data.entries : [];
  const senses = [];
  let pronunciation = null;

  for (const entry of entries) {
    if (!pronunciation) {
      const ipa = (entry.pronunciations || []).find((p) => p && p.text);
      if (ipa) pronunciation = ipa.text;
    }
    for (const sense of entry.senses || []) {
      if (senses.length >= MAX_SENSES) break;
      const definition = String(sense.definition || "").trim();
      if (!definition) continue;
      senses.push({
        pos: entry.partOfSpeech || null,
        definition: clip(definition, MAX_DEF_CHARS),
        // Candidates only — pruned to the per-word budget below. A plain
        // example has no citation; a quote carries where it came from.
        sentences: [
          ...(sense.examples || [])
            .filter((e) => typeof e === "string" && e.trim())
            .map((e) => ({ text: e, ref: null })),
          ...(sense.quotes || [])
            .filter((q) => q && typeof q.text === "string" && q.text.trim())
            .map((q) => ({ text: q.text, ref: shortRef(q.reference) })),
        ],
        synonyms: (sense.synonyms || [])
          .filter((s) => typeof s === "string" && s.trim())
          .slice(0, MAX_SYNONYMS),
      });
    }
    if (senses.length >= MAX_SENSES) break;
  }

  // Spend the sentence budget one per sense first, so two meanings each get an
  // illustration rather than the first one taking both, then fill any slack.
  let budget = MAX_SENTENCES;
  const chosen = senses.map(() => []);
  for (let pass = 0; pass < MAX_SENTENCES && budget > 0; pass++) {
    senses.forEach((sense, i) => {
      if (budget <= 0) return;
      const next = sense.sentences[chosen[i].length];
      if (!next) return;
      const text = clip(next.text, MAX_SENTENCE_CHARS);
      if (!text) return;
      chosen[i].push({ text, ref: next.ref || null });
      budget--;
    });
  }
  senses.forEach((sense, i) => {
    sense.sentences = chosen[i];
  });

  return {
    word: String((data && data.word) || "").trim(),
    pronunciation,
    senses,
    sourceUrl: (data && data.source && data.source.url) || null,
  };
}

/**
 * Looks a word up.
 *
 * Resolves to `{ found: false }` when the dictionary genuinely has no entry —
 * that's an answer, not a failure, and the UI offers to save it with your own
 * definition instead. Anything else throws, so "the dictionary is down" never
 * gets reported as "that isn't a word", which is the mistake the record
 * lookups were making until v31.
 */
export async function lookupWord(word, lang = "en") {
  const term = String(word || "").trim();
  if (!term) return { found: false, word: "" };

  let res;
  try {
    res = await paced(() =>
      fetch(`${API}/${encodeURIComponent(lang)}/${encodeURIComponent(term.toLowerCase())}`)
    );
  } catch (err) {
    throw new WordLookupError(
      "Couldn't reach the dictionary. You can still save the word and write the meaning yourself.",
      { offline: true }
    );
  }

  if (res.status === 404) return { found: false, word: term };
  if (res.status === 429) {
    throw new WordLookupError(
      "The dictionary is rate-limiting us. Try again in a minute.",
      { busy: true, status: 429 }
    );
  }
  if (!res.ok) {
    throw new WordLookupError(`The dictionary answered ${res.status}.`, { status: res.status });
  }

  let data;
  try {
    data = await res.json();
  } catch (err) {
    throw new WordLookupError("The dictionary sent something unreadable.", { status: res.status });
  }

  const shaped = trim(data);
  // A 200 with nothing usable in it is, for our purposes, a miss.
  if (!shaped.senses.length) return { found: false, word: term };
  return { found: true, ...shaped, word: shaped.word || term };
}

/** Exposed for the tests: the trimming is the part with a size promise on it. */
export const __trim = trim;
