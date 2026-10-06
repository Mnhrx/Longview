/* ================================================================
   Redline FX — everything that moves.
   1. BG3D   : Three.js glossy shapes (tyres, pistons, bolts) that react to tilt
   2. Wheel  : WebGL liquid wheel hero (bike health flows round like oil)
   3. Tubes  : glossy liquid tubes + mini liquid rings (service lines, renewals)
   4. Tank   : fuel tank with liquid that sloshes when you tilt or tap
   5. Burst  : particles + speed streaks on the fx canvas
   6. Boot   : chrome blobs melt into the wheel
   7. Sound  : synthesized taps, swooshes, engine rev, chime, Ride Wrap music
   ================================================================ */
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const isDark = () => {
  const t = document.documentElement.dataset.theme;
  return t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
};
const hex2rgb = h => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
const DPR = Math.min(2, window.devicePixelRatio || 1);

/* Shared tilt input (phone tilt or finger/mouse position), smoothed */
const Tilt = {
  x: 0, y: 0, tx: 0, ty: 0, asked: false,
  init() {
    addEventListener('deviceorientation', e => {
      if (e.gamma == null) return;
      this.tx = Math.max(-1, Math.min(1, e.gamma / 35));
      this.ty = Math.max(-1, Math.min(1, (e.beta - 45) / 35));
    });
    addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      this.tx = (e.clientX / innerWidth) * 2 - 1; this.ty = (e.clientY / innerHeight) * 2 - 1;
    });
  },
  // iOS asks permission for motion; must be called from a tap
  async ask() {
    if (this.asked) return; this.asked = true;
    try { if (window.DeviceOrientationEvent && DeviceOrientationEvent.requestPermission) await DeviceOrientationEvent.requestPermission(); } catch (e) {}
  },
  step() { this.x += (this.tx - this.x) * .06; this.y += (this.ty - this.y) * .06; }
};
Tilt.init();

/* ---------------- 1. BG3D ---------------- */
const BG3D = {
  ok: false, spin: 0, zone: 0,
  init() {
    const cv = document.getElementById('bg3d');
    if (!window.THREE) return;
    try {
      const r = this.r = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true });
      r.setPixelRatio(DPR); r.setSize(innerWidth, innerHeight, false);
    } catch (e) { return; }
    this.ok = true;
    const scene = this.scene = new THREE.Scene();
    const cam = this.cam = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, .1, 100);
    cam.position.set(0, 0, 14);
    this.camT = { x: 0, y: 0, z: 14 };
    const root = this.root = new THREE.Group(); scene.add(root);
    const M = c => new THREE.MeshMatcapMaterial({ matcap: matcap(c), transparent: true, opacity: 1 });
    // capsule via lathe (r128 has no CapsuleGeometry)
    const capsule = (rad, len) => {
      const pts = []; for (let i = 0; i <= 12; i++) { const a = -Math.PI / 2 + Math.PI / 2 * i / 12; pts.push(new THREE.Vector2(Math.cos(a) * rad, Math.sin(a) * rad - len / 2)); }
      for (let i = 0; i <= 12; i++) { const a = Math.PI / 2 * i / 12; pts.push(new THREE.Vector2(Math.cos(a) * rad, Math.sin(a) * rad + len / 2)); }
      return new THREE.LatheGeometry(pts, 40);
    };
    // kept to the edges and pushed back, so they frame the content instead of sitting under it
    const defs = [
      [new THREE.TorusGeometry(1.5, .52, 40, 90), '#FF6A13', -3.9, 4.6, -4],      // tyre (tinted by bike colour)
      [new THREE.TorusGeometry(.9, .32, 32, 70), '#7B55FF', 4.1, -4.4, -3],       // small tyre
      [capsule(.42, 1.4), '#F01E5C', 3.9, 3.8, -3],                                 // piston pill
      [capsule(.34, 1.1), '#06AFA2', -4.2, -2.2, -2],
      [new THREE.SphereGeometry(.55, 48, 32), '#FFB000', 4.4, .4, -5],              // bolt sphere
      [new THREE.SphereGeometry(.36, 40, 28), '#FF2D6B', -3.4, -6.4, -4],
      [new THREE.TorusGeometry(.5, .18, 24, 48), '#13D3C1', -4.6, 1.2, -7],
      [capsule(.28, .85), '#FF7A1A', 2.8, -7.4, -5],
      [new THREE.TorusKnotGeometry(.5, .16, 120, 18, 2, 3), '#C9B5FF', 4.2, 8.4, -6],
      [new THREE.SphereGeometry(.26, 32, 24), '#7B55FF', -4.4, 8.6, -5],
    ].map(d => [d[0], d[1], d[2], d[3], d[4], 1]);
    this.objs = defs.map(([g, c, x, y, z, s], i) => {
      const m = new THREE.Mesh(g, M(c)); m.position.set(x, y, z); m.scale.setScalar(s);
      m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      m.userData = { base: new THREE.Vector3(x, y, z), sp: .15 + Math.random() * .3, ph: Math.random() * 6, tyre: i === 0 || i === 1 };
      root.add(m); return m;
    });
    addEventListener('resize', () => { this.r.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); });
    this.t0 = performance.now();
    const loop = () => { requestAnimationFrame(loop); if (!document.hidden) this.frame(); };
    loop();
  },
  frame() {
    const t = (performance.now() - this.t0) / 1000;
    Tilt.step();
    this.spin *= .97;
    const c = this.cam, ct = this.camT;
    c.position.x += (ct.x + Tilt.x * .9 - c.position.x) * .05;
    c.position.y += (ct.y - Tilt.y * .9 - c.position.y) * .05;
    c.position.z += (ct.z - c.position.z) * .05;
    c.lookAt(ct.x * .6, ct.y * .6, 0);
    for (const m of this.objs) {
      const u = m.userData;
      m.position.y = u.base.y + Math.sin(t * u.sp + u.ph) * .35;
      m.position.x = u.base.x + Math.cos(t * u.sp * .8 + u.ph) * .2;
      m.rotation.x += reduceMotion ? 0 : .002 + u.sp * .004;
      m.rotation.y += reduceMotion ? 0 : .003 + (u.tyre ? this.spin : 0);
    }
    this.r.render(this.scene, c);
  },
  // each tab is a "zone": the camera swoops to a new part of the shape field
  setZone(i) {
    if (!this.ok) return;
    const z = [[0, 0, 14], [1.4, -2.2, 12.5], [-1.2, 2.6, 13], [1.2, 3.4, 12], [-1, -3.4, 13.5]][i] || [0, 0, 14];
    Object.assign(this.camT, { x: z[0], y: z[1], z: z[2] });
  },
  rev(amount = .25) { this.spin = amount; },
  swoopIn() { if (!this.ok) return; this.cam.position.z = 30; this.cam.position.y = -6; }
};
// Generated matcap: glossy plastic look without lights/env maps
function matcap(col) {
  const s = 256, c = document.createElement('canvas'); c.width = c.height = s; const g = c.getContext('2d');
  const [r, gg, b] = hex2rgb(col).map(v => Math.round(v * 255));
  const dark = `rgb(${r * .35 | 0},${gg * .35 | 0},${b * .35 | 0})`, mid = `rgb(${r},${gg},${b})`;
  const light = `rgb(${Math.min(255, r + 90)},${Math.min(255, gg + 90)},${Math.min(255, b + 90)})`;
  let gr = g.createRadialGradient(s * .42, s * .38, s * .05, s * .5, s * .5, s * .52);
  gr.addColorStop(0, light); gr.addColorStop(.45, mid); gr.addColorStop(.9, dark); gr.addColorStop(1, dark);
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
  // rim light (bottom right)
  gr = g.createRadialGradient(s * .72, s * .78, 0, s * .72, s * .78, s * .35); gr.addColorStop(0, 'rgba(255,200,240,.55)'); gr.addColorStop(1, 'rgba(255,200,240,0)');
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
  // sharp specular (top left)
  gr = g.createRadialGradient(s * .33, s * .28, 0, s * .33, s * .28, s * .14); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.5, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c); return t;
}

