/* ================================================================
   Redline app: the HUD, the action cards, sheets and forms, the guided
   setup, Cardo auto-log, backup and the Ride Wrap — all over the 3D Grid.
   ================================================================ */
const $ = (q, r = document) => r.querySelector(q), $$ = (q, r = document) => [...r.querySelectorAll(q)];
const hudEl = $('#hud'), cardEl = $('#card'), sheetEl = $('#sheet'), shadeEl = $('#shade');
const BIKE_TYPES = (window.W && W.BIKE_TYPES) || [['naked', 'Naked'], ['sport', 'Sport'], ['scooter', 'Scooter'], ['trike', '3-wheel scooter'], ['underbone', 'Underbone'], ['adventure', 'Adventure'], ['cruiser', 'Cruiser'], ['cafe', 'Sport classic'], ['classic', 'Classic naked']];
const typeName = k => (BIKE_TYPES.find(b => b[0] === k) || [k, k])[1];
const haptic = () => navigator.vibrate && navigator.vibrate(8);
if (!window.W) $('#err').hidden = false;

/* ---------- icons (line art, shown in cyan) ---------- */
const IC = {
  fuel: '<path d="M4 21V5.5A2.5 2.5 0 0 1 6.5 3h5A2.5 2.5 0 0 1 14 5.5V21M3 21h12M4 10h10"/><path d="M14 8h1.5L19 11.5V18a1.5 1.5 0 0 1-3 0v-2.5h-2"/>',
  ride: '<circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8.2 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.8"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.3 5.2L3.5 17.4a1.9 1.9 0 0 0 2.7 2.7l5.9-5.9a4 4 0 0 0 5.2-5.3l-2.6 2.6-2.3-.6-.6-2.3z"/>',
  odo: '<rect x="3" y="6" width="18" height="12" rx="1"/><path d="M7 10v4M10.5 10v4M14 10v4M17.5 10v4"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  pin: '<path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  gauge: '<path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17l4.5-5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>', park: '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M10 16.5v-9h3a2.8 2.8 0 0 1 0 5.6h-3"/>',
};
const ic = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" aria-hidden="true">${IC[n] || ''}</svg>`;

/* ---------- toast ---------- */
function toast(msg, kind = '') { const t = $('#toast'); t.textContent = msg; t.className = 'toast on ' + kind; clearTimeout(t._h); t._h = setTimeout(() => t.className = 'toast ' + kind, 2800); }
window.toast = toast;

/* ---------- push data into the 3D world ---------- */
function syncWorld() {
  if (!window.W) return;
  W.update(viewModel(), partStates(), riders());
}

