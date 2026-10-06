/* ================================================================
   Redline UI — pages, sheets, guided setup, badges, Ride Wrap.
   ================================================================ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const hasGSAP = () => !!window.gsap && !reduceMotion;
const haptic = () => navigator.vibrate && navigator.vibrate(10);
const TABS = ['dash', 'rides', 'garage', 'fuel', 'more'];
let tab = 'dash', wheel = null, sub = { rides: 'journal', garage: 'intervals' };

/* ---------- theme ---------- */
function applyTheme() { const t = S.prefs.theme; if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t; $('meta[name=theme-color]').content = isDark() ? '#150A1C' : '#FFF4EE'; }
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

/* ---------- toast ---------- */
function toast(msg, icon = 'check', col = 'teal') {
  const t = $('#toast'); t.innerHTML = `${orb(icon, col)}<span>${esc(msg)}</span>`;
  t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2600);
}
function celebrateBadges() {
  const ups = checkBadges(); if (!ups.length) return;
  const { b, tier } = ups[ups.length - 1];
  setTimeout(() => { toast(`${['', 'Bronze', 'Silver', 'Gold'][tier]} badge: ${b[1]}`, b[2], b[3]); Burst.go('pop', innerWidth / 2, 80); Sound.chime(); }, 900);
}

/* ---------- count-up numbers ---------- */
function countUp(el, to, dec = 0, dur = 1) {
  if (!el || to == null || isNaN(to)) return;
  if (!hasGSAP()) { el.textContent = num(to, dec); return; }
  const o = { v: 0 }; gsap.to(o, { v: to, duration: dur, ease: 'power3.out', onUpdate: () => el.textContent = num(o.v, dec) });
}
function odoHTML(v) {
  if (v == null) return '<span class="muted" style="font-size:13px">Add an odo reading</span>';
  const col = '0<br>1<br>2<br>3<br>4<br>5<br>6<br>7<br>8<br>9';
  return String(v).padStart(6, '0').slice(-7).split('').map(d => `<b class="dg" data-d="${d}"><i>${col}</i></b>`).join('') + '<small>km</small>';
}
function rollOdo(root) { setTimeout(() => $$('.dg', root).forEach((b, i) => { b.firstChild.style.transitionDelay = (i * 70) + 'ms'; b.firstChild.style.transform = `translateY(-${b.dataset.d}em)`; }), 250); }

/* ---------- bottom sheet ---------- */
function openSheet(html, onOpen) {
  const sh = $('#sheet'); sh.innerHTML = '<div class="grab"></div>' + html; sh.scrollTop = 0;
  $('#scrim').classList.add('on'); sh.classList.add('on'); Sound.swoosh();
  Liquids.scan(sh); onOpen && onOpen(sh);
}
function closeSheet() { $('#scrim').classList.remove('on'); $('#sheet').classList.remove('on'); }
function fieldHTML(x) {
  if (x.type === 'row') return `<div class="two">${x.f.map(fieldHTML).join('')}</div>`;
  const v = x.v ?? '';
  const lab = x.l ? `<span>${x.l}</span>` : '';
  if (x.type === 'chips') {
    const sel = x.multi ? (v || []) : [v];
    return `<div class="fld" data-k="${x.k}" data-type="chips" data-multi="${x.multi ? 1 : ''}">${lab}<div class="chips">${x.o.map(o =>
      `<button type="button" class="chip ${o.icon ? '' : 'solo'} ${sel.includes(o.v) ? 'on' : ''}" data-v="${esc(o.v)}">${o.icon ? orb(o.icon, o.col || 'tang') : ''}${esc(o.l)}</button>`).join('')}</div></div>`;
  }
  if (x.type === 'swatch') return `<div class="fld" data-k="${x.k}" data-type="swatch">${lab}<div class="swatches">${x.o.map(c => `<button type="button" class="swatch ${c === v ? 'on' : ''}" data-v="${c}" style="background:radial-gradient(circle at 32% 28%,rgba(255,255,255,.8),transparent 35%),${c}"></button>`).join('')}</div></div>`;
  if (x.type === 'toggle') return `<div class="fld" data-k="${x.k}" data-type="toggle"><button type="button" class="toggle" style="width:100%">${x.l}<span class="sw ${v ? 'on' : ''}"></span></button></div>`;
  if (x.type === 'textarea') return `<label class="fld">${lab}<textarea name="${x.k}" placeholder="${esc(x.ph || '')}">${esc(v)}</textarea></label>`;
  return `<label class="fld">${lab}<input name="${x.k}" type="${x.type === 'number' ? 'text' : x.type || 'text'}" ${x.type === 'number' ? `inputmode="decimal" data-num="1"` : ''} value="${esc(v)}" placeholder="${esc(x.ph || '')}" ${x.req ? 'required' : ''} autocomplete="off"></label>`;
}
function wireFields(root) {
  $$('[data-type=chips]', root).forEach(f => f.addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return; haptic(); Sound.tap();
    if (f.dataset.multi) b.classList.toggle('on'); else { $$('.chip', f).forEach(c => c.classList.remove('on')); b.classList.add('on'); }
    if (hasGSAP()) gsap.fromTo(b, { scale: .88 }, { scale: 1, duration: .45, ease: 'back.out(3)' });
  }));
  $$('[data-type=swatch]', root).forEach(f => f.addEventListener('click', e => { const b = e.target.closest('.swatch'); if (!b) return; $$('.swatch', f).forEach(c => c.classList.remove('on')); b.classList.add('on'); Sound.tap(); f.dispatchEvent(new Event('pick', { bubbles: true })); }));
  $$('[data-type=toggle]', root).forEach(f => f.addEventListener('click', () => { $('.sw', f).classList.toggle('on'); Sound.tap(); }));
}
function readFields(root) {
  const v = {};
  $$('input[name],textarea[name]', root).forEach(i => { v[i.name] = i.dataset.num ? (i.value.trim() === '' ? null : parseFloat(i.value.replace(/[^\d.\-]/g, ''))) : i.value.trim(); });
  $$('[data-type=chips]', root).forEach(f => { const on = $$('.chip.on', f).map(c => c.dataset.v); v[f.dataset.k] = f.dataset.multi ? on : (on[0] ?? ''); });
  $$('[data-type=swatch]', root).forEach(f => v[f.dataset.k] = $('.swatch.on', f)?.dataset.v);
  $$('[data-type=toggle]', root).forEach(f => v[f.dataset.k] = $('.sw', f).classList.contains('on'));
  return v;
}
function openForm({ title, lede, icon, col, fields, cta = 'Save', onSave, onDelete }) {
  openSheet(`<div class="row" style="margin-bottom:6px">${icon ? orb(icon, col || 'tang', 'lg') : ''}<div class="grow"><h2>${title}</h2>${lede ? `<p class="lede muted" style="margin:0">${lede}</p>` : ''}</div></div>
    <form id="fm" style="margin-top:14px">${fields.map(fieldHTML).join('')}
    <div class="actions" style="margin-top:6px">${onDelete ? `<button type="button" class="btn ghost" id="fmDel" style="flex:.45">${ic('trash')}</button>` : ''}<button class="btn hot">${cta}</button></div></form>`, sh => {
    wireFields(sh);
    $('#fm').onsubmit = e => {
      e.preventDefault(); const v = readFields(e.target);
      for (const x of fields.flatMap(x => x.type === 'row' ? x.f : [x])) if (x.req && (v[x.k] == null || v[x.k] === '' || (typeof v[x.k] === 'number' && isNaN(v[x.k])))) { toast(`Add ${x.l.toLowerCase()}`, 'x', 'red'); return; }
      if (onSave(v) === false) return;
      closeSheet(); save(); refresh(); haptic(); celebrateBadges();
    };
    if (onDelete) $('#fmDel').onclick = () => { if (confirm('Delete this?')) { onDelete(); closeSheet(); save(); refresh(); } };
  });
}