/* ---------------- WebGL helper ---------------- */
function glProgram(cv, frag) {
  const gl = cv.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: true });
  if (!gl) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(s)); return s; };
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'));
  gl.attachShader(p, sh(gl.FRAGMENT_SHADER, 'precision highp float;' + frag));
  gl.linkProgram(p); gl.useProgram(p);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(p, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = {}; const u = n => U[n] || (U[n] = gl.getUniformLocation(p, n));
  return { gl, u, draw() { gl.viewport(0, 0, cv.width, cv.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3); } };
}
function fitCanvas(cv) {
  const r = cv.getBoundingClientRect(), w = Math.max(1, Math.round(r.width * DPR)), h = Math.max(1, Math.round(r.height * DPR));
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  return { w, h };
}

/* ---------------- 2. Liquid wheel ---------------- */
const WHEEL_FRAG = `
uniform vec2 uRes; uniform float uT, uProg, uSpin, uWob, uIn;
uniform vec3 uC1, uC2, uC3, uTyre; uniform float uDark;
const float PI=3.14159265, TAU=6.2831853;
float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
vec3 pal(float t){t=fract(t)*3.;vec3 c=t<1.?mix(uC1,uC2,smoothstep(0.,1.,t)):t<2.?mix(uC2,uC3,smoothstep(1.,2.,t)):mix(uC3,uC1,smoothstep(2.,3.,t));return c;}
const float R=.72;
float ang(vec2 p){float a=atan(p.x,p.y);return a<0.?a+TAU:a;}
// liquid tube: arc from top clockwise to uProg, rippling width, heavy drop at the front
float liquid(vec2 p,out float tt){
  float pr=max(uProg,.0001)*uIn;
  float t=ang(p)/TAU;
  float w0=.075;
  float rip=1.+(.13+uWob*.5)*sin(t*TAU*6.-uT*3.2)+.06*sin(t*TAU*13.+uT*2.1);
  float d;
  if(t<=pr){ d=abs(length(p)-R)-w0*rip; tt=t; }
  else {
    vec2 s=vec2(0.,R); vec2 e=R*vec2(sin(pr*TAU),cos(pr*TAU));
    float ds=length(p-s), de=length(p-e);
    d=min(ds,de)-w0; tt=ds<de?0.:pr;
  }
  // drop head + stretchy neck just behind it
  float ha=pr*TAU; vec2 hc=R*vec2(sin(ha),cos(ha));
  float hb=(pr-.035)*TAU; vec2 nc=R*vec2(sin(hb),cos(hb));
  float pulse=1.+.08*sin(uT*4.)+uWob*.3;
  d=smin(d,length(p-hc)-w0*1.55*pulse,.07);
  d=smin(d,length(p-nc)-w0*1.15,.05);
  return d;
}
void main(){
  vec2 p=(gl_FragCoord.xy-uRes*.5)/(min(uRes.x,uRes.y)*.5);
  vec4 col=vec4(0.);
  // ---- tyre with rotating tread ----
  float r=length(p), a=ang(p)/TAU;
  float tread=step(.45,fract((a+uSpin)*56.));
  float dTy=abs(r-.92)-(.04+.008*tread);
  if(dTy<.004){
    float k=clamp(-dTy/.055,0.,1.); float z=sqrt(1.-(1.-k)*(1.-k));
    vec3 n=normalize(vec3(normalize(p)*(1.-k)*sign(r-.92),z));
    vec3 L=normalize(vec3(-.5,.6,.7));
    float spec=pow(max(dot(reflect(-L,n),vec3(0,0,1)),0.),26.);
    vec3 c=uTyre*(.55+.45*max(dot(n,L),0.))+spec*.55;
    float al=smoothstep(.004,-.004,dTy)*.92*uIn;
    col=vec4(c*al,al);
  }
  // ---- faint glass track ----
  float dTr=abs(r-R)-.032;
  float tr=smoothstep(.006,-.006,dTr)*(uDark>.5?.16:.22);
  col=col*(1.-tr)+vec4(vec3(uDark>.5?1.:.35)*tr,tr);
  // ---- liquid ----
  float tt; float d=liquid(p,tt);
  if(d<.01){
    float e=.002;
    float d1=liquid(p+vec2(e,0.),tt), d2=liquid(p+vec2(0.,e),tt);
    float dd=liquid(p,tt);
    vec2 g=normalize(vec2(d1-dd,d2-dd)+1e-6);
    float k=clamp(-dd/.085,0.,1.);
    float z=sqrt(max(1.-(1.-k)*(1.-k),0.));
    vec3 n=normalize(vec3(g*(1.-k)*1.2,z+.05));
    vec3 base=pal(tt+uT*.04);
    vec3 L=normalize(vec3(-.45,.65,.65));
    float dif=max(dot(n,L),0.);
    float spec=pow(max(dot(reflect(-L,n),vec3(0,0,1)),0.),48.);
    float rim=pow(1.-z,2.);
    vec3 c=base*(.45+.65*dif)+spec*.95+rim*base*.25-rim*.18;
    // lava swirl inside
    c+=.10*sin(tt*TAU*8.-uT*1.7+z*3.)*base;
    float al=smoothstep(.006,-.006,dd);
    col=col*(1.-al)+vec4(c*al,al);
  }
  gl_FragColor=col;
}`;
class Wheel {
  constructor(cv) {
    this.cv = cv; this.P = glProgram(cv, WHEEL_FRAG); this.prog = 0; this.target = 0; this.spin = 0; this.speed = .02; this.wob = 0; this.inT = 0;
    this.cols = [[1, .48, .1], [1, .18, .42], [.6, .48, 1]];
    this.t0 = performance.now(); this.alive = true;
    cv.addEventListener('pointerdown', () => { this.wob = .9; this.speed += .25; Sound.tap(); });
    const loop = () => { if (!this.alive) return; requestAnimationFrame(loop); if (!document.hidden && this.cv.isConnected) this.draw(); else if (!this.cv.isConnected) this.alive = false; };
    loop();
  }
  set(frac, colors) { this.target = Math.max(.02, Math.min(1, frac)); if (colors) this.cols = colors.map(hex2rgb); }
  rev(v = .9) { this.speed = v; }
  draw() {
    if (!this.P) return;
    const { gl, u } = this.P, { w, h } = fitCanvas(this.cv);
    const t = (performance.now() - this.t0) / 1000;
    this.inT = Math.min(1, this.inT + .022); const ein = 1 - Math.pow(1 - this.inT, 3);
    this.prog += (this.target - this.prog) * .045;
    this.speed += (.012 - this.speed) * .02; this.spin += reduceMotion ? 0 : this.speed * .05;
    this.wob *= .94;
    gl.uniform2f(u('uRes'), w, h); gl.uniform1f(u('uT'), reduceMotion ? 0 : t); gl.uniform1f(u('uProg'), this.prog);
    gl.uniform1f(u('uSpin'), this.spin); gl.uniform1f(u('uWob'), this.wob); gl.uniform1f(u('uIn'), ein);
    gl.uniform3fv(u('uC1'), this.cols[0]); gl.uniform3fv(u('uC2'), this.cols[1]); gl.uniform3fv(u('uC3'), this.cols[2]);
    gl.uniform3fv(u('uTyre'), isDark() ? [.36, .26, .42] : [.26, .14, .3]); gl.uniform1f(u('uDark'), isDark() ? 1 : 0);
    this.P.draw();
  }
}

