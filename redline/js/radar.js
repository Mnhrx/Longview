/* Redline rain radar: NEA's rain-area images (one every 5 minutes) for the last hour, stitched into a smooth
   time-lapse over Redline's own map of Singapore and southern Johor. Images come straight from weather.gov.sg.
   One player runs both the small radar on Home and the full-size one. */
window.RADAR = (() => {
  // where NEA's 70 km radar picture sits on the map (corners matched against the coastline)
  const TL = [103.555423, 1.47721], BR = [104.13393, 1.15320];
  const STEP = 3e5, FRAMES = 12, PER = 320, HOLD = 1300; // ms per picture, pause on the latest
  const pad = n => String(n).padStart(2, '0');
  const stamp = ms => { const d = new Date(ms + 8 * 3600e3); return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`; };
  const urls = dt => [`https://www.weather.gov.sg/files/rainarea/50km/v2/dpsri_70km_${dt}0000dBR.dpsri.png`, `https://www.nea.gov.sg/docs/default-source/rain-area/dpsri_70km_${dt}0000dBR.dpsri.png`];
  const cache = new Map();
  function loadImg(t) {
    const dt = stamp(t); if (cache.has(dt)) return cache.get(dt);
    const p = new Promise(res => { const list = urls(dt); let i = 0; const img = new Image(); img.referrerPolicy = 'no-referrer'; img.decoding = 'async';
      img.onload = () => res({ t, img }); img.onerror = () => { i++; if (i < list.length) img.src = list[i]; else { cache.delete(dt); res(null); } }; img.src = list[0]; });
    cache.set(dt, p); return p;
  }
  let set = null, setAt = 0;
  function frames() {
    if (set && Date.now() - setAt < 4 * 6e4) return set;
    setAt = Date.now();
    if (window.PREVIEW) return (set = Promise.resolve(sampleFrames()));
    const base = Math.floor(Date.now() / STEP) * STEP;
    // NEA publishes a few minutes late, so ask for two extra and keep whatever loads
    return (set = Promise.all(Array.from({ length: FRAMES + 2 }, (_, i) => loadImg(base - i * STEP))).then(a => a.filter(Boolean).sort((x, y) => x.t - y.t).slice(-FRAMES)));
  }
  // preview only: fake storm cells drifting across the island so the player has something to play
  const PAL = [[64, 255, 253], [0, 208, 212], [0, 166, 80], [118, 214, 0], [255, 236, 0], [255, 170, 0], [255, 85, 0], [230, 0, 40]];
  function sampleFrames() {
    const base = Math.floor(Date.now() / STEP) * STEP, cells = [[.95, .25, 70, 1], [1.1, .62, 110, .8], [.7, .78, 50, .6], [1.35, .45, 90, .95]];
    return Array.from({ length: FRAMES }, (_, k) => { const c = document.createElement('canvas'); c.width = 480; c.height = 270; const x = c.getContext('2d');
      for (const [cx, cy, r, s] of cells) { const px = (cx - k * .055) * 480, py = (cy + Math.sin(k / 3 + cx) * .04) * 270, rr = r * (0.75 + .35 * Math.sin(k / 2.5 + cy * 5));
        for (let i = 0; i < PAL.length; i++) { const f = (i + 1) / PAL.length; if (f > s + .15) continue; const [R, G, B] = PAL[i]; x.fillStyle = `rgba(${R},${G},${B},.85)`; x.beginPath();
          for (let a = 0; a < 6.3; a += .3) { const w = rr * (1 - f * .85) * (1 + .18 * Math.sin(a * 3 + k + i)); x.lineTo(px + Math.cos(a) * w * 1.3, py + Math.sin(a) * w); } x.fill(); } }
      return { t: base - (FRAMES - 1 - k) * STEP, img: c, sample: true }; });
  }
  const fmt = t => new Date(t).toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
  const smooth = x => x * x * (3 - 2 * x);

  // play the radar into a canvas. o = { time, ago, scrub, play, note, alive() }
  async function player(cv, o = {}) {
    const g = cv.getContext('2d'), DPR = Math.min(devicePixelRatio || 1, 2);
    let W = 0, H = 0, cam, P, x0, y0, x1, y1;
    const size = () => { W = cv.clientWidth; H = cv.clientHeight; if (!W || !H) return; cv.width = W * DPR; cv.height = H * DPR;
      cam = MAP.fit([TL[0] + .03, BR[1] + .02, BR[0] - .03, TL[1] - .02], 0, W, H); P = (lo, la) => [(lo - cam.x) * MAP.K * cam.z + W / 2, (cam.y - la) * cam.z + H / 2];
      [x0, y0] = P(TL[0], TL[1]); [x1, y1] = P(BR[0], BR[1]); };
    size();
    const list = await frames(); const me = refPoint();
    if (o.load) o.load.remove();
    if (!list.length) { if (o.time) o.time.textContent = 'Radar unavailable'; if (o.ago) o.ago.textContent = 'NEA didn’t respond. Try again soon.'; draw(-1, 0, 0); return; }
    if (o.note && list[0].sample) o.note.textContent = 'Sample radar for the preview. The installed app plays NEA’s real radar.';
    const n = list.length, RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (o.scrub) o.scrub.innerHTML = list.map(f => `<button type="button" tabindex="-1" aria-label="${fmt(f.t)}"></button>`).join('');
    let pos = RM ? n - 1 : 0, playing = !RM, last = 0, hold = 0, shown = -1, raf = 0;
    function draw(i, j, mix) {
      g.setTransform(DPR, 0, 0, DPR, 0, 0); MAP.land(g, W, H, cam);
      const put = (f, a) => { if (!f || a <= 0.001) return; g.globalAlpha = a * .9; g.drawImage(f.img, x0, y0, x1 - x0, y1 - y0); };
      if (i >= 0) { put(list[i], 1 - mix); put(list[j], mix); } g.globalAlpha = 1;
      for (const r of MAP.GEO.sg) { g.beginPath(); r.forEach(([lo, la], k) => { const [x, y] = P(lo, la); k ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.strokeStyle = 'rgba(246,235,221,.35)'; g.lineWidth = 1; g.stroke(); }
      const [mx, my] = P(me.lon, me.lat), pulse = (performance.now() / 1400) % 1;
      g.fillStyle = `rgba(255,106,43,${.35 * (1 - pulse)})`; g.beginPath(); g.arc(mx, my, 5 + pulse * 14, 0, 7); g.fill();
      g.fillStyle = '#FF6A2B'; g.strokeStyle = '#FFF8F0'; g.lineWidth = 2; g.beginPath(); g.arc(mx, my, 5, 0, 7); g.fill(); g.stroke();
    }
    function label(i) { if (i === shown) return; shown = i; const ago = Math.round((list[n - 1].t - list[i].t) / 6e4);
      if (o.time) o.time.textContent = fmt(list[i].t); if (o.ago) o.ago.textContent = i === n - 1 ? 'Latest' : `${ago} min before`;
      if (o.scrub) [...o.scrub.children].forEach((b, k) => b.classList.toggle('on', k <= i)); }
    // a continuous time-lapse: every picture melts into the next, a short pause on the latest, then it melts back to the start
    function loop(now) {
      raf = 0; if (o.alive && !o.alive()) { last = 0; return; }
      const dt = Math.min(80, now - (last || now)); last = now;
      if (playing) { if (hold > 0) hold -= dt; else { const before = pos; pos += dt / PER; if (before < n - 1 && pos >= n - 1) { pos = n - 1; hold = HOLD; } if (pos >= n) pos -= n; } }
      const i = Math.floor(pos) % n, j = (i + 1) % n, mix = smooth(pos - Math.floor(pos));
      draw(i, j, mix); label(mix > .5 ? j : i);
      raf = requestAnimationFrame(loop);
    }
    const setPlay = v => { playing = v; if (o.play) { o.play.innerHTML = ic(v ? 'pause' : 'play', 2.6); o.play.setAttribute('aria-label', v ? 'Pause' : 'Play'); } };
    if (o.play) o.play.onclick = e => { e.stopPropagation(); haptic(); setPlay(!playing); };
    if (o.scrub) { const seek = e => { const r = o.scrub.getBoundingClientRect(), k = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); pos = Math.round(k * (n - 1)); hold = 0; setPlay(false); };
      o.scrub.addEventListener('pointerdown', e => { seek(e); o.scrub.setPointerCapture(e.pointerId); }); o.scrub.addEventListener('pointermove', e => { if (e.buttons) seek(e); }); }
    setPlay(playing);
    const api = { wake() { if (!raf) { last = 0; raf = requestAnimationFrame(loop); } }, resize() { size(); } };
    api.wake(); return api;
  }

  function open() {
    openSheet('Rain radar', 'The last hour of NEA’s rain radar, a new picture every 5 minutes.', `
      <div class="radar"><canvas id="rdc" aria-label="Animated rain radar map"></canvas><div class="rdtime"><b id="rdT">Loading…</b><span id="rdA"></span></div><div class="rdload" id="rdL"><i></i><i></i><i></i></div></div>
      <div class="rdbar"><button type="button" class="rdplay" id="rdP" aria-label="Pause">${ic('pause', 2.6)}</button><div class="rdscrub" id="rdS"></div></div>
      <div class="rdkey"><span>Light</span><i></i><span>Heavy</span></div>
      <p class="rdnote" id="rdN">Source: NEA (weather.gov.sg). Your dot is where you last parked or rode.</p>`, sh => {
      const cv = $('#rdc', sh);
      player(cv, { time: $('#rdT', sh), ago: $('#rdA', sh), scrub: $('#rdS', sh), play: $('#rdP', sh), note: $('#rdN', sh), load: $('#rdL', sh), alive: () => cv.isConnected && sheetEl.classList.contains('on') });
    });
  }
  // the small radar on Home: plays only while it's on screen and the app is open
  let homeP = null, homeCv = null, seen = false, io = null;
  async function mountHome(cv) {
    if (!cv) return; homeCv = cv; seen = true;
    if (io) io.disconnect(); io = new IntersectionObserver(es => { seen = es[0].isIntersecting; if (seen && homeP) homeP.wake(); }); io.observe(cv);
    const box = cv.parentElement;
    homeP = await player(cv, { time: $('.rdtime b', box), ago: $('.rdtime span', box), load: $('.rdload', box), alive: () => cv === homeCv && cv.isConnected && seen && !document.hidden && !sheetEl.classList.contains('on') });
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && homeP) homeP.wake(); });
  return { open, mountHome, wake: () => homeP && homeP.wake() };
})();