/* ================= HUD + action card per place ================= */
let place = 0, arcMsg = null, kills = [];
const statusWord = s => s === 'over' ? 'r' : s === 'soon' ? 'w' : '';
function hudHTML(i) {
  const h = health(), odo = estOdo(), fs = fuelStats(), name = esc(S.bike.name || 'Your bike').toUpperCase();
  if (i === 0) {
    const ni = upcoming(1)[0];
    return `<div class="sec">SECTOR 01 · ${name}</div><div class="n">${h == null ? '—' : h}<small>BIKE HEALTH</small></div>
      <div class="row"><div>ODO<b>${odo == null ? '—' : num(odo)}</b></div><div>RANGE<b>${fs.range == null ? '—' : num(fs.range) + ' KM'}</b></div>
      ${ni ? `<div class="${statusWord(ni.s.cls)}">${esc(ni.o.name).toUpperCase()}<b>${ni.k === 'ren' ? ni.s.text.toUpperCase() : ni.s.text.split(' · ')[0].toUpperCase()}</b></div>` : ''}</div>`;
  }
  if (i === 1) {
    const mr = monthRides(), km = mr.reduce((s, r) => s + (r.km || 0), 0), longest = mr.reduce((m, r) => Math.max(m, r.km || 0), 0), rs = riders();
    const night = mr.filter(r => { const hh = new Date(r.start.t).getHours(); return hh >= 21 || hh < 5; }).length;
    return `<div class="sec">SECTOR 02 · TRAIL VALLEY</div><div class="n">${num(km)}<small>KM · ${new Date().toLocaleDateString('en-SG', { month: 'long' }).toUpperCase()}</small></div>
      <div class="row"><div>RIDES<b>${mr.length}</b></div><div>LONGEST<b>${num(longest, 1)} KM</b></div><div>NIGHT<b>${night}</b></div></div>
      <div class="chips">${rs.map((r, k) => `<span style="color:${r.col}">${esc(r.title).toUpperCase().slice(0, 18)} · ${num(r.km, 1)} KM · <b data-score="${k}">${kills[k] || 0}</b></span>`).join('')}</div>`;
  }
  if (i === 2) {
    const st = S.items.map(itemStatus), over = st.filter(s => s.cls === 'over').length, soon = st.filter(s => s.cls === 'soon').length, ni = upcoming(8).filter(x => x.k === 'item')[0];
    return `<div class="sec">SECTOR 03 · HANGAR · ${esc(typeName(S.bike.type)).toUpperCase()}</div><div class="n">${over || soon}<small>${over ? 'OVERDUE' : 'DUE SOON'}</small></div>
      <div class="row"><div class="${over ? 'r' : ''}">OVERDUE<b>${over}</b></div>${ni ? `<div class="${statusWord(ni.s.cls)}">${esc(ni.o.name).toUpperCase()}<b>${ni.s.text.split(' · ')[0].toUpperCase()}</b></div>` : '<div>NEXT<b>LOG A SERVICE</b></div>'}</div>
      <div class="types" role="group" aria-label="Bike type">${BIKE_TYPES.map(([k, n]) => `<button type="button" class="chipbtn" data-type="${k}" aria-pressed="${k === S.bike.type}">${n}</button>`).join('')}</div>`;
  }
  if (i === 3) {
    const now = new Date(), mc = S.fuel.filter(f => { const d = new Date(f.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).reduce((s, f) => s + (+f.cost || 0), 0);
    return `<div class="sec">SECTOR 04 · DEPOT</div><div class="n">${fs.range == null ? '—' : num(fs.range)}<small>KM RANGE</small></div>
      <div class="row"><div>TANK<b>${fs.tankFrac == null ? '—' : Math.round(fs.tankFrac * 100) + '%'}</b></div><div>ECONOMY<b>${fs.kpl ? num(fs.kpl, 1) + ' KM/L' : '—'}</b></div><div>THIS MONTH<b>${money(mc, 0)}</b></div></div>`;
  }
  const nr = nextRenewal(), earned = BADGES.filter(b => badgeState(b).tier > 0).length;
  return `<div class="sec">SECTOR 05 · CONTROL DECK</div><div class="n">${earned}<small>OF ${BADGES.length} BADGES</small></div>
    <div class="row">${nr ? `<div class="${statusWord(nr.s.cls)}">${esc(nr.r.name).toUpperCase()}<b>${nr.s.days < 0 ? 'OVERDUE' : nr.s.days + ' DAYS'}</b></div>` : '<div>RENEWALS<b>ADD DATES</b></div>'}<div>AUTO-LOG<b>${S.intercom && S.intercom !== 'none' ? 'SET UP' : 'OFF'}</b></div></div>`;
}
const act = (id, icon, label, hot) => `<button type="button" class="act${hot ? ' hot' : ''}" data-act="${id}">${ic(icon)}${label}</button>`;
function cardHTML(i) {
  if (i === 0) return `<div class="acts">${act('fuel', 'fuel', 'Fuel')}${act('ride', 'ride', 'Ride')}${act('service', 'wrench', 'Service')}${act('odo', 'odo', 'Odo')}</div>
    <div class="hint" id="hint">${arcMsg || (S.parked ? 'Bike parked ' + fmtDT(S.parked.t) : 'Tap an arc on the ring to see that part')}</div>${S.parked ? `<div class="btns"><a class="btn ghost sm" style="flex:1;text-decoration:none;text-align:center" href="https://maps.apple.com/?daddr=${S.parked.lat},${S.parked.lon}&dirflg=w" target="_blank" rel="noopener">Find my bike</a></div>` : ''}`;
  if (i === 1) return `<div class="acts" style="--n:3">${act('ride', 'ride', 'Log ride', true)}${act('journal', 'list', 'Journal')}${act('spots', 'pin', 'Spots')}</div>
    <div class="hint">${S.rides.length ? 'Your last ' + Math.min(4, S.rides.length) + ' rides battle it out' : 'Log a ride and it joins the battle'}</div>`;
  if (i === 2) return `<div class="acts" style="--n:3">${act('service', 'wrench', 'Log service', true)}${act('intervals', 'gauge', 'Intervals')}${act('history', 'list', 'History')}</div>
    <div class="hint">Tap the bike to explode it into its parts</div>`;
  if (i === 3) return `<div class="acts" style="--n:2">${act('fuel', 'fuel', 'Log fill-up', true)}${act('fuelhist', 'list', 'Fill-ups')}</div>
    <div class="hint">Each ring of light is one slice of fuel</div>`;
  return `<p>Tap a tile on the console to open it. The pillars count down to your renewals, and the medallions are your badges.</p><div class="hint">Tap a tile</div>`;
}
function renderPlace(delay = 0) {
  document.body.classList.add('fade');
  setTimeout(() => { hudEl.innerHTML = hudHTML(place); cardEl.innerHTML = cardHTML(place); document.body.classList.remove('fade'); }, delay);
  $$('#nav button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.i === place)));
}
function refresh() { syncWorld(); hudEl.innerHTML = hudHTML(place); cardEl.innerHTML = cardHTML(place); }
$('#nav').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; startAudio(); go(+b.dataset.i); });
function go(i) { if (i === place) return; place = i; arcMsg = null; haptic(); if (window.W) W.go(i); renderPlace(window.W ? 520 : 0); }
hudEl.addEventListener('click', e => { const b = e.target.closest('[data-type]'); if (!b) return; setType(b.dataset.type); });
function setType(type) { if (type === S.bike.type) return; S.bike.type = type; save(); if (window.W) W.setBike(type); $$('#hud [data-type]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.type === type))); syncWorld(); }
cardEl.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b) return; haptic(); Snd.click && Snd.click(1); ACTIONS[b.dataset.act](); });
if (window.W) {
  W.onArc = (k, name) => { const p = partStates()[k]; arcMsg = p.status === 'unset' ? `${name} · not tracked yet` : `${p.item || name} · ${p.val} · ${Math.round(p.left * 100)}% of interval left`; const h = $('#hint'); if (h) h.textContent = arcMsg; };
  W.onTile = name => { const fn = TILE_SHEETS[name]; if (fn) fn(); };
  W.onScore = k => { kills = k; $$('#hud [data-score]').forEach(el => el.textContent = kills[+el.dataset.score] || 0); };
}

