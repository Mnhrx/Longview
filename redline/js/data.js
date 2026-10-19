/* ================================================================
   Redline core — data, maths and the iPhone Shortcut (Cardo) events.
   Everything is stored on this phone only (localStorage).
   ================================================================ */
const KEY = 'redline.v3';
const DAY = 864e5;
const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const todayISO = (d = new Date()) => { d = new Date(d); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const fmtD = s => s ? new Date(s).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtDs = s => s ? new Date(s).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' }) : '—';
const fmtDT = t => new Date(t).toLocaleString('en-SG', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const num = (v, d = 0) => (v == null || isNaN(v)) ? '—' : Number(v).toLocaleString('en-SG', { maximumFractionDigits: d, minimumFractionDigits: d });
const money = (v, d = 2) => (v == null || isNaN(v)) ? '—' : '$' + num(v, d);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ITEM_DEFS = [
  // name, part (its picture in Garage), every km, every months, only for: chain / belt / shaft drive, or liquid cooling
  ['Engine oil', 'oil', 3000, 6], ['Oil filter', 'oil', 6000, 12],
  ['Chain clean & lube', 'chain', 500, 0, 'chain'], ['Chain adjust', 'chain', 1000, 0, 'chain'],
  ['Drive belt', 'belt', 20000, 24, 'belt'], ['CVT rollers', 'belt', 15000, 0, 'belt'], ['CVT clean', 'belt', 6000, 0, 'belt'], ['Gear oil', 'final', 6000, 12, 'belt'],
  ['Final drive oil', 'final', 20000, 24, 'shaft'],
  ['Brake pads', 'brakes', 5000, 6], ['Front tyre', 'frontTyre', 15000, 0], ['Rear tyre', 'rearTyre', 12000, 0],
  ['Spark plug', 'spark', 10000, 0], ['Air filter', 'air', 10000, 12], ['Coolant', 'coolant', 20000, 24, 'liquid'], ['Brake fluid', 'brakes', 0, 24]
];
const fits = (need, b) => !need || need === (b.drive || 'chain') || (need === 'liquid' && b.cooling !== 'air');
const PARTS = [['frontTyre', 'Front tyre'], ['rearTyre', 'Rear tyre'], ['chain', 'Chain'], ['belt', 'Drive belt'], ['final', 'Final drive'], ['oil', 'Engine oil'], ['coolant', 'Coolant'], ['brakes', 'Brakes'], ['spark', 'Spark plug'], ['air', 'Air filter'], ['other', 'Other']];
const DRIVES = [['chain', 'Chain', 'Most bikes. A chain and two sprockets.'], ['belt', 'Belt (CVT)', 'Most scooters. Twist and go, no gears.'], ['shaft', 'Shaft', 'Some tourers and cruisers.']];
const COOLS = [['liquid', 'Liquid-cooled', 'There’s a radiator at the front.'], ['air', 'Air-cooled', 'Fins on the engine, no radiator.']];
// match the service list to how this bike is built: add what it needs, drop what it doesn't have
function applyBuild() {
  for (const [name, part, km, months, need] of ITEM_DEFS) {
    const has = S.items.find(i => i.name === name), ok = fits(need, S.bike);
    if (ok && !has) S.items.push({ id: uid(), name, part, km, months, lastOdo: null, lastDate: null });
    if (!ok && has && need) S.items = S.items.filter(i => i !== has);
  }
}
/* ---------- expressways, for traffic alerts ---------- */
const ROADS = [['PIE', 'Pan-Island', /\bPIE\b|Pan[- ]Island/i], ['CTE', 'Central', /\bCTE\b|Central Expressway/i], ['ECP', 'East Coast', /\bECP\b|East Coast Parkway/i], ['AYE', 'Ayer Rajah', /\bAYE\b|Ayer Rajah/i],
  ['TPE', 'Tampines', /\bTPE\b|Tampines Expressway/i], ['SLE', 'Seletar', /\bSLE\b|Seletar Expressway/i], ['BKE', 'Bukit Timah', /\bBKE\b|Bukit Timah Expressway/i], ['KJE', 'Kranji', /\bKJE\b|Kranji Expressway/i],
  ['KPE', 'Kallang–Paya Lebar', /\bKPE\b|Kallang[- –]Paya Lebar/i], ['MCE', 'Marina Coastal', /\bMCE\b|Marina Coastal/i], ['NSC', 'North–South Corridor', /\bNSC\b|North[- –]South Corridor/i],
  ['WDL', 'Woodlands Causeway', /Causeway|Woodlands Checkpoint|Woodlands Crossing/i], ['TUAS', 'Tuas Second Link', /Second Link|Tuas Checkpoint|Tuas Crossing|Linkedua/i]];
const roadCodes = text => ROADS.filter(([, , re]) => re.test(text)).map(([c]) => c);
// your roads = the ones you picked + any you've ridden at least twice in the last 60 days
function myRoads() { const n = {}, since = Date.now() - 60 * DAY; S.rides.filter(r => r.start.t > since).forEach(r => (r.roads || []).forEach(c => n[c] = (n[c] || 0) + 1));
  return [...new Set([...(S.roads || []), ...Object.keys(n).filter(c => n[c] >= 2)])]; }
const learnedRoads = () => myRoads().filter(c => !(S.roads || []).includes(c));
const RENEW_DEFS = ['Road tax', 'Insurance', 'COE expiry', 'LTA inspection', 'Helmet replace'];
const RIDE_COLS = ['#4DF3FF', '#FF8A1F', '#B7FF3D', '#FF4FD8', '#8B7BFF', '#FFE14D'];

function fresh() {
  return {
    v: 3, setupDone: false,
    bike: { name: '', model: '', plate: '', drive: 'chain', cooling: 'liquid', cc: '', tank: 13, reserve: 2.5, licence: '2B' },
    items: ITEM_DEFS.filter(x => fits(x[4], { drive: 'chain', cooling: 'liquid' })).map(([name, part, km, months]) => ({ id: uid(), name, part, km, months, lastOdo: null, lastDate: null })),
    renewals: RENEW_DEFS.map(name => ({ id: uid(), name, date: '', cost: null })),
    services: [], fuel: [], rides: [], marks: [], odoLog: [], parked: null,
    intercom: null, seen: [], minMin: 3, minKm: .5, fuelLight: null, relay: window.PREVIEW ? '' : 'https://redline.lvredline.workers.dev', home: null, roads: [], rider: '', openRide: null,
    prefs: { sound: false, music: false },
    stats: { exports: 0, wraps: 0 }, badges: {}
  };
}
let S = load();
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 3) return Object.assign(fresh(), s); } catch (e) {}
  return fresh();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { window.toast && toast('Could not save. Storage is full or blocked on this phone.', 'over'); } }

