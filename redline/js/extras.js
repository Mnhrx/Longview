/* Redline extras: rain on your commute, rainy-ride chain care, fuel economy watch, upcoming costs, JB savings,
   S$ per litre by brand, tyre pressure, licence upgrades, warranties, workshops, weekly goal, sell-my-bike link.
   Loaded before app.js; the screens it opens use app.js helpers (openSheet, form…) at the time they're used. */

/* ================= weather data (NEA via data.gov.sg, free, no key) ================= */
const sgt = t => { const d = new Date(t + 8 * 3600e3); return d.toISOString().slice(0, 19); }; // Singapore local time, for the API
async function nearRainfall(t) { // { stations:[{lat,lon,name}], val:{id:mm} } for now (or a past moment)
  const parse1 = j => ({ st: (j.metadata.stations || []).map(s => ({ id: s.id, name: s.name, lat: s.location.latitude, lon: s.location.longitude })), rd: Object.fromEntries(((j.items[0] || {}).readings || []).map(r => [r.station_id, +r.value])) });
  const parse2 = j => { const d = j.data; const last = (d.readings || [])[0] || {}; return { st: (d.stations || []).map(s => ({ id: s.id, name: s.name, lat: s.location.latitude, lon: s.location.longitude })), rd: Object.fromEntries((last.data || []).map(r => [r.stationId, +r.value])) }; };
  if (t) { try { return parse1(await getJSON('https://api.data.gov.sg/v1/environment/rainfall?date_time=' + sgt(t))); } catch (e) { return parse2(await getJSON('https://api-open.data.gov.sg/v2/real-time/api/rainfall?date=' + sgt(t))); } }
  try { return parse2(await getJSON('https://api-open.data.gov.sg/v2/real-time/api/rainfall')); } catch (e) { return parse1(await getJSON('https://api.data.gov.sg/v1/environment/rainfall')); }
}
async function twoHour() { // [{name, lat, lon, text}]
  try { const j = await getJSON('https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast'), d = j.data, fc = d.items[0].forecasts;
    return d.area_metadata.map(m => { const f = fc.find(x => x.area === m.name) || {}; return { name: m.name, lat: m.label_location.latitude, lon: m.label_location.longitude, text: typeof f.forecast === 'string' ? f.forecast : ((f.forecast || {}).text || '') }; }); }
  catch (e) { const j = await getJSON('https://api.data.gov.sg/v1/environment/2-hour-weather-forecast'), fc = j.items[0].forecasts;
    return j.area_metadata.map(m => { const f = fc.find(x => x.area === m.name) || {}; return { name: m.name, lat: m.label_location.latitude, lon: m.label_location.longitude, text: f.forecast || '' }; }); }
}
const nearPath = (path, p, km) => path.some(q => haversine({ lat: q[0], lon: q[1] }, p) < km);

/* ---------- rain on your commute ---------- */
// your commute = home → work along the roads, saved by Traffic & commute. Checked against NEA's 2-hour forecast and live rain gauges.
const COMMUTE = { r: null, busy: false };
function commuteWindow() { const c = S.commuteTimes || { am: '08:00', pm: '18:00' }, n = new Date(), mins = n.getHours() * 60 + n.getMinutes();
  for (const [k, v] of Object.entries(c)) { if (!v) continue; const [h, m] = v.split(':').map(Number), at = h * 60 + m; if (mins >= at - 75 && mins <= at + 30) return { k, at: v, to: k === 'am' ? 'work' : 'home' }; } return null; }
async function checkCommute(force) {
  if (!S.commute || !S.commute.length || COMMUTE.busy) return COMMUTE.r; if (!force && COMMUTE.r && Date.now() - COMMUTE.r.t < 8 * 6e4) return COMMUTE.r;
  if (window.PREVIEW) { COMMUTE.r = { t: Date.now(), wet: ['Kallang', 'Geylang'], now: ['Paya Lebar'], text: 'Showers' }; return COMMUTE.r; }
  COMMUTE.busy = true;
  try { const [fc, rf] = await Promise.all([twoHour().catch(() => []), nearRainfall().catch(() => null)]);
    const wet = fc.filter(a => /rain|shower|thunder|drizzle/i.test(a.text) && nearPath(S.commute, a, 3)).map(a => a.name);
    const now = rf ? rf.st.filter(s => (rf.rd[s.id] || 0) > 0 && nearPath(S.commute, s, 2)).map(s => s.name) : [];
    COMMUTE.r = { t: Date.now(), wet, now, text: (fc.find(a => wet.includes(a.name)) || {}).text || '' };
  } catch (e) { COMMUTE.r = { t: Date.now(), err: true, wet: [], now: [] }; }
  COMMUTE.busy = false; return COMMUTE.r;
}
function commuteLine() { const r = COMMUTE.r; if (!S.commute || !r || r.err) return '';
  const rain = r.now.length || r.wet.length;
  return `<div class="cline ${rain ? 'wet' : 'dry'}">${ic(rain ? 'rain' : 'check', 2.4)}<span>${rain ? `<b>Commute:</b> ${r.now.length ? 'raining now near ' + r.now.slice(0, 2).join(', ') : (r.text || 'rain') + ' expected near ' + r.wet.slice(0, 3).join(', ')}` : '<b>Commute:</b> dry for the next 2 hours'}</span></div>`; }

