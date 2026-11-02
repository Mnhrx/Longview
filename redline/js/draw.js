/* Draw my route: for rides the tracking missed. Tap the roads you rode, in order; Redline routes through each tap
   and fills in the small roads between (OSRM, the same router the rest of the app uses). Works for loops
   ("back where I started") and out-and-backs. Photos with a location become taps too.
   Also: reading the time and place hidden inside a photo (EXIF), before the app shrinks it. */
window.DRAW = (() => {
const PIN = '#F6EBDD', PHOTO = '#5AB8FF', MAXV = 25;
const inArea = (la, lo) => la > 1.1 && la < 1.75 && lo > 103.45 && lo < 104.2; // Singapore and southern Johor

/* ---------- photo details: time taken and GPS, read straight from the file (JPEG or HEIC) ---------- */
async function meta(file) {
  const out = { t: null, lat: null, lon: null, why: '' };
  try {
    const buf = new Uint8Array(await file.slice(0, Math.min(file.size, 6e6)).arrayBuffer());
    let at = -1; // the "Exif\0\0" marker, followed by the TIFF header (MM or II)
    for (let i = 0; i < buf.length - 12; i++) if (buf[i] === 0x45 && buf[i + 1] === 0x78 && buf[i + 2] === 0x69 && buf[i + 3] === 0x66 && buf[i + 4] === 0 && buf[i + 5] === 0 && ((buf[i + 6] === 0x4D && buf[i + 7] === 0x4D) || (buf[i + 6] === 0x49 && buf[i + 7] === 0x49))) { at = i + 6; break; }
    if (at >= 0) {
      const dv = new DataView(buf.buffer, at), le = buf[at] === 0x49, u16 = o => dv.getUint16(o, le), u32 = o => dv.getUint32(o, le);
      const SZ = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
      const ifd = o => { const n = u16(o), m = {}; for (let k = 0; k < n; k++) { const e = o + 2 + k * 12; m[u16(e)] = { type: u16(e + 2), n: u32(e + 4), off: e + 8 }; } return m; };
      const vo = en => (SZ[en.type] || 1) * en.n > 4 ? u32(en.off) : en.off;
      const str = en => { const o = vo(en); let s = ''; for (let k = 0; k < en.n; k++) { const c = dv.getUint8(o + k); if (!c) break; s += String.fromCharCode(c); } return s; };
      const rats = en => { const o = vo(en), a = []; for (let k = 0; k < en.n; k++) a.push(u32(o + k * 8) / (u32(o + k * 8 + 4) || 1)); return a; };
      const i0 = ifd(u32(4));
      if (i0[0x8769]) { const ex = ifd(u32(i0[0x8769].off)), d = ex[0x9003] || ex[0x9004];
        if (d) { const m = str(d).match(/(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/), off = ex[0x9011] ? str(ex[0x9011]) : '';
          if (m) out.t = Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${/^[+-]\d\d:\d\d$/.test(off) ? off : '+08:00'}`) || null; } }
      if (!out.t && i0[0x0132]) { const m = str(i0[0x0132]).match(/(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/); if (m) out.t = Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+08:00`) || null; }
      if (i0[0x8825]) { const gp = ifd(u32(i0[0x8825].off));
        if (gp[2] && gp[4]) { const dm = a => a[0] + (a[1] || 0) / 60 + (a[2] || 0) / 3600; let la = dm(rats(gp[2])), lo = dm(rats(gp[4]));
          if (gp[1] && str(gp[1]) === 'S') la = -la; if (gp[3] && str(gp[3]) === 'W') lo = -lo;
          if (la || lo) { if (inArea(la, lo)) { out.lat = +la.toFixed(6); out.lon = +lo.toFixed(6); } else out.why = 'far'; } } }
    }
  } catch (e) {}
  // no time inside the photo: the file date, if it isn't just "now" (the moment you picked it)
  if (!out.t && file.lastModified && Date.now() - file.lastModified > 10 * 6e4) { out.t = file.lastModified; out.tGuess = true; }
  if (out.lat == null && !out.why) out.why = 'none';
  return out;
}

/* ---------- where a new point goes: the leg it sits closest to, so a loop never gets scrambled ---------- */
const dkm = (a, b) => haversine(a, b);
function bestSlot(chain, p, from = 0) { // chain = [start, ...vias, end]; returns the via index to insert at
  let best = chain.length - 2, bc = Infinity;
  for (let k = Math.max(0, from); k < chain.length - 1; k++) { const c = dkm(chain[k], p) + dkm(p, chain[k + 1]) - dkm(chain[k], chain[k + 1]); if (c < bc) { bc = c; best = k; } }
  return best;
}
// photo spots added to a ride that may already have taps: in the order they were taken, each in its cheapest leg
function merge(start, end, vias, photos) {
  const v = [...(vias || [])], ps = [...photos].filter(p => p.lat != null).sort((a, b) => (a.t || 0) - (b.t || 0)); let after = 0;
  for (const p of ps) { const chain = [start, ...v, end], k = bestSlot(chain, p, after); v.splice(k, 0, { lat: p.lat, lon: p.lon, ph: 1, t: p.t }); after = k + 1; }
  return v.slice(0, MAXV);
}

/* ---------- the map sheet ---------- */
function open(o) {
  const loop = !!o.loop, start = { lat: o.from.lat, lon: o.from.lon }, end = loop ? start : { lat: o.to.lat, lon: o.to.lon };
  let vias = (o.vias || []).map(v => ({ ...v })), hist = [], res = null, seq = 0, busy = false, cam = null, W = 0, H = 0, DPR = 1, raf = 0, unsub = null;
  openSheet(o.title || 'Draw my route', loop ? 'Tap the roads you rode, in order. Redline fills in the small roads between and brings you back to the start.' : 'Tap a road you used and the route bends through it. Tap a pin to remove it.',
    `<div class="drawmap" id="dmap"><canvas></canvas><div class="dzoom"><button type="button" data-z="1" aria-label="Zoom in">+</button><button type="button" data-z="-1" aria-label="Zoom out">−</button><button type="button" data-z="0" aria-label="Fit the route">${ic('target', 2.4)}</button></div><div class="dhint" id="dhint"></div></div>
     <div class="dsum" id="dsum"></div><div class="dpins" id="dpins"></div>
     <div class="btns"><button type="button" class="btn ghost" id="dUndo">Undo</button><button type="button" class="btn ghost" id="dClear">Clear</button></div>
     <button type="button" class="btn" id="dOk" style="width:100%;margin-top:10px">${o.cta || 'Use this route'}</button><div style="height:8px"></div>`, sh => {
    const box = $('#dmap', sh), cv = $('canvas', box), g = cv.getContext('2d');
    const P = (la, lo) => [(lo - cam.x) * MAP.K * cam.z + W / 2, (cam.y - la) * cam.z + H / 2];
    const U = (x, y) => ({ lon: (x - W / 2) / (MAP.K * cam.z) + cam.x, lat: cam.y - (y - H / 2) / cam.z });
    const chain = () => [start, ...vias, end];
    const fitCam = () => { const pts = [...chain(), ...((res && res.path) || []).map(([la, lo]) => ({ lat: la, lon: lo }))]; let b = null;
      pts.forEach(p => { b = b ? [Math.min(b[0], p.lon), Math.min(b[1], p.lat), Math.max(b[2], p.lon), Math.max(b[3], p.lat)] : [p.lon, p.lat, p.lon, p.lat]; });
      const pad = Math.max(.006, (b[3] - b[1]) * .12); cam = MAP.fit([b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad], 26, W, H); cam.z = Math.min(cam.z, 9e4); };
    const clamp = () => { cam.x = Math.min(104.15, Math.max(103.5, cam.x)); cam.y = Math.min(1.65, Math.max(1.15, cam.y)); cam.z = Math.min(2.5e5, Math.max(900, cam.z)); };
    const size = () => { DPR = Math.min(devicePixelRatio || 1, 2); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * DPR; cv.height = H * DPR; if (!cam) fitCam(); draw(); };
    const draw = () => { raf = 0; if (!cv.isConnected) { unsub && unsub(); return; } g.setTransform(DPR, 0, 0, DPR, 0, 0); MAP.land(g, W, H, cam); MAP.street(g, W, H, cam, DPR);
      g.lineCap = g.lineJoin = 'round';
      if (res && res.path && res.path.length > 1) { const col = vias.length ? '#5AB8FF' : '#FFB020', line = () => { g.beginPath(); res.path.forEach(([la, lo], i) => { const [x, y] = P(la, lo); i ? g.lineTo(x, y) : g.moveTo(x, y); }); };
        line(); g.strokeStyle = col + '40'; g.lineWidth = 11; g.stroke(); if (!vias.length) g.setLineDash([8, 6]); line(); g.strokeStyle = col; g.lineWidth = 3.4; g.stroke(); g.setLineDash([]);
        // little arrows so you can see which way round a loop goes
        const n = res.path.length; for (let f = .15; f < 1; f += .2) { const i = Math.min(n - 2, Math.floor(f * (n - 1))), [x1, y1] = P(...res.path[i]), [x2, y2] = P(...res.path[i + 1]), a = Math.atan2(y2 - y1, x2 - x1);
          if (Math.hypot(x2 - x1, y2 - y1) < .5) continue; g.save(); g.translate(x1, y1); g.rotate(a); g.fillStyle = '#FFF8F0'; g.beginPath(); g.moveTo(5, 0); g.lineTo(-4, -4); g.lineTo(-4, 4); g.closePath(); g.fill(); g.restore(); } }
      const dot = (p, fill, r, txt, ring) => { const [x, y] = P(p.lat, p.lon); g.fillStyle = 'rgba(15,12,18,.55)'; g.beginPath(); g.arc(x, y + 1.5, r + 2, 0, 7); g.fill(); g.fillStyle = fill; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
        if (ring) { g.strokeStyle = ring; g.lineWidth = 3; g.beginPath(); g.arc(x, y, r + 4, 0, 7); g.stroke(); }
        if (txt) { g.fillStyle = '#161219'; g.font = `800 ${r > 9 ? 12 : 11}px "Bricolage Grotesque",system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, x, y + .5); } };
      if (!loop) dot(end, '#FF6A2B', 9, 'E'); dot(start, '#FFF8F0', 9, 'S', loop ? '#FF6A2B' : null);
      vias.forEach((v, i) => dot(v, v.ph ? PHOTO : PIN, 10, String(i + 1)));
    };
    const redraw = () => { if (!raf) raf = requestAnimationFrame(draw); };
    unsub = MAP.onTile(redraw);
    const paintInfo = () => {
      const s = $('#dsum', sh), h = $('#dhint', sh);
      if (loop && !vias.length) { s.innerHTML = '<b>0 km</b><span>Tap the first road you rode</span>'; h.textContent = 'Pinch to zoom, drag to move, tap a road'; h.hidden = false; }
      else if (busy && !res) { s.innerHTML = '<b>…</b><span>Routing</span>'; }
      else if (res) { const rd = (res.roads || []).map(x => x === 'WDL' ? 'Causeway' : x === 'TUAS' ? '2nd Link' : x);
        s.innerHTML = `<b>${num(res.km, 1)} km</b><span>${res.mins ? `about ${res.mins} min · ` : ''}${rd.length ? 'via ' + rd.slice(0, 5).join(', ') : vias.length ? 'local roads' : 'quickest way'}${res.src === 'estimate' ? ' · offline, straight lines' : ''}</span>${busy ? '<i class="dspin"></i>' : ''}`; h.hidden = true; }
      $('#dpins', sh).innerHTML = vias.map((v, i) => `<button type="button" class="dpin ${v.ph ? 'ph' : ''}" data-i="${i}"><i>${i + 1}</i><span>${esc(v.name || (v.ph ? 'Photo spot' : 'Your tap'))}</span>${ic('x', 3)}</button>`).join('');
      $$('.dpin', sh).forEach(b => b.onclick = () => { haptic(); remove(+b.dataset.i); });
      $('#dUndo', sh).disabled = !hist.length; $('#dClear', sh).disabled = !vias.length; $('#dOk', sh).disabled = !res || busy || (loop && !vias.length);
    };
    const reroute = async () => {
      if (loop && !vias.length) { res = null; paintInfo(); redraw(); return; }
      const my = ++seq; busy = true; paintInfo();
      const r = await routeKm(chain());
      if (my !== seq || !cv.isConnected) return; busy = false; res = r;
      // pins sit where the router put them (on the road); their road names go in the list so you can check each one
      (r.wps || []).slice(1, -1).forEach((w, i) => { const v = vias[i]; if (v && r.src === 'route') { v.lat = w.lat; v.lon = w.lon; v.name = w.name; } });
      paintInfo(); redraw();
    };
    const add = p => { if (vias.length >= MAXV) { toast(`${MAXV} pins is the most for one ride`, 'over'); return; }
      // near the drawn line? it slots into that stretch. Otherwise it's the next stop before the end
      let k = vias.length;
      if (res && res.path && res.path.length > 1) { const [tx, ty] = P(p.lat, p.lon); let bi = -1, bd = 1e9; res.path.forEach(([la, lo], i) => { const [x, y] = P(la, lo), d = Math.hypot(x - tx, y - ty); if (d < bd) { bd = d; bi = i; } });
        if (bd < 30) { const ch = chain(), idx = []; let from = 0; ch.forEach(c => { let ci = from, cd = 1e9; for (let i = from; i < res.path.length; i++) { const d = dkm(c, { lat: res.path[i][0], lon: res.path[i][1] }); if (d < cd) { cd = d; ci = i; } } idx.push(ci); from = ci; });
          for (let j = 0; j < idx.length - 1; j++) if (bi >= idx[j] && bi <= idx[j + 1]) { k = j; break; } } }
      vias.splice(k, 0, { lat: p.lat, lon: p.lon }); hist.push({ a: 'add', i: k }); haptic(); redraw(); reroute(); };
    const remove = i => { const [v] = vias.splice(i, 1); hist.push({ a: 'del', i, v }); redraw(); reroute(); };
    $('#dUndo', sh).onclick = () => { const h = hist.pop(); if (!h) return; haptic(); if (h.a === 'add') vias.splice(h.i, 1); else if (h.a === 'del') vias.splice(h.i, 0, h.v); else vias = h.v; redraw(); reroute(); };
    $('#dClear', sh).onclick = () => { if (!vias.length) return; haptic(); hist.push({ a: 'clr', v: vias }); vias = []; redraw(); reroute(); };
    $('#dOk', sh).onclick = () => { if (!res) return; haptic(); unsub && unsub();
      o.done({ km: Math.round(res.km * 10) / 10, mins: res.mins, path: res.path, roads: res.roads || [], src: res.src, est: res.src === 'route' ? (vias.length ? 'drawn' : 'route') : 'estimate', loop,
        vias: vias.map(v => ({ lat: +(+v.lat).toFixed(5), lon: +(+v.lon).toFixed(5), ...(v.name ? { name: v.name } : {}), ...(v.ph ? { ph: 1 } : {}) })), names: (res.wps || []).map(w => w.name) }); };
    $$('[data-z]', box).forEach(b => b.onclick = e => { e.stopPropagation(); haptic(); const z = +b.dataset.z; if (!z) fitCam(); else cam.z *= z > 0 ? 1.8 : 1 / 1.8; clamp(); redraw(); });
    // gestures: drag to move, pinch to zoom, tap to drop a pin (or remove one)
    const pts = new Map(); let st = null, moved = false, t0 = 0;
    const snap = () => { const a = [...pts.values()], cx = a.reduce((s, p) => s + p.x, 0) / a.length, cy = a.reduce((s, p) => s + p.y, 0) / a.length; return { cx, cy, d: a.length > 1 ? Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) : 0, cam: { ...cam }, n: a.length }; };
    const xy = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    cv.addEventListener('pointerdown', e => { pts.set(e.pointerId, xy(e)); try { cv.setPointerCapture(e.pointerId); } catch (x) {} if (pts.size === 1) { moved = false; t0 = performance.now(); } else moved = true; st = snap(); });
    cv.addEventListener('pointermove', e => { if (!pts.has(e.pointerId) || !st) return; pts.set(e.pointerId, xy(e)); const s = snap(); if (s.n !== st.n) { st = s; return; }
      if (Math.hypot(s.cx - st.cx, s.cy - st.cy) > 6 || s.n > 1) moved = true; if (!moved) return;
      const z = st.d && s.d ? st.cam.z * s.d / st.d : st.cam.z, c0 = cam; cam = st.cam; const a = U(st.cx, st.cy); cam = c0;
      cam = { x: a.lon - (s.cx - W / 2) / (MAP.K * z), y: a.lat + (s.cy - H / 2) / z, z }; clamp(); redraw(); });
    const up = e => { if (!pts.has(e.pointerId)) return; const p = pts.get(e.pointerId); pts.delete(e.pointerId);
      if (!pts.size) { if (!moved && performance.now() - t0 < 500) { // a tap
          const hit = vias.findIndex(v => { const [x, y] = P(v.lat, v.lon); return Math.hypot(x - p.x, y - p.y) < 18; });
          if (hit >= 0) { haptic(); remove(hit); } else add(U(p.x, p.y)); }
        st = null; } else st = snap(); };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', e => { pts.delete(e.pointerId); st = pts.size ? snap() : null; moved = true; });
    cv.addEventListener('wheel', e => { e.preventDefault(); const p = xy(e), a = U(p.x, p.y); cam.z *= Math.exp(-e.deltaY * .002); clamp(); cam.x = a.lon - (p.x - W / 2) / (MAP.K * cam.z); cam.y = a.lat + (p.y - H / 2) / cam.z; clamp(); redraw(); }, { passive: false });
    requestAnimationFrame(() => { size(); paintInfo(); reroute().then(() => { if (res && !vias.length) { fitCam(); redraw(); } }); });
  });
}

/* ---------- "What can Redline read from a photo?" ---------- */
function checkPhoto() {
  const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
  i.onchange = async () => { const f = i.files[0]; if (!f) return; const m = await meta(f);
    const when = m.t ? new Date(m.t).toLocaleString('en-SG', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : null;
    let road = ''; if (m.lat != null && !window.PREVIEW) try { const j = await (await fetch(`https://router.project-osrm.org/nearest/v1/driving/${m.lon},${m.lat}?number=1`)).json(); road = (j.waypoints && j.waypoints[0] && j.waypoints[0].name) || ''; } catch (e) {}
    openSheet('What Redline read', esc(f.name || 'Your photo'), `<div class="mlist">
      <div class="mrow static"><span class="mi ${m.t ? 'ok' : 'no'}">${ic(m.t ? 'check' : 'x', 2.6)}</span><span class="grow"><b>Time taken</b><span>${when ? esc(when) + (m.tGuess ? ' (from the file date, may be off)' : '') : 'Not in this photo'}</span></span></div>
      <div class="mrow static"><span class="mi ${m.lat != null ? 'ok' : 'no'}">${ic(m.lat != null ? 'check' : 'x', 2.6)}</span><span class="grow"><b>Location</b><span>${m.lat != null ? `Found${road ? ' · nearest road ' + esc(road) : ''}` : m.why === 'far' ? 'Found, but outside Singapore and JB' : 'Not in this photo'}</span></span></div></div>
      ${m.lat != null ? miniMap(m.lat, m.lon, 340, 150, 16) : `<p class="gnote">iPhone often removes the location when a photo is picked inside an app. If that happened, the photo’s time still helps, and you can tap the roads on the map instead.<br><br>Worth a try: in Photos, tap Share → Options and make sure Location is on, then Save to Files. Pick it from <b>Choose File</b> instead of Photo Library.</p>`}
      <p class="gnote">${m.lat != null ? 'Photos like this drop a pin on your ride’s route by themselves.' : ''} Nothing from the photo leaves your phone.</p>`);
  };
  i.click();
}

return { open, meta, merge, checkPhoto, inArea };
})();