/* ---------------- 3. Liquid tubes & mini rings (Canvas 2D, one shared loop) ---------------- */
const STATUS_COLS = { ok: ['#13D3C1', '#7B55FF'], soon: ['#FFBE2E', '#FF6A13'], over: ['#FF2D6B', '#D9142F'], unset: ['#CBBFD6', '#9C8CAB'], hot: ['#FF7A1A', '#FF2D6B'], fuel: ['#FFBE2E', '#FF2D6B'] };
const Liquids = {
  items: new Set(), t0: performance.now(), running: false,
  add(o) { this.items.add(o); if (!this.running) { this.running = true; this.loop(); } },
  loop() {
    requestAnimationFrame(() => this.loop());
    if (document.hidden) return;
    const t = (performance.now() - this.t0) / 1000;
    for (const o of this.items) { if (!o.cv.isConnected) { this.items.delete(o); continue; } o.draw(t); }
  },
  // scan the DOM for <canvas data-tube="0.6" data-s="ok"> and <canvas data-ring=...>
  scan(root = document) {
    root.querySelectorAll('canvas[data-tube]:not([data-on])').forEach(cv => { cv.dataset.on = 1; this.add(new Tube(cv, +cv.dataset.tube, cv.dataset.s)); });
    root.querySelectorAll('canvas[data-ring]:not([data-on])').forEach(cv => { cv.dataset.on = 1; this.add(new MiniRing(cv, +cv.dataset.ring, cv.dataset.s)); });
    root.querySelectorAll('canvas[data-tank]:not([data-on])').forEach(cv => { cv.dataset.on = 1; this.add(new Tank(cv, +cv.dataset.tank)); });
  }
};
function glossGrad(g, x0, y0, x1, y1, c1, c2) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  gr.addColorStop(0, c1); gr.addColorStop(1, c2); return gr;
}
class Tube {
  constructor(cv, frac, s) { this.cv = cv; this.target = Math.max(0, Math.min(1, frac)); this.f = 0; this.cols = STATUS_COLS[s] || STATUS_COLS.ok; this.delay = Math.random() * .25; this.start = null; this.ph = Math.random() * 6; }
  draw(t) {
    const { w, h } = fitCanvas(this.cv), g = this.cv.getContext('2d');
    if (this.start == null) this.start = t;
    const k = Math.min(1, Math.max(0, (t - this.start - this.delay) / 1.1)); const e = 1 - Math.pow(1 - k, 3) * Math.cos(k * 4.2); // fills with a little liquid overshoot
    this.f = this.target * Math.min(1.04, e);
    g.clearRect(0, 0, w, h);
    const r = h * .32, cy = h / 2, x0 = r + h * .18, x1 = w - h * .5;
    // faint track
    g.lineCap = 'round'; g.lineWidth = h * .26; g.strokeStyle = isDark() ? 'rgba(255,255,255,.1)' : 'rgba(34,16,47,.08)';
    g.beginPath(); g.moveTo(x0, cy); g.lineTo(x1, cy); g.stroke();
    if (this.target <= 0.001) { // empty: just a small bead at the start
      g.fillStyle = this.cols[1]; g.globalAlpha = .55; g.beginPath(); g.arc(x0, cy, r * .75, 0, 7); g.fill(); g.globalAlpha = 1; return;
    }
    const xf = x0 + (x1 - x0) * Math.max(.02, this.f);
    // liquid body with rippling top & bottom
    g.beginPath();
    const steps = 30;
    for (let i = 0; i <= steps; i++) { const x = x0 + (xf - x0) * i / steps; const rr = r * (1 + .1 * Math.sin(i * .9 - t * 4 + this.ph)); i ? g.lineTo(x, cy - rr) : g.moveTo(x, cy - rr); }
    for (let i = steps; i >= 0; i--) { const x = x0 + (xf - x0) * i / steps; const rr = r * (1 + .1 * Math.sin(i * .9 - t * 4 + this.ph)); g.lineTo(x, cy + rr); }
    g.closePath();
    g.fillStyle = glossGrad(g, x0, 0, xf, 0, this.cols[0], this.cols[1]); g.fill();
    // start cap & heavy front drop
    g.beginPath(); g.arc(x0, cy, r, 0, 7); g.fillStyle = this.cols[0]; g.fill();
    const dr = r * (1.42 + .06 * Math.sin(t * 5 + this.ph));
    g.beginPath(); g.arc(xf, cy, dr, 0, 7); g.fillStyle = this.cols[1]; g.fill();
    // glossy shading: dark underside, bright highlight band
    g.save(); g.globalCompositeOperation = 'source-atop';
    let sh = g.createLinearGradient(0, cy - dr, 0, cy + dr);
    sh.addColorStop(0, 'rgba(255,255,255,.12)'); sh.addColorStop(.3, 'rgba(255,255,255,.55)'); sh.addColorStop(.42, 'rgba(255,255,255,.08)'); sh.addColorStop(.85, 'rgba(0,0,0,.22)'); sh.addColorStop(1, 'rgba(0,0,0,.35)');
    g.fillStyle = sh; g.fillRect(0, 0, w, h); g.restore();
    // specular dot on the drop
    g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.ellipse(xf - dr * .35, cy - dr * .42, dr * .28, dr * .16, -.3, 0, 7); g.fill();
  }
}
class MiniRing {
  constructor(cv, frac, s) { this.cv = cv; this.target = Math.max(0, Math.min(1, frac)); this.cols = STATUS_COLS[s] || STATUS_COLS.ok; this.start = null; this.ph = Math.random() * 6; }
  draw(t) {
    const { w, h } = fitCanvas(this.cv), g = this.cv.getContext('2d');
    if (this.start == null) this.start = t;
    const k = Math.min(1, (t - this.start) / 1.3), e = 1 - Math.pow(1 - k, 4);
    const f = this.target * e;
    g.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, R = w * .36, lw = w * .12;
    g.lineCap = 'round'; g.lineWidth = lw * .55; g.strokeStyle = isDark() ? 'rgba(255,255,255,.1)' : 'rgba(34,16,47,.08)';
    g.beginPath(); g.arc(cx, cy, R, 0, 7); g.stroke();
    if (this.target <= .001) return;
    const a0 = -Math.PI / 2, a1 = a0 + Math.max(.05, f) * Math.PI * 2;
    // body
    const grd = g.createLinearGradient(0, 0, w, h); grd.addColorStop(0, this.cols[0]); grd.addColorStop(1, this.cols[1]);
    g.strokeStyle = grd; g.lineWidth = lw * (1 + .06 * Math.sin(t * 4 + this.ph)); g.beginPath(); g.arc(cx, cy, R, a0, a1); g.stroke();
    // inner shadow + highlight strokes for the glossy tube look
    g.lineWidth = lw * .3; g.strokeStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(cx, cy, R - lw * .18, a0 + .05, a1 - .05); g.stroke();
    g.lineWidth = lw * .22; g.strokeStyle = 'rgba(0,0,0,.16)'; g.beginPath(); g.arc(cx, cy, R + lw * .32, a0, a1); g.stroke();
    // drop head
    const hx = cx + Math.cos(a1) * R, hy = cy + Math.sin(a1) * R, hr = lw * .78;
    g.fillStyle = this.cols[1]; g.beginPath(); g.arc(hx, hy, hr, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(hx - hr * .3, hy - hr * .35, hr * .3, 0, 7); g.fill();
  }
}

/* ---------------- 4. Fuel tank ---------------- */
class Tank {
  constructor(cv, frac) {
    this.cv = cv; this.target = Math.max(0, Math.min(1, frac)); this.level = 0; this.ang = 0; this.vel = 0; this.start = null;
    this.bub = Array.from({ length: 9 }, () => ({ x: Math.random(), y: Math.random(), s: .4 + Math.random() * .8 }));
    cv.addEventListener('pointerdown', () => { this.vel += .09; Sound.splash(); });
  }
  draw(t) {
    const { w, h } = fitCanvas(this.cv), g = this.cv.getContext('2d');
    if (this.start == null) this.start = t;
    const k = Math.min(1, (t - this.start) / 1.6); this.level = this.target * (1 - Math.pow(1 - k, 3));
    // slosh: spring towards phone tilt
    const goal = -Tilt.x * .35; this.vel += (goal - this.ang) * .02; this.vel *= .955; this.ang += this.vel;
    g.clearRect(0, 0, w, h);
    // tank silhouette (motorcycle-tank teardrop)
    const path = () => {
      g.beginPath();
      g.moveTo(w * .5, h * .06);
      g.bezierCurveTo(w * .92, h * .06, w * .96, h * .45, w * .9, h * .72);
      g.bezierCurveTo(w * .84, h * .95, w * .16, h * .95, w * .1, h * .72);
      g.bezierCurveTo(w * .04, h * .45, w * .08, h * .06, w * .5, h * .06);
      g.closePath();
    };
    path(); g.fillStyle = isDark() ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.55)'; g.fill();
    g.lineWidth = 2 * DPR; g.strokeStyle = isDark() ? 'rgba(255,255,255,.18)' : 'rgba(34,16,47,.12)'; g.stroke();
    g.save(); path(); g.clip();
    const top = h * .08, bot = h * .92, ly = bot - (bot - top) * this.level;
    // liquid surface tilts and ripples
    g.beginPath(); g.moveTo(-10, h + 10);
    for (let i = 0; i <= 24; i++) {
      const x = w * i / 24, dx = x - w / 2;
      const y = ly + dx * Math.tan(this.ang) + Math.sin(i * .7 + t * 3) * h * .008 + Math.sin(i * .35 - t * 2) * h * .006 * (1 + Math.abs(this.vel) * 30);
      g.lineTo(x, y);
    }
    g.lineTo(w + 10, h + 10); g.closePath();
    const lg = g.createLinearGradient(0, ly - 20, 0, bot); lg.addColorStop(0, '#FFC23D'); lg.addColorStop(.45, '#FF7A1A'); lg.addColorStop(1, '#F01E5C');
    g.fillStyle = lg; g.fill();
    // bubbles
    g.fillStyle = 'rgba(255,255,255,.45)';
    for (const b of this.bub) { b.y -= .0025 * b.s; if (b.y < 0) { b.y = 1; b.x = Math.random(); } const by = ly + (bot - ly) * b.y; if (by > ly + 6) { g.beginPath(); g.arc(w * (.25 + b.x * .5), by, 2.4 * DPR * b.s, 0, 7); g.fill(); } }
    // side shading for roundness
    const sg = g.createLinearGradient(0, 0, w, 0); sg.addColorStop(0, 'rgba(0,0,0,.22)'); sg.addColorStop(.3, 'rgba(255,255,255,.12)'); sg.addColorStop(.7, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,.25)');
    g.fillStyle = sg; g.fillRect(0, 0, w, h);
    g.restore();
    // glass highlight
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 3.5 * DPR; g.lineCap = 'round';
    g.beginPath(); g.moveTo(w * .26, h * .2); g.quadraticCurveTo(w * .16, h * .4, w * .2, h * .6); g.stroke();
    // filler cap
    g.fillStyle = isDark() ? '#5b4a66' : '#2a1636'; g.beginPath(); g.ellipse(w * .5, h * .06, w * .12, h * .035, 0, 0, 7); g.fill();
  }
}