/* ---------- rode in the rain → look after the chain ---------- */
async function checkWetRides() {
  if (window.PREVIEW) return false; let changed = false;
  for (const r of S.rides.filter(r => r.end && r.path && r.path.length > 1 && r.wet == null && Date.now() - r.end.t < 2 * DAY && Date.now() - r.end.t > 15 * 6e4).slice(-3)) {
    if (r.mood === 'Rainy') { r.wet = true; changed = true; continue; }
    try { const mid = (r.start.t + r.end.t) / 2, rf = await nearRainfall(mid), pts = r.path.filter((_, i) => i % Math.max(1, Math.floor(r.path.length / 20)) === 0);
      r.wet = rf.st.some(s => (rf.rd[s.id] || 0) >= .2 && nearPath(pts, s, 2)); changed = true; } catch (e) {}
  }
  if (changed) save(); return changed;
}
function wetRide() { if ((S.bike.drive || 'chain') !== 'chain') return null; const r = [...S.rides].filter(x => x.end && (x.wet || x.mood === 'Rainy') && !x.wetDone && Date.now() - x.end.t < 3 * DAY).sort((a, b) => b.end.t - a.end.t)[0];
  if (!r) return null; const lube = S.items.find(i => /chain clean/i.test(i.name)); if (lube && lube.lastDate && +new Date(lube.lastDate + 'T23:59') >= r.end.t) return null; return { r, lube }; }

/* ================= fuel & money ================= */
// km/L between full tanks, oldest first
function econSegments() { const f = [...S.fuel].sort((a, b) => a.odo - b.odo), out = []; let a = null, L = 0;
  for (const x of f) { if (a) L += +x.litres || 0; if (x.full) { if (a && x.odo > a.odo && L > 0) out.push({ kpl: (x.odo - a.odo) / L, date: x.date, km: x.odo - a.odo }); a = x; L = 0; } } return out; }
// a drop of 10%+ over the last two tanks against your usual is worth a look
function econWatch() { const s = econSegments().filter(x => x.km > 40); if (s.length < 4) return null;
  const base = s.slice(0, -2).map(x => x.kpl).sort((a, b) => a - b), med = base[Math.floor(base.length / 2)], rec = (s[s.length - 1].kpl + s[s.length - 2].kpl) / 2;
  return rec < med * .9 ? { med, rec, drop: Math.round((1 - rec / med) * 100) } : null; }
