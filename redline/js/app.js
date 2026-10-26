/* ================================================================
   Redline: big, bold and colourful, with a real bike's gauge and odometer.
   Colour = category: orange fuel, yellow service, mint renewals, sky rides. Red only means overdue.
   ================================================================ */
const $ = (q, r = document) => r.querySelector(q), $$ = (q, r = document) => [...r.querySelectorAll(q)];
const viewEl = $('#view'), sheetEl = $('#sheet'), shadeEl = $('#shade');
const BIKE_TYPES = [['naked', 'Naked'], ['sport', 'Sport'], ['scooter', 'Scooter'], ['trike', '3-wheel scooter'], ['underbone', 'Underbone'], ['adventure', 'Adventure'], ['cruiser', 'Cruiser'], ['cafe', 'Sport classic'], ['classic', 'Classic naked']];
const typeName = k => (BIKE_TYPES.find(b => b[0] === k) || [k, k])[1];
const buildName = () => `${(DRIVES.find(d => d[0] === (S.bike.drive || 'chain')) || DRIVES[0])[1]} drive · ${S.bike.cooling === 'air' ? 'air' : 'liquid'}-cooled`.replace('Belt (CVT) drive', 'CVT belt');
const haptic = () => navigator.vibrate && navigator.vibrate(8);
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ui = t => `<b class="ui">${t}</b>`; // a highlighted button name inside guide text
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/* ---------- icons ---------- */
const IC = {
  coin: '<circle cx="12" cy="12" r="9"/><path d="M15 9.2c-.5-1-1.6-1.6-3-1.6-1.8 0-3 .9-3 2.2 0 3 6 1.6 6 4.6 0 1.3-1.3 2.2-3 2.2-1.5 0-2.7-.7-3.1-1.8M12 6v1.6M12 16.6V18"/>',
  share: '<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
  img: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  walk: '<circle cx="13" cy="4" r="2"/><path d="m9 21 2.5-6.5L14 17v4M7.5 12.5 9 8.5l4-1 2.5 3.5 3 1"/><path d="m11.5 14.5.9-5.5"/>',
  fuel: '<path d="M5 21V5a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v16M4 21h11M5 10h9"/><path d="M14 8h2l3 3v6a1.5 1.5 0 0 1-3 0v-2h-2"/>',
  ride: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.3 5.2L3.5 17.4a1.9 1.9 0 0 0 2.7 2.7l5.9-5.9a4 4 0 0 0 5.2-5.3l-2.6 2.6-2.3-.6-.6-2.3z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  odo: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10v4M10.5 10v4M14 10v4M17.5 10v4"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  pin: '<path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  home: '<path d="M4 11l8-7 8 7v9H4z"/>', garage: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8M18.5 18.5l-1.8-1.8M7.3 7.3L5.5 5.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>', plus: '<path d="M12 5v14M5 12h14"/>', chev: '<path d="M9 5l7 7-7 7"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  spk: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  bike: '<circle cx="5.5" cy="16.5" r="3.5"/><circle cx="18.5" cy="16.5" r="3.5"/><path d="M5.5 16.5l3.5-6h5.5l4 6M9 10.5l3 6h2.5M14.5 10.5L13 7h3"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>', head: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="13" width="4.5" height="6.5" rx="1"/><rect x="16.5" y="13" width="4.5" height="6.5" rx="1"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4.5M16 6h3a3 3 0 0 1-3 4.5M12 13v4M8.5 20.5h7M10 17h4"/>', play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>', save: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5"/><path d="M4.5 17v3.5h15V17"/>',
  park: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M10 16.5v-9h3a2.8 2.8 0 0 1 0 5.6h-3"/>',
  target: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2.5"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>', full: '<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>',
  cam: '<rect x="3" y="7" width="13" height="10" rx="2"/><path d="M16 11l5-3v8l-5-3"/>', alert: '<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17.5h.01"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>', cloud: '<path d="M7 18h10.5a4 4 0 0 0 0-8 6 6 0 0 0-11.5 1.5A3.3 3.3 0 0 0 7 18z"/>',
  rain: '<path d="M7 15h10.5a4 4 0 0 0 0-8 6 6 0 0 0-11.5 1.5A3.3 3.3 0 0 0 7 15z"/><path d="M8 18l-1 2.5M12 18l-1 2.5M16 18l-1 2.5"/>',
  storm: '<path d="M7 14h10.5a4 4 0 0 0 0-8 6 6 0 0 0-11.5 1.5A3.3 3.3 0 0 0 7 14z"/><path d="M12.5 15l-2 3.5h3l-2 3.5"/>',
  pump: '<path d="M4 20V5.5A1.5 1.5 0 0 1 5.5 4h6A1.5 1.5 0 0 1 13 5.5V20M3 20h11M4 10h9"/><path d="M13 7h2l3 3v6.5a1.5 1.5 0 0 1-3 0V14h-2"/>',
};
const ic = (n, w = 2.2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n] || ''}</svg>`;
const PART_ICON = {
  frontTyre: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3"/>',
  rearTyre: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/><path d="M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2"/>',
  chain: '<rect x="2.5" y="8.5" width="10" height="7" rx="3.5"/><rect x="11.5" y="8.5" width="10" height="7" rx="3.5"/>',
  oil: '<path d="M12 3.5s-6 7-6 10.5a6 6 0 0 0 12 0C18 10.5 12 3.5 12 3.5z"/>',
  coolant: '<path d="M10 4h4v10.5a3.5 3.5 0 1 1-4 0z"/><path d="M3 20c1.5-1 3-1 4.5 0s3 1 4.5 0 3-1 4.5 0 3 1 4.5 0"/>',
  brakes: '<circle cx="11" cy="12" r="8"/><circle cx="11" cy="12" r="2"/><path d="M17 5.5l3 2v9l-3 2"/>',
  spark: '<path d="M9 2.5h6v4H9zM10 6.5h4v6h-4zM12 12.5v4M12 16.5l-2.5 2.5h5L12 21.5"/>',
  air: '<path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8"/>',
  other: IC.wrench,
};
const pic = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PART_ICON[k] || PART_ICON.other}</svg>`;
const statusDot = s => `<i class="dot ${s}"></i>`;

/* ---------- toast + banner ---------- */
function toast(msg, kind = '') { const t = $('#toast'); t.textContent = msg; t.className = 'toast on ' + kind; clearTimeout(t._h); t._h = setTimeout(() => t.className = 'toast ' + kind, 2800); }
window.toast = toast;
function banner(msg, cta, fn) {
  const b = $('#banner'); b.innerHTML = `<span>${esc(msg)}</span><b>${esc(cta)}</b>`; b.classList.add('on'); b.onclick = () => { b.classList.remove('on'); fn(); };
  clearTimeout(b._h); b._h = setTimeout(() => b.classList.remove('on'), 9000);
}


/* ================= the instrument: a spring-loaded needle and a rolling odometer ================= */
const GA = { cx: 180, cy: 150, R: 128, a0: -125, a1: 125 };
const gp = (a, r) => { a = a * Math.PI / 180; return [GA.cx + r * Math.sin(a), GA.cy - r * Math.cos(a)]; };
const garc = (a0, a1, r) => { const [x0, y0] = gp(a0, r), [x1, y1] = gp(a1, r); return `M${x0.toFixed(1)},${y0.toFixed(1)}A${r},${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(1)},${y1.toFixed(1)}`; };
function gaugeSVG(id) {
  const { R, a0, a1 } = GA, eEnd = a0 + 25; let t = '';
  for (let i = 0; i <= 40; i++) { const a = a0 + (a1 - a0) * i / 40, major = i % 10 === 0, [x0, y0] = gp(a, R - 20 - (major ? 14 : 7)), [x1, y1] = gp(a, R - 20);
    t += `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" class="${a < eEnd ? 'tk e' : major ? 'tk m' : 'tk'}" style="--i:${i}"/>`; }
  const lab = (f, s, c) => { const [x, y] = gp(a0 + (a1 - a0) * f, R - 50); return `<text x="${x.toFixed(1)}" y="${(y + 6).toFixed(1)}" class="gl ${c || ''}">${s}</text>`; };
  return `<svg class="gsvg" viewBox="16 0 328 236" aria-hidden="true">
    <path d="${garc(a0, a1, R)}" class="track"/><path d="${garc(a0, eEnd, R)}" class="ezone"/>
    <path d="${garc(a0, a1, R)}" pathLength="100" class="fill" id="${id}Arc"/><g class="ticks">${t}</g>${lab(0, 'E', 'e')}${lab(.5, '½')}${lab(1, 'F')}
    <g class="ndl" id="${id}Ndl"><line x1="180" y1="62" x2="180" y2="8"/></g></svg>`;
}
const G = {};
function gaugeDraw(id) {
  const g = G[id], n = $('#' + id + 'Ndl'), a = $('#' + id + 'Arc'), r = $('#' + id + 'Read'); if (!n) return;
  const f = Math.max(-.04, Math.min(1.04, g.f));
  n.style.transform = `rotate(${GA.a0 + (GA.a1 - GA.a0) * f}deg)`; a.style.strokeDasharray = `${(Math.max(0, Math.min(1, f)) * 100).toFixed(2)} 100`;
  if (r && g.full) r.textContent = Math.max(0, Math.round(Math.min(1, f) * g.full));
}
// a damped spring: the needle overshoots a touch and settles, like a real one
function gaugeTo(id, tgt, k = 90, c = 11) {
  const g = G[id] || (G[id] = { f: 0, v: 0 }); g.tgt = tgt; g.k = k; g.c = c;
  if (RM) { g.f = tgt; g.v = 0; gaugeDraw(id); return; }
  if (g.raf) return; let last = performance.now();
  const step = now => { const dt = Math.min(.032, (now - last) / 1000); last = now;
    for (let s = 0; s < 4; s++) { const acc = -g.k * (g.f - g.tgt) - g.c * g.v; g.v += acc * dt / 4; g.f += g.v * dt / 4; }
    gaugeDraw(id); if (Math.abs(g.f - g.tgt) < .0008 && Math.abs(g.v) < .001) { g.f = g.tgt; gaugeDraw(id); g.raf = 0; return; } g.raf = requestAnimationFrame(step); };
  g.raf = requestAnimationFrame(step);
}
function gaugeSet(id, f, full) { const g = G[id] || (G[id] = { f: 0, v: 0 }); g.full = full; g.f = f; g.v = 0; g.tgt = f; if (g.raf) { cancelAnimationFrame(g.raf); g.raf = 0; } gaugeDraw(id); }
// key-on: needle swings to F, drops to E, then settles on your range
function keyOn(id, f, full) {
  gaugeSet(id, 0, full); const d = $('#' + id + 'Dash'); if (d) { d.classList.remove('ign'); void d.offsetWidth; d.classList.add('ign'); }
  if (RM) { gaugeSet(id, f, full); return; }
  setTimeout(() => gaugeTo(id, 1, 70, 13), 120); setTimeout(() => gaugeTo(id, 0, 60, 12), 820); setTimeout(() => gaugeTo(id, f, 80, 9), 1350);
}
// roller odometer: 7 drums, each strip holds 0–9 four times so a drum can spin whole turns before landing
function odoHTML() { return `<div class="drums" id="drums" role="img">${Array.from({ length: 7 }, (_, i) => `<div class="drum${i === 6 ? ' last' : ''}"><div class="strip">${Array.from({ length: 40 }, (_, n) => `<i>${n % 10}</i>`).join('')}</div></div>`).join('')}</div>`; }
function setOdo(v, animate) {
  const d = $('#drums'); if (!d) return; const s = String(Math.round((v || 0) * 10)).padStart(7, '0').slice(-7);
  [...d.children].forEach((x, i) => { const st = x.firstChild, dg = +s[i], cur = +(st.dataset.i || 0);
    if (!animate || RM) { st.style.transition = 'none'; st.dataset.i = dg; st.style.transform = `translateY(${-dg * 2.5}%)`; return; }
    const spins = i === 6 ? 3 : i === 5 ? 2 : i === 4 ? 1 : 0; let idx = dg + 10 * spins; if (idx <= cur && dg !== cur % 10) idx += 10; if (dg === cur % 10 && !spins) idx = cur;
    st.style.transition = `transform ${1.1 + spins * .25}s cubic-bezier(.3,1.25,.45,1) ${(6 - i) * 70}ms`; st.dataset.i = idx; st.style.transform = `translateY(${-idx * 2.5}%)`;
    st.ontransitionend = () => { st.style.transition = 'none'; st.dataset.i = dg; st.style.transform = `translateY(${-dg * 2.5}%)`; }; });
  d.setAttribute('aria-label', `Odometer ${num(v, 1)} km`);
}
/* ================= live info: Ride window (NEA 2-hour forecast), checkpoint cameras, incidents ================= */
const LIVE = { wx: null, cams: null, inc: null };
const WX_ICON = t => /thunder/i.test(t) ? 'storm' : /rain|shower|drizzle/i.test(t) ? 'rain' : /cloud|overcast|hazy|mist/i.test(t) ? 'cloud' : /night/i.test(t) ? 'moon' : 'sun';
const wet = t => /rain|shower|thunder|drizzle/i.test(t);
function refPoint() {
  const lastRide = [...S.rides].filter(r => r.end && r.end.lat).sort((a, b) => b.end.t - a.end.t)[0];
  return S.parked || (lastRide && { lat: lastRide.end.lat, lon: lastRide.end.lon }) || S.home || { lat: 1.3521, lon: 103.8198 };
}
async function getJSON(u) { const c = new AbortController(); setTimeout(() => c.abort(), 8000); const r = await fetch(u, { signal: c.signal, cache: 'no-store' }); if (!r.ok) throw new Error(r.status); return r.json(); }
async function loadWeather(force) {
  if (window.PREVIEW) { LIVE.wx = { area: 'Tampines', text: 'Partly Cloudy (Night)', until: '11pm' }; return; }
  if (!force && LIVE.wx && Date.now() - LIVE.wx.t < 6e5) return;
  try {
    let meta, fc, until;
    try { const j = await getJSON('https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast'); const d = j.data; meta = d.area_metadata; fc = d.items[0].forecasts; until = d.items[0].valid_period && d.items[0].valid_period.end; }
    catch (e) { const j = await getJSON('https://api.data.gov.sg/v1/environment/2-hour-weather-forecast'); meta = j.area_metadata; fc = j.items[0].forecasts; until = j.items[0].valid_period && j.items[0].valid_period.end; }
    const p = refPoint(); let best = null, bd = 1e9;
    for (const m of meta) { const d = haversine(p, { lat: m.label_location.latitude, lon: m.label_location.longitude }); if (d < bd) { bd = d; best = m.name; } }
    const f = fc.find(x => x.area === best) || fc[0], text = typeof f.forecast === 'string' ? f.forecast : (f.forecast.text || '');
    LIVE.wx = { t: Date.now(), area: best, text, until: until ? new Date(until).toLocaleTimeString('en-SG', { hour: 'numeric' }).replace(' ', '').toLowerCase() : '' };
  } catch (e) { LIVE.wx = LIVE.wx || { err: true }; }
}
// Each crossing has several LTA cameras. Checkpoint (customs) view is the default; tap to cycle, star to make one your default.
const CAMSETS = [
  { k: 'wdl', name: 'Woodlands', at: { lat: 1.4456, lon: 103.7683 }, angles: [['2702', 'Checkpoint', 'Woodlands Checkpoint'], ['2701', 'Causeway', 'Causeway to JB'], ['2704', 'BKE', 'BKE towards checkpoint']] },
  { k: 'tuas', name: 'Tuas', at: { lat: 1.3476, lon: 103.6367 }, angles: [['4713', 'Checkpoint', 'Tuas Checkpoint'], ['4703', 'Second Link', 'Second Link to JB']] },
];
const camView = {}; // which angle each crossing is showing right now (resets to your default on restart)
function camAngles(set) {
  const all = LIVE.camAll, known = new Set(set.angles.map(a => a[0]));
  let list = all ? set.angles.filter(([id]) => all.some(c => c.camera_id === id)) : set.angles.slice();
  // any other camera LTA has within 3 km of the checkpoint becomes an extra angle
  if (all) all.filter(c => !known.has(c.camera_id) && haversine(set.at, { lat: c.location.latitude, lon: c.location.longitude }) < 3)
    .sort((a, b) => haversine(set.at, { lat: a.location.latitude, lon: a.location.longitude }) - haversine(set.at, { lat: b.location.latitude, lon: b.location.longitude }))
    .forEach(c => list.push([c.camera_id, 'Nearby', `${num(haversine(set.at, { lat: c.location.latitude, lon: c.location.longitude }), 1)} km from checkpoint`]));
  return list.length ? list : set.angles.slice(0, 1);
}
function camDefault(set) { return (S.camPref && S.camPref[set.k]) || set.angles[0][0]; }
function camCurrent(set) { const list = camAngles(set), id = camView[set.k] || camDefault(set); return list.find(a => a[0] === id) || list[0]; }
async function loadCams() {
  if (window.PREVIEW) { LIVE.cams = { sample: true }; return; }
  try { const j = await getJSON('https://api.data.gov.sg/v1/transport/traffic-images'); const all = j.items[0].cameras; LIVE.camAll = all; LIVE.cams = {}; for (const c of all) LIVE.cams[c.camera_id] = { img: c.image, t: c.timestamp }; }
  catch (e) { LIVE.cams = { err: true }; }
}
// one cam = a swipe strip of every angle (native scroll-snap, so it feels like iPhone photos)
function camSlide(set, [id, ang, sub]) {
  const c = LIVE.cams, x = c && c[id];
  return `<div class="slide" data-id="${id}">${x && x.img ? `<img src="${x.img}" alt="Live camera, ${esc(sub)}" loading="lazy" draggable="false">` : `<div class="camph ph-${id.slice(-1) % 3}"><span class="rec"></span>${ic('cam', 1.8)}<span>${c && c.sample ? `Live ${esc(ang.toLowerCase())} view in the app` : c && c.err ? 'Camera unavailable' : 'Loading…'}</span></div>`}</div>`;
}
function camHTML(set) {
  const list = camAngles(set), cur = camCurrent(set), [id, ang, sub] = cur, x = LIVE.cams && LIVE.cams[id], fav = S.camPref && S.camPref[set.k] === id;
  return `<div class="cam" data-cam="${set.k}"><div class="shot"><div class="swipe" tabindex="0" aria-label="${esc(set.name)} cameras. Swipe for other angles">${list.map(a => camSlide(set, a)).join('')}</div>
      <span class="ang">${esc(ang)}</span><button type="button" class="star ${fav ? 'on' : ''}" data-star="${set.k}" aria-pressed="${fav}" aria-label="${fav ? 'Remove as default angle' : 'Make this the default angle'}">${ic('star', 2)}</button>
      ${list.length > 1 ? `<span class="dots">${list.map(a => `<i class="${a[0] === id ? 'on' : ''}"></i>`).join('')}</span>` : ''}</div>
    <div class="cn"><b>${esc(set.name)}</b>${x && x.img ? `<a class="full" href="${x.img}" target="_blank" rel="noopener" aria-label="Open full size">${ic('full', 2.2)}</a>` : ''}</div><span class="csub">${esc(sub)}${x && x.t ? ' · ' + new Date(x.t).toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit' }) : ''}</span></div>`;
}
// sync label, dots, star and caption to whichever angle is in view
function camSync(el) {
  const set = CAMSETS.find(x => x.k === el.dataset.cam), [id, ang, sub] = camCurrent(set), list = camAngles(set), x = LIVE.cams && LIVE.cams[id], fav = S.camPref && S.camPref[set.k] === id;
  $('.ang', el).textContent = ang; $$('.dots i', el).forEach((d, i) => d.classList.toggle('on', list[i] && list[i][0] === id));
  const st = $('.star', el); st.classList.toggle('on', !!fav); st.setAttribute('aria-pressed', String(!!fav)); st.setAttribute('aria-label', fav ? 'Remove as default angle' : 'Make this the default angle');
  $('.csub', el).textContent = sub + (x && x.t ? ' · ' + new Date(x.t).toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit' }) : '');
  const f = $('.full', el); if (f && x && x.img) f.href = x.img;
}
function wireCams(root) {
  $$('.cam', root).forEach(el => {
    if (el._wired) return; el._wired = true;
    const set = CAMSETS.find(x => x.k === el.dataset.cam), sw = $('.swipe', el), list = () => camAngles(set);
    const jump = (smooth) => { const i = list().indexOf(camCurrent(set)); sw.scrollTo({ left: i * sw.clientWidth, behavior: smooth ? 'smooth' : 'instant' }); };
    requestAnimationFrame(() => jump(false));
    let t = 0; sw.addEventListener('scroll', () => { cancelAnimationFrame(t); t = requestAnimationFrame(() => {
      const i = Math.round(sw.scrollLeft / Math.max(1, sw.clientWidth)), a = list()[i]; if (a && camView[set.k] !== a[0]) { camView[set.k] = a[0]; camSync(el); haptic(); } }); }, { passive: true });
    // a tap (not a swipe) steps to the next angle
    let sx = 0; sw.addEventListener('pointerdown', e => sx = e.clientX);
    sw.addEventListener('click', e => { if (Math.abs(e.clientX - sx) > 8) return; haptic(); camViewer(set.k, () => { jump(false); camSync(el); }); });
    $('.star', el).addEventListener('click', e => { e.stopPropagation(); const [id, ang] = camCurrent(set);
      const on = S.camPref && S.camPref[set.k] === id; S.camPref = Object.assign({}, S.camPref); if (on) delete S.camPref[set.k]; else S.camPref[set.k] = id; save(); camSync(el); haptic();
      if (!RM) e.currentTarget.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35) rotate(-12deg)' }, { transform: 'scale(1)' }], { duration: 420, easing: 'cubic-bezier(.2,1.4,.4,1)' });
      toast(on ? `${set.name} back to opening on ${set.angles[0][1]}` : `${set.name} will open on ${ang}`); });
  });
}
// full-screen camera: pinch or double-tap to zoom, drag to look around, switch angles at the bottom
function camViewer(k, onClose) {
  const set = CAMSETS.find(x => x.k === k); let box = $('#lbox');
  if (!box) { box = document.createElement('div'); box.id = 'lbox'; box.className = 'lbox'; document.body.appendChild(box); }
  let z = 1, x = 0, y = 0;
  const paint = () => {
    const list = camAngles(set), [id, ang, sub] = camCurrent(set), c = LIVE.cams, im = c && c[id];
    box.innerHTML = `<div class="lb-top"><div class="grow"><b>${esc(set.name)} · ${esc(ang)}</b><span>${esc(sub)}${im && im.t ? ' · ' + fmtTime(im.t) : ''}</span></div><button type="button" class="lb-x" aria-label="Close">${ic('x', 2.6)}</button></div>
      <div class="lb-stage">${im && im.img ? `<img class="lb-img" src="${im.img}" alt="${esc(sub)}" draggable="false">` : `<div class="lb-img lb-ph">${ic('cam', 1.8)}<span>${c && c.sample ? 'The live photo shows here in the app' : 'Camera unavailable right now'}</span></div>`}</div>
      <div class="lb-angles">${list.map(a => `<button type="button" class="${a[0] === id ? 'on' : ''}" data-ang="${a[0]}">${esc(a[1])}</button>`).join('')}</div>
      <p class="lb-hint">Pinch or double-tap to zoom</p>`;
    z = 1; x = 0; y = 0; apply();
    $('.lb-x', box).onclick = close; $$('[data-ang]', box).forEach(b => b.onclick = () => { camView[k] = b.dataset.ang; haptic(); paint(); });
  };
  const img = () => $('.lb-img', box);
  const apply = () => { const st = $('.lb-stage', box), im = img(); if (!im || !st) return; const lim = (st.clientWidth * (z - 1)) / 2, limy = (st.clientHeight * (z - 1)) / 2; x = Math.max(-lim, Math.min(lim, x)); y = Math.max(-limy, Math.min(limy, y)); im.style.transform = `translate(${x}px,${y}px) scale(${z})`; };
  const close = () => { box.classList.remove('on'); setTimeout(() => { box.innerHTML = ''; }, 250); onClose && onClose(); };
  // gestures
  const pts = new Map(); let start = null, lastTap = 0;
  box.onpointerdown = e => { if (!e.target.closest('.lb-stage')) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); const a = [...pts.values()]; start = { z, x, y, d: a.length > 1 ? Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) : 0, cx: a.reduce((s, p) => s + p.x, 0) / a.length, cy: a.reduce((s, p) => s + p.y, 0) / a.length, moved: false }; };
  box.onpointermove = e => { if (!pts.has(e.pointerId) || !start) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); const a = [...pts.values()], cx = a.reduce((s, p) => s + p.x, 0) / a.length, cy = a.reduce((s, p) => s + p.y, 0) / a.length;
    if (a.length > 1 && start.d) z = Math.max(1, Math.min(5, start.z * Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) / start.d));
    x = start.x + (cx - start.cx); y = start.y + (cy - start.cy); if (Math.hypot(cx - start.cx, cy - start.cy) > 6) start.moved = true;
    if (z === 1 && a.length === 1) { x = 0; const dy = cy - start.cy; y = Math.max(0, dy); const im = img(); if (im) im.style.transform = `translateY(${y}px) scale(${1 - Math.min(.15, y / 2000)})`; box.style.background = `rgba(10,8,12,${.96 - Math.min(.5, y / 600)})`; return; }
    apply(); };
  box.onpointerup = box.onpointercancel = e => { if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId);
    if (!pts.size) { box.style.background = ''; if (z === 1 && y > 110) { close(); return; }
      if (start && !start.moved) { const now = performance.now(); if (now - lastTap < 300) { z = z > 1 ? 1 : 2.6; if (z > 1) { const st = $('.lb-stage', box).getBoundingClientRect(); x = (st.left + st.width / 2 - e.clientX) * 1.6; y = (st.top + st.height / 2 - e.clientY) * 1.6; } else { x = y = 0; } const im = img(); if (im) im.style.transition = 'transform .28s cubic-bezier(.2,1,.3,1)'; apply(); setTimeout(() => { const i2 = img(); if (i2) i2.style.transition = ''; }, 300); lastTap = 0; } else lastTap = now; }
      if (z === 1) { x = y = 0; apply(); } start = null; } };
  paint(); requestAnimationFrame(() => box.classList.add('on'));
}
// new camera pictures arrive every few minutes: swap the images in place so a swipe in progress isn't reset
function refreshCamImgs(root) {
  $$('.cam', root).forEach(el => { const set = CAMSETS.find(x => x.k === el.dataset.cam);
    $$('.slide', el).forEach(sl => { const x = LIVE.cams && LIVE.cams[sl.dataset.id]; const img = $('img', sl); if (x && x.img) { if (img) { if (img.src !== x.img) img.src = x.img; } else sl.outerHTML = camSlide(set, camAngles(set).find(a => a[0] === sl.dataset.id)); } }); camSync(el); });
}
// incidents near the roads you actually ride (needs your free DataMall relay)
function myRoadPoints() { const pts = []; for (const r of S.rides) if (r.path) for (let i = 0; i < r.path.length; i += 3) pts.push({ lat: r.path[i][0], lon: r.path[i][1] }); return pts; }
const SAMPLE_INC = [
  { Type: 'Heavy Traffic', Message: '(9/10)18:05 Heavy Traffic on ECP (towards City) after Bedok Rd.' },
  { Type: 'Accident', Message: '(9/10)17:52 Accident on PIE (towards Tuas) after Eunos Link. Avoid lane 1.' },
  { Type: 'Vehicle breakdown', Message: '(9/10)18:01 Vehicle breakdown on AYE (towards City) after Clementi Ave 6.' },
  { Type: 'Heavy Traffic', Message: '(9/10)17:40 Heavy Traffic at Woodlands Causeway (towards Johor).' }];
// LTA incidents name the road in the message, so matching by name works from day one, no ride history needed
async function loadIncidents() {
  let all = null;
  if (window.PREVIEW) all = S.demoInc ? SAMPLE_INC : [];
  else if (S.relay) { try { const j = await getJSON(S.relay.replace(/\/$/, '') + '?path=TrafficIncidents'); all = j.value || []; } catch (e) { all = null; } }
  if (!all) { LIVE.all = LIVE.inc = null; return; }
  LIVE.all = all.map(x => ({ ...x, roads: roadCodes(x.Message || '') })).filter(x => x.roads.length);
  const mine = myRoads(); LIVE.inc = LIVE.all.filter(x => x.roads.some(c => mine.includes(c)));
}
const incText = m => (m || '').replace(/^\(\d+\/\d+\)\d+:\d+\s*/, '').replace(/\.$/, '');
const incKind = t => /heavy traffic/i.test(t) ? 'Jam' : /accident/i.test(t) ? 'Accident' : /breakdown/i.test(t) ? 'Breakdown' : /road ?work/i.test(t) ? 'Roadworks' : t || 'Incident';
async function loadLive(force) { await Promise.all([loadWeather(force), loadCams(), loadIncidents()]); if (place === 0 || place === 1) paintLive(); }


