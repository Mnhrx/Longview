/* Redline part art: flat, chunky, animated illustrations of each service part.
   Each one moves in a way that shows its condition: chains sag, tread wears, oil runs low, plugs misfire. */
window.ART = (() => {
const O = '#120E15', C = '#F6EBDD';
const gear = (cx, cy, r, n) => { let d = ''; for (let i = 0; i < n * 2; i++) { const a0 = i / (n * 2) * Math.PI * 2, a1 = (i + 1) / (n * 2) * Math.PI * 2, rr = i % 2 ? r * .82 : r;
  d += `${i ? 'L' : 'M'}${(cx + rr * Math.cos(a0)).toFixed(1)},${(cy + rr * Math.sin(a0)).toFixed(1)}L${(cx + rr * Math.cos(a1)).toFixed(1)},${(cy + rr * Math.sin(a1)).toFixed(1)}`; } return d + 'Z'; };
let uid = 0;
const ART = {
  chain(f, st) { const sag = st === 'over';
    return `<g class="judder">
      <g class="spin"><path d="${gear(36, 60, 30, 14)}" fill="var(--a)" stroke="${O}" stroke-width="4" stroke-linejoin="round"/><circle cx="36" cy="60" r="11" fill="${C}" stroke="${O}" stroke-width="4"/></g>
      <g class="spin"><path d="${gear(94, 60, 17, 9)}" fill="var(--a)" stroke="${O}" stroke-width="4" stroke-linejoin="round"/><circle cx="94" cy="60" r="6" fill="${C}" stroke="${O}" stroke-width="4"/></g>
      <path class="links" d="M36,28 L94,41 A19,19 0 0 1 94,79 ${sag ? 'Q66,104 36,92' : 'L36,92'} A32,32 0 0 1 36,28 Z" fill="none" stroke="${O}" stroke-width="9" stroke-linecap="round" stroke-dasharray="1 9"/>
      <path class="links" d="M36,28 L94,41 A19,19 0 0 1 94,79 ${sag ? 'Q66,104 36,92' : 'L36,92'} A32,32 0 0 1 36,28 Z" fill="none" stroke="${C}" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="1 9"/>
      <path class="shine" d="M36,28 L94,41" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none" opacity="0"/></g>`; },
  tyre(f) { const n = 18, h = 3 + 7 * f; let tread = '';
    for (let i = 0; i < n; i++) tread += `<rect x="57" y="${12 - h * .3}" width="6" height="${h.toFixed(1)}" rx="1.5" fill="${O}" transform="rotate(${i * 360 / n} 60 58)"/>`;
    return `<g class="roll"><g class="spin"><circle cx="60" cy="58" r="44" fill="#2B2430" stroke="${O}" stroke-width="4"/>${tread}
      <circle cx="60" cy="58" r="29" fill="var(--a)" stroke="${O}" stroke-width="4"/>
      ${[0, 72, 144, 216, 288].map(a => `<rect x="57" y="34" width="6" height="22" rx="3" fill="${C}" stroke="${O}" stroke-width="2.5" transform="rotate(${a} 60 58)"/>`).join('')}
      <circle cx="60" cy="58" r="8" fill="${C}" stroke="${O}" stroke-width="4"/></g></g>
      <path class="road" d="M4,110 H116" stroke="${C}" stroke-opacity=".5" stroke-width="4" stroke-linecap="round" stroke-dasharray="10 12"/>`; },
  oil(f) { const id = 'od' + (++uid), y = 102 - 86 * Math.max(.07, f);
    return `<defs><clipPath id="${id}"><path d="M60,12 C60,12 28,52 28,72 A32,32 0 0 0 92,72 C92,52 60,12 60,12 Z"/></clipPath></defs>
      <path d="M60,12 C60,12 28,52 28,72 A32,32 0 0 0 92,72 C92,52 60,12 60,12 Z" fill="#2B2430"/>
      <g clip-path="url(#${id})"><g class="lvl" style="transform:translateY(${y.toFixed(1)}px)" data-full="16">
        <path class="wave" d="M-60,0 Q-45,-6 -30,0 T0,0 T30,0 T60,0 T90,0 T120,0 T150,0 T180,0 V120 H-60 Z" fill="var(--a)"/>
        <circle class="bub" cx="50" cy="40" r="3.5" fill="${C}" fill-opacity=".7"/><circle class="bub b2" cx="68" cy="50" r="2.5" fill="${C}" fill-opacity=".7"/></g></g>
      <path d="M60,12 C60,12 28,52 28,72 A32,32 0 0 0 92,72 C92,52 60,12 60,12 Z" fill="none" stroke="${O}" stroke-width="4.5" stroke-linejoin="round"/>
      <path d="M44,66 Q44,56 50,50" stroke="#fff" stroke-opacity=".55" stroke-width="5" stroke-linecap="round" fill="none"/>`; },
  brakes(f) { const pad = 3 + 6 * f;
    return `<g class="spin"><circle cx="54" cy="62" r="40" fill="${C}" stroke="${O}" stroke-width="4"/>
      ${Array.from({ length: 10 }, (_, i) => { const a = i / 10 * Math.PI * 2; return `<circle cx="${(54 + 28 * Math.cos(a)).toFixed(1)}" cy="${(62 + 28 * Math.sin(a)).toFixed(1)}" r="4" fill="${O}"/>`; }).join('')}
      <circle cx="54" cy="62" r="14" fill="var(--a)" stroke="${O}" stroke-width="4"/><circle cx="54" cy="62" r="4" fill="${O}"/></g>
      <g class="squeeze"><rect x="78" y="20" width="30" height="44" rx="10" fill="var(--a)" stroke="${O}" stroke-width="4"/>
      <rect x="${(84 - pad).toFixed(1)}" y="28" width="${pad.toFixed(1)}" height="28" rx="2" fill="${O}"/><circle cx="96" cy="32" r="3" fill="${O}"/><circle cx="96" cy="52" r="3" fill="${O}"/></g>`; },
  spark(f, st) {
    return `<rect x="52" y="6" width="16" height="12" rx="3" fill="${C}" stroke="${O}" stroke-width="4"/>
      <rect x="46" y="16" width="28" height="34" rx="8" fill="${C}" stroke="${O}" stroke-width="4"/>
      <path d="M50,26 H70 M50,34 H70 M50,42 H70" stroke="${O}" stroke-opacity=".25" stroke-width="3"/>
      <path d="M40,50 H80 L84,60 L80,70 H40 L36,60 Z" fill="var(--a)" stroke="${O}" stroke-width="4" stroke-linejoin="round"/>
      <rect x="48" y="70" width="24" height="22" fill="#8E8494" stroke="${O}" stroke-width="4"/>
      <path d="M48,76 L72,80 M48,84 L72,88" stroke="${O}" stroke-width="3"/>
      <path d="M60,92 V100 M60,100 H72 V106" stroke="${O}" stroke-width="4" fill="none" stroke-linecap="round"/>
      <g class="${st === 'over' ? 'misfire' : 'zap'}"><path d="M62,100 L74,98 L68,106 L82,108 L72,116" stroke="var(--a)" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="68" cy="104" r="10" fill="var(--a)" opacity=".25"/></g>`; },
  air(f) { const dirt = Math.round((1 - f) * 12); let dots = '';
    for (let i = 0; i < dirt; i++) dots += `<circle cx="${40 + (i * 37) % 40}" cy="${34 + (i * 23) % 52}" r="${2.5 + (i % 3)}" fill="${O}" fill-opacity=".75"/>`;
    return `${[30, 50, 70, 90].map((y, i) => `<path class="flow" d="M2,${y} H30" stroke="${C}" stroke-width="4" stroke-linecap="round" stroke-dasharray="6 8" style="animation-delay:-${i * .2}s"/>`).join('')}
      <rect x="32" y="22" width="56" height="76" rx="8" fill="var(--a)" stroke="${O}" stroke-width="4"/>
      <path d="M38,30 L82,36 L38,42 L82,48 L38,54 L82,60 L38,66 L82,72 L38,78 L82,84 L38,90" stroke="${O}" stroke-width="3" fill="none" stroke-linejoin="round"/>${dots}
      ${[30, 50, 70, 90].map((y, i) => `<path class="flow" d="M90,${y} H118" stroke="${C}" stroke-width="4" stroke-linecap="round" stroke-dasharray="6 8" opacity="${(.15 + .85 * f).toFixed(2)}" style="animation-delay:-${i * .2}s"/>`).join('')}`; },
  coolant(f) { const id = 'cl' + (++uid), y = 100 - 66 * Math.max(.07, f);
    return `<defs><clipPath id="${id}"><rect x="32" y="30" width="56" height="72" rx="12"/></clipPath></defs>
      <rect x="48" y="14" width="24" height="16" rx="5" fill="var(--a)" stroke="${O}" stroke-width="4"/>
      <rect x="32" y="30" width="56" height="72" rx="12" fill="#2B2430"/>
      <g clip-path="url(#${id})"><g class="lvl" style="transform:translateY(${y.toFixed(1)}px)" data-full="34">
        <path class="wave" d="M-60,0 Q-45,-5 -30,0 T0,0 T30,0 T60,0 T90,0 T120,0 T150,0 T180,0 V120 H-60 Z" fill="#45E0A2"/>
        <circle class="bub" cx="48" cy="40" r="3" fill="${C}" fill-opacity=".7"/><circle class="bub b2" cx="70" cy="30" r="2.5" fill="${C}" fill-opacity=".7"/></g></g>
      <rect x="32" y="30" width="56" height="72" rx="12" fill="none" stroke="${O}" stroke-width="4.5"/>
      <path d="M80,44 H88 M80,86 H88" stroke="${O}" stroke-width="3"/><path d="M40,46 V70" stroke="#fff" stroke-opacity=".5" stroke-width="5" stroke-linecap="round"/>`; },
  belt(f, st) { const loose = st === 'over';
    return `<g class="judder"><path class="links" d="M36,28 L90,38 A22,22 0 0 1 90,82 ${loose ? 'Q62,100 36,92' : 'L36,92'} A32,32 0 0 1 36,28 Z" fill="none" stroke="${O}" stroke-width="13" stroke-linejoin="round"/>
      <path class="links" d="M36,28 L90,38 A22,22 0 0 1 90,82 ${loose ? 'Q62,100 36,92' : 'L36,92'} A32,32 0 0 1 36,28 Z" fill="none" stroke="var(--a)" stroke-width="5" stroke-dasharray="4 6"/>
      <g class="spin"><circle cx="36" cy="60" r="24" fill="${C}" stroke="${O}" stroke-width="4"/>${[0, 60, 120].map(a => `<rect x="33" y="40" width="6" height="40" rx="3" fill="${O}" transform="rotate(${a} 36 60)"/>`).join('')}<circle cx="36" cy="60" r="7" fill="var(--a)" stroke="${O}" stroke-width="3"/></g>
      <g class="spin"><circle cx="90" cy="60" r="16" fill="${C}" stroke="${O}" stroke-width="4"/>${[0, 90].map(a => `<rect x="87.5" y="47" width="5" height="26" rx="2.5" fill="${O}" transform="rotate(${a} 90 60)"/>`).join('')}<circle cx="90" cy="60" r="5" fill="var(--a)" stroke="${O}" stroke-width="3"/></g></g>`; },
  final(f) { const id = 'fd' + (++uid), y = 96 - 22 * Math.max(.08, f);
    return `<defs><clipPath id="${id}"><rect x="40" y="74" width="40" height="22" rx="8"/></clipPath></defs>
      <path d="M22,60 a38,38 0 1 1 76,0 v18 a18,18 0 0 1 -18,18 H40 a18,18 0 0 1 -18,-18 Z" fill="var(--a)" stroke="${O}" stroke-width="4.5" stroke-linejoin="round"/>
      <g class="spin"><path d="${gear(60, 50, 22, 12)}" fill="${C}" stroke="${O}" stroke-width="4" stroke-linejoin="round"/><circle cx="60" cy="50" r="7" fill="${O}"/></g>
      <rect x="40" y="74" width="40" height="22" rx="8" fill="#2B2430"/>
      <g clip-path="url(#${id})"><g class="lvl" style="transform:translateY(${y.toFixed(1)}px)" data-full="76"><path class="wave" d="M-60,0 Q-45,-4 -30,0 T0,0 T30,0 T60,0 T90,0 T120,0 T150,0 T180,0 V40 H-60 Z" fill="#FF6A2B"/></g></g>
      <rect x="40" y="74" width="40" height="22" rx="8" fill="none" stroke="${O}" stroke-width="4"/>`; },
  fins() { return `${[34, 50, 66, 82].map((y, i) => `<path class="flow" d="M4,${y} H22 M98,${y} H116" stroke="${C}" stroke-width="4" stroke-linecap="round" stroke-dasharray="6 8" style="animation-delay:-${i * .2}s"/>`).join('')}
      ${[24, 36, 48, 60, 72, 84].map(y => `<rect x="24" y="${y}" width="72" height="7" rx="3.5" fill="var(--a)" stroke="${O}" stroke-width="3.5"/>`).join('')}
      <rect x="44" y="20" width="32" height="80" rx="8" fill="${C}" stroke="${O}" stroke-width="4"/><circle cx="60" cy="30" r="5" fill="${O}"/>`; },
  other() { return `<g class="wobble"><path d="M78,22 a22,22 0 0 0 -26,30 L22,82 a9,9 0 0 0 13,13 L65,65 a22,22 0 0 0 30,-26 L84,50 L72,46 L68,34 Z" fill="var(--a)" stroke="${O}" stroke-width="4.5" stroke-linejoin="round"/></g>`; },
};
ART.frontTyre = ART.tyre; ART.rearTyre = ART.tyre;
function art(k, f = 1, st = 'ok', size = 96) {
  const fn = ART[k] || ART.other, col = st === 'over' ? '#FF3B3B' : st === 'soon' ? '#FFB020' : st === 'unset' ? '#5A5060' : '#FFD84D';
  return `<svg class="art art-${k} st-${st}" viewBox="0 0 120 120" width="${size}" height="${size}" style="--a:${col}" aria-hidden="true">${fn(Math.max(0, Math.min(1, f)), st)}</svg>`;
}
// "Done today": the part gets serviced in front of you — oil refills, chain shines, tread grows back
function renew(svg) {
  if (!svg) return;
  svg.style.setProperty('--a', '#FFD84D'); svg.classList.remove('st-over', 'st-soon'); svg.classList.add('st-ok');
  const lvl = svg.querySelector('.lvl'); if (lvl) { lvl.style.transition = 'transform 1.3s cubic-bezier(.2,1.25,.4,1)'; requestAnimationFrame(() => lvl.style.transform = `translateY(${lvl.dataset.full}px)`); }
  const sh = svg.querySelector('.shine'); if (sh) sh.animate([{ opacity: 0, strokeDasharray: '0 200' }, { opacity: 1, strokeDasharray: '70 200' }, { opacity: 0, strokeDasharray: '70 200', strokeDashoffset: -70 }], { duration: 900, iterations: 2 });
  svg.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18) rotate(-6deg)' }, { transform: 'scale(.94) rotate(3deg)' }, { transform: 'scale(1)' }], { duration: 750, easing: 'ease-out' });
  // a burst of chunky sparks
  const box = svg.getBoundingClientRect(), cx = box.left + box.width / 2, cy = box.top + box.height / 2;
  burst(cx, cy, 14, ['#FFD84D', '#F6EBDD', '#45E0A2', '#FF6A2B']);
}
function burst(x, y, n, cols, spread = 1) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for (let i = 0; i < n; i++) {
    const d = document.createElement('i'), a = Math.random() * Math.PI * 2, r = (60 + Math.random() * 90) * spread, s = 6 + Math.random() * 10, shape = i % 3;
    d.className = 'spark'; d.style.cssText = `left:${x}px;top:${y}px;width:${s}px;height:${shape === 2 ? s * .4 : s}px;background:${cols[i % cols.length]};border-radius:${shape === 0 ? '50%' : '3px'}`;
    document.body.appendChild(d);
    d.animate([{ transform: 'translate(-50%,-50%) scale(0) rotate(0)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * r}px), calc(-50% + ${Math.sin(a) * r}px)) scale(1) rotate(${Math.random() * 540}deg)`, opacity: 1, offset: .7 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * r * 1.1}px), calc(-50% + ${Math.sin(a) * r * 1.1 + 40}px)) scale(.6) rotate(${Math.random() * 720}deg)`, opacity: 0 }], { duration: 900 + Math.random() * 500, easing: 'cubic-bezier(.15,.8,.3,1)' }).onfinish = () => d.remove();
  }
}
return { art, renew, burst };
})();