/* ---------- odometer & tracking ---------- */
// every real odometer reading, oldest first. Same day: fill-ups, then services, then odometer checks (most deliberate last)
function odoReadings() {
  const at = o => { const day = +new Date(o.date + 'T00:00'); return o.ts && todayISO(new Date(o.ts)) === o.date ? { t: o.ts, exact: true } : { t: day, exact: false }; };
  const r = [];
  S.fuel.forEach((f, i) => f.odo != null && !isNaN(f.odo) && r.push({ ...at(f), odo: +f.odo, src: 'fuel', id: f.id, p: 1, i }));
  S.services.forEach((s, i) => s.odo != null && !isNaN(s.odo) && r.push({ ...at(s), odo: +s.odo, src: 'service', id: s.id, p: 2, i }));
  S.odoLog.forEach((o, i) => o.odo != null && !isNaN(o.odo) && r.push({ ...at(o), odo: +o.odo, src: o.setup ? 'setup' : 'odo', id: o.id, p: 3, i }));
  return r.sort((a, b) => a.t - b.t || a.p - b.p || a.i - b.i);
}
// the most recent reading wins (not the highest), so correcting a typo always takes effect
function lastActual() { const r = odoReadings(); return r.length ? r[r.length - 1] : null; }
// Learned correction: real odo km ÷ tracked km between two readings (catches rides that weren't logged + routing error)
function correction() {
  const r = odoReadings(); if (r.length < 2) return 1;
  let act = 0, trk = 0;
  for (let i = 1; i < r.length; i++) {
    const d = r[i].odo - r[i - 1].odo; if (d <= 0) continue;
    const t = S.rides.filter(x => x.end && x.end.t > r[i - 1].t && x.end.t <= r[i].t).reduce((s, x) => s + (x.km || 0), 0);
    if (t > 0) { act += d; trk += t; }
  }
  if (trk < 30 || act < 30) return 1; // too little riding to judge
  const c = act / trk;
  return (c >= .7 && c <= 1.5) ? Math.round(c * 100) / 100 : 1;
}
// Estimated odo now = last real reading + tracked rides since × correction
// odometer now = latest real reading + rides that ended after it (scaled to match your real odometer)
function odoInfo() {
  const la = lastActual(); if (!la) return null;
  const rides = S.rides.filter(x => x.end && x.end.t > la.t && x.km).sort((a, b) => b.end.t - a.end.t), since = rides.reduce((s, x) => s + (+x.km || 0), 0), c = correction();
  return { la, rides, since, c, odo: Math.round(la.odo + since * c) };
}
function estOdo() { const o = odoInfo(); return o ? o.odo : null; }

