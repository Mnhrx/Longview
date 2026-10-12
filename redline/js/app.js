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
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/* ---------- icons ---------- */
const IC = {
  fuel: '<path d="M5 21V5a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v16M4 21h11M5 10h9"/><path d="M14 8h2l3 3v6a1.5 1.5 0 0 1-3 0v-2h-2"/>',
  ride: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.3 5.2L3.5 17.4a1.9 1.9 0 0 0 2.7 2.7l5.9-5.9a4 4 0 0 0 5.2-5.3l-2.6 2.6-2.3-.6-.6-2.3z"/>',
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
async function getJSON(u) { const c = new AbortController(); setTimeout(() => c.abort(), 8000); const r = await fetch(u, { signal: c.signal }); if (!r.ok) throw new Error(r.status); return r.json(); }
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
const CAMS = [['2701', 'Woodlands', 'Causeway to JB'], ['4703', 'Tuas', 'Second Link']];
async function loadCams() {
  if (window.PREVIEW) { LIVE.cams = { sample: true }; return; }
  try { const j = await getJSON('https://api.data.gov.sg/v1/transport/traffic-images'); const all = j.items[0].cameras; LIVE.cams = {}; for (const [id] of CAMS) { const c = all.find(x => x.camera_id === id); if (c) LIVE.cams[id] = { img: c.image, t: c.timestamp }; } }
  catch (e) { LIVE.cams = { err: true }; }
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
      <div class="read"><b id="${id}Read">${fs.range == null ? '—' : fs.range}</b><span>${fs.pastE ? 'PAST E · FILL UP' : fs.range == null ? 'LOG 2 FULL TANKS' : 'KM RANGE'}</span></div></div>
    ${fs.range != null ? `<button type="button" class="lightbtn ${fs.light ? 'on' : ''}" data-act="light">${ic('pump')}<span>${fs.light ? 'Fuel light on · undo' : 'Fuel light on?'}</span></button>` : ''}`;
}
function wrapMonth() { const n = new Date(), d = new Date(n.getFullYear(), n.getMonth() - 1, 1); return { y: d.getFullYear(), m: d.getMonth(), key: `${d.getFullYear()}-${d.getMonth()}` }; }
function wrapReady() { const w = wrapMonth(); return monthRides(w.y, w.m).length >= 3 && (window.PREVIEW || S.wrapSeen !== w.key || new Date().getDate() <= 7); }
function homeHTML() {
  const fs = fuelStats(), due = dueItems(), mr = monthRides(), mkm = mr.reduce((s, r) => s + (r.km || 0), 0), nr = nextRenewal();
  const w = wrapMonth();
  return `<div class="hi"><div><h1>${esc(S.bike.name || 'Your bike')}</h1><small>${esc(S.bike.model || buildName())}${S.bike.plate ? ` <span class="plate">${esc(S.bike.plate)}</span>` : ''}</small></div></div>
    <div class="instr">${gaugeBlock('h', fs)}<div class="odo"><span class="lab">ODO</span>${odoHTML()}<span class="lab">KM</span></div></div>
    <div class="alerts" id="alerts">${alertsHTML()}</div>
    <div id="live0"></div>
    ${wrapReady() ? `<button type="button" class="wrapcta" data-act="wrap"><span class="wglow"></span><span class="wt"><small>Ride Wrap</small><b>Your ${new Date(w.y, w.m, 1).toLocaleDateString('en-SG', { month: 'long' })} is ready</b></span><span class="wplay">${ic('play', 2.6)}</span></button>` : ''}`;
}
// only what needs you now, most urgent first, never more than three
const renWindow = r => /coe/i.test(r.name) ? 90 : 30;
function alertsHTML() {
  const fs = fuelStats(), due = dueItems(), out = [];
  const partCard = top => `<section class="card c-lemon alertc ${top.s.cls}" data-part="${top.i.part}">${ART.art(top.i.part, top.s.frac, top.s.cls, 68)}<div class="t"><span>${top.s.cls === 'over' ? '<em>OVERDUE</em>' : '<em class="soon">DUE SOON</em>'}${esc(top.i.name)}</span><b>${bigVal(top.s)}</b></div><button type="button" class="sqbtn" data-done="${top.i.id}" aria-label="Mark ${esc(top.i.name)} done today">${ic('check', 3)}</button></section>`;
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
  if (w && !w.err) h += `<section class="wxrow ${wet(w.text) ? 'wet' : ''}">${wxIcon(w.text)}<div class="grow"><b>${esc(w.text.replace(/\s*\((Day|Night)\)/i, ''))}</b><span>${esc(w.area)}${w.until ? ' · till ' + w.until : ''}</span></div><span class="verdict">${wet(w.text) ? 'Rain gear' : 'Good to ride'}</span></section>`;
  return h;
}
function abroadKm(r) { if (!r.path || r.path.length < 2 || !window.MAP) return 0; return (r.km || 0) * r.path.filter(([la, lo]) => !MAP.inSG(la, lo)).length / r.path.length; }
function ridesHTML() {
  const mr = monthRides(), km = mr.reduce((s, r) => s + (r.km || 0), 0), longest = mr.reduce((a, r) => Math.max(a, r.km || 0), 0);
  const rides = [...S.rides].sort((a, b) => b.start.t - a.start.t), abroad = rides.reduce((s, r) => s + abroadKm(r), 0);
  return `<div class="hi"><div><h1>Rides</h1></div></div>
    <section class="card mapcard" id="mapcard"><canvas id="mapcv" aria-label="Map of your rides"></canvas>
      <div class="mo"><span>${new Date().toLocaleDateString('en-SG', { month: 'long' })}</span><b><span class="cnt" data-to="${Math.round(km)}">${Math.round(km)}</span><small>km</small></b></div>
      <div class="mfocus" id="mfocus" hidden></div></section>
    <div class="stats"><div><b class="cnt" data-to="${mr.length}">${mr.length}</b><span>rides</span></div><div><b>${num(longest, longest < 100 ? 1 : 0)}</b><span>longest km</span></div><div><b>${num(abroad)}</b><span>km in JB</span></div></div>
    <h2 class="sec">Road check</h2>
    <div id="live1"></div>
    <h2 class="sec">Journal</h2>
    <section class="list2">${rides.length ? rides.slice(0, 40).map((r, i) => `<button type="button" class="rrow" data-focus="${r.id}" style="--d:${Math.min(i, 10) * 40}ms"><span class="when"><b>${new Date(r.start.t).getDate()}</b><small>${new Date(r.start.t).toLocaleDateString('en-SG', { month: 'short' })}</small></span>
        <span class="grow"><span class="t">${esc(r.title || 'Ride')}${abroadKm(r) > 1 ? ' <em class="flag">JB</em>' : ''}</span><span class="s">${new Date(r.start.t).toLocaleDateString('en-SG', { weekday: 'short' })} · ${Math.round(Math.max(0, r.end.t - r.start.t) / 6e4)} min${r.mood ? ' · ' + esc(r.mood) : ''}</span></span><span class="km">${num(r.km, 1)}<small>km</small></span></button>`).join('')
      : '<div class="empty">No rides yet. Turn on auto-log in Settings and rides appear here by themselves.</div>'}</section>`;
}
function liveRides() {
  const c = LIVE.cams, all = LIVE.all, mine = myRoads();
  const cam = ([id, name, sub]) => { const x = c && c[id];
    return `<a class="cam" ${x && x.img ? `href="${x.img}" target="_blank" rel="noopener"` : ''}><div class="shot">${x && x.img ? `<img src="${x.img}" alt="Live camera at ${name}" loading="lazy">` : `<div class="camph"><span class="rec"></span>${ic('cam', 1.8)}<span>${c && c.sample ? 'Live camera in the app' : c && c.err ? 'Camera unavailable' : 'Loading…'}</span></div>`}</div><b>${name}</b><span>${sub}${x && x.t ? ' · ' + new Date(x.t).toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit' }) : ''}</span></a>`; };
  return `<button type="button" class="myroads" data-act="roads"><span>Watching</span>${mine.length ? mine.map(r => `<b>${r === 'WDL' ? 'Causeway' : r === 'TUAS' ? '2nd Link' : r}</b>`).join('') : '<i>Pick your roads</i>'}${ic('chev')}</button>
    <div class="cams">${CAMS.map(cam).join('')}</div>
    ${all ? (all.length ? `<div class="incs">${all.slice(0, 8).map(x => { const m = x.roads.some(r => mine.includes(r)); return `<div class="inc ${m ? 'mine' : ''}"><span class="tag ${incKind(x.Type) === 'Jam' ? 'jam' : ''}">${incKind(x.Type)}</span><p>${esc(incText(x.Message))}</p></div>`; }).join('')}</div>` : '<div class="note">Expressways are clear right now.</div>')
      : '<button type="button" class="note link" data-act="relay">Turn on live jams and accidents →</button>'}`;
}
function paintLive() { const a = $('#live0'), b = $('#live1'), al = $('#alerts'); if (a) a.innerHTML = liveHome(); if (b) b.innerHTML = liveRides(); if (al) { const h = alertsHTML(); if (al.dataset.h !== h) { al.innerHTML = h; al.dataset.h = h; } } }
function partInfo(k) { const items = S.items.filter(i => i.part === k).map(i => ({ i, s: itemStatus(i) })), w = items.filter(x => x.s.cls !== 'unset').sort((a, b) => a.s.frac - b.s.frac)[0]; return { items, w, cls: w ? w.s.cls : 'unset', f: w ? w.s.frac : 0 }; }
function garageHTML() {
  const st = S.items.map(itemStatus), over = st.filter(s => s.cls === 'over').length, soon = st.filter(s => s.cls === 'soon').length;
  const ks = PARTS.filter(([k]) => S.items.some(i => i.part === k)).map(([k, l]) => ({ k, l, ...partInfo(k) })).sort((a, b) => (a.cls === 'unset') - (b.cls === 'unset') || a.f - b.f);
  const hero = ks[0];
  return `<div class="hi"><div><h1>Garage</h1><small>${esc(buildName())} · ${num(estOdo())} km</small></div></div>
    ${hero ? `<section class="card ghero ${hero.cls}" data-part="${hero.k}">${ART.art(hero.k, hero.f, hero.cls, 150)}<div class="t"><span>${hero.cls === 'over' ? '<em>OVERDUE</em>' : hero.cls === 'soon' ? '<em class="soon">DUE SOON</em>' : '<em class="okk">NEXT UP</em>'}${esc(hero.w ? hero.w.i.name : hero.l)}</span><b>${hero.w ? bigVal(hero.w.s) : 'Not tracked'}</b>${hero.w ? `<button type="button" class="donebig" data-done="${hero.w.i.id}">${ic('check', 3)}<span>Done today</span></button>` : ''}</div></section>` : ''}
    <div class="gsum"><b>${over ? `<span class="r">${over} overdue</span>` : ''}${over && soon ? ' · ' : ''}${soon ? `${soon} due soon` : ''}${!over && !soon ? 'Everything’s good' : ''}</b><button type="button" class="link" data-act="history">History</button><button type="button" class="link" data-act="service">Log service</button></div>
    <div class="tiles">${ks.slice(1).map((p, i) => `<button type="button" class="tile ${p.cls}" data-part="${p.k}" style="--d:${i * 50}ms">${ART.art(p.k, p.f, p.cls, 84)}<span class="nm">${esc(p.l)}</span><b>${p.w ? bigVal(p.w.s) : '<small>Not tracked</small>'}</b><span class="bar"><i style="width:${p.w ? Math.max(4, Math.round(p.f * 100)) : 0}%"></i></span></button>`).join('')}</div>`;
}
function fuelHTML() {
  const fs = fuelStats(), now = new Date(), list = [...S.fuel].sort((a, b) => b.odo - a.odo);
  const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1); return { d, v: S.fuel.filter(f => { const x = new Date(f.date); return x.getMonth() === d.getMonth() && x.getFullYear() === d.getFullYear(); }).reduce((s, f) => s + (+f.cost || 0), 0) }; });
  const mmax = Math.max(40, ...months.map(x => x.v));
  return `<div class="hi"><div><h1>Fuel</h1><small>${fs.tankFrac != null ? `${num(fs.tankFrac * S.bike.tank, 1)} of ${num(S.bike.tank)} L in the tank` : 'Two full tanks unlock your range'}</small></div></div>
    <div class="instr">${gaugeBlock('f', fs)}</div>
    <button type="button" class="bigbtn c-orange" data-act="fuel"><span class="nozzle">${ic('pump', 2.4)}</span><span>Log a fill-up</span></button>
    <div class="stats"><div><b>${fs.kpl ? num(fs.kpl, 1) : '—'}</b><span>km/L</span></div><div><b>${money(months[5].v, 0)}</b><span>${now.toLocaleDateString('en-SG', { month: 'long' })}</span></div><div><b>${fs.cpk ? '$' + num(fs.cpk, 2) : '—'}</b><span>per km</span></div></div>
    <section class="card plain"><div class="ch"><b>Spend</b><span>last 6 months</span></div><div class="bars">${months.map(({ d, v }, i) => `<div class="bcol"><span class="bv">${v ? '$' + Math.round(v) : ''}</span><i style="height:${Math.max(3, v / mmax * 100)}%;--d:${i * 70}ms"></i><span>${d.toLocaleDateString('en-SG', { month: 'short' })}</span></div>`).join('')}</div></section>
    <h2 class="sec">Fill-ups</h2>
    <section class="list2">${list.length ? list.map((f, i) => { const prev = list[i + 1], d = prev ? f.odo - prev.odo : null, k = f.full && prev && d > 0 && f.litres ? d / f.litres : null;
      return `<button type="button" class="rrow" data-fuel="${f.id}" style="--d:${Math.min(i, 10) * 40}ms"><span class="when"><b>${new Date(f.date).getDate()}</b><small>${new Date(f.date).toLocaleDateString('en-SG', { month: 'short' })}</small></span><span class="grow"><span class="t">${num(f.litres, 1)} L${f.station ? ' · ' + esc(f.station) : ''}</span><span class="s">${num(f.odo)} km${k ? ` · ${num(k, 1)} km/L` : ''}${f.full ? '' : ' · partial'}</span></span><span class="km">${f.cost ? money(f.cost) : ''}</span></button>`; }).join('') : '<div class="empty">Log fills with the odometer reading. Two full tanks unlock range and km/L.</div>'}</section>`;
}
const SCREENS = [homeHTML, ridesHTML, garageHTML, fuelHTML];