/* ================= sheets ================= */
function openSheet(title, lede, body, onOpen) {
  sheetEl.innerHTML = `<div class="sh-head"><div class="grow"><h2>${title}</h2>${lede ? `<p>${lede}</p>` : ''}</div><button type="button" class="x" aria-label="Close">${ic('x')}</button></div>${body}`;
  sheetEl.scrollTop = 0; sheetEl.classList.add('on'); shadeEl.classList.add('on'); if (window.W) W.locked = true;
  $('.x', sheetEl).onclick = closeSheet; onOpen && onOpen(sheetEl);
}
function closeSheet() { sheetEl.classList.remove('on'); shadeEl.classList.remove('on'); if (window.W) { W.locked = false; W.closeTile(); } }
shadeEl.addEventListener('click', closeSheet);
// form fields
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
  openSheet(title, lede, `<form id="fm">${fields.map(F).join('')}<div class="btns">${onDelete ? '<button type="button" class="btn danger" id="del" style="flex:.5">Delete</button>' : ''}<button class="btn">${cta}</button></div></form>`, sh => {
    wire(sh);
    $('#fm', sh).onsubmit = e => {
      e.preventDefault(); const v = read(e.target);
      for (const x of fields.flatMap(x => x.type === 'row' ? x.f : [x])) if (x.req && (v[x.k] == null || v[x.k] === '' || (typeof v[x.k] === 'number' && isNaN(v[x.k])))) { toast(`Add ${x.l.toLowerCase()}`, 'over'); return; }
      if (onSave(v) === false) return;
      save(); closeSheet(); refresh(); celebrate();
    };
    if (onDelete) { const d = $('#del', sh); d.onclick = () => { if (d.dataset.sure) { onDelete(); save(); closeSheet(); refresh(); } else { d.dataset.sure = 1; d.textContent = 'Tap to confirm'; } }; }
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
    onSave: v => { if (e) Object.assign(e, v); else { S.fuel.push({ id: uid(), ...v }); toast('Fill-up logged'); } },
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
    onSave: v => { if (isNew) { const t0 = +new Date(v.date + 'T09:00'); S.rides.push({ id: uid(), title: v.title, start: { t: t0 }, end: { t: t0 + (v.mins || 0) * 6e4 }, km: v.km, src: 'manual', mood: v.mood, note: v.note }); toast('Ride logged · it joins the battle'); }
      else { Object.assign(r, { title: v.title, km: v.km, mood: v.mood, note: v.note, loop: false }); if (v.mins != null) r.end.t = r.start.t + v.mins * 6e4; } },
    onDelete: !isNew && (() => S.rides = S.rides.filter(x => x !== r)) });
}
function itemForm(it) {
  const isNew = !it; it = it || { id: uid(), name: '', part: 'other', km: 0, months: 0 };
  form({ title: isNew ? 'New service item' : esc(it.name), lede: 'How often it needs doing: by km, by months, or both.',
    fields: [{ k: 'name', l: 'Name', v: it.name, req: 1 }, { k: 'part', l: 'Part on the hologram', type: 'chips', o: PARTS.map(([v, l]) => ({ v, l })), v: it.part },
      { type: 'row', f: [{ k: 'km', l: 'Every (km)', type: 'number', v: it.km || '' }, { k: 'months', l: 'Every (months)', type: 'number', v: it.months || '' }] },
      { type: 'row', f: [{ k: 'lastOdo', l: 'Last done at (km)', type: 'number', v: it.lastOdo ?? '' }, { k: 'lastDate', l: 'Last done on', type: 'date', v: it.lastDate || '' }] }],
    onSave: v => { Object.assign(it, { name: v.name, part: v.part || 'other', km: v.km || 0, months: v.months || 0, lastOdo: v.lastOdo, lastDate: v.lastDate || null, base: true }); if (isNew) S.items.push(it); },
    onDelete: !isNew && (() => S.items = S.items.filter(x => x !== it)) });
}
function renewalForm(r) {
  const isNew = !r; r = r || { id: uid(), name: '', date: '' };
  form({ title: isNew ? 'New renewal' : esc(r.name), lede: 'Its pillar drains as the date gets closer, and turns orange in the last 30 days.',
    fields: [{ k: 'name', l: 'Name', v: r.name, req: 1 }, { type: 'row', f: [{ k: 'date', l: 'Expires on', type: 'date', v: r.date }, { k: 'cost', l: 'Last paid ($)', type: 'number', v: r.cost }] }],
    onSave: v => { Object.assign(r, v); if (isNew) S.renewals.push(r); },
    onDelete: !isNew && (() => S.renewals = S.renewals.filter(x => x !== r)) });
}
const bikeFields = b => [{ k: 'name', l: 'Nickname', v: b.name, req: 1, ph: 'Black Mamba' },
  { type: 'row', f: [{ k: 'model', l: 'Model', v: b.model, ph: 'Yamaha MT-07' }, { k: 'plate', l: 'Plate', v: b.plate, ph: 'FBA1234X' }] },
  { type: 'row', f: [{ k: 'tank', l: 'Tank size (L)', type: 'number', v: b.tank }, { k: 'cc', l: 'Engine (cc)', type: 'number', v: b.cc }] },
  { k: 'licence', l: 'Licence class', type: 'chips', o: ['2B', '2A', '2'].map(v => ({ v, l: 'Class ' + v })), v: b.licence }];
