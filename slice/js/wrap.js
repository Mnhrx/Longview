/* Ride Wrap: your month as an animated story. Full-screen slides, each one a colour, a huge number and something moving.
   Tap right for next, left for back, hold to pause. Slides change with a circular wipe from where you tapped. */
window.WRAP = (() => {
const $ = (q, r = document) => r.querySelector(q), $$ = (q, r = document) => [...r.querySelectorAll(q)];
const RMx = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const A = (el, kf, o) => { if (!el) return; if (RMx()) { const last = kf[kf.length - 1]; Object.assign(el.style, { opacity: last.opacity ?? '', transform: last.transform ?? '' }); return; } return el.animate(kf, Object.assign({ fill: 'both', easing: 'cubic-bezier(.2,1.2,.35,1)' }, o)); };
const pop = (el, d = 0, dur = 700) => A(el, [{ transform: 'translateY(40px) scale(.7)', opacity: 0 }, { transform: 'none', opacity: 1 }], { delay: d, duration: dur });
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function letters(text, cls = '') { return `<span class="lt ${cls}" aria-label="${text}">${[...text].map(c => `<span aria-hidden="true">${c === ' ' ? '&nbsp;' : c}</span>`).join('')}</span>`; }
function dropLetters(el, d = 0) { $$('span', el).forEach((s, i) => A(s, [{ transform: 'translateY(110%) rotate(12deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { delay: d + i * 45, duration: 750 })); }
function count(el, to, dur = 1300, d = 0, dec = 0) { if (!el) return; el.textContent = (0).toFixed(dec); if (RMx()) { el.textContent = num(to, dec); return; }
  setTimeout(() => { const t0 = performance.now(); (function f(now) { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 4); el.textContent = num(to * e, dec); if (k < 1) requestAnimationFrame(f); })(t0); }, d); }
// chunky floating shapes in the background of every slide
function shapes(host, cols, n = 9) {
  const kinds = ['50%', '14px', '50% 50% 0 50%', '999px'];
  for (let i = 0; i < n; i++) { const s = document.createElement('i'), z = 18 + Math.random() * 46; s.className = 'fshape';
    s.style.cssText = `left:${Math.random() * 100}%;top:${Math.random() * 100}%;width:${z * (i % 4 === 3 ? 2.2 : 1)}px;height:${z}px;background:${cols[i % cols.length]};border-radius:${kinds[i % 4]};opacity:.9`;
    host.appendChild(s);
    A(s, [{ transform: 'translate(-50%,-50%) scale(0) rotate(0)' }, { transform: `translate(-50%,-50%) scale(1) rotate(${Math.random() * 90 - 45}deg)` }], { duration: 900, delay: 100 + i * 60 });
    if (!RMx()) s.animate([{ translate: '0 0' }, { translate: `${Math.random() * 40 - 20}px ${Math.random() * 60 - 30}px` }], { duration: 3000 + Math.random() * 3000, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out', composite: 'add' }); }
}
function confetti(host, n = 60) { if (RMx()) return; const cols = ['#FF6A2B', '#FFD84D', '#45E0A2', '#5AB8FF', '#F6EBDD', '#FF3B3B'];
  for (let i = 0; i < n; i++) { const c = document.createElement('i'), w = 8 + Math.random() * 10; c.className = 'conf'; c.style.cssText = `left:${50 + (Math.random() - .5) * 20}%;top:45%;width:${w}px;height:${w * (i % 2 ? .45 : 1)}px;background:${cols[i % 6]};border-radius:${i % 3 ? '3px' : '50%'}`; host.appendChild(c);
    const a = Math.random() * Math.PI * 2, r = 150 + Math.random() * 260; c.animate([{ transform: 'translate(-50%,-50%) scale(0)' }, { transform: `translate(calc(-50% + ${Math.cos(a) * r}px), calc(-50% + ${Math.sin(a) * r - 80}px)) rotate(${Math.random() * 720}deg) scale(1)`, offset: .45 }, { transform: `translate(calc(-50% + ${Math.cos(a) * r * 1.2}px), calc(-50% + ${Math.sin(a) * r + 420}px)) rotate(${Math.random() * 1440}deg) scale(.8)` }], { duration: 2400 + Math.random() * 1200, easing: 'cubic-bezier(.1,.7,.3,1)', fill: 'forwards' }); }
}
const BIKE = `<svg class="wbike" viewBox="0 0 250 150" fill="none" stroke="#120E15" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <g class="wheel"><circle cx="52" cy="104" r="36" fill="#F6EBDD"/><circle cx="52" cy="104" r="9" fill="#120E15"/><path d="M52 72v64M20 104h64"/></g>
  <g class="wheel w2"><circle cx="200" cy="104" r="36" fill="#F6EBDD"/><circle cx="200" cy="104" r="9" fill="#120E15"/><path d="M200 72v64M168 104h64"/></g>
  <path d="M52 104 L98 82 L150 86 L176 60M200 104 L176 46 L170 34M160 32 L184 30M62 54 L108 50M112 92 Q100 118 70 116"/>
  <path d="M98 82 L108 50 Q132 36 160 46 L150 86 Z" fill="#FF6A2B"/><circle cx="183" cy="58" r="9" fill="#FFD84D"/></svg>`;

/* ---------- the month, in numbers ---------- */
function data(y, m) {
  const rides = monthRides(y, m).sort((a, b) => a.start.t - b.start.t), km = rides.reduce((s, r) => s + (r.km || 0), 0), mins = rides.reduce((s, r) => s + Math.max(0, r.end.t - r.start.t), 0) / 6e4;
  const end = new Date(y, m + 1, 1).getTime(), after = S.rides.filter(r => r.start.t >= end).reduce((s, r) => s + (r.km || 0), 0), endOdo = (estOdo() || 0) - after, startOdo = endOdo - km;
  const longest = rides.reduce((a, r) => (!a || r.km > a.km) ? r : a, null);
  const jb = rides.filter(r => r.path && r.path.some(([la, lo]) => !MAP.inSG(la, lo)));
  const inM = d => { const x = new Date(d); return x.getFullYear() === y && x.getMonth() === m; };
  const fills = S.fuel.filter(f => inM(f.date)).sort((a, b) => a.odo - b.odo), litres = fills.reduce((s, f) => s + (+f.litres || 0), 0), cost = fills.reduce((s, f) => s + fuelSgd(f), 0);
  const jobs = S.services.filter(s => inM(s.date)).flatMap(s => s.items.map(id => S.items.find(i => i.id === id)).filter(Boolean));
  const hrs = rides.map(r => new Date(r.start.t)), n = rides.length || 1;
  const night = hrs.filter(d => d.getHours() >= 20 || d.getHours() < 5).length / n, dawn = hrs.filter(d => d.getHours() >= 5 && d.getHours() < 8).length / n,
    wknd = hrs.filter(d => [0, 6].includes(d.getDay())).length / n, comm = hrs.filter(d => ![0, 6].includes(d.getDay()) && ((d.getHours() >= 7 && d.getHours() < 10) || (d.getHours() >= 17 && d.getHours() < 20))).length / n;
  const persona = night >= .4 ? ['Night rider', 'moon', 'The roads are yours after dark.'] : wknd >= .5 ? ['Weekend warrior', 'sun', 'Saturdays and Sundays belong to the bike.'] : comm >= .5 ? ['Daily commuter', 'odo', 'Rain or shine, you ride to work.'] : dawn >= .3 ? ['Early bird', 'sun', 'Out before the jam.'] : ['All-day rider', 'sun', 'Any hour is a good hour.'];
  return { y, m, name: MONTHS[m], rides, km, mins, longest, jb, fills, litres, cost, jobs, persona, startOdo, endOdo, kpl: fuelStats().kpl };
}

/* ---------- drawing trails for the map slides ---------- */
function mapDraw(cv, rides, opts = {}) {
  const G = MAP.GEO, K = Math.cos(1.35 * Math.PI / 180), dpr = Math.min(devicePixelRatio || 1, 2), W = cv.clientWidth, H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr;
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  let b = null; for (const r of rides) for (const [la, lo] of r.path || []) { if (!b) b = [lo, la, lo, la]; b = [Math.min(b[0], lo), Math.min(b[1], la), Math.max(b[2], lo), Math.max(b[3], la)]; }
  if (!b || opts.sg) b = [Math.min(b ? b[0] : 104, 103.6), Math.min(b ? b[1] : 2, 1.21), Math.max(b ? b[2] : 0, 104.06), Math.max(b ? b[3] : 0, 1.48)];
  const pad = opts.pad || 24, z = Math.min((W - pad * 2) / ((b[2] - b[0]) * K), (H - pad * 2) / (b[3] - b[1])), cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
  const P = (lo, la) => [(lo - cx) * K * z + W / 2, (cy - la) * z + H / 2];
  const base = () => { g.globalCompositeOperation = 'source-over'; g.fillStyle = opts.bg || '#0F0C12'; g.fillRect(0, 0, W, H);
    for (const set of [G.my, G.id, G.sg]) for (const r of set) { g.beginPath(); r.forEach(([lo, la], i) => { const [x, y] = P(lo, la); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.fillStyle = set === G.sg ? (opts.land || '#2A2330') : (opts.land2 || '#211B26'); g.fill(); } };
  const trail = (p, n, hot) => { g.globalCompositeOperation = 'lighter'; g.lineCap = 'round'; g.lineJoin = 'round';
    for (const [w, c] of [[12, 'rgba(90,184,255,.16)'], [4.5, 'rgba(90,184,255,.55)'], [hot ? 2.6 : 1.6, hot ? '#fff' : 'rgba(235,246,255,.9)']]) { g.beginPath(); for (let i = 0; i < n; i++) { const [x, y] = P(p[i][1], p[i][0]); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.strokeStyle = c; g.lineWidth = w; g.stroke(); } };
  return { base, trail, P, g };
}
function animateTrails(cv, rides, onRide, opts = {}) {
  const d = mapDraw(cv, rides, opts), list = rides.filter(r => r.path && r.path.length > 1), per = opts.per || 650; let raf, t0 = performance.now();
  const frame = now => { const t = now - t0 - (opts.delay || 0); d.base(); let i = 0;
    for (const r of list) { const k = Math.max(0, Math.min(1, (t - i * per * .55) / per)); if (k > 0) { d.trail(r.path, Math.max(2, Math.ceil(r.path.length * k)), opts.hot && r.id === opts.hot); if (k < 1 && onRide) onRide(i + 1); } i++; }
    if (opts.dot) { const r = list[0], k = ((t / 2600) % 1 + 1) % 1, p = r.path[Math.floor(k * (r.path.length - 1))], [x, y] = d.P(p[1], p[0]); d.g.globalCompositeOperation = 'source-over'; d.g.fillStyle = '#FF6A2B'; d.g.beginPath(); d.g.arc(x, y, 9, 0, 7); d.g.fill(); d.g.strokeStyle = '#fff'; d.g.lineWidth = 3; d.g.stroke(); }
    if (opts.dot || t < list.length * per * .55 + per + 100) raf = requestAnimationFrame(frame); };
  if (RMx()) { d.base(); list.forEach(r => d.trail(r.path, r.path.length, opts.hot === r.id)); return () => {}; }
  raf = requestAnimationFrame(frame); return () => cancelAnimationFrame(raf);
}

/* ---------- the slides ---------- */
const SL = {
  intro(el, D) {
    el.className = 'ws s-plum'; el.innerHTML = `<div class="fs"></div><div class="wc"><span class="chip">RIDE WRAP</span><h1 class="mega" style="font-size:min(${(100 / (D.name.length * .76)).toFixed(1)}vw, ${Math.round(540 / (D.name.length * .76))}px)">${letters(D.name.toUpperCase())}</h1><p class="yr">${D.y}</p>
      <div class="wodo"><span>ODO</span><div class="wdrums">${Array.from({ length: 6 }, () => `<div class="wd"><div class="ws2">${Array.from({ length: 40 }, (_, i) => `<i>${i % 10}</i>`).join('')}</div></div>`).join('')}</div><span>KM</span></div>
      <p class="sub">${D.rides.length} rides on ${esc(S.bike.name || 'the bike')}</p></div>`;
    return () => { shapes($('.fs', el), ['#FF6A2B', '#FFD84D', '#45E0A2', '#5AB8FF'], 10); pop($('.chip', el), 100); dropLetters($('.mega', el), 250); pop($('.yr', el), 700); pop($('.wodo', el), 900); pop($('.sub', el), 1400);
      const a = String(Math.round(D.startOdo)).padStart(6, '0').slice(-6), b = String(Math.round(D.endOdo)).padStart(6, '0').slice(-6);
      $$('.ws2', el).forEach((s, i) => { s.style.transform = `translateY(${-(+a[i]) * 2.5}%)`; const spins = Math.max(0, i - 2), idx = +b[i] + 10 * (spins + (+b[i] < +a[i] || spins ? 1 : 0));
        A(s, [{ transform: `translateY(${-(+a[i]) * 2.5}%)` }, { transform: `translateY(${-Math.min(39, idx) * 2.5}%)` }], { delay: 1300 + (5 - i) * 90, duration: 1600 + spins * 300, easing: 'cubic-bezier(.3,1.15,.45,1)' }); }); };
  },
  distance(el, D) {
    const cmp = D.km >= 50 ? `That's Changi to Tuas ${Math.max(1, Math.round(D.km / 50))} times.` : `That's ${Math.max(1, Math.round(D.km / 5))} laps of the Marina Bay street circuit.`;
    el.className = 'ws s-sky'; el.innerHTML = `<div class="fs"></div><div class="wc"><p class="kick">You rode</p><div class="huge"><b class="n">0</b><small>km</small></div><p class="line">${cmp}</p><p class="sub2">${Math.round(D.mins / 60)} hours in the saddle</p></div>
      <div class="road"><div class="lane"></div><div class="rider">${BIKE}<i class="sp"></i><i class="sp s2"></i><i class="sp s3"></i></div></div>`;
    return () => { shapes($('.fs', el), ['#F6EBDD', '#FFD84D', '#FF6A2B'], 7); pop($('.kick', el), 50); pop($('.huge', el), 200, 900); count($('.n', el), D.km, 1600, 250);
      A($('.huge', el), [{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { delay: 1850, duration: 450, easing: 'ease-out', fill: 'none' }); pop($('.line', el), 1900); pop($('.sub2', el), 2300);
      A($('.rider', el), [{ transform: 'translateX(-120%)' }, { transform: 'translateX(0)' }], { delay: 400, duration: 1400, easing: 'cubic-bezier(.2,1,.3,1)' }); };
  },
  map(el, D) {
    el.className = 'ws s-dark'; el.innerHTML = `<div class="wc top"><p class="kick">Every ride, traced</p><h2 class="big"><b class="rc">0</b> of ${D.rides.length}</h2></div><canvas class="wmap"></canvas><p class="cap">${D.jb.length ? 'Singapore and a bit of Johor' : 'Your Singapore'}, in light.</p>`;
    let stop; return () => { pop($('.kick', el), 50); pop($('.big', el), 150); pop($('.cap', el), 600);
      stop = animateTrails($('.wmap', el), D.rides, i => { $('.rc', el).textContent = i; }, { per: Math.min(800, 4200 / Math.max(1, D.rides.length)), delay: 400, sg: true });
      setTimeout(() => { const rc = $('.rc', el); if (rc) rc.textContent = D.rides.length; }, 5200); return () => stop && stop(); };
  },
  longest(el, D) {
    const r = D.longest; el.className = 'ws s-sky'; el.innerHTML = `<div class="fs"></div><div class="wc top"><p class="kick">Longest ride</p><h2 class="title">${esc(r.title || 'Ride')}</h2><div class="huge sm"><b class="n">0</b><small>km</small></div></div>
      <div class="mapbox"><canvas class="wmap"></canvas></div><p class="cap dark">${fmtDT(r.start.t)} · ${Math.round(Math.max(0, r.end.t - r.start.t) / 6e4)} min</p>`;
    let stop; return () => { shapes($('.fs', el), ['#F6EBDD', '#FFD84D'], 5); pop($('.kick', el), 50); pop($('.title', el), 180); pop($('.huge', el), 320); count($('.n', el), r.km, 1300, 350, 1);
      A($('.mapbox', el), [{ transform: 'translateY(60px) rotate(4deg) scale(.9)', opacity: 0 }, { transform: 'rotate(-1.5deg)', opacity: 1 }], { delay: 500, duration: 800 }); pop($('.cap', el), 900);
      stop = animateTrails($('.wmap', el), [r], null, { per: 1500, delay: 700, hot: r.id, dot: true, bg: '#F6EBDD', land: '#E3D5C2', land2: '#EBDFCF', pad: 30 }); return () => stop && stop(); };
  },
  time(el, D) {
    const segs = D.rides.map(r => { const s = new Date(r.start.t), h0 = s.getHours() + s.getMinutes() / 60, dur = Math.max(.3, (r.end.t - r.start.t) / 36e5); return [h0, Math.min(h0 + dur, h0 + 6)]; });
    const R = 112, C = 140, arcP = (a0, a1, r) => { const p = a => [C + r * Math.sin(a / 24 * Math.PI * 2), C - r * Math.cos(a / 24 * Math.PI * 2)], [x0, y0] = p(a0), [x1, y1] = p(a1); return `M${x0.toFixed(1)},${y0.toFixed(1)}A${r},${r} 0 ${a1 - a0 > 12 ? 1 : 0} 1 ${x1.toFixed(1)},${y1.toFixed(1)}`; };
    el.className = 'ws s-cream'; el.innerHTML = `<div class="fs"></div><div class="wc top"><p class="kick">When you ride</p></div>
      <svg class="clock" viewBox="0 0 280 280"><circle cx="140" cy="140" r="130" fill="#161219"/>${Array.from({ length: 24 }, (_, h) => { const a = h / 24 * Math.PI * 2, r0 = h % 6 ? 122 : 116; return `<line x1="${C + r0 * Math.sin(a)}" y1="${C - r0 * Math.cos(a)}" x2="${C + 128 * Math.sin(a)}" y2="${C - 128 * Math.cos(a)}" stroke="#5A5060" stroke-width="${h % 6 ? 2 : 4}" stroke-linecap="round"/>`; }).join('')}
        ${[0, 6, 12, 18].map(h => { const a = h / 24 * Math.PI * 2; return `<text x="${C + 96 * Math.sin(a)}" y="${C - 96 * Math.cos(a) + 6}" text-anchor="middle" class="ck">${h === 0 ? '12am' : h === 12 ? '12pm' : h < 12 ? h + 'am' : h - 12 + 'pm'}</text>`; }).join('')}
        ${segs.map(([a, b], i) => `<path class="seg" d="${arcP(a, b, R - 26)}" pathLength="1" stroke="${['#FF6A2B', '#FFD84D', '#45E0A2', '#5AB8FF'][i % 4]}" stroke-width="22" stroke-linecap="round" fill="none" style="stroke-dasharray:0 1"/>`).join('')}
        <g class="hand"><line x1="140" y1="140" x2="140" y2="52" stroke="#F6EBDD" stroke-width="6" stroke-linecap="round"/><circle cx="140" cy="140" r="10" fill="#FF6A2B"/></g></svg>
      <div class="wc bot"><div class="persona">${ic(D.persona[1], 2.4)}<b>${D.persona[0]}</b></div><p class="sub dark">${D.persona[2]}</p></div>`;
    return () => { shapes($('.fs', el), ['#FF6A2B', '#5AB8FF', '#FFD84D'], 6); pop($('.kick', el), 50); A($('.clock', el), [{ transform: 'scale(.3) rotate(-90deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { delay: 100, duration: 900 });
      A($('.hand', el), [{ transform: 'rotate(0deg)' }, { transform: 'rotate(720deg)' }], { delay: 500, duration: 2600, easing: 'cubic-bezier(.3,0,.2,1)' });
      $$('.seg', el).forEach((p, i) => A(p, [{ strokeDasharray: '0 1' }, { strokeDasharray: '1 0' }], { delay: 700 + i * 140, duration: 600, easing: 'ease-out' }));
      A($('.persona', el), [{ transform: 'scale(0) rotate(-12deg)', opacity: 0 }, { transform: 'scale(1.15) rotate(3deg)', opacity: 1, offset: .7 }, { transform: 'none', opacity: 1 }], { delay: 2400, duration: 800 }); pop($('.bot .sub', el), 2900); };
  },
  jb(el, D) {
    el.className = 'ws s-sky'; el.innerHTML = `<div class="fs"></div><div class="wc top"><p class="kick">Over the border</p><div class="huge"><b class="n">0</b><small>×</small></div><p class="line">into Johor. Makan runs count.</p></div><div class="mapbox wide"><canvas class="wmap"></canvas></div>`;
    let stop; return () => { shapes($('.fs', el), ['#F6EBDD', '#FF6A2B'], 5); pop($('.kick', el), 50); pop($('.huge', el), 150); count($('.n', el), D.jb.length, 900, 200); pop($('.line', el), 700);
      A($('.mapbox', el), [{ transform: 'translateY(60px) scale(.9)', opacity: 0 }, { transform: 'none', opacity: 1 }], { delay: 400, duration: 800 });
      stop = animateTrails($('.wmap', el), D.jb, null, { per: 1300, delay: 600, hot: D.jb[0].id, dot: true, pad: 18 }); return () => stop && stop(); };
  },
  fuel(el, D) {
    el.className = 'ws s-orange'; el.innerHTML = `<div class="fs"></div><div class="wc top"><p class="kick">Fuel</p><div class="huge"><b class="n">0</b><small>L</small></div><p class="line">${D.fills.length} fill-ups · <b class="c">$0</b></p></div>
      <svg class="wtank" viewBox="0 0 300 170"><defs><clipPath id="wtk"><path d="M24,138 C10,92 34,34 100,24 C170,14 246,22 278,52 C298,72 294,116 270,134 C236,158 64,164 24,138Z"/></clipPath></defs>
        <path d="M24,138 C10,92 34,34 100,24 C170,14 246,22 278,52 C298,72 294,116 270,134 C236,158 64,164 24,138Z" fill="#161219"/>
        <g clip-path="url(#wtk)"><g class="liq" style="transform:translateY(160px)"><path class="wv" d="M-300,0 Q-275,-12 -250,0 T-200,0 T-150,0 T-100,0 T-50,0 T0,0 T50,0 T100,0 T150,0 T200,0 T250,0 T300,0 T350,0 T400,0 T450,0 T500,0 T550,0 T600,0 V200 H-300Z" fill="#FFD84D"/>
          <circle class="bb" cx="90" cy="30" r="6" fill="#fff" fill-opacity=".6"/><circle class="bb b2" cx="200" cy="44" r="4" fill="#fff" fill-opacity=".6"/><circle class="bb b3" cx="150" cy="60" r="5" fill="#fff" fill-opacity=".6"/></g></g>
        <path d="M24,138 C10,92 34,34 100,24 C170,14 246,22 278,52 C298,72 294,116 270,134 C236,158 64,164 24,138Z" fill="none" stroke="#120E15" stroke-width="8"/><rect x="128" y="6" width="50" height="16" rx="6" fill="#F6EBDD" stroke="#120E15" stroke-width="6"/></svg>
      <div class="wc bot"><p class="sub dark">${D.kpl ? `${num(D.kpl, 1)} km per litre` : ''}</p></div>`;
    return () => { shapes($('.fs', el), ['#FFD84D', '#F6EBDD'], 6); pop($('.kick', el), 50); pop($('.huge', el), 150); count($('.n', el), D.litres, 1500, 200, 1);
      const c = $('.c', el); setTimeout(() => { const t0 = performance.now(); (function f(now) { const k = Math.min(1, (now - t0) / 1400); if (c) c.textContent = '$' + Math.round(D.cost * (1 - Math.pow(1 - k, 4))); if (k < 1) requestAnimationFrame(f); })(t0); }, 600);
      pop($('.line', el), 500); A($('.wtank', el), [{ transform: 'translateY(80px) scale(.8)', opacity: 0 }, { transform: 'none', opacity: 1 }], { delay: 300, duration: 800 });
      const kf = [{ transform: 'translateY(160px)' }]; const n = Math.max(1, D.fills.length); for (let i = 0; i < n; i++) { kf.push({ transform: 'translateY(22px)' }); if (i < n - 1) kf.push({ transform: 'translateY(130px)' }); }
      A($('.liq', el), kf, { delay: 700, duration: 1100 * n + 400, easing: 'ease-in-out' }); pop($('.bot .sub', el), 1200); };
  },
  garage(el, D) {
    const ks = [...new Set(D.jobs.map(j => j.part))];
    el.className = 'ws s-lemon'; el.innerHTML = `<div class="fs"></div><div class="wc top"><p class="kick dark">Garage</p><div class="huge dark"><b class="n">0</b><small>${D.jobs.length === 1 ? 'job' : 'jobs'}</small></div>
      <p class="line dark">${D.jobs.length ? 'done on ' + esc(S.bike.name || 'the bike') + '. It noticed.' : 'logged. Your chain is probably thirsty.'}</p></div>
      <div class="partsgrid">${(ks.length ? ks : ['chain']).slice(0, 6).map(k => `<div class="pg2">${ART.art(k, ks.length ? 1 : .05, ks.length ? 'ok' : 'over', 110)}<span>${esc((PARTS.find(p => p[0] === k) || [k, k])[1])}</span></div>`).join('')}</div>`;
    return () => { shapes($('.fs', el), ['#FF6A2B', '#F6EBDD'], 6); pop($('.kick', el), 50); pop($('.huge', el), 150); count($('.n', el), D.jobs.length, 800, 200); pop($('.line', el), 600);
      $$('.pg2', el).forEach((p, i) => A(p, [{ transform: 'scale(0) rotate(-30deg)', opacity: 0 }, { transform: 'scale(1.12) rotate(6deg)', opacity: 1, offset: .7 }, { transform: 'none', opacity: 1 }], { delay: 800 + i * 160, duration: 700 })); };
  },
  photos(el, D) {
    const ph = D.photos.slice(0, 7), spots = [[-30, -38, -8], [26, -30, 7], [-28, 6, 5], [30, 4, -6], [0, -6, -2], [-24, 40, -5], [26, 42, 6]];
    el.className = 'ws s-dark'; el.innerHTML = `<div class="fs"></div><div class="wc top"><p class="kick">Moments</p><h2 class="big">${D.photos.length} photo${D.photos.length > 1 ? 's' : ''} from the road</h2></div>
      <div class="polys">${ph.map((p, i) => { const [x, y, r] = spots[i]; return `<figure class="poly" style="--x:${x}vw;--y:${y}vh;--r:${r}deg"><img src="${p.src}" alt=""><figcaption>${esc(p.title)}</figcaption></figure>`; }).join('')}</div>`;
    return () => { shapes($('.fs', el), ['#FF6A2B', '#FFD84D', '#45E0A2'], 6); pop($('.kick', el), 50); pop($('.big', el), 150);
      $$('.poly', el).forEach((p, i) => A(p, [{ transform: 'translate(-50%,-50%) translate(0, 70vh) rotate(30deg) scale(.6)', opacity: 0 }, { transform: 'translate(-50%,-50%) translate(var(--x), var(--y)) rotate(var(--r))', opacity: 1 }], { delay: 300 + i * 420, duration: 900, easing: 'cubic-bezier(.2,1.2,.4,1)' })); };
  },
  card(el, D) {
    el.className = 'ws s-plum'; el.innerHTML = `<div class="fs"></div><div class="wcard"><div class="wch"><b>RED<i>LINE</i></b><span>${D.name} ${D.y}</span></div><canvas class="wmap"></canvas>
      <div class="wst"><div><b>${num(D.km)}</b><span>km</span></div><div><b>${D.rides.length}</b><span>rides</span></div><div><b>${num(D.litres, 0)}</b><span>litres</span></div></div>
      <div class="wper">${ic(D.persona[1], 2.4)}<span>${D.persona[0]}</span></div></div>
      <div class="wbtns"><button type="button" class="wb share">${ic('save', 2.4)}<span>Share</span></button><button type="button" class="wb ghost again">${ic('play', 2.4)}<span>Watch again</span></button></div>`;
    let stop; return () => { shapes($('.fs', el), ['#FF6A2B', '#FFD84D', '#45E0A2', '#5AB8FF'], 12);
      A($('.wcard', el), [{ transform: 'translateY(120%) rotate(10deg)' }, { transform: 'rotate(-2deg)' }], { delay: 100, duration: 1000 });
      $$('.wst > div', el).forEach((d, i) => pop(d, 800 + i * 120)); pop($('.wper', el), 1200); pop($('.wbtns', el), 1500); setTimeout(() => confetti(el), 900);
      stop = animateTrails($('.wmap', el), D.rides, null, { per: 300, delay: 600, sg: true, pad: 14 });
      $('.share', el).onclick = e => { e.stopPropagation(); share(D); }; $('.again', el).onclick = e => { e.stopPropagation(); show(0); };
      return () => stop && stop(); };
  },
};

/* ---------- share: a 1080×1920 story image of the card ---------- */
async function share(D) {
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1920; const g = c.getContext('2d');
  g.fillStyle = '#161219'; g.fillRect(0, 0, 1080, 1920);
  [['#FF6A2B', 140, 260, 90], ['#FFD84D', 940, 340, 60], ['#45E0A2', 120, 1640, 70], ['#5AB8FF', 960, 1720, 100]].forEach(([col, x, y, r]) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); });
  g.fillStyle = '#FFF8F0'; g.font = '800 92px "Bricolage Grotesque", system-ui'; g.fillText('RED', 110, 230); g.fillStyle = '#FF6A2B'; g.fillText('LINE', 110 + g.measureText('RED').width, 230);
  g.fillStyle = '#B5ABBA'; g.font = '700 52px "Bricolage Grotesque", system-ui'; g.fillText(`${D.name} ${D.y} · Ride Wrap`, 110, 310);
  const m = document.createElement('canvas'); m.style.cssText = 'position:fixed;left:-9999px;width:860px;height:620px'; document.body.appendChild(m);
  const d = mapDraw(m, D.rides, { sg: true, pad: 30 }); d.base(); D.rides.forEach(r => r.path && d.trail(r.path, r.path.length, false));
  g.save(); g.beginPath(); g.roundRect ? g.roundRect(110, 380, 860, 620, 48) : g.rect(110, 380, 860, 620); g.clip(); g.drawImage(m, 110, 380, 860, 620); g.restore(); m.remove();
  [[num(D.km), 'km'], [String(D.rides.length), 'rides'], [num(D.litres, 0), 'litres']].forEach(([v, l], i) => { const x = 110 + i * 300; g.fillStyle = '#FFF8F0'; g.font = '800 120px "Bricolage Grotesque", system-ui'; g.fillText(v, x, 1220); g.fillStyle = '#B5ABBA'; g.font = '700 46px "Bricolage Grotesque", system-ui'; g.fillText(l, x, 1290); });
  g.fillStyle = '#FFD84D'; g.beginPath(); g.roundRect ? g.roundRect(110, 1380, 860, 170, 50) : g.rect(110, 1380, 860, 170); g.fill();
  g.fillStyle = '#1F1700'; g.font = '800 76px "Bricolage Grotesque", system-ui'; g.fillText(D.persona[0], 170, 1490);
  g.fillStyle = '#B5ABBA'; g.font = '600 40px "Bricolage Grotesque", system-ui'; g.fillText(S.bike.name || '', 110, 1800);
  const blob = await new Promise(r => c.toBlob(r, 'image/png')), file = new File([blob], `redline-wrap-${D.y}-${D.m + 1}.png`, { type: 'image/png' });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'My Ride Wrap' }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  // fallback: show the image so it can be long-pressed and saved
  const v = document.createElement('div'); v.className = 'wimg'; v.innerHTML = `<img alt="Your Ride Wrap card" src="${c.toDataURL('image/png')}"><p>Press and hold the image to save it.</p><button type="button" class="wb">Close</button>`;
  $('#story').appendChild(v); v.onclick = e => { e.stopPropagation(); if (e.target.closest('button')) v.remove(); };
}

/* ---------- one ride as a story image (route, km, time, your first photo) ---------- */
async function shareRide(r) {
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1920; const g = c.getContext('2d'), F = (w, z) => `${w} ${z}px "Bricolage Grotesque", system-ui`;
  g.fillStyle = '#161219'; g.fillRect(0, 0, 1080, 1920);
  g.fillStyle = '#FFF8F0'; g.font = F(800, 64); g.fillText('RED', 90, 150); g.fillStyle = '#FF6A2B'; g.fillText('LINE', 90 + g.measureText('RED').width, 150);
  g.fillStyle = '#FFF8F0'; g.font = F(800, 92); const t = (r.title || 'Ride').slice(0, 26); g.fillText(t, 90, 290);
  g.fillStyle = '#B5ABBA'; g.font = F(600, 42); g.fillText(fmtDT(r.start.t), 90, 356);
  let y = 420; const ph = (r.photos || [])[0] && typeof kv === 'function' ? await kv('get', r.photos[0]) : null;
  if (ph && ph.src) { const im = new Image(); im.src = ph.src; await im.decode().catch(() => {}); const w = 900, h = 640, k = Math.max(w / im.naturalWidth, h / im.naturalHeight);
    g.save(); g.beginPath(); g.roundRect ? g.roundRect(90, y, w, h, 44) : g.rect(90, y, w, h); g.clip(); g.drawImage(im, 90 + (w - im.naturalWidth * k) / 2, y + (h - im.naturalHeight * k) / 2, im.naturalWidth * k, im.naturalHeight * k); g.restore(); y += h + 40; }
  if (r.path && r.path.length > 1) { const mh = ph ? 520 : 900, m = document.createElement('canvas'); m.style.cssText = `position:fixed;left:-9999px;width:900px;height:${mh}px`; document.body.appendChild(m);
    const d = mapDraw(m, [r], { pad: 50 }); d.base(); d.trail(r.path, r.path.length, true);
    g.save(); g.beginPath(); g.roundRect ? g.roundRect(90, y, 900, mh, 44) : g.rect(90, y, 900, mh); g.clip(); g.drawImage(m, 90, y, 900, mh); g.restore(); m.remove(); y += mh + 60; }
  const mins = Math.round(Math.max(0, r.end.t - r.start.t) / 6e4);
  [[num(r.km, 1), 'km'], [String(mins), 'min'], [r.mood || (S.bike.name || ''), r.mood ? 'vibe' : 'bike']].forEach(([v, l], i) => { const x = 90 + i * 320; g.fillStyle = '#FFF8F0'; g.font = F(800, i === 2 ? 64 : 110); g.fillText(String(v).slice(0, 12), x, Math.min(1780, y + 90)); g.fillStyle = '#B5ABBA'; g.font = F(700, 40); g.fillText(l, x, Math.min(1840, y + 150)); });
  const blob = await new Promise(res => c.toBlob(res, 'image/png')), file = new File([blob], `redline-ride.png`, { type: 'image/png' });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: r.title || 'My ride' }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  const v = document.createElement('div'); v.className = 'wimg on'; v.innerHTML = `<img alt="Your ride card" src="${c.toDataURL('image/png')}"><p>Press and hold the image to save it.</p><button type="button" class="wb">Close</button>`;
  document.body.appendChild(v); v.onclick = e => { if (e.target.closest('button')) v.remove(); };
}

/* ---------- the player ---------- */
let D = null, order = [], idx = 0, timer = 0, paused = false, cleanup = null, tx = innerWidth / 2, ty = innerHeight / 2, holdT = 0, startT = 0, remain = 0;
const DUR = { intro: 5600, distance: 6000, map: 7000, longest: 6500, time: 6500, jb: 6000, fuel: 6500, garage: 6000, photos: 7000, card: 0 };
async function open(y, m) {
  const w = y == null ? (() => { const n = new Date(), d = new Date(n.getFullYear(), n.getMonth() - 1, 1); return { y: d.getFullYear(), m: d.getMonth() }; })() : { y, m };
  D = data(w.y, w.m); if (D.rides.length < 1) { toast('Ride a few times this month and your Wrap appears'); return; }
  // your ride photos for the month (kept on this phone)
  D.photos = []; if (typeof kv === 'function') for (const r of D.rides) for (const k of (r.photos || [])) { const p = await kv('get', k); if (p && p.src) D.photos.push({ src: p.src, title: r.title || fmtDs(todayISO(new Date(r.start.t))) }); }
  S.wrapSeen = `${w.y}-${w.m}`; S.stats.wraps++; save();
  order = ['intro', 'distance', 'map']; if (D.longest && D.longest.path) order.push('longest'); order.push('time'); if (D.jb.length) order.push('jb'); if (D.fills.length) order.push('fuel'); order.push('garage'); if (D.photos.length) order.push('photos'); order.push('card');
  const st = $('#story'); st.innerHTML = `<div class="wbars">${order.map(() => '<i><b></b></i>').join('')}</div><button type="button" class="wx" aria-label="Close Wrap">${ic('x', 3)}</button><div class="wstage"></div>`;
  st.classList.add('on'); document.body.classList.add('wrapping'); if (S.prefs.sound || S.prefs.music) applyAudio();
  $('.wx', st).onclick = e => { e.stopPropagation(); close(); };
  st.onpointerdown = e => { if (e.target.closest('button,.wimg')) return; tx = e.clientX; ty = e.clientY; holdT = setTimeout(() => pause(true), 260); };
  st.onpointerup = e => { if (e.target.closest('button,.wimg')) return; clearTimeout(holdT); if (paused) { pause(false); return; } if (order[idx] === 'card' && e.clientX > innerWidth * .33) return; e.clientX < innerWidth * .33 ? show(idx - 1) : show(idx + 1); };
  idx = -1; tx = innerWidth / 2; ty = innerHeight / 2; show(0);
}
function show(i) {
  if (i >= order.length) { close(); return; } if (i < 0) i = 0;
  clearTimeout(timer); if (cleanup) { cleanup(); cleanup = null; }
  const st = $('#story'), stage = $('.wstage', st), old = $$('.ws', stage), el = document.createElement('section'); idx = i;
  const play = SL[order[i]](el, D); stage.appendChild(el);
  const r = Math.hypot(Math.max(tx, innerWidth - tx), Math.max(ty, innerHeight - ty));
  if (!RMx() && old.length) { el.animate([{ clipPath: `circle(0px at ${tx}px ${ty}px)` }, { clipPath: `circle(${r}px at ${tx}px ${ty}px)` }], { duration: 650, easing: 'cubic-bezier(.6,0,.2,1)' }).onfinish = () => old.forEach(o => o.remove());
    old.forEach(o => o.animate([{ transform: 'scale(1)', filter: 'brightness(1)' }, { transform: 'scale(.92)', filter: 'brightness(.6)' }], { duration: 650, fill: 'forwards', easing: 'ease-in' })); }
  else old.forEach(o => o.remove());
  cleanup = play() || null; if (window.Snd && Snd.ctx && S.prefs.sound) Snd.whoosh && Snd.whoosh();
  $$('.wbars i b', st).forEach((b, j) => { b.getAnimations().forEach(a => a.cancel()); b.style.width = j < i ? '100%' : '0'; });
  const d = DUR[order[i]]; if (d) { const b = $$('.wbars i b', st)[i]; b.animate([{ width: '0%' }, { width: '100%' }], { duration: d, fill: 'forwards' }); startT = performance.now(); remain = d; timer = setTimeout(() => { tx = innerWidth * .8; ty = innerHeight * .5; show(idx + 1); }, d); }
  else $$('.wbars i b', st)[i].style.width = '100%';
}
function pause(p) {
  paused = p; const st = $('#story'), b = $$('.wbars i b', st)[idx]; st.classList.toggle('paused', p);
  document.getAnimations().filter(a => a.effect && a.effect.target && st.contains(a.effect.target)).forEach(a => p ? a.pause() : a.play());
  if (p) { clearTimeout(timer); remain -= performance.now() - startT; } else if (DUR[order[idx]]) { startT = performance.now(); timer = setTimeout(() => show(idx + 1), Math.max(300, remain)); }
}
function close() { clearTimeout(timer); if (cleanup) cleanup(); const st = $('#story');
  const a = RMx() ? null : st.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.94)' }], { duration: 300, easing: 'ease-in' });
  const fin = () => { st.classList.remove('on', 'paused'); st.innerHTML = ''; document.body.classList.remove('wrapping'); if (typeof refresh === 'function') refresh(); celebrate && celebrate(); };
  a ? a.onfinish = fin : fin(); }
return { open, shareRide };
})();