/* ---------------- 5. Burst particles ---------------- */
const Burst = {
  parts: [], running: false,
  ensure() { this.cv = document.getElementById('fx'); this.g = this.cv.getContext('2d'); },
  go(kind = 'pop', x = innerWidth / 2, y = innerHeight * .42) {
    if (reduceMotion) return; this.ensure();
    const cols = ['#FF7A1A', '#FF2D6B', '#9B7BFF', '#13D3C1', '#FFBE2E'];
    const n = kind === 'big' ? 70 : kind === 'speed' ? 46 : 30;
    for (let i = 0; i < n; i++) {
      if (kind === 'speed') {
        this.parts.push({ type: 'streak', x: -50 - Math.random() * 200, y: Math.random() * innerHeight, vx: 22 + Math.random() * 26, vy: 0, life: 1, len: 60 + Math.random() * 140, c: cols[i % 5], w: 2 + Math.random() * 5 });
      } else {
        const a = Math.random() * Math.PI * 2, v = 4 + Math.random() * (kind === 'big' ? 13 : 8);
        this.parts.push({ type: 'blob', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 4, life: 1, r: 5 + Math.random() * 9, c: cols[i % 5] });
      }
    }
    if (!this.running) { this.running = true; this.loop(); }
  },
  loop() {
    const { cv, g } = this; const w = cv.width = innerWidth * DPR, h = cv.height = innerHeight * DPR;
    g.setTransform(DPR, 0, 0, DPR, 0, 0); g.clearRect(0, 0, w, h);
    this.parts = this.parts.filter(p => p.life > 0);
    for (const p of this.parts) {
      if (p.type === 'streak') {
        p.x += p.vx; p.life -= .018;
        const gr = g.createLinearGradient(p.x - p.len, 0, p.x, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, p.c);
        g.strokeStyle = gr; g.lineWidth = p.w; g.lineCap = 'round'; g.globalAlpha = Math.min(1, p.life * 2);
        g.beginPath(); g.moveTo(p.x - p.len, p.y); g.lineTo(p.x, p.y); g.stroke();
      } else {
        p.x += p.vx; p.y += p.vy; p.vy += .35; p.vx *= .985; p.life -= .014;
        const r = p.r * (0.6 + p.life * .4);
        g.globalAlpha = Math.min(1, p.life * 1.6);
        const gr = g.createRadialGradient(p.x - r * .35, p.y - r * .35, r * .1, p.x, p.y, r); gr.addColorStop(0, '#fff'); gr.addColorStop(.35, p.c); gr.addColorStop(1, p.c);
        g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, r, 0, 7); g.fill();
      }
    }
    g.globalAlpha = 1;
    if (this.parts.length) requestAnimationFrame(() => this.loop()); else { this.running = false; g.clearRect(0, 0, w, h); }
  }
};