// average km a day lately (for "when will it be due")
function kmPerDay() { const k = kmBetween(Date.now() - 60 * DAY, Date.now()); return k > 30 ? k / 60 : 20; }
function upcomingCosts(days = 90) {
  const odo = estOdo(), rate = kmPerDay(), out = [];
  for (const it of S.items) { let inDays = null;
    if (it.km && it.lastOdo != null && odo != null) inDays = (it.lastOdo + it.km - odo) / rate;
    if (it.months && it.lastDate) { const d = new Date(it.lastDate + 'T12:00'); d.setMonth(d.getMonth() + it.months); const md = (d - Date.now()) / DAY; inDays = inDays == null ? md : Math.min(inDays, md); }
    if (inDays == null || inDays > days) continue; const lc = itemCost(it);
    out.push({ name: it.name, days: Math.round(inDays), cost: lc && lc.solo ? lc.cost : null, guess: !lc || !lc.solo }); }
  for (const r of S.renewals) { if (!r.date || /helmet/i.test(r.name)) continue; const d = renewStatus(r).days; if (d <= days) out.push({ name: r.name, days: d, cost: +r.cost || null, renewal: true }); }
  out.sort((a, b) => a.days - b.days); return { list: out, total: out.reduce((s, x) => s + (x.cost || 0), 0), unknown: out.filter(x => !x.cost).length };
}
// filling up in JB vs what you pay per litre at home
function jbSavings(from = periodRange('year')[0]) {
  const recent = S.fuel.filter(f => f.cur !== 'MYR' && +f.cost > 0 && +f.litres > 0 && +new Date(f.date) > Date.now() - 180 * DAY), L = recent.reduce((s, f) => s + +f.litres, 0);
  if (!L) return null; const sg = recent.reduce((s, f) => s + +f.cost, 0) / L;
  const jb = S.fuel.filter(f => f.cur === 'MYR' && +f.cost > 0 && +f.litres > 0 && +new Date(f.date + 'T12:00') >= from);
  if (!jb.length) return null; const saved = jb.reduce((s, f) => s + f.litres * (sg - fuelSgd(f) / f.litres), 0), jbL = jb.reduce((s, f) => s + +f.litres, 0);
  return { saved, n: jb.length, sg, jb: jb.reduce((s, f) => s + fuelSgd(f), 0) / jbL }; }
// what you've paid per litre at each brand (last 90 days, S$ fill-ups only; there's no official pump-price feed)
function brandPrices() { const m = {};
  S.fuel.filter(f => f.station && f.cur !== 'MYR' && +f.cost > 0 && +f.litres > 0 && +new Date(f.date) > Date.now() - 90 * DAY).forEach(f => { const b = m[f.station] || (m[f.station] = { n: 0, L: 0, c: 0, last: null }); b.n++; b.L += +f.litres; b.c += +f.cost; if (!b.last || f.date > b.last.date) b.last = f; });
  return Object.entries(m).map(([name, b]) => ({ name, n: b.n, avg: b.c / b.L, last: b.last.cost / b.last.litres, date: b.last.date })).sort((a, b) => a.avg - b.avg); }

/* ================= tyres ================= */
const lastTyres = () => (S.tyres || []).slice().sort((a, b) => b.t - a.t)[0] || null;
function tyreDue() { const t = lastTyres(); if (!t) return null; const d = (Date.now() - t.t) / DAY; return d >= 7 ? Math.floor(d) : null; }
function tyreLow(t = lastTyres()) { if (!t) return null; const f = +S.bike.psiF, r = +S.bike.psiR, low = [];
  if (f && t.front < f - 2) low.push(`front ${t.front} (should be ${f})`); if (r && t.rear < r - 2) low.push(`rear ${t.rear} (should be ${r})`); return low.length ? low : null; }
function tyreForm() {
  const t = lastTyres();
  form({ title: 'Tyre pressure', lede: 'Check them cold, before riding. A weekly check keeps grip, wear and fuel economy where they should be.',
    fields: [{ type: 'row', f: [{ k: 'front', l: 'Front (psi)', type: 'number', v: t ? t.front : S.bike.psiF || '', req: 1 }, { k: 'rear', l: 'Rear (psi)', type: 'number', v: t ? t.rear : S.bike.psiR || '', req: 1 }] },
      { type: 'row', f: [{ k: 'psiF', l: 'Recommended front', type: 'number', v: S.bike.psiF || '', ph: 'see manual' }, { k: 'psiR', l: 'Recommended rear', type: 'number', v: S.bike.psiR || '', ph: 'on the swingarm' }] }],
    check: v => (v.front < 15 || v.front > 50 || v.rear < 15 || v.rear > 50) ? 'Motorcycle tyres are usually 25–42 psi. Is that in psi, not bar or kPa?' : null,
    onSave: v => { S.bike.psiF = v.psiF || S.bike.psiF; S.bike.psiR = v.psiR || S.bike.psiR; S.tyres = [...(S.tyres || []), { id: uid(), t: Date.now(), front: v.front, rear: v.rear }].slice(-200);
      const low = tyreLow(); toast(low ? `Low: ${low.join(', ')}. Top up before riding` : 'Tyres logged'); } });
}
function tyreSheet() {
  const l = (S.tyres || []).slice().sort((a, b) => b.t - a.t);
  openSheet('Tyre pressure', S.bike.psiF ? `Recommended: front ${S.bike.psiF} · rear ${S.bike.psiR || '—'} psi. Redline reminds you after a week.` : 'Add your recommended pressures (owner’s manual, or the sticker on the swingarm) and Redline flags low readings.',
    `<div class="btns"><button type="button" class="btn" id="tyAdd">${ic('target', 2.2)} Log a check</button></div>
    ${l.length ? `<div class="list">${l.slice(0, 30).map(t => { const lo = tyreLow(t); return `<div class="li">${statusDot(lo ? 'soon' : 'ok')}<span class="grow"><span class="t">${t.front} / ${t.rear} psi</span><span class="s">${fmtDT(t.t)}${lo ? ' · low' : ''}</span></span><span class="r">F / R</span></div>`; }).join('')}</div>` : '<div class="empty">No checks yet.</div>'}`,
    sh => $('#tyAdd', sh).onclick = () => tyreForm());
}