/* ---------- actions ---------- */
const odoGuess = () => estOdo() ?? '';
const STATIONS = ['Shell', 'Esso', 'SPC', 'Caltex', 'Sinopec', 'Malaysia'].map(s => ({ v: s, l: s }));
const MOODS = [['Chill', 'wind', 'teal'], ['Spirited', 'fire', 'tang'], ['Rainy', 'rain', 'sky'], ['Night', 'moon', 'lilac'], ['Touring', 'mountain', 'candy'], ['Jammed', 'clock', 'grey']].map(([v, icon, col]) => ({ v, l: v, icon, col }));
function addFuel(e) {
  openForm({
    title: e ? 'Edit fill-up' : 'Fill-up', lede: 'The odo reading powers km/L, range and service countdowns.', icon: 'fuel', col: 'tang',
    fields: [{ type: 'row', f: [{ k: 'date', l: 'Date', type: 'date', v: e?.date || todayISO(), req: 1 }, { k: 'odo', l: 'Odometer (km)', type: 'number', v: e?.odo ?? odoGuess(), req: 1 }] },
      { type: 'row', f: [{ k: 'litres', l: 'Litres', type: 'number', v: e?.litres, req: 1 }, { k: 'cost', l: 'Cost ($)', type: 'number', v: e?.cost }] },
      { k: 'station', l: 'Station', type: 'chips', o: STATIONS, v: e?.station || '' },
      { k: 'full', l: 'Filled to a full tank', type: 'toggle', v: e ? e.full : true }],
    onSave: v => { if (e) Object.assign(e, v); else { S.fuel.push({ id: uid(), ...v }); setTimeout(() => { Burst.go(); Sound.splash(); }, 200); toast('Fill-up logged', 'fuel', 'tang'); } },
    onDelete: e && (() => S.fuel = S.fuel.filter(x => x !== e))
  });
}
function addService(e) {
  openForm({
    title: e ? 'Edit service' : 'Log a service', lede: 'Tick what was done. Those countdowns reset to this odo.', icon: 'wrench', col: 'sky',
    fields: [{ type: 'row', f: [{ k: 'date', l: 'Date', type: 'date', v: e?.date || todayISO(), req: 1 }, { k: 'odo', l: 'Odometer (km)', type: 'number', v: e?.odo ?? odoGuess(), req: 1 }] },
      { k: 'items', l: 'What was done', type: 'chips', multi: 1, o: S.items.map(i => ({ v: i.id, l: i.name, icon: i.icon, col: i.col })), v: e?.items || [] },
      { type: 'row', f: [{ k: 'cost', l: 'Cost ($)', type: 'number', v: e?.cost }, { k: 'shop', l: 'Workshop / DIY', v: e?.shop, ph: 'e.g. DIY' }] },
      { k: 'notes', l: 'Parts & notes', type: 'textarea', v: e?.notes, ph: 'Motul 7100 10W40, new chain…' }],
    onSave: v => {
      if (!v.items.length && !v.notes) { toast('Pick at least one item', 'x', 'red'); return false; }
      if (e) Object.assign(e, v); else { S.services.push({ id: uid(), ...v }); setTimeout(() => { Burst.go('big'); Sound.chime(); }, 200); toast('Service logged — countdowns reset', 'wrench', 'sky'); }
      syncItems();
    },
    onDelete: e && (() => { S.services = S.services.filter(x => x !== e); syncItems(); })
  });
}
function syncItems() {
  S.items.forEach(it => {
    const last = S.services.filter(s => s.items.includes(it.id)).sort((a, b) => b.odo - a.odo)[0];
    if (last && (it.lastOdo == null || last.odo >= it.lastOdo || !it.base)) { it.lastOdo = last.odo; it.lastDate = last.date; }
    else if (!last && !it.base) { it.lastOdo = null; it.lastDate = null; }
  });
}
function editItem(it) {
  const isNew = !it; it = it || { id: uid(), icon: 'wrench', col: 'tang', name: '', km: 0, months: 0 };
  openForm({
    title: isNew ? 'New service item' : esc(it.name), lede: 'Set how often it needs doing — by km, by months, or both.', icon: it.icon, col: it.col,
    fields: [{ k: 'name', l: 'Name', v: it.name, req: 1 },
      { type: 'row', f: [{ k: 'km', l: 'Every (km)', type: 'number', v: it.km || '' }, { k: 'months', l: 'Every (months)', type: 'number', v: it.months || '' }] },
      { type: 'row', f: [{ k: 'lastOdo', l: 'Last done at (km)', type: 'number', v: it.lastOdo ?? '' }, { k: 'lastDate', l: 'Last done on', type: 'date', v: it.lastDate || '' }] },
      { k: 'icon', l: 'Icon', type: 'chips', o: ['wrench', 'oil', 'chain', 'tyre', 'brake', 'spark', 'filter', 'drop', 'wind', 'bolt'].map(i => ({ v: i, l: '', icon: i, col: 'tang' })), v: it.icon }],
    onSave: v => { Object.assign(it, { name: v.name, km: v.km || 0, months: v.months || 0, lastOdo: v.lastOdo, lastDate: v.lastDate || null, icon: v.icon || 'wrench', base: true }); if (isNew) S.items.push(it); },
    onDelete: !isNew && (() => S.items = S.items.filter(x => x !== it))
  });
}
function editRenewal(r) {
  const isNew = !r; r = r || { id: uid(), icon: 'cal', col: 'teal', name: '', date: '' };
  openForm({
    title: isNew ? 'New renewal' : esc(r.name), lede: 'The ring drains as the date gets closer.', icon: r.icon, col: r.col,
    fields: [{ k: 'name', l: 'Name', v: r.name, req: 1 }, { type: 'row', f: [{ k: 'date', l: 'Expires on', type: 'date', v: r.date }, { k: 'cost', l: 'Last paid ($)', type: 'number', v: r.cost }] }],
    onSave: v => { Object.assign(r, v); if (isNew) S.renewals.push(r); },
    onDelete: !isNew && (() => S.renewals = S.renewals.filter(x => x !== r))
  });
}
function addOdo() {
  openForm({ title: 'Odometer check', lede: 'A real reading recalibrates tracked distance and every countdown.', icon: 'odo', col: 'lilac',
    fields: [{ type: 'row', f: [{ k: 'date', l: 'Date', type: 'date', v: todayISO(), req: 1 }, { k: 'odo', l: 'Reading (km)', type: 'number', v: odoGuess(), req: 1 }] }],
    onSave: v => { S.odoLog.push({ id: uid(), ...v }); toast('Odo updated — estimates recalibrated', 'odo', 'lilac'); } });
}
function rideForm(r) {
  const isNew = !r;
  const dt = r ? todayISO(new Date(r.start.t)) : todayISO();
  openForm({
    title: isNew ? 'Log a ride' : (r.title || 'Ride'), lede: isNew ? 'For rides the auto-log missed.' : fmtDT(r.start.t) + (r.est === 'estimate' ? ' · distance estimated' : ''), icon: 'route', col: 'candy',
    fields: [{ k: 'title', l: 'Title', v: r?.title || '', ph: 'Sunday ride to Changi' },
      { type: 'row', f: [{ k: 'date', l: 'Date', type: 'date', v: dt }, { k: 'km', l: 'Distance (km)', type: 'number', v: r?.km ?? '', req: 1 }] },
      { k: 'mins', l: 'Duration (min)', type: 'number', v: r ? Math.round((r.end.t - r.start.t) / 6e4) : '' },
      { k: 'mood', l: 'Vibe', type: 'chips', o: MOODS, v: r?.mood || '' },
      { k: 'note', l: 'Journal', type: 'textarea', v: r?.note, ph: 'Where you went, what you ate, how it felt…' }],
    onSave: v => {
      if (isNew) { const t = +new Date(v.date + 'T09:00'); S.rides.push({ id: uid(), title: v.title, start: { t }, end: { t: t + (v.mins || 0) * 6e4 }, km: v.km, src: 'manual', mood: v.mood, note: v.note }); setTimeout(() => { Burst.go('speed'); BG3D.rev(); Sound.rev(1); }, 150); }
      else { Object.assign(r, { title: v.title, km: v.km, mood: v.mood, note: v.note, loop: false }); if (v.mins != null) r.end.t = r.start.t + v.mins * 6e4; }
    },
    onDelete: !isNew && (() => S.rides = S.rides.filter(x => x !== r))
  });
}
function editBike() {
  const b = S.bike;
  openForm({ title: 'Your bike', icon: 'bike', col: 'tang',
    fields: bikeFields(b),
    onSave: v => { Object.assign(b, v); BG3D_tint(); } });
}
const bikeFields = b => [{ k: 'name', l: 'Nickname', v: b.name, req: 1, ph: 'e.g. Black Mamba' },
  { type: 'row', f: [{ k: 'model', l: 'Model', v: b.model, ph: 'Yamaha MT-15' }, { k: 'plate', l: 'Plate', v: b.plate, ph: 'FBA1234X' }] },
  { type: 'row', f: [{ k: 'tank', l: 'Tank size (L)', type: 'number', v: b.tank }, { k: 'cc', l: 'Engine (cc)', type: 'number', v: b.cc }] },
  { k: 'licence', l: 'Licence class', type: 'chips', o: ['2B', '2A', '2'].map(v => ({ v, l: 'Class ' + v })), v: b.licence },
  { k: 'colour', l: 'Bike colour (tints your wheel)', type: 'swatch', o: BIKE_COLOURS, v: b.colour }];