/* ---------------- 6. Boot: chrome blobs melt into the wheel ---------------- */
const BLOB_FRAG = `
uniform vec2 uRes; uniform vec3 uB[10]; uniform vec3 uCol[10]; uniform float uFade;
void main(){
  vec2 p=(gl_FragCoord.xy-uRes*.5)/(min(uRes.x,uRes.y)*.5);
  float f=0.; vec2 gr=vec2(0.); vec3 c=vec3(0.); float wsum=0.;
  for(int i=0;i<10;i++){ vec2 d=p-uB[i].xy; float d2=dot(d,d)+1e-4; float r2=uB[i].z*uB[i].z; float v=r2/d2; f+=v; gr+=-2.*r2*d/(d2*d2); c+=uCol[i]*v; wsum+=v; }
  c/=max(wsum,1e-4);
  float edge=smoothstep(.96,1.04,f);
  if(edge<=0.){gl_FragColor=vec4(0.);return;}
  vec3 n=normalize(vec3(-gr*.045,1.));
  vec3 L=normalize(vec3(-.5,.6,.7));
  float dif=max(dot(n,L),0.), spec=pow(max(dot(reflect(-L,n),vec3(0,0,1)),0.),40.);
  vec3 col=c*(.45+.65*dif)+spec*.9;
  float a=edge*uFade; gl_FragColor=vec4(col*a,a);
}`;
const Boot = {
  run(el, onDone) {
    const cv = el.querySelector('canvas'); const P = glProgram(cv, BLOB_FRAG);
    if (!P || reduceMotion) { el.remove(); onDone(); return; }
    const cols = ['#FF7A1A', '#FF2D6B', '#9B7BFF', '#13D3C1', '#FFBE2E'].map(hex2rgb);
    const start = Array.from({ length: 10 }, (_, i) => { const a = Math.random() * 6.28, d = 1.2 + Math.random() * .5; return [Math.cos(a) * d, Math.sin(a) * d]; });
    const colArr = new Float32Array(30); for (let i = 0; i < 10; i++) colArr.set(cols[i % 5], i * 3);
    const t0 = performance.now(); const word = el.querySelector('.w');
    let done = false;
    const frame = () => {
      const t = (performance.now() - t0) / 1000; const { w, h } = fitCanvas(cv);
      const B = new Float32Array(30);
      const k = Math.min(1, t / 1.1), e = 1 - Math.pow(1 - k, 3);
      const spin = t * 2.2;
      for (let i = 0; i < 10; i++) {
        const a = i / 10 * 6.283 + spin; const tx = Math.cos(a) * .62, ty = Math.sin(a) * .62;
        const wob = .04 * Math.sin(t * 7 + i);
        B[i * 3] = start[i][0] + (tx - start[i][0]) * e + wob; B[i * 3 + 1] = start[i][1] + (ty - start[i][1]) * e - wob;
        B[i * 3 + 2] = .17 + .05 * Math.sin(t * 5 + i * 2) * (1 - e) + (t > 1.1 ? .02 * Math.sin(t * 9) : 0);
      }
      const { gl, u } = P;
      gl.uniform2f(u('uRes'), w, h); gl.uniform3fv(u('uB[0]'), B); gl.uniform3fv(u('uCol[0]'), colArr);
      const fade = t < 1.45 ? 1 : Math.max(0, 1 - (t - 1.45) / .3); gl.uniform1f(u('uFade'), fade);
      P.draw();
      if (word) { word.style.opacity = Math.min(1, Math.max(0, (t - .55) / .3)) * fade; word.style.transform = `translateY(${(1 - Math.min(1, (t - .55) / .4)) * 14}px)`; }
      if (t > 1.15 && !done) { done = true; onDone(); el.style.transition = 'opacity .35s'; }
      if (t > 1.4) { el.style.opacity = '0'; cv.style.transform = `scale(${1 + (t - 1.4) * 2.4})`; }
      if (t < 1.8) requestAnimationFrame(frame); else el.remove();
    };
    requestAnimationFrame(frame);
  }
};

