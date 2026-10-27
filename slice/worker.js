// Slice — Apple Pay + PayNow inbox (Cloudflare Worker)
// The iPhone Shortcuts POST each Apple Pay tap or PayNow here; the app pulls them, then acks so they're deleted.
//
// Needs:
//   - a KV namespace bound as  QUEUE
//   - a secret named           SECRET   (wrangler secret put SECRET, or Settings → Variables)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

    // every request must carry the secret
    const auth = req.headers.get('Authorization') || '';
    if (!env.SECRET || auth !== `Bearer ${env.SECRET}`) return json({ error: 'unauthorised' }, 401);

    const { pathname } = new URL(req.url);

    // Shortcut → Worker: store one tap
    if (req.method === 'POST' && pathname === '/tx') {
      let body;
      try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
      const item = {
        merchant: String(body.merchant ?? '').slice(0, 120),
        amount: String(body.amount ?? '').slice(0, 40),   // may arrive as "S$13.50" — the app parses it
        card: String(body.card ?? '').slice(0, 60),
        date: String(body.date ?? '').slice(0, 60),
        ts: Date.now(),
      };
      const key = `q:${item.ts}:${crypto.randomUUID().slice(0, 8)}`;
      await env.QUEUE.put(key, JSON.stringify(item), { expirationTtl: 60 * 60 * 24 * 45 }); // auto-clean after 45 days
      return json({ ok: true });
    }

    // App → Worker: fetch waiting taps
    if (req.method === 'GET' && pathname === '/tx') {
      const list = await env.QUEUE.list({ prefix: 'q:', limit: 500 });
      const items = await Promise.all(
        list.keys.map(async (k) => {
          const v = await env.QUEUE.get(k.name);
          return v ? { id: k.name, ...JSON.parse(v) } : null;
        })
      );
      return json(items.filter(Boolean));
    }

    // App → Worker: delete the ones it saved
    if (req.method === 'POST' && pathname === '/ack') {
      const { ids = [] } = await req.json().catch(() => ({}));
      await Promise.all(ids.filter((id) => String(id).startsWith('q:')).map((id) => env.QUEUE.delete(id)));
      return json({ ok: true, deleted: ids.length });
    }

    return json({ error: 'not found' }, 404);
  },
};
