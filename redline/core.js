/* ================================================================
   Redline core — data, maths and the iPhone Shortcut (Cardo) events.
   Everything is stored on this phone only (localStorage).
   ================================================================ */
const KEY = 'redline.v2';
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
  // name, icon, colour, every km, every months
  ['Engine oil', 'oil', 'tang', 3000, 6], ['Oil filter', 'filter', 'gold', 6000, 12], ['Chain clean & lube', 'chain', 'lilac', 500, 0],
  ['Chain adjust', 'adjust', 'sky', 1000, 0], ['Brake pads', 'brake', 'candy', 5000, 6], ['Front tyre', 'tyre', 'teal', 15000, 0],
  ['Rear tyre', 'tyre', 'teal', 12000, 0], ['Spark plug', 'spark', 'gold', 10000, 0], ['Air filter', 'wind', 'sky', 10000, 12],
  ['Coolant', 'coolant', 'lilac', 20000, 24], ['Brake fluid', 'drop', 'candy', 0, 24]
];
const RENEW_DEFS = [['Road tax', 'receipt', 'tang'], ['Insurance', 'shield', 'lilac'], ['COE expiry', 'scroll', 'candy'], ['LTA inspection', 'search', 'teal'], ['Helmet replace', 'helmet', 'gold']];
const BIKE_COLOURS = ['#FF6A13', '#F01E5C', '#7B55FF', '#06AFA2', '#1C8FEA', '#FFB000', '#22102F', '#E8E2EE'];

function fresh() {
  return {
    v: 2, setupDone: false,
    bike: { name: '', model: '', plate: '', year: '', cc: '', tank: 13, licence: '2B', colour: '#FF6A13' },
    items: ITEM_DEFS.map(([name, icon, col, km, months]) => ({ id: uid(), name, icon, col, km, months, lastOdo: null, lastDate: null })),
    renewals: RENEW_DEFS.map(([name, icon, col]) => ({ id: uid(), name, icon, col, date: '', cost: null })),
    services: [], fuel: [], rides: [], marks: [], odoLog: [], parked: null,
    intercom: null, seen: [], minMin: 3, minKm: .5,
    prefs: { sound: true, theme: 'auto' },
    stats: { exports: 0, wraps: 0 }, badges: {}
  };
}
let S = load();
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 2) return Object.assign(fresh(), s); } catch (e) {}
  return fresh();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Could not save — storage is full or blocked', 'x', 'red'); } }

/* ---------- odometer & tracking ---------- */
function odoReadings() {
  const r = [];
  S.fuel.forEach(f => f.odo != null && r.push({ t: +new Date(f.date + 'T12:00'), odo: +f.odo }));
  S.services.forEach(s => s.odo != null && r.push({ t: +new Date(s.date + 'T12:00'), odo: +s.odo }));
  S.odoLog.forEach(o => r.push({ t: +new Date(o.date + 'T12:00'), odo: +o.odo }));
  return r.sort((a, b) => a.t - b.t || a.odo - b.odo);
}
function lastActual() { const r = odoReadings(); return r.length ? r.reduce((m, x) => x.odo >= m.odo ? x : m) : null; }
// Learned correction: real odo km ÷ tracked km between two readings (catches rides that weren't logged + routing error)
function correction() {
  const r = odoReadings(); if (r.length < 2) return 1;
  let act = 0, trk = 0;
  for (let i = 1; i < r.length; i++) {
    const d = r[i].odo - r[i - 1].odo; if (d <= 0) continue;
    const t = S.rides.filter(x => x.end && x.end.t > r[i - 1].t && x.end.t <= r[i].t).reduce((s, x) => s + (x.km || 0), 0);
    if (t > 0) { act += d; trk += t; }
  }
  const c = trk > 0 ? act / trk : 1;
  return (c >= .5 && c <= 3) ? c : 1;
}
// Estimated odo now = last real reading + tracked rides since × correction
function estOdo() {
  const la = lastActual(); if (!la) return null;
  const since = S.rides.filter(x => x.end && x.end.t > la.t).reduce((s, x) => s + (x.km || 0), 0);
  return Math.round(la.odo + since * correction());
}