/* ---------------- 7. Sound (all synthesized, no files) ---------------- */
const Sound = {
  on: true, ctx: null,
  unlock() {
    if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); this.master = this.ctx.createGain(); this.master.gain.value = .55; this.master.connect(this.ctx.destination); } catch (e) {} }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },
  ok() { return this.on && this.ctx && this.ctx.state === 'running'; },
  env(node, t, a, peak, d) { node.gain.setValueAtTime(0, t); node.gain.linearRampToValueAtTime(peak, t + a); node.gain.exponentialRampToValueAtTime(.0001, t + a + d); },
  tone(f, d = .12, type = 'sine', peak = .2, when = 0, out) {
    if (!this.ok()) return; const c = this.ctx, t = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    this.env(g, t, .005, peak, d); o.connect(g).connect(out || this.master); o.start(t); o.stop(t + d + .05);
    return o;
  },
  noise(d = .3) { const c = this.ctx, b = c.createBuffer(1, c.sampleRate * d, c.sampleRate), a = b.getChannelData(0); for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1; const s = c.createBufferSource(); s.buffer = b; return s; },
  tap() { this.tone(1400, .05, 'triangle', .07); },
  swoosh() {
    if (!this.ok()) return; const c = this.ctx, t = c.currentTime, s = this.noise(.4), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2600, t + .22); f.frequency.exponentialRampToValueAtTime(900, t + .38);
    this.env(g, t, .08, .12, .3); s.connect(f).connect(g).connect(this.master); s.start(t); s.stop(t + .45);
  },
  splash() {
    if (!this.ok()) return; const c = this.ctx, t = c.currentTime;
    for (let i = 0; i < 3; i++) { const o = this.tone(500 + Math.random() * 300, .08, 'sine', .08, i * .05); if (o) o.frequency.exponentialRampToValueAtTime(1400, t + i * .05 + .07); }
  },
  chime() { [0, .09, .18].forEach((w, i) => this.tone([880, 1108.7, 1318.5][i], .5, 'sine', .14, w)); this.tone(1760, .7, 'triangle', .04, .2); },
  // engine rev: detuned saws + square sub through a low-pass, rpm rises and falls
  rev(len = 1.4) {
    if (!this.ok()) return; const c = this.ctx, t = c.currentTime;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 6; lp.frequency.setValueAtTime(380, t); lp.frequency.linearRampToValueAtTime(2200, t + len * .45); lp.frequency.exponentialRampToValueAtTime(420, t + len);
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.2, t + .06); g.gain.setValueAtTime(.2, t + len * .6); g.gain.exponentialRampToValueAtTime(.0001, t + len);
    const drive = c.createWaveShaper(); const cur = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; cur[i] = Math.tanh(x * 3); } drive.curve = cur;
    lp.connect(drive).connect(g).connect(this.master);
    [[1, 'sawtooth'], [1.01, 'sawtooth'], [.5, 'square']].forEach(([m, type]) => {
      const o = c.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(38 * m, t); o.frequency.exponentialRampToValueAtTime(150 * m, t + len * .42); o.frequency.exponentialRampToValueAtTime(46 * m, t + len);
      // firing pulses: amplitude-modulate at the rpm-ish rate
      const am = c.createGain(); const lfo = c.createOscillator(); lfo.type = 'square'; lfo.frequency.setValueAtTime(14, t); lfo.frequency.exponentialRampToValueAtTime(55, t + len * .42); lfo.frequency.exponentialRampToValueAtTime(16, t + len);
      const lg = c.createGain(); lg.gain.value = .35; lfo.connect(lg).connect(am.gain); am.gain.value = .65;
      o.connect(am).connect(lp); o.start(t); o.stop(t + len + .05); lfo.start(t); lfo.stop(t + len + .05);
    });
  },
  // Ride Wrap music: an original driving synth-house loop (~118 bpm). Returns stop().
  music() {
    if (!this.ok()) return () => {};
    const c = this.ctx, bus = c.createGain(); bus.gain.value = 0; bus.connect(this.master);
    bus.gain.linearRampToValueAtTime(.9, c.currentTime + 1.2);
    const spb = 60 / 118, s16 = spb / 4; let next = c.currentTime + .1, step = 0, stopped = false;
    const chords = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 66]]; // Am9-ish → Fmaj7 → Cmaj7 → G6
    const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
    const play = (t, s) => {
      const bar = Math.floor(s / 16) % 4, st = s % 16;
      if (st % 4 === 0) { // kick
        const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + .14);
        this.env(g, t, .002, .5, .26); o.connect(g).connect(bus); o.start(t); o.stop(t + .3);
      }
      if (st === 4 || st === 12) { const n = this.noise(.2), f = c.createBiquadFilter(), g = c.createGain(); f.type = 'bandpass'; f.frequency.value = 1500; this.env(g, t, .002, .22, .14); n.connect(f).connect(g).connect(bus); n.start(t); n.stop(t + .2); }
      if (st % 2 === 1) { const n = this.noise(.06), f = c.createBiquadFilter(), g = c.createGain(); f.type = 'highpass'; f.frequency.value = 7000; this.env(g, t, .001, st % 4 === 2 ? .08 : .05, .04); n.connect(f).connect(g).connect(bus); n.start(t); n.stop(t + .07); }
      // offbeat bass
      if (st % 4 === 2) { const root = chords[bar][0] - 24; const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = mtof(root); f.type = 'lowpass'; f.frequency.value = 600; this.env(g, t, .005, .16, .2); o.connect(f).connect(g).connect(bus); o.start(t); o.stop(t + .25); }
      // stab chords on the "and" + pad on bar start
      if (st === 3 || st === 10) chords[bar].forEach(m => { const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = mtof(m); f.type = 'lowpass'; f.frequency.setValueAtTime(2600, t); f.frequency.exponentialRampToValueAtTime(500, t + .2); this.env(g, t, .005, .035, .22); o.connect(f).connect(g).connect(bus); o.start(t); o.stop(t + .26); });
      if (st === 0) chords[bar].forEach(m => { const o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.value = mtof(m + 12); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.022, t + .4); g.gain.linearRampToValueAtTime(0, t + spb * 4); o.connect(g).connect(bus); o.start(t); o.stop(t + spb * 4 + .05); });
      // little arp melody
      const arp = [0, 2, 1, 3, 2, 1, 0, 3]; if (st % 2 === 0 && bar % 2 === 1) { const m = chords[bar][arp[(st / 2) % 8]] + 24; this.tone(mtof(m), .12, 'square', .025, t - c.currentTime, bus); }
    };
    const sched = () => { if (stopped) return; while (next < c.currentTime + .25) { play(next, step); next += s16; step++; } setTimeout(sched, 60); };
    sched();
    return () => { stopped = true; bus.gain.cancelScheduledValues(c.currentTime); bus.gain.setValueAtTime(bus.gain.value, c.currentTime); bus.gain.linearRampToValueAtTime(0, c.currentTime + .6); setTimeout(() => bus.disconnect(), 800); };
  }
};
addEventListener('pointerdown', () => Sound.unlock(), { capture: true });