function bikeForm() {
  form({ title: 'Your bike', lede: 'Change the bike type in the Garage, and the hologram rebuilds to match.', fields: bikeFields(S.bike),
    onSave: v => { Object.assign(S.bike, v); } });
}
// lists
const statusDot = s => `<i class="dot ${s}"></i>`;
function intervalsSheet() {
  const rows = S.items.map(i => ({ i, s: itemStatus(i) })).sort((a, b) => (a.s.cls === 'unset') - (b.s.cls === 'unset') || a.s.frac - b.s.frac);
  openSheet('Intervals', 'Every service item, most urgent first. Tap one to change it.', `<div class="list">${rows.map(({ i, s }) => `<button type="button" class="li" data-id="${i.id}">${statusDot(s.cls)}<span class="grow"><span class="t">${esc(i.name)}</span><span class="s">${[i.km ? `every ${num(i.km)} km` : '', i.months ? `${i.months} mo` : ''].filter(Boolean).join(' / ')} · ${s.text}</span>
    <span class="bar ${s.cls}"><i style="width:${Math.round(s.frac * 100)}%"></i></span></span></button>`).join('')}</div><div class="btns"><button type="button" class="btn ghost" id="addItem">Add a service item</button></div>`, sh => {
    $$('.li', sh).forEach(b => b.onclick = () => itemForm(S.items.find(x => x.id === b.dataset.id))); $('#addItem', sh).onclick = () => itemForm(); });
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
  openSheet('Ride journal', `${rides.length} rides · ${num(total)} km`, rides.length ? `<div class="list">${rides.map(r => `<button type="button" class="li" data-id="${r.id}">${statusDot(r.loop ? 'soon' : 'ok')}<span class="grow"><span class="t">${esc(r.title || (r.src === 'auto' ? 'Auto-logged ride' : 'Ride'))}</span><span class="s">${fmtDT(r.start.t)} · ${Math.round(Math.max(0, r.end.t - r.start.t) / 6e4)} min${r.mood ? ' · ' + esc(r.mood) : ''}${r.loop ? ' · add distance' : ''}</span></span><span class="r">${num(r.km, 1)}<small>KM</small></span></button>`).join('')}</div>` : '<div class="empty">No rides yet. Set up auto-log in More and rides appear here on their own.</div>',
    sh => $$('.li', sh).forEach(b => b.onclick = () => rideForm(S.rides.find(x => x.id === b.dataset.id))));
}
function spotsSheet() {
  const m = [...S.marks].sort((a, b) => b.t - a.t);
  openSheet('Marked spots', 'Places you marked mid-ride with “Hey Siri, mark this spot”.', m.length ? `<div class="list">${m.map(x => `<a class="li" style="text-decoration:none" target="_blank" rel="noopener" href="https://maps.apple.com/?ll=${x.lat},${x.lon}&q=${encodeURIComponent(x.note || 'Marked spot')}">${statusDot('ok')}<span class="grow"><span class="t">${esc(x.note || 'Marked spot')}</span><span class="s">${fmtDT(x.t)}</span></span><span class="r">MAP</span></a>`).join('')}</div>` : '<div class="empty">No spots yet. Set up the Siri shortcut in More → Auto-log.</div>');
}
const ACTIONS = { fuel: () => fuelForm(), ride: () => rideForm(), service: () => serviceForm(), odo: odoForm, intervals: intervalsSheet, history: historySheet, fuelhist: fuelHistSheet, journal: journalSheet, spots: spotsSheet };