/* ---------- status ---------- */
function itemStatus(it) {
  const odo = estOdo();
  if (it.lastOdo == null && !it.lastDate) return { cls: 'unset', label: 'Not set', frac: 0, text: 'Log a service to start' };
  const fr = [], parts = [];
  if (it.km && it.lastOdo != null && odo != null) { const left = it.lastOdo + it.km - odo; fr.push(left / it.km); parts.push(left >= 0 ? `${num(left)} km left` : `${num(-left)} km over`); }
  if (it.months && it.lastDate) {
    const due = new Date(it.lastDate); due.setMonth(due.getMonth() + it.months);
    const left = Math.round((due - Date.now()) / DAY); fr.push(left / (it.months * 30.4)); parts.push(left >= 0 ? `${left} days` : `${-left} days over`);
  }
  if (!fr.length) return { cls: 'unset', label: 'Not set', frac: 0, text: 'Needs an odo reading' };
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
function fuelStats() {
  const f = [...S.fuel].sort((a, b) => a.odo - b.odo);
  let km = 0, L = 0, lastFull = null, pending = 0, best = null;
  for (const x of f) {
    if (lastFull) { pending += +x.litres || 0; if (x.full) { const d = x.odo - lastFull.odo; if (pending > 0 && d > 0) { const k = d / pending; best = Math.max(best || 0, k); } km += d; L += pending; pending = 0; lastFull = x; } }
    else if (x.full) lastFull = x;
  }
  const kpl = L > 0 ? km / L : null;
  const cost = S.fuel.reduce((s, x) => s + (+x.cost || 0), 0);
  const spanKm = f.length > 1 ? f[f.length - 1].odo - f[0].odo : 0;
  const last = f[f.length - 1];
  let range = null, tankFrac = null;
  if (kpl && last && S.bike.tank) {
    const used = Math.max(0, (estOdo() - last.odo) / kpl);
    const inTank = last.full ? +S.bike.tank : Math.min(+S.bike.tank, +S.bike.tank * .5 + (+last.litres || 0));
    const left = Math.max(0, inTank - used);
    range = Math.round(left * kpl); tankFrac = clamp(left / S.bike.tank, 0, 1);
  }
  return { kpl, cost, cpk: spanKm > 0 ? cost / spanKm : null, range, tankFrac, best };
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
async function routeKm(points) {
  try {
    const ctl = new AbortController(); setTimeout(() => ctl.abort(), 7000);
    const coords = points.map(p => `${p.lon.toFixed(5)},${p.lat.toFixed(5)}`).join(';');
    const j = await (await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=false`, { signal: ctl.signal })).json();
    if (j.code === 'Ok') return { km: j.routes[0].distance / 1000, src: 'route' };
  } catch (e) {}
  let d = 0; for (let i = 1; i < points.length; i++) d += haversine(points[i - 1], points[i]);
  return { km: d * 1.3, src: 'estimate' };
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
async function handleURL() {
  const p = new URLSearchParams(location.search); const evt = p.get('evt'); if (!evt) return null;
  history.replaceState(null, '', location.pathname);
  const f = k => parseFloat(p.get(k));
  if (evt === 'ride') {
    const sig = `ride:${p.get('st')}:${p.get('slat')}`; if (S.seen.includes(sig)) return null; S.seen = [...S.seen.slice(-60), sig];
    const start = { lat: f('slat'), lon: f('slon'), t: parseStamp(p.get('st')) }, end = { lat: f('elat'), lon: f('elon'), t: parseStamp(p.get('et')) };
    if (isNaN(start.lat) || isNaN(end.lat)) { save(); return { msg: 'Ride data was incomplete — check the Shortcut', icon: 'x', col: 'red' }; }
    if (end.t <= start.t) end.t = Date.now();
    S.parked = { lat: end.lat, lon: end.lon, t: end.t };
    const mins = (end.t - start.t) / 6e4;
    const marks = S.marks.filter(m => m.t >= start.t && m.t <= end.t).sort((a, b) => a.t - b.t);
    const straight = haversine(start, end);
    if (mins < S.minMin || (straight < S.minKm && !marks.length && mins < 15)) { save(); return { msg: 'Parked spot saved', icon: 'park', col: 'sky' }; }
    const r = await routeKm([start, ...marks, end]);
    const ride = { id: uid(), start, end, km: Math.round(r.km * 10) / 10, src: 'auto', est: r.src, loop: straight < 1 && mins >= 15 && !marks.length, title: '', note: '', mood: '' };
    S.rides.push(ride); save();
    return { ride };
  }
  if (evt === 'mark') {
    const m = { id: uid(), lat: f('lat'), lon: f('lon'), t: parseStamp(p.get('t')), note: p.get('note') || '' };
    if (isNaN(m.lat)) return { msg: 'No location in that mark', icon: 'x', col: 'red' };
    S.marks.push(m); save(); return { msg: 'Spot marked' + (m.note ? ': ' + m.note : ''), icon: 'pin', col: 'candy' };
  }
  if (evt === 'fuel') {
    const sig = `fuel:${p.get('odo')}:${p.get('litres')}`; if (S.seen.includes(sig)) return null; S.seen.push(sig);
    S.fuel.push({ id: uid(), date: todayISO(), odo: f('odo'), litres: f('litres') || 0, cost: f('cost') || 0, full: p.get('full') !== '0', station: '' });
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
  ['chain', 'Chain gang', 'chain', 'lilac', [3, 12, 30], () => { const id = S.items.find(i => i.icon === 'chain')?.id; return S.services.filter(s => s.items.includes(id)).length; }, 'chain lubes'],
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