/* ================= licence: when you can go for the next class ================= */
const LIC_NEXT = { '2B': '2A', '2A': '2' };
function licenceInfo() { const c = S.bike.licence, since = S.licSince; if (!c) return null;
  if (!LIC_NEXT[c]) return { cls: c, short: `Class ${c} · top class`, done: true };
  if (!since) return { cls: c, short: `Class ${c} · add when you passed` };
  const d = new Date(since + 'T12:00'); d.setFullYear(d.getFullYear() + 1); const days = Math.ceil((d - Date.now()) / DAY);
  return { cls: c, next: LIC_NEXT[c], date: todayISO(d), days, short: days > 0 ? `Class ${LIC_NEXT[c]} eligible in ${num(days)} days` : `Eligible for Class ${LIC_NEXT[c]} now` }; }
function licenceForm() {
  form({ title: 'Licence', lede: 'In Singapore you generally hold a class for at least a year before taking the next one (2B → 2A → 2). Check the exact rules with your driving centre.',
    fields: [{ k: 'licence', l: 'Your class', type: 'chips', o: ['2B', '2A', '2'].map(v => ({ v, l: 'Class ' + v })), v: S.bike.licence || '2B' }, { k: 'since', l: 'Date you passed it', type: 'date', v: S.licSince || '' }],
    onSave: v => { S.bike.licence = v.licence; S.licSince = v.since || ''; const i = licenceInfo(); toast(i ? i.short : 'Saved'); } });
}

/* ================= warranties & receipts (on expenses) ================= */
function warranties() { return (S.expenses || []).filter(x => x.warranty).map(x => ({ id: x.id, name: x.note || catOf(x.cat)[1], until: x.warranty, left: Math.ceil((new Date(x.warranty + 'T23:59') - Date.now()) / DAY), cost: expSgd(x), date: x.date, receipt: x.receipt })).sort((a, b) => a.left - b.left); }
function warrantySheet() {
  const w = warranties();
  openSheet('Warranties & receipts', 'Add a warranty date and receipt photo to any expense (tyres, battery, a helmet). Redline tells you if something is still covered.', `
    ${w.length ? `<div class="list">${w.map(x => `<button type="button" class="li" data-id="${x.id}">${statusDot(x.left < 0 ? 'unset' : x.left < 30 ? 'soon' : 'ok')}<span class="grow"><span class="t">${esc(x.name)}</span><span class="s">${x.left < 0 ? 'Expired ' + fmtD(x.until) : `Covered until ${fmtD(x.until)} · ${num(x.left)} days`}${x.receipt ? ' · receipt' : ''}</span></span><span class="r">${money(x.cost, 0)}</span></button>`).join('')}</div>` : '<div class="empty">Nothing with a warranty yet.</div>'}
    <div class="btns"><button type="button" class="btn" id="wAdd">+ Expense with warranty</button></div>`, sh => {
    $$('.li', sh).forEach(b => b.onclick = () => expenseForm(S.expenses.find(x => x.id === b.dataset.id)));
    $('#wAdd', sh).onclick = () => expenseForm(null, 'parts');
  });
}

/* ================= workshops (from your service history) ================= */
function workshops() { const m = {};
  for (const s of S.services) { const n = (s.shop || '').trim(); if (!n || /^diy$/i.test(n)) continue; const k = n.toLowerCase(); const w = m[k] || (m[k] = { name: n, visits: 0, total: 0, last: null, jobs: [] });
    w.visits++; w.total += +s.cost || 0; if (!w.last || s.date > w.last) w.last = s.date; w.jobs.push(s); }
  return Object.values(m).map(w => Object.assign(w, (S.shops || {})[w.name.toLowerCase()] || {})).sort((a, b) => (b.last || '').localeCompare(a.last || '')); }
