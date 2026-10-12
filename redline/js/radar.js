/* Redline rain radar: NEA's rain-area images (one every 5 minutes) for the last hour, stitched and played
   over Redline's own map of Singapore and southern Johor. Images come straight from weather.gov.sg. */
window.RADAR = (() => {
  // where NEA's 70 km radar picture sits on the map (corners matched against the coastline)
  const TL = [103.555423, 1.47721], BR = [104.13393, 1.15320];
  const STEP = 3e5, FRAMES = 12;
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
  async function frames() {
    const base = Math.floor(Date.now() / STEP) * STEP;
    // NEA publishes a few minutes late, so ask for one extra and keep whatever loads
    const got = (await Promise.all(Array.from({ length: FRAMES + 2 }, (_, i) => loadImg(base - i * STEP)))).filter(Boolean).sort((a, b) => a.t - b.t);
    return got.slice(-FRAMES);
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

  function open() {
    openSheet('Rain radar', 'The last hour of NEA’s rain radar, a new picture every 5 minutes.', `
      <div class="radar"><canvas id="rdc" aria-label="Animated rain radar map"></canvas><div class="rdtime"><b id="rdT">Loading…</b><span id="rdA"></span></div><div class="rdload" id="rdL"><i></i><i></i><i></i></div></div>
      <div class="rdbar"><button type="button" class="rdplay" id="rdP" aria-label="Pause">${ic('pause', 2.6)}</button><div class="rdscrub" id="rdS"></div></div>
      <div class="rdkey"><span>Light</span><i></i><span>Heavy</span></div>
      <p class="rdnote" id="rdN">Source: NEA (weather.gov.sg). Your dot is where you last parked or rode.</p>`, async sh => {
      const cv = $('#rdc', sh), g = cv.getContext('2d'), DPR = Math.min(devicePixelRatio || 1, 2);
      const W = cv.clientWidth, H = cv.clientHeight; cv.width = W * DPR; cv.height = H * DPR;
      const cam = MAP.fit([TL[0], BR[1], BR[0], TL[1]], 0, W, H), K = MAP.K;
      const P = (lo, la) => [(lo - cam.x) * K * cam.z + W / 2, (cam.y - la) * cam.z + H / 2];
      const [x0, y0] = P(TL[0], TL[1]), [x1, y1] = P(BR[0], BR[1]), me = refPoint();
      const list = window.PREVIEW ? sampleFrames() : await frames();
      $('#rdL', sh).remove();
      if (!list.length) { $('#rdT', sh).textContent = 'Radar unavailable'; $('#rdA', sh).textContent = 'NEA didn’t respond. Try again in a bit.'; draw(-1, 0); return; }
      if (list[0].sample) $('#rdN', sh).textContent = 'Sample radar for the preview. The installed app plays NEA’s real radar.';
      const scrub = $('#rdS', sh); scrub.innerHTML = list.map((f, i) => `<button type="button" data-i="${i}" aria-label="${fmt(f.t)}"></button>`).join('');
      let pos = 0, playing = !matchMedia('(prefers-reduced-motion: reduce)').matches, last = 0, hold = 0, shown = -1;
      function draw(i, mix) {
        g.setTransform(DPR, 0, 0, DPR, 0, 0); MAP.land(g, W, H, cam);
        const put = (f, a) => { if (!f || a <= 0) return; g.globalAlpha = a * .9; g.drawImage(f.img, x0, y0, x1 - x0, y1 - y0); };
        if (i >= 0) { put(list[i], 1 - mix); put(list[(i + 1) % list.length], mix); } g.globalAlpha = 1;
        // coastline on top so the rain reads against the land
        for (const r of MAP.GEO.sg) { g.beginPath(); r.forEach(([lo, la], k) => { const [x, y] = P(lo, la); k ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.strokeStyle = 'rgba(246,235,221,.35)'; g.lineWidth = 1; g.stroke(); }
        const [mx, my] = P(me.lon, me.lat), pulse = (performance.now() / 1400) % 1;
        g.fillStyle = `rgba(255,106,43,${.35 * (1 - pulse)})`; g.beginPath(); g.arc(mx, my, 6 + pulse * 16, 0, 7); g.fill();
        g.fillStyle = '#FF6A2B'; g.strokeStyle = '#FFF8F0'; g.lineWidth = 2.5; g.beginPath(); g.arc(mx, my, 6, 0, 7); g.fill(); g.stroke();
      }
      function label(i) { if (i === shown) return; shown = i; const f = list[i], ago = Math.round((list[list.length - 1].t - f.t) / 6e4);
        $('#rdT', sh).textContent = fmt(f.t); $('#rdA', sh).textContent = i === list.length - 1 ? 'Latest' : `${ago} min before`;
        $$('button', scrub).forEach((b, k) => b.classList.toggle('on', k <= i)); }
      function loop(now) {
        if (!cv.isConnected || !sheetEl.classList.contains('on')) return;
        const dt = Math.min(100, now - (last || now)); last = now;
        if (playing) { if (hold > 0) hold -= dt; else { pos += dt / 650; if (pos >= list.length - 1) { pos = list.length - 1; hold = 1600; } } if (hold <= 0 && pos >= list.length - 1) pos = 0; }
        const i = Math.floor(pos), mix = Math.min(1, Math.max(0, (pos - i - .35) / .65));
        draw(i, i >= list.length - 1 ? 0 : mix); label(mix > .5 ? Math.min(i + 1, list.length - 1) : i);
        requestAnimationFrame(loop);
      }
      const setPlay = v => { playing = v; const b = $('#rdP', sh); b.innerHTML = ic(v ? 'pause' : 'play', 2.6); b.setAttribute('aria-label', v ? 'Pause' : 'Play'); };
      $('#rdP', sh).onclick = () => { haptic(); if (!playing && pos >= list.length - 1) { pos = 0; hold = 0; } setPlay(!playing); };
      const seek = e => { const r = scrub.getBoundingClientRect(), k = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); pos = Math.round(k * (list.length - 1)); hold = 0; setPlay(false); };
      scrub.addEventListener('pointerdown', e => { seek(e); scrub.setPointerCapture(e.pointerId); }); scrub.addEventListener('pointermove', e => { if (e.buttons) seek(e); });
      if (!playing) pos = list.length - 1; setPlay(playing); requestAnimationFrame(loop);
    });
  }
  return { open };
})();
