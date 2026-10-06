/* Redline sound: an original synth score, your own track, and one effect per action. All generated, no audio files. */
(() => {
const rand = (a, b) => a + Math.random() * (b - a);
/* ============ SOUND: an original synth score + one distinct sound per action ============ */
window.Snd = {
  ctx: null, on: false, onChange: null,
  start() {
    if (this.ctx) return; try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    const c = this.ctx; this.out = c.createGain(); this.out.gain.value = 0; this.out.connect(c.destination);
    this.fx = c.createGain(); this.fx.gain.value = .9; this.fx.connect(this.out);
    this.mus = c.createGain(); this.mus.gain.value = .55; this.mus.connect(this.out);
    // a long dark hall for the pads
    const len = c.sampleRate * 3.2, ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    this.verb = c.createConvolver(); this.verb.buffer = ir; const vg = c.createGain(); vg.gain.value = .45; this.verb.connect(vg).connect(this.mus);
    this.set(true); this.music();
  },
  set(v) { this.on = v; if (!this.ctx) return; if (v && this.ctx.state === 'suspended') this.ctx.resume(); this.out.gain.setTargetAtTime(v ? .55 : 0, this.ctx.currentTime, .25); this.onChange && this.onChange(); },
  noise(d) { const c = this.ctx, b = c.createBuffer(1, Math.max(1, c.sampleRate * d), c.sampleRate), a = b.getChannelData(0); for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1; const s = c.createBufferSource(); s.buffer = b; return s; },
  env(g, t, a, peak, d) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); },
  osc(type, f, t, d, peak, dest, a = .005) { const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); this.env(g, t, a, peak, d); o.connect(g).connect(dest || this.fx); o.start(t); o.stop(t + a + d + .05); return o; },

  /* --- the score: dark and driving, D minor, 104 bpm. Arpeggiated bass under a slow filter sweep, deep sub, punchy kick,
     short brassy stabs on the off-beats. No melody line. Sections: intro → drive → full → breakdown --- */
  music() {
    const c = this.ctx, spb = 60 / 104, s16 = spb / 4, mtof = m => 440 * Math.pow(2, (m - 69) / 12);
    const prog = [[38, 50, 53, 57], [34, 46, 50, 53], [36, 48, 52, 55], [33, 45, 49, 52]]; // Dm  Bb  C  A
    const arp = [0, 12, 7, 12, 3, 12, 7, 15];
    const bus = c.createGain(); bus.gain.value = 1; bus.connect(this.mus); this.scoreBus = bus;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4; comp.connect(bus);
    const bassF = c.createBiquadFilter(); bassF.type = 'lowpass'; bassF.Q.value = 7; bassF.frequency.value = 420; bassF.connect(comp);
    let next = c.currentTime + .15, step = 0;
    const play = (t, n) => {
      const bar = Math.floor(n / 16), st = n % 16, sec = Math.floor(bar / 8) % 4, ch = prog[bar % 4], root = ch[0];
      // filter sweep across each 8-bar section
      if (st === 0) { const k = (bar % 8) / 8, lo = sec === 0 ? 260 : sec === 3 ? 320 : 500, hi = sec === 2 ? 2600 : 1500; bassF.frequency.setTargetAtTime(lo + (hi - lo) * Math.sin(k * Math.PI), t, .6); }
      // arpeggiated bass: two detuned saws per 16th
      if (sec !== 3 || st % 2 === 0) { const f = mtof(root + arp[st % 8]); for (const det of [-6, 6]) { const o = c.createOscillator(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; this.env(g, t, .003, sec === 0 ? .05 : .075, s16 * 1.1); o.connect(g).connect(bassF); o.start(t); o.stop(t + s16 * 1.3); } }
      // deep sub on the beat
      if (sec !== 0 && st % 4 === 0) { const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = mtof(root - 12); this.env(g, t, .01, .22, spb * .9); o.connect(g).connect(comp); o.start(t); o.stop(t + spb); }
      // kick
      if ((sec === 1 || sec === 2) && st % 4 === 0) { const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + .12); this.env(g, t, .001, .75, .28);
        const cl = this.noise(.02), cf = c.createBiquadFilter(), cg = c.createGain(); cf.type = 'highpass'; cf.frequency.value = 3000; this.env(cg, t, .001, .15, .015); cl.connect(cf).connect(cg).connect(comp); cl.start(t);
        o.connect(g).connect(comp); o.start(t); o.stop(t + .32); }
      // off-beat brassy stabs (full section and the end of the drive)
      if ((sec === 2 || (sec === 1 && bar % 8 >= 4)) && (st === 2 || st === 10)) for (const m of ch.slice(1)) for (const det of [-9, 0, 9]) {
        const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = mtof(m + 12); o.detune.value = det; f.type = 'lowpass'; f.Q.value = 2; f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(500, t + .22);
        this.env(g, t, .006, .022, .26); o.connect(f).connect(g); g.connect(comp); g.connect(this.verb); o.start(t); o.stop(t + .32); }
      // gated noise hats in the full section
      if (sec === 2 && st % 2 === 1) { const nz = this.noise(.04), f = c.createBiquadFilter(), g = c.createGain(); f.type = 'highpass'; f.frequency.value = 9000; this.env(g, t, .001, st % 4 === 3 ? .05 : .025, .03); nz.connect(f).connect(g).connect(comp); nz.start(t); }
      // breakdown: a low swelling chord bed (filtered, no top end)
      if (sec === 3 && st === 0) for (const m of ch.slice(1)) { const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = mtof(m); f.type = 'lowpass'; f.frequency.value = 700;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.03, t + spb * 2); g.gain.linearRampToValueAtTime(0, t + spb * 4.1); o.connect(f).connect(g); g.connect(comp); g.connect(this.verb); o.start(t); o.stop(t + spb * 4.2); }
      // riser into each new section
      if (bar % 8 === 7 && st === 0) { const nz = this.noise(spb * 4), f = c.createBiquadFilter(), g = c.createGain(); f.type = 'bandpass'; f.Q.value = 3; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(5000, t + spb * 4); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.06, t + spb * 3.9); g.gain.linearRampToValueAtTime(0, t + spb * 4); nz.connect(f).connect(g).connect(comp); nz.start(t); }
    };
    const sched = () => { while (next < c.currentTime + .3) { if (!this.own) play(next, step); next += s16; step++; } setTimeout(sched, 70); };
    sched();
  },
  /* --- your own track: picked from the phone, kept in this browser only --- */
  own: null, track: null,
  useTrack(blob, name) {
    if (!this.ctx) this.start();
    if (!this.track) { this.track = new Audio(); this.track.loop = true; this.trackNode = this.ctx.createMediaElementSource(this.track); this.trackNode.connect(this.mus); }
    if (this.track.src) URL.revokeObjectURL(this.track.src);
    this.track.src = URL.createObjectURL(blob); this.own = name || 'MY TRACK'; this.track.play().catch(() => {});
    if (this.scoreBus) this.scoreBus.gain.setTargetAtTime(0, this.ctx.currentTime, .3);
    this.onChange && this.onChange();
  },
  dropTrack() { if (this.track) { this.track.pause(); } this.own = null; if (this.scoreBus) this.scoreBus.gain.setTargetAtTime(1, this.ctx.currentTime, .3); this.onChange && this.onChange(); },
  /* --- effects --- */
  whoosh() { if (!this.ctx) return; const c = this.ctx, t = c.currentTime, n = this.noise(1.3), f = c.createBiquadFilter(), g = c.createGain(); f.type = 'bandpass'; f.Q.value = 1.6; f.frequency.setValueAtTime(260, t); f.frequency.exponentialRampToValueAtTime(3200, t + .55); f.frequency.exponentialRampToValueAtTime(400, t + 1.2); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.24, t + .25); g.gain.exponentialRampToValueAtTime(.001, t + 1.25); n.connect(f).connect(g).connect(this.fx); n.start(t); },
  // ride derez: a glassy shatter, pitched per ride
  shatter(i, v = 1) { if (!this.ctx || v <= 0) return; const c = this.ctx, t = c.currentTime, base = [880, 740, 988, 659][i % 4];
    const n = this.noise(.4), f = c.createBiquadFilter(), g = c.createGain(); f.type = 'highpass'; f.frequency.value = 3000; g.gain.setValueAtTime(.18 * v, t); g.gain.exponentialRampToValueAtTime(.001, t + .35); n.connect(f).connect(g).connect(this.fx); n.start(t);
    for (let k = 0; k < 7; k++) { const w = t + k * rand(.025, .06); this.osc('sine', base * Math.pow(2, rand(-.3, 1.2)), w, rand(.15, .4), .05 * v); }
    this.osc('triangle', base / 2, t, .5, .07 * v).frequency.exponentialRampToValueAtTime(base / 8, t + .5); },
  // bike un-build: a soft falling power-down
  powerDown() { if (!this.ctx) return; const c = this.ctx, t = c.currentTime, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(55, t + .85); f.type = 'lowpass'; f.frequency.setValueAtTime(2400, t); f.frequency.exponentialRampToValueAtTime(180, t + .85); g.gain.setValueAtTime(.09, t); g.gain.exponentialRampToValueAtTime(.001, t + .9); o.connect(f).connect(g).connect(this.fx); o.start(t); o.stop(t + .95);
    for (let k = 0; k < 6; k++) this.osc('triangle', 1400 - k * 180, t + k * .09, .06, .025); },
  // bike build: a rising D-minor arpeggio with a shimmer on top
  rez() { if (!this.ctx) return; const c = this.ctx, t = c.currentTime, notes = [62, 65, 69, 74, 77, 81, 86];
    notes.forEach((m, k) => { const w = t + .1 + k * .16; this.osc('triangle', 440 * Math.pow(2, (m - 69) / 12), w, .45, .045); this.osc('sine', 440 * Math.pow(2, (m - 57) / 12), w, .6, .02); });
    const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(73, t); o.frequency.exponentialRampToValueAtTime(147, t + 1.3); f.type = 'lowpass'; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2600, t + 1.3); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.07, t + .4); g.gain.exponentialRampToValueAtTime(.001, t + 1.6); o.connect(f).connect(g).connect(this.fx); o.start(t); o.stop(t + 1.7); },
  // floor rebuild: deep thump + blocks clicking into place as the wave passes
  rebuild() { if (!this.ctx) return; const c = this.ctx, t = c.currentTime; const o = this.osc('sine', 95, t, .7, .4); o.frequency.exponentialRampToValueAtTime(32, t + .6);
    for (let k = 0; k < 22; k++) { const w = t + .08 + Math.pow(k / 22, 1.4) * 2.2, n = this.noise(.03), f = c.createBiquadFilter(), g = c.createGain(), p = c.createStereoPanner ? c.createStereoPanner() : null; f.type = 'bandpass'; f.frequency.value = rand(900, 2600); f.Q.value = 4; this.env(g, w, .001, .07 * (1 - k / 26), .03); n.connect(f).connect(g); if (p) { p.pan.value = rand(-.8, .8); g.connect(p).connect(this.fx); } else g.connect(this.fx); n.start(w); } },
  click(p = 1) { if (!this.ctx) return; const t = this.ctx.currentTime; this.osc('square', 660 * p, t, .05, .03); this.osc('sine', 1320 * p, t + .03, .08, .03); }
};
})();