/* ---------- control deck tiles ---------- */
function renewalsSheet() {
  openSheet('Renewals', 'Tap one to set its date. Each one is a pillar on the deck.', `<div class="list">${S.renewals.map(r => { const s = renewStatus(r); return `<button type="button" class="li" data-id="${r.id}">${statusDot(s.cls)}<span class="grow"><span class="t">${esc(r.name)}</span><span class="s">${r.date ? fmtD(r.date) + ' · ' + s.text : 'No date yet'}</span></span></button>`; }).join('')}</div><div class="btns"><button type="button" class="btn ghost" id="addRen">Add a renewal</button></div>`,
    sh => { $$('.li', sh).forEach(b => b.onclick = () => renewalForm(S.renewals.find(x => x.id === b.dataset.id))); $('#addRen', sh).onclick = () => renewalForm(); });
}
function badgesSheet() {
  openSheet('Badges', 'Each badge levels up from bronze to silver to gold.', `<div class="badge-grid">${BADGES.map(b => { const st = badgeState(b); return `<div class="bdg cut-s t${st.tier}"><div class="tier">${st.tier ? ['', 'BRONZE', 'SILVER', 'GOLD'][st.tier] : 'LOCKED'}</div><b>${b[1]}</b><span>${st.next != null ? `${num(Math.min(st.v, st.next), b[0] === 'sip' ? 1 : 0)} / ${num(st.next)} ${b[6]}` : 'Maxed out'}</span></div>`; }).join('')}</div>`);
}
function soundSheet() {
  openSheet('Sound', 'An original score plays in the background, or loop your own track.', `${F({ k: 's', l: 'Sound and music', type: 'toggle', v: S.prefs.sound })}
    <div class="note">${Snd.own ? 'Playing your track: ' + esc(Snd.own) : 'Playing the built-in score'}</div>
    <div class="btns"><button type="button" class="btn ghost" id="pick">${Snd.own ? 'Back to the built-in score' : 'Use my own track'}</button></div>`, sh => {
    wire(sh); $('[data-k=s]', sh).addEventListener('click', () => { S.prefs.sound = $('.sw', sh).classList.contains('on'); save(); startAudio(); Snd.set(S.prefs.sound); });
    $('#pick', sh).onclick = () => { if (Snd.own) { Snd.dropTrack(); idb('del'); closeSheet(); } else $('#trkIn').click(); };
  });
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
const TILE_SHEETS = { BIKE: bikeForm, RENEWALS: renewalsSheet, 'AUTO-LOG': autoLogSheet, BADGES: badgesSheet, 'RIDE WRAP': () => playWrap(), SOUND: soundSheet, BACKUP: backupSheet };

/* ================= Shortcut events (Cardo / Siri) ================= */
async function processURL() {
  const r = await handleURL(); if (!r) return;
  if (r.ride) {
    toast(`Ride logged · ${num(r.ride.km, 1)} km${r.ride.est === 'estimate' ? ' (estimated)' : ''}`); refresh();
    if (place !== 1) go(1);
    setTimeout(() => rideForm(r.ride), 1600);
  } else { toast(r.msg, r.col === 'red' ? 'over' : ''); refresh(); }
  celebrate();
}

/* ================= audio ================= */
const sndBtn = $('#snd'), trkBtn = $('#trk'), trkIn = $('#trkIn');
function paintAudio() { const on = Snd.ctx && Snd.on; sndBtn.textContent = on ? 'SOUND ON' : 'SOUND OFF'; sndBtn.setAttribute('aria-pressed', String(!!on)); trkBtn.textContent = Snd.own ? '♪ ' + Snd.own.slice(0, 16).toUpperCase() : savedTrack ? '♪ ' + savedTrack.name.slice(0, 16).toUpperCase() : 'MY TRACK'; trkBtn.setAttribute('aria-pressed', String(!!Snd.own)); }
Snd.onChange = paintAudio;
let savedTrack = null;
function startAudio() { if (Snd.ctx || !S.prefs.sound) return; Snd.start(); if (savedTrack) Snd.useTrack(savedTrack.blob, savedTrack.name); paintAudio(); }
sndBtn.addEventListener('click', e => { e.stopPropagation(); if (!Snd.ctx) { S.prefs.sound = true; save(); startAudio(); } else { S.prefs.sound = !Snd.on; save(); Snd.set(S.prefs.sound); } paintAudio(); });
trkBtn.addEventListener('click', e => { e.stopPropagation(); if (Snd.own) { Snd.dropTrack(); savedTrack = null; idb('del'); paintAudio(); } else trkIn.click(); });
trkIn.addEventListener('change', () => { const f = trkIn.files[0]; if (!f) return; const name = f.name.replace(/\.[^.]+$/, ''); if (!Snd.ctx) Snd.start(); Snd.useTrack(f, name); savedTrack = { blob: f, name }; idb('put', savedTrack); S.prefs.sound = true; save(); Snd.set(true); trkIn.value = ''; paintAudio(); toast('Playing ' + name); });
function idb(op, val) { return new Promise(res => { try { const r = indexedDB.open('redline', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv');
  r.onsuccess = () => { try { const tx = r.result.transaction('kv', op === 'get' ? 'readonly' : 'readwrite'), st = tx.objectStore('kv'); const q = op === 'get' ? st.get('track') : op === 'del' ? st.delete('track') : st.put(val, 'track'); q.onsuccess = () => res(q.result); q.onerror = () => res(null); } catch (e) { res(null); } }; r.onerror = () => res(null); } catch (e) { res(null); } }); }
idb('get').then(v => { if (v && v.blob) { savedTrack = v; paintAudio(); } });
addEventListener('pointerdown', () => startAudio(), { capture: true });

/* ================= Ride Wrap ================= */
function playWrap() {
  closeSheet();
  const now = new Date(); let y = now.getFullYear(), m = now.getMonth(), rides = monthRides(y, m);
  if (rides.length < 3) { const d = new Date(y, m - 1, 1), prev = monthRides(d.getFullYear(), d.getMonth()); if (prev.length) { rides = prev; y = d.getFullYear(); m = d.getMonth(); } }
  if (!rides.length) { toast('Log a few rides first, then your Wrap appears'); return; }
  S.stats.wraps++; save();
  const name = new Date(y, m, 1).toLocaleDateString('en-SG', { month: 'long' }), km = rides.reduce((s, r) => s + (r.km || 0), 0), mins = rides.reduce((s, r) => s + Math.max(0, r.end.t - r.start.t), 0) / 6e4;
  const longest = rides.reduce((a, r) => (!a || r.km > a.km) ? r : a, null), days = Array(7).fill(0); rides.forEach(r => days[new Date(r.start.t).getDay()] += r.km || 0);
  const topDay = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'][days.indexOf(Math.max(...days))];
  const slides = [
    { k: 'Ride Wrap', h: esc(name), p: `Your month on ${esc(S.bike.name || 'the bike')}.` },
    { k: 'You rode', h: `${num(km)}<small> KM</small>`, p: km > 800 ? 'That’s more than fifteen times across Singapore.' : km > 200 ? 'That’s like riding to Melaka and back.' : 'Every km counts.' },
    { k: 'Across', h: `${rides.length}<small> RIDES</small>`, p: `About ${num(mins / 60, 1)} hours in the saddle.` },
    longest && { k: 'Longest ride', h: `${num(longest.km, 1)}<small> KM</small>`, p: esc(longest.title || fmtDT(longest.start.t)) },
    { k: 'Favourite day', h: topDay.toUpperCase(), p: 'Your go-to day to ride.' },
    { k: 'End of line', h: 'RIDE ON', p: 'See you on the Grid next month.' }].filter(Boolean);
  const st = $('#story'); st.classList.add('on'); if (window.W) W.paused = true;
  st.innerHTML = `<canvas></canvas><div class="bars">${slides.map(() => '<i><b></b></i>').join('')}</div><button type="button" class="x" aria-label="Close">${ic('x')}</button><div class="slide"></div>`;
  const cv = $('canvas', st), g = cv.getContext('2d'); let idx = -1, alive = true, timer;
  const t0 = performance.now();
  (function draw() { if (!alive) return; requestAnimationFrame(draw); const t = (performance.now() - t0) / 1000, w = cv.width = innerWidth, h = cv.height = innerHeight;
    g.fillStyle = '#010409'; g.fillRect(0, 0, w, h); const hz = h * .62;
    g.strokeStyle = 'rgba(77,243,255,.35)'; g.lineWidth = 1;
    for (let i = -20; i <= 20; i++) { g.beginPath(); g.moveTo(w / 2 + i * 6, hz); g.lineTo(w / 2 + i * w * .18, h); g.stroke(); }
    for (let k = 0; k < 14; k++) { const p = ((k + (t * .8) % 1) / 14), yy = hz + Math.pow(p, 2.2) * (h - hz); g.globalAlpha = p; g.beginPath(); g.moveTo(0, yy); g.lineTo(w, yy); g.stroke(); } g.globalAlpha = 1;
    const gr = g.createLinearGradient(0, hz - 60, 0, hz + 4); gr.addColorStop(0, 'rgba(77,243,255,0)'); gr.addColorStop(1, 'rgba(77,243,255,.35)'); g.fillStyle = gr; g.fillRect(0, hz - 60, w, 64); })();
  const show = i => { if (i >= slides.length) return end(); if (i < 0) i = 0; idx = i; const s = slides[i];
    $$('.bars i b', st).forEach((b, j) => { b.style.transition = 'none'; b.style.width = j < i ? '100%' : '0'; });
    const bar = $$('.bars i b', st)[i]; requestAnimationFrame(() => { bar.style.transition = 'width 4.4s linear'; bar.style.width = '100%'; });
    $('.slide', st).innerHTML = `<div class="k">${s.k}</div><div class="h">${s.h}</div><div class="p">${s.p}</div>`; Snd.whoosh && Snd.whoosh();
    clearTimeout(timer); timer = setTimeout(() => show(idx + 1), 4400); };
  const end = () => { alive = false; clearTimeout(timer); st.classList.remove('on'); st.innerHTML = ''; if (window.W) W.paused = false; celebrate(); };
  $('.x', st).onclick = e => { e.stopPropagation(); end(); };
  st.onclick = e => { if (e.target.closest('.x')) return; if (e.clientX < innerWidth * .3) show(idx - 1); else show(idx + 1); };
  show(0);
}

/* ================= guided setup ================= */
let step = 0, setupSvc = 'fresh';
const STEPS = [
  { k: 'Welcome', h: 'Enter the Grid', p: 'Redline keeps your bike’s service, fuel, renewals and rides in one place, and logs rides on its own. Setup takes about a minute.', cta: 'Begin' },
  { k: 'Step 1 · Bike type', h: 'What do you ride?', p: 'Your hologram builds to match.', place: 2, body: () => `<div class="typegrid" data-type="chips" data-k="type">${BIKE_TYPES.map(([k, n]) => `<button type="button" class="chipbtn" data-v="${k}" aria-pressed="${k === S.bike.type}">${n}</button>`).join('')}</div>` },
  { k: 'Step 2 · Your bike', h: 'Name your ride', p: 'You can change these any time in More.', fields: () => bikeFields(S.bike), save: v => { if (!v.name) { toast('Give your bike a nickname', 'over'); return false; } Object.assign(S.bike, v); } },
  { k: 'Step 3 · Odometer', h: 'Current odometer', p: 'The starting point for every countdown. Rough is fine.', place: 0, fields: () => [{ k: 'odo', l: 'Odometer (km)', type: 'number', v: estOdo() ?? '', ph: '18420', req: 1 }],
    save: v => { if (v.odo == null || isNaN(v.odo)) { toast('Add your odometer reading', 'over'); return false; } S.odoLog = S.odoLog.filter(o => !o.setup); S.odoLog.push({ id: uid(), date: todayISO(), odo: v.odo, setup: true }); } },
  { k: 'Step 4 · Last service', h: 'When was it serviced?', p: 'So Redline knows what’s due next.', place: 2, custom: 'service' },
  { k: 'Step 5 · Renewals', h: 'Never miss a renewal', p: 'Add what you know and skip the rest. They become pillars on the control deck.', place: 4, fields: () => S.renewals.slice(0, 4).map(r => ({ k: r.id, l: r.name, type: 'date', v: r.date })), save: v => { S.renewals.forEach(r => { if (r.id in v) r.date = v[r.id]; }); }, skip: true },
  { k: 'Step 6 · Auto-log', h: 'Ride with an intercom?', p: 'If you do, rides can log themselves when it connects and disconnects.', place: 1, custom: 'intercom' },
  { k: 'Ready', h: 'You’re on the Grid', p: 'Log a fill-up next: two full-tank fill-ups unlock your range and km/L. Set up auto-log in More whenever you like.', place: 0, cta: 'Start riding' },
];
function startSetup() { $('#setup').classList.add('on'); $('#dock').style.display = 'none'; hudEl.style.display = 'none'; step = 0; renderStep(); }
function renderStep() {
  const st = STEPS[step], panel = $('#setupPanel');
  if (st.place != null && window.W && W.place !== st.place) W.go(st.place);
  let body = '';
  if (st.fields) body = st.fields().map(F).join('');
  if (st.body) body = st.body();
  if (st.custom === 'service') body = `<button type="button" class="choice ${setupSvc === 'fresh' ? 'on' : ''}" data-c="fresh"><span><b>Just serviced, or start fresh</b><span>Every countdown starts from today’s odometer</span></span></button>
    <button type="button" class="choice ${setupSvc === 'known' ? 'on' : ''}" data-c="known"><span><b>I know my last service</b><span>Enter the km and what was done</span></span></button>
    <div id="svcKnown" ${setupSvc === 'known' ? '' : 'hidden'}>${[{ type: 'row', f: [{ k: 'sdate', l: 'Date', type: 'date', v: todayISO() }, { k: 'sodo', l: 'At odometer (km)', type: 'number', v: '' }] }, { k: 'sitems', l: 'What was done', type: 'chips', multi: 1, o: S.items.map(i => ({ v: i.id, l: i.name })), v: S.items.slice(0, 2).map(i => i.id) }].map(F).join('')}</div>`;
  if (st.custom === 'intercom') body = [['Cardo', 'Cardo', 'Packtalk, Freecom, Spirit'], ['Other', 'Another intercom', 'Sena, Shoei, any Bluetooth'], ['none', 'No intercom', 'Log rides with a tap or a Siri shortcut']].map(([v, b, s]) => `<button type="button" class="choice ${S.intercom === v ? 'on' : ''}" data-c="${v}"><span><b>${b}</b><span>${s}</span></span></button>`).join('');
  panel.innerHTML = `<div class="prog">${STEPS.map((_, i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div><div class="k">${st.k}</div><h1>${st.h}</h1><p class="lede">${st.p}</p>
    <form id="sform">${body}</form><div class="btns">${step > 0 ? '<button type="button" class="btn ghost sm" id="sBack">Back</button>' : ''}${st.skip ? '<button type="button" class="btn ghost sm" id="sSkip">Skip</button>' : ''}<button type="button" class="btn" id="sNext">${st.cta || 'Continue'}</button></div>`;
  panel.scrollTop = 0; wire(panel);
  $$('.choice', panel).forEach(c => c.onclick = () => { $$('.choice', panel).forEach(x => x.classList.remove('on')); c.classList.add('on'); haptic();
    if (st.custom === 'service') { setupSvc = c.dataset.c; $('#svcKnown', panel).hidden = setupSvc !== 'known'; } else S.intercom = c.dataset.c; });
  panel.addEventListener('pick', e => { const f = e.target.closest('[data-k=type]'); if (!f) return; const v = read(panel).type; if (v) { S.bike.type = v; if (window.W) W.setBike(v); } }, { once: false });
  $('#sBack', panel) && ($('#sBack', panel).onclick = () => { step--; renderStep(); });
  $('#sSkip', panel) && ($('#sSkip', panel).onclick = () => { step++; renderStep(); });
  $('#sNext', panel).onclick = nextStep; $('#sform', panel).onsubmit = e => { e.preventDefault(); nextStep(); };
}
function nextStep() {
  const st = STEPS[step], v = read($('#sform'));
  if (step === 0) startAudio();
  if (st.save && st.save(v) === false) return;
  if (st.custom === 'service') {
    const odo = estOdo() ?? 0;
    if (setupSvc === 'fresh') S.items.forEach(i => { i.lastOdo = odo; i.lastDate = todayISO(); i.base = true; });
    else { if (v.sodo == null || isNaN(v.sodo)) { toast('Add the odometer at that service', 'over'); return; } S.services.push({ id: uid(), date: v.sdate || todayISO(), odo: v.sodo, items: v.sitems, cost: null, shop: '', notes: 'Added during setup' }); syncItems(); }
  }
  if (st.custom === 'intercom' && !S.intercom) S.intercom = 'none';
  save(); syncWorld();
  if (step === STEPS.length - 1) { S.setupDone = true; save(); $('#setup').classList.remove('on'); $('#dock').style.display = ''; hudEl.style.display = ''; place = window.W ? W.place : 0; if (place !== 0) go(0); else renderPlace(); if (window.W) W.rebuild(); return; }
  step++; renderStep();
}

/* ================= boot ================= */
(function boot() {
  syncWorld();
  if (window.W) W.setBike(S.bike.type, true);
  const sp = $('#splash'); sp.classList.add('on'); setTimeout(() => sp.classList.remove('on'), 1900);
  if (!S.setupDone) setTimeout(startSetup, 1500);
  else { renderPlace(); processURL(); }
  paintAudio();
  setInterval(() => { if (S.setupDone && !sheetEl.classList.contains('on')) { syncWorld(); } }, 60000);
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