function BG3D_tint() { if (BG3D.ok && BG3D.objs) BG3D.objs[0].material.matcap = matcap(S.bike.colour === '#22102F' ? '#3A2448' : S.bike.colour); }

/* ---------- ride logged moment ---------- */
function rideLogged(ride) {
  Burst.go('speed'); BG3D.rev(.35); Sound.rev(1.5);
  const mins = Math.round((ride.end.t - ride.start.t) / 6e4);
  openSheet(`<div style="text-align:center;padding:4px 0 6px">
      <div class="lede" style="letter-spacing:.2em;font-weight:700;font-size:12px;text-transform:uppercase">Ride logged</div>
      <div style="font-size:76px;font-weight:800;letter-spacing:-.06em;line-height:1"><span id="rkm">0</span><small style="font-size:24px;letter-spacing:-.02em"> km</small></div>
      <div class="muted">${mins} min · ${ride.est === 'route' ? 'road distance' : 'estimated distance'}</div>
      ${ride.loop ? `<div class="warn" style="margin-top:12px;text-align:left">Started and ended at the same place, so the distance can't be worked out. Add it below — next time say “Hey Siri, mark this spot” mid-ride.</div>` : ''}
    </div>
    <form id="rq">${fieldHTML({ k: 'title', l: 'Title', ph: 'Name this ride' })}${ride.loop ? fieldHTML({ k: 'km', l: 'Distance (km)', type: 'number', v: '' }) : ''}${fieldHTML({ k: 'mood', l: 'Vibe', type: 'chips', o: MOODS })}${fieldHTML({ k: 'note', l: 'Journal', type: 'textarea', ph: 'Optional' })}
    <div class="actions"><button class="btn hot">Save ride</button></div></form>`, sh => {
    wireFields(sh); countUp($('#rkm'), ride.km, 1, 1.4);
    $('#rq').onsubmit = e => { e.preventDefault(); const v = readFields(e.target); Object.assign(ride, { title: v.title, mood: v.mood, note: v.note }); if (v.km) { ride.km = v.km; ride.loop = false; } save(); closeSheet(); refresh(); celebrateBadges(); };
  });
}

/* ---------- rain check (NEA 2-hour forecast via data.gov.sg) ---------- */
let rain = null;
async function checkRain(useGPS) {
  let loc = S.parked;
  if (useGPS && navigator.geolocation) loc = await new Promise(res => navigator.geolocation.getCurrentPosition(p => res({ lat: p.coords.latitude, lon: p.coords.longitude }), () => res(S.parked), { timeout: 9000 }));
  if (!loc) { if (useGPS) toast('Location not available', 'x', 'red'); return; }
  try {
    let meta, fc;
    try { const j = await (await fetch('https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast')).json(); meta = j.data.area_metadata; fc = j.data.items[0].forecasts; }
    catch (e) { const j = await (await fetch('https://api.data.gov.sg/v1/environment/2-hour-weather-forecast')).json(); meta = j.area_metadata; fc = j.items[0].forecasts; }
    let best = null, bd = 1e9;
    meta.forEach(m => { const d = haversine(loc, { lat: m.label_location.latitude, lon: m.label_location.longitude }); if (d < bd) { bd = d; best = m.name; } });
    const f = fc.find(x => x.area === best); const text = typeof f.forecast === 'string' ? f.forecast : (f.forecast.text || f.forecast.summary || '');
    rain = { area: best, text, wet: /rain|shower|thunder/i.test(text) };
    if (tab === 'dash') { const c = $('#rainCard'); if (c) { c.outerHTML = rainCard(); } }
  } catch (e) { if (useGPS) toast('Weather unavailable right now', 'cloud', 'grey'); }
}
const rainCard = () => `<div class="card" id="rainCard"><div class="row">
  ${rain ? orb(rain.wet ? 'rain' : 'sun', rain.wet ? 'sky' : 'gold', 'lg') : orb('cloud', 'grey', 'lg')}
  <div class="grow">${rain ? `<b style="font-size:17px">${esc(rain.text)}</b><div class="muted">Next 2 hrs near ${esc(rain.area)}${rain.wet ? ' · pack the rain set' : ''}</div>`
    : `<b style="font-size:17px">Rain check</b><div class="muted">NEA 2-hour forecast where you are</div>`}</div>
  <button class="btn sm ghost" onclick="checkRain(true)">${rain ? 'Refresh' : 'Check'}</button></div></div>`;

/* ================= PAGES ================= */
function greet() { const h = new Date().getHours(); return h < 5 ? 'Late night' : h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening'; }
function wheelCols(h) {
  if (h == null) return ['#FF7A1A', '#FF2D6B', '#9B7BFF'];
  if (h >= 70) return ['#13D3C1', '#9B7BFF', '#38B6FF'];
  if (h >= 40) return ['#FFBE2E', '#FF7A1A', '#FF2D6B'];
  return ['#FF2D6B', '#F0284A', '#FF7A1A'];
}
function tubeRow(o, s, k) {
  const frac = k === 'ren' ? clamp(s.days / 365, 0, 1) : s.frac;
  return `<button class="li" onclick="${k === 'ren' ? `editRenewal(S.renewals.find(x=>x.id==='${o.id}'))` : `editItem(S.items.find(x=>x.id==='${o.id}'))`}">
    ${orb(o.icon, s.cls === 'unset' ? 'grey' : o.col)}
    <span class="grow"><span class="row" style="gap:8px"><span class="t grow">${esc(o.name)}</span><span class="pill ${s.cls}">${k === 'ren' ? s.label : s.label}</span></span>
    <span class="s">${k === 'ren' ? fmtD(o.date) + ' · ' + s.text : s.text}</span>
    <canvas class="tube" data-tube="${frac}" data-s="${s.cls}"></canvas></span></button>`;
}

function viewDash() {
  const h = health(), odo = estOdo(), fs = fuelStats(), mr = monthRides(), corr = correction();
  const up = upcoming(4);
  const monthKm = mr.reduce((s, r) => s + (r.km || 0), 0);
  const lm = new Date(); lm.setDate(1); lm.setMonth(lm.getMonth() - 1);
  const wrapReady = monthRides(lm.getFullYear(), lm.getMonth()).length > 0 || mr.length >= 3;
  return `
  <div class="head"><h1 class="hello">${greet()}, <em>${esc(S.bike.name || 'rider')}</em></h1>
    <p class="lede">${h == null ? 'Log a fill-up or service to wake the wheel' : h >= 70 ? 'Everything’s running sweet' : h >= 40 ? 'A few things are coming due' : 'Your bike needs some love'}</p></div>
  <div class="stage" id="stage"><canvas id="wheel"></canvas>
    <div class="mid"><div class="big"><span id="hNum">${h == null ? '—' : 0}</span></div><div class="cap">${h == null ? 'Bike health' : 'Bike health'}</div>
    <div class="odo">${odoHTML(odo)}</div></div></div>
  <div class="facts">
    <div class="fact"><span>Range</span><b>${fs.range != null ? `<span id="fRange">0</span><small>km</small>` : '—'}</b></div>
    <div class="fact"><span>Economy</span><b>${fs.kpl ? `${num(fs.kpl, 1)}<small>km/L</small>` : '—'}</b></div>
    <div class="fact"><span>${new Date().toLocaleDateString('en-SG', { month: 'long' })}</span><b><span id="fMonth">0</span><small>km</small></b></div>
  </div>
  <div class="quick">
    <button class="qa" onclick="addFuel()">${orb('fuel', 'tang')}Fuel</button>
    <button class="qa" onclick="rideForm()">${orb('route', 'candy')}Ride</button>
    <button class="qa" onclick="addService()">${orb('wrench', 'sky')}Service</button>
    <button class="qa" onclick="addOdo()">${orb('odo', 'lilac')}Odo</button>
  </div>
  ${S.parked ? `<div class="card"><div class="row">${orb('park', 'sky', 'lg')}<div class="grow"><b style="font-size:17px">Your bike is parked</b><div class="muted">Since ${fmtDT(S.parked.t)}</div></div>
    <a class="btn sm solid" style="text-decoration:none" href="https://maps.apple.com/?daddr=${S.parked.lat},${S.parked.lon}&dirflg=w" target="_blank" rel="noopener">Find it</a></div></div>` : ''}
  ${rainCard()}
  <div class="card"><h3>Coming up <button class="link" onclick="go('garage')">See all</button></h3>
    ${up.length ? up.map(x => tubeRow(x.o, x.s, x.k)).join('') : `<div class="empty">Nothing tracked yet.<br>Log a service and add your road tax date — countdowns land here.</div>`}
  </div>
  ${wrapReady ? `<button class="card row" style="text-align:left;width:100%" onclick="playWrap()">${orb('play', 'candy', 'lg')}<span class="grow"><b style="font-size:17px">Your Ride Wrap</b><span class="muted" style="display:block">${mr.length >= 3 ? 'This month so far' : lm.toLocaleDateString('en-SG', { month: 'long' })} — with music</span></span>${ic('chev')}</button>` : ''}
  ${corr !== 1 ? `<p class="muted" style="text-align:center;font-size:13px">Auto-log accuracy is being corrected ×${num(corr, 2)} from your real odo readings</p>` : ''}`;
}
function afterDash(root) {
  const h = health(), fs = fuelStats();
  wheel = new Wheel($('#wheel')); wheel.set(h == null ? 1 : h / 100, wheelCols(h));
  if (h != null) countUp($('#hNum'), h, 0, 1.4);
  countUp($('#fRange'), fs.range); countUp($('#fMonth'), monthRides().reduce((s, r) => s + (r.km || 0), 0));
  rollOdo(root);
}

function viewRides() {
  const rides = [...S.rides].sort((a, b) => b.start.t - a.start.t);
  const total = rides.reduce((s, r) => s + (r.km || 0), 0), hrs = rides.reduce((s, r) => s + Math.max(0, r.end.t - r.start.t), 0) / 36e5;
  const moodOf = m => MOODS.find(x => x.v === m);
  const body = sub.rides === 'journal' ? (rides.length ? rides.map(r => {
    const m = moodOf(r.mood);
    return `<button class="li" onclick="rideForm(S.rides.find(x=>x.id==='${r.id}'))">${orb(m ? m.icon : r.src === 'auto' ? 'headset' : 'route', m ? m.col : r.src === 'auto' ? 'lilac' : 'candy')}
      <span class="grow"><span class="t">${esc(r.title || (r.src === 'auto' ? 'Auto-logged ride' : 'Ride'))}</span>
      <span class="s">${fmtDT(r.start.t)} · ${Math.round(Math.max(0, r.end.t - r.start.t) / 6e4)} min${r.loop ? ' · <b style="color:var(--soon)">add distance</b>' : ''}</span></span>
      <span class="r">${num(r.km, 1)}<small>km</small></span></button>`;
  }).join('') : `<div class="empty">No rides yet. Set up auto-log in <b>More → Auto-log</b> and rides appear here by themselves.</div>`)
    : (S.marks.length ? [...S.marks].sort((a, b) => b.t - a.t).map(m => `<a class="li" style="color:inherit;text-decoration:none" target="_blank" rel="noopener" href="https://maps.apple.com/?ll=${m.lat},${m.lon}&q=${encodeURIComponent(m.note || 'Marked spot')}">${orb('pin', 'teal')}
      <span class="grow"><span class="t">${esc(m.note || 'Marked spot')}</span><span class="s">${fmtDT(m.t)}</span></span>${ic('chev')}</a>`).join('')
      : `<div class="empty">Say “Hey Siri, mark this spot” mid-ride to save views, food stops and hidden roads.</div>`);
  return `
  <div class="head"><h1 class="hello">Your <em>rides</em></h1><p class="lede">Journal, auto-logged trips and marked spots</p></div>
  <div class="facts"><div class="fact"><span>Distance</span><b><span id="rTot">0</span><small>km</small></b></div><div class="fact"><span>Rides</span><b>${rides.length}</b></div><div class="fact"><span>Saddle</span><b>${num(hrs, 1)}<small>h</small></b></div></div>
  <div class="seg" data-sub="rides"><i></i><button data-v="journal">Journal</button><button data-v="spots">Spots</button></div>
  <div class="card">${body}</div>
  <div class="actions"><button class="btn hot" onclick="rideForm()">${ic('plus')}Log a ride</button></div>`;
}
function afterRides() { countUp($('#rTot'), S.rides.reduce((s, r) => s + (r.km || 0), 0), 0); }

function viewGarage() {
  const sv = [...S.services].sort((a, b) => b.odo - a.odo || (b.date > a.date ? 1 : -1));
  const spent = sv.reduce((s, x) => s + (+x.cost || 0), 0);
  const items = [...S.items].map(i => ({ i, s: itemStatus(i) })).sort((a, b) => (a.s.cls === 'unset') - (b.s.cls === 'unset') || a.s.frac - b.s.frac);
  const over = items.filter(x => x.s.cls === 'over').length, soon = items.filter(x => x.s.cls === 'soon').length;
  const body = sub.garage === 'intervals'
    ? items.map(x => tubeRow(x.i, x.s, 'item')).join('') + `<button class="li" onclick="editItem()" style="color:var(--candy);font-weight:700">${orb('plus', 'grey', 'sm')}Add a service item</button>`
    : (sv.length ? sv.map(s => `<button class="li" onclick="addService(S.services.find(x=>x.id==='${s.id}'))">${orb('wrench', 'sky')}
      <span class="grow"><span class="t">${esc(s.items.map(id => S.items.find(i => i.id === id)?.name).filter(Boolean).join(', ') || 'Service')}</span>
      <span class="s">${fmtD(s.date)} · ${num(s.odo)} km${s.shop ? ' · ' + esc(s.shop) : ''}</span></span><span class="r">${s.cost ? money(s.cost, 0) : ''}</span></button>`).join('')
      : `<div class="empty">Every service you log lands here, with parts and cost.</div>`);
  return `
  <div class="head"><h1 class="hello">The <em>garage</em></h1><p class="lede">${over ? `${over} overdue` : soon ? `${soon} coming due soon` : 'Maintenance by km and by time'}</p></div>
  <div class="facts"><div class="fact"><span>Overdue</span><b style="color:${over ? 'var(--over)' : 'inherit'}">${over}</b></div><div class="fact"><span>Due soon</span><b>${soon}</b></div><div class="fact"><span>Spent</span><b>${money(spent, 0)}</b></div></div>
  <div class="seg" data-sub="garage"><i></i><button data-v="intervals">Intervals</button><button data-v="history">History</button></div>
  <div class="card">${body}</div>
  <div class="actions"><button class="btn hot" onclick="addService()">${ic('plus')}Log a service</button></div>`;
}

function viewFuel() {
  const fs = fuelStats(), list = [...S.fuel].sort((a, b) => b.odo - a.odo);
  const now = new Date(); const monthCost = S.fuel.filter(f => { const d = new Date(f.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).reduce((s, f) => s + (+f.cost || 0), 0);
  return `
  <div class="head"><h1 class="hello">Fuel <em>&amp; range</em></h1><p class="lede">Tilt your phone — the tank sloshes. Tap it too.</p></div>
  <div class="card tankwrap"><canvas data-tank="${fs.tankFrac ?? 0}"></canvas>
    <div class="grow"><div class="muted">Estimated range</div>
      <div style="font-size:46px;font-weight:800;letter-spacing:-.05em;line-height:1">${fs.range != null ? `<span id="tRange">0</span><small style="font-size:18px"> km</small>` : '—'}</div>
      <div class="muted" style="margin-top:6px">${fs.range != null ? `About ${Math.round((fs.tankFrac || 0) * 100)}% of a ${num(S.bike.tank)} L tank` : 'Shows after two full-tank fill-ups'}</div></div></div>
  <div class="facts"><div class="fact"><span>Economy</span><b>${fs.kpl ? `${num(fs.kpl, 1)}<small>km/L</small>` : '—'}</b></div><div class="fact"><span>Per km</span><b>${fs.cpk ? `${num(fs.cpk * 100, 1)}<small>¢</small>` : '—'}</b></div><div class="fact"><span>This month</span><b>${money(monthCost, 0)}</b></div></div>
  <div class="card"><h3>Fill-ups <span class="muted">${money(fs.cost, 0)} total</span></h3>
    ${list.length ? list.map((f, i) => { const prev = list[i + 1], d = prev ? f.odo - prev.odo : null, k = f.full && prev && d > 0 && f.litres ? d / f.litres : null; return `
      <button class="li" onclick="addFuel(S.fuel.find(x=>x.id==='${f.id}'))">${orb('fuel', f.full ? 'tang' : 'gold')}
      <span class="grow"><span class="t">${num(f.litres, 2)} L${f.station ? ' · ' + esc(f.station) : ''}</span>
      <span class="s">${fmtD(f.date)} · ${num(f.odo)} km${d ? ` · +${num(d)} km` : ''}${k ? ` · ${num(k, 1)} km/L` : ''}${f.full ? '' : ' · partial'}</span></span>
      <span class="r">${f.cost ? money(f.cost) : ''}</span></button>`; }).join('') : `<div class="empty">Log fills with the odo reading. Or say “Hey Siri, log fuel” at the pump.</div>`}
  </div>
  <div class="actions"><button class="btn hot" onclick="addFuel()">${ic('plus')}Log a fill-up</button></div>`;
}
function afterFuel() { countUp($('#tRange'), fuelStats().range); }

function viewMore() {
  const b = S.bike, odo = estOdo();
  const spent = S.fuel.reduce((s, x) => s + (+x.cost || 0), 0) + S.services.reduce((s, x) => s + (+x.cost || 0), 0) + S.renewals.reduce((s, x) => s + (+x.cost || 0), 0);
  const earned = BADGES.filter(x => badgeState(x).tier > 0).length;
  return `
  <button class="card row" style="width:100%;text-align:left" onclick="editBike()">
    <span class="orb xl" style="--c1:color-mix(in srgb,${b.colour} 55%,#fff);--c2:${b.colour}">${ic('bike', 1.8)}</span>
    <span class="grow"><span style="font-size:24px;font-weight:800;letter-spacing:-.03em;display:block">${esc(b.name || 'Your bike')}</span>
    <span class="muted" style="display:block">${esc([b.model, b.cc ? b.cc + 'cc' : '', 'Class ' + b.licence].filter(Boolean).join(' · '))}</span>
    ${b.plate ? `<span class="pill" style="margin-top:6px;background:var(--ink);color:var(--bg);font-size:13px;letter-spacing:.06em">${esc(b.plate)}</span>` : ''}</span>${ic('chev')}</button>
  <div class="facts"><div class="fact"><span>Odometer</span><b>${odo != null ? num(odo) : '—'}</b></div><div class="fact"><span>Total spent</span><b>${money(spent, 0)}</b></div><div class="fact"><span>Badges</span><b>${earned}<small>/${BADGES.length}</small></b></div></div>
  <div class="card"><h3>Renewals <button class="link" onclick="editRenewal()">Add</button></h3>
    <div class="rgrid">${S.renewals.map(r => { const s = renewStatus(r); return `<button class="rtile" onclick="editRenewal(S.renewals.find(x=>x.id==='${r.id}'))">
      <canvas data-ring="${s.cls === 'unset' ? 0 : Math.max(.04, s.frac)}" data-s="${s.cls}"></canvas><span><b>${esc(r.name)}</b><span>${s.text}</span></span></button>`; }).join('')}</div></div>
  <div class="tiles">
    ${tile('headset', 'lilac', 'Auto-log', S.intercom ? 'Cardo / Siri Shortcuts' : 'Log rides hands-free', 'showAutoLog()')}
    ${tile('trophy', 'gold', 'Badges', `${earned} earned · bronze to gold`, 'showBadges()')}
    ${tile('play', 'candy', 'Ride Wrap', 'Your month as a story', 'playWrap()')}
    ${tile('palette', 'teal', 'Appearance', S.prefs.theme === 'auto' ? 'Matches your phone' : S.prefs.theme === 'dark' ? 'Dark' : 'Light', 'showLook()')}
    ${tile('sound', 'tang', 'Sound', S.prefs.sound ? 'On — revs & swooshes' : 'Off', 'toggleSound()')}
    ${tile('save', 'sky', 'Backup', 'Export, import, start fresh', 'showBackup()')}
  </div>
  <p class="muted" style="text-align:center;font-size:12.5px">Redline · your data stays on this phone</p>`;
}
const tile = (icon, col, t, s, fn) => `<button class="tile" onclick="${fn}">${orb(icon, col)}<span><b>${t}</b><br><span>${s}</span></span></button>`;

/* ---------- More: sheets ---------- */
function showBadges() {
  openSheet(`<div class="row" style="margin-bottom:14px">${orb('trophy', 'gold', 'lg')}<div><h2>Badges</h2><p class="muted">Each one levels up: bronze, silver, gold.</p></div></div>
    <div class="bgrid">${BADGES.map(b => { const st = badgeState(b); const t = st.tier;
      return `<div class="badge ${t ? 'tier-' + t : 'locked'}">${orb(b[2], b[3])}<span>${b[1]}</span><span class="tier">${t ? ['', 'Bronze', 'Silver', 'Gold'][t] : 'Locked'}</span>
      <span class="muted" style="font-size:11.5px">${st.next != null ? `${num(Math.min(st.v, st.next), b[0] === 'sip' ? 1 : 0)} / ${num(st.next)} ${b[6]}` : 'Maxed out'}</span></div>`; }).join('')}</div>`,
    sh => { if (hasGSAP()) gsap.from($$('.badge', sh), { scale: .4, opacity: 0, duration: .55, ease: 'back.out(2.2)', stagger: .03, delay: .15 }); });
}
function showLook() {
  openSheet(`<div class="row" style="margin-bottom:14px">${orb('palette', 'teal', 'lg')}<div><h2>Appearance</h2><p class="muted">Light, dark, or follow your phone.</p></div></div>
    <div class="fld" data-type="chips" data-k="theme"><div class="chips">${[['auto', 'Match phone', 'phone'], ['light', 'Light', 'sun'], ['dark', 'Dark', 'moon']].map(([v, l, i]) => `<button type="button" class="chip ${S.prefs.theme === v ? 'on' : ''}" data-v="${v}">${orb(i, 'teal')}${l}</button>`).join('')}</div></div>`,
    sh => { wireFields(sh); $('[data-k=theme]', sh).addEventListener('click', e => { const c = e.target.closest('.chip'); if (!c) return; S.prefs.theme = c.dataset.v; save(); applyTheme(); refresh(); }); });
}
function toggleSound() { S.prefs.sound = !S.prefs.sound; Sound.on = S.prefs.sound; save(); refresh(); toast(S.prefs.sound ? 'Sound on' : 'Sound off', 'sound', 'tang'); if (S.prefs.sound) Sound.rev(.9); }
function showBackup() {
  openSheet(`<div class="row" style="margin-bottom:14px">${orb('save', 'sky', 'lg')}<div><h2>Backup</h2><p class="muted">Everything lives only on this phone. Export now and then so a cleared browser can’t wipe it.</p></div></div>
    <div class="actions" style="flex-direction:column"><button class="btn hot" onclick="exportData()">${ic('save')}Export backup</button>
    <button class="btn ghost" onclick="$('#imp').click()">Import a backup</button>
    <button class="btn ghost" style="color:var(--over)" onclick="resetAll()">${ic('trash')}Start fresh</button></div>
    <input type="file" id="imp" accept=".json,application/json" hidden onchange="importData(this.files[0])">`);
}
function exportData() {
  S.stats.exports++; save();
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(S)], { type: 'application/json' }));
  a.download = `redline-backup-${todayISO()}.json`; a.click(); toast('Backup downloaded', 'save', 'sky'); celebrateBadges();
}
function importData(file) {
  if (!file) return; const r = new FileReader();
  r.onload = () => { try { const d = JSON.parse(r.result); if (d.v !== 2 || !d.bike) throw 0; S = Object.assign(fresh(), d); save(); closeSheet(); applyTheme(); refresh(); toast('Backup restored', 'check', 'teal'); } catch (e) { toast('That isn’t a Redline backup', 'x', 'red'); } };
  r.readAsText(file);
}
function resetAll() { if (confirm('Wipe ALL Redline data on this phone?') && confirm('Really? Export a backup first if unsure.')) { localStorage.removeItem(KEY); S = fresh(); closeSheet(); startSetup(); } }

/* ---------- Auto-log guide ---------- */
function showAutoLog() {
  const base = location.origin + location.pathname;
  openSheet(`<div class="row" style="margin-bottom:6px">${orb('headset', 'lilac', 'lg')}<div><h2>Auto-log rides</h2><p class="muted">Your Cardo connecting starts a ride; disconnecting ends it. Screen stays off, so battery barely moves.</p></div></div>
  <div class="warn" style="margin:12px 0">First add Redline to your Home Screen: Safari → Share → Add to Home Screen.</div>
  <p style="font-weight:700;margin:14px 0 6px">In the Shortcuts app → Automation → New</p>
  <ol class="steps">
    <li><b>When Cardo connects</b> (Bluetooth → your Cardo → Is Connected → Run Immediately)<br>
      Get Current Location → Format Date (Current Date, ISO 8601, include time) → Text:
      <div class="code">slat=[Latitude]&amp;slon=[Longitude]&amp;st=[Formatted Date]</div>→ Save File to <b>Shortcuts/redline-start.txt</b>, overwrite on.</li>
    <li><b>When Cardo disconnects</b> (Is Disconnected → Run Immediately)<br>
      Get File redline-start.txt → Get Current Location → Format Date (ISO 8601) → URL:
      <div class="code">${esc(base)}?evt=ride&amp;[File]&amp;elat=[Latitude]&amp;elon=[Longitude]&amp;et=[Formatted Date]</div>→ Open URLs. Redline opens once you’ve parked and shows the ride.</li>
  </ol>
  <p style="font-weight:700;margin:14px 0 6px">Siri through your helmet (optional)</p>
  <ol class="steps" start="3">
    <li><b>“Mark this spot”</b>: Get Current Location → Dictate Text → open
      <div class="code">${esc(base)}?evt=mark&amp;lat=[Latitude]&amp;lon=[Longitude]&amp;note=[Dictated Text]</div>Marked spots also become route waypoints, which fixes loop rides.</li>
    <li><b>“Log fuel”</b>: Ask for Number ×3 (odo, litres, cost) → open
      <div class="code">${esc(base)}?evt=fuel&amp;odo=[Odo]&amp;litres=[Litres]&amp;cost=[Cost]</div></li>
  </ol>
  <p class="muted" style="margin:10px 0 14px">Connections under ${S.minMin} minutes (music at home, pairing tests) only update your parked spot. Distance uses road routing, then gets corrected against your real odo at every fill-up.</p>
  <div class="actions"><button class="btn hot" onclick="testRide()">${ic('play')}Send a test ride</button></div>`);
}
function testRide() {
  closeSheet(); const now = Date.now();
  history.replaceState(null, '', `${location.pathname}?evt=ride&slat=1.3526&slon=103.9447&st=${encodeURIComponent(new Date(now - 34 * 6e4).toISOString())}&elat=1.3329&elon=103.7436&et=${encodeURIComponent(new Date(now).toISOString())}`);
  setTimeout(processURL, 450);
}
async function processURL() {
  const r = await handleURL(); if (!r) return;
  if (r.ride) { if (tab !== 'dash') go('dash', true); else refresh(); setTimeout(() => rideLogged(r.ride), 500); }
  else { toast(r.msg, r.icon, r.col); if (r.fuel) Burst.go(); refresh(); }
  celebrateBadges();
}

/* ================= Ride Wrap (story + music) ================= */
let wrapStop = null;
function wrapData() {
  const now = new Date(); let y = now.getFullYear(), m = now.getMonth(); let rides = monthRides(y, m);
  if (rides.length < 3) { const d = new Date(y, m - 1, 1); const prev = monthRides(d.getFullYear(), d.getMonth()); if (prev.length) { rides = prev; y = d.getFullYear(); m = d.getMonth(); } }
  const name = new Date(y, m, 1).toLocaleDateString('en-SG', { month: 'long' });
  const km = rides.reduce((s, r) => s + (r.km || 0), 0), mins = rides.reduce((s, r) => s + Math.max(0, r.end.t - r.start.t), 0) / 6e4;
  const longest = rides.reduce((a, r) => (!a || r.km > a.km) ? r : a, null);
  const days = Array(7).fill(0); rides.forEach(r => days[new Date(r.start.t).getDay()] += r.km || 0);
  const topDay = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'][days.indexOf(Math.max(...days))];
  const fuel = S.fuel.filter(f => { const d = new Date(f.date); return d.getFullYear() === y && d.getMonth() === m; });
  const fuelCost = fuel.reduce((s, f) => s + (+f.cost || 0), 0);
  const night = rides.filter(r => { const h = new Date(r.start.t).getHours(); return h >= 21 || h < 5; }).length;
  return { name, rides, km, mins, longest, topDay, fuelCost, fills: fuel.length, night, marks: S.marks.filter(x => { const d = new Date(x.t); return d.getFullYear() === y && d.getMonth() === m; }).length };
}
function playWrap() {
  closeSheet();
  const d = wrapData();
  if (!d.rides.length) { toast('Log a few rides first — then your Wrap appears', 'route', 'candy'); return; }
  S.stats.wraps++; save();
  const slides = [
    { k: 'Ride Wrap', h: d.name, p: `Here’s your month on ${esc(S.bike.name || 'the bike')}.`, c: ['#FF7A1A', '#FF2D6B', '#9B7BFF'] },
    { k: 'You rode', h: `<span data-n="${d.km}">0</span><small> km</small>`, p: d.km > 800 ? 'That’s Singapore end to end more than 15 times.' : d.km > 200 ? 'That’s like riding to Melaka and back.' : 'Every km counts.', c: ['#FF2D6B', '#9B7BFF', '#13D3C1'] },
    { k: 'Across', h: `<span data-n="${d.rides.length}">0</span><small> rides</small>`, p: `About ${num(d.mins / 60, 1)} hours in the saddle.`, c: ['#9B7BFF', '#38B6FF', '#13D3C1'] },
    d.longest && { k: 'Longest ride', h: `<span data-n="${d.longest.km}" data-d="1">0</span><small> km</small>`, p: esc(d.longest.title || fmtDT(d.longest.start.t)), c: ['#13D3C1', '#FFBE2E', '#FF7A1A'] },
    { k: 'Favourite day', h: d.topDay, p: d.night ? `Plus ${d.night} night ride${d.night > 1 ? 's' : ''} under the streetlights.` : 'Your go-to day to ride.', c: ['#FFBE2E', '#FF7A1A', '#FF2D6B'] },
    d.fills && { k: 'Fuel', h: `<span data-n="${d.fuelCost}">0</span><small> dollars</small>`, p: `Over ${d.fills} fill-up${d.fills > 1 ? 's' : ''}.`, c: ['#FF7A1A', '#F0284A', '#9B7BFF'] },
    d.marks && { k: 'Spots marked', h: `<span data-n="${d.marks}">0</span>`, p: 'Places worth coming back to.', c: ['#38B6FF', '#9B7BFF', '#FF2D6B'] },
    { k: 'Keep it rolling', h: 'Ride on', p: 'See you next month.', c: ['#FF2D6B', '#FF7A1A', '#FFBE2E'] }
  ].filter(Boolean);
  const st = $('#story'); st.classList.add('on');
  st.innerHTML = `<canvas class="sbg"></canvas><div class="bars">${slides.map(() => '<i><b></b></i>').join('')}</div><button class="x" aria-label="Close">${ic('x')}</button><div class="slide"></div>`;
  const cv = $('.sbg', st), g = cv.getContext('2d'); let idx = -1, cols = slides[0].c, tgt = cols.map(hex2rgb), cur = tgt.map(c => [...c]), alive = true, timer;
  const blobs = Array.from({ length: 6 }, (_, i) => ({ a: Math.random() * 6, r: .3 + Math.random() * .2, s: .15 + Math.random() * .25, i }));
  const t0 = performance.now();
  (function draw() {
    if (!alive) return; requestAnimationFrame(draw);
    const t = (performance.now() - t0) / 1000, w = cv.width = innerWidth * DPR, h = cv.height = innerHeight * DPR;
    cur = cur.map((c, i) => c.map((v, j) => v + (tgt[i][j] - v) * .04));
    g.fillStyle = '#12061A'; g.fillRect(0, 0, w, h); g.globalCompositeOperation = 'screen';
    blobs.forEach(b => {
      const x = w * (.5 + .38 * Math.cos(t * b.s + b.a)), y = h * (.5 + .35 * Math.sin(t * b.s * 1.3 + b.a * 2)), R = Math.max(w, h) * b.r;
      const c = cur[b.i % 3].map(v => Math.round(v * 255)); const gr = g.createRadialGradient(x, y, 0, x, y, R);
      gr.addColorStop(0, `rgba(${c},.8)`); gr.addColorStop(.5, `rgba(${c},.3)`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    g.globalCompositeOperation = 'source-over';
  })();
  const show = i => {
    if (i >= slides.length) return end(); if (i < 0) i = 0;
    idx = i; const s = slides[i]; tgt = s.c.map(hex2rgb);
    $$('.bars i b', st).forEach((b, j) => { b.style.transition = 'none'; b.style.width = j < i ? '100%' : '0'; });
    const bar = $$('.bars i b', st)[i]; requestAnimationFrame(() => { bar.style.transition = 'width 4.6s linear'; bar.style.width = '100%'; });
    const el = $('.slide', st); el.innerHTML = `<div class="k">${s.k}</div><div class="h">${s.h}</div><div class="p">${s.p}</div>`;
    if (hasGSAP()) gsap.from(el.children, { y: 50, opacity: 0, rotate: 2, duration: .7, ease: 'back.out(1.8)', stagger: .12 });
    $$('[data-n]', el).forEach(n => countUp(n, +n.dataset.n, n.dataset.d ? 1 : 0, 1.3));
    Sound.swoosh(); clearTimeout(timer); timer = setTimeout(() => show(idx + 1), 4600);
  };
  const end = () => { alive = false; clearTimeout(timer); st.classList.remove('on'); st.innerHTML = ''; wrapStop && wrapStop(); wrapStop = null; celebrateBadges(); };
  $('.x', st).onclick = e => { e.stopPropagation(); end(); };
  st.onclick = e => { if (e.clientX < innerWidth * .3) show(idx - 1); else show(idx + 1); };
  wrapStop = Sound.music(); show(0);
}

/* ================= GUIDED SETUP ================= */
let setupStep = 0, setupTube = null;
const SETUP = [
  { kick: 'Welcome', h: 'Let’s build <em>your garage</em>', p: 'Redline keeps your bike’s service, fuel, renewals and rides in one place — and logs rides by itself. Takes about a minute.', body: () => `<div class="stage" style="width:min(64vw,260px)"><canvas id="swheel"></canvas><div class="mid">${orb('bike', 'tang', 'xl')}</div></div>`, cta: 'Let’s go' },
  { kick: 'Step 1 · Your bike', h: 'What are you <em>riding?</em>', p: 'The colour tints your wheel and the 3D shapes.', fields: () => bikeFields(S.bike), save: v => { if (!v.name) { toast('Give your bike a nickname', 'x', 'red'); return false; } Object.assign(S.bike, v); BG3D_tint(); } },
  { kick: 'Step 2 · Odometer', h: 'What’s on the <em>odo</em> right now?', p: 'This is the starting point for every countdown. Check the dashboard — rough is fine.', fields: () => [{ k: 'odo', l: 'Odometer (km)', type: 'number', v: estOdo() ?? '', ph: 'e.g. 18420', req: 1 }],
    save: v => { if (v.odo == null || isNaN(v.odo)) { toast('Add your odometer reading', 'x', 'red'); return false; } S.odoLog = S.odoLog.filter(o => !o.setup); S.odoLog.push({ id: uid(), date: todayISO(), odo: v.odo, setup: true }); } },
  { kick: 'Step 3 · Last service', h: 'When was it <em>last serviced?</em>', p: 'So Redline knows what’s due next.', custom: 'service' },
  { kick: 'Step 4 · Renewals', h: 'Never miss a <em>renewal</em>', p: 'Add what you know. Skip any — you can add them later in More.', fields: () => S.renewals.slice(0, 4).map(r => ({ k: r.id, l: r.name, type: 'date', v: r.date })),
    save: v => { S.renewals.forEach(r => { if (r.id in v) r.date = v[r.id]; }); } },
  { kick: 'Step 5 · Auto-log', h: 'Ride with an <em>intercom?</em>', p: 'If you do, rides can log themselves when it connects and disconnects.', custom: 'intercom' },
  { kick: 'All set', h: 'Fire it <em>up</em>', p: 'Your garage is ready. Tip: tap the wheel, and tilt your phone on the Fuel page.', body: () => `<div class="stage" style="width:min(64vw,260px)"><canvas id="swheel"></canvas><div class="mid">${orb('check', 'teal', 'xl')}</div></div>`, cta: 'Start riding' }
];
function startSetup() {
  document.body.classList.add('setup'); setupStep = 0; renderSetup();
}
function renderSetup(dir = 1) {
  const st = SETUP[setupStep], v = $('#view');
  let inner = '';
  if (st.fields) inner = st.fields().map(fieldHTML).join('');
  if (st.body) inner = st.body();
  if (st.custom === 'service') inner = `
    <button type="button" class="choice ${S._svc === 'fresh' || !S._svc ? 'on' : ''}" data-c="fresh">${orb('sparkle', 'teal')}<span><b>Just serviced / start fresh</b><span>Every countdown starts from today’s odo</span></span></button>
    <button type="button" class="choice ${S._svc === 'known' ? 'on' : ''}" data-c="known">${orb('wrench', 'sky')}<span><b>I know my last service</b><span>Enter the km and what was done</span></span></button>
    <div id="svcKnown" style="display:${S._svc === 'known' ? 'block' : 'none'}">${[{ type: 'row', f: [{ k: 'sdate', l: 'Date', type: 'date', v: todayISO() }, { k: 'sodo', l: 'At odo (km)', type: 'number', v: '' }] }, { k: 'sitems', l: 'What was done', type: 'chips', multi: 1, o: S.items.map(i => ({ v: i.id, l: i.name, icon: i.icon, col: i.col })), v: S.items.slice(0, 2).map(i => i.id) }].map(fieldHTML).join('')}</div>`;
  if (st.custom === 'intercom') inner = `
    <button type="button" class="choice ${S.intercom === 'Cardo' ? 'on' : ''}" data-c="Cardo">${orb('headset', 'lilac')}<span><b>Cardo</b><span>Packtalk, Freecom, Spirit…</span></span></button>
    <button type="button" class="choice ${S.intercom === 'Other' ? 'on' : ''}" data-c="Other">${orb('headset', 'sky')}<span><b>Another intercom</b><span>Sena, Shoei, anything Bluetooth</span></span></button>
    <button type="button" class="choice ${S.intercom === 'none' ? 'on' : ''}" data-c="none">${orb('phone', 'grey')}<span><b>No intercom</b><span>Log rides with a tap, or use a Siri shortcut</span></span></button>`;
  v.innerHTML = `<div class="setupwrap">
    <div class="row">${setupStep > 0 ? `<button class="iconbtn" id="sBack" aria-label="Back">${ic('back')}</button>` : '<span style="width:40px"></span>'}<div class="sprog grow"><canvas id="sprog"></canvas></div><span class="muted" style="width:40px;text-align:right">${setupStep + 1}/${SETUP.length}</span></div>
    <div class="sstep"><div class="kick">${st.kick}</div><h1>${st.h.replace('<em>', '<em style="font-style:normal;background:linear-gradient(90deg,var(--tang),var(--candy));-webkit-background-clip:text;background-clip:text;color:transparent">')}</h1><p class="lede muted">${st.p}</p>
    <form id="sform" style="display:flex;flex-direction:column;gap:10px">${inner}</form>
    <div class="sfoot">${[3, 4].includes(setupStep) ? `<button class="btn ghost" id="sSkip">Skip</button>` : ''}<button class="btn hot" id="sNext">${st.cta || 'Continue'}</button></div></div></div>`;
  // progress = liquid tube
  const pc = $('#sprog'); setupTube = new Tube(pc, (setupStep + 1) / SETUP.length, 'hot'); setupTube.f = setupStep / SETUP.length; Liquids.add(setupTube);
  wireFields(v);
  $$('.choice', v).forEach(c => c.onclick = () => {
    $$('.choice', v).forEach(x => x.classList.remove('on')); c.classList.add('on'); Sound.tap(); haptic();
    if (hasGSAP()) gsap.fromTo(c, { scale: .95 }, { scale: 1, duration: .5, ease: 'back.out(3)' });
    if (st.custom === 'service') { S._svc = c.dataset.c; $('#svcKnown').style.display = c.dataset.c === 'known' ? 'block' : 'none'; }
    if (st.custom === 'intercom') S.intercom = c.dataset.c;
  });
  v.addEventListener('pick', () => { BG3D_tint(); const c = $('.swatch.on', v)?.dataset.v; if (c) { S.bike.colour = c; BG3D_tint(); BG3D.rev(.2); } });
  const sw = $('#swheel'); if (sw) { const w = new Wheel(sw); w.set(1, setupStep === 0 ? ['#FF7A1A', '#FF2D6B', '#9B7BFF'] : ['#13D3C1', '#9B7BFF', '#38B6FF']); w.rev(1.2); }
  if (setupStep === SETUP.length - 1) { setTimeout(() => { Burst.go('big'); Sound.chime(); }, 300); }
  if (hasGSAP()) gsap.from($$('.sstep > *', v), { x: 40 * dir, opacity: 0, duration: .55, ease: 'power3.out', stagger: .06 });
  $('#sBack') && ($('#sBack').onclick = () => { setupStep--; Sound.swoosh(); renderSetup(-1); });
  $('#sSkip') && ($('#sSkip').onclick = () => { setupStep++; Sound.swoosh(); renderSetup(1); });
  $('#sNext').onclick = e => { e.preventDefault(); nextSetup(); };
  $('#sform').onsubmit = e => { e.preventDefault(); nextSetup(); };
}
function nextSetup() {
  const st = SETUP[setupStep], v = readFields($('#sform'));
  if (setupStep === 0) { Tilt.ask(); Sound.unlock(); setTimeout(() => Sound.rev(1.2), 60); BG3D.rev(.3); }
  if (st.save && st.save(v) === false) return;
  if (st.custom === 'service') {
    const odo = estOdo() ?? 0;
    if ((S._svc || 'fresh') === 'fresh') { S.items.forEach(i => { i.lastOdo = odo; i.lastDate = todayISO(); i.base = true; }); }
    else { if (v.sodo == null || isNaN(v.sodo)) { toast('Add the odo at that service', 'x', 'red'); return; } S.services.push({ id: uid(), date: v.sdate || todayISO(), odo: v.sodo, items: v.sitems, cost: null, shop: '', notes: 'Added during setup' }); syncItems(); }
  }
  if (st.custom === 'intercom' && !S.intercom) S.intercom = 'none';
  save();
  if (setupStep === SETUP.length - 1) { S.setupDone = true; delete S._svc; save(); document.body.classList.remove('setup'); Sound.rev(1.6); BG3D.rev(.4); Burst.go('speed'); go('dash', true); if (S.intercom && S.intercom !== 'none') setTimeout(() => toast('Set up auto-log any time in More', 'headset', 'lilac'), 1800); return; }
  setupStep++; Sound.swoosh(); haptic(); renderSetup(1);
}

/* ================= NAV + RENDER ================= */
const VIEWS = { dash: [viewDash, afterDash], rides: [viewRides, afterRides], garage: [viewGarage], fuel: [viewFuel, afterFuel], more: [viewMore] };
function render(animate = true) {
  const v = $('#view'); const [fn, after] = VIEWS[tab];
  if (wheel) { wheel.alive = false; wheel = null; }
  v.innerHTML = `<div class="page">${fn()}</div>`;
  $('#date').textContent = new Date().toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' });
  $$('nav.tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
  moveBlob(); Liquids.scan(v);
  $$('.seg', v).forEach(sg => {
    const key = sg.dataset.sub, place = () => { const on = $(`button[data-v="${sub[key]}"]`, sg); $$('button', sg).forEach(b => b.classList.toggle('on', b === on)); const i = $('i', sg); i.style.left = on.offsetLeft + 'px'; i.style.width = on.offsetWidth + 'px'; };
    place(); sg.onclick = e => { const b = e.target.closest('button'); if (!b || sub[key] === b.dataset.v) return; sub[key] = b.dataset.v; Sound.tap(); render(false); };
  });
  after && after(v);
  if (animate && hasGSAP()) gsap.from($$('.page > *', v), { y: 34, opacity: 0, scale: .97, duration: .6, ease: 'back.out(1.6)', stagger: .05, clearProps: 'transform,opacity' });
}
function refresh() { if (!document.body.classList.contains('setup')) render(false); }
function moveBlob() {
  const on = $('nav.tabs button.on'), bl = $('nav.tabs .blob'); if (!on || !bl) return;
  const x = on.offsetLeft, w = on.offsetWidth;
  if (hasGSAP()) gsap.to(bl, { left: x, width: w, duration: .55, ease: 'elastic.out(1,.7)' }); else Object.assign(bl.style, { left: x + 'px', width: w + 'px' });
}
function go(t, force) {
  if (t === tab && !force) return; tab = t; haptic(); Sound.swoosh(); BG3D.setZone(TABS.indexOf(t)); window.scrollTo({ top: 0 }); render(true);
  if (t === 'dash') checkRain(false);
}
$$('nav.tabs button').forEach(b => b.onclick = () => { Sound.tap(); go(b.dataset.t); });
$('#scrim').onclick = closeSheet;

/* ================= BOOT ================= */
function boot() {
  Sound.on = S.prefs.sound; applyTheme(); BG3D.init(); BG3D_tint();
  const start = () => { if (!S.setupDone) startSetup(); else { render(true); processURL(); checkRain(false); } };
  BG3D.swoopIn();
  Boot.run($('#boot'), start);
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
}
boot();
