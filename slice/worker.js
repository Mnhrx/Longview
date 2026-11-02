// Slice — Cloudflare Worker (D1 database)
// 1. Inbox: the iPhone Shortcuts POST each Apple Pay tap or PayNow here; the app pulls them, then acks so they're deleted.
// 2. Sync: your phone and computer swap only what changed since they last checked.
//
// Needs:
//   - a D1 database bound as  DB      (Worker → Settings → Bindings → D1 database)
//   - a secret named          SECRET  (Worker → Settings → Variables and Secrets)
// The tables create themselves on the first request.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// txs:   one row per transaction. upd = when it last changed on a device, srv = when the server received it.
// meta:  allowance, rules, balances and other settings, as one row.
// inbox: Apple Pay / PayNow taps waiting for the app.
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS txs (id TEXT PRIMARY KEY, data TEXT, upd INTEGER NOT NULL, srv INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0)`,
  `CREATE INDEX IF NOT EXISTS txs_srv ON txs (srv)`,
  `CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, data TEXT, upd INTEGER NOT NULL, srv INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS inbox (id TEXT PRIMARY KEY, data TEXT NOT NULL, ts INTEGER NOT NULL)`,
];
let ready = false;
async function ensure(db) {
  if (ready) return;
  await db.batch(SCHEMA.map((s) => db.prepare(s)));
  ready = true;
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

    // every request must carry the secret
    const auth = req.headers.get('Authorization') || '';
    if (!env.SECRET || auth !== `Bearer ${env.SECRET}`) return json({ error: 'unauthorised' }, 401);
    if (!env.DB) return json({ error: 'no database bound as DB' }, 500);

    const db = env.DB;
    await ensure(db);
    const { pathname } = new URL(req.url);

    // ---------- inbox ----------
    // Shortcut → Worker: store one tap
    if (req.method === 'POST' && pathname === '/tx') {
      let body;
      try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
      const item = {
        merchant: String(body.merchant ?? '').slice(0, 120),
        amount: String(body.amount ?? '').slice(0, 40), // may arrive as "S$13.50" — the app parses it
        card: String(body.card ?? '').slice(0, 60),
        date: String(body.date ?? '').slice(0, 60),
        ts: Date.now(),
      };
      const id = `q:${item.ts}:${crypto.randomUUID().slice(0, 8)}`;
      await db.prepare('INSERT INTO inbox (id, data, ts) VALUES (?, ?, ?)').bind(id, JSON.stringify(item), item.ts).run();
      // auto-clean taps nobody collected within 45 days
      await db.prepare('DELETE FROM inbox WHERE ts < ?').bind(Date.now() - 45 * 864e5).run();
      return json({ ok: true });
    }

    // App → Worker: fetch waiting taps
    if (req.method === 'GET' && pathname === '/tx') {
      const { results } = await db.prepare('SELECT id, data FROM inbox ORDER BY ts LIMIT 500').all();
      return json(results.map((r) => ({ id: r.id, ...JSON.parse(r.data) })));
    }

    // App → Worker: delete the ones it saved
    if (req.method === 'POST' && pathname === '/ack') {
      const { ids = [] } = await req.json().catch(() => ({}));
      const list = ids.map(String).slice(0, 500);
      if (list.length) await db.batch(list.map((id) => db.prepare('DELETE FROM inbox WHERE id = ?').bind(id)));
      return json({ ok: true, deleted: list.length });
    }

    // ---------- sync ----------
    // App sends what changed on it, and gets back everything that changed on the server since `since`.
    // A row is only replaced by a newer version (higher upd), so the newest edit wins.
    if (req.method === 'POST' && pathname === '/sync') {
      const body = await req.json().catch(() => null);
      if (!body) return json({ error: 'bad json' }, 400);
      const now = Date.now();
      const writes = [];
      for (const t of Array.isArray(body.txs) ? body.txs : []) {
        if (!t || typeof t.id !== 'string' || !(t.upd > 0)) continue;
        writes.push(
          db.prepare(
            `INSERT INTO txs (id, data, upd, srv, deleted) VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT (id) DO UPDATE SET data = excluded.data, upd = excluded.upd, srv = excluded.srv, deleted = excluded.deleted
             WHERE excluded.upd > txs.upd`
          ).bind(t.id, t.deleted ? null : String(t.data), Math.floor(t.upd), now, t.deleted ? 1 : 0)
        );
      }
      if (body.meta && body.meta.upd > 0) {
        writes.push(
          db.prepare(
            `INSERT INTO meta (k, data, upd, srv) VALUES ('main', ?1, ?2, ?3)
             ON CONFLICT (k) DO UPDATE SET data = excluded.data, upd = excluded.upd, srv = excluded.srv WHERE excluded.upd > meta.upd`
          ).bind(String(body.meta.data), Math.floor(body.meta.upd), now)
        );
      }
      // write in chunks so a big first upload stays within D1's limits
      for (let i = 0; i < writes.length; i += 200) await db.batch(writes.slice(i, i + 200));

      const since = Math.max(0, Number(body.since) || 0);
      const [txs, meta] = await db.batch([
        db.prepare('SELECT id, data, upd, deleted FROM txs WHERE srv > ?').bind(since),
        db.prepare("SELECT data, upd FROM meta WHERE k = 'main' AND srv > ?").bind(since),
      ]);
      return json({ now, txs: txs.results, meta: meta.results[0] || null });
    }

    // App → Worker: wipe the synced copy (only used when you choose "replace it with this device's data")
    if (req.method === 'POST' && pathname === '/reset') {
      await db.batch([db.prepare('DELETE FROM txs'), db.prepare('DELETE FROM meta')]);
      return json({ ok: true });
    }

    return json({ error: 'not found' }, 404);
  },
};