/* ================= screens: one big thing each, then only what you'd act on ================= */
const TABS = ['Home', 'Rides', 'Garage', 'Fuel'];
let place = 0;
const shortRen = n => n.replace(' expiry', '').replace(' replace', '');
function dueItems() { return S.items.map(i => ({ i, s: itemStatus(i) })).filter(x => x.s.cls === 'over' || x.s.cls === 'soon').sort((a, b) => a.s.frac - b.s.frac); }
function bigVal(s) { const m = s.text.split(' · ')[0].match(/([\d,]+)\s*(km|days)\s*(left|over)?/); if (!m) return esc(s.text); return `${m[3] === 'over' ? '+' : ''}${m[1]}<small>${m[2]}${m[3] === 'over' ? ' over' : ''}</small>`; }
function gaugeBlock(id, fs) {
  return `<div class="dash ${fs.low ? 'low' : ''}" id="${id}Dash">${gaugeSVG(id)}
      <div class="lamp ${fs.light || fs.low ? 'on' : fs.tankFrac != null && fs.tankFrac < .25 ? 'dim' : 'off'}" id="${id}Lamp">${ic('pump')}</div>
      <div class="read"><b id="${id}Read">${fs.range == null ? '—' : fs.range}</b><span>${fs.pastE ? 'PAST E · FILL UP' : fs.range == null ? 'LOG A FULL TANK' : fs.est ? 'KM RANGE · EST' : 'KM RANGE'}</span></div></div>
    ${fs.range != null ? `<button type="button" class="lightbtn ${fs.light ? 'on' : ''}" data-act="light">${ic('pump')}<span>${fs.light ? 'Fuel light on · undo' : 'Fuel light on?'}</span></button>` : ''}`;
}
function wrapMonth() { const n = new Date(), d = new Date(n.getFullYear(), n.getMonth() - 1, 1); return { y: d.getFullYear(), m: d.getMonth(), key: `${d.getFullYear()}-${d.getMonth()}` }; }
function wrapReady() { const w = wrapMonth(); return monthRides(w.y, w.m).length >= 3 && (window.PREVIEW || S.wrapSeen !== w.key || new Date().getDate() <= 7); }
function homeHTML() {
  const fs = fuelStats(), due = dueItems(), mr = monthRides(), mkm = mr.reduce((s, r) => s + (r.km || 0), 0), nr = nextRenewal();
  const w = wrapMonth();
  return `<div class="hi"><div><h1>${esc(S.bike.name || 'Your bike')}</h1><small>${esc(S.bike.model || buildName())}${S.bike.plate ? ` <span class="plate">${esc(S.bike.plate)}</span>` : ''}</small></div></div>
    <div class="hcol a"><div class="instr">${gaugeBlock('h', fs)}${estOdo() == null ? `<button type="button" class="odo blank" data-act="odo" aria-label="Add your odometer reading"><span class="lab">ODO</span>${odoHTML().replace('class="drums"', 'class="drums blank"')}<span class="lab">KM</span></button><span class="odohint">Tap to add your odometer</span>` : `<button type="button" class="odo tapodo" data-act="mydata" aria-label="Odometer readings"><span class="lab">ODO</span>${odoHTML()}<span class="lab">KM</span></button>`}${(() => { const oi = odoInfo(); return oi ? `<button type="button" class="odosince" data-act="mydata">${oi.since > 0 ? `<b>+${num(oi.since * oi.c, 1)} km</b> ridden since your reading on ${fmtDs(todayISO(new Date(oi.la.t)))}` : `From your reading on ${fmtDs(todayISO(new Date(oi.la.t)))}`}</button>` : ''; })()}</div>
    <div id="rideNow">${rideNowHTML()}</div>${alNudgeHTML()}</div>
    <div class="hcol b">${newItemsHTML()}${scanQHTML()}${tripAskHTML()}${parkHTML()}<div class="alerts" id="alerts">${alertsHTML()}</div>
    <div id="live0"></div>
    <section class="card rdhome" data-act="radar"><canvas id="rdh" aria-label="Rain radar, last hour"></canvas><div class="rdtime"><b>Rain radar</b><span>Loading…</span></div><div class="rdload"><i></i><i></i><i></i></div><span class="rdexp">${ic('full', 2.2)}</span>${window.RADAR ? RADAR.ATTR : ''}</section>
    <div class="cams" id="cams"></div>
    ${wrapReady() ? `<button type="button" class="wrapcta" data-act="wrap"><span class="wglow"></span><span class="wt"><small>Ride Wrap</small><b>Your ${new Date(w.y, w.m, 1).toLocaleDateString('en-SG', { month: 'long' })} is ready</b></span><span class="wplay">${ic('play', 2.6)}</span></button>` : ''}</div>`;
}
// only what needs you now, most urgent first, never more than three
const renWindow = r => /coe/i.test(r.name) ? 90 : 30;
function alertsHTML() {
  const fs = fuelStats(), due = dueItems(), out = [];
  const partCard = top => `<section class="card c-lemon alertc ${top.s.cls}" data-part="${top.i.part}">${ART.art(top.i.part, top.s.frac, top.s.cls, 68)}<div class="t"><span>${top.s.cls === 'over' ? '<em>OVERDUE</em>' : '<em class="soon">DUE SOON</em>'}${esc(top.i.name)}</span><b>${bigVal(top.s)}</b></div><button type="button" class="sqbtn" data-done="${top.i.id}" aria-label="Mark ${esc(top.i.name)} done today">${ic('check', 3)}</button></section>`;
  if (S.needFull) out.push(`<section class="card c-lemon alertc ren" data-act="fullsvc"><span class="renic">${ic('wrench', 2.4)}</span><div class="t"><span>Last service unknown</span><b style="font-size:21px">Get a full service</b></div><span class="minibtn dark">Log it</span></section>`);
  if (estOdo() == null) out.push(`<section class="card c-mint alertc ren" data-act="odo"><span class="renic">${ic('odo', 2.4)}</span><div class="t"><span>Odometer</span><b style="font-size:22px">Add a reading</b></div><span class="minibtn dark">Add</span></section>`);
  if (fs.low) out.push(`<section class="card c-red alertc"><div class="t"><span>${fs.pastE ? 'Past E' : 'Low fuel'}</span><b>${fs.pastE ? 'Fill up now' : `${fs.range}<small>km left</small>`}</b></div><a class="cbtn" href="${isIOS ? 'https://maps.apple.com/?q=petrol%20station' : 'https://www.google.com/maps/search/petrol+station/'}" target="_blank" rel="noopener">${ic('pin')}<span>Find petrol</span></a></section>`);
  const over = due.filter(x => x.s.cls === 'over'); if (over[0]) out.push(partCard(over[0]));
  if (LIVE.inc && LIVE.inc[0]) { const x = LIVE.inc[0]; out.push(`<section class="card c-red incident" data-tab="1"><span class="incic ${incKind(x.Type) === 'Jam' ? 'jam' : ''}">${ic(incKind(x.Type) === 'Jam' ? 'odo' : 'alert')}</span><div><span>${incKind(x.Type)} on your road${LIVE.inc.length > 1 ? ` · +${LIVE.inc.length - 1} more` : ''}</span><b>${esc(incText(x.Message))}</b></div></section>`); }
  S.renewals.filter(r => r.date).map(r => ({ r, s: renewStatus(r) })).filter(x => x.s.days <= renWindow(x.r)).sort((a, b) => a.s.days - b.s.days).slice(0, 1).forEach(({ r, s }) =>
    out.push(`<section class="card ${s.days < 0 ? 'c-red' : 'c-mint'} alertc ren"><span class="renic">${ic('cal', 2.4)}</span><div class="t"><span>${esc(r.name)}${s.days < 0 ? ' · overdue' : ''}</span><b>${s.days < 0 ? -s.days + '<small>days late</small>' : s.days === 0 ? 'Today' : s.days + '<small>days</small>'}</b></div>
      <div class="renbtns">${/road tax|coe|inspection/i.test(r.name) ? `<a class="minibtn" href="https://onemotoring.lta.gov.sg" target="_blank" rel="noopener">Renew</a>` : ''}<button type="button" class="minibtn dark" data-rdone="${r.id}">Done</button></div></section>`));
  if (!over[0] && due[0]) out.push(partCard(due[0]));
  return out.slice(0, 3).join('');
}
function wxIcon(t) { const k = WX_ICON(t); return `<span class="wxi wx-${k}">${ic(k, 2.2)}${k === 'rain' || k === 'storm' ? '<i></i><i></i><i></i>' : ''}</span>`; }
function liveHome() {
  const w = LIVE.wx, inc = LIVE.inc; let h = '';
  if (w && !w.err) h += `<button type="button" class="wxrow ${wet(w.text) ? 'wet' : ''}" data-act="radar">${wxIcon(w.text)}<div class="grow"><b>${esc(w.text.replace(/\s*\((Day|Night)\)/i, ''))}</b><span>${esc(w.area)}${w.until ? ' · till ' + w.until : ''}</span></div><span class="wxr"><span class="verdict">${wet(w.text) ? 'Rain gear' : 'Good to ride'}</span><span class="rdlink"><i class="sweep"></i>Radar</span></span></button>`;
  else h += `<button type="button" class="wxrow" data-act="radar"><span class="wxi wx-cloud">${ic('cloud', 2.2)}</span><div class="grow"><b>Rain radar</b><span>The last hour, every 5 minutes</span></div><span class="rdlink"><i class="sweep"></i>Radar</span></button>`;
  return h;
}
function abroadKm(r) { if (!r.path || r.path.length < 2 || !window.MAP) return 0; return (r.km || 0) * r.path.filter(([la, lo]) => !MAP.inSG(la, lo)).length / r.path.length; }
function ridesHTML() {
  const mr = monthRides(), km = mr.reduce((s, r) => s + (r.km || 0), 0), longest = mr.reduce((a, r) => Math.max(a, r.km || 0), 0);
  const rides = [...S.rides].sort((a, b) => b.start.t - a.start.t), abroad = rides.reduce((s, r) => s + abroadKm(r), 0);
  return `<div class="hi"><div><h1>Rides</h1></div></div>
    <div class="hcol a"><section class="card mapcard" id="mapcard"><canvas id="mapcv" aria-label="Map of your rides"></canvas>
      <div class="mo"><span>${new Date().toLocaleDateString('en-SG', { month: 'long' })}</span><b><span class="cnt" data-to="${Math.round(km)}">${Math.round(km)}</span><small>km</small></b></div>
      ${window.RADAR ? RADAR.ATTR : ''}<div class="mfocus" id="mfocus" hidden></div><button type="button" class="mre" id="mre" hidden>${ic('target', 2.4)}<span>Re-centre</span></button></section>
    ${S.rides.length ? `<div class="mleg">${['gps', 'pick', 'guess'].map(k => `<span style="--kc:${RIDE_KINDS[k][1]}"><i></i>${RIDE_KINDS[k][0]} <b>${S.rides.filter(r => rideKind(r) === k).length}</b></span>`).join('')}</div>` : ''}
    <div class="stats"><div><b class="cnt" data-to="${mr.length}">${mr.length}</b><span>rides</span></div><div><b>${num(longest, longest < 100 ? 1 : 0)}</b><span>longest km</span></div><div><b>${num(abroad)}</b><span>km in JB</span></div></div></div>
    <div class="hcol b"><h2 class="sec">Road check</h2>
    <div class="roadchk"><div id="live1a"></div><div class="cams" id="cams"></div><div id="live1"></div></div>
    <h2 class="sec">Journal</h2>
    <section class="list2">${rides.length ? rides.slice(0, 40).map((r, i) => `<button type="button" class="rrow" data-focus="${r.id}" style="--d:${Math.min(i, 10) * 40}ms"><span class="when"><b>${new Date(r.start.t).getDate()}</b><small>${new Date(r.start.t).toLocaleDateString('en-SG', { month: 'short' })}</small></span>
        <span class="grow"><span class="t">${esc(r.title || 'Ride')}${abroadKm(r) > 1 ? ' <em class="flag">JB</em>' : ''}${r.photos && r.photos.length ? ` <em class="flag ph">${ic('img', 2.4)}${r.photos.length}</em>` : ''}</span><span class="s">${new Date(r.start.t).toLocaleDateString('en-SG', { weekday: 'short' })} · ${Math.round(Math.max(0, r.end.t - r.start.t) / 6e4)} min${r.mood ? ' · ' + esc(r.mood) : ''}</span></span><span class="km">${num(r.km, 1)}<small>km</small></span></button>`).join('')
      : '<div class="empty">No rides yet. Tap Start ride on Home, or turn on auto-log in Settings.</div>'}</section></div>`;
}
function liveRoads() { const mine = myRoads();
  return `<button type="button" class="myroads" data-act="roads"><span>Watching</span>${mine.length ? mine.map(r => `<b class="${(S.roads || []).includes(r) ? '' : 'auto'}">${r === 'WDL' ? 'Causeway' : r === 'TUAS' ? '2nd Link' : r}</b>`).join('') : '<i>Pick your roads</i>'}${ic('chev')}</button>`; }
function liveRides() {
  const all = LIVE.all, mine = myRoads();
  return `${all ? (all.length ? `<div class="incs">${all.slice(0, 8).map(x => { const m = x.roads.some(r => mine.includes(r)); return `<div class="inc ${m ? 'mine' : ''}"><span class="tag ${incKind(x.Type) === 'Jam' ? 'jam' : ''}">${incKind(x.Type)}</span><p>${esc(incText(x.Message))}</p></div>`; }).join('')}</div>` : '<div class="note">Expressways are clear right now.</div>')
      : '<button type="button" class="note link" data-act="relay">Turn on live jams and accidents →</button>'}`;
}
// the cams are built once per screen and only have their pictures swapped after that, so a swipe is never reset
function paintLive() {
  const a = $('#live0'), ra = $('#live1a'), b = $('#live1'), cams = $('#cams'), al = $('#alerts');
  if (a) a.innerHTML = liveHome(); if (ra) ra.innerHTML = liveRoads(); if (b) b.innerHTML = liveRides();
  if (cams) { if (!cams.children.length) { cams.innerHTML = CAMSETS.map(camHTML).join(''); wireCams(cams); } else refreshCamImgs(cams); }
  if (al) { const h = alertsHTML(); if (al.dataset.h !== h) { al.innerHTML = h; al.dataset.h = h; } } }