/* ---------- status ---------- */
function itemStatus(it) {
  const odo = estOdo();
  if (it.lastOdo == null && !it.lastDate) return { cls: 'unset', label: 'Not set', frac: 0, text: S.needFull ? 'Starts after your next full service' : 'Log a service to start' };
  const fr = [], parts = [];
  if (it.km && it.lastOdo != null && odo != null) { const left = it.lastOdo + it.km - odo; fr.push(left / it.km); parts.push(left >= 0 ? `${num(left)} km left` : `${num(-left)} km over`); }
  if (it.months && it.lastDate) {
    const due = new Date(it.lastDate); due.setMonth(due.getMonth() + it.months);
    const left = Math.round((due - Date.now()) / DAY); fr.push(left / (it.months * 30.4)); parts.push(left >= 0 ? `${left} days` : `${-left} days over`);
  }
  if (!fr.length) return { cls: 'unset', label: 'Not set', frac: 0, text: 'Needs an odo reading' };
  if (it.km && it.lastOdo == null) parts.push('km once odo is added');
  const f = Math.min(...fr);
  return { cls: f < 0 ? 'over' : f < .15 ? 'soon' : 'ok', label: f < 0 ? 'Overdue' : f < .15 ? 'Soon' : 'Good', frac: clamp(f, 0, 1), text: parts.join(' · ') };
}
function renewStatus(r) {
  if (!r.date) return { cls: 'unset', days: null, frac: 0, text: 'Add date', label: 'Not set' };
  const days = Math.ceil((new Date(r.date + 'T23:59') - Date.now()) / DAY);
  return { cls: days < 0 ? 'over' : days <= 30 ? 'soon' : 'ok', days, frac: clamp(days / 365, 0, 1), text: days < 0 ? `${-days} days overdue` : days === 0 ? 'Today' : `${num(days)} days`, label: days < 0 ? 'Overdue' : days <= 30 ? `${days} d` : 'Good' };
}
function health() {
  const sc = [];
  S.items.forEach(i => { const s = itemStatus(i); if (s.cls !== 'unset') sc.push(clamp(s.frac / .3, 0, 1)); });
  S.renewals.forEach(r => { const s = renewStatus(r); if (s.cls !== 'unset') sc.push(clamp(s.days / 60, 0, 1)); });
  return sc.length ? Math.round(sc.reduce((a, b) => a + b, 0) / sc.length * 100) : null;
}
function upcoming(n = 4) {
  return [
    ...S.items.map(i => ({ o: i, s: itemStatus(i), k: 'item', rank: itemStatus(i).frac })),
    ...S.renewals.map(r => { const s = renewStatus(r); return { o: r, s, k: 'ren', rank: s.days == null ? 9 : s.days / 120 }; })
  ].filter(x => x.s.cls !== 'unset').sort((a, b) => a.rank - b.rank).slice(0, n);
}

/* ---------- fuel ---------- */
// fill-up cost in Singapore dollars (JB fill-ups are saved in RM and converted at that day's rate)
function fuelSgd(f) { const c = +f.cost || 0; if (f.cur !== 'MYR') return c; return f.costSgd != null ? +f.costSgd : c * ((S.fx && S.fx.rate) || .3); }
// a rough starting km/L until your own fill-ups give the real number (by engine size; editable in Settings → Bike)
function kplGuess() { const set = +S.bike.kplEst; if (set > 3) return set; const cc = +S.bike.cc || 0; return cc && cc <= 150 ? 40 : cc && cc <= 250 ? 30 : cc && cc <= 400 ? 25 : cc && cc <= 750 ? 19 : cc ? 16 : 22; }
function fuelStats() {
  const f = [...S.fuel].sort((a, b) => a.odo - b.odo), tank = +S.bike.tank || 0, reserve = +S.bike.reserve || 2.5;
  // economy, measured two ways: full tank → full tank, and fuel light → fuel light (both are "known level" moments)
  let km = 0, L = 0, best = null;
  { let lastFull = null, pending = 0;
    for (const x of f) { if (lastFull) { pending += +x.litres || 0; if (x.full) { const d = x.odo - lastFull.odo; if (pending > 0 && d > 0) { best = Math.max(best || 0, d / pending); km += d; L += pending; } pending = 0; lastFull = x; } } else if (x.full) lastFull = x; } }
  const lights = [...(S.lightLog || [])].sort((a, b) => a.odo - b.odo);
  for (let i = 1; i < lights.length; i++) { const a = lights[i - 1], b = lights[i], d = b.odo - a.odo, add = f.filter(x => x.odo > a.odo && x.odo <= b.odo && !x.full).reduce((s, x) => s + (+x.litres || 0), 0);
    if (d > 20 && add > 0 && !f.some(x => x.full && x.odo > a.odo && x.odo <= b.odo)) { km += d; L += add; best = Math.max(best || 0, d / add); } }
  const measured = L > 0 ? km / L : null, kpl = measured || (tank ? kplGuess() : null), est = !measured;
  const cost = S.fuel.reduce((s, x) => s + fuelSgd(x), 0);
  const spanKm = f.length > 1 ? f[f.length - 1].odo - f[0].odo : 0;
  // running tank level: start at the latest known level (a full tank, or the fuel light = your reserve), add top-ups, take off what rides use
  let range = null, tankFrac = null, pastE = false, light = false, level = null;
  const fl = S.fuelLight, odo = estOdo();
  const anchors = [...f.filter(x => x.full).map(x => ({ odo: x.odo, lvl: tank, i: f.indexOf(x) })), ...(fl ? [{ odo: fl.odo, lvl: reserve, light: true }] : [])].sort((a, b) => a.odo - b.odo);
  const anc = anchors[anchors.length - 1];
  if (kpl && tank && anc && odo != null) {
    level = anc.lvl; let at = anc.odo;
    const after = f.filter(x => x.odo > anc.odo || (x.odo === anc.odo && anc.light && !x.full));
    for (const x of after) { level = Math.min(tank, Math.max(0, level - (x.odo - at) / kpl) + (+x.litres || 0)); at = x.odo; }
    level -= Math.max(0, (odo - at) / kpl);
    light = !!anc.light && !after.length;
    if (level < 0) pastE = true; level = Math.max(0, level);
    range = Math.round(level * kpl); tankFrac = clamp(level / tank, 0, 1);
  }
  const low = range != null && (range < 60 || tankFrac < .15 || light);
  return { kpl, est, measured, cost, cpk: spanKm > 0 ? cost / spanKm : null, range, tankFrac, best, low, pastE, light, level, full: kpl && tank ? tank * kpl : null };
}
function monthRides(y = new Date().getFullYear(), m = new Date().getMonth()) {
  return S.rides.filter(r => { const d = new Date(r.start.t); return d.getFullYear() === y && d.getMonth() === m; });
}

