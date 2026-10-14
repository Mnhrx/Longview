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
    intercom: null, seen: [], minMin: 3, minKm: .5, fuelLight: null, relay: '', home: null, roads: [], rider: '', openRide: null,
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
  let range = null, tankFrac = null, pastE = false, light = false;
  if (kpl && last && S.bike.tank) {
    const odo = estOdo(), fl = S.fuelLight;
    let left;
    // the bike's own fuel light is the truth: once it's on, count down from the reserve instead
    if (fl && fl.odo >= last.odo) { light = true; left = (+S.bike.reserve || 2.5) - Math.max(0, (odo - fl.odo) / kpl); }
    else { const inTank = last.full ? +S.bike.tank : Math.min(+S.bike.tank, +S.bike.tank * .5 + (+last.litres || 0)); left = inTank - Math.max(0, (odo - last.odo) / kpl); }
    if (left < 0) pastE = true;
    left = Math.max(0, left);
    range = Math.round(left * kpl); tankFrac = clamp(left / S.bike.tank, 0, 1);
  }
  const low = range != null && (range < 60 || tankFrac < .15 || light);
  return { kpl, cost, cpk: spanKm > 0 ? cost / spanKm : null, range, tankFrac, best, low, pastE, light, full: kpl && S.bike.tank ? S.bike.tank * kpl : null };
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
    const j = await (await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=simplified&geometries=geojson&steps=true`, { signal: ctl.signal })).json();
    // keep the road shape (the ride's light trail) and the expressways it used (for traffic alerts)
    if (j.code === 'Ok') { const rt = j.routes[0], names = rt.legs.flatMap(l => l.steps.map(s => `${s.ref || ''} ${s.name || ''}`));
      return { km: rt.distance / 1000, src: 'route', path: rt.geometry.coordinates.map(([lo, la]) => [+la.toFixed(5), +lo.toFixed(5)]), roads: roadCodes(names.join(' | ')) }; }
  } catch (e) {}
  let d = 0; for (let i = 1; i < points.length; i++) d += haversine(points[i - 1], points[i]);
  return { km: d * 1.3, src: 'estimate', path: points.map(p => [p.lat, p.lon]) };
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
  const r = await routeKm([start, ...marks, end]);
  const ride = { id: uid(), start, end, km: Math.round(r.km * 10) / 10, src: 'auto', est: r.src, path: r.path, roads: r.roads || [], loop: straight < 1 && mins >= 15 && !marks.length, title: '', note: '', mood: '' };
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
    if (x.e === 'start') { S.openRide = { lat, lon, t: x.t }; save(); continue; }
    if (x.e === 'end') {
      const st = S.openRide; S.openRide = null;
      if (st && x.t - st.t < 12 * 3600e3) out.push(await logRide(st, { lat, lon, t: x.t }));
      else if (!isNaN(lat)) { S.parked = { lat, lon, t: x.t }; save(); out.push({ msg: 'Parked spot saved', col: 'sky' }); }
      continue;
    }
    if (x.e === 'mark' && !isNaN(lat)) { S.marks.push({ id: uid(), lat, lon, t: x.t, note: x.note || '' }); save(); out.push({ msg: 'Spot marked' + (x.note ? ': ' + x.note : '') }); continue; }
    if (x.e === 'fuel') { const f = parseFuel(x.fuel); if (!f.odo || !f.litres) { out.push({ msg: 'Couldn’t read that fill-up. Say odometer, litres, then cost.', col: 'red' }); continue; }
      S.fuel.push({ id: uid(), date: todayISO(new Date(x.t)), odo: f.odo, litres: f.litres, cost: f.cost || 0, full: true, station: '' }); save(); out.push({ msg: 'Fill-up logged', fuel: true }); continue; }
  }
  save(); return out;
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