/* ================= rendering, tab transitions and the gliding nav pill ================= */
function gaugeFrac(fs) { return fs.range != null && fs.full ? clamp(fs.range / fs.full, 0, 1) : 0; }
function render(animate, dir = 0) {
  document.body.dataset.place = place;
  const pad = document.createElement('div'); pad.className = 'pad'; pad.innerHTML = SCREENS[place]();
  viewEl.className = 'view v' + place; viewEl.replaceChildren(pad);
  navTo(place);
  const fs = fuelStats(), f = gaugeFrac(fs);
  if (place === 0) { if (animate) { setOdo(0, false); setTimeout(() => setOdo(estOdo(), true), 260); keyOn('h', f, fs.full); } else { setOdo(estOdo(), false); gaugeSet('h', f, fs.full); } paintLive(); }
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
function refresh() { syncWorld(); const y = viewEl.scrollTop; render(false); viewEl.scrollTop = y; }
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
  requestAnimationFrame(() => { const b = $(`#nav [data-i="${i}"]`), ind = $('#navInd'); if (!b || !ind) return; ind.style.width = b.offsetWidth + 'px'; ind.style.transform = `translateX(${b.offsetLeft}px)`; });
}
addEventListener('resize', () => navTo(place));
function syncWorld() { if (window.MAP) MAP.setRides(S.rides.map(r => ({ id: r.id, t: r.start.t, path: r.path }))); }
function focusRide(id) {
  if (!window.MAP) return; if (MAP.focused === id) id = null;
  MAP.focus(id); $$('.rrow[data-focus]', viewEl).forEach(x => x.classList.toggle('sel', x.dataset.focus === id)); showFocus();
  if (id) $('#mapcard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function showFocus() {
  const box = $('#mfocus'); if (!box) return; const r = window.MAP && S.rides.find(x => x.id === MAP.focused);
  box.hidden = !r; if (!r) return;
  box.innerHTML = `<div class="grow"><span>${fmtDs(todayISO(new Date(r.start.t)))} · ${Math.round(Math.max(0, r.end.t - r.start.t) / 6e4)} min</span><b>${esc(r.title || 'Ride')}</b></div><b class="k">${num(r.km, 1)}<small>km</small></b><button type="button" class="rbtn" data-ride="${r.id}" aria-label="Edit ride">${ic('list')}</button>`;
  box.animate([{ transform: 'translateY(20px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 380, easing: 'cubic-bezier(.2,1.3,.4,1)' });
}
function setType(type) { if (type === S.bike.type) return; S.bike.type = type; save(); syncWorld(); if (place === 2) refresh(); }

$('#nav').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.act) { haptic(); b.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(90deg) scale(.9)' }, { transform: 'rotate(90deg)' }], { duration: 300, easing: 'cubic-bezier(.2,1.4,.4,1)' }); plusSheet(); return; } go(+b.dataset.i); });
$('#gear').addEventListener('click', e => { haptic(); e.currentTarget.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(120deg)' }], { duration: 500, easing: 'cubic-bezier(.2,1.3,.4,1)' }); settingsSheet(); });
viewEl.addEventListener('click', e => {
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
viewEl.addEventListener('pointerdown', e => { const b = e.target.closest('button,.card[data-part],a.cam'); if (!b || RM) return; pressed = b; b._pa = b.animate([{ transform: 'scale(1)' }, { transform: 'scale(.96)' }], { duration: 120, fill: 'forwards', easing: 'ease-out' }); });
addEventListener('pointerup', () => { const b = pressed; pressed = null; if (!b || !b._pa) return; b._pa.cancel(); b.animate([{ transform: 'scale(.96)' }, { transform: 'scale(1.03)' }, { transform: 'scale(1)' }], { duration: 340, easing: 'ease-out' }); });
addEventListener('pointercancel', () => { if (pressed && pressed._pa) pressed._pa.cancel(); pressed = null; });
function openSheet(title, lede, body, onOpen) {
  sheetEl.innerHTML = `<div class="grab"></div><div class="sh-head"><div class="grow"><h2>${title}</h2>${lede ? `<p>${lede}</p>` : ''}</div><button type="button" class="x" aria-label="Close">${ic('x')}</button></div>${body}`;
  sheetEl.scrollTop = 0; sheetEl.classList.add('on'); shadeEl.classList.add('on'); if (window.W) W.locked = true;
  $('.x', sheetEl).onclick = closeSheet; onOpen && onOpen(sheetEl);
}
function closeSheet() { sheetEl.classList.remove('on'); shadeEl.classList.remove('on'); if (window.W) { W.locked = false; W.poke(); } }
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
function form({ title, lede, fields, cta = 'Save', onSave, onDelete }) {
  openSheet(title, lede, `<form id="fm">${fields.map(F).join('')}<div class="btns">${onDelete ? '<button type="button" class="btn danger" id="del" style="flex:.5">Delete</button>' : ''}<button class="btn">${cta}</button></div>
    <div class="confirm" id="cf" hidden><span>Delete this for good? This can’t be undone.</span><div class="btns"><button type="button" class="btn ghost" id="cfNo">Keep it</button><button type="button" class="btn danger solid" id="cfYes">Delete</button></div></div></form>`, sh => {
    wire(sh);
    $('#fm', sh).onsubmit = e => {
      e.preventDefault(); const v = read(e.target);
      for (const x of fields.flatMap(x => x.type === 'row' ? x.f : [x])) if (x.req && (v[x.k] == null || v[x.k] === '' || (typeof v[x.k] === 'number' && isNaN(v[x.k])))) { toast(`Add ${x.l.toLowerCase()}`, 'over'); return; }
      if (onSave(v) === false) return;
      save(); closeSheet(); refresh(); celebrate();
    };
    if (onDelete) { $('#del', sh).onclick = () => { $('#cf', sh).hidden = false; $('#cf', sh).scrollIntoView({ block: 'nearest' }); };
      $('#cfNo', sh).onclick = () => $('#cf', sh).hidden = true; $('#cfYes', sh).onclick = () => { onDelete(); save(); closeSheet(); refresh(); toast('Deleted'); }; }
  });
}
function celebrate() { const ups = checkBadges(); if (ups.length) { const { b, tier } = ups[ups.length - 1]; setTimeout(() => toast(`${['', 'Bronze', 'Silver', 'Gold'][tier]} badge · ${b[1]}`), 600); } }
/* ================= actions ================= */
const odoGuess = () => estOdo() ?? '';
const STATIONS = ['Shell', 'Esso', 'SPC', 'Caltex', 'Sinopec', 'Malaysia'].map(s => ({ v: s, l: s }));
const MOODS = ['Chill', 'Spirited', 'Rainy', 'Night', 'Touring', 'Jammed'].map(v => ({ v, l: v }));
function fuelForm(e) {
  form({ title: e ? 'Edit fill-up' : 'Fill-up', lede: 'The odometer reading powers km/L, range and every service countdown.',
    fields: [{ type: 'row', f: [{ k: 'date', l: 'Date', type: 'date', v: e?.date || todayISO(), req: 1 }, { k: 'odo', l: 'Odometer (km)', type: 'number', v: e?.odo ?? odoGuess(), req: 1 }] },
      { type: 'row', f: [{ k: 'litres', l: 'Litres', type: 'number', v: e?.litres, req: 1 }, { k: 'cost', l: 'Cost ($)', type: 'number', v: e?.cost }] },
      { k: 'station', l: 'Station', type: 'chips', o: STATIONS, v: e?.station || '' }, { k: 'full', l: 'Filled to a full tank', type: 'toggle', v: e ? e.full : true }],
    onSave: v => { if (e) { Object.assign(e, v); return; }
      // after the fuel light: learn this bike's real reserve from how much went in
      const fl = S.fuelLight, k = fuelStats().kpl;
      if (fl && v.full && k && v.litres && v.odo >= fl.odo) { const est = (+S.bike.tank - v.litres) + (v.odo - fl.odo) / k; if (est > .3 && est < S.bike.tank * .5) S.bike.reserve = Math.round(((+S.bike.reserve || 2.5) * 2 + est) / 3 * 10) / 10; }
      const oldF = gaugeFrac(fuelStats()), wasOn = fuelStats().low;
      if (v.full) S.fuelLight = null;
      S.fuel.push({ id: uid(), ...v }); toast('Fill-up logged'); setTimeout(() => refillSweep(oldF, wasOn), 420); },
    onDelete: e && (() => S.fuel = S.fuel.filter(x => x !== e)) });
}
function serviceForm(e) {
  form({ title: e ? 'Edit service' : 'Log a service', lede: 'Pick what was done. Those countdowns restart from this odometer reading.',
    fields: [{ type: 'row', f: [{ k: 'date', l: 'Date', type: 'date', v: e?.date || todayISO(), req: 1 }, { k: 'odo', l: 'Odometer (km)', type: 'number', v: e?.odo ?? odoGuess(), req: 1 }] },
      { k: 'items', l: 'What was done', type: 'chips', multi: 1, o: S.items.map(i => ({ v: i.id, l: i.name })), v: e?.items || [] },
      { type: 'row', f: [{ k: 'cost', l: 'Cost ($)', type: 'number', v: e?.cost }, { k: 'shop', l: 'Workshop or DIY', v: e?.shop, ph: 'DIY' }] },
      { k: 'notes', l: 'Parts and notes', type: 'textarea', v: e?.notes, ph: 'Motul 7100 10W40, new chain…' }],
    onSave: v => { if (!v.items.length && !v.notes) { toast('Pick at least one item', 'over'); return false; }
      if (e) Object.assign(e, v); else { S.services.push({ id: uid(), ...v }); toast('Service logged · countdowns reset'); } syncItems(); },
    onDelete: e && (() => { S.services = S.services.filter(x => x !== e); syncItems(); }) });
}
function syncItems() {
  S.items.forEach(it => { const last = S.services.filter(s => s.items.includes(it.id)).sort((a, b) => b.odo - a.odo)[0];
    if (last && (it.lastOdo == null || last.odo >= it.lastOdo || !it.base)) { it.lastOdo = last.odo; it.lastDate = last.date; } else if (!last && !it.base) { it.lastOdo = null; it.lastDate = null; } });
}
function odoForm() {
  form({ title: 'Odometer check', lede: 'A real reading recalibrates tracked distance and every countdown.',
    fields: [{ type: 'row', f: [{ k: 'date', l: 'Date', type: 'date', v: todayISO(), req: 1 }, { k: 'odo', l: 'Reading (km)', type: 'number', v: odoGuess(), req: 1 }] }],
    onSave: v => { S.odoLog.push({ id: uid(), ...v }); toast('Odometer updated'); } });
}
function rideForm(r) {
  const isNew = !r, dt = r ? todayISO(new Date(r.start.t)) : todayISO();
  form({ title: isNew ? 'Log a ride' : (esc(r.title) || 'Ride'), lede: isNew ? 'For rides the auto-log missed.' : fmtDT(r.start.t) + (r.est === 'estimate' ? ' · distance estimated' : ''),
    fields: [{ k: 'title', l: 'Title', v: r?.title || '', ph: 'Sunday ride to Changi' },
      { type: 'row', f: [{ k: 'date', l: 'Date', type: 'date', v: dt }, { k: 'km', l: 'Distance (km)', type: 'number', v: r?.km ?? '', req: 1 }] },
      { k: 'mins', l: 'Duration (min)', type: 'number', v: r ? Math.round((r.end.t - r.start.t) / 6e4) : '' },
      { k: 'mood', l: 'Vibe', type: 'chips', o: MOODS, v: r?.mood || '' }, { k: 'note', l: 'Journal', type: 'textarea', v: r?.note, ph: 'Where you went, what you ate, how it felt' }],
    onSave: v => { if (isNew) { const t0 = +new Date(v.date + 'T09:00'); S.rides.push({ id: uid(), title: v.title, start: { t: t0 }, end: { t: t0 + (v.mins || 0) * 6e4 }, km: v.km, src: 'manual', mood: v.mood, note: v.note }); toast('Ride logged'); }
      else { Object.assign(r, { title: v.title, km: v.km, mood: v.mood, note: v.note, loop: false }); if (v.mins != null) r.end.t = r.start.t + v.mins * 6e4; } },
    onDelete: !isNew && (() => S.rides = S.rides.filter(x => x !== r)) });
}
function itemForm(it, part) {
  const isNew = !it; it = it || { id: uid(), name: '', part: part || 'other', km: 0, months: 0 };
  form({ title: isNew ? 'New service item' : esc(it.name), lede: 'How often it needs doing: by km, by months, or both.',
    fields: [{ k: 'name', l: 'Name', v: it.name, req: 1 }, { k: 'part', l: 'Part on the hologram', type: 'chips', o: PARTS.map(([v, l]) => ({ v, l })), v: it.part },
      { type: 'row', f: [{ k: 'km', l: 'Every (km)', type: 'number', v: it.km || '' }, { k: 'months', l: 'Every (months)', type: 'number', v: it.months || '' }] },
      { type: 'row', f: [{ k: 'lastOdo', l: 'Last done at (km)', type: 'number', v: it.lastOdo ?? '' }, { k: 'lastDate', l: 'Last done on', type: 'date', v: it.lastDate || '' }] }],
    onSave: v => { Object.assign(it, { name: v.name, part: v.part || 'other', km: v.km || 0, months: v.months || 0, lastOdo: v.lastOdo, lastDate: v.lastDate || null, base: true }); if (isNew) S.items.push(it); },
    onDelete: !isNew && (() => S.items = S.items.filter(x => x !== it)) });
}
function renewalForm(r) {
  const isNew = !r; r = r || { id: uid(), name: '', date: '' };
  form({ title: isNew ? 'New renewal' : esc(r.name), lede: 'It turns amber in the last 30 days and red once it’s overdue.',
    fields: [{ k: 'name', l: 'Name', v: r.name, req: 1 }, { type: 'row', f: [{ k: 'date', l: 'Expires on', type: 'date', v: r.date }, { k: 'cost', l: 'Last paid ($)', type: 'number', v: r.cost }] }],
    onSave: v => { Object.assign(r, v); if (isNew) S.renewals.push(r); },
    onDelete: !isNew && (() => S.renewals = S.renewals.filter(x => x !== r)) });
}
const bikeFields = b => [{ k: 'name', l: 'Nickname', v: b.name, req: 1, ph: 'Black Mamba' },
  { type: 'row', f: [{ k: 'model', l: 'Model', v: b.model, ph: 'Yamaha MT-07' }, { k: 'plate', l: 'Plate', v: b.plate, ph: 'FBA1234X' }] },
  { type: 'row', f: [{ k: 'tank', l: 'Tank size (L)', type: 'number', v: b.tank }, { k: 'reserve', l: 'Reserve when fuel light comes on (L)', type: 'number', v: b.reserve ?? 2.5 }] },
  { k: 'cc', l: 'Engine (cc)', type: 'number', v: b.cc },
  { k: 'licence', l: 'Licence class', type: 'chips', o: ['2B', '2A', '2'].map(v => ({ v, l: 'Class ' + v })), v: b.licence }];
function bikeForm() {
  form({ title: 'Your bike', lede: 'How it’s built decides which parts Redline tracks.', fields: [
      { k: 'drive', l: 'Rear wheel driven by', type: 'chips', o: DRIVES.map(([v, l]) => ({ v, l })), v: S.bike.drive || 'chain' },
      { k: 'cooling', l: 'Engine cooling', type: 'chips', o: COOLS.map(([v, l]) => ({ v, l })), v: S.bike.cooling || 'liquid' }, ...bikeFields(S.bike)],
    onSave: v => { const changed = (v.drive || 'chain') !== (S.bike.drive || 'chain') || (v.cooling || 'liquid') !== (S.bike.cooling || 'liquid');
      Object.assign(S.bike, v); if (changed) { applyBuild(); syncItems(); setTimeout(() => toast('Service list updated for how your bike is built'), 500); } } });
}
function historySheet() {
  const sv = [...S.services].sort((a, b) => b.odo - a.odo); const spent = sv.reduce((s, x) => s + (+x.cost || 0), 0);
  openSheet('Service history', `${sv.length} services · ${money(spent, 0)} spent`, sv.length ? `<div class="list">${sv.map(s => `<button type="button" class="li" data-id="${s.id}">${statusDot('ok')}<span class="grow"><span class="t">${esc(s.items.map(id => (S.items.find(i => i.id === id) || {}).name).filter(Boolean).join(', ') || 'Service')}</span><span class="s">${fmtD(s.date)} · ${num(s.odo)} km${s.shop ? ' · ' + esc(s.shop) : ''}</span></span><span class="r">${s.cost ? money(s.cost, 0) : ''}</span></button>`).join('')}</div>` : '<div class="empty">Every service you log lands here, with parts and cost.</div>',
    sh => $$('.li', sh).forEach(b => b.onclick = () => serviceForm(S.services.find(x => x.id === b.dataset.id))));
}
function fuelHistSheet() {
  const list = [...S.fuel].sort((a, b) => b.odo - a.odo), fs = fuelStats();
  openSheet('Fill-ups', `${list.length} fill-ups · ${money(fs.cost, 0)} total${fs.kpl ? ' · ' + num(fs.kpl, 1) + ' km/L' : ''}`, list.length ? `<div class="list">${list.map((f, i) => { const prev = list[i + 1], d = prev ? f.odo - prev.odo : null, k = f.full && prev && d > 0 && f.litres ? d / f.litres : null;
    return `<button type="button" class="li" data-id="${f.id}">${statusDot(f.full ? 'ok' : 'soon')}<span class="grow"><span class="t">${num(f.litres, 2)} L${f.station ? ' · ' + esc(f.station) : ''}</span><span class="s">${fmtD(f.date)} · ${num(f.odo)} km${d ? ` · +${num(d)} km` : ''}${k ? ` · ${num(k, 1)} km/L` : ''}${f.full ? '' : ' · partial'}</span></span><span class="r">${f.cost ? money(f.cost) : ''}</span></button>`; }).join('')}</div>` : '<div class="empty">Log fills with the odometer reading. Or say “Hey Siri, log fuel” at the pump once auto-log is set up.</div>',
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
    $('#exp', sh).onclick = () => { S.stats.exports++; save(); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(S)], { type: 'application/json' })); a.download = `redline-backup-${todayISO()}.json`; document.body.appendChild(a); a.click(); a.remove(); toast('Backup downloaded'); celebrate(); };
    $('#imp', sh).onclick = () => $('#impIn', sh).click();
    $('#impIn', sh).onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { const d = JSON.parse(r.result); if (d.v !== 3 || !d.bike) throw 0; S = Object.assign(fresh(), d); save(); closeSheet(); if (window.W) W.setBike(S.bike.type, true); refresh(); toast('Backup restored'); } catch (err) { toast('That file isn’t a Redline backup', 'over'); } }; r.readAsText(f); };
    const w = $('#wipe', sh); w.onclick = () => { if (!w.dataset.sure) { w.dataset.sure = 1; w.textContent = 'Tap again to wipe everything'; return; } localStorage.removeItem(KEY); location.reload(); };
  });
}
function autoLogSheet() {
  const base = location.origin + location.pathname;
  openSheet('Auto-log rides', 'Your intercom connecting starts a ride; disconnecting ends it. The screen stays off, so it barely uses battery.', `
  <div class="warn">First add Redline to your Home Screen: in Safari tap Share, then Add to Home Screen.</div>
  <ol class="steps">
    <li><b>When your intercom connects</b><br>Shortcuts → Automation → New → Bluetooth → your intercom → Is Connected → Run Immediately.<br>Actions: Get Current Location → Format Date (Current Date, ISO 8601, include time) → Text:
      <div class="code">slat=[Latitude]&amp;slon=[Longitude]&amp;st=[Formatted Date]</div>→ Save File to <b>Shortcuts/redline-start.txt</b>, overwrite on.</li>
    <li><b>When it disconnects</b> (Is Disconnected → Run Immediately)<br>Get File redline-start.txt → Get Current Location → Format Date (ISO 8601) → URL:
      <div class="code">${esc(base)}?evt=ride&amp;[File]&amp;elat=[Latitude]&amp;elon=[Longitude]&amp;et=[Formatted Date]</div>→ Open URLs. Redline opens after you park and shows the ride.</li>
    <li><b>“Hey Siri, mark this spot”</b>: Get Current Location → Dictate Text → open
      <div class="code">${esc(base)}?evt=mark&amp;lat=[Latitude]&amp;lon=[Longitude]&amp;note=[Dictated Text]</div>Marked spots also become route points, which fixes loop rides.</li>
    <li><b>“Hey Siri, log fuel”</b>: Ask for Number three times (odometer, litres, cost) → open
      <div class="code">${esc(base)}?evt=fuel&amp;odo=[Odo]&amp;litres=[Litres]&amp;cost=[Cost]</div></li>
  </ol>
  <div class="note">Connections shorter than ${S.minMin} minutes only save where you parked. Distance comes from road routing, then gets corrected against your real odometer at every fill-up.</div>
  <div class="btns"><button type="button" class="btn" id="test">Send a test ride</button></div>`, sh => { $('#test', sh).onclick = () => { closeSheet(); const n = Date.now();
    history.replaceState(null, '', `${location.pathname}?evt=ride&slat=1.3526&slon=103.9447&st=${encodeURIComponent(new Date(n - 34 * 6e4).toISOString())}&elat=1.3329&elon=103.7436&et=${encodeURIComponent(new Date(n).toISOString())}`); processURL(); }; });
}


/* ================= parts: big animated art, "Done today" services it in front of you ================= */
function doneToday(it, btn) {
  const odo = estOdo(); if (odo == null) { toast('Add an odometer reading first', 'over'); return; }
  S.services.push({ id: uid(), date: todayISO(), odo, items: [it.id], cost: null, shop: '', notes: '' }); syncItems(); save();
  const scope = btn && (btn.closest('.card') || btn.closest('.sheet') || btn.closest('.tile'));
  ART.renew(scope && scope.querySelector('svg.art'));
  if (btn) { btn.classList.add('ok'); btn.animate([{ transform: 'scale(.8)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { duration: 450, easing: 'ease-out' }); }
  toast(`${it.name} · done at ${num(odo)} km`); celebrate();
  setTimeout(() => { if (sheetEl.classList.contains('on') && $('.pblock', sheetEl)) { const k = $('.pblock', sheetEl).dataset.part; $('.pblock', sheetEl).outerHTML = partBlock(k, PARTS.find(p => p[0] === k)[1]); wireParts(sheetEl); } refresh(); }, 1500);
}
function partBlock(k, label) {
  const items = S.items.filter(i => i.part === k); if (!items.length && k !== 'other') return '';
  return `<div class="pblock" data-part="${k}">${items.map(i => { const s = itemStatus(i);
    return `<div class="pi"><button type="button" class="pmain" data-edit="${i.id}">${statusDot(s.cls)}<span class="grow"><span class="t">${esc(i.name)}</span><span class="s">${s.text}${i.km || i.months ? ' · every ' + [i.km ? num(i.km) + ' km' : '', i.months ? i.months + ' mo' : ''].filter(Boolean).join(' / ') : ''}</span>
      <span class="bar ${s.cls}"><i style="width:${Math.round(s.frac * 100)}%"></i></span></span></button><button type="button" class="done" data-done="${i.id}">${ic('check', 3)}<span>Done<br>today</span></button></div>`; }).join('')}
    <button type="button" class="addit" data-add="${k}">+ Add an item</button></div>`;
}
function wireParts(sh) {
  $$('[data-done]', sh).forEach(b => b.onclick = () => doneToday(S.items.find(x => x.id === b.dataset.done), b));
  $$('[data-edit]', sh).forEach(b => b.onclick = () => itemForm(S.items.find(x => x.id === b.dataset.edit)));
  $$('[data-add]', sh).forEach(b => b.onclick = () => itemForm(null, b.dataset.add));
}
function partSheet(k) {
  const label = (PARTS.find(p => p[0] === k) || [k, k])[1], p = partInfo(k);
  openSheet(label, '', `<div class="part-hero ${p.cls}">${ART.art(k, p.f, p.cls, 190)}<div class="pv"><b>${p.w ? bigVal(p.w.s) : '—'}</b><span>${p.w ? esc(p.w.i.name) : 'Not tracked yet'}</span></div></div>${partBlock(k, label)}`, sh => {
    wireParts(sh); const a = $('.part-hero svg', sh); if (a && !RM) a.animate([{ transform: 'scale(.4) rotate(-20deg)', opacity: 0 }, { transform: 'scale(1.08) rotate(4deg)', opacity: 1, offset: .7 }, { transform: 'none' }], { duration: 650, easing: 'cubic-bezier(.2,1,.3,1)' });
  });
}

/* ================= fuel light ================= */
function fuelLight() {
  const fs = fuelStats();
  if (fs.light) { S.fuelLight = null; save(); refresh(); toast('Fuel light cleared'); return; }
  form({ title: 'Fuel light on?', lede: `Range resets to your reserve (${num(S.bike.reserve || 2.5, 1)} L) and counts down from here.`,
    fields: [{ k: 'odo', l: 'Odometer now (km)', type: 'number', v: estOdo() ?? '', req: 1 }], cta: 'Fuel light’s on',
    onSave: v => { S.fuelLight = { odo: v.odo, date: todayISO() }; if (v.odo > (estOdo() || 0)) S.odoLog.push({ id: uid(), date: todayISO(), odo: v.odo }); toast('Counting down from reserve');
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
    <div class="plus2"><button type="button" class="mrow" data-go="wrap"><span class="mi">${ic('play')}</span><span class="grow"><b>Ride Wrap</b><span>Your month as a story</span></span>${ic('chev')}</button><button type="button" class="mrow" data-go="spots"><span class="mi">${ic('pin')}</span><span class="grow"><b>Marked spots</b><span>Places you saved mid-ride</span></span>${ic('chev')}</button></div>`,
    sh => $$('[data-go]', sh).forEach(b => b.onclick = () => ACTIONS[b.dataset.go]()));
}
const ACTIONS = { fuel: () => fuelForm(), ride: () => rideForm(), service: () => serviceForm(), odo: odoForm, history: historySheet, spots: spotsSheet, renewals: () => renewalsSheet(), wrap: () => { closeSheet(); WRAP.open(); },
  light: fuelLight, roads: () => trafficSheet(), relay: () => relaySheet() };

/* ================= renewals: renewed it? set the new date and it goes quiet again ================= */
function renewedForm(r) {
  if (!r) return; const d = new Date((r.date || todayISO()) + 'T12:00'); d.setFullYear(d.getFullYear() + (/coe/i.test(r.name) ? 10 : 1));
  form({ title: `${esc(r.name)} renewed`, lede: 'Set the new expiry date. It will show up on Home again when it’s close.', fields: [{ type: 'row', f: [{ k: 'date', l: 'New expiry', type: 'date', v: todayISO(d), req: 1 }, { k: 'cost', l: 'Paid ($)', type: 'number', v: r.cost }] }], cta: 'Save',
    onSave: v => { Object.assign(r, v); toast(`${r.name} sorted until ${fmtD(r.date)}`); } });
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
  const learned = learnedRoads();
  openSheet('Your roads', 'Jams and accidents on these show up on Home. Redline also learns roads from your rides.', `<form id="tf">${roadChips(S.roads || [])}
    ${learned.length ? `<div class="note">Learned from your rides: <b>${learned.join(', ')}</b></div>` : ''}
    <div class="sep"></div><div class="bl">Or let Redline find them</div>${routeFinder()}
    <div class="btns"><button class="btn">Save</button></div></form>
    <div class="sep"></div><button type="button" class="mrow" id="toRelay"><span class="mi">${ic('alert')}</span><span class="grow"><b>Live alerts</b><span>${S.relay ? 'On · from LTA' : 'Off · free one-time setup'}</span></span>${ic('chev')}</button>`, sh => {
    wire(sh); wireFinder(sh);
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
    ['autolog', 'head', 'Auto-log rides', S.intercom && S.intercom !== 'none' ? `${S.intercom} · rides log themselves` : 'Set up with Shortcuts'],
    ['roads', 'alert', 'Traffic', `${myRoads().length ? myRoads().map(r => r === 'WDL' ? 'Causeway' : r === 'TUAS' ? '2nd Link' : r).join(', ') : 'Pick your roads'} · ${S.relay ? 'alerts on' : 'alerts off'}`],
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
const WORKER = `export default {
  async fetch(req, env) {
    const path = new URL(req.url).searchParams.get('path') || 'TrafficIncidents';
    if (!/^[A-Za-z]+$/.test(path)) return new Response('Bad path', { status: 400 });
    const r = await fetch('https://datamall2.mytransport.sg/ltaodataservice/' + path,
      { headers: { AccountKey: env.LTA_KEY, accept: 'application/json' } });
    return new Response(await r.text(), { headers: {
      'content-type': 'application/json', 'access-control-allow-origin': '*' } });
  }
};`;
function relaySheet() {
  openSheet('Traffic alerts', 'Accidents and breakdowns from LTA, shown only when they’re on roads you actually ride. It needs a free LTA key and a tiny free relay. One-time setup, about 10 minutes.', `
  <ol class="steps">
    <li><b>Get an LTA key.</b> Sign up for LTA DataMall (free). Your AccountKey arrives by email.</li>
    <li><b>Make a free Cloudflare Worker.</b> At dash.cloudflare.com: Workers &amp; Pages → Create → Worker. Replace its code with this:
      <pre class="code" id="wcode">${esc(WORKER)}</pre><button type="button" class="btn ghost sm" id="copyW">Copy code</button></li>
    <li><b>Add your key.</b> In the Worker: Settings → Variables → add a secret named <b>LTA_KEY</b> with your AccountKey. Deploy.</li>
    <li><b>Paste the Worker’s address below</b>, for example https://redline.yourname.workers.dev</li>
  </ol>
  <form id="rf">${F({ k: 'relay', l: 'Worker address', v: S.relay, ph: 'https://…workers.dev' })}<div class="btns">${S.relay ? '<button type="button" class="btn danger" id="roff" style="flex:.6">Turn off</button>' : ''}<button class="btn">Save and test</button></div></form>`, sh => {
    $('#copyW', sh).onclick = async e => { try { await navigator.clipboard.writeText(WORKER); e.target.textContent = 'Copied'; } catch (err) { const r = document.createRange(); r.selectNodeContents($('#wcode', sh)); getSelection().removeAllRanges(); getSelection().addRange(r); e.target.textContent = 'Selected, copy it'; } };
    $('#rf', sh).onsubmit = async e => { e.preventDefault(); const u = read(e.target).relay; if (!/^https:\/\//.test(u)) { toast('Paste the https:// address of your Worker', 'over'); return; }
      try { const j = await getJSON(u.replace(/\/$/, '') + '?path=TrafficIncidents'); if (!j || !('value' in j)) throw 0; S.relay = u; save(); closeSheet(); toast(`Connected · ${j.value.length} incidents island-wide right now`); loadLive(true); }
      catch (err) { toast('Couldn’t reach it. Check the address and the LTA_KEY secret.', 'over'); } };
    if ($('#roff', sh)) $('#roff', sh).onclick = () => { S.relay = ''; save(); closeSheet(); LIVE.inc = null; paintLive(); toast('Traffic alerts off'); };
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
const MORE = { bike: bikeForm, renewals: renewalsSheet, autolog: autoLogSheet, relay: relaySheet, roads: trafficSheet, badges: badgesSheet, sound: soundSheet, backup: backupSheet, demo: demoSheet };

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
let step = 0, setupSvc = 'fresh';
const STEPS = [
  { k: 'Welcome', h: 'Let’s set up your bike', p: 'Redline keeps your bike’s service, fuel, renewals and rides in one place, and can log rides on its own. Setup takes about a minute.', cta: 'Begin', place: 0 },
  { k: 'Step 1 of 6', h: 'How is it built?', p: 'This decides which parts Redline tracks. Not sure? Look at the rear wheel and the front of the engine.', custom: 'build' },
  { k: 'Step 2 of 6', h: 'Name your ride', p: 'You can change these any time in Settings.', place: 2, fields: () => bikeFields(S.bike), save: v => { if (!v.name) { toast('Give your bike a nickname', 'over'); return false; } Object.assign(S.bike, v); } },
  { k: 'Step 3 of 6', h: 'Odometer and last service', p: 'The starting point for every countdown. Rough is fine.', place: 0, custom: 'service' },
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
  if (st.custom === 'service') body = F({ k: 'odo', l: 'Odometer now (km)', type: 'number', v: estOdo() ?? '', ph: '18420', req: 1 }) + `<button type="button" class="choice ${setupSvc === 'fresh' ? 'on' : ''}" data-c="fresh"><span><b>Just serviced, or start fresh</b><span>Every countdown starts from today</span></span></button>
    <button type="button" class="choice ${setupSvc === 'known' ? 'on' : ''}" data-c="known"><span><b>I know my last service</b><span>Enter the km and what was done</span></span></button>
    <div id="svcKnown" ${setupSvc === 'known' ? '' : 'hidden'}>${[{ type: 'row', f: [{ k: 'sdate', l: 'Date', type: 'date', v: todayISO() }, { k: 'sodo', l: 'At odometer (km)', type: 'number', v: '' }] }, { k: 'sitems', l: 'What was done', type: 'chips', multi: 1, o: S.items.map(i => ({ v: i.id, l: i.name })), v: S.items.slice(0, 2).map(i => i.id) }].map(F).join('')}</div>`;
  if (st.custom === 'build') { const art = { chain: 'chain', belt: 'belt', shaft: 'final', liquid: 'coolant', air: 'fins' };
    const grp = (g, list, cur) => `<div class="bgroup"><div class="bl">${g === 'drive' ? 'Rear wheel driven by' : 'Engine cooling'}</div>${list.map(([v, b, sub]) => `<button type="button" class="choice build ${cur === v ? 'on' : ''}" data-g="${g}" data-c="${v}">${ART.art(art[v], 1, 'ok', 58)}<span><b>${b}</b><span>${sub}</span></span></button>`).join('')}</div>`;
    body = grp('drive', DRIVES, S.bike.drive || 'chain') + grp('cooling', COOLS, S.bike.cooling || 'liquid'); }
  if (st.custom === 'roads') body = roadChips(S.roads || []) + `<div class="sep"></div><div class="bl">Or let Redline find them</div>` + routeFinder();
  if (st.custom === 'intercom') body = [['Cardo', 'Cardo', 'Packtalk, Freecom, Spirit'], ['Other', 'Another intercom', 'Sena, Shoei, any Bluetooth'], ['none', 'No intercom', 'Log rides with a tap']].map(([v, b, s]) => `<button type="button" class="choice ${S.intercom === v ? 'on' : ''}" data-c="${v}"><span><b>${b}</b><span>${s}</span></span></button>`).join('');
  panel.innerHTML = `<div class="prog">${STEPS.map((_, i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div><div class="k">${st.k}</div><h1>${st.h}</h1><p class="lede">${st.p}</p>
    <form id="sform">${body}</form><div class="btns">${step > 0 ? '<button type="button" class="btn ghost sm" id="sBack">Back</button>' : ''}${st.skip ? '<button type="button" class="btn ghost sm" id="sSkip">Skip</button>' : ''}<button type="button" class="btn" id="sNext">${step === STEPS.length - 1 ? 'Start riding' : st.cta || 'Continue'}</button></div>`;
  panel.scrollTop = 0; wire(panel);
  $$('.choice', panel).forEach(c => c.onclick = () => { if (c.dataset.g) { $$(`.choice[data-g="${c.dataset.g}"]`, panel).forEach(x => x.classList.remove('on')); c.classList.add('on'); haptic(); S.bike[c.dataset.g] = c.dataset.c; return; }
    $$('.choice', panel).forEach(x => x.classList.remove('on')); c.classList.add('on'); haptic();
    if (st.custom === 'service') { setupSvc = c.dataset.c; $('#svcKnown', panel).hidden = setupSvc !== 'known'; } else S.intercom = c.dataset.c; });
  panel.onpick = null; panel.addEventListener('pick', e => { const f = e.target.closest('[data-k=type]'); if (!f) return; const v = read(panel).type; if (v) { S.bike.type = v; if (window.W) W.setBike(v); } });
  if (st.custom === 'roads') wireFinder(panel);
  $('#sBack', panel) && ($('#sBack', panel).onclick = () => { step--; renderStep(); });
  $('#sSkip', panel) && ($('#sSkip', panel).onclick = () => { step++; renderStep(); });
  $('#sNext', panel).onclick = nextStep; $('#sform', panel).onsubmit = e => { e.preventDefault(); nextStep(); };
}
function nextStep() {
  const st = STEPS[step], v = read($('#sform'));
  if (st.save && st.save(v) === false) return;
  if (st.custom === 'service') {
    if (v.odo == null || isNaN(v.odo)) { toast('Add your odometer reading', 'over'); return; }
    S.odoLog = S.odoLog.filter(o => !o.setup); S.odoLog.push({ id: uid(), date: todayISO(), odo: v.odo, setup: true });
    if (setupSvc === 'fresh') S.items.forEach(i => { i.lastOdo = v.odo; i.lastDate = todayISO(); i.base = true; });
    else { if (v.sodo == null || isNaN(v.sodo)) { toast('Add the odometer at that service', 'over'); return; } S.services.push({ id: uid(), date: v.sdate || todayISO(), odo: v.sodo, items: v.sitems, cost: null, shop: '', notes: 'Added during setup' }); syncItems(); }
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
  Object.assign(S.bike, { name: 'Black Mamba', model: 'Honda CB650R', plate: 'FBK1234X', type: 'naked', tank: 15, licence: '2' });
  S.odoLog.push({ id: uid(), date: D(40), odo: 17400 });
  S.services.push({ id: uid(), date: D(40), odo: 17400, items: S.items.map(i => i.id), cost: 280, shop: 'Ah Huat Motor', notes: 'Full service' });
  S.services.push({ id: uid(), date: D(14), odo: 17980, items: [S.items[2].id], cost: 0, shop: 'DIY', notes: '' });
  [[D(30), 17650, 13.4, 38.2], [D(19), 18010, 12.1, 34.9], [D(3), 18390, 12.8, 37.1]].forEach(([date, odo, litres, cost]) => S.fuel.push({ id: uid(), date, odo, litres, cost, full: true, station: 'Shell' }));
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
  R0.forEach(([title, k, d, mood], i) => { const t0 = now - d * 864e5 - i * 37e5, path = smooth(P[k]); S.rides.push({ id: uid(), title, km: len(path), path, roads: RD[k] || [], start: { t: t0 }, end: { t: t0 + Math.round(len(path) * 1.8) * 6e4 }, src: 'manual', mood, note: '' }); });
  const R = S.renewals; R[0].date = D(-24); R[1].date = D(-148); R[2].date = D(-1680); R[3].date = D(-210);
  S.parked = { lat: 1.3521, lon: 103.8198, t: now - 3 * 36e5 };
  S.roads = ['ECP', 'TPE']; S.demoInc = true; S.intercom = 'Cardo'; S.setupDone = true; syncItems(); save();
}


(function boot() {
  if (window.PREVIEW) seedPreview();
  syncWorld(); applyLite();
  const sp = $('#splash');
  const start = () => { if (sp) sp.classList.add('out'); if (!S.setupDone) startSetup(); else { render(true); processURL(); } };
  // wait for fonts so the big numbers don't jump, but never more than a moment
  Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise(r => setTimeout(r, 900))]).then(() => setTimeout(start, 250));
  loadLive();
  setInterval(() => { if (!document.hidden && S.setupDone) loadLive(); }, 6e5);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S.setupDone) { loadLive(); if (!sheetEl.classList.contains('on')) refresh(); } });
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