/* ---------- distance ---------- */
function haversine(a, b) {
  const R = 6371, r = x => x * Math.PI / 180, dLa = r(b.lat - a.lat), dLo = r(b.lon - a.lon);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
// Road distance through start → marked spots → end (free OSRM routing). Fallback: straight line × 1.3.
// road route between points. With just two points, ask for up to 3 different ways ("which way did you go?")
async function routeKm(points, alts) {
  const one = rt => { const names = rt.legs.flatMap(l => (l.steps || []).map(s => `${s.ref || ''} ${s.name || ''}`));
    return { km: rt.distance / 1000, mins: Math.round(rt.duration / 60), src: 'route', path: rt.geometry.coordinates.map(([lo, la]) => [+la.toFixed(5), +lo.toFixed(5)]), roads: roadCodes(names.join(' | ')) }; };
  try {
    const ctl = new AbortController(); setTimeout(() => ctl.abort(), 9000);
    const coords = points.map(p => `${p.lon.toFixed(5)},${p.lat.toFixed(5)}`).join(';');
    const j = await (await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=simplified&geometries=geojson&steps=true${alts && points.length === 2 ? '&alternatives=3' : ''}`, { signal: ctl.signal, cache: 'no-store' })).json();
    if (j.code === 'Ok') { const all = j.routes.map(one), best = all[0]; if (all.length > 1) best.alts = all; return best; }
  } catch (e) {}
  let d = 0; for (let i = 1; i < points.length; i++) d += haversine(points[i - 1], points[i]);
  return { km: d * 1.3, src: 'estimate', path: points.map(p => [p.lat, p.lon]) };
}
// keep a long GPS trail to a few dozen waypoints so routing stays fast
function sampleTrail(pts, max = 30) {
  if (pts.length <= max) return pts; const out = [pts[0]], step = (pts.length - 1) / (max - 1);
  for (let i = 1; i < max - 1; i++) out.push(pts[Math.round(i * step)]); out.push(pts[pts.length - 1]); return out;
}
// GPS points from OwnTracks between a ride's start and end (with a little slack)
function trailFor(start, end) {
  return (S.pts || []).filter(p => p.t >= start.t - 9e4 && p.t <= end.t + 9e4 && (!p.acc || p.acc < 300)).sort((a, b) => a.t - b.t);
}
// remembered choices: same start + end (either way round) → the same roads as last time
function rememberedChoice(start, end, alts) {
  const near = (a, b) => haversine(a, b) < 1.2;
  const m = (S.routeMem || []).filter(x => (near(x.a, start) && near(x.b, end)) || (near(x.a, end) && near(x.b, start))).pop();
  if (!m) return 0;
  const score = alt => { const sig = new Set(m.roads || []), r = new Set(alt.roads || []); if (sig.size || r.size) { let c = 0; sig.forEach(x => r.has(x) && c++); return c / Math.max(1, new Set([...sig, ...r]).size); }
    const mid = alt.path[Math.floor(alt.path.length / 2)]; return m.mid ? -haversine({ lat: mid[0], lon: mid[1] }, m.mid) : 0; };
  let best = 0, bs = -Infinity; alts.forEach((a, i) => { const sc = score(a); if (sc > bs) { bs = sc; best = i; } }); return best;
}
function rememberRoute(ride, alt) {
  const mid = alt.path[Math.floor(alt.path.length / 2)];
  S.routeMem = [...(S.routeMem || []).filter(x => !(haversine(x.a, ride.start) < 1.2 && haversine(x.b, ride.end) < 1.2)), { a: { lat: ride.start.lat, lon: ride.start.lon }, b: { lat: ride.end.lat, lon: ride.end.lon }, roads: alt.roads || [], mid: { lat: mid[0], lon: mid[1] } }].slice(-60);
}
// where a ride's line came from: a real GPS trail, a road you picked, or Redline's best guess
const RIDE_KINDS = { gps: ['GPS track', '#45E0A2'], pick: ['Your pick', '#5AB8FF'], guess: ['Best guess', '#FFB020'], typed: ['Typed in', '#B5ABBA'] };
function rideKind(r) { const e = r.est; if (e === 'tracked') return 'gps'; if (e === 'picked' || e === 'remembered') return 'pick'; if (e === 'manual' || !(r.path && r.path.length > 1)) return 'typed'; return 'guess'; }
const keepGps = trail => sampleTrail(trail, 120).map(p => [+(+p.lat).toFixed(5), +(+p.lon).toFixed(5)]);
function applyRoute(ride, r, how) {
  ride.km = Math.round(r.km * 10) / 10; ride.path = r.path; ride.roads = r.roads || []; ride.est = how || r.src;
}

/* ---------- Shortcut (Cardo / Siri) events arriving as URL parameters ---------- */
function parseStamp(v) {
  if (!v) return Date.now();
  v = String(v).trim();
  if (/^\d{9,10}$/.test(v)) return v * 1000;
  if (/^\d{12,13}$/.test(v)) return +v;
  const n = Date.parse(v.replace(/ (\d{2}:?\d{2})$/, '+$1')); // "+08:00" can arrive as " 08:00"
  return isNaN(n) ? Date.now() : n;
}
// one ride from an intercom connect (start) and disconnect (end)
async function logRide(start, end) {
  if (isNaN(start.lat) || isNaN(end.lat)) { save(); return { msg: 'Ride data was incomplete. Check the location step in your Shortcut.', icon: 'x', col: 'red' }; }
  if (end.t <= start.t) end.t = Date.now();
  if (!S.parked || end.t >= (S.parked.t || 0)) S.parked = { lat: end.lat, lon: end.lon, t: end.t };
  const mins = (end.t - start.t) / 6e4;
  const marks = S.marks.filter(m => m.t >= start.t && m.t <= end.t).sort((a, b) => a.t - b.t);
  const straight = haversine(start, end);
  if (mins < S.minMin || (straight < S.minKm && !marks.length && mins < 15)) { save(); return { msg: 'Parked spot saved', icon: 'park', col: 'sky' }; }
  const trail = trailFor(start, end), tracked = trail.length >= 2;
  const way = tracked ? [start, ...sampleTrail(trail), end] : [start, ...marks, end];
  const r = await routeKm(way, !tracked && !marks.length);
  const ride = { id: uid(), start, end, km: 0, src: 'auto', loop: straight < 1 && mins >= 15 && !marks.length && !tracked, title: '', note: '', mood: '' };
  if (r.alts) { ride.alts = r.alts.map(a => ({ km: a.km, mins: a.mins, path: a.path, roads: a.roads })); const pick = rememberedChoice(start, end, r.alts); applyRoute(ride, r.alts[pick], pick ? 'remembered' : 'route'); ride.pick = pick; }
  else applyRoute(ride, r, tracked ? 'tracked' : r.src);
  if (tracked) ride.gps = keepGps(trail);
  S.rides.push(ride); save();
  return { ride };
}
// "18450 12.3 35.20", "18,450, 12.3 litres, $35" → odometer, litres, cost (in that order)
function parseFuel(txt) {
  const n = String(txt || '').replace(/(\d),(?=\d{3}\b)/g, '$1').match(/\d+(?:\.\d+)?/g) || [];
  const [odo, litres, cost] = n.map(Number); return { odo, litres, cost };
}
// events your phone dropped at the relay: start / end of a ride, a marked spot, a fill-up
async function applyEvents(items) {
  const out = []; items = items.filter(x => x && x.e).sort((a, b) => a.t - b.t);
  for (const x of items) {
    const sig = 'relay:' + x.id; if (S.seen.includes(sig)) continue; S.seen = [...S.seen.slice(-120), sig];
    const lat = parseFloat(x.lat), lon = parseFloat(x.lon);
    if (x.e === 'scan') { let d = null; try { d = JSON.parse(x.data); } catch (e) {} if (d && d.kind) { S.scanQ = [...(S.scanQ || []), { t: x.t, data: d }].slice(-10); out.push({ msg: 'A photo you scanned is ready to save' }); } continue; }
    if (x.e === 'pt') { const la = parseFloat(x.lat), lo = parseFloat(x.lon); if (!isNaN(la)) { S.pts = (S.pts || []).filter(p => x.t - p.t < 3 * 864e5).concat({ lat: la, lon: lo, t: x.t, acc: x.acc || 0 }).slice(-5000); S.al = Object.assign({}, S.al, { pt: x.t }); } continue; }
    if (x.e === 'start' || x.e === 'end') { S.al = Object.assign({ added: x.t }, S.al, { [x.e]: x.t }); }
    if (x.e === 'start') {
      // the end can arrive before its start (the relay's storage isn't instant): pair them up instead of opening a ride that never ends
      const le = S.lastEnd;
      if (le && !le.used && le.t > x.t && le.t - x.t < 12 * 3600e3) { le.used = true; out.push(await logRide({ lat, lon, t: x.t }, { lat: le.lat, lon: le.lon, t: le.t })); continue; }
      S.openRide = { lat, lon, t: x.t }; save(); continue;
    }
    if (x.e === 'end') {
      const st = S.openRide && S.openRide.t < x.t ? S.openRide : null; if (st) S.openRide = null;
      if (st && x.t - st.t < 12 * 3600e3) { S.lastEnd = { lat, lon, t: x.t, used: true }; out.push(await logRide(st, { lat, lon, t: x.t })); }
      else { S.lastEnd = { lat, lon, t: x.t, used: false }; if (!isNaN(lat)) { S.parked = { lat, lon, t: x.t }; save(); out.push({ msg: 'Parked spot saved', col: 'sky' }); } }
      continue;
    }
    if (x.e === 'mark' && !isNaN(lat)) { S.marks.push({ id: uid(), lat, lon, t: x.t, note: x.note || '' }); save(); out.push({ msg: 'Spot marked' + (x.note ? ': ' + x.note : '') }); continue; }
    if (x.e === 'fuel') { const f = parseFuel(x.fuel); if (!f.odo || !f.litres) { out.push({ msg: 'Couldn’t read that fill-up. Say odometer, litres, then cost.', col: 'red' }); continue; }
      S.fuel.push({ id: uid(), date: todayISO(new Date(x.t)), ts: x.t, odo: f.odo, litres: f.litres, cost: f.cost || 0, full: true, station: '' }); save(); out.push({ msg: 'Fill-up logged', fuel: true }); continue; }
  }
  await refineRides(out); detectTrips(); save(); return out;
}
// OwnTracks alone: spot trips in the GPS trail (moving at road speed → stopped). Asked once: "on the bike?"
// Trips on a route you've confirmed twice before are logged without asking.
function detectTrips() {
  const pts = (S.pts || []).filter(p => !p.acc || p.acc < 300).sort((a, b) => a.t - b.t); if (pts.length < 3) return;
  const covered = t => S.rides.some(r => r.start && r.end && t >= r.start.t - 3e5 && t <= r.end.t + 3e5) || (S.openRide && t >= S.openRide.t - 3e5) || (S.live && t >= S.live.start.t - 3e5);
  const known = new Set([...(S.tripQ || []).map(x => x.k), ...(S.tripSeen || [])]);
  let cur = null; const trips = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], dt = (b.t - a.t) / 36e5, d = haversine(a, b), v = dt > 0 ? d / dt : 0;
    if (cur && b.t - a.t > 10 * 6e4) { cur.end = a; trips.push(cur); cur = null; continue; }   // 10+ minutes with no movement: parked
    if (v > 15 && d > .15) { if (!cur) cur = { start: a, pts: [a] }; cur.pts.push(b); cur.end = b; }
  }
  if (cur && Date.now() - cur.end.t > 10 * 6e4) trips.push(cur); // trail went quiet: parked
  for (const tr of trips) {
    const s = tr.start, e = tr.end, k = 'trip:' + s.t, mins = (e.t - s.t) / 6e4;
    let km = 0; for (let i = 1; i < tr.pts.length; i++) km += haversine(tr.pts[i - 1], tr.pts[i]);
    if (km < 1.5 || mins < 4 || known.has(k) || covered(s.t) || covered(e.t)) continue;
    const seenPair = (S.bikePairs || []).find(p => (haversine(p.a, s) < 1 && haversine(p.b, e) < 1) || (haversine(p.a, e) < 1 && haversine(p.b, s) < 1));
    S.tripQ = [...(S.tripQ || []), { k, start: { lat: s.lat, lon: s.lon, t: s.t }, end: { lat: e.lat, lon: e.lon, t: e.t }, km: Math.round(km * 13) / 10, auto: !!(seenPair && seenPair.n >= 2) }].slice(-20);
  }
}
async function answerTrip(k, yes) {
  const tr = (S.tripQ || []).find(x => x.k === k); if (!tr) return null;
  S.tripQ = S.tripQ.filter(x => x !== tr); S.tripSeen = [...(S.tripSeen || []), k].slice(-200);
  if (!yes) { save(); return null; }
  const p = (S.bikePairs || []).find(p => (haversine(p.a, tr.start) < 1 && haversine(p.b, tr.end) < 1) || (haversine(p.a, tr.end) < 1 && haversine(p.b, tr.start) < 1));
  if (p) p.n++; else S.bikePairs = [...(S.bikePairs || []), { a: { lat: tr.start.lat, lon: tr.start.lon }, b: { lat: tr.end.lat, lon: tr.end.lon }, n: 1 }].slice(-40);
  const res = await logRide({ ...tr.start }, { ...tr.end }); if (res.ride) res.ride.src = 'trail'; save(); return res;
}
// OwnTracks can upload its points late (no signal mid-ride): redraw recent rides once their points arrive
async function refineRides(out) {
  for (const r of S.rides.filter(r => r.start && r.end && r.start.lat != null && r.est !== 'tracked' && r.est !== 'manual' && Date.now() - r.end.t < 2 * 864e5)) {
    const trail = trailFor(r.start, r.end); if (trail.length < 3) continue;
    const res = await routeKm([r.start, ...sampleTrail(trail), r.end]); if (res.src !== 'route') continue;
    applyRoute(r, res, 'tracked'); r.gps = keepGps(trail); delete r.alts; out.push({ msg: 'A ride was redrawn with your real route' });
  }
}
async function handleURL() {
  const p = new URLSearchParams(location.search); const evt = p.get('evt'); if (!evt) return null;
  history.replaceState(null, '', location.pathname);
  const f = k => parseFloat(p.get(k));
  if (evt === 'ride') {
    const sig = `ride:${p.get('st')}:${p.get('slat')}`; if (S.seen.includes(sig)) return null; S.seen = [...S.seen.slice(-60), sig];
    const start = { lat: f('slat'), lon: f('slon'), t: parseStamp(p.get('st')) }, end = { lat: f('elat'), lon: f('elon'), t: parseStamp(p.get('et')) };
    return logRide(start, end);
  }
  if (evt === 'mark') {
    const m = { id: uid(), lat: f('lat'), lon: f('lon'), t: parseStamp(p.get('t')), note: p.get('note') || '' };
    if (isNaN(m.lat)) return { msg: 'No location in that mark', icon: 'x', col: 'red' };
    S.marks.push(m); save(); return { msg: 'Spot marked' + (m.note ? ': ' + m.note : ''), icon: 'pin', col: 'candy' };
  }
  if (evt === 'fuel') {
    const sig = `fuel:${p.get('odo')}:${p.get('litres')}`; if (S.seen.includes(sig)) return null; S.seen.push(sig);
    S.fuel.push({ id: uid(), date: todayISO(), ts: Date.now(), odo: f('odo'), litres: f('litres') || 0, cost: f('cost') || 0, full: p.get('full') !== '0', station: '' });
    save(); return { msg: 'Fill-up logged', icon: 'fuel', col: 'tang', fuel: true };
  }
  if (evt === 'park') { S.parked = { lat: f('lat'), lon: f('lon'), t: Date.now() }; save(); return { msg: 'Parked spot saved', icon: 'park', col: 'sky' }; }
  return null;
}

/* ---------- badges: bronze / silver / gold ---------- */
const BADGES = [
  // id, name, icon, colour, tiers, value fn, unit
  ['km', 'Mileage', 'route', 'tang', [500, 2500, 10000], () => S.rides.reduce((s, r) => s + (r.km || 0), 0), 'km logged'],
  ['rides', 'Saddle time', 'bike', 'candy', [10, 50, 150], () => S.rides.length, 'rides'],
  ['auto', 'Hands-free', 'headset', 'lilac', [5, 25, 100], () => S.rides.filter(r => r.src === 'auto').length, 'auto rides'],
  ['long', 'Long hauler', 'mountain', 'teal', [100, 200, 400], () => Math.max(0, ...S.rides.map(r => r.km || 0)), 'km in one ride'],
  ['night', 'Night owl', 'moon', 'lilac', [3, 15, 50], () => S.rides.filter(r => { const h = new Date(r.start.t).getHours(); return h >= 21 || h < 5; }).length, 'night rides'],
  ['early', 'Early bird', 'sun', 'gold', [3, 15, 50], () => S.rides.filter(r => { const h = new Date(r.start.t).getHours(); return h >= 5 && h < 7; }).length, 'dawn rides'],
  ['rain', 'Rain rider', 'rain', 'sky', [1, 10, 30], () => S.rides.filter(r => r.mood === 'Rainy').length, 'rainy rides'],
  ['weekend', 'Weekend warrior', 'flag', 'candy', [5, 20, 60], () => S.rides.filter(r => [0, 6].includes(new Date(r.start.t).getDay())).length, 'weekend rides'],
  ['streak', 'On a roll', 'fire', 'tang', [3, 8, 20], () => weekStreak(), 'weeks in a row'],
  ['explore', 'Explorer', 'pin', 'teal', [5, 25, 75], () => S.marks.length, 'spots marked'],
  ['journal', 'Storyteller', 'edit', 'lilac', [3, 15, 40], () => S.rides.filter(r => (r.note || '').length > 10).length, 'journal entries'],
  ['fills', 'Pit stop', 'fuel', 'tang', [5, 25, 75], () => S.fuel.length, 'fill-ups'],
  ['sip', 'Fuel sipper', 'drop', 'teal', [25, 32, 40], () => fuelStats().best || 0, 'km/L best'],
  ['mech', 'Mechanic', 'wrench', 'sky', [1, 5, 15], () => S.services.length, 'services'],
  ['chain', 'Chain gang', 'chain', 'lilac', [3, 12, 30], () => { const id = (S.items.find(i => /lube/i.test(i.name)) || {}).id; return S.services.filter(s => s.items.includes(id)).length; }, 'chain lubes'],
  ['paper', 'Paperwork pro', 'receipt', 'gold', [2, 4, 5], () => S.renewals.filter(r => r.date).length, 'renewals tracked'],
  ['backup', 'Backup buddy', 'save', 'grey', [1, 5, 12], () => S.stats.exports, 'backups'],
  ['wrap', 'Wrap watcher', 'play', 'candy', [1, 3, 12], () => S.stats.wraps, 'Ride Wraps'],
];
function weekStreak() {
  const wk = t => Math.floor((t - 4 * DAY) / (7 * DAY));
  const set = new Set(S.rides.map(r => wk(r.start.t))); if (!set.size) return 0;
  const arr = [...set].sort((a, b) => a - b); let best = 1, cur = 1;
  for (let i = 1; i < arr.length; i++) { cur = arr[i] === arr[i - 1] + 1 ? cur + 1 : 1; best = Math.max(best, cur); }
  return best;
}
function badgeState(b) { const v = b[5](); const tier = b[4].filter(x => v >= x).length; return { v, tier, next: b[4][tier] }; }
// returns badges that just levelled up (and records them)
function checkBadges() {
  const ups = [];
  for (const b of BADGES) { const { tier } = badgeState(b); if (tier > (S.badges[b[0]] || 0)) { S.badges[b[0]] = tier; ups.push({ b, tier }); } }
  if (ups.length) save();
  return ups;
}

/* ---------- view model for the 3D world ---------- */
const STATUS_RANK = { unset: -1, ok: 0, soon: 1, over: 2 };
function partStates() {
  const out = {};
  PARTS.slice(0, -1).forEach(([k, name]) => {
    const items = S.items.filter(i => i.part === k).map(i => ({ i, s: itemStatus(i) })).filter(x => x.s.cls !== 'unset');
    if (!items.length) { out[k] = { name: name.toUpperCase(), val: '—', left: 0, status: 'unset' }; return; }
    const w = items.reduce((a, b) => b.s.frac < a.s.frac ? b : a);
    const status = w.s.cls === 'over' ? 'over' : w.s.cls === 'soon' ? 'soon' : 'ok';
    out[k] = { name: (items.length > 1 ? w.i.name : name).toUpperCase(), val: w.s.text.split(' · ')[0].toUpperCase(), left: w.s.frac, status, item: w.i.name };
  });
  return out;
}
function nextRenewal() { return S.renewals.filter(r => r.date).map(r => ({ r, s: renewStatus(r) })).sort((a, b) => a.s.days - b.s.days)[0]; }
function viewModel() {
  const fs = fuelStats(), up = upcoming(8).filter(x => x.k === 'item'), nr = nextRenewal(), odo = estOdo();
  const ni = up[0];
  const panels = [
    { title: 'RANGE', value: fs.range != null ? num(fs.range) : '—', unit: fs.range != null ? 'KM' : '', sub: fs.range != null ? `${num((fs.tankFrac || 0) * S.bike.tank, 1)} L OF ${num(S.bike.tank)} L` : 'NEEDS 2 FULL FILL-UPS', frac: fs.tankFrac || 0, col: fs.range != null && fs.range < 60 ? 'am' : 'cy' },
    ni ? { title: 'NEXT SERVICE', value: ni.s.text.split(' ')[0], unit: (ni.s.text.split(' ')[1] || '').toUpperCase(), sub: ni.o.name.toUpperCase(), frac: ni.s.frac, col: ni.s.cls === 'over' ? 'rd' : ni.s.cls === 'soon' ? 'am' : 'cy' }
       : { title: 'NEXT SERVICE', value: '—', unit: '', sub: 'LOG A SERVICE', frac: 0, col: 'cy' },
    nr ? { title: 'NEXT RENEWAL', value: nr.s.days < 0 ? 'LATE' : num(nr.s.days), unit: nr.s.days < 0 ? '' : 'DAYS', sub: `${nr.r.name.toUpperCase()} · ${fmtDs(nr.r.date).toUpperCase()}`, frac: nr.s.frac, col: nr.s.cls === 'over' ? 'rd' : nr.s.cls === 'soon' ? 'am' : 'cy' }
       : { title: 'NEXT RENEWAL', value: '—', unit: '', sub: 'ADD YOUR DATES', frac: 0, col: 'cy' },
  ];
  const renewals = S.renewals.filter(r => r.date).map(r => ({ name: r.name.toUpperCase().replace(' EXPIRY', '').replace(' REPLACE', ''), days: renewStatus(r).days, span: /coe/i.test(r.name) ? 3650 : 365 }));
  const badges = BADGES.map(b => [b[1], badgeState(b).tier]);
  const fuel = { frac: fs.tankFrac || 0, litres: fs.tankFrac != null ? fs.tankFrac * S.bike.tank : null, tank: S.bike.tank, range: fs.range, kpl: fs.kpl };
  return { odo, panels, renewals, badges, fuel };
}
function riders() {
  return [...S.rides].sort((a, b) => b.start.t - a.start.t).slice(0, 4).map((r, i) => ({ id: r.id, col: RIDE_COLS[i], title: r.title || (r.src === 'auto' ? 'Auto ride' : 'Ride'), km: r.km }));
}