function partInfo(k) { const items = S.items.filter(i => i.part === k).map(i => ({ i, s: itemStatus(i) })), w = items.filter(x => x.s.cls !== 'unset').sort((a, b) => a.s.frac - b.s.frac)[0]; return { items, w, cls: w ? w.s.cls : 'unset', f: w ? w.s.frac : 0 }; }
function garageHTML() {
  const st = S.items.map(itemStatus), over = st.filter(s => s.cls === 'over').length, soon = st.filter(s => s.cls === 'soon').length;
  const ks = PARTS.filter(([k]) => S.items.some(i => i.part === k)).map(([k, l]) => ({ k, l, ...partInfo(k) })).sort((a, b) => (a.cls === 'unset') - (b.cls === 'unset') || a.f - b.f);
  const hero = ks[0];
  return `<div class="hi"><div><h1>Garage</h1><small>${esc(buildName())} · ${estOdo() == null ? 'odometer not added' : num(estOdo()) + ' km'}</small></div></div>
    <div class="hcol a">${hero ? `<section class="card ghero ${hero.cls}" data-part="${hero.k}">${ART.art(hero.k, hero.f, hero.cls, 150)}<div class="t"><span>${hero.cls === 'over' ? '<em>OVERDUE</em>' : hero.cls === 'soon' ? '<em class="soon">DUE SOON</em>' : '<em class="okk">NEXT UP</em>'}${esc(hero.w ? hero.w.i.name : hero.l)}</span><b>${hero.w ? bigVal(hero.w.s) : 'Not tracked'}</b>${hero.w ? `<button type="button" class="donebig" data-done="${hero.w.i.id}">${ic('check', 3)}<span>Done today</span></button>` : ''}</div></section>` : ''}
    <div class="gsum"><b>${over ? `<span class="r">${over} overdue</span>` : ''}${over && soon ? ' · ' : ''}${soon ? `${soon} due soon` : ''}${!over && !soon ? 'Everything’s good' : ''}</b><button type="button" class="link" data-act="history">History</button><button type="button" class="link" data-act="service">Log service</button></div>${kitCardHTML()}</div>
    <div class="hcol b"><div class="tiles">${ks.slice(1).map((p, i) => `<button type="button" class="tile ${p.cls}" data-part="${p.k}" style="--d:${i * 50}ms">${ART.art(p.k, p.f, p.cls, 84)}<span class="nm">${esc(p.l)}</span><b>${p.w ? bigVal(p.w.s) : `<small>${estOdo() == null ? 'Needs odometer' : 'Not tracked'}</small>`}</b><span class="bar"><i style="width:${p.w ? Math.max(4, Math.round(p.f * 100)) : 0}%"></i></span></button>`).join('')}</div></div>`;
}
function fuelHTML() {
  const fs = fuelStats(), now = new Date(), list = [...S.fuel].sort((a, b) => b.odo - a.odo);
  const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1); return { d, v: S.fuel.filter(f => { const x = new Date(f.date); return x.getMonth() === d.getMonth() && x.getFullYear() === d.getFullYear(); }).reduce((s, f) => s + fuelSgd(f), 0) }; });
  const mmax = Math.max(40, ...months.map(x => x.v));
  return `<div class="hi"><div><h1>Fuel</h1><small>${fs.tankFrac != null ? `${num(fs.tankFrac * S.bike.tank, 1)} of ${num(S.bike.tank)} L in the tank` : 'Log a full tank to start the gauge'}</small></div></div>
    <div class="hcol a"><div class="instr">${gaugeBlock('f', fs)}</div>
    <button type="button" class="bigbtn c-orange" data-act="fuel"><span class="nozzle">${ic('pump', 2.4)}</span><span>Log a fill-up</span></button>
    <div class="stats tap"><button type="button" data-stat="kpl"><b>${fs.kpl ? num(fs.kpl, 1) : '—'}</b><span>km/L ⓘ</span></button><button type="button" data-stat="spend"><b>${money(months[5].v, 0)}</b><span>${now.toLocaleDateString('en-SG', { month: 'long' })} ⓘ</span></button><button type="button" data-stat="cpk"><b>${fs.cpk ? '$' + num(fs.cpk, 2) : '—'}</b><span>per km ⓘ</span></button></div></div>
    <div class="hcol b"><section class="card plain"><div class="ch"><b>Spend</b><span>last 6 months</span></div><div class="bars">${months.map(({ d, v }, i) => `<div class="bcol"><span class="bv">${v ? '$' + Math.round(v) : ''}</span><i style="height:${Math.max(3, v / mmax * 100)}%;--d:${i * 70}ms"></i><span>${d.toLocaleDateString('en-SG', { month: 'short' })}</span></div>`).join('')}</div></section>
    ${costCardHTML()}
    <h2 class="sec">Fill-ups</h2>
    <section class="list2">${list.length ? list.map((f, i) => { const prev = list[i + 1], d = prev ? f.odo - prev.odo : null, k = f.full && prev && d > 0 && f.litres ? d / f.litres : null;
      return `<button type="button" class="rrow" data-fuel="${f.id}" style="--d:${Math.min(i, 10) * 40}ms"><span class="when"><b>${new Date(f.date).getDate()}</b><small>${new Date(f.date).toLocaleDateString('en-SG', { month: 'short' })}</small></span><span class="grow"><span class="t">${num(f.litres, 1)} L${f.station ? ' · ' + esc(f.station) : ''}</span><span class="s">${num(f.odo)} km${k ? ` · ${num(k, 1)} km/L` : ''}${f.full ? '' : ' · partial'}</span></span><span class="km">${f.cost ? costTxt(f) : ''}</span></button>`; }).join('') : '<div class="empty">Log fills with the odometer reading. Two full tanks unlock range and km/L.</div>'}</section></div>`;
}
const SCREENS = [homeHTML, ridesHTML, garageHTML, fuelHTML];
/* ---------- Start ride / End ride: two taps, no setup. Your phone's location now and when you park. ---------- */
// the intercom says you're riding: check again, end it here, or clear a test
function rideMenu() {
  const o = S.openRide; if (!o) return;
  openSheet('Riding', `Started ${fmtTime(o.t)} when your intercom connected. It ends by itself when the intercom disconnects.`, `<div class="btns" style="flex-direction:column">
    <button type="button" class="btn" id="rmCheck">${ic('target', 2.4)} Check again</button>
    <button type="button" class="btn ghost" id="rmEnd">${ic('stop', 2.4)} End ride here</button>
    <button type="button" class="btn ghost" id="rmClear">Not a ride, clear it</button></div><div class="gres" id="rmRes" hidden></div>`, sh => {
    $('#rmCheck', sh).onclick = async e => { const b = e.currentTarget; b.disabled = true; b.lastChild.textContent = ' Checking…'; await pullLog(true);
      if (!S.openRide) { closeSheet(); return; } const r = $('#rmRes', sh); r.hidden = false; r.className = 'gres bad'; r.innerHTML = '<b>No end yet</b><span>Nothing from your intercom disconnecting so far. It can take a minute to arrive.</span>'; b.disabled = false; b.lastChild.textContent = ' Check again'; };
    $('#rmEnd', sh).onclick = async e => { const b = e.currentTarget; b.disabled = true; let p; try { p = await here(); } catch (err) { toast(LOC_HELP, 'over'); b.disabled = false; return; }
      const st = S.openRide; S.openRide = null; save(); closeSheet(); showResults([await logRide({ ...st }, p)]); };
    $('#rmClear', sh).onclick = () => { S.openRide = null; save(); closeSheet(); refresh(); toast('Cleared'); };
  });
}
/* ---------- essentials kit + a 30-second pre-ride check ---------- */
const KIT = [
  ['On the bike', [['plug', 'Tyre plug kit'], ['pump', 'Mini pump or CO2'], ['tools', 'Basic tools (hex keys, spanners)'], ['lock', 'Disc lock or chain lock'], ['rain', 'Rain suit'], ['mount', 'Phone mount and charger'], ['lube', 'Chain lube or cleaner', 'chain']]],
  ['On you', [['helmet', 'Helmet in good shape'], ['gloves', 'Gloves'], ['jacket', 'Riding jacket'], ['plugs', 'Earplugs'], ['firstaid', 'Small first-aid kit']]],
  ['JB trips', [['passport', 'Passport (6+ months valid)'], ['tng', 'Touch ’n Go card, topped up'], ['cash', 'Some ringgit'], ['roam', 'Mobile data roaming or a SIM']]],
];
const PRE = [['Tyres', 'Pressure looks right, no nails or cuts'], ['Controls', 'Brakes, clutch and throttle move smoothly'], ['Lights', 'Headlight, brake light, indicators, horn'], ['Oil', 'Level in the window, no drips under the bike'], ['Chain', 'Not loose or dry'], ['Stands', 'Side stand springs back up']];
function kitItems() { return KIT.flatMap(([, l]) => l).filter(x => !x[2] || x[2] === S.bike.drive); }
function kitCardHTML() {
  const have = (S.kit && S.kit.have) || {}, list = kitItems().filter(x => !/passport|tng|cash|roam/.test(x[0])), got = list.filter(x => have[x[0]]).length, miss = list.length - got;
  const last = S.kit && S.kit.check;
  return `<section class="card kitcard"><button type="button" class="kitmain" data-act="kit"><span class="kic">${ic('wrench', 2.4)}</span><span class="grow"><b>Essentials</b><span>${got ? (miss ? `${got} of ${list.length} ready · ${miss} missing` : 'All set') : 'What to carry on every ride'}</span></span>${ic('chev')}</button>
    <button type="button" class="kitpre" data-act="preride">${ic('check', 3)}<span>30-second pre-ride check${last ? ` · last ${fmtDs(last)}` : ''}</span></button></section>`;
}
function kitSheet() {
  S.kit = S.kit || { have: {} }; const have = S.kit.have;
  openSheet('Essentials', 'Tick what you have. Redline just keeps count, no nagging.', KIT.map(([g, l]) => `<div class="bl">${g}</div><div class="kitlist">${l.filter(x => !x[2] || x[2] === S.bike.drive).map(([k, t]) => `<button type="button" class="kitrow ${have[k] ? 'on' : ''}" data-k="${k}"><i>${ic('check', 3.4)}</i><span>${t}</span></button>`).join('')}</div>`).join(''), sh => {
    $$('.kitrow', sh).forEach(b => b.onclick = () => { const k = b.dataset.k; have[k] = !have[k]; b.classList.toggle('on', !!have[k]); save(); haptic(); if (have[k] && !RM) b.animate([{ transform: 'scale(.96)' }, { transform: 'scale(1.02)' }, { transform: 'none' }], { duration: 260 }); refresh(); });
  });
}
function preRide() {
  openSheet('Pre-ride check', 'Tap each one as you check it. Based on the T-CLOCS checklist riders are taught.', `<div class="kitlist">${PRE.map(([t, d], i) => `<button type="button" class="kitrow pre" data-i="${i}"><i>${ic('check', 3.4)}</i><span><b>${t}</b><small>${d}</small></span></button>`).join('')}</div><div class="gres ok" id="preOk" hidden><b>All good. Ride safe!</b></div>`, sh => {
    const done = new Set();
    $$('.kitrow', sh).forEach(b => b.onclick = () => { const i = b.dataset.i; done.has(i) ? done.delete(i) : done.add(i); b.classList.toggle('on', done.has(i)); haptic();
      if (done.size === PRE.length) { S.kit = Object.assign({ have: {} }, S.kit, { check: todayISO() }); save(); $('#preOk', sh).hidden = false; celebrate(); setTimeout(() => { closeSheet(); refresh(); toast('Pre-ride check done. Ride safe!'); }, 900); } });
  });
}
// OwnTracks spotted a trip without the intercom: one tap to say if it was on the bike
// photos sent with the "Redline Scan" shortcut, waiting for one tap
function scanQHTML() {
  const q = S.scanQ || []; if (!q.length) return ''; const x = q[q.length - 1], d = x.data || {};
  const what = d.unsure && !(d.odo || d.litres || d.cost) ? 'Tap to pick the numbers' : d.kind === 'odo' ? `Odometer ${num(+d.odo)} km` : d.kind === 'service' ? `Service${d.cost ? ' · ' + money(+d.cost) : ''}${d.shop ? ' · ' + esc(d.shop) : ''}` : `${d.litres ? num(+d.litres, 2) + ' L' : 'Fill-up'}${d.cost ? ' · ' + (d.currency === 'MYR' ? 'RM ' + num(+d.cost, 2) : money(+d.cost)) : ''}${STATION_OF(d.station) ? ' · ' + STATION_OF(d.station) : ''}`;
  const canSave = !d.unsure && ((d.kind === 'odo' && d.odo) || ((d.kind === 'pump' || d.kind === 'receipt') && d.litres && (estOdo() != null || d.odo)));
  return `<section class="card scanq"><span class="aln-ic">${ic('cam', 2.4)}</span><div class="grow"><span>From your photo · ${fmtTime(x.t)}${q.length > 1 ? ` · +${q.length - 1} more` : ''}</span><b>${what}</b></div>
    <div class="tabtns">${canSave ? `<button type="button" class="minibtn dark" data-act="scansave" data-i="${x.t}">Save</button>` : ''}<button type="button" class="minibtn" data-act="scancheck" data-i="${x.t}">${canSave ? 'Check' : 'Open'}</button></div><button type="button" class="alx" data-act="scanx" data-i="${x.t}" aria-label="Dismiss">${ic('x', 2.6)}</button></section>`;
}
function saveScan(t, quick) {
  const x = (S.scanQ || []).find(y => String(y.t) === String(t)); if (!x) return; const d = x.data || {};
  S.scanQ = S.scanQ.filter(y => y !== x); save();
  if (!quick) { openScan(d); return; }
  const date = todayISO(new Date(x.t));
  if (d.kind === 'odo') { S.odoLog.push({ id: uid(), date, odo: Math.round(+d.odo), ts: x.t }); toast('Odometer saved'); }
  else { const rm = d.currency === 'MYR' || STATION_OF(d.station) === 'Malaysia', r = (S.fx && S.fx.rate) || .3;
    S.fuel.push({ id: uid(), date, ts: x.t, odo: d.odo ? Math.round(+d.odo) : estOdo(), litres: +d.litres, cost: d.cost != null ? +d.cost : null, cur: rm ? 'MYR' : 'SGD', fx: rm ? r : undefined, costSgd: rm && d.cost ? +(d.cost * r).toFixed(2) : null, station: STATION_OF(d.station), full: true });
    toast('Fill-up saved as a full tank. Tap it in Fuel to change'); }
  save(); refresh(); celebrate();
}
function tripAskHTML() {
  const q = (S.tripQ || []).filter(t => !t.auto); if (!q.length) return '';
  const t = q[q.length - 1], mins = Math.round((t.end.t - t.start.t) / 6e4);
  return `<section class="card tripask"><div class="grow"><span>Trip spotted${q.length > 1 ? ` · +${q.length - 1} more` : ''}</span><b>${fmtDs(todayISO(new Date(t.start.t)))} ${fmtTime(t.start.t)} · ${num(t.km, 1)} km · ${mins} min</b><em>Was this on the bike?</em></div>
    <div class="tabtns"><button type="button" class="minibtn dark" data-trip="${t.k}" data-yes="1">Yes</button><button type="button" class="minibtn" data-trip="${t.k}" data-yes="">No</button></div></section>`;
}
// a one-time nudge for riders who picked an intercom but haven't finished auto-log
function alNudgeHTML() {
  const a = S.al || {};
  if (!isIOS || !S.relay || !SHORTCUTS.start || !S.intercom || S.intercom === 'none' || (a.start && a.end) || a.dismiss) return '';
  const done = (a.added ? 1 : 0) + (a.start ? 1 : 0) + (a.end ? 1 : 0);
  return `<section class="card alnudge" data-act="autolog"><span class="aln-ic">${ic('head', 2.4)}</span><div class="grow"><b>Make rides log themselves</b><span>${done ? `${done} of 3 done · finish setup` : 'About 2 minutes with your ' + (S.intercom === 'Cardo' ? 'Cardo' : 'intercom')}</span><i class="alprog"><i style="width:${done / 3 * 100}%"></i></i></div><button type="button" class="alx" data-act="aldismiss" aria-label="Hide">${ic('x', 2.6)}</button></section>`;
}
function rideNowHTML() {
  const live = S.live || (S.openRide && Date.now() - S.openRide.t < 12 * 3600e3 ? { start: S.openRide, auto: true } : null);
  if (live) { const m = Math.max(0, Math.round((Date.now() - live.start.t) / 6e4));
    return `<section class="card ridenow on" ${live.auto ? 'data-act="ridemenu"' : ''}><span class="rpulse"><i></i>${ic('ride', 2.4)}</span><div class="grow"><span>${live.auto ? 'Riding · logged by your intercom' : 'Riding'}</span><b id="rideMins">${m < 60 ? m + '<small>min</small>' : Math.floor(m / 60) + '<small>h</small> ' + (m % 60) + '<small>min</small>'}</b></div>${live.auto ? `<span class="rmore">${ic('chev', 2.6)}</span>` : `<button type="button" class="rbig end" data-act="endride">${ic('stop', 2.6)}<span>End ride</span></button>`}</section>`; }
  return `<button type="button" class="ridenow" data-act="startride"><span class="rgo">${ic('play', 2.6)}</span><span class="grow"><b>Start ride</b><span>Tap again when you park. Redline maps the ride.</span></span></button>`;
}
function here() {
  if (window.PREVIEW) { const j = () => (Math.random() - .5) * .08; return Promise.resolve({ lat: 1.35 + j(), lon: 103.85 + j() * 2, t: Date.now() }); }
  return new Promise((res, rej) => { if (!navigator.geolocation) return rej(new Error('none'));
    navigator.geolocation.getCurrentPosition(p => res({ lat: p.coords.latitude, lon: p.coords.longitude, t: Date.now() }), rej, { enableHighAccuracy: true, timeout: 15000, maximumAge: 20000 }); });
}
const LOC_HELP = 'Couldn’t get your location. Allow it for Redline: Settings → Privacy & Security → Location Services → Safari Websites (or Redline).';
async function startRide(b) {
  if (b) { b.disabled = true; $('b', b).textContent = 'Finding you…'; }
  try { const p = await here(); S.live = { start: p }; save(); haptic(); toast('Ride started. Ride safe!'); }
  catch (e) { toast(LOC_HELP, 'over'); }
  const box = $('#rideNow'); if (box) { box.innerHTML = rideNowHTML(); if (!RM) box.firstElementChild.animate([{ transform: 'scale(.94)', opacity: .4 }, { transform: 'none', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.2,1.4,.4,1)' }); }
}
async function endRide(b) {
  if (!S.live) return; if (b) { b.disabled = true; $('span', b).textContent = 'Mapping…'; }
  let p; try { p = await here(); } catch (e) { toast(LOC_HELP, 'over'); if (b) { b.disabled = false; $('span', b).textContent = 'End ride'; } return; }
  const st = S.live.start; S.live = null; save();
  const res = await logRide({ ...st }, p); if (res.ride) res.ride.src = 'tap';
  showResults([res]);
}
setInterval(() => { if (S.openRide && !document.hidden && S.setupDone) pullLog(true); }, 20000);
setInterval(() => { const el = $('#rideMins'), live = S.live || S.openRide; if (!el || !live) return; const m = Math.max(0, Math.round((Date.now() - (live.start ? live.start.t : live.t)) / 6e4)); el.innerHTML = m < 60 ? m + '<small>min</small>' : Math.floor(m / 60) + '<small>h</small> ' + (m % 60) + '<small>min</small>'; }, 20000);

/* ================= rendering, tab transitions and the gliding nav pill ================= */
function gaugeFrac(fs) { return fs.range != null && fs.full ? clamp(fs.range / fs.full, 0, 1) : 0; }
function render(animate, dir = 0) {
  document.body.dataset.place = place;
  const pad = document.createElement('div'); pad.className = 'pad'; pad.innerHTML = SCREENS[place]();
  pad.prepend($('#gear')); viewEl.className = 'view v' + place; viewEl.replaceChildren(pad);
  navTo(place);
  const fs = fuelStats(), f = gaugeFrac(fs);
  if (place === 0) { if (window.RADAR) RADAR.mountHome($('#rdh')); if (estOdo() == null) { gaugeSet('h', f, fs.full); if (animate) keyOn('h', f, fs.full); } else if (animate) { setOdo(0, false); setTimeout(() => setOdo(estOdo(), true), 260); keyOn('h', f, fs.full); } else { setOdo(estOdo(), false); gaugeSet('h', f, fs.full); } paintLive(); }
  if (place === 3) { if (animate) keyOn('f', f, fs.full); else gaugeSet('f', f, fs.full); }
  if (place === 1) { paintLive(); if (window.MAP) MAP.mount($('#mapcv'), animate); showFocus(); }
  if (animate && !RM) {
    pad.classList.add('enter');
    pad.animate([{ transform: `translateX(${dir * 26}%) scale(.97)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 520, easing: 'cubic-bezier(.2,1.15,.35,1)' });
    $$('.cnt', pad).forEach(el => { el.textContent = '0'; countTo(el, +el.dataset.to, 900); });
    setTimeout(() => pad.classList.remove('enter'), 1200);
  }
}
function countTo(el, to, ms) { if (!el) return; const from = 0, t0 = performance.now(); (function step(now) { const k = Math.min(1, (now - t0) / ms); el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); })(t0); }
function adoptOdo() {
  if (!S.odoPending) return; const r = odoReadings(); if (!r.length) return;
  const first = r[0].odo; S.items.forEach(i => { if (i.lastOdo == null && i.base) i.lastOdo = first; }); S.odoPending = false; save();
  setTimeout(() => toast('Odometer added · km countdowns started'), 500);
}
function refresh() { adoptOdo(); syncWorld(); const y = viewEl.scrollTop; render(false); viewEl.scrollTop = y; }
let going = false;
function go(i) {
  if (i === place) { viewEl.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  if (going) return; going = true; haptic(); Snd.click && Snd.click(1);
  if (window.MAP && place === 1) MAP.focus(null);
  const dir = i > place ? 1 : -1, old = $('.pad', viewEl); place = i; navTo(i);
  const done = () => { viewEl.scrollTop = 0; render(true, dir); going = false; };
  if (old && !RM) old.animate([{ transform: 'none', opacity: 1 }, { transform: `translateX(${-dir * 18}%) scale(.97)`, opacity: 0 }], { duration: 170, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' }).onfinish = done; else done();
}
function navTo(i) {
  const nav = $('#nav'); $$('#nav [data-i]').forEach(b => b.setAttribute('aria-current', String(+b.dataset.i === i)));
  requestAnimationFrame(() => { const b = $(`#nav [data-i="${i}"]`), ind = $('#navInd'); if (!b || !ind) return; ind.style.width = b.offsetWidth + 'px'; ind.style.height = b.offsetHeight + 'px'; ind.style.transform = `translate(${b.offsetLeft}px,${b.offsetTop}px)`; });
}
addEventListener('resize', () => navTo(place));
function syncWorld() { if (window.MAP) MAP.setRides(S.rides.map(r => ({ id: r.id, t: r.start.t, path: r.path, kind: rideKind(r), gps: r.gps }))); }
function focusRide(id) {
  if (!window.MAP) return; if (MAP.focused === id) id = null;
  MAP.focus(id); $$('.rrow[data-focus]', viewEl).forEach(x => x.classList.toggle('sel', x.dataset.focus === id)); showFocus();
  if (id) $('#mapcard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function showFocus() {
  const box = $('#mfocus'); if (!box) return; const r = window.MAP && S.rides.find(x => x.id === MAP.focused);
  box.hidden = !r; if (!r) return;
  box.innerHTML = `<div class="grow"><span>${fmtDs(todayISO(new Date(r.start.t)))} · ${Math.round(Math.max(0, r.end.t - r.start.t) / 6e4)} min</span><b>${esc(r.title || 'Ride')}</b><em class="rk" style="--kc:${RIDE_KINDS[rideKind(r)][1]}">${RIDE_KINDS[rideKind(r)][0]}${r.gps ? ` · ${r.gpsN || r.gps.length} points` : ''}${r.kmFix ? ' · GPS jumps removed' : ''}</em></div><b class="k">${num(r.km, 1)}<small>km</small></b>${r.start && r.start.lat != null && r.est !== 'tracked' ? `<button type="button" class="rbtn alt" data-route="${r.id}" aria-label="Which way did you go?">${ic('ride')}</button>` : ''}<button type="button" class="rbtn" data-ride="${r.id}" aria-label="Edit ride, journal and photos">${ic(r.photos && r.photos.length ? 'img' : 'list')}</button>`;
  box.animate([{ transform: 'translateY(20px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 380, easing: 'cubic-bezier(.2,1.3,.4,1)' });
}
function setType(type) { if (type === S.bike.type) return; S.bike.type = type; save(); syncWorld(); if (place === 2) refresh(); }

$('#nav').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.act) { haptic(); b.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(90deg) scale(.9)' }, { transform: 'rotate(90deg)' }], { duration: 300, easing: 'cubic-bezier(.2,1.4,.4,1)' }); plusSheet(); return; } go(+b.dataset.i); });
// keep sheets and setup inside the visible screen when the keyboard is up (iPhone home-screen apps don't resize for it)
// layout modes: phone in landscape or any wide screen gets the side rail and two columns
(function layoutMode() {
  const wide = matchMedia('(min-width: 900px), (orientation: landscape) and (max-height: 540px) and (min-width: 560px)'), desk = matchMedia('(min-width: 900px) and (min-height: 560px)');
  const set = first => { document.body.classList.toggle('wide', wide.matches); document.body.classList.toggle('desk', desk.matches); if (first !== true) { if (S.setupDone && !document.body.classList.contains('setting-up')) render(false); navTo(place); } };
  wide.addEventListener('change', set); desk.addEventListener('change', set); set(true);
})();
// no pinch or double-tap zoom on the app itself (the map and radar still pinch)
['gesturestart', 'gesturechange'].forEach(t => document.addEventListener(t, e => { if (!e.target.closest || !e.target.closest('#mapcv')) e.preventDefault(); }, { passive: false }));
(function fitKeyboard() {
  const vv = window.visualViewport; if (!vv) return; const root = document.documentElement;
  const fit = () => { const kb = Math.max(0, innerHeight - vv.height - vv.offsetTop); if (kb > 80) { root.style.setProperty('--kbh', vv.height + 'px'); root.style.setProperty('--kbo', kb + 'px'); } else { root.style.removeProperty('--kbh'); root.style.removeProperty('--kbo'); } };
  vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit);
  document.addEventListener('focusin', e => { if (e.target.matches('input,textarea')) setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300); });
})();
$('#gear').addEventListener('click', e => { haptic(); e.currentTarget.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(120deg)' }], { duration: 500, easing: 'cubic-bezier(.2,1.3,.4,1)' }); settingsSheet(); });
viewEl.addEventListener('mapmoved', e => { const b = $('#mre'); if (b) { b.hidden = !e.detail; if (e.detail && !RM) b.animate([{ transform: 'scale(.6)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 280, easing: 'cubic-bezier(.2,1.4,.4,1)' }); } });
viewEl.addEventListener('click', e => {
  if (e.target.closest('#mre')) { haptic(); MAP.recentre(); return; }
  const trb = e.target.closest('[data-trip]'); if (trb) { haptic(); trb.disabled = true; answerTrip(trb.dataset.trip, !!trb.dataset.yes).then(r => { if (r) showResults([r]); else { toast('Got it, not a bike trip'); refresh(); } }); return; }
  const rtb = e.target.closest('[data-route]'); if (rtb) { haptic(); routePicker(S.rides.find(x => x.id === rtb.dataset.route)); return; }
  const stb = e.target.closest('[data-stat]'); if (stb) { haptic(); statSheet(stb.dataset.stat); return; }
  if (e.target.closest('#mapcv') && MAP.focused) { MAP.replay(); return; }
  const b = e.target.closest('[data-act],[data-tab],[data-ride],[data-fuel],[data-ren],[data-rdone],[data-done],[data-edit],[data-add],[data-part],[data-focus]'); if (!b) return; haptic();
  const d = b.dataset;
  if (d.act) ACTIONS[d.act](b); else if (d.tab) go(+d.tab);
  else if (d.ride) rideForm(S.rides.find(x => x.id === d.ride)); else if (d.fuel) fuelForm(S.fuel.find(x => x.id === d.fuel));
  else if (d.ren) renewalForm(S.renewals.find(x => x.id === d.ren));
  else if (d.rdone) renewedForm(S.renewals.find(x => x.id === d.rdone));
  else if (d.done) { e.stopPropagation(); doneToday(S.items.find(x => x.id === d.done), b); }
  else if (d.edit) itemForm(S.items.find(x => x.id === d.edit)); else if (d.add) itemForm(null, d.add);
  else if (d.part) partSheet(d.part); else if (d.focus) focusRide(d.focus);
});
// press feel on anything tappable
let pressed = null;
viewEl.addEventListener('pointerdown', e => { const b = e.target.closest('button:not(.star),.card[data-part]'); if (!b || RM) return; pressed = b; b._pa = b.animate([{ transform: 'scale(1)' }, { transform: 'scale(.96)' }], { duration: 120, fill: 'forwards', easing: 'ease-out' }); });
addEventListener('pointerup', () => { const b = pressed; pressed = null; if (!b || !b._pa) return; b._pa.cancel(); b.animate([{ transform: 'scale(.96)' }, { transform: 'scale(1.03)' }, { transform: 'scale(1)' }], { duration: 340, easing: 'ease-out' }); });
addEventListener('pointercancel', () => { if (pressed && pressed._pa) pressed._pa.cancel(); pressed = null; });
function openSheet(title, lede, body, onOpen) {
  sheetEl.innerHTML = `<div class="grab"></div><div class="sh-head"><div class="grow"><h2>${title}</h2>${lede ? `<p>${lede}</p>` : ''}</div><button type="button" class="x" aria-label="Close">${ic('x')}</button></div>${body}`;
  sheetEl.scrollTop = 0; sheetEl._ok = false; sheetEl.classList.add('on'); shadeEl.classList.add('on'); if (window.W) W.locked = true;
  $('.x', sheetEl).onclick = closeSheet; onOpen && onOpen(sheetEl);
}
function closeSheet() { sheetEl.classList.remove('on'); shadeEl.classList.remove('on'); setTimeout(() => window.RADAR && RADAR.wake(), 50); if (window.W) { W.locked = false; W.poke(); } }
shadeEl.addEventListener('click', closeSheet);
function F(x) {
  if (x.type === 'row') return `<div class="two">${x.f.map(F).join('')}</div>`;
  const v = x.v ?? '', lab = x.l ? `<span>${x.l}</span>` : '';
  if (x.type === 'chips') { const sel = x.multi ? (v || []) : [v];
    return `<div class="fld" data-k="${x.k}" data-type="chips" data-multi="${x.multi ? 1 : ''}">${lab}<div class="chips">${x.o.map(o => `<button type="button" class="chipbtn" data-v="${esc(o.v)}" aria-pressed="${sel.includes(o.v)}">${esc(o.l)}</button>`).join('')}</div></div>`; }
  if (x.type === 'toggle') return `<div class="fld" data-k="${x.k}" data-type="toggle"><button type="button" class="tgl">${x.l}<span class="sw ${v ? 'on' : ''}"></span></button></div>`;
  if (x.type === 'textarea') return `<label class="fld">${lab}<textarea name="${x.k}" placeholder="${esc(x.ph || '')}">${esc(v)}</textarea></label>`;
  return `<label class="fld">${lab}<input name="${x.k}" type="${x.type === 'number' ? 'text' : x.type || 'text'}" ${x.type === 'number' ? 'inputmode="decimal" data-num="1"' : ''} value="${esc(v)}" placeholder="${esc(x.ph || '')}" autocomplete="off"></label>`;
}
function wire(root) {
  $$('[data-type=chips]', root).forEach(f => f.addEventListener('click', e => { const b = e.target.closest('.chipbtn'); if (!b) return; haptic();
    if (f.dataset.multi) b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); else $$('.chipbtn', f).forEach(c => c.setAttribute('aria-pressed', String(c === b))); f.dispatchEvent(new Event('pick', { bubbles: true })); }));
  $$('[data-type=toggle]', root).forEach(f => f.addEventListener('click', () => $('.sw', f).classList.toggle('on')));
}
function read(root) {
  const v = {};
  $$('input[name],textarea[name]', root).forEach(i => { v[i.name] = i.dataset.num ? (i.value.trim() === '' ? null : parseFloat(i.value.replace(/[^\d.\-]/g, ''))) : i.value.trim(); });
  $$('[data-type=chips]', root).forEach(f => { const on = $$('.chipbtn[aria-pressed="true"]', f).map(c => c.dataset.v); v[f.dataset.k] = f.dataset.multi ? on : (on[0] ?? ''); });
  $$('[data-type=toggle]', root).forEach(f => v[f.dataset.k] = $('.sw', f).classList.contains('on'));
  return v;
}
function form({ title, lede, fields, cta = 'Save', onSave, onDelete, bin, check, extra = '', onOpen }) {
  openSheet(title, lede, `<form id="fm">${extra}${fields.map(F).join('')}<div class="warnbox" id="wb" hidden></div><div class="btns">${onDelete ? '<button type="button" class="btn danger" id="del" style="flex:.5">Delete</button>' : ''}<button class="btn">${cta}</button></div>
    <div class="confirm" id="cf" hidden><span>${bin ? `Delete <b>${esc(bin.label)}</b>?${bin.note ? ' ' + bin.note : ''} You can bring it back from Settings → My data → Restore for 30 days.` : 'Delete this for good? This can’t be undone.'}</span><div class="btns"><button type="button" class="btn ghost" id="cfNo">Keep it</button><button type="button" class="btn danger solid" id="cfYes">Delete</button></div></div></form>`, sh => {
    wire(sh);
    $('#fm', sh).onsubmit = e => {
      e.preventDefault(); const v = read(e.target);
      for (const x of fields.flatMap(x => x.type === 'row' ? x.f : [x])) if (x.req && (v[x.k] == null || v[x.k] === '' || (typeof v[x.k] === 'number' && isNaN(v[x.k])))) { toast(`Add ${x.l.toLowerCase()}`, 'over'); return; }
      // looks like a typo? say so once, with Fix or Save anyway
      const warn = check && !sh._ok ? check(v) : null;
      if (warn) { const wb = $('#wb', sh); wb.hidden = false; wb.innerHTML = `<b>${ic('alert', 2.4)} Double-check this</b><span>${warn}</span><div class="wbb"><button type="button" class="btn ghost sm" id="wbFix">Fix it</button><button type="button" class="btn sm" id="wbOk">Save anyway</button></div>`;
        if (!RM) wb.animate([{ transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'none' }], { duration: 300 }); haptic(); wb.scrollIntoView({ block: 'center', behavior: 'smooth' });
        $('#wbFix', sh).onclick = () => { wb.hidden = true; const f = $('input[name]', sh); f && f.focus(); };
        $('#wbOk', sh).onclick = () => { sh._ok = true; $('#fm', sh).requestSubmit(); }; return; }
      sh._ok = false;
      if (onSave(v) === false) return;
      save(); closeSheet(); refresh(); celebrate();
    };
    onOpen && onOpen(sh);
    if (onDelete) { $('#del', sh).onclick = () => { $('#cf', sh).hidden = false; $('#cf', sh).scrollIntoView({ block: 'nearest' }); };
      $('#cfNo', sh).onclick = () => $('#cf', sh).hidden = true; $('#cfYes', sh).onclick = () => { onDelete(); const b = bin && toBin(bin); save(); closeSheet(); refresh(); if (b) banner(`${b.label} deleted`, 'Undo', () => restoreBin(b.key)); else toast('Deleted'); }; }
  });
}
function celebrate() { const ups = checkBadges(); if (ups.length) { const { b, tier } = ups[ups.length - 1]; setTimeout(() => toast(`${['', 'Bronze', 'Silver', 'Gold'][tier]} badge · ${b[1]}`), 600); } }
/* ================= actions ================= */
const odoGuess = () => estOdo() ?? '';
/* ---------- photo scanning: odometer, pump display, receipts (read by AI on your relay) ---------- */
const scanBtn = (kind, label) => `<div class="scanrow"><button type="button" class="scanbtn" data-scan="${kind}">${ic('cam', 2.2)}<span>${label}</span></button><input type="file" accept="image/*" hidden data-scanin="${kind}"></div><div class="scanres" hidden></div>`;
// ---- 1. crop: you drag a box around the numbers (or use the whole photo) ----
function cropPhoto(file) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file), wrap = document.createElement('div'); wrap.className = 'crop';
    wrap.innerHTML = `<div class="crop-top"><b>Box the numbers</b><span>Drag the box (or its corners) so it just covers the numbers you want read.</span></div>
      <div class="crop-stage"><div class="crop-in"><img alt=""><div class="crop-box"><i data-c="tl"></i><i data-c="tr"></i><i data-c="bl"></i><i data-c="br"></i></div></div></div>
      <div class="crop-btns"><button type="button" class="btn ghost" data-c="x">Cancel</button><button type="button" class="btn ghost" data-c="all">Whole photo</button><button type="button" class="btn" data-c="ok">Read this</button></div>`;
    document.body.appendChild(wrap);
    const img = $('img', wrap), box = $('.crop-box', wrap), stage = $('.crop-stage', wrap);
    let r = { x: .1, y: .3, w: .8, h: .4 };
    const paint = () => Object.assign(box.style, { left: r.x * 100 + '%', top: r.y * 100 + '%', width: r.w * 100 + '%', height: r.h * 100 + '%' });
    const fit = () => { const sw = stage.clientWidth, shh = stage.clientHeight, k = Math.min(sw / img.naturalWidth, shh / img.naturalHeight);
      Object.assign($('.crop-in', wrap).style, { width: img.naturalWidth * k + 'px', height: img.naturalHeight * k + 'px' }); };
    img.onload = () => { fit(); paint(); }; img.src = url;
    const area = () => img.getBoundingClientRect();
    let drag = null;
    stage.onpointerdown = e => { e.preventDefault(); const a = area(), px = (e.clientX - a.left) / a.width, py = (e.clientY - a.top) / a.height, c = e.target.dataset && e.target.dataset.c;
      drag = { c: c || (e.target === box ? 'move' : 'new'), px, py, r0: { ...r } }; if (drag.c === 'new') r = { x: px, y: py, w: 0, h: 0 }; stage.setPointerCapture(e.pointerId); };
    stage.onpointermove = e => { if (!drag) return; const a = area(), px = clamp((e.clientX - a.left) / a.width, 0, 1), py = clamp((e.clientY - a.top) / a.height, 0, 1), o = drag.r0, dx = px - drag.px, dy = py - drag.py;
      if (drag.c === 'move') r = { ...o, x: clamp(o.x + dx, 0, 1 - o.w), y: clamp(o.y + dy, 0, 1 - o.h) };
      else { let x1 = o.x, y1 = o.y, x2 = o.x + o.w, y2 = o.y + o.h;
        if (drag.c === 'new') { x1 = drag.px; y1 = drag.py; x2 = px; y2 = py; }
        else { if (/l/.test(drag.c)) x1 = px; if (/r/.test(drag.c)) x2 = px; if (/t/.test(drag.c)) y1 = py; if (/b/.test(drag.c)) y2 = py; }
        r = { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) }; }
      paint(); };
    stage.onpointerup = () => { if (drag && (r.w < .04 || r.h < .03)) r = drag.r0; drag = null; paint(); };
    const done = v => { wrap.remove(); URL.revokeObjectURL(url); resolve(v); };
    $$('.crop-btns button', wrap).forEach(b => b.onclick = () => { haptic(); const c = b.dataset.c; done(c === 'x' ? null : { img, r: c === 'all' ? { x: 0, y: 0, w: 1, h: 1 } : r }); });
  });
}
// ---- 2. shrink (or enlarge a small crop), make it grey and boost the contrast so faint LCD digits stand out ----
function photoData(img, r, enhance) {
  const sx = r.x * img.naturalWidth, sy = r.y * img.naturalHeight, sw = r.w * img.naturalWidth, sh = r.h * img.naturalHeight;
  const k = Math.min(1600 / Math.max(sw, sh), 3, Math.max(1, 1024 / Math.max(sw, sh))), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(sw * k)); c.height = Math.max(1, Math.round(sh * k));
  const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  if (enhance) { const d = g.getImageData(0, 0, c.width, c.height), p = d.data, hist = new Uint32Array(256), N = p.length / 4;
    for (let i = 0; i < p.length; i += 4) { const y = (p[i] * 299 + p[i + 1] * 587 + p[i + 2] * 114) / 1000 | 0; p[i] = y; hist[y]++; }
    let lo = 0, hi = 255, acc = 0; while (lo < 255 && (acc += hist[lo]) < N * .02) lo++; acc = 0; while (hi > 0 && (acc += hist[hi]) < N * .02) hi--;
    const span = Math.max(30, hi - lo); for (let i = 0; i < p.length; i += 4) { const v = clamp((p[i] - lo) * 255 / span, 0, 255); p[i] = p[i + 1] = p[i + 2] = v; }
    g.putImageData(d, 0, 0); }
  return c.toDataURL('image/jpeg', .9);
}
const OLD_RELAY = 'Your relay is running older code that can’t read photos. Settings → Relay → Copy code, paste it into the worker and Deploy (and add the AI binding).';
// ---- 3. send to the relay with hints: your expected odometer and tank size ----
async function readPhoto(kind, file) {
  if (window.PREVIEW) { await new Promise(r => setTimeout(r, 1200)); const o = (estOdo() || 18000) + 312;
    const d = { odo: { kind: 'odo', odo: o }, pump: { kind: 'pump', litres: 12.41, cost: 34.62, price: 2.79, currency: 'SGD', station: 'Shell', date: todayISO() }, service: { kind: 'service', cost: 168, date: todayISO(), shop: 'Ah Huat Motor', odo: o, work: ['engine oil', 'oil filter', 'chain adjust'] } };
    return { data: d[kind] || d.pump, raw: '', seen: [], unsure: false }; }
  if (!S.relay) throw new Error('Scanning needs the relay. Settings → Relay.');
  const cut = await cropPhoto(file); if (!cut) return null;
  const body = photoData(cut.img, cut.r, kind === 'odo' || kind === 'pump'), c = new AbortController(); setTimeout(() => c.abort(), 60000);
  const hint = estOdo(), qs = `ocr=${kind}&k=${riderCode()}${hint ? '&odo=' + Math.round(hint) : ''}${S.bike.tank ? '&cap=' + +S.bike.tank : ''}`;
  let r, j = null;
  try { r = await fetch(`${relayBase()}/?${qs}`, { method: 'POST', body, headers: { 'content-type': 'text/plain' }, signal: c.signal, cache: 'no-store' }); }
  catch (e) { throw new Error(e.name === 'AbortError' ? 'The relay took too long. Try again, or with a tighter box.' : 'Couldn’t reach the relay. Check your connection.'); }
  try { j = await r.json(); } catch (e) {}
  if (!j || !j.v) throw new Error(OLD_RELAY);
  if (j.error && /binding named AI/.test(j.error)) throw new Error('Photo reading isn’t switched on in the relay yet. Add the Workers AI binding named AI (Settings → Relay, step 6).');
  if (!r.ok) throw Object.assign(new Error('The relay couldn’t read it' + (j.error ? ': ' + j.error : '.')), { raw: j.raw, seen: j.seen });
  return { data: j.data, raw: j.raw || '', seen: j.seen || [], unsure: !!j.unsure };
}
const STATION_OF = s => { s = String(s || ''); if (/petronas|petron|bhp|malaysia|caltex m/i.test(s)) return 'Malaysia'; const m = ['Shell', 'Esso', 'SPC', 'Caltex', 'Sinopec'].find(x => new RegExp(x, 'i').test(s)); return m || ''; };
const WORK = [[/engine oil|oil change|\boil\b/i, /engine oil/i], [/oil filter/i, /oil filter/i], [/chain.*(lube|clean)|lube/i, /chain clean/i], [/chain.*adjust|adjust.*chain|slack/i, /chain adjust/i], [/brake pad/i, /brake pads/i], [/front tyre|front tire/i, /front tyre/i], [/rear tyre|rear tire|back tyre/i, /rear tyre/i], [/spark/i, /spark/i], [/air filter/i, /air filter/i], [/coolant|radiator/i, /coolant/i], [/brake fluid/i, /brake fluid/i], [/belt/i, /belt/i], [/gear oil/i, /gear oil/i]];
// fill a form from what the photo says; the rider always checks before saving
function fillFromScan(sh, kind, d) {
  d = d || {}; let n = 0; const notes = [];
  const set = (name, v) => { const el = $(`[name="${name}"]`, sh); if (el && v != null && v !== '' && !(typeof v === 'number' && isNaN(v))) { el.value = v; el.classList.add('filled'); setTimeout(() => el.classList.remove('filled'), 1600); n++; } };
  const chip = (k, v) => { const b = $$(`[data-k=${k}] .chipbtn`, sh).find(c => c.dataset.v.toLowerCase() === String(v).toLowerCase()); if (b && b.getAttribute('aria-pressed') !== 'true') { b.click(); n++; } };
  const okDate = x => x && /^\d{4}-\d\d-\d\d$/.test(x) && x <= todayISO();
  const e0 = estOdo(), okOdo = o => o != null && o >= 10 && (e0 == null || (o >= e0 - 300 && o <= e0 + 10000));
  if (kind === 'odo') set('odo', d.odo != null && okOdo(Math.round(+d.odo)) ? Math.round(+d.odo) : null);
  if (kind === 'pump') { set('litres', d.litres != null ? +d.litres : null); set('cost', d.cost != null ? +d.cost : (d.litres && d.price ? +(d.litres * d.price).toFixed(2) : null)); if (okDate(d.date)) set('date', d.date);
    const st = STATION_OF(d.station); if (st) chip('station', st); if (d.currency === 'MYR' || st === 'Malaysia') chip('cur', 'MYR'); }
  if (kind === 'service') { set('cost', d.cost != null ? +d.cost : null); set('shop', d.shop); if (okDate(d.date)) set('date', d.date); if (d.odo && okOdo(Math.round(+d.odo))) set('odo', Math.round(+d.odo));
    const work = (d.work || []).join(' | '); if (work) { WORK.forEach(([re, nameRe]) => { if (!re.test(work)) return; const it = S.items.find(i => nameRe.test(i.name)); const c = it && $(`[data-k=items] .chipbtn[data-v="${it.id}"]`, sh); if (c && c.getAttribute('aria-pressed') !== 'true') { c.setAttribute('aria-pressed', 'true'); n++; } }); notes.push('Work: ' + esc(work)); } }
  return { n, notes };
}
// ---- 4. if the AI wasn't sure, show the numbers it saw as buttons: one tap fills the field ----
const PICK = { odo: [['odo', 'your ODO (total km)']], pump: [['cost', 'the amount paid'], ['litres', 'the litres']], service: [['cost', 'the total'], ['odo', 'the odometer (if shown)']] };
function pickerHTML(kind, seen) {
  let nums = [...new Set((seen || []).map(Number).filter(x => isFinite(x) && x > 0))];
  if (kind === 'odo') { const e = estOdo(); nums = nums.filter(x => x >= 10 && x === Math.round(x)); if (e) nums.sort((a, b) => Math.abs(a - e) - Math.abs(b - e)); }
  else nums = nums.filter(x => x < 100000);
  if (!nums.length || !PICK[kind]) return '';
  return `<div class="pick" data-kind="${kind}" data-step="0"><small>Tap <b>${PICK[kind][0][1]}</b></small><div class="pk">${nums.slice(0, 10).map(x => `<button type="button" data-n="${x}">${num(x, x % 1 ? (String(x).split('.')[1] || '').length : 0)}</button>`).join('')}<button type="button" data-n="skip" class="sk">Not here</button></div></div>`;
}
function wirePicker(sh, res) {
  const p = $('.pick', res); if (!p) return; const steps = PICK[p.dataset.kind];
  $$('[data-n]', p).forEach(b => b.onclick = () => { haptic(); let i = +p.dataset.step; const [name] = steps[i];
    if (b.dataset.n !== 'skip') { const el = $(`[name="${name}"]`, sh); if (el) { el.value = b.dataset.n; el.dispatchEvent(new Event('input', { bubbles: true })); el.classList.add('filled'); setTimeout(() => el.classList.remove('filled'), 1600); } b.disabled = true; }
    i++; if (i >= steps.length) { p.innerHTML = `<small>${ic('check', 3)} Done. Check the form, then save.</small>`; return; }
    p.dataset.step = i; $('small', p).innerHTML = `Tap <b>${steps[i][1]}</b>`; });
}
function scanResult(res, n, notes, raw, x = {}) {
  const sh = res.closest('.sheet') || sheetEl, pk = (x.unsure || !n) ? pickerHTML(x.kind, x.seen) : '';
  res.hidden = false; res.className = 'scanres ' + (n && !x.unsure ? 'ok' : 'bad');
  const saw = raw ? `<details class="sawd"><summary>What the AI saw</summary><small class="saw">${esc(raw.slice(0, 600))}</small></details>` : '';
  res.innerHTML = n && !x.unsure ? `<b>${ic('check', 3)} Filled in ${n} field${n > 1 ? 's' : ''}</b><span>Check they’re right before saving.${notes.length ? '<br>' + notes.join('<br>') : ''}</span>`
    : n ? `<b>Filled in ${n}, but the AI wasn’t sure</b><span>Compare with your photo.${pk ? ' If it’s wrong, tap the right number below.' : ''}</span>${pk}${saw}`
    : pk ? `<b>Which number is it?</b><span>The AI found these numbers but couldn’t tell which is which.</span>${pk}${saw}`
    : `<b>Couldn’t find the numbers</b><span>Try again with a tighter box around the digits, straight on and without glare, or type them in.</span>${saw}`;
  wirePicker(sh, res);
}
function scanError(res, err) {
  res.hidden = false; res.className = 'scanres bad';
  res.innerHTML = `<b>Couldn’t read it</b><span>${esc(err.message || 'Try again.')}</span>${err.raw ? `<details class="sawd"><summary>What the AI saw</summary><small class="saw">${esc(err.raw.slice(0, 600))}</small></details>` : ''}`;
}
function wireScan(sh, kind) {
  const b = $(`[data-scan="${kind}"]`, sh), inp = $(`[data-scanin="${kind}"]`, sh), res = $('.scanres', sh); if (!b) return;
  b.onclick = () => { haptic(); if (window.PREVIEW) inp.onchange({ target: { files: [new Blob()] } }); else inp.click(); };
  inp.onchange = async e => { const file = e.target.files && e.target.files[0]; if (!file) return;
    b.disabled = true; b.classList.add('busy'); $('span', b).textContent = 'Reading the photo…'; res.hidden = true;
    try { const got = await readPhoto(kind, file); if (got) { const { data, raw, seen, unsure } = got; const { n, notes } = fillFromScan(sh, kind, data); scanResult(res, n, notes, raw, { kind, seen, unsure }); haptic(); } }
    catch (err) { scanError(res, err); }
    b.disabled = false; b.classList.remove('busy'); $('span', b).textContent = b.dataset.l; inp.value = ''; };
  b.dataset.l = $('span', b).textContent;
}
// one "Scan a photo" from the + menu: works out what it is and opens the right form, filled in
async function scanAny() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
  const go2 = async file => {
    let got; try { got = await (window.PREVIEW ? readPhoto('auto', file) : (toastSoon(), readPhoto('auto', file))); }
    catch (err) { whatPhoto({ error: err.message, raw: err.raw, seen: err.seen }); return; }
    if (!got) return; const d = got.data || {};
    if (!['odo', 'pump', 'receipt', 'service'].includes(d.kind)) { whatPhoto({ raw: got.raw, seen: got.seen }); return; }
    openScan(d, got);
  };
  if (window.PREVIEW) { go2(new Blob()); return; }
  inp.onchange = () => inp.files[0] && go2(inp.files[0]); inp.click();
}
function toastSoon() { setTimeout(() => { if (!$('.crop')) toast('Reading the photo…'); }, 50); }
// the AI couldn't tell (or the relay failed): say why, and let you say what the photo was
function whatPhoto({ error, raw, seen }) {
  openSheet('What’s in the photo?', error ? esc(error) : 'The AI couldn’t tell what this photo shows. Pick one and you can tap the right numbers.', `
    <button type="button" class="choice" data-w="odo">${ic('odo')}<b>Odometer</b></button>
    <button type="button" class="choice" data-w="pump">${ic('fuel')}<b>Pump display or fuel receipt</b></button>
    <button type="button" class="choice" data-w="service">${ic('wrench')}<b>Workshop bill</b></button>
    ${raw ? `<details class="sawd"><summary>What the AI saw</summary><small class="saw">${esc(raw.slice(0, 600))}</small></details>` : ''}`,
    sh => $$('[data-w]', sh).forEach(b => b.onclick = () => openScan({ kind: b.dataset.w }, { seen, raw, unsure: true })));
}
function openScan(d, x = {}) {
  const kind = d.kind === 'receipt' ? 'pump' : d.kind;
  if (!['odo', 'pump', 'service'].includes(kind)) { whatPhoto({ seen: x.seen || d.seen, raw: x.raw }); return; }
  if (kind === 'odo') odoForm(); else if (kind === 'service') serviceForm(); else fuelForm();
  setTimeout(() => { const r = fillFromScan(sheetEl, kind, d), res = $('.scanres', sheetEl); if (res) scanResult(res, r.n, r.notes, x.raw || '', { kind, seen: x.seen || d.seen, unsure: x.unsure ?? d.unsure }); }, 80);
}
// the reading just before a date (ignoring the entry being edited), to judge an odometer number
function odoBefore(date, skipId) { const t = +new Date(date + 'T12:00'); const r = odoReadings().filter(x => x.id !== skipId && x.t <= t); return r.length ? r[r.length - 1] : null; }
function odoCheck(odo, date, skipId) {
  if (odo == null || isNaN(odo)) return null; const prev = odoBefore(date || todayISO(), skipId); if (!prev) return null;
  const days = Math.max(1, (+new Date((date || todayISO()) + 'T12:00') - prev.t) / 864e5), diff = odo - prev.odo;
  if (diff < -5) return `That’s ${num(-diff)} km <b>lower</b> than your last reading (${num(prev.odo)} km on ${fmtDs(todayISO(new Date(prev.t)))}). Odometers only go up. A typo?`;
  if (diff > Math.max(1500, days * 600)) return `That’s ${num(diff)} km more than ${num(prev.odo)} km, ${Math.round(days)} day${days >= 2 ? 's' : ''} ago. That’s a lot of riding. A typo?`;
  return null;
}
// a fill-up's cost as paid: RM shows the ringgit plus roughly what it was in S$
const costTxt = f => !f.cost ? '' : f.cur === 'MYR' ? `RM ${num(+f.cost, 2)}<small class="fx">≈ ${money(fuelSgd(f))}</small>` : money(+f.cost);
// today's ringgit → S$ rate (free, no key). Falls back to the last one we saw, or 0.30
async function getFx() {
  if (S.fx && S.fx.date === todayISO() && S.fx.src !== 'manual') return S.fx.rate;
  if (window.PREVIEW) return (S.fx && S.fx.rate) || .3;
  try { const j = await getJSON('https://api.frankfurter.app/latest?from=MYR&to=SGD'); const r = j && j.rates && j.rates.SGD; if (r > .1 && r < 1) { S.fx = { rate: +r.toFixed(4), date: todayISO(), src: 'ecb' }; save(); return S.fx.rate; } } catch (e) {}
  try { const j = await getJSON('https://open.er-api.com/v6/latest/MYR'); const r = j && j.rates && j.rates.SGD; if (r > .1 && r < 1) { S.fx = { rate: +r.toFixed(4), date: todayISO(), src: 'er' }; save(); return S.fx.rate; } } catch (e) {}
  return (S.fx && S.fx.rate) || .3;
}
// fill-up form: show the rate only for RM, switch to RM by itself for Malaysian stations
function wireCur(sh) {
  const fxF = $('[name=fx]', sh) && $('[name=fx]', sh).closest('.fld'), curF = $('[data-k=cur]', sh); if (!fxF || !curF) return;
  const show = () => { const rm = read(curF.parentElement).cur === 'MYR'; fxF.hidden = !rm; const cl = $('[name=cost]', sh); if (cl) cl.closest('.fld').querySelector('span').textContent = rm ? 'Cost (RM)' : 'Cost ($)'; };
  sh.addEventListener('pick', e => { const st = e.target.closest('[data-k=station]'); if (st && read(sh).station === 'Malaysia') { const b = $('[data-k=cur] .chipbtn[data-v="MYR"]', sh); if (b && b.getAttribute('aria-pressed') !== 'true') b.click(); } show(); });
  show(); getFx().then(r => { const i = $('[name=fx]', sh); if (i && !i.dataset.touched) i.value = r; });
  $('[name=fx]', sh).addEventListener('input', e => e.target.dataset.touched = 1);
}
const STATIONS = ['Shell', 'Esso', 'SPC', 'Caltex', 'Sinopec', 'Malaysia'].map(s => ({ v: s, l: s }));
const MOODS = ['Chill', 'Spirited', 'Rainy', 'Night', 'Touring', 'Jammed'].map(v => ({ v, l: v }));
function fuelForm(e) {
  form({ title: e ? 'Edit fill-up' : 'Fill-up', lede: 'The odometer reading powers km/L, range and every service countdown.',
    fields: [{ type: 'row', f: [{ k: 'date', l: 'Date', type: 'date', v: e?.date || todayISO(), req: 1 }, { k: 'odo', l: 'Odometer (km)', type: 'number', v: e?.odo ?? odoGuess(), req: 1 }] },
      { type: 'row', f: [{ k: 'litres', l: 'Litres', type: 'number', v: e?.litres, req: 1 }, { k: 'cost', l: 'Cost ($)', type: 'number', v: e?.cost }] },
      { k: 'cur', l: 'Paid in', type: 'chips', o: [{ v: 'SGD', l: 'S$' }, { v: 'MYR', l: 'RM (JB)' }], v: e?.cur || (S.lastCur === 'MYR' && !e ? 'SGD' : 'SGD') },
      { k: 'fx', l: '1 RM = S$ (today’s rate, edit if needed)', type: 'number', v: e?.fx || (S.fx && S.fx.rate) || .3 },
      { k: 'station', l: 'Station', type: 'chips', o: STATIONS, v: e?.station || '' }, { k: 'full', l: 'Filled to a full tank', type: 'toggle', v: e ? e.full : true }],
    extra: e ? '' : scanBtn('pump', 'Scan the pump or receipt'), onOpen: sh => { wireScan(sh, 'pump'); wireCur(sh); },
    check: v => { const o = odoCheck(v.odo, v.date, e && e.id); if (o) return o; const tank = +S.bike.tank || 0;
      if (tank && v.litres > tank * 1.15) return `${num(v.litres, 1)} L is more than your ${num(tank)} L tank holds. A typo, or is the tank size in Settings wrong?`;
      if (v.cost && v.litres) { const pl = v.cost / v.litres, rm = v.cur === 'MYR';
        if (rm ? (pl < 1.5 || pl > 5) : (pl < 2.3 || pl > 4.5)) return `That works out to ${rm ? 'RM ' : '$'}${num(pl, 2)} a litre. ${rm ? 'Malaysian pump prices are usually RM 2–4.' : 'Pump prices are usually $2.50–$4.'} Check the litres, cost and currency.`; } return null; },
    onSave: v => { if (v.cur === 'MYR') { const r = v.fx > .1 && v.fx < 1 ? v.fx : ((S.fx && S.fx.rate) || .3); v.costSgd = v.cost ? +(v.cost * r).toFixed(2) : null; v.fx = r; } else { delete v.fx; v.costSgd = null; }
      if (e) { Object.assign(e, v); return; }
      // after the fuel light: learn this bike's real reserve from how much went in
      const fl = S.fuelLight, k = fuelStats().kpl;
      if (fl && v.full && k && v.litres && v.odo >= fl.odo) { const est = (+S.bike.tank - v.litres) + (v.odo - fl.odo) / k; if (est > .3 && est < S.bike.tank * .5) S.bike.reserve = Math.round(((+S.bike.reserve || 2.5) * 2 + est) / 3 * 10) / 10; }
      const oldF = gaugeFrac(fuelStats()), wasOn = fuelStats().low;
      if (v.full) S.fuelLight = null;
      S.fuel.push({ id: uid(), ...v, ts: Date.now() }); toast('Fill-up logged'); setTimeout(() => refillSweep(oldF, wasOn), 420); },
    onDelete: e && (() => S.fuel = S.fuel.filter(x => x !== e)), bin: e && { list: 'fuel', obj: e, label: `Fill-up on ${fmtD(e.date)}` } });
}
function serviceForm(e, preset) {
  form({ title: e ? 'Edit service' : 'Log a service', lede: 'Pick what was done. Those countdowns restart from this odometer reading.',
    fields: [{ type: 'row', f: [{ k: 'date', l: 'Date', type: 'date', v: e?.date || todayISO(), req: 1 }, { k: 'odo', l: 'Odometer (km)', type: 'number', v: e?.odo ?? odoGuess(), req: 1 }] },
      { k: 'items', l: 'What was done', type: 'chips', multi: 1, o: S.items.map(i => ({ v: i.id, l: i.name })), v: e?.items || preset || [] },
      { type: 'row', f: [{ k: 'cost', l: 'Cost ($)', type: 'number', v: e?.cost }, { k: 'shop', l: 'Workshop or DIY', v: e?.shop, ph: 'DIY' }] },
      { k: 'notes', l: 'Parts and notes', type: 'textarea', v: e?.notes, ph: 'Motul 7100 10W40, new chain…' }],
    extra: e ? '' : scanBtn('service', 'Scan the invoice'), onOpen: sh => wireScan(sh, 'service'),
    check: v => odoCheck(v.odo, v.date, e && e.id),
    onSave: v => { if (!v.items.length && !v.notes) { toast('Pick at least one item', 'over'); return false; }
      if (e) Object.assign(e, v); else { S.services.push({ id: uid(), ...v, ts: Date.now() }); if (S.needFull && v.items.length >= Math.min(4, S.items.length)) { S.needFull = null; toast('Full service logged · every countdown starts fresh'); } else toast('Service logged · countdowns reset'); } syncItems(); },
    onDelete: e && (() => { S.services = S.services.filter(x => x !== e); syncItems(); }), bin: e && { list: 'services', obj: e, label: `Service on ${fmtD(e.date)}`, note: 'The countdowns it reset go back to the service before it.' } });
}
function syncItems() {
  S.items = S.items.filter(i => !(i.once && S.services.some(s => s.items.includes(i.id))));
  S.items.forEach(it => { const last = S.services.filter(s => s.items.includes(it.id)).sort((a, b) => b.odo - a.odo)[0];
    if (last && (it.lastOdo == null || last.odo >= it.lastOdo || !it.base)) { it.lastOdo = last.odo; it.lastDate = last.date; } else if (!last && !it.base) { it.lastOdo = null; it.lastDate = null; } });
}
function odoForm() {
  form({ title: 'Odometer check', lede: 'A real reading recalibrates tracked distance and every countdown.',
    fields: [{ type: 'row', f: [{ k: 'date', l: 'Date', type: 'date', v: todayISO(), req: 1 }, { k: 'odo', l: 'Reading (km)', type: 'number', v: odoGuess(), req: 1 }] }],
    extra: scanBtn('odo', 'Scan the odometer'), onOpen: sh => wireScan(sh, 'odo'),
    check: v => odoCheck(v.odo, v.date),
    onSave: v => { S.odoLog.push({ id: uid(), ...v, ts: Date.now() }); toast('Odometer updated'); } });
}
function rideForm(r) {
  const isNew = !r, dt = r ? todayISO(new Date(r.start.t)) : todayISO();
  form({ title: isNew ? 'Log a ride' : (esc(r.title) || 'Ride'), lede: isNew ? 'For rides the auto-log missed.' : fmtDT(r.start.t) + (r.est === 'estimate' ? ' · distance estimated' : '') + (gpsReason(r) ? `<br><span class="why ${rideKind(r)}">${esc(gpsReason(r))}${r.kmFix ? ` · ${num(r.kmRoad, 1)} km trimmed to ${num(r.km, 1)} km` : ''}</span>` : ''),
    fields: [{ k: 'title', l: 'Title', v: r?.title || '', ph: 'Sunday ride to Changi' },
      ...(isNew ? [{ type: 'row', f: [{ k: 'from', l: 'From', ph: 'Bedok or 460123' }, { k: 'to', l: 'To', ph: 'Woodlands Checkpoint' }] }] : []),
      { type: 'row', f: [{ k: 'date', l: 'Date', type: 'date', v: dt }, { k: 'km', l: isNew ? 'Distance (km), or leave blank' : 'Distance (km)', type: 'number', v: r?.km ?? '' }] },
      { type: 'row', f: [{ k: 'time', l: 'Started at', type: 'time', v: r && r.start.t ? new Date(r.start.t).toTimeString().slice(0, 5) : '09:00' }, { k: 'mins', l: 'Duration (min)', type: 'number', v: r ? Math.round((r.end.t - r.start.t) / 6e4) : '' }] },
      { k: 'mood', l: 'Vibe', type: 'chips', o: MOODS, v: r?.mood || '' }, { k: 'note', l: 'Journal', type: 'textarea', v: r?.note, ph: 'Where you went, what you ate, how it felt' }],
    check: v => { if (v.km > 700) return `${num(v.km)} km in one ride is a lot for Singapore and JB. A typo?`; if (v.km && v.mins && v.km / (v.mins / 60) > 150) return `${num(v.km, 1)} km in ${v.mins} min is ${Math.round(v.km / (v.mins / 60))} km/h on average. Check the distance and time.`; return null; },
    onSave: v => { if (isNew && v.from && v.to && !v.km) { mapManual(v); return; }
      if (!v.km) { toast(isNew ? 'Add the distance, or where you rode from and to' : 'Add the distance', 'over'); return false; }
      if (isNew) { const t0 = +new Date(v.date + 'T' + (v.time || '09:00')); S.rides.push({ id: uid(), title: v.title, start: { t: t0 }, end: { t: t0 + (v.mins || 0) * 6e4 }, km: v.km, src: 'manual', mood: v.mood, note: v.note }); toast('Ride logged'); }
      else { const t0 = v.date ? +new Date(v.date + 'T' + (v.time || '09:00')) : r.start.t, dur = v.mins != null ? v.mins * 6e4 : r.end.t - r.start.t, kmChanged = v.km !== r.km;
        Object.assign(r, { title: v.title, km: v.km, mood: v.mood, note: v.note, loop: false }); r.start.t = t0; r.end.t = t0 + dur; if (kmChanged) r.est = 'manual'; } },
    extra: (!isNew ? `<div class="rphotos" id="rph"></div>` : '') + (!isNew && r.start && r.start.lat != null && r.est !== 'tracked' ? `<button type="button" class="scanbtn" id="pickRoute">${ic('ride', 2.2)}<span>Wrong road? Pick which way you went</span></button><div style="height:12px"></div>` : ''),
    onOpen: sh => { const b = $('#pickRoute', sh); if (b) b.onclick = () => routePicker(r); if (!isNew) ridePhotos(r, $('#rph', sh)); },
    onDelete: !isNew && (() => S.rides = S.rides.filter(x => x !== r)), bin: !isNew && { list: 'rides', obj: r, label: r.title || `Ride of ${num(r.km, 1)} km` } });
}
// photos on a ride: shrunk on the phone and kept on the phone (IndexedDB), never uploaded
async function ridePhotos(r, box) { if (!box) return;
  const keys = r.photos || [], srcs = await Promise.all(keys.map(k => kv('get', k)));
  box.innerHTML = `${srcs.map((p, i) => p ? `<div class="rp"><img src="${p.src}" alt="Ride photo ${i + 1}"><button type="button" class="rpx" data-k="${keys[i]}" aria-label="Remove photo">${ic('x', 3)}</button></div>` : '').join('')}
    <button type="button" class="rpadd">${ic('img', 2.2)}<span>${keys.length ? 'Add more' : 'Add photos'}</span></button>`;
  $('.rpadd', box).onclick = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.multiple = true;
    i.onchange = async () => { const fs = [...i.files].slice(0, 12 - keys.length); if (!fs.length) return; $('.rpadd span', box).textContent = 'Adding…';
      for (const f of fs) { try { const src = await smallPhoto(f, 1400, .8), k = `ph:${r.id}:${uid()}`; await kv('put', k, { src, t: Date.now() }); r.photos = [...(r.photos || []), k]; } catch (e) {} }
      save(); haptic(); toast(fs.length > 1 ? `${fs.length} photos added` : 'Photo added'); ridePhotos(r, box); refresh(); }; i.click(); };
  $$('.rpx', box).forEach(b => b.onclick = async () => { await kv('del', b.dataset.k); r.photos = (r.photos || []).filter(k => k !== b.dataset.k); save(); ridePhotos(r, box); refresh(); });
}
/* ---------- "Which way did you go?": pick the road you actually took; Redline remembers it for next time ---------- */
const ALTC = ['#5AB8FF', '#FFD84D', '#45E0A2'];
async function routePicker(r) {
  if (!r) return;
  if (r.est === 'tracked') { toast('This ride already uses your real GPS trail'); return; }
  openSheet('Which way did you go?', 'Redline only knows where you started and stopped, so it guessed the quickest road. Tap the one you took. Next time you ride between these places, it picks it for you.',
    `<div class="rpick"><canvas id="rpc"></canvas><div class="rdload" id="rpl"><i></i><i></i><i></i></div></div><div class="alist" id="alist"></div>`, async sh => {
    let alts = r.alts;
    if (!alts || !alts.length) { const res = await routeKm([r.start, r.end], true); alts = res.alts || [res]; if (res.src === 'route') r.alts = alts.map(a => ({ km: a.km, mins: a.mins, path: a.path, roads: a.roads })); }
    const l = $('#rpl', sh); l && l.remove();
    let sel = r.alts ? Math.min(r.pick || 0, alts.length - 1) : 0;
    const cv = $('#rpc', sh), g = cv.getContext('2d'), DPR = Math.min(devicePixelRatio || 1, 2), W = cv.clientWidth, H = cv.clientHeight; cv.width = W * DPR; cv.height = H * DPR;
    let b = null; alts.forEach(a => a.path.forEach(([la, lo]) => { b = b ? [Math.min(b[0], lo), Math.min(b[1], la), Math.max(b[2], lo), Math.max(b[3], la)] : [lo, la, lo, la]; }));
    const pad = .012; const cam = MAP.fit([b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad], 14, W, H);
    const P = (la, lo) => [(lo - cam.x) * MAP.K * cam.z + W / 2, (cam.y - la) * cam.z + H / 2];
    let t0 = performance.now();
    const draw = now => { const k = Math.min(1, (now - t0) / 700); g.setTransform(DPR, 0, 0, DPR, 0, 0); MAP.land(g, W, H, cam); g.lineCap = 'round'; g.lineJoin = 'round';
      alts.forEach((a, i) => { if (i === sel) return; g.beginPath(); a.path.forEach(([la, lo], j) => { const [x, y] = P(la, lo); j ? g.lineTo(x, y) : g.moveTo(x, y); }); g.strokeStyle = ALTC[i % 3] + '66'; g.lineWidth = 4; g.stroke(); });
      const a = alts[sel], n = Math.max(2, Math.ceil(a.path.length * k)); g.beginPath(); a.path.slice(0, n).forEach(([la, lo], j) => { const [x, y] = P(la, lo); j ? g.lineTo(x, y) : g.moveTo(x, y); });
      g.strokeStyle = ALTC[sel % 3]; g.lineWidth = 6; g.shadowColor = ALTC[sel % 3]; g.shadowBlur = 12; g.stroke(); g.shadowBlur = 0;
      for (const q of [a.path[0], a.path[a.path.length - 1]]) { const [x, y] = P(q[0], q[1]); g.fillStyle = '#FFF8F0'; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); }
      if (k < 1 && cv.isConnected) requestAnimationFrame(draw); };
    const list = () => { $('#alist', sh).innerHTML = alts.map((a, i) => `<button type="button" class="aopt ${i === sel ? 'on' : ''}" data-i="${i}"><i style="background:${ALTC[i % 3]}"></i><span class="grow"><b>${a.roads && a.roads.length ? 'Via ' + a.roads.slice(0, 3).map(x => x === 'WDL' ? 'Causeway' : x === 'TUAS' ? '2nd Link' : x).join(', ') : i ? 'Another way' : 'Quickest way'}</b><span>${num(a.km, 1)} km${a.mins ? ' · about ' + a.mins + ' min' : ''}</span></span>${i === sel ? `<em>${ic('check', 3)}</em>` : ''}</button>`).join('') + (alts.length < 2 ? '<p class="gnote">Only one sensible road between these two places. If it’s still wrong, edit the ride’s distance.</p>' : '');
      $$('.aopt', sh).forEach(btn => btn.onclick = () => { sel = +btn.dataset.i; const a = alts[sel]; applyRoute(r, a, 'picked'); r.pick = sel; rememberRoute(r, a); save(); syncWorld(); haptic(); list(); t0 = performance.now(); requestAnimationFrame(draw); toast('Route updated. Redline will remember this one'); refresh(); showFocus && showFocus(); }); };
    list(); requestAnimationFrame(draw);
  });
}
// a ride you forgot to log: look up both places on OneMap, then route between them
async function mapManual(v) {
  toast('Mapping your ride…');
  try {
    const [a, b] = await Promise.all([placePoint(v.from), placePoint(v.to)]), t0 = +new Date(v.date + 'T' + (v.time || '09:00')), mins = v.mins || 0;
    const r = await routeKm([a, b]);
    const ride = { id: uid(), title: v.title || `${v.from} to ${v.to}`, start: { ...a, t: t0 }, end: { ...b, t: t0 + mins * 6e4 }, km: Math.round(r.km * 10) / 10, src: 'manual', est: r.src, path: r.path, roads: r.roads || [], mood: v.mood, note: v.note };
    S.rides.push(ride); save(); showResults([{ ride }]);
  } catch (e) { toast(`Couldn’t find ${e && e.place ? '“' + e.place + '”' : 'one of those places'}. Try a postal code.`, 'over'); }
}
async function placePoint(q) {
  if (window.PREVIEW) { let h = 0; for (const c of q) h = (h * 31 + c.charCodeAt(0)) % 9973; return { lat: 1.28 + (h % 100) / 600, lon: 103.68 + (h % 97) / 260 }; }
  try { return await postalPoint(q); } catch (e) { throw { place: q }; }
}
function itemForm(it, part) {
  const isNew = !it; it = it || { id: uid(), name: '', part: part || 'other', km: 0, months: 0 };
  const lc = !isNew && itemCost(it);
  form({ title: isNew ? 'New service item' : esc(it.name), lede: 'How often it needs doing: by km, by months, or both.' + (lc ? (lc.solo ? ` Last time it cost <b>${money(lc.cost, 0)}</b> (${fmtD(lc.date)}).` : ` Last done as part of a ${money(lc.cost, 0)} service with ${lc.n - 1} other item${lc.n > 2 ? 's' : ''} (${fmtD(lc.date)}).`) : ''),
    fields: [{ k: 'name', l: 'Name', v: it.name, req: 1 }, { k: 'part', l: 'Part on the hologram', type: 'chips', o: PARTS.map(([v, l]) => ({ v, l })), v: it.part },
      { type: 'row', f: [{ k: 'km', l: 'Every (km)', type: 'number', v: it.km || '' }, { k: 'months', l: 'Every (months)', type: 'number', v: it.months || '' }] },
      { type: 'row', f: [{ k: 'lastOdo', l: 'Last done at (km)', type: 'number', v: it.lastOdo ?? '' }, { k: 'lastDate', l: 'Last done on', type: 'date', v: it.lastDate || '' }] }],
    onSave: v => { Object.assign(it, { name: v.name, part: v.part || 'other', km: v.km || 0, months: v.months || 0, lastOdo: v.lastOdo, lastDate: v.lastDate || null, base: true }); if (isNew) S.items.push(it); },
    onDelete: !isNew && (() => S.items = S.items.filter(x => x !== it)), bin: !isNew && { list: 'items', obj: it, label: it.name, note: 'Its countdown stops and it leaves the Garage.' } });
}
function renewalForm(r) {
  const isNew = !r; r = r || { id: uid(), name: '', date: '' };
  form({ title: isNew ? 'New renewal' : esc(r.name), lede: 'It turns amber in the last 30 days and red once it’s overdue.',
    fields: [{ k: 'name', l: 'Name', v: r.name, req: 1 }, { type: 'row', f: [{ k: 'date', l: 'Expires on', type: 'date', v: r.date }, { k: 'cost', l: 'Last paid ($)', type: 'number', v: r.cost }] }],
    onSave: v => { Object.assign(r, v); if (isNew) S.renewals.push(r); },
    onDelete: !isNew && (() => S.renewals = S.renewals.filter(x => x !== r)), bin: !isNew && { list: 'renewals', obj: r, label: r.name || 'Renewal' } });
}
const bikeFields = b => [{ k: 'name', l: 'Nickname', v: b.name, req: 1, ph: 'Black Mamba' },
  { type: 'row', f: [{ k: 'model', l: 'Model', v: b.model, ph: 'Yamaha MT-07' }, { k: 'plate', l: 'Plate', v: b.plate, ph: 'FBA1234X' }] },
  { type: 'row', f: [{ k: 'tank', l: 'Tank size (L)', type: 'number', v: b.tank }, { k: 'reserve', l: 'Fuel light reserve (L)', type: 'number', v: b.reserve ?? 2.5 }] },
  { type: 'row', f: [{ k: 'cc', l: 'Engine (cc)', type: 'number', v: b.cc }, { k: 'kplEst', l: 'Usual km/L (rough)', type: 'number', v: b.kplEst, ph: 'auto' }] },
  { k: 'licence', l: 'Licence class', type: 'chips', o: ['2B', '2A', '2'].map(v => ({ v, l: 'Class ' + v })), v: b.licence }];
function bikeForm() {
  form({ title: 'Your bike', lede: 'How it’s built decides which parts Redline tracks.', fields: [
      { k: 'drive', l: 'Rear wheel driven by', type: 'chips', o: DRIVES.map(([v, l]) => ({ v, l })), v: S.bike.drive || 'chain' },
      { k: 'cooling', l: 'Engine cooling', type: 'chips', o: COOLS.map(([v, l]) => ({ v, l })), v: S.bike.cooling || 'liquid' }, ...bikeFields(S.bike)],
    onSave: v => { const changed = (v.drive || 'chain') !== (S.bike.drive || 'chain') || (v.cooling || 'liquid') !== (S.bike.cooling || 'liquid');
      Object.assign(S.bike, v); if (changed) { applyBuild(); syncItems(); setTimeout(() => toast('Service list updated for how your bike is built'), 500); } } });
}
/* ---------- My data: every number Redline uses, each one fixable ---------- */
const SRC = { fuel: 'Fill-up', service: 'Service', odo: 'Odometer check', setup: 'Entered in setup' };
/* ---------- deleted things wait 30 days in a bin; standard service items can always be added back ---------- */
const BIN_DAYS = 30;
function toBin({ list, obj, label }) {
  const e = { key: uid(), t: Date.now(), list, label, obj: JSON.parse(JSON.stringify(obj)) };
  S.bin = [e, ...(S.bin || []).filter(x => Date.now() - x.t < BIN_DAYS * DAY)].slice(0, 60); return e;
}
function restoreBin(key) {
  const e = (S.bin || []).find(x => x.key === key); if (!e) return; const arr = S[e.list];
  if (Array.isArray(arr) && !arr.some(x => x.id === e.obj.id)) arr.push(e.obj);
  $('#banner').classList.remove('on');
  S.bin = S.bin.filter(x => x !== e); if (e.list === 'items' || e.list === 'services') syncItems();
  save(); refresh(); haptic(); toast(`${e.label} is back`);
  if (sheetEl.classList.contains('on') && $('#rsBody', sheetEl)) restoreSheet();
}
// item ids that old services point to but that no longer exist (an item deleted before the bin existed)
function orphanIds() {
  const have = new Set([...S.items.map(i => i.id), ...(S.bin || []).filter(b => b.list === 'items').map(b => b.obj.id)]);
  const m = new Map(); for (const sv of S.services) for (const id of sv.items || []) if (!have.has(id)) { if (!m.has(id)) m.set(id, []); m.get(id).push(sv); }
  return [...m].map(([id, svs]) => ({ id, svs: svs.sort((a, b) => b.odo - a.odo) }));
}
const missingStd = () => { const has = n => [...S.items, ...(S.bin || []).filter(b => b.list === 'items').map(b => b.obj)].some(i => (i.name || '').toLowerCase() === n.toLowerCase());
  return ITEM_DEFS.filter(([name, , , , need]) => fits(need, S.bike) && !has(name)); };
function addStd(name) {
  const d = ITEM_DEFS.find(x => x[0] === name); if (!d) return; const [, part, km, months] = d, orph = orphanIds();
  const make = id => { const it = { id: id || uid(), name, part, km, months, lastOdo: null, lastDate: null }; S.items.push(it); syncItems(); save(); refresh(); haptic();
    toast(it.lastOdo != null ? `${name} is back · last done at ${num(it.lastOdo)} km` : `${name} added · set when it was last done`); itemForm(it); };
  if (!orph.length) { make(); return; }
  // an old service included an item that's gone: was it this one? Linking brings its history (and countdown) back
  openSheet(`Link ${esc(name)}’s history?`, 'These past services included an item that was deleted. If one of them was ' + esc(name) + ', link it and the countdown picks up from there.', `
    ${orph.map(o => `<button type="button" class="choice" data-orph="${o.id}">${ic('wrench')}<span class="grow"><b>${o.svs.map(sv => fmtD(sv.date) + ' · ' + num(sv.odo) + ' km').slice(0, 2).join('<br>')}${o.svs.length > 2 ? `<br>+ ${o.svs.length - 2} more` : ''}</b>${o.svs[0].notes || o.svs[0].shop ? `<span class="s">${esc([o.svs[0].shop, o.svs[0].notes].filter(Boolean).join(' · ').slice(0, 80))}</span>` : ''}</span></button>`).join('')}
    <button type="button" class="btn ghost" id="orNo">None of these · start fresh</button>`,
    sh => { $$('[data-orph]', sh).forEach(b => b.onclick = () => make(b.dataset.orph)); $('#orNo', sh).onclick = () => make(); });
}
function restoreSheet() {
  const bin = (S.bin || []).filter(x => Date.now() - x.t < BIN_DAYS * DAY), miss = missingStd();
  const KIND = { expenses: 'Expense', items: 'Service item', services: 'Service', fuel: 'Fill-up', rides: 'Ride', renewals: 'Renewal', odoLog: 'Odometer reading' };
  openSheet('Restore', 'Bring back something you deleted, or add a standard service item your bike should have.', `<div id="rsBody">
    <div class="bl">Recently deleted</div>
    ${bin.length ? `<div class="list">${bin.map(b => `<button type="button" class="li" data-bin="${b.key}">${statusDot('unset')}<span class="grow"><span class="t">${esc(b.label)}</span><span class="s">${KIND[b.list] || ''} · deleted ${fmtDs(todayISO(new Date(b.t)))} · ${Math.max(1, BIN_DAYS - Math.floor((Date.now() - b.t) / DAY))} days left</span></span><span class="r restore">Restore</span></button>`).join('')}</div>`
      : '<div class="empty">Nothing deleted in the last 30 days.</div>'}
    <div class="bl">Standard service items</div>
    ${miss.length ? `<p class="gnote">Your bike usually needs these, but they’re not in your list.</p><div class="list">${miss.map(([name, , km, months]) => `<button type="button" class="li" data-std="${esc(name)}">${statusDot('soon')}<span class="grow"><span class="t">${esc(name)}</span><span class="s">every ${[km ? num(km) + ' km' : '', months ? months + ' months' : ''].filter(Boolean).join(' / ')}</span></span><span class="r restore">Add</span></button>`).join('')}</div>`
      : '<div class="empty">All the standard items are in your list.</div>'}</div>`,
    sh => { $$('[data-bin]', sh).forEach(b => b.onclick = () => restoreBin(b.dataset.bin)); $$('[data-std]', sh).forEach(b => b.onclick = () => addStd(b.dataset.std)); });
}
function myDataSheet(tab = 'odo') {
  const tabs = [['odo', 'Odometer'], ['fuel', 'Fill-ups'], ['service', 'Services'], ['ride', 'Rides']];
  const body = () => {
    if (tab === 'odo') { const r = odoReadings().reverse(), la = r[0];
      const oi = odoInfo();
      return r.length ? `${oi ? `<div class="calc odoc"><span>${num(oi.la.odo)} km</span><span>reading ${fmtDs(todayISO(new Date(oi.la.t)))}${oi.la.exact ? ', ' + fmtTime(oi.la.t) : ''}</span><b>+ ${num(oi.since, 1)} km</b><span>from ${oi.rides.length} ride${oi.rides.length === 1 ? '' : 's'} since${oi.c !== 1 ? ` × ${num(oi.c, 2)} (matched to your real odometer)` : ''}</span><b>= ${num(oi.odo)} km now</b></div>` : ''}
        ${oi && oi.rides.length ? `<div class="bl">Rides counted</div><div class="list">${oi.rides.map(x => `<button type="button" class="li" data-src="ride" data-id="${x.id}">${statusDot('ok')}<span class="grow"><span class="t">${esc(x.title || 'Ride')} · ${num(x.km, 1)} km</span><span class="s">${fmtDT(x.end.t)}</span></span>${ic('chev')}</button>`).join('')}</div>` : ''}
        <div class="bl">Readings</div><p class="gnote">Redline uses the <b>most recent</b> reading, plus rides since then. Tap any reading to fix or delete it.</p><div class="list">${r.map((x, i) => { const nx = r[i + 1], bad = nx && x.odo < nx.odo - 5;
        return `<button type="button" class="li" data-src="${x.src}" data-id="${x.id}">${statusDot(bad ? 'over' : i ? 'ok' : 'soon')}<span class="grow"><span class="t">${num(x.odo)} km</span><span class="s">${fmtD(todayISO(new Date(x.t)))} · ${SRC[x.src]}${bad ? ' · lower than the one before' : ''}${i === 0 ? ' · in use' : ''}</span></span>${ic('chev')}</button>`; }).join('')}</div><button type="button" class="btn ghost" id="mdAdd">+ Add a reading</button>` : `<div class="empty">No odometer readings yet.</div><button type="button" class="btn" id="mdAdd">Add a reading</button>`; }
    if (tab === 'fuel') { const l = [...S.fuel].sort((a, b) => (b.date > a.date ? 1 : -1) || b.odo - a.odo);
      return l.length ? `<div class="list">${l.map(f => `<button type="button" class="li" data-src="fuel" data-id="${f.id}">${statusDot(f.full ? 'ok' : 'soon')}<span class="grow"><span class="t">${num(f.litres, 2)} L · ${num(f.odo)} km</span><span class="s">${fmtD(f.date)}${f.station ? ' · ' + esc(f.station) : ''}${f.full ? '' : ' · partial'}</span></span><span class="r">${f.cost ? costTxt(f) : ''}</span></button>`).join('')}</div>` : '<div class="empty">No fill-ups yet.</div>'; }
    if (tab === 'service') { const l = [...S.services].sort((a, b) => (b.date > a.date ? 1 : -1));
      return l.length ? `<div class="list">${l.map(x => `<button type="button" class="li" data-src="service" data-id="${x.id}">${statusDot('ok')}<span class="grow"><span class="t">${esc(x.items.map(id => (S.items.find(i => i.id === id) || {}).name).filter(Boolean).join(', ') || 'Service')}</span><span class="s">${fmtD(x.date)} · ${num(x.odo)} km${x.shop ? ' · ' + esc(x.shop) : ''}</span></span><span class="r">${x.cost ? money(x.cost, 0) : ''}</span></button>`).join('')}</div>` : '<div class="empty">No services yet.</div>'; }
    const l = [...S.rides].sort((a, b) => b.start.t - a.start.t);
    return l.length ? `<div class="list">${l.slice(0, 80).map(r => `<button type="button" class="li" data-src="ride" data-id="${r.id}"><i class="dot" style="background:${RIDE_KINDS[rideKind(r)][1]}"></i><span class="grow"><span class="t">${esc(r.title || 'Ride')} · ${num(r.km, 1)} km</span><span class="s">${fmtDT(r.start.t)} · ${Math.round((r.end.t - r.start.t) / 6e4)} min · ${RIDE_KINDS[rideKind(r)][0]}${r.est === 'estimate' ? ', straight line' : ''}</span></span>${ic('chev')}</button>`).join('')}</div>` : '<div class="empty">No rides yet.</div>';
  };
  openSheet('My data', 'Everything Redline counts from. Fix a wrong number here and every stat updates.', `<div class="segs">${tabs.map(([k, l]) => `<button type="button" data-tab2="${k}" class="${k === tab ? 'on' : ''}">${l}</button>`).join('')}</div><div id="mdBody">${body()}</div><button type="button" class="btn ghost" id="mdRes">${ic('save', 2.2)} Restore something deleted${(S.bin || []).length ? ` (${S.bin.length})` : ''}</button>`, sh => {
    $('#mdRes', sh).onclick = () => restoreSheet();
    const wireB = () => { $$('#mdBody .li', sh).forEach(b => b.onclick = () => { const id = b.dataset.id, src = b.dataset.src;
        if (src === 'fuel') fuelForm(S.fuel.find(x => x.id === id)); else if (src === 'service') serviceForm(S.services.find(x => x.id === id)); else if (src === 'ride') rideForm(S.rides.find(x => x.id === id)); else odoEditForm(S.odoLog.find(x => x.id === id)); });
      const a = $('#mdAdd', sh); if (a) a.onclick = () => odoForm(); };
    $$('[data-tab2]', sh).forEach(b => b.onclick = () => { tab = b.dataset.tab2; $$('[data-tab2]', sh).forEach(x => x.classList.toggle('on', x === b)); $('#mdBody', sh).innerHTML = body(); wireB(); haptic(); });
    wireB();
  });
}
function odoEditForm(o) {
  if (!o) return;
  form({ title: o.setup ? 'Setup reading' : 'Odometer check', lede: 'Fix the number or the date, or delete it if it was wrong.',
    fields: [{ type: 'row', f: [{ k: 'date', l: 'Date', type: 'date', v: o.date, req: 1 }, { k: 'odo', l: 'Reading (km)', type: 'number', v: o.odo, req: 1 }] }],
    check: v => odoCheck(v.odo, v.date, o.id),
    onSave: v => { Object.assign(o, v); toast('Reading updated'); },
    onDelete: () => { S.odoLog = S.odoLog.filter(x => x !== o); }, bin: { list: 'odoLog', obj: o, label: `Reading ${num(o.odo)} km` } });
}
// where a number comes from, with the entries behind it
/* ================= find my bike: where you parked, how far, walk there ================= */
// a little OneMap street map around a point (night style, same as the radar), with a pin in the middle
function miniMap(lat, lon, w = 340, h = 150, z = 17) {
  const px = ((lon + 180) / 360) * 256 * 2 ** z, r = lat * Math.PI / 180, py = (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 256 * 2 ** z;
  const x0 = px - w / 2, y0 = py - h / 2, tx0 = Math.floor(x0 / 256), ty0 = Math.floor(y0 / 256), tx1 = Math.floor((x0 + w) / 256), ty1 = Math.floor((y0 + h) / 256); let t = '';
  for (let tx = tx0; tx <= tx1; tx++) for (let ty = ty0; ty <= ty1; ty++) t += `<img src="https://www.onemap.gov.sg/maps/tiles/Night/${z}/${tx}/${ty}.png" style="left:${tx * 256 - x0}px;top:${ty * 256 - y0}px" alt="" loading="lazy" onerror="this.remove()">`;
  return `<div class="minimap" style="height:${h}px"><div class="mmi" style="width:${w}px;height:${h}px;margin-left:${-w / 2}px">${t}</div><span class="mpin">${ic('bike', 2.4)}</span>${window.RADAR ? RADAR.ATTR : ''}</div>`;
}
const ago = t => { const m = Math.round((Date.now() - t) / 6e4); return m < 2 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
const walkURL = p => isIOS ? `https://maps.apple.com/?daddr=${p.lat},${p.lon}&dirflg=w` : `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}&travelmode=walking`;
function parkHTML() {
  const p = S.parked; if (!p || p.lat == null || S.openRide || S.live) return '';
  return `<section class="card parkcard"><div class="pkmap" data-act="park">${miniMap(p.lat, p.lon, 760, 130)}</div>
    <div class="pkrow"><div class="grow" data-act="park"><span>Your bike · parked ${ago(p.t)}</span><b>${p.note ? esc(p.note) : 'Add level or lot'}</b><small id="pkDist">${p.photo ? ic('img', 2.2) + ' photo saved · ' : ''}tap for distance</small></div>
    <a class="minibtn dark walkbtn" href="${walkURL(p)}" target="_blank" rel="noopener">${ic('walk', 2.4)} Walk there</a></div></section>`;
}
async function parkDistance() { const el = $('#pkDist'); if (!el || !S.parked) return; el.textContent = 'Finding you…';
  try { const me = await here(), d = haversine(me, S.parked); el.innerHTML = `${S.parked.photo ? ic('img', 2.2) + ' photo saved · ' : ''}<b>${d < 1 ? Math.round(d * 1000) + ' m' : num(d, 1) + ' km'}</b> away · about ${Math.max(1, Math.round(d / 4.8 * 60))} min walk`; }
  catch (e) { el.textContent = 'Couldn’t get your location'; } }
function parkSheet() {
  const p = S.parked;
  openSheet('Your bike', p ? `Parked ${ago(p.t)}${p.manual ? ' (set by you)' : ' (where your intercom switched off)'}. Outdoors this is usually within 10–20 m; in multi-storey car parks, add the level and lot.` : 'No parked spot yet. It saves itself when your intercom switches off, or set it here.', `
    ${p ? `<div class="pkbig">${miniMap(p.lat, p.lon, 760, 220, 18)}</div>` : ''}
    <form id="pkF">${F({ k: 'note', l: 'Level, lot or landmark', v: p && p.note, ph: 'Level 3, Lot 124, near lift B' })}
      <div class="pkph" id="pkPh"></div>
      <div class="btns"><button type="button" class="btn ghost" id="pkPhoto">${ic('cam', 2.2)} ${p && p.photo ? 'Retake photo' : 'Photo of the sign'}</button><button class="btn">Save</button></div></form>
    <div class="btns">${p ? `<a class="btn ghost" href="${walkURL(p)}" target="_blank" rel="noopener">${ic('walk', 2.2)} Walk there</a>` : ''}<button type="button" class="btn ghost" id="pkHere">${ic('pin', 2.2)} I parked here</button></div>`, async sh => {
    if (p && p.photo) { const ph = await kv('get', 'parkphoto'); if (ph && ph.t === p.t) $('#pkPh', sh).innerHTML = `<img src="${ph.src}" alt="Photo of where you parked">`; }
    $('#pkF', sh).onsubmit = e => { e.preventDefault(); if (!S.parked) { toast('Tap I parked here first', 'over'); return; } S.parked.note = read(e.target).note || ''; save(); closeSheet(); refresh(); toast('Saved'); };
    $('#pkPhoto', sh).onclick = async () => { if (!S.parked) { toast('Tap I parked here first', 'over'); return; } const f = await pickImage(true); if (!f) return;
      const src = await smallPhoto(f, 1100); await kv('put', 'parkphoto', { t: S.parked.t, src }); S.parked.photo = true; save(); $('#pkPh', sh).innerHTML = `<img src="${src}" alt="Photo of where you parked">`; haptic(); };
    $('#pkHere', sh).onclick = async b => { b.target.textContent = 'Finding you…'; try { const me = await here(); S.parked = { lat: me.lat, lon: me.lon, t: Date.now(), manual: true }; save(); haptic(); parkSheet(); refresh(); toast('Parked spot saved'); } catch (e) { toast(LOC_HELP, 'over'); } };
  });
}
/* ================= costs: fuel + servicing + everything else the bike costs ================= */
function expenseForm(e, preset) {
  form({ title: e ? 'Edit expense' : 'Expense', lede: 'Anything that isn’t fuel or a service: gear, parts, parking, washes, road tax…',
    fields: [{ type: 'row', f: [{ k: 'date', l: 'Date', type: 'date', v: e?.date || todayISO(), req: 1 }, { k: 'cost', l: 'Cost ($)', type: 'number', v: e?.cost, req: 1 }] },
      { k: 'cur', l: 'Paid in', type: 'chips', o: [{ v: 'SGD', l: 'S$' }, { v: 'MYR', l: 'RM (JB)' }], v: e?.cur || 'SGD' },
      { k: 'fx', l: '1 RM = S$ (today’s rate, edit if needed)', type: 'number', v: e?.fx || (S.fx && S.fx.rate) || .3 },
      { k: 'cat', l: 'What for', type: 'chips', o: EXP_CATS.map(([v, l]) => ({ v, l })), v: e?.cat || preset || 'gear' },
      { k: 'shop', l: 'What was it', v: e?.note, ph: 'New helmet visor, Shoei' }],
    extra: e ? '' : scanBtn('service', 'Scan the receipt'), onOpen: sh => { wireScan(sh, 'service'); wireCur(sh); },
    check: v => v.cost > 5000 ? `${money(v.cost)} is a lot for one expense. A typo?` : null,
    onSave: v => { const x = { date: v.date, cost: v.cost, cur: v.cur || 'SGD', cat: v.cat || 'other', note: v.shop || '' };
      if (x.cur === 'MYR') { x.fx = v.fx > .1 && v.fx < 1 ? v.fx : ((S.fx && S.fx.rate) || .3); x.costSgd = +(x.cost * x.fx).toFixed(2); }
      if (e) Object.assign(e, x, x.cur === 'MYR' ? {} : { fx: undefined, costSgd: undefined }); else { S.expenses.push({ id: uid(), ...x, ts: Date.now() }); toast('Expense logged'); } },
    onDelete: e && (() => S.expenses = S.expenses.filter(x => x !== e)), bin: e && { list: 'expenses', obj: e, label: e.note || catOf(e.cat)[1] } });
}
const PERIODS = [['month', 'This month'], ['year', 'This year'], ['all', 'All time']];
function periodRange(p) { const n = new Date(); return p === 'month' ? [+new Date(n.getFullYear(), n.getMonth(), 1), Date.now() + DAY] : p === 'year' ? [+new Date(n.getFullYear(), 0, 1), Date.now() + DAY] : [0, Date.now() + DAY]; }
function costsSheet(period = 'month') {
  const body = () => {
    const [a, b] = periodRange(period), c = costSummary(a, b), cats = COST_CATS.filter(([k]) => c.by[k] > 0).sort((x, y) => c.by[y[0]] - c.by[x[0]]);
    const now = new Date(), months = Array.from({ length: 6 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1), e = new Date(d.getFullYear(), d.getMonth() + 1, 1); return { d, s: costSummary(+d, +e) }; });
    const mmax = Math.max(50, ...months.map(m => m.s.total));
    const fixed = S.renewals.filter(r => +r.cost > 0 && !/helmet/i.test(r.name));
    return `<div class="costhero"><span>${PERIODS.find(p => p[0] === period)[1]}</span><b>${money(c.total, 0)}</b><span>${c.cpk ? `${money(c.cpk, 2)} per km all-in · ${num(c.km)} km ridden` : c.km ? `${num(c.km)} km ridden` : 'Ride a bit more to see cost per km'}</span></div>
      ${c.total ? `<div class="catbar">${cats.map(([k, , col]) => `<i style="flex:${c.by[k]};background:${col}"></i>`).join('')}</div>
      <div class="catlist">${cats.map(([k, l, col]) => `<div><span style="--c:${col}"><i></i>${l}</span><b>${money(c.by[k], 0)}</b><small>${Math.round(c.by[k] / c.total * 100)}%</small></div>`).join('')}</div>` : '<div class="empty">Nothing spent in this period yet.</div>'}
      <div class="bl">Last 6 months</div>
      <div class="sbars">${months.map(({ d, s: m }) => `<div class="sbcol"><span class="bv">${m.total ? '$' + Math.round(m.total) : ''}</span><div class="stack" style="height:${Math.max(2, m.total / mmax * 100)}%">${COST_CATS.filter(([k]) => m.by[k] > 0).map(([k, , col]) => `<i style="flex:${m.by[k]};background:${col}"></i>`).join('')}</div><span>${d.toLocaleDateString('en-SG', { month: 'short' })}</span></div>`).join('')}</div>
      ${fixed.length ? `<p class="gnote">Yearly fixed costs from Renewals: ${fixed.map(r => `${esc(r.name)} ${money(r.cost, 0)}`).join(' · ')}. Tap <b>Done</b> on a renewal and enter what you paid, and it’s counted here.</p>` : ''}
      <div class="bl">Spending</div>
      ${c.items.length ? `<div class="list">${c.items.slice(0, 60).map(x => { const [, l, col] = catOf(x.cat); return `<button type="button" class="li" data-src="${x.src}" data-id="${x.id}"><i class="dot" style="background:${col}"></i><span class="grow"><span class="t">${esc(x.label)}</span><span class="s">${fmtD(x.date)} · ${l}</span></span><span class="r">${x.cur === 'MYR' ? `RM ${num(x.amt, 2)}<small class="fx">≈ ${money(x.sgd)}</small>` : money(x.sgd)}</span></button>`; }).join('')}</div>` : ''}`;
  };
  openSheet('Costs', 'Everything your bike costs, in S$: fuel, servicing and the rest. RM is converted at the rate you paid.', `
    <div class="segs">${PERIODS.map(([k, l]) => `<button type="button" data-per="${k}" class="${k === period ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div id="cBody">${body()}</div>
    <div class="btns"><button type="button" class="btn ghost" id="cExp">${ic('share', 2.2)} Export</button><button type="button" class="btn" id="cAdd">+ Expense</button></div>`, sh => {
    const wireB = () => $$('#cBody .li', sh).forEach(b => b.onclick = () => { const id = b.dataset.id, src = b.dataset.src; if (src === 'fuel') fuelForm(S.fuel.find(x => x.id === id)); else if (src === 'service') serviceForm(S.services.find(x => x.id === id)); else expenseForm(S.expenses.find(x => x.id === id)); });
    $$('[data-per]', sh).forEach(b => b.onclick = () => { period = b.dataset.per; $$('[data-per]', sh).forEach(x => x.classList.toggle('on', x === b)); $('#cBody', sh).innerHTML = body(); wireB(); haptic(); });
    $('#cAdd', sh).onclick = () => expenseForm(); $('#cExp', sh).onclick = () => exportSheet(); wireB();
  });
}
/* ---------- export: a designed Excel workbook or a PDF service record (libraries load only when you export) ---------- */
function exportData() {
  const odo = estOdo(), yr = periodRange('year'), all = costSummary(), y = costSummary(...yr), now = new Date();
  const items = S.items.map(it => { const st = itemStatus(it), lc = itemCost(it); let nextDate = null;
    if (it.months && it.lastDate) { const d = new Date(it.lastDate + 'T12:00'); d.setMonth(d.getMonth() + it.months); nextDate = todayISO(d); }
    return { name: it.name, everyKm: it.km || null, everyMo: it.months || null, lastOdo: it.lastOdo ?? null, lastDate: it.lastDate || null, nextOdo: it.km && it.lastOdo != null ? it.lastOdo + it.km : null, nextDate, left: st.cls === 'unset' ? 'Not set' : st.text.split(' · ')[0], _st: st.cls === 'over' || st.cls === 'soon' || st.cls === 'unset' ? st.cls : 'ok', lastCost: lc && lc.solo ? lc.cost : null }; })
    .sort((a, b) => ['over', 'soon', 'ok', 'unset'].indexOf(a._st) - ['over', 'soon', 'ok', 'unset'].indexOf(b._st));
  const svcName = sv => (sv.items || []).map(id => (S.items.find(i => i.id === id) || {}).name).filter(Boolean).join(', ') || 'Service';
  const fl = [...S.fuel].sort((a, b) => a.odo - b.odo);
  const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1), e = new Date(d.getFullYear(), d.getMonth() + 1, 1), c = costSummary(+d, +e); return { label: d.toLocaleDateString('en-SG', { month: 'short', year: 'numeric' }), by: c.by, total: c.total }; });
  return { today: todayISO(), odo: odo == null ? null : Math.round(odo), bike: { name: S.bike.name, model: S.bike.model, plate: S.bike.plate, build: buildName() },
    items, rideKm: Math.round(S.rides.reduce((s, r) => s + (r.km || 0), 0)),
    services: [...S.services].sort((a, b) => (a.date < b.date ? 1 : -1)).map(sv => ({ date: sv.date, odo: sv.odo, work: svcName(sv), shop: sv.shop || '', cost: +sv.cost || null, notes: sv.notes || '' })),
    fuel: fl.map((f, i) => { const p = fl[i - 1], d = p ? f.odo - p.odo : 0, sg = fuelSgd(f); return { date: f.date, odo: f.odo, litres: +f.litres || null, paid: +f.cost || null, cur: f.cur === 'MYR' ? 'RM' : 'S$', sgd: sg || null, perL: sg && f.litres ? +(sg / f.litres).toFixed(2) : null, station: f.station || '', full: f.full ? 'Yes' : 'Partial', kpl: f.full && d > 0 && f.litres ? +(d / f.litres).toFixed(1) : null }; }).reverse(),
    ledger: costLedger().map(x => ({ date: x.date, cat: catOf(x.cat)[1], _col: catOf(x.cat)[2].slice(1), label: x.label, paid: x.amt, cur: x.cur === 'MYR' ? 'RM' : 'S$', sgd: x.sgd })),
    rides: [...S.rides].sort((a, b) => b.start.t - a.start.t).map(r => ({ date: todayISO(new Date(r.start.t)), time: new Date(r.start.t).toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit' }), title: r.title || 'Ride', mins: Math.round(Math.max(0, r.end.t - r.start.t) / 6e4), km: +(r.km || 0).toFixed(1), source: RIDE_KINDS[rideKind(r)][0], mood: r.mood || '', note: r.note || '' })),
    renewals: S.renewals.map(r => { const st = renewStatus(r); return { name: r.name, date: r.date || null, left: r.date ? st.text : 'No date', cost: +r.cost || null, _st: !r.date ? 'unset' : st.cls === 'over' ? 'over' : st.cls === 'soon' ? 'soon' : 'ok' }; }),
    costs: { all, year: y, months, cats: COST_CATS.map(([k, l, col]) => ({ key: k, label: l, col: col.slice(1), year: y.by[k] || 0, all: all.by[k] || 0 })).filter(c => c.all > 0 || ['fuel', 'service'].includes(c.key)) } };
}
const loadJS = src => new Promise((ok, no) => { if ($(`script[src="${src}"]`)) return ok(); const t = document.createElement('script'); t.src = src; t.onload = ok; t.onerror = () => no(new Error('Couldn’t load the export helper. Check your connection.')); document.head.appendChild(t); });
function saveFile(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
function exportSheet() {
  const base = `${(S.bike.name || 'redline').replace(/[^\w-]+/g, '-').toLowerCase()}-${todayISO()}`;
  openSheet('Export', 'Your data as a proper document. Good for your own records, a workshop, or when you sell the bike.', `
    <button type="button" class="choice" data-x="xlsx">${ic('list')}<span class="grow"><b>Excel spreadsheet</b><span class="s">Summary, maintenance, service history, costs by month, fuel, rides and renewals, each on its own sheet</span></span></button>
    <button type="button" class="choice" data-x="pdf">${ic('save')}<span class="grow"><b>PDF service record</b><span class="s">A clean record of every service, what’s due, and running costs. Ready to print or send</span></span></button>
    <p class="gnote">The first export downloads a small helper, so you need to be online.</p>`, sh => $$('[data-x]', sh).forEach(b => b.onclick = async () => {
    const kind = b.dataset.x, lab = $('b', b), old = lab.textContent; lab.textContent = 'Making it…'; b.disabled = true;
    try { const D = exportData();
      if (kind === 'xlsx') { await loadJS('js/vendor/exceljs.min.js'); const buf = await REXPORT.xlsx(window.ExcelJS, D); saveFile(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), base + '.xlsx'); }
      else { await loadJS('js/vendor/jspdf.umd.min.js'); await loadJS('js/vendor/jspdf.plugin.autotable.min.js'); const doc = REXPORT.pdf(window.jspdf.jsPDF, D); saveFile(doc.output('blob'), base + '-service-record.pdf'); }
      S.stats.exports++; save(); toast(kind === 'xlsx' ? 'Spreadsheet ready' : 'Service record ready'); celebrate();
    } catch (err) { toast(err.message || 'Export failed', 'over'); }
    lab.textContent = old; b.disabled = false; }));
}
function costCardHTML() {
  const [a, b] = periodRange('month'), c = costSummary(a, b), y = costSummary(...periodRange('year'));
  return `<section class="card plain costcard" data-act="costs"><div class="ch"><b>All-in costs</b><span>fuel, servicing &amp; more</span></div>
    <div class="cc2"><div><b>${money(c.total, 0)}</b><span>${new Date().toLocaleDateString('en-SG', { month: 'long' })}</span></div><div><b>${money(y.total, 0)}</b><span>this year</span></div><div><b>${y.cpk ? '$' + num(y.cpk, 2) : '—'}</b><span>per km</span></div></div>
    ${y.total ? `<div class="catbar sm">${COST_CATS.filter(([k]) => y.by[k] > 0).map(([k, , col]) => `<i style="flex:${y.by[k]};background:${col}"></i>`).join('')}</div>` : ''}
    <div class="ccb"><button type="button" class="minibtn" data-act="expense">+ Expense</button><button type="button" class="minibtn" data-act="export">${ic('share', 2.4)} Export</button></div></section>`;
}
// riders from before v7: the new service items, offered once
function newItemsHTML() { if (!S.newItemsOffer) return ''; const m = missingStd().filter(d => NEW_V7.includes(d[0]));
  if (!m.length) return '';
  return `<section class="card c-cream alertc ren newitems" data-act="newitems"><span class="renic">${ic('wrench', 2.4)}</span><div class="t"><span>New in Garage</span><b style="font-size:18px">${m.length} service item${m.length > 1 ? "s" : ""}</b></div><span class="minibtn dark">Review</span></section>`; }
function newItemsSheet() {
  const m = missingStd().filter(d => NEW_V7.includes(d[0]));
  openSheet('New service items', 'Redline now tracks more of your bike. Pick the ones you want; the rest stay in My data → Restore if you change your mind. Intervals are typical, so check your owner’s manual.', `
    <form id="niF"><div class="chips" data-type="chips" data-k="add" data-multi="1">${m.map(([name, , km, months]) => `<button type="button" class="chipbtn" data-v="${esc(name)}" aria-pressed="true">${esc(name)}<small> · ${[km ? num(km) + ' km' : '', months ? months + ' mo' : ''].filter(Boolean).join(' / ')}</small></button>`).join('')}</div>
    <div class="btns"><button type="button" class="btn ghost" id="niNo" style="flex:.6">Not now</button><button class="btn">Add these</button></div></form>`, sh => {
    wire(sh);
    $('#niNo', sh).onclick = () => { S.newItemsOffer = false; save(); closeSheet(); refresh(); toast('They’re in My data → Restore any time'); };
    $('#niF', sh).onsubmit = ev => { ev.preventDefault(); const pick = read(ev.target).add || [];
      for (const name of pick) { const d = ITEM_DEFS.find(x => x[0] === name); if (d) S.items.push({ id: uid(), name, part: d[1], km: d[2], months: d[3], lastOdo: null, lastDate: null }); }
      S.skipStd = (S.skipStd || []).filter(n => !pick.includes(n)); S.newItemsOffer = false; syncItems(); save(); closeSheet(); refresh();
      toast(pick.length ? `${pick.length} added. Set when each was last done in Garage` : 'Nothing added'); };
  });
}
function statSheet(kind) {
  const fs = fuelStats(), f = [...S.fuel].sort((a, b) => a.odo - b.odo), full = f.filter(x => x.full);
  let h = '', lede = '';
  if (kind === 'kpl') { const a = full[full.length - 2], b = full[full.length - 1];
    lede = fs.measured ? `${num(fs.kpl, 1)} km/L: the distance between full tanks (or between fuel-light moments), divided by every litre you put in, top-ups included.` : `${num(fs.kpl || kplGuess(), 1)} km/L is a starting estimate for your bike. Your second full tank (or a second “Fuel light on?”) swaps in your real number. Change the estimate in Settings → Bike.`;
    if (a && b) { const used = f.filter(x => x.odo > a.odo && x.odo <= b.odo); h = `<div class="calc"><span>${num(b.odo)} − ${num(a.odo)} km</span><b>${num(b.odo - a.odo)} km</b><span>÷ ${num(used.reduce((s, x) => s + (+x.litres || 0), 0), 2)} L</span></div>`; }
    h += `<div class="list">${full.slice(-4).reverse().map(x => `<button type="button" class="li" data-id="${x.id}">${statusDot('ok')}<span class="grow"><span class="t">${fmtD(x.date)} · ${num(x.odo)} km</span><span class="s">${num(x.litres, 2)} L · full tank</span></span>${ic('chev')}</button>`).join('')}</div>`; }
  if (kind === 'spend' || kind === 'cpk') { const n = new Date(), m = f.filter(x => { const d = new Date(x.date); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear(); });
    lede = kind === 'spend' ? 'Every fill-up this month, added up.' : 'All fuel spend divided by the kilometres between your first and latest fill-up.';
    const l = kind === 'spend' ? m : f.slice(-6);
    h = `<div class="list">${l.reverse().map(x => `<button type="button" class="li" data-id="${x.id}">${statusDot('ok')}<span class="grow"><span class="t">${fmtD(x.date)} · ${num(x.litres, 2)} L</span><span class="s">${num(x.odo)} km${x.station ? ' · ' + esc(x.station) : ''}</span></span><span class="r">${x.cost ? costTxt(x) : '—'}</span></button>`).join('') || '<div class="empty">Nothing yet.</div>'}</div>`; }
  openSheet({ kpl: 'Fuel economy', spend: 'This month', cpk: 'Cost per km' }[kind], lede, h + `<p class="gnote">Spot a wrong one? Tap it to fix it. Everything else is in Settings → My data.</p>`,
    sh => $$('.li', sh).forEach(b => b.onclick = () => fuelForm(S.fuel.find(x => x.id === b.dataset.id))));
}
function historySheet() {
  const sv = [...S.services].sort((a, b) => b.odo - a.odo); const spent = sv.reduce((s, x) => s + (+x.cost || 0), 0);
  openSheet('Service history', `${sv.length} services · ${money(spent, 0)} spent`, sv.length ? `<div class="list">${sv.map(s => `<button type="button" class="li" data-id="${s.id}">${statusDot('ok')}<span class="grow"><span class="t">${esc(s.items.map(id => (S.items.find(i => i.id === id) || {}).name).filter(Boolean).join(', ') || 'Service')}</span><span class="s">${fmtD(s.date)} · ${num(s.odo)} km${s.shop ? ' · ' + esc(s.shop) : ''}</span></span><span class="r">${s.cost ? money(s.cost, 0) : ''}</span></button>`).join('')}</div>` : '<div class="empty">Every service you log lands here, with parts and cost.</div>',
    sh => $$('.li', sh).forEach(b => b.onclick = () => serviceForm(S.services.find(x => x.id === b.dataset.id))));
}
function fuelHistSheet() {
  const list = [...S.fuel].sort((a, b) => b.odo - a.odo), fs = fuelStats();
  openSheet('Fill-ups', `${list.length} fill-ups · ${money(fs.cost, 0)} total${fs.kpl ? ' · ' + num(fs.kpl, 1) + ' km/L' : ''}`, list.length ? `<div class="list">${list.map((f, i) => { const prev = list[i + 1], d = prev ? f.odo - prev.odo : null, k = f.full && prev && d > 0 && f.litres ? d / f.litres : null;
    return `<button type="button" class="li" data-id="${f.id}">${statusDot(f.full ? 'ok' : 'soon')}<span class="grow"><span class="t">${num(f.litres, 2)} L${f.station ? ' · ' + esc(f.station) : ''}</span><span class="s">${fmtD(f.date)} · ${num(f.odo)} km${d ? ` · +${num(d)} km` : ''}${k ? ` · ${num(k, 1)} km/L` : ''}${f.full ? '' : ' · partial'}</span></span><span class="r">${f.cost ? costTxt(f) : ''}</span></button>`; }).join('')}</div>` : '<div class="empty">Log fills with the odometer reading. Or say “Hey Siri, log fuel” at the pump once auto-log is set up.</div>',
    sh => $$('.li', sh).forEach(b => b.onclick = () => fuelForm(S.fuel.find(x => x.id === b.dataset.id))));
}
function journalSheet() {
  const rides = [...S.rides].sort((a, b) => b.start.t - a.start.t), total = rides.reduce((s, r) => s + (r.km || 0), 0);
  openSheet('Ride journal', `${rides.length} rides · ${num(total)} km`, rides.length ? `<div class="list">${rides.map(r => `<button type="button" class="li" data-id="${r.id}">${statusDot(r.loop ? 'soon' : 'ok')}<span class="grow"><span class="t">${esc(r.title || (r.src === 'auto' ? 'Auto-logged ride' : 'Ride'))}</span><span class="s">${fmtDT(r.start.t)} · ${Math.round(Math.max(0, r.end.t - r.start.t) / 6e4)} min${r.mood ? ' · ' + esc(r.mood) : ''}${r.loop ? ' · add distance' : ''}</span></span><span class="r">${num(r.km, 1)}<small>KM</small></span></button>`).join('')}</div>` : '<div class="empty">No rides yet. Set up auto-log in Settings and rides appear here on their own.</div>',
    sh => $$('.li', sh).forEach(b => b.onclick = () => rideForm(S.rides.find(x => x.id === b.dataset.id))));
}
function spotsSheet() {
  const m = [...S.marks].sort((a, b) => b.t - a.t);
  openSheet('Marked spots', 'Places you marked mid-ride with “Hey Siri, mark this spot”.', m.length ? `<div class="list">${m.map(x => `<a class="li" style="text-decoration:none" target="_blank" rel="noopener" href="https://maps.apple.com/?ll=${x.lat},${x.lon}&q=${encodeURIComponent(x.note || 'Marked spot')}">${statusDot('ok')}<span class="grow"><span class="t">${esc(x.note || 'Marked spot')}</span><span class="s">${fmtDT(x.t)}</span></span><span class="r">MAP</span></a>`).join('')}</div>` : '<div class="empty">No spots yet. Set up the Siri shortcut in Settings → Auto-log rides.</div>');
}
function renewalsSheet() {
  openSheet('Renewals', 'Tap one to set its date.', `<div class="list">${S.renewals.map(r => { const s = renewStatus(r); return `<button type="button" class="li" data-id="${r.id}">${statusDot(s.cls)}<span class="grow"><span class="t">${esc(r.name)}</span><span class="s">${r.date ? fmtD(r.date) + ' · ' + s.text : 'No date yet'}</span></span></button>`; }).join('')}</div><div class="btns"><button type="button" class="btn ghost" id="addRen">Add a renewal</button></div>`,
    sh => { $$('.li', sh).forEach(b => b.onclick = () => renewalForm(S.renewals.find(x => x.id === b.dataset.id))); $('#addRen', sh).onclick = () => renewalForm(); });
}
function badgesSheet() {
  openSheet('Badges', 'Each badge levels up from bronze to silver to gold.', `<div class="badge-grid">${BADGES.map(b => { const st = badgeState(b); return `<div class="bdg cut-s t${st.tier}"><div class="tier">${st.tier ? ['', 'BRONZE', 'SILVER', 'GOLD'][st.tier] : 'LOCKED'}</div><b>${b[1]}</b><span>${st.next != null ? `${num(Math.min(st.v, st.next), b[0] === 'sip' ? 1 : 0)} / ${num(st.next)} ${b[6]}` : 'Maxed out'}</span></div>`; }).join('')}</div>`);
}
function backupSheet() {
  openSheet('Backup', 'Everything lives only on this phone. Export now and then so clearing the browser can’t wipe it.', `<div class="btns" style="flex-direction:column">
    <button type="button" class="btn" id="exp">Export backup</button><button type="button" class="btn ghost" id="imp">Import a backup</button><button type="button" class="btn danger" id="wipe">Start fresh</button></div>
    <input type="file" id="impIn" accept=".json,application/json" hidden>`, sh => {
    $('#exp', sh).onclick = async () => { S.stats.exports++; save();
      // ride photos live outside the main data, so they're added to the backup here
      const photos = {}; for (const k of (await kv('keys')) || []) if (/^ph:/.test(k)) { const p = await kv('get', k); if (p) photos[k] = p; }
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(Object.assign({}, S, { photos }))], { type: 'application/json' })); a.download = `redline-backup-${todayISO()}.json`; document.body.appendChild(a); a.click(); a.remove(); toast(Object.keys(photos).length ? `Backup downloaded with ${Object.keys(photos).length} photos` : 'Backup downloaded'); celebrate(); };
    $('#imp', sh).onclick = () => $('#impIn', sh).click();
    $('#impIn', sh).onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = async () => { try { const d = JSON.parse(r.result); if (d.v !== 3 || !d.bike) throw 0; const ph = d.photos || {}; delete d.photos; for (const k in ph) await kv('put', k, ph[k]); S = Object.assign(fresh(), d); save(); closeSheet(); if (window.W) W.setBike(S.bike.type, true); refresh(); toast('Backup restored'); } catch (err) { toast('That file isn’t a Redline backup', 'over'); } }; r.readAsText(f); };
    const w = $('#wipe', sh); w.onclick = () => { if (!w.dataset.sure) { w.dataset.sure = 1; w.textContent = 'Tap again to wipe everything'; return; } localStorage.removeItem(KEY); location.reload(); };
  });
}
// the "Redline Scan" shortcut: snap from the Action Button, Back Tap or Share in Photos; Redline offers to save it next time it opens
function quickScanSheet() {
  const code = S.relay ? riderCode() : '';
  openSheet('Quick scan', 'Snap your odometer, the pump or a receipt without opening Redline. Next time you open it, Redline shows what it read with a Save button.', `
    ${SHORTCUTS.scan ? `<div class="cpy"><code id="qcode">${code}</code><button type="button" class="btn ghost sm" data-copy="qcode">Copy</button></div>
    <div class="scbtns"><button type="button" class="btn" id="qsAdd">${ic('cam', 2.4)} Add “Redline Scan”</button></div>
    <ol class="gsteps"><li>Tap ${ui('Add Shortcut')} and paste your rider code when asked.</li></ol>` : `<p class="gnote">The shared “Redline Scan” shortcut isn’t ready yet. Until then, use ${ui('+')} → ${ui('Scan a photo')}, which also takes photos from your library.</p>`}
    <div class="bl">Ways to run it</div><ol class="gsteps">
      <li><b>Action Button</b> (iPhone 15 Pro and newer): ${ui('Settings')} → ${ui('Action Button')} → ${ui('Shortcut')} → ${ui('Redline Scan')}.</li>
      <li><b>Back Tap</b>: ${ui('Settings')} → ${ui('Accessibility')} → ${ui('Touch')} → ${ui('Back Tap')} → ${ui('Double Tap')} → ${ui('Redline Scan')}.</li>
      <li><b>From Photos</b>: open a photo → ${ui('Share')} → ${ui('Redline Scan')}.</li>
      <li><b>Lock Screen</b>: add a Shortcuts widget and pick Redline Scan.</li></ol>`, sh => {
    $$('[data-copy]', sh).forEach(b => b.onclick = async () => { try { await navigator.clipboard.writeText(code); b.textContent = 'Copied'; } catch (e) {} });
    if ($('#qsAdd', sh)) $('#qsAdd', sh).onclick = async () => { try { await navigator.clipboard.writeText(code); } catch (e) {} toast('Rider code copied'); setTimeout(() => window.open(SHORTCUTS.scan, '_blank'), 350); };
  });
}
// optional: OwnTracks, a free GPS app that tracks in the background and sends points to the relay, so rides show the real road
function otLink() {
  const cfg = { _type: 'configuration', mode: 3, url: `${relayBase()}/?ot=1&k=${riderCode()}`, monitoring: 1, tid: 'RL', deviceId: 'redline', auth: false, cmd: false, extendedData: false, locatorDisplacement: 150, locatorInterval: 60, ignoreInaccurateLocations: 200 };
  return 'owntracks:///config?inline=' + btoa(unescape(encodeURIComponent(JSON.stringify(cfg))));
}
/* ---------- activity log: what arrived from your intercom shortcuts and OwnTracks, and what Redline made of it ---------- */
// OwnTracks points in a time window, and runs of points split by gaps over 5 minutes
const ptsIn = (a, b) => (S.pts || []).filter(p => p.t >= a && p.t <= b).sort((x, y) => x.t - y.t);
function ptRuns(pts) { const runs = []; for (const p of pts) { const r = runs[runs.length - 1]; if (r && p.t - r.b <= 5 * 6e4) { r.b = p.t; r.n++; } else runs.push({ a: p.t, b: p.t, n: 1 }); } return runs; }
// why a ride came out as Best guess (or how good its GPS was)
function gpsReason(r) {
  const k = rideKind(r); if (!r.start || r.start.lat == null) return '';
  const n = r.gpsN != null ? r.gpsN : (Date.now() - r.end.t < 3 * DAY ? ptsIn(r.start.t - 9e4, r.end.t + 9e4).length : null);
  if (k === 'gps') return `${r.gpsN || (r.gps || []).length} GPS points${r.gpsDrop ? `, ${r.gpsDrop} bad one${r.gpsDrop > 1 ? 's' : ''} removed` : ''}`;
  if (n == null) return '';
  return n === 0 ? `No GPS: OwnTracks sent nothing between ${fmtTime(r.start.t)} and ${fmtTime(r.end.t)}` : `Only ${n} GPS point${n > 1 ? 's' : ''} during the ride (needs 2 good ones)`;
}
function lastRideGps() { const r = [...S.rides].filter(x => x.start && x.start.lat != null).sort((a, b) => b.end.t - a.end.t)[0]; if (!r) return null;
  return { r, ok: rideKind(r) === 'gps', n: r.gpsN != null ? r.gpsN : ptsIn(r.start.t - 9e4, r.end.t + 9e4).length }; }
function activitySheet(day = 0) {
  const body = () => {
    const d0 = new Date(); d0.setHours(0, 0, 0, 0); const a = +d0 - day * DAY, b = a + DAY, ev = [];
    (S.log || []).filter(l => l.t >= a && l.t < b).forEach(l => ev.push({ t: l.t, k: l.e, html: { start: `<b>Start</b> from your ${S.intercom || 'intercom'} shortcut${l.loc ? '' : ' <em class="bad">no location!</em>'}`, end: `<b>End</b> from your ${S.intercom || 'intercom'} shortcut${l.loc ? '' : ' <em class="bad">no location!</em>'}`, mark: '<b>Spot marked</b>', fuel: '<b>Fill-up</b> by voice', scan: '<b>Photo scan</b> from the shortcut', test: 'Test from setup' }[l.e] || esc(l.e) }));
    ptRuns(ptsIn(a, b)).forEach(r => ev.push({ t: r.a, k: 'pt', html: `<b>OwnTracks</b> · ${r.n} point${r.n > 1 ? 's' : ''}${r.b > r.a ? ` until ${fmtTime(r.b)}` : ''}` }));
    S.rides.filter(r => r.end && r.end.t >= a && r.end.t < b).forEach(r => { const k = rideKind(r), why = gpsReason(r);
      ev.push({ t: r.end.t + 1, k: 'ride', html: `<b>Ride logged</b> · ${num(r.km, 1)} km · <span style="color:${RIDE_KINDS[k][1]}">${RIDE_KINDS[k][0]}</span>${why ? `<br><small>${esc(why)}</small>` : ''}`, ride: r.id }); });
    ev.sort((x, y) => x.t - y.t);
    if (!ev.length) return `<div class="empty">Nothing arrived ${day ? 'that day' : 'today'}. ${day ? '' : 'If you rode, check the Cardo automations ran and that OwnTracks is in Move mode.'}</div>`;
    // gaps in OwnTracks during a ride stand out
    return `<ol class="tl">${ev.map(x => `<li class="tl-${x.k}"${x.ride ? ` data-ride="${x.ride}"` : ''}><time>${fmtTime(x.t)}</time><span>${x.html}</span></li>`).join('')}</ol>`;
  };
  openSheet('Activity', 'Everything that reached Redline from your shortcuts and OwnTracks, in order. If a ride came out as a guess, this shows which part didn’t send.', `
    <div class="segs">${['Today', 'Yesterday', '2 days ago'].map((l, i) => `<button type="button" data-day="${i}" class="${i === day ? 'on' : ''}">${l}</button>`).join('')}</div><div id="tlBody">${body()}</div>
    <p class="gnote">Points and events are kept for 3 days. Redline collects new ones whenever it’s open.</p>`, sh => {
    const wireB = () => $$('#tlBody [data-ride]', sh).forEach(li => li.onclick = () => rideForm(S.rides.find(r => r.id === li.dataset.ride)));
    $$('[data-day]', sh).forEach(b => b.onclick = () => { day = +b.dataset.day; $$('[data-day]', sh).forEach(x => x.classList.toggle('on', x === b)); $('#tlBody', sh).innerHTML = body(); wireB(); });
    wireB(); pullLog(true).then(() => { if ($('#tlBody', sh)) { $('#tlBody', sh).innerHTML = body(); wireB(); } });
  });
}
function otBlock() {
  const a = S.al || {}, on = a.pt && Date.now() - a.pt < 7 * 864e5;
  const lr = on && lastRideGps();
  return `<details class="gsec ${on ? 'gdone' : ''}"><summary><span class="gn">${on ? ic('check', 3.2) : '+'}</span>Optional: real routes with OwnTracks</summary>
    ${lr ? `<div class="lrg ${lr.ok ? 'ok' : 'bad'}">${ic(lr.ok ? 'check' : 'alert', 2.6)}<span><b>Last ride: ${lr.ok ? `GPS track, ${lr.n} points` : `${lr.n} point${lr.n === 1 ? '' : 's'}, so it’s a best guess`}</b>${lr.ok ? '' : `<br>OwnTracks connects, but didn’t send during the ride. Usually Low Power Mode, or OwnTracks was closed from the app switcher.`}</span></div>` : ''}

    <p class="gnote">${on ? `Working. Last point ${fmtTime(a.pt)}${new Date(a.pt).toDateString() === new Date().toDateString() ? '' : ', ' + fmtDs(todayISO(new Date(a.pt)))}. Rides now follow the roads you really took.` : 'iPhone won’t let Shortcuts track you during a ride. OwnTracks, a free app, can: it sends your location every few hundred metres in the background, and Redline draws the road you actually took instead of guessing.'}</p>
    ${on ? '' : `<ol class="gsteps">
      <li>Install <b>OwnTracks</b> (free). <a class="inl" href="${isIOS ? 'https://apps.apple.com/app/id692424691' : 'https://play.google.com/store/apps/details?id=org.owntracks.android'}" target="_blank" rel="noopener">Open the store →</a></li>
      <li>Come back and tap ${ui('Set up OwnTracks')} below. It fills in every setting for you (your relay and rider code).</li>
      <li>When OwnTracks asks for location, choose ${ui('Allow While Using')} then ${ui('Change to Always Allow')}. It can’t track with the app closed otherwise.</li>
      <li>Ride as normal. This step ticks itself when the first point arrives.</li></ol>
      ${isIOS ? '' : `<p class="gnote"><b>On Android:</b> also go to your phone’s Settings → Apps → OwnTracks → Battery and choose <b>Unrestricted</b>, or the phone may stop it to save battery.</p>`}
      <details class="tipbox"><summary>${ic('alert', 2.2)} The button didn’t open OwnTracks?</summary><ul><li>Open OwnTracks → Settings (or Preferences) → Connection. Set Mode to <b>HTTP</b>.</li><li>Paste this as the URL / Host:<div class="cpy"><code id="otu">${esc(relayBase() + '/?ot=1&k=' + riderCode())}</code><button type="button" class="btn ghost sm" data-copy="otu">Copy</button></div></li><li>Set monitoring to <b>Significant</b> (or Move for sharper trails).</li></ul></details>`}
    <p class="gnote">${(S.al && S.al.pt) ? '' : 'No intercom? OwnTracks alone works too: Redline spots your trips and asks once “on the bike?”. After you confirm a route twice, it logs it without asking.'}</p>
    <a class="btn ${on ? 'ghost' : ''} openapp" href="${otLink()}">${ic('target', 2.2)} ${on ? 'Set up OwnTracks again' : 'Set up OwnTracks'}</a>
    <p class="gnote">Modes (top of the OwnTracks map): <b>Move</b> gives sharp routes but uses more battery; <b>Significant</b> sends a point every ~500 m and survives Low Power Mode better. Low Power Mode and closing OwnTracks from the app switcher both stop it during rides. Your points go only to the relay and are deleted once Redline collects them.</p></details>`;
}
// the setup guide follows the Shortcuts app's own wording, one tap per line
function autoLogSheet() {
  const dev = S.intercom === 'Cardo' ? 'Cardo' : 'intercom', ready = !!S.relay, code = ready ? riderCode() : '', al = S.al || {};
  const copy = (id, text) => `<div class="cpy"><code id="${id}">${esc(text)}</code><button type="button" class="btn ghost sm" data-copy="${id}">Copy</button></div>`;
  const tok = t => `<span class="tok">${t}</span>`, ui = t => `<b class="ui">${t}</b>`;
  const auto = (when, e) => `<ol class="gsteps">
      <li>Open the ${ui('Shortcuts')} app and tap ${ui('Automation')} at the bottom.</li>
      <li>Tap ${ui('+')} at the top right. (No automations yet? Tap ${ui('New Automation')}.)</li>
      <li>Scroll down and tap ${ui('Bluetooth')}.</li>
      <li>Tap ${ui('Device')}, choose your ${dev}, then tap ${ui('Done')}. It has to be paired with this iPhone already.</li>
      <li>Tick ${ui(when)} and choose ${ui('Run Immediately')}. Tap ${ui('Next')}.</li>
      <li>Tap ${ui('New Blank Automation')}.</li>
      <li>Tap ${ui('Add Action')}, search ${ui('Get Current Location')} and tap it.</li>
      <li>In ${ui('Search Actions')} at the bottom, search ${ui('Get Contents of URL')} and tap it.</li>
      <li>Tap the blue ${ui('URL')} placeholder and paste this:${copy('u' + e, logURL(e))}</li>
      <li>With the cursor at the end, tap ${tok('Current Location')} in the bar above the keyboard. Then tap that blue bubble and choose ${ui('Latitude')}.</li>
      <li>Type ${ui('&amp;lon=')} then add ${tok('Current Location')} again and choose ${ui('Longitude')}.</li>
      <li>It should now end in <span class="mono">…e=${e}&amp;lat=</span>${tok('Latitude')}<span class="mono">&amp;lon=</span>${tok('Longitude')}. Tap ${ui('Done')}.</li>
    </ol>`;
  openSheet('Auto-log rides', `When your ${dev} connects, a ride starts. When it disconnects, the ride ends and Redline maps it. Nothing opens on your phone.`, `
  <div class="gstat ${ready ? 'ok' : ''}">${ready ? `${ic('check', 3)}<div><b>Relay connected</b><span>Your rider code: <b class="mono">${code}</b></span></div>` : `${ic('alert', 2.4)}<div><b>First, a relay</b><span>Your phone drops each ride there and Redline picks it up when you open it. Have an address from a friend? Paste it. Otherwise it takes about 10 minutes to make your own.</span></div><button type="button" class="btn sm" id="gRelay">Set up</button>`}</div>
  ${ready ? `<button type="button" class="mrow actrow" id="toAct"><span class="mi">${ic('list')}</span><span class="grow"><b>Activity</b><span>What arrived from your ${dev} and OwnTracks, minute by minute</span></span>${ic('chev')}</button>` : ''}
  ${ready && SHORTCUTS.start ? `
  <p class="glede">Three steps. Each one ticks itself when Redline sees it working.</p>
  <div class="chk">
  <details class="gsec ${al.added ? 'gdone' : ''}" ${!al.added ? 'open' : ''}><summary><span class="gn">${al.added ? ic('check', 3.2) : '1'}</span>Add the two shortcuts</summary>
    <p class="gnote">Your rider code keeps your rides yours. Each button copies it for you, then opens the shortcut.</p>
    <div class="cpy"><code id="ucode">${code}</code><button type="button" class="btn ghost sm" data-copy="ucode">Copy</button></div>
    <div class="scbtns"><button type="button" class="btn" data-sc="start">${ic('play', 2.6)} Add “Redline Start”</button><button type="button" class="btn" data-sc="end">${ic('stop', 2.6)} Add “Redline End”</button></div>
    <ol class="gsteps"><li>Tap ${ui('Get Shortcut')} if Safari shows it, then ${ui('Add Shortcut')}.</li><li>When it asks for your rider code, paste it.</li><li>Didn’t ask? Open the shortcut, tap <span class="mono">PASTE-CODE-HERE</span> and paste over it.</li></ol>
    ${!al.added ? `<button type="button" class="btn ghost" id="gAdded">I’ve added both</button>` : ''}</details>
  ${[['start', 'Is Connected', 'Redline Start', 'connects'], ['end', 'Is Disconnected', 'Redline End', 'disconnects']].map(([k, when, sc, verb], i) => `
  <details class="gsec ${al[k] ? 'gdone' : ''}" ${al.added && !al[k] && (k === 'start' || al.start) ? 'open' : ''}><summary><span class="gn">${al[k] ? ic('check', 3.2) : i + 2}</span>When your ${dev} ${verb}</summary>
    ${al[k] ? `<p class="gnote ok">Working. Last seen ${fmtTime(al[k])}.</p>` : `<ol class="gsteps">
      <li>Tap ${ui('Open Shortcuts')} below, then ${ui('Automation')} at the bottom → ${ui('+')}.</li>
      <li>${ui('Bluetooth')} → ${ui('Device')} → your ${dev} → ${ui('Done')}.</li>
      <li>Tick only ${ui(when)}, choose ${ui('Run Immediately')}, tap ${ui('Next')}.</li>
      <li>Pick ${ui(sc)} from your shortcuts. Done.</li>
      <li>Back here: turn your ${dev} ${k === 'start' ? 'on' : 'off'}. This step ticks itself.</li></ol>
      <a class="btn openapp" href="shortcuts://">${ic('full', 2.2)} Open Shortcuts</a>`}</details>`).join('')}
  </div>
  ${otBlock()}
  <div class="gres" id="gRes" hidden></div>
  <button type="button" class="btn ghost" id="gCheck">${al.start && al.end ? 'Check again' : 'Check now'}</button>
  <details class="gsec"><summary><span class="gn">?</span>Build them yourself instead</summary><p class="gnote">Only if the links don’t work for you. First, for connecting:</p>${auto('Is Connected', 'start')}<p class="gnote">Then for disconnecting:</p>${auto('Is Disconnected', 'end')}</details>` : ''}
  ${ready && !SHORTCUTS.start ? `
  <p class="glede">You make <b>two automations</b> in the Shortcuts app: one for when your ${dev} connects, one for when it disconnects. iPhone runs each one on its own.</p>
  <details class="gsec" open><summary><span class="gn">1</span>When your ${dev} connects</summary>${auto('Is Connected', 'start')}</details>
  <details class="gsec"><summary><span class="gn">2</span>When it disconnects</summary><p class="gnote">Same steps, with a different choice in step 5 and a different address in step 9.</p>${auto('Is Disconnected', 'end')}</details>
  <details class="gsec"><summary><span class="gn">3</span>Allow it, then test</summary><ol class="gsteps">
      <li>Turn your ${dev} off and on again near your phone.</li>
      <li>The first time, iPhone asks to let Shortcuts use your location and connect to your relay. Tap ${ui('Allow')} (or ${ui('Always Allow')}).</li>
      <li>In ${ui('Settings')} → ${ui('Privacy &amp; Security')} → ${ui('Location Services')} → ${ui('Shortcuts')}, keep ${ui('Precise Location')} on.</li>
      <li>Come back here and tap ${ui('Check it worked')}.</li></ol>
    <button type="button" class="btn" id="gCheck">Check it worked</button><div class="gres" id="gRes" hidden></div></details>
  <details class="gsec"><summary><span class="gn">+</span>Optional: Siri, “Mark this spot”</summary><p class="gnote">Saves a point mid-ride. It also fixes the route for rides that end where they started.</p><ol class="gsteps">
      <li>In Shortcuts, open the ${ui('Shortcuts')} tab and tap ${ui('+')}. Rename it ${ui('Mark this spot')}. That name is what you say to Siri.</li>
      <li>Add ${ui('Get Current Location')}, then ${ui('Dictate Text')}, then ${ui('URL Encode')}.</li>
      <li>Add ${ui('Get Contents of URL')} and paste:${copy('um', logURL('mark'))}</li>
      <li>Add ${tok('Current Location')} → ${ui('Latitude')}, type ${ui('&amp;lon=')}, add ${tok('Current Location')} → ${ui('Longitude')}, type ${ui('&amp;note=')}, then add ${tok('URL Encoded Text')}.</li></ol></details>
  <details class="gsec"><summary><span class="gn">+</span>Optional: Siri, “Log fuel”</summary><p class="gnote">At the pump, say the odometer, litres and cost, like “18450 12.3 35.20”.</p><ol class="gsteps">
      <li>New shortcut named ${ui('Log fuel')}. Add ${ui('Ask for Input')}, set the prompt to “Odometer, litres, cost”.</li>
      <li>Add ${ui('URL Encode')}, then ${ui('Get Contents of URL')} and paste:${copy('uf', logURL('fuel', '&fuel='))}</li>
      <li>Add ${tok('URL Encoded Text')} at the end.</li></ol></details>
  <details class="gsec"><summary><span class="gn">A</span>On Android (MacroDroid)</summary><p class="gnote">The same idea with the free MacroDroid app. I couldn’t check these on an Android phone, so the names may differ slightly.</p><ol class="gsteps">
      <li>Add a macro. Trigger: ${ui('Bluetooth Event')} → ${ui('Device Connected')} → your ${dev}.</li>
      <li>Action: ${ui('Force Location Update')}, then ${ui('HTTP Request')} with method ${ui('GET')} and this address:${copy('ua', logURL('start'))}</li>
      <li>Use the ${ui('Magic Text')} button to add your latitude, type <span class="mono">&amp;lon=</span>, then add your longitude.</li>
      <li>Make a second macro with ${ui('Device Disconnected')}, and change <span class="mono">e=start</span> to <span class="mono">e=end</span>.</li></ol></details>
  <div class="gfoot"><b>Good to know</b><ul>
      <li>Your phone needs mobile data when the ${dev} connects and disconnects, or that half of the ride is missed.</li>
      <li>Rides show up the next time you open Redline. Connections under ${S.minMin} minutes only save where you parked.</li>
      <li>Made the older version with ${ui('Save File')} and ${ui('Open URLs')}? Delete those two automations: swipe left on each in the Automation tab.</li></ul></div>` : ''}`, sh => {
    if ($('#gAdded', sh)) $('#gAdded', sh).onclick = () => { S.al = Object.assign({}, S.al, { added: Date.now() }); save(); haptic(); autoLogSheet(); };
    $$('[data-sc]', sh).forEach(b => b.addEventListener('click', () => { S.al = Object.assign({}, S.al, { ['tap_' + b.dataset.sc]: 1 }); if (S.al.tap_start && S.al.tap_end && !S.al.added) S.al.added = Date.now(); save(); }));
    const ta = $('#toAct', sh); if (ta) ta.onclick = () => activitySheet();
    sh._alRefresh = async () => { const before = JSON.stringify(S.al || {}); await pullLog(true); const a = S.al || {}; if ((a.start || a.end) && !a.added) a.added = Date.now(); if (JSON.stringify(a) !== before && sheetEl.classList.contains('on') && $('.chk', sheetEl)) { save(); const y = sheetEl.scrollTop; autoLogSheet(); sheetEl.scrollTop = y; if (a.start && a.end) { toast('Auto-log is set up. Ride safe!'); celebrate(); } } };
    $$('[data-sc]', sh).forEach(b => b.onclick = async () => { try { await navigator.clipboard.writeText(code); } catch (e) {} haptic(); toast('Rider code copied. Paste it when Shortcuts asks.'); setTimeout(() => window.open(SHORTCUTS[b.dataset.sc], '_blank'), 350); });
    $$('[data-copy]', sh).forEach(b => b.onclick = async () => { const el = $('#' + b.dataset.copy, sh); try { await navigator.clipboard.writeText(el.textContent); b.textContent = 'Copied'; haptic(); setTimeout(() => b.textContent = 'Copy', 1600); } catch (e) { const r = document.createRange(); r.selectNodeContents(el); getSelection().removeAllRanges(); getSelection().addRange(r); b.textContent = 'Selected'; } });
    $$('details.gsec', sh).forEach(d => d.addEventListener('toggle', () => { if (d.open) { $$('details.gsec', sh).forEach(o => o !== d && (o.open = false)); setTimeout(() => d.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60); } }));
    if ($('#gRelay', sh)) $('#gRelay', sh).onclick = () => relaySheet();
    if ($('#gCheck', sh)) $('#gCheck', sh).onclick = () => checkLog($('#gRes', sh), $('#gCheck', sh));
  });
}
// did anything arrive from the phone? if not, is the relay itself working?
async function checkLog(box, btn) {
  box.hidden = false; box.className = 'gres'; btn.disabled = true; btn.textContent = 'Checking…';
  const say = (ok, h, p) => { box.className = 'gres ' + (ok ? 'ok' : 'bad'); box.innerHTML = `<b>${h}</b><span>${p}</span>`; btn.disabled = false; btn.textContent = 'Check again'; };
  if (window.PREVIEW) { setTimeout(() => say(true, 'Got it', 'In the real app this shows when your Cardo last connected.'), 700); return; }
  try {
    const j = await getJSON(`${relayBase()}/?log=pull&k=${riderCode()}&_=${Date.now()}`); const items = (j.items || []).filter(x => x.e !== 'test');
    const recent = items.filter(x => Date.now() - x.t < 36e5).sort((a, b) => b.t - a.t)[0];
    const recentDone = S.openRide && Date.now() - S.openRide.t < 36e5 ? { e: 'start', t: S.openRide.t } : null;
    const hit = recent || recentDone;
    if (hit && (hit.e === 'start' || hit.e === 'end')) { S.al = Object.assign({}, S.al, { [hit.e]: hit.t, added: (S.al && S.al.added) || Date.now() }); save(); }
    if (hit) { const loc = hit.lat && !isNaN(parseFloat(hit.lat)); say(loc || recentDone, hit.e === 'end' ? 'Disconnect received' : 'Connect received', `${fmtTime(hit.t)}${loc || recentDone ? '. Your location came through too. You’re set.' : '. But there was no location: check steps 10 and 11, and that Shortcuts can use your location.'}`); pullLog(true); return; }
    // nothing from the phone yet: prove the relay works by sending a test from here
    await getJSON(`${relayBase()}/?log=add&k=${riderCode()}&e=test`);
    say(false, 'Relay works, nothing from your phone yet', 'Turn your intercom off and on, wait a few seconds, then check again. If it still says this, open the automation and check the address was pasted in full.');
  } catch (e) { say(false, 'Couldn’t reach the relay', 'Check the relay address in Settings → Traffic. If you made the relay yourself, check it has the RIDES binding (step 3 of the relay guide).'); }
}
const fmtTime = t => new Date(t).toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit' }).toLowerCase();


/* ================= parts: big animated art, "Done today" services it in front of you ================= */
function doneToday(it, btn) {
  const odo = estOdo(); if (odo == null) { toast('Add an odometer reading first', 'over'); return; }
  S.services.push({ id: uid(), date: todayISO(), odo, items: [it.id], cost: null, shop: '', notes: '', ts: Date.now() }); syncItems(); save();
  const scope = btn && (btn.closest('.card') || btn.closest('.sheet') || btn.closest('.tile'));
  ART.renew(scope && scope.querySelector('svg.art'));
  if (btn) { btn.classList.add('ok'); btn.animate([{ transform: 'scale(.8)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { duration: 450, easing: 'ease-out' }); }
  toast(`${it.name} · done at ${num(odo)} km`); celebrate();
  setTimeout(() => { if (sheetEl.classList.contains('on') && $('.pblock', sheetEl)) { const k = $('.pblock', sheetEl).dataset.part; $('.pblock', sheetEl).outerHTML = partBlock(k, PARTS.find(p => p[0] === k)[1]); wireParts(sheetEl); } refresh(); }, 1500);
}
function partBlock(k, label) {
  const items = S.items.filter(i => i.part === k);
  return `<div class="pblock" data-part="${k}">${items.map(i => { const s = itemStatus(i);
    return `<div class="pi"><button type="button" class="pmain" data-edit="${i.id}">${statusDot(s.cls)}<span class="grow"><span class="t">${esc(i.name)}</span><span class="s">${s.text}${i.km || i.months ? ' · every ' + [i.km ? num(i.km) + ' km' : '', i.months ? i.months + ' mo' : ''].filter(Boolean).join(' / ') : ''}</span>
      <span class="bar ${s.cls}"><i style="width:${Math.round(s.frac * 100)}%"></i></span></span></button><button type="button" class="done" data-done="${i.id}">${ic('check', 3)}<span>Done<br>today</span></button></div>`; }).join('')}
    ${missingStd().filter(d => d[1] === k).map(d => `<button type="button" class="addit std" data-std="${esc(d[0])}">+ Add ${esc(d[0])} back</button>`).join('')}<button type="button" class="addit" data-add="${k}">+ Add an item</button></div>`;
}
function wireParts(sh) {
  $$('[data-done]', sh).forEach(b => b.onclick = () => doneToday(S.items.find(x => x.id === b.dataset.done), b));
  $$('[data-edit]', sh).forEach(b => b.onclick = () => itemForm(S.items.find(x => x.id === b.dataset.edit)));
  $$('[data-add]', sh).forEach(b => b.onclick = () => itemForm(null, b.dataset.add));
  $$('.pblock [data-std]', sh).forEach(b => b.onclick = () => addStd(b.dataset.std));
}
// "How do I check this?" for people who don't know when a part was last done
const TIPS = {
  frontTyre: ['Look for the small bumps (wear bars) in the tread grooves. When the tread is level with them, replace the tyre.', 'Check for cracks on the sidewall, nails, or a flat-looking centre.', 'Tyres older than about 5 years go hard even with tread left. The date is a 4-digit code on the sidewall, like 2321 = week 23 of 2021.'],
  rearTyre: ['Look for the small bumps (wear bars) in the tread grooves. When the tread is level with them, replace the tyre.', 'The rear wears faster and squarer in the middle. A flat strip down the centre means it’s due soon.', 'Tyres older than about 5 years go hard even with tread left. The date is a 4-digit code on the sidewall.'],
  chain: ['With the bike on its side stand, push the chain up halfway between the sprockets. 2 to 3 cm of movement is right; more means it needs adjusting.', 'A dry, rusty or noisy chain needs cleaning and lube (about every 500 to 800 km, sooner after rain).', 'Pull the chain away from the back of the rear sprocket. If you can see a big gap, the chain and sprockets are worn.'],
  belt: ['Scooter belts are inside the engine casing, so you can’t see them easily. Go by km: most need replacing around 15,000 to 25,000 km.', 'Signs it’s worn: slipping, a slow pull-away, or a squeal when you open the throttle.'],
  final: ['Shaft drives need their gear oil changed by km (often every 20,000 km or so). Check your manual or ask your workshop.', 'Look for oil leaks around the rear hub.'],
  oil: ['With the bike upright on level ground, check the oil window (or dipstick). The level should sit between the two lines.', 'Fresh oil is golden brown. Black, thin or gritty oil means it’s due.', 'Not sure when it was last changed? Treat it as due. Oil is the cheapest way to look after the engine.'],
  coolant: ['With the engine cold, look at the coolant overflow bottle. The level should be between the LOW and FULL marks.', 'Never open the radiator cap when the engine is hot.'],
  brakes: ['Look at the brake pads through the calliper. Less than about 2 mm of pad material left means replace them.', 'Squealing, grinding, or a lever that pulls further than usual are signs to check.', 'Brake fluid should be clear to light amber in the little window. Dark brown means it’s due.'],
  spark: ['Plugs are under the tank on most bikes, so this is usually a workshop job. Go by km.', 'Signs it’s due: hard starting, misfiring, or poor fuel economy.'],
  air: ['The air filter sits in the airbox. A dirty one looks dark and clogged.', 'Singapore riding is dusty. Check it more often if you ride a lot in traffic or near construction.'],
  other: ['Anything else you want reminders for: a battery check, a wash, a new visor. Add it below.'],
};
function partSheet(k) {
  const label = (PARTS.find(p => p[0] === k) || [k, k])[1], p = partInfo(k);
  openSheet(label, '', `<div class="part-hero ${p.cls}">${ART.art(k, p.f, p.cls, 190)}<div class="pv"><b>${p.w ? bigVal(p.w.s) : '—'}</b><span>${p.w ? esc(p.w.i.name) : 'Not tracked yet'}</span></div></div>${TIPS[k] ? `<details class="tipbox"><summary>${ic('alert', 2.2)} How do I check this?</summary><ul>${TIPS[k].map(t => `<li>${t}</li>`).join('')}</ul></details>` : ''}${partBlock(k, label)}`, sh => {
    wireParts(sh); const a = $('.part-hero svg', sh); if (a && !RM) a.animate([{ transform: 'scale(.4) rotate(-20deg)', opacity: 0 }, { transform: 'scale(1.08) rotate(4deg)', opacity: 1, offset: .7 }, { transform: 'none' }], { duration: 650, easing: 'cubic-bezier(.2,1,.3,1)' });
  });
}

/* ================= fuel light ================= */
function fuelLight() {
  const fs = fuelStats();
  if (fs.light) { S.fuelLight = null; save(); refresh(); toast('Fuel light cleared'); return; }
  form({ title: 'Fuel light on?', lede: `Range resets to your reserve (${num(S.bike.reserve || 2.5, 1)} L) and counts down from here.`,
    fields: [{ k: 'odo', l: 'Odometer now (km)', type: 'number', v: estOdo() ?? '', req: 1 }], cta: 'Fuel light’s on',
    onSave: v => { S.fuelLight = { odo: v.odo, date: todayISO() }; S.lightLog = [...(S.lightLog || []), { odo: v.odo, t: Date.now() }].slice(-30); if (v.odo > (estOdo() || 0)) S.odoLog.push({ id: uid(), date: todayISO(), odo: v.odo, ts: Date.now() }); toast('Counting down from reserve');
      setTimeout(() => { const l = $('#hLamp') || $('#fLamp'); if (l) l.animate([{ transform: 'translateX(-50%) scale(1)' }, { transform: 'translateX(-50%) scale(1.6)' }, { transform: 'translateX(-50%) scale(1)' }], { duration: 500, easing: 'ease-out' }); }, 300); } });
}
// after a fill-up: the needle climbs from where it was, and the fuel lamp clicks off
function refillSweep(oldF, wasOn) {
  const id = place === 0 ? 'h' : place === 3 ? 'f' : null; if (!id) return; const fs = fuelStats(), f = gaugeFrac(fs);
  gaugeSet(id, oldF, fs.full); gaugeTo(id, f, 22, 7);
  const lamp = $('#' + id + 'Lamp'); if (lamp && wasOn && !fs.low) { lamp.classList.add('on'); setTimeout(() => { lamp.classList.remove('on'); lamp.classList.add('off'); lamp.animate([{ transform: 'translateX(-50%) scale(1.3)' }, { transform: 'translateX(-50%) scale(1)' }], { duration: 300 }); }, 900); }
  const d = $('#' + id + 'Dash'); if (d) { d.classList.add('filling'); setTimeout(() => d.classList.remove('filling'), 1800); }
}
function plusSheet() {
  openSheet('Log', '', `<div class="plusgrid">${[['fuel', 'fuel', 'Fill-up', 'c-orange'], ['ride', 'ride', 'Ride', 'c-sky'], ['service', 'wrench', 'Service', 'c-lemon'], ['odo', 'odo', 'Odometer', 'c-cream']].map(([a, i, t, c], n) => `<button type="button" class="pg ${c}" data-go="${a}" style="--d:${n * 45}ms">${ic(i)}<b>${t}</b></button>`).join('')}</div>
    <div class="plus2"><button type="button" class="mrow" data-go="parkhere"><span class="mi">${ic('park')}</span><span class="grow"><b>Find my bike</b><span>Where you parked, or save it now</span></span>${ic('chev')}</button><button type="button" class="mrow" data-go="expense"><span class="mi">${ic('coin')}</span><span class="grow"><b>Expense</b><span>Gear, parts, parking, washes, road tax</span></span>${ic('chev')}</button><button type="button" class="mrow scanrow2" data-go="scan"><span class="mi">${ic('cam')}</span><span class="grow"><b>Scan a photo</b><span>Odometer, pump or receipt. Redline fills in the form</span></span>${ic('chev')}</button><button type="button" class="mrow" data-go="wrap"><span class="mi">${ic('play')}</span><span class="grow"><b>Ride Wrap</b><span>Your month as a story</span></span>${ic('chev')}</button><button type="button" class="mrow" data-go="spots"><span class="mi">${ic('pin')}</span><span class="grow"><b>Marked spots</b><span>Places you saved mid-ride</span></span>${ic('chev')}</button></div>`,
    sh => $$('[data-go]', sh).forEach(b => b.onclick = () => ACTIONS[b.dataset.go]()));
}
const ACTIONS = { park: b => (b && b.closest && b.closest('.pkrow') && $('#pkDist') && /distance/.test($('#pkDist').textContent) ? parkDistance() : parkSheet()), parkhere: () => parkSheet(), expense: () => expenseForm(), costs: () => costsSheet(), export: () => exportSheet(), newitems: () => newItemsSheet(), scan: () => scanAny(), quickscan: () => quickScanSheet(), scansave: b => saveScan(b.dataset.i, true), scancheck: b => saveScan(b.dataset.i, false), scanx: b => { S.scanQ = (S.scanQ || []).filter(x => String(x.t) !== b.dataset.i); save(); refresh(); }, fullsvc: () => serviceForm(null, S.items.map(i => i.id)), kit: () => kitSheet(), preride: () => preRide(), mydata: () => myDataSheet('odo'), ridemenu: () => rideMenu(), autolog: () => autoLogSheet(), aldismiss: () => { S.al = Object.assign({}, S.al, { dismiss: 1 }); save(); refresh(); toast('Hidden. It’s in Settings → Auto-log rides any time.'); }, startride: startRide, endride: endRide, fuel: () => fuelForm(), ride: () => rideForm(), service: () => serviceForm(), odo: odoForm, history: historySheet, spots: spotsSheet, renewals: () => renewalsSheet(), wrap: () => { closeSheet(); WRAP.open(); },
  light: fuelLight, radar: () => RADAR.open(), roads: () => trafficSheet(), relay: () => relaySheet() };

/* ================= renewals: renewed it? set the new date and it goes quiet again ================= */
function renewedForm(r) {
  if (!r) return; const d = new Date((r.date || todayISO()) + 'T12:00'); d.setFullYear(d.getFullYear() + (/coe/i.test(r.name) ? 10 : 1));
  form({ title: `${esc(r.name)} renewed`, lede: 'Set the new expiry date. It will show up on Home again when it’s close.', fields: [{ type: 'row', f: [{ k: 'date', l: 'New expiry', type: 'date', v: todayISO(d), req: 1 }, { k: 'cost', l: 'Paid ($)', type: 'number', v: r.cost }] }], cta: 'Save',
    onSave: v => { Object.assign(r, v); if (+v.cost > 0) S.expenses.push({ id: uid(), date: todayISO(), cost: +v.cost, cur: 'SGD', cat: 'renewal', note: r.name, ts: Date.now() }); toast(`${r.name} sorted until ${fmtD(r.date)}`); } });
}

/* ================= traffic: your roads + live alerts ================= */
async function postalPoint(pc) { const j = await getJSON(`https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(pc)}&returnGeom=Y&getAddrDetails=N&pageNum=1`); const x = j.results && j.results[0]; if (!x) throw 0; return { lat: +x.LATITUDE, lon: +x.LONGITUDE }; }
function roadChips(sel) { return `<div class="chips roadchips" data-type="chips" data-k="roads" data-multi="1">${ROADS.map(([c, n]) => `<button type="button" class="chipbtn" data-v="${c}" aria-pressed="${sel.includes(c)}"><b>${c === 'WDL' ? 'Causeway' : c === 'TUAS' ? '2nd Link' : c}</b>${c === 'WDL' || c === 'TUAS' ? '' : `<small>${n}</small>`}</button>`).join('')}</div>`; }
function routeFinder() { return `<div class="finder"><div class="two">${F({ k: 'hpc', l: 'Home postal code', type: 'number', v: S.homePC || '', ph: '520123' })}${F({ k: 'wpc', l: 'Work postal code', type: 'number', v: S.workPC || '', ph: '138588' })}</div><button type="button" class="btn ghost sm" id="findRoads">${ic('ride')}<span> Find my roads</span></button></div>`; }
function wireFinder(root) {
  $('#findRoads', root).onclick = async e => { const v = read(root), b = e.currentTarget; if (!v.hpc || !v.wpc) { toast('Add both postal codes', 'over'); return; }
    b.disabled = true; b.lastChild.textContent = ' Finding…';
    try { const [h, w] = await Promise.all([postalPoint(String(v.hpc)), postalPoint(String(v.wpc))]); const r = await routeKm([h, w]); S.homePC = v.hpc; S.workPC = v.wpc; S.home = h;
      const found = r.roads || []; $$('.roadchips .chipbtn', root).forEach(c => { if (found.includes(c.dataset.v)) { c.setAttribute('aria-pressed', 'true'); c.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { duration: 400 }); } });
      toast(found.length ? `Found ${found.length} expressway${found.length > 1 ? 's' : ''} on your commute` : 'Your commute stays off the expressways'); }
    catch (err) { toast('Couldn’t look that up. Pick your roads instead.', 'over'); }
    b.disabled = false; b.lastChild.textContent = ' Find my roads'; };
}
function trafficSheet() {
  const nm = r => r === 'WDL' ? 'Causeway' : r === 'TUAS' ? '2nd Link' : r;
  const learnBox = () => { const l = learnedRoads(), off = S.roadLearn === false;
    return `${F({ k: 'learn', l: 'Also watch roads I ride often', type: 'toggle', v: !off })}
    <p class="gnote">${off ? 'Off: only the roads you pick above are watched.' : 'Any expressway you’ve really ridden twice in 60 days (GPS-tracked or a road you picked, never a guess).'}</p>
    ${!off && l.length ? `<div class="lchips">${l.map(r => `<span class="lchip">${nm(r)}<button type="button" data-drop="${r}" aria-label="Stop watching ${nm(r)}">${ic('x', 3)}</button></span>`).join('')}</div>` : ''}
    ${(S.roadDrop || []).length ? `<button type="button" class="link" id="undrop">Bring back ${S.roadDrop.length} removed road${S.roadDrop.length > 1 ? 's' : ''}</button>` : ''}`; };
  openSheet('Your roads', 'Jams and accidents on these show up on Home.', `<form id="tf">${roadChips(S.roads || [])}
    <div id="learnBox">${learnBox()}</div>
    <div class="sep"></div><div class="bl">Or let Redline find them</div>${routeFinder()}
    <div class="btns"><button class="btn">Save</button></div></form>
    <div class="sep"></div><button type="button" class="mrow" id="toRelay"><span class="mi">${ic('alert')}</span><span class="grow"><b>Live alerts</b><span>${S.relay ? 'On · from LTA' : 'Off · free one-time setup'}</span></span>${ic('chev')}</button>`, sh => {
    wire(sh); wireFinder(sh);
    const wireL = first => { const lb = $('#learnBox', sh); if (!first) wire(lb);
      $('[data-k=learn]', lb).addEventListener('click', () => { S.roadLearn = $('[data-k=learn] .sw', lb).classList.contains('on'); save(); lb.innerHTML = learnBox(); wireL(); });
      $$('[data-drop]', lb).forEach(b => b.onclick = () => { S.roadDrop = [...new Set([...(S.roadDrop || []), b.dataset.drop])]; save(); haptic(); lb.innerHTML = learnBox(); wireL(); });
      const u = $('#undrop', lb); if (u) u.onclick = () => { S.roadDrop = []; save(); lb.innerHTML = learnBox(); wireL(); }; };
    wireL(true);
    $('#tf', sh).onsubmit = e => { e.preventDefault(); S.roads = read(e.target).roads; save(); closeSheet(); loadLive(true); toast(S.roads.length ? `Watching ${S.roads.length} road${S.roads.length > 1 ? 's' : ''}` : 'No roads picked'); };
    $('#toRelay', sh).onclick = () => relaySheet();
  });
}

/* ================= settings ================= */
function settingsSheet() {
  const nr = nextRenewal(), earned = BADGES.filter(b => badgeState(b).tier > 0).length;
  const rows = [
    ['bike', 'bike', 'Bike', `${esc(S.bike.name || 'Your bike')} · ${buildName()}`],
    ['renewals', 'cal', 'Renewals', nr ? `${nr.r.name} in ${nr.s.days} days` : 'Add your dates'],
    ['autolog', 'head', 'Auto-log rides', S.relay ? (S.intercom && S.intercom !== 'none' ? `${S.intercom} · set up in Shortcuts` : 'Set up in Shortcuts') : 'Needs a relay first'],
    ['activity', 'list', 'Activity', 'What arrived from your shortcuts and OwnTracks'],
    ['relay', 'link', 'Relay', S.relay ? S.relay.replace(/^https:\/\//, '') : 'Not connected'],
    ['roads', 'alert', 'Traffic', `${myRoads().length ? myRoads().map(r => r === 'WDL' ? 'Causeway' : r === 'TUAS' ? '2nd Link' : r).join(', ') : 'Pick your roads'} · ${S.relay ? 'alerts on' : 'alerts off'}`],
    ['quickscan', 'cam', 'Quick scan', 'Snap the odometer or pump without opening Redline'],
    ['costs', 'coin', 'Costs', 'Everything the bike costs you'],
    ['export', 'share', 'Export', 'Excel spreadsheet or PDF service record'],
    ['mydata', 'list', 'My data', 'Fix any reading, fill-up, service or ride · restore'],
    ['badges', 'trophy', 'Badges', `${earned} of ${BADGES.length} earned`],
    ['sound', 'spk', 'Sound', [S.prefs.sound ? 'Tap sounds on' : 'Tap sounds off', S.prefs.music ? 'music on' : ''].filter(Boolean).join(' · ')],
    ['backup', 'save', 'Backup', S.stats.exports ? `${S.stats.exports} backups made` : 'Not backed up yet'],
  ];
  if (window.PREVIEW) rows.push(['demo', 'play', 'Preview tools', 'Try low fuel or a traffic alert']);
  openSheet('Settings', '', `<div class="mlist">${rows.map(([k, i, t, sub]) => `<button type="button" class="mrow" data-more="${k}"><span class="mi">${ic(i)}</span><span class="grow"><b>${t}</b><span>${sub}</span></span>${ic('chev')}</button>`).join('')}</div>`,
    sh => $$('[data-more]', sh).forEach(b => b.onclick = () => MORE[b.dataset.more]()));
}
function soundSheet() {
  openSheet('Sound', '', `${F({ k: 's', l: 'Tap sounds', type: 'toggle', v: S.prefs.sound })}${F({ k: 'm', l: 'Background music', type: 'toggle', v: S.prefs.music })}
    <div class="btns"><button type="button" class="btn ghost" id="pick">${Snd.own ? 'Back to the built-in music' : 'Use my own track'}</button></div>
`, sh => {
    wire(sh);
    $('[data-k=s]', sh).addEventListener('click', () => { S.prefs.sound = $('[data-k=s] .sw', sh).classList.contains('on'); save(); applyAudio(); });
    $('[data-k=m]', sh).addEventListener('click', () => { S.prefs.music = $('[data-k=m] .sw', sh).classList.contains('on'); save(); applyAudio(); });
    $('#pick', sh).onclick = () => { if (Snd.own) { Snd.dropTrack(); idb('del'); savedTrack = null; closeSheet(); } else $('#trkIn').click(); };
  });
}
const WORKER = `// Redline relay: traffic from LTA DataMall + a drop box for your rides
// Rides use a D1 database bound as DB (instant). Falls back to KV bound as RIDES.
export default {
  async fetch(req, env) {
    const q = new URL(req.url).searchParams;
    const head = { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'cache-control': 'no-store' };
    const out = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: head });
    if (req.method === 'OPTIONS') return new Response(null, { headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST', 'access-control-allow-headers': 'content-type' } });

    // Rides: your Shortcut drops start/end events here, Redline collects them when you open it.
    // Storage: a D1 database bound as DB (instant), or KV bound as RIDES (can lag up to a minute).
    const okCode = k => /^[a-z0-9]{8,40}$/.test(k || '');
    const store = async (k, ev) => {
      const id = k + ':' + ev.t + ':' + Math.random().toString(36).slice(2, 6);
      if (env.DB) {
        await env.DB.prepare('CREATE TABLE IF NOT EXISTS ev (id TEXT PRIMARY KEY, k TEXT, t INTEGER, body TEXT)').run();
        await env.DB.prepare('INSERT INTO ev (id, k, t, body) VALUES (?, ?, ?, ?)').bind(id, k, Date.now(), JSON.stringify(ev)).run();
        if (Math.random() < 0.02) await env.DB.prepare('DELETE FROM ev WHERE t < ?').bind(Date.now() - 2592000000).run();
      } else await env.RIDES.put(id, JSON.stringify(ev), { expirationTtl: 2592000 });
    };

    // Health check: tells the app which version this relay is and what's switched on
    if (q.has('ping')) return out({ v: 7, ai: !!env.AI, db: !!env.DB, kv: !!env.RIDES, lta: !!env.LTA_KEY });

    // Photo reading: odometer, pump display or receipt (needs a Workers AI binding named AI).
    // The phone crops and shrinks the photo and sends it as base64 text, so this stays within the free plan.
    // It tries up to 3 AI models and keeps the first answer that makes sense.
    if (q.has('ocr')) {
      if (!env.AI) return out({ v: 7, error: 'Add a Workers AI binding named AI' }, 500);
      const k = q.get('k') || ''; if (!/^[a-z0-9]{8,40}$/.test(k)) return out({ v: 7, error: 'Bad rider code' }, 400);
      let img = (await req.text()).trim();
      if (!img || img.length > 6000000) return out({ v: 7, error: 'Photo missing or too big' }, 413);
      if (!img.startsWith('data:')) img = 'data:image/jpeg;base64,' + img.replace(/\\s+/g, '');
      const hint = +q.get('odo') || 0, cap = +q.get('cap') || 25;
      const tips = 'The numbers are usually on a digital display made of 7-segment digits (like a calculator): read each digit carefully, an 8 has all seven bars, a 0 has no middle bar, a 6 has no top-right bar, a 9 has no bottom-left bar. Ignore reflections, dust and glare. ' +
        'Motorcycle dashboard: read the number next to ODO (the total distance, usually 3 to 6 digits). Do NOT use TRIP, the clock, the speed (the big number) or the gear.' + (hint ? ' This rider\\'s odometer should be roughly ' + Math.round(hint) + ' km.' : '') + ' ' +
        'Petrol pump display: in Singapore the TOP number is the amount paid in dollars and the number BELOW it is litres; the price per litre is often not shown (use null then). The amount is usually more than the litres. ' +
        'If you see RM, Ringgit, Petronas, Petron, BHPetrol or a Malaysian address, the currency is MYR, otherwise SGD.';
      const shapes = {
        odo: '{"kind":"odo","odo":18453,"seen":[18453,0]}',
        pump: '{"kind":"pump","cost":35.20,"litres":12.34,"price":2.85,"currency":"SGD","station":"Shell","date":"2026-10-15","seen":[35.2,12.34]}',
        service: '{"kind":"service","cost":180.00,"date":"2026-10-15","shop":"Ah Huat Motor","odo":18453,"work":["engine oil","oil filter"],"seen":[180,18453]}'
      };
      const kind = q.get('ocr');
      const ask = kind === 'auto'
        ? 'This photo is one of: a motorcycle dashboard (odometer), a petrol pump display, a fuel receipt, or a workshop invoice. Decide which, then reply with ONLY one JSON object in the matching shape. Odometer: ' + shapes.odo + '. Pump or fuel receipt: ' + shapes.pump + '. Workshop invoice: ' + shapes.service + '. ' + tips + ' Use null for anything you cannot read. "seen" lists every number you can see.'
        : shapes[kind] ? 'Read this photo and reply with ONLY one JSON object shaped like ' + shapes[kind] + '. ' + tips + ' Use null for anything you cannot read. "seen" lists every number you can see.' : null;
      if (!ask) return out({ v: 7, error: 'Bad kind' }, 400);
      const parse = r => { const resp = r && r.response; const text = typeof resp === 'string' ? resp : JSON.stringify(resp || '');
        let d = typeof resp === 'object' && resp ? resp : null;
        if (!d) { const m = text.match(/\\{[\\s\\S]*\\}/); try { d = m ? JSON.parse(m[0]) : null; } catch (e) {} }
        if (d && kind !== 'auto' && !d.kind) d.kind = kind; if (d && d.kind === 'receipt') d.kind = 'pump';
        return { d, text }; };
      const n = x => (x == null || x === '' || isNaN(+x)) ? null : +x;
      // does the answer make sense? (odometer near what the app expects, litres fit the tank, $2 to $5 a litre)
      const sane = d => { if (!d) return false;
        if (d.kind === 'odo') { const o = n(d.odo); if (o == null || o < 1 || o > 999999) return false; return !hint || (o >= hint - 300 && o <= hint + 4000); }
        if (d.kind === 'pump') { const L = n(d.litres), c = n(d.cost); if (L == null || c == null || L <= 0.3 || L > cap + 3) return false; const p = c / L; return p >= 1.5 && p <= 5.5; }
        if (d.kind === 'service') return n(d.cost) != null && n(d.cost) > 0;
        return false; };
      const models = [
        ['llama-4-scout', '@cf/meta/llama-4-scout-17b-16e-instruct'],
        ['mistral-small', '@cf/mistralai/mistral-small-3.1-24b-instruct'],
        ['gemma-3', '@cf/google/gemma-3-12b-it']];
      const tries = [], seen = new Set(); let best = null, used = '';
      for (const [name, id] of models) {
        let r = null;
        try { r = await env.AI.run(id, { messages: [{ role: 'user', content: [{ type: 'text', text: ask }, { type: 'image_url', image_url: { url: img } }] }], max_tokens: 400, temperature: 0 }); }
        catch (e) { tries.push(name + ': ' + String(e && e.message || e).slice(0, 120)); continue; }
        const { d, text } = parse(r); tries.push(name + ': ' + text.slice(0, 160));
        if (d && Array.isArray(d.seen)) d.seen.forEach(x => { if (n(x) != null) seen.add(n(x)); });
        (text.match(/\\d+(?:\\.\\d+)?/g) || []).forEach(x => { if (+x !== 2026 && +x !== 18453) seen.add(+x); });
        if (sane(d)) { best = d; used = name; break; }
        if (!best && d) { best = d; used = name; }
      }
      const ok = sane(best);
      // from the "Redline Scan" shortcut: keep the result for the app to offer next time it opens
      if (q.get('save') && (best || seen.size)) await store(k, { e: 'scan', t: Date.now(), data: JSON.stringify(Object.assign({ kind: kind === 'auto' ? 'unknown' : kind }, best || {}, { unsure: !ok, seen: [...seen].slice(0, 16) })).slice(0, 1500) });
      return out({ v: 7, ok, unsure: !ok, data: best, seen: [...seen].slice(0, 16), model: used, raw: tries.join(' | ').slice(0, 600) });
    }

    // OwnTracks (optional background GPS app) posts its location points here
    if (q.has('ot')) {
      const k = q.get('k') || ''; if (!okCode(k) || (!env.DB && !env.RIDES)) return new Response('[]', { headers: head });
      let m = null; try { m = await req.json(); } catch (e) {}
      if (m && m._type === 'location' && typeof m.lat === 'number') await store(k, { e: 'pt', lat: String(m.lat), lon: String(m.lon), t: (m.tst || Math.floor(Date.now() / 1000)) * 1000, acc: m.acc || 0, vel: m.vel || 0 });
      return new Response('[]', { headers: head });
    }

    if (q.has('log')) {
      const k = q.get('k') || '';
      if (!okCode(k)) return out({ error: 'Bad rider code' }, 400);
      if (!env.DB && !env.RIDES) return out({ error: 'Add a D1 binding named DB' }, 500);
      const mode = q.get('log');
      if (mode === 'pull') {
        if (env.DB) {
          await env.DB.prepare('CREATE TABLE IF NOT EXISTS ev (id TEXT PRIMARY KEY, k TEXT, t INTEGER, body TEXT)').run();
          const r = await env.DB.prepare('SELECT id, body FROM ev WHERE k = ? ORDER BY t LIMIT 1000').bind(k).all();
          return out({ items: r.results.map(x => ({ id: x.id, ...JSON.parse(x.body) })), store: 'd1' });
        }
        const list = await env.RIDES.list({ prefix: k + ':' });
        const items = await Promise.all(list.keys.map(async x => ({ id: x.name, ...JSON.parse(await env.RIDES.get(x.name) || '{}') })));
        return out({ items, store: 'kv' });
      }
      if (mode === 'ack') {
        const ids = (q.get('ids') || '').split(',').filter(id => id.startsWith(k + ':'));
        if (env.DB) { if (ids.length) await env.DB.batch(ids.map(id => env.DB.prepare('DELETE FROM ev WHERE id = ?').bind(id))); }
        else await Promise.all(ids.map(id => env.RIDES.delete(id)));
        return out({ deleted: ids.length });
      }
      const ev = { e: q.get('e') || 'test', t: Date.now() };
      for (const f of ['lat', 'lon', 'note', 'fuel']) if (q.has(f)) ev[f] = q.get(f).slice(0, 200);
      await store(k, ev);
      return out({ ok: true, saved: ev.e });
    }

    // Traffic: LTA DataMall (needs the LTA_KEY secret)
    const path = q.get('path') || 'TrafficIncidents';
    if (!/^[A-Za-z]+$/.test(path)) return out({ error: 'Bad path' }, 400);
    if (!env.LTA_KEY) return out({ error: 'Add the LTA_KEY secret for traffic' }, 500);
    const r = await fetch('https://datamall2.mytransport.sg/ltaodataservice/' + path,
      { headers: { AccountKey: env.LTA_KEY, accept: 'application/json' } });
    return new Response(await r.text(), { headers: head });
  }
};`;
// the shared Redline relay (Haiqal's). Everyone uses it unless they set their own or remove it.
const DEFAULT_RELAY = 'https://redline.lvredline.workers.dev';
// iCloud links to the shared shortcuts (made once on Haiqal's iPhone). Empty = show the build-it-yourself guide.
const SHORTCUTS = { scan: '', start: 'https://www.icloud.com/shortcuts/afb9c505c54c4b81ba3d5d4c69251b40', end: 'https://www.icloud.com/shortcuts/a0445371b3e74afbb50d15adcd5aaa7e' };
if (!S.relay && !S.relayOff && !window.PREVIEW) S.relay = DEFAULT_RELAY;
// ---- ride relay: the phone drops events there; the app collects them
const relayBase = () => (S.relay || '').replace(/\/+$/, '');
function riderCode() { if (!S.rider) { const a = new Uint8Array(12); crypto.getRandomValues(a); S.rider = [...a].map(x => 'abcdefghjkmnpqrstuvwxyz23456789'[x % 31]).join(''); save(); } return S.rider; }
const logURL = (e, tail = '&lat=') => `${relayBase() || 'https://YOUR-RELAY.workers.dev'}/?log=add&k=${riderCode()}&e=${e}${tail}`;
let pulling = false, lastPull = 0;
async function pullLog(force) {
  if (window.PREVIEW || !S.relay || !S.rider || pulling || (!force && Date.now() - lastPull < 6e4)) return [];
  pulling = true; lastPull = Date.now();
  try {
    const j = await getJSON(`${relayBase()}/?log=pull&k=${S.rider}&_=${Date.now()}`); const items = (j && j.items) || [];
    if (S.openRide && Date.now() - S.openRide.t > 12 * 3600e3) { S.openRide = null; save(); toast('An unfinished ride from earlier was cleared'); refresh(); }
    if (!items.length) return [];
    const q0 = (S.tripQ || []).length, res = await applyEvents(items.filter(x => x.e !== 'test'));
    for (let i = 0; i < items.length; i += 60) await getJSON(`${relayBase()}/?log=ack&k=${S.rider}&_=${Date.now()}&ids=${encodeURIComponent(items.slice(i, i + 60).map(x => x.id).join(','))}`).catch(() => {});
    for (const t of (S.tripQ || []).filter(t => t.auto)) { const r2 = await answerTrip(t.k, true); if (r2) res.push(r2); }
    if (!res.length && (S.tripQ || []).length !== q0) refresh();
    showResults(res); return items;
  } catch (e) { return []; } finally { pulling = false; }
}
function showResults(res) {
  if (!res.length) return; const rides = res.filter(r => r.ride);
  refresh();
  if (rides.length) { const r = rides[rides.length - 1].ride; banner(rides.length > 1 ? `${rides.length} rides logged · ${num(rides.reduce((s, x) => s + x.ride.km, 0), 1)} km` : `Ride logged · ${num(r.km, 1)} km${r.est === 'estimate' ? ' (estimated)' : ''}`, 'Name it', () => rideForm(r)); }
  else { const m = res[res.length - 1]; toast(m.msg, m.col === 'red' ? 'over' : ''); }
  celebrate();
}

// one small free Cloudflare Worker does two jobs: LTA traffic, and the drop box your rides land in
function relaySheet() {
  openSheet('Relay', S.relay === DEFAULT_RELAY ? 'You’re on the shared Redline relay: live LTA traffic and ride logging, nothing to set up. Your rides stay private to your own rider code.' : 'A tiny free server that brings in LTA traffic alerts and catches rides from your phone. One per group is enough: friends can share yours, and each phone gets its own private rider code.', `
  <form id="rf">${F({ k: 'relay', l: 'Relay address', v: S.relay, ph: 'https://redline.yourname.workers.dev' })}<div class="btns">${S.relay ? '<button type="button" class="btn danger" id="roff" style="flex:.6">Remove</button>' : ''}<button class="btn">Save and test</button></div></form>
  <div class="gres" id="rRes" hidden></div>
  <details class="gsec" ${S.relay ? '' : 'open'}><summary><span class="gn">?</span>Make your own (about 10 minutes)</summary><ol class="gsteps">
    <li>Sign up free at <b>dash.cloudflare.com</b>.</li>
    <li>Go to ${ui('Workers &amp; Pages')} → ${ui('Create')} → start from the ${ui('Hello World')} worker. Name it <span class="mono">redline</span> and tap ${ui('Deploy')}.</li>
    <li>Tap ${ui('Edit code')}, select everything, and replace it with this. Then tap ${ui('Deploy')}.
      <pre class="code" id="wcode">${esc(WORKER)}</pre><button type="button" class="btn ghost sm" id="copyW">Copy code</button></li>
    <li><b>For rides:</b> go to ${ui('Storage &amp; databases')} → ${ui('D1 SQL database')} → ${ui('Create')}, name it <span class="mono">redline-rides</span>, tap ${ui('Create')}.</li>
    <li>Back in your worker, open ${ui('Bindings')} (under ${ui('Settings')} on some accounts) → ${ui('Add binding')} → ${ui('D1 database')}. Variable name <b class="mono">DB</b>, pick <span class="mono">redline-rides</span>, then ${ui('Add binding')}.</li>
    <li><b>For photo scanning:</b> in the same ${ui('Bindings')} → ${ui('Add binding')} → ${ui('Workers AI')}. Variable name <b class="mono">AI</b>, then ${ui('Add binding')}. It’s free up to a daily limit, plenty for a group of friends.</li>
    <li><b>For traffic (optional):</b> sign up for LTA DataMall (free); your AccountKey arrives by email. In the worker: ${ui('Settings')} → ${ui('Variables and Secrets')} → ${ui('Add')}, type ${ui('Secret')}, name <b class="mono">LTA_KEY</b>, paste the key, ${ui('Deploy')}.</li>
    <li>Copy the worker’s address (it ends in <span class="mono">.workers.dev</span>), paste it at the top and tap ${ui('Save and test')}.</li></ol></details>`, sh => {
    $('#copyW', sh).onclick = async e => { try { await navigator.clipboard.writeText(WORKER); e.target.textContent = 'Copied'; } catch (err) { const r = document.createRange(); r.selectNodeContents($('#wcode', sh)); getSelection().removeAllRanges(); getSelection().addRange(r); e.target.textContent = 'Selected, copy it'; } };
    $('#rf', sh).onsubmit = async e => { e.preventDefault(); const u = (read(e.target).relay || '').replace(/\/+$/, ''), box = $('#rRes', sh);
      if (!/^https:\/\//.test(u)) { toast('Paste the https:// address of the relay', 'over'); return; }
      box.hidden = false; box.className = 'gres'; box.innerHTML = '<b>Testing…</b>';
      const ok = async q => { try { const j = await getJSON(u + q); return j; } catch (err) { return null; } };
      const [rides, traffic, ping] = await Promise.all([ok('/?log=pull&k=testtesttest'), ok('/?path=TrafficIncidents'), ok('/?ping=1')]);
      const rOk = rides && Array.isArray(rides.items), tOk = traffic && 'value' in traffic;
      if (!rOk && !tOk) { box.className = 'gres bad'; box.innerHTML = '<b>Couldn’t reach it</b><span>Check the address, and that you tapped Deploy after pasting the code.</span>'; return; }
      S.relay = u; S.relayOff = false; save(); loadLive(true);
      box.className = 'gres ok'; box.innerHTML = `<b>Saved</b><span>Rides: ${rOk ? (rides.store === 'kv' ? 'ready ✓ (KV: up to a minute behind. Add the DB binding for instant)' : 'ready ✓ instant') : 'needs the DB binding (step 5)'}<br>Traffic: ${tOk ? `on ✓ · ${traffic.value.length} incidents right now` : 'off (needs the LTA_KEY secret, step 7)'}<br>Photo scanning: ${!ping || !ping.v ? '<b class="warn">old relay code</b>. Copy the code below again, paste it in and Deploy' : ping.ai ? 'on ✓' : 'needs the AI binding (step 6)'}</span>`;
      if (rOk) { riderCode(); box.insertAdjacentHTML('beforeend', '<button type="button" class="btn" id="toAuto">Set up auto-log →</button>'); $('#toAuto', sh).onclick = () => autoLogSheet(); } };
    if ($('#roff', sh)) $('#roff', sh).onclick = () => { S.relay = ''; S.relayOff = true; save(); closeSheet(); LIVE.inc = null; paintLive(); toast('Relay removed'); };
  });
}
function demoSheet() {
  const fs = fuelStats();
  openSheet('Preview tools', 'Only in this preview, to try states the sample data doesn’t show.', `<div class="btns" style="flex-direction:column">
    <button type="button" class="btn" id="dLow">${fs.light ? 'Back to a fuller tank' : 'Simulate low fuel'}</button>
    <button type="button" class="btn ghost" id="dInc">${S.demoInc ? 'Hide the traffic alert' : 'Show a traffic alert'}</button>
    <button type="button" class="btn ghost" id="dSetup">Try the first-run setup</button></div>`, sh => {
    $('#dLow', sh).onclick = () => { S.fuelLight = fs.light ? null : { odo: estOdo() - 20, date: todayISO() }; save(); closeSheet(); if (place !== 0) go(0); else render(true); };
    $('#dInc', sh).onclick = () => { S.demoInc = !S.demoInc; save(); closeSheet(); loadLive(true); };
    $('#dSetup', sh).onclick = () => { closeSheet(); S = fresh(); save(); startSetup(); };
  });
}
const MORE = { activity: () => activitySheet(), costs: () => costsSheet(), export: () => exportSheet(), quickscan: () => quickScanSheet(), mydata: () => myDataSheet('odo'), relay: relaySheet, bike: bikeForm, renewals: renewalsSheet, autolog: autoLogSheet, relay: relaySheet, roads: trafficSheet, badges: badgesSheet, sound: soundSheet, backup: backupSheet, demo: demoSheet };

function applyLite() {}
/* ================= audio: off by default ================= */
let savedTrack = null;
function applyAudio() {
  const want = S.prefs.sound || S.prefs.music || !!savedTrack && S.prefs.music;
  if (!want) { if (Snd.ctx) { Snd.setMusic(false); Snd.set(false); } return; }
  if (!Snd.ctx) { Snd.start(); if (savedTrack) Snd.useTrack(savedTrack.blob, savedTrack.name); }
  Snd.set(true); Snd.fx.gain.value = S.prefs.sound ? .9 : 0; Snd.setMusic(!!S.prefs.music);
  if (Snd.track) { if (S.prefs.music) Snd.track.play().catch(() => {}); else Snd.track.pause(); }
}
$('#trkIn').addEventListener('change', e => { const f = e.target.files[0]; if (!f) return; const name = f.name.replace(/\.[^.]+$/, ''); savedTrack = { blob: f, name }; idb('put', savedTrack); S.prefs.music = true; save(); if (!Snd.ctx) Snd.start(); Snd.useTrack(f, name); applyAudio(); e.target.value = ''; closeSheet(); toast('Playing ' + name); });
function idb(op, val) { return new Promise(res => { try { const r = indexedDB.open('redline', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv');
  r.onsuccess = () => { try { const tx = r.result.transaction('kv', op === 'get' ? 'readonly' : 'readwrite'), st = tx.objectStore('kv'); const q = op === 'get' ? st.get('track') : op === 'del' ? st.delete('track') : st.put(val, 'track'); q.onsuccess = () => res(q.result); q.onerror = () => res(null); } catch (e) { res(null); } }; r.onerror = () => res(null); } catch (e) { res(null); } }); }
idb('get').then(v => { if (v && v.blob) savedTrack = v; });
function kv(op, key, val) { return new Promise(res => { try { const r = indexedDB.open('redline', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv');
  r.onsuccess = () => { try { const tx = r.result.transaction('kv', op === 'get' || op === 'keys' ? 'readonly' : 'readwrite'), st = tx.objectStore('kv');
    const q = op === 'get' ? st.get(key) : op === 'del' ? st.delete(key) : op === 'keys' ? st.getAllKeys() : st.put(val, key); q.onsuccess = () => res(q.result); q.onerror = () => res(null); } catch (e) { res(null); } }; r.onerror = () => res(null); } catch (e) { res(null); } }); }
// a photo shrunk on the phone to a small JPEG (so dozens fit easily)
async function smallPhoto(file, max = 1280, q = .82) { const url = URL.createObjectURL(file); const img = new Image(); img.src = url; await img.decode();
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); return c.toDataURL('image/jpeg', q); }
const pickImage = (camera) => new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; if (camera) i.capture = 'environment'; i.onchange = () => res(i.files[0] || null); i.click(); });
// browsers only allow audio after a tap
addEventListener('pointerdown', () => { if (!Snd.ctx && (S.prefs.sound || S.prefs.music)) applyAudio(); }, { capture: true });

/* ================= Shortcut events (Cardo / Siri) ================= */
async function processURL() {
  const r = await handleURL(); if (!r) return;
  if (r.ride) { refresh(); banner(`Ride logged · ${num(r.ride.km, 1)} km${r.ride.est === 'estimate' ? ' (estimated)' : ''}`, 'Name it', () => rideForm(r.ride)); }
  else { toast(r.msg, r.col === 'red' ? 'over' : ''); refresh(); }
  celebrate();
}

/* ================= guided setup ================= */
let step = 0, setupSvc = 'unsure';
const STEPS = [
  { k: 'Welcome', h: 'Let’s set up your bike', p: 'Redline keeps your bike’s service, fuel, renewals and rides in one place, and can log rides on its own. Setup takes about a minute.', cta: 'Begin', place: 0 },
  { k: 'Step 1 of 6', h: 'How is it built?', p: 'This decides which parts Redline tracks. Not sure? Look at the rear wheel and the front of the engine.', custom: 'build' },
  { k: 'Step 2 of 6', h: 'Name your ride', p: 'You can change these any time in Settings.', place: 2, fields: () => bikeFields(S.bike), save: v => { if (!v.name) { toast('Give your bike a nickname', 'over'); return false; } Object.assign(S.bike, v); } },
  { k: 'Step 3 of 6', h: 'Odometer and last service', p: 'The starting point for every countdown. Rough is fine, and you can add it later.', place: 0, custom: 'service' },
  { k: 'Step 4 of 6', h: 'Renewal dates', p: 'Add what you know and skip the rest.', place: 0, fields: () => S.renewals.slice(0, 4).map(r => ({ k: r.id, l: r.name, type: 'date', v: r.date })), save: v => { S.renewals.forEach(r => { if (r.id in v) r.date = v[r.id]; }); }, skip: true },
  { k: 'Step 5 of 6', h: 'Your usual roads', p: 'Jams and accidents on these show up on Home. Skip it and Redline learns them from your rides.', custom: 'roads', skip: true },
  { k: 'Step 6 of 6', h: 'Ride with an intercom?', p: 'If you do, rides can log themselves when it connects and disconnects. Set it up later in Settings.', place: 1, custom: 'intercom' },
];
function startSetup() { document.body.classList.add('setting-up'); step = 0; renderStep(); }
function renderStep() {
  const st = STEPS[step], panel = $('#setupPanel');
  if (st.place != null && window.W && W.place !== st.place) W.go(st.place);
  let body = '';
  if (st.fields) body = st.fields().map(F).join('');
  if (st.body) body = st.body();
  if (st.custom === 'service') { const ch = (c, t, sub) => `<button type="button" class="choice ${setupSvc === c ? 'on' : ''}" data-c="${c}"><span><b>${t}</b><span>${sub}</span></span></button>`;
    body = F({ k: 'odo', l: 'Odometer now (km)', type: 'number', v: estOdo() ?? '', ph: '18420' }) + `<button type="button" class="later" id="odoLater">${ic('clock', 2.2)}<span>Not near the bike? Add it later</span></button>
    <div class="bl">When was it last serviced?</div>
    ${ch('new', 'Bought it new', 'First service at 1,000 km, then the normal schedule')}
    ${ch('known', 'I know roughly when', 'Pick the date. Assumes a full service')}
    ${ch('unsure', 'Not sure', 'Redline reminds you to get one, then starts fresh from there')}
    ${ch('fresh', 'Just serviced', 'Every countdown starts from today')}
    <div id="svcKnown" ${setupSvc === 'known' ? '' : 'hidden'}>${[{ type: 'row', f: [{ k: 'sdate', l: 'Date (roughly)', type: 'date', v: todayISO(new Date(Date.now() - 60 * 864e5)) }, { k: 'sodo', l: 'At odometer, if known', type: 'number', v: '' }] }, { k: 'sitems', l: 'What was done (a full service is everything)', type: 'chips', multi: 1, o: S.items.map(i => ({ v: i.id, l: i.name })), v: S.items.map(i => i.id) }].map(F).join('')}</div>`; }
  if (st.custom === 'build') { const art = { chain: 'chain', belt: 'belt', shaft: 'final', liquid: 'coolant', air: 'fins' };
    const grp = (g, list, cur) => `<div class="bgroup"><div class="bl">${g === 'drive' ? 'Rear wheel driven by' : 'Engine cooling'}</div>${list.map(([v, b, sub]) => `<button type="button" class="choice build ${cur === v ? 'on' : ''}" data-g="${g}" data-c="${v}">${ART.art(art[v], 1, 'ok', 58)}<span><b>${b}</b><span>${sub}</span></span></button>`).join('')}</div>`;
    body = grp('drive', DRIVES, S.bike.drive || 'chain') + grp('cooling', COOLS, S.bike.cooling || 'liquid'); }
  if (st.custom === 'roads') body = roadChips(S.roads || []) + `<div class="sep"></div><div class="bl">Or let Redline find them</div>` + routeFinder();
  if (st.custom === 'intercom') body = [['Cardo', 'Cardo', 'Packtalk, Freecom, Spirit'], ['Other', 'Another intercom', 'Sena, Shoei, any Bluetooth'], ['none', 'No intercom', 'Log rides with a tap']].map(([v, b, s]) => `<button type="button" class="choice ${S.intercom === v ? 'on' : ''}" data-c="${v}"><span><b>${b}</b><span>${s}</span></span></button>`).join('');
  panel.innerHTML = `<div class="prog">${STEPS.map((_, i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div><div class="k">${st.k}</div><h1>${st.h}</h1><p class="lede">${st.p}</p>
    <form id="sform">${body}</form>${st.custom === 'intercom' && isIOS ? `<button type="button" class="btn alnow" id="sAuto" ${S.intercom && S.intercom !== 'none' ? '' : 'hidden'}>${ic('head', 2.4)} Start riding + set up auto-log</button>` : ''}<div class="btns">${step > 0 ? '<button type="button" class="btn ghost sm" id="sBack">Back</button>' : ''}${st.skip ? '<button type="button" class="btn ghost sm" id="sSkip">Skip</button>' : ''}<button type="button" class="btn ${st.custom === 'intercom' ? 'ghost' : ''}" id="sNext">${step === STEPS.length - 1 ? 'Start riding' : st.cta || 'Continue'}</button></div>`;
  panel.scrollTop = 0; wire(panel);
  $$('.choice', panel).forEach(c => c.onclick = () => { if (c.dataset.g) { $$(`.choice[data-g="${c.dataset.g}"]`, panel).forEach(x => x.classList.remove('on')); c.classList.add('on'); haptic(); S.bike[c.dataset.g] = c.dataset.c; return; }
    $$('.choice', panel).forEach(x => x.classList.remove('on')); c.classList.add('on'); haptic();
    if (st.custom === 'service') { setupSvc = c.dataset.c; $('#svcKnown', panel).hidden = setupSvc !== 'known'; } else { S.intercom = c.dataset.c; if ($('#sAuto', panel)) $('#sAuto', panel).hidden = S.intercom === 'none'; } });
  panel.onpick = null; panel.addEventListener('pick', e => { const f = e.target.closest('[data-k=type]'); if (!f) return; const v = read(panel).type; if (v) { S.bike.type = v; if (window.W) W.setBike(v); } });
  if (st.custom === 'roads') wireFinder(panel);
  $('#odoLater', panel) && ($('#odoLater', panel).onclick = () => { $('[name=odo]', panel).value = ''; nextStep(); });
  $('#sBack', panel) && ($('#sBack', panel).onclick = () => { step--; renderStep(); });
  $('#sSkip', panel) && ($('#sSkip', panel).onclick = () => { step++; renderStep(); });
  $('#sNext', panel).onclick = nextStep;
  if ($('#sAuto', panel)) $('#sAuto', panel).onclick = () => { nextStep(); setTimeout(() => autoLogSheet(), 1100); }; $('#sform', panel).onsubmit = e => { e.preventDefault(); nextStep(); };
}
function nextStep() {
  const st = STEPS[step], v = read($('#sform'));
  if (st.save && st.save(v) === false) return;
  if (st.custom === 'service') {
    const has = v.odo != null && !isNaN(v.odo);
    S.odoLog = S.odoLog.filter(o => !o.setup); if (has) S.odoLog.push({ id: uid(), date: todayISO(), odo: v.odo, setup: true, ts: Date.now() });
    // no reading yet: time-based countdowns start today, km countdowns start the moment a reading arrives
    S.odoPending = !has;
    S.needFull = null; S.items = S.items.filter(i => !i.once);
    if (setupSvc === 'fresh' || setupSvc === 'new') S.items.forEach(i => { i.lastOdo = has ? v.odo : null; i.lastDate = todayISO(); i.base = true; });
    if (setupSvc === 'new') S.items.unshift({ id: uid(), name: 'First service (running-in)', part: 'oil', km: 1000, months: 1, lastOdo: 0, lastDate: todayISO(), base: true, once: true });
    if (setupSvc === 'unsure') { S.needFull = todayISO(); S.items.forEach(i => { i.lastOdo = null; i.lastDate = null; i.base = false; }); }
    if (setupSvc === 'known') { if (!v.sitems || !v.sitems.length) { toast('Pick what was done, or choose Not sure', 'over'); return; }
      // odometer at that service unknown: estimate it from today's reading at about 25 km a day, so km countdowns still work
      const days = Math.max(0, (Date.now() - +new Date((v.sdate || todayISO()) + 'T12:00')) / 864e5);
      const so = v.sodo != null && !isNaN(v.sodo) ? v.sodo : has ? Math.max(0, Math.round(v.odo - days * 25)) : null;
      S.services.push({ id: uid(), date: v.sdate || todayISO(), odo: so, items: v.sitems, cost: null, shop: '', notes: 'Added during setup' });
      S.items.forEach(i => { if (v.sitems.includes(i.id)) { i.lastDate = v.sdate || todayISO(); i.lastOdo = so; i.base = so == null; } }); if (so != null) syncItems(); }
  }
  if (st.custom === 'build') { applyBuild(); syncItems(); }
  if (st.custom === 'roads') S.roads = v.roads || [];
  if (st.custom === 'intercom' && !S.intercom) S.intercom = 'none';
  save(); syncWorld();
  if (step === STEPS.length - 1) { S.setupDone = true; save(); document.body.classList.remove('setting-up'); place = -1; go(0); return; }
  step++; renderStep();
}

/* ================= preview: sample data so every screen has something in it ================= */
function seedPreview() {
  if (S.setupDone || S.rides.length) return;
  const D = n => todayISO(new Date(Date.now() - n * 864e5)), now = Date.now();
  Object.assign(S.bike, { name: 'Sample XSR', model: 'Yamaha XSR155', plate: 'FBA1234X', type: 'naked', tank: 10, cc: 155, licence: '2B' });
  S.odoLog.push({ id: uid(), date: D(40), odo: 17400 });
  S.services.push({ id: uid(), date: D(40), odo: 17400, items: S.items.map(i => i.id), cost: 280, shop: 'Ah Huat Motor', notes: 'Full service' });
  S.services.push({ id: uid(), date: D(14), odo: 18150, items: [S.items[2].id], cost: 0, shop: 'DIY', notes: '' });
  [[D(30), 17650, 8.4, 24.2], [D(19), 18010, 8.1, 23.6], [D(3), 18390, 8.6, 25.1]].forEach(([date, odo, litres, cost]) => S.fuel.push({ id: uid(), date, odo, litres, cost, full: true, station: 'Shell' }));
  S.fuel.push({ id: uid(), date: D(9), odo: 18200, litres: 3.2, cost: 9.1, cur: 'MYR', fx: .31, costSgd: 2.82, full: false, station: 'Malaysia' });
  [[D(2), 'gear', 'Tinted visor', 89], [D(8), 'park', 'Season parking (HDB)', 14.7], [D(12), 'care', 'Bike wash', 8], [D(25), 'acc', 'Phone mount', 45], [D(70), 'renewal', 'Insurance', 420], [D(160), 'renewal', 'Road tax', 160], [D(55), 'parts', 'LED indicators', 38]].forEach(([date, cat, note, cost]) => S.expenses.push({ id: uid(), date, cat, note, cost, cur: 'SGD' }));
  // sample rides with rough road shapes (the real app gets exact roads from routing)
  const HOME = [1.3526, 103.9447];
  const P = {
    commute: [HOME, [1.345, 103.93], [1.333, 103.91], [1.322, 103.89], [1.312, 103.875], [1.30, 103.862], [1.285, 103.851]],
    mandai: [HOME, [1.372, 103.93], [1.392, 103.905], [1.403, 103.875], [1.41, 103.845], [1.414, 103.815], [1.405, 103.79], [1.385, 103.775], [1.36, 103.80], [1.345, 103.83], [1.34, 103.87], [1.345, 103.91], HOME],
    ecp: [HOME, [1.335, 103.955], [1.318, 103.94], [1.305, 103.92], [1.296, 103.895], [1.29, 103.875], [1.283, 103.862], [1.276, 103.857]],
    jb: [HOME, [1.37, 103.925], [1.39, 103.905], [1.405, 103.87], [1.413, 103.83], [1.42, 103.80], [1.433, 103.778], [1.447, 103.77], [1.457, 103.768], [1.466, 103.764], [1.48, 103.765], [1.50, 103.77], [1.525, 103.78], [1.55, 103.787]],
    changi: [HOME, [1.36, 103.96], [1.37, 103.975], [1.383, 103.985], [1.392, 103.987]],
    sentosa: [HOME, [1.322, 103.89], [1.30, 103.86], [1.285, 103.84], [1.27, 103.825], [1.255, 103.82]],
    tuas: [HOME, [1.34, 103.90], [1.335, 103.86], [1.335, 103.82], [1.335, 103.78], [1.335, 103.74], [1.33, 103.70], [1.32, 103.665], [1.315, 103.64]],
    ayer: [[1.285, 103.851], [1.28, 103.82], [1.29, 103.79], [1.30, 103.76], [1.31, 103.73], [1.32, 103.70]],
    lck: [[1.36, 103.80], [1.38, 103.75], [1.40, 103.72], [1.425, 103.71], [1.44, 103.725]],
    punggol: [HOME, [1.37, 103.915], [1.39, 103.905], [1.405, 103.905]],
    link2: [[1.335, 103.74], [1.35, 103.67], [1.37, 103.645], [1.40, 103.635], [1.43, 103.63], [1.46, 103.65], [1.48, 103.68]],
  };
  const smooth = pts => { const o = []; for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    for (let k = 0; k < 6; k++) { const t = k / 6, t2 = t * t, t3 = t2 * t; o.push([0, 1].map(j => +(.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)).toFixed(5))); } }
    o.push(pts[pts.length - 1]); return o; };
  const len = p => { let d = 0; for (let i = 1; i < p.length; i++) d += haversine({ lat: p[i - 1][0], lon: p[i - 1][1] }, { lat: p[i][0], lon: p[i][1] }); return Math.round(d * 1.12 * 10) / 10; };
  const R0 = [['Work commute', 'commute', 1, ''], ['Mandai loop', 'mandai', 2, 'Chill'], ['ECP night run', 'ecp', 4, 'Night'], ['JB makan trip', 'jb', 9, 'Touring'], ['Changi dawn', 'changi', 12, 'Chill'],
    ['Work commute', 'commute', 6, ''], ['Work commute', 'commute', 8, ''], ['Sentosa sunset', 'sentosa', 17, 'Chill'], ['Punggol night', 'punggol', 22, 'Night'], ['Work commute', 'commute', 27, ''],
    ['Tuas sunrise run', 'tuas', 34, 'Spirited'], ['West coast AYE', 'ayer', 41, 'Chill'], ['Lim Chu Kang', 'lck', 48, 'Chill'], ['Second Link to JB', 'link2', 56, 'Touring'], ['ECP night run', 'ecp', 63, 'Night'], ['Work commute', 'commute', 70, '']];
  const RD = { commute: ['PIE'], ecp: ['ECP'], jb: ['TPE', 'SLE', 'BKE', 'WDL'], tuas: ['PIE', 'AYE'], mandai: ['TPE', 'SLE'], link2: ['AYE', 'TUAS'], sentosa: ['ECP'], ayer: ['AYE'], changi: [], punggol: ['TPE'], lck: ['KJE'] };
  R0.forEach(([title, k, d, mood], i) => { const t0 = now - d * 864e5 - i * 37e5, path = smooth(P[k]), est = ['tracked', 'picked', 'route'][i % 3]; S.rides.push({ id: uid(), title, km: len(path), path, est, gps: est === 'tracked' ? path.filter((_, j) => j % 4 === 0) : undefined, roads: RD[k] || [], start: { t: t0 }, end: { t: t0 + Math.round(len(path) * 1.8) * 6e4 }, src: 'manual', mood, note: '' }); });
  const R = S.renewals; R[0].date = D(-24); R[1].date = D(-148); R[2].date = D(-1680); R[3].date = D(-210); R[0].cost = 160; R[1].cost = 420;
  S.parked = { lat: 1.3521, lon: 103.8198, t: now - 3 * 36e5 };
  S.roads = ['ECP', 'TPE']; S.demoInc = true; S.intercom = 'Cardo'; S.setupDone = true; syncItems(); save();
}


(function boot() {
  if (window.PREVIEW) seedPreview();
  syncWorld(); applyLite();
  const sp = $('#splash');
  const start = () => { if (sp) sp.classList.add('out'); if (!S.setupDone) startSetup(); else { render(true); processURL(); pullLog(true); } };
  // wait for fonts so the big numbers don't jump, but never more than a moment
  Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise(r => setTimeout(r, 900))]).then(() => setTimeout(start, 250));
  loadLive();
  setInterval(() => { if (!document.hidden && S.setupDone) { loadLive(); if (sheetEl._alRefresh && $('.chk', sheetEl)) sheetEl._alRefresh(); else pullLog(); } }, 6e5);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S.setupDone) { loadLive(); pullLog(); if (!sheetEl.classList.contains('on')) refresh(); } });
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