const waLink = p => { const d = String(p || '').replace(/\D/g, ''); return d ? 'https://wa.me/' + (d.length === 8 ? '65' + d : d) : ''; };
function workshopsSheet() {
  const w = workshops();
  openSheet('Workshops', 'Built from the workshop names on your services. Add a number to message or call them in one tap.', w.length ? `<div class="list">${w.map((x, i) => `<div class="li wsrow"><span class="grow" data-i="${i}"><span class="t">${esc(x.name)}</span><span class="s">${x.visits} visit${x.visits > 1 ? 's' : ''} · ${money(x.total, 0)} · last ${fmtD(x.last)}</span></span>
      ${x.phone ? `<a class="minibtn" href="${waLink(x.phone)}" target="_blank" rel="noopener">WhatsApp</a><a class="minibtn dark" href="tel:${esc(x.phone)}">Call</a>` : `<button type="button" class="minibtn" data-ph="${i}">+ Number</button>`}</div>`).join('')}</div>` : '<div class="empty">Log a service with a workshop name and it shows up here.</div>', sh => {
    const edit = i => { const x = w[i]; form({ title: esc(x.name), lede: x.jobs.slice(0, 4).map(j => `${fmtD(j.date)}: ${money(j.cost || 0, 0)}`).join(' · '), fields: [{ k: 'phone', l: 'Phone (for WhatsApp and calls)', v: x.phone || '', ph: '9123 4567' }, { k: 'addr', l: 'Address or notes', v: x.addr || '', ph: 'Ubi Ave 1, opens 10am' }],
      onSave: v => { S.shops = S.shops || {}; S.shops[x.name.toLowerCase()] = { phone: v.phone, addr: v.addr }; } }); };
    $$('[data-ph]', sh).forEach(b => b.onclick = () => edit(+b.dataset.ph)); $$('.wsrow .grow', sh).forEach(b => b.onclick = () => edit(+b.dataset.i));
  });
}

/* ================= weekly goal & streaks ================= */
function weekStart(t = Date.now()) { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return +d; }
function weekKm(ws) { return S.rides.filter(r => r.start.t >= ws && r.start.t < ws + 7 * DAY).reduce((s, r) => s + (r.km || 0), 0); }
function streak() { const g = +S.goal || 0; let n = 0, ws = weekStart() - 7 * DAY; const ok = w => g ? weekKm(w) >= g : weekKm(w) > 0;
  while (ok(ws) && n < 200) { n++; ws -= 7 * DAY; } if (ok(weekStart())) n++; return n; }
function goalForm() { form({ title: 'Weekly goal', lede: 'A target for the week. Hit it week after week to build a streak; it shows on Rides and in your Wrap. Leave empty for a riding streak (any ride counts).', fields: [{ k: 'goal', l: 'km a week', type: 'number', v: S.goal || '', ph: '150' }],
  onSave: v => { S.goal = v.goal || null; toast(S.goal ? `Goal: ${S.goal} km a week` : 'Streak counts any week you ride'); } }); }

/* ================= sell-my-bike: the service record as a link (the data is inside the link, nothing is uploaded) ================= */
async function recordLink() {
  const D = exportData(), R = { b: D.bike, o: D.odo, d: D.today, i: D.items.map(x => [x.name, x.everyKm, x.everyMo, x.lastOdo, x.lastDate, x._st, x.left]), s: D.services.map(x => [x.date, x.odo, x.work, x.shop, x.cost, x.notes]), c: { y: Math.round(D.costs.year.total), s: Math.round(D.costs.all.by.service || 0) }, r: D.rides.length, k: D.rideKm };
  const raw = new TextEncoder().encode(JSON.stringify(R)); let bytes = raw, z = 0;
  if (window.CompressionStream) { bytes = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()); z = 1; }
  let b64 = ''; for (let i = 0; i < bytes.length; i += 32768) b64 += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
  b64 = btoa(b64).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const base = location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '');
  return `${base}record.html#${z ? 'z' : 'j'}=${b64}`;
}
async function shareRecord() {
  try { const url = await recordLink(), title = `${S.bike.name || 'My bike'} · service record`;
    if (navigator.share) { try { await navigator.share({ title, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    await navigator.clipboard.writeText(url); toast('Link copied. Paste it in WhatsApp or Carousell');
  } catch (e) { toast('Couldn’t make the link', 'over'); }
}
