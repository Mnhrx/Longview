/* Redline world: the 3D arena, the bike holograms, the ride battle, the fuel tank and the control deck.
   The app feeds it data through W.update(view, parts, riders) and reacts to taps through W.onArc / W.onTile / W.onScore. */
window.W = (() => {
const API = {};
const T = THREE, cv = document.getElementById('stage');
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
let R; try { R = new T.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' }); } catch (e) { return null; }
const DPR = Math.min(devicePixelRatio || 1, innerWidth < 700 ? 1.6 : 2);
R.setPixelRatio(DPR); R.setSize(innerWidth, innerHeight, false);
const S = new T.Scene(); S.background = new T.Color('#010409'); S.fog = new T.FogExp2('#010409', .012);
const cam = new T.PerspectiveCamera(50, innerWidth / innerHeight, .1, 600);
const composer = new T.EffectComposer(R); composer.addPass(new T.RenderPass(S, cam));
const bloom = new T.UnrealBloomPass(new T.Vector2(innerWidth, innerHeight), .9, .5, .3); composer.addPass(bloom);

const CY = new T.Color('#4DF3FF'), AM = new T.Color('#FF8A1F'), RD = new T.Color('#FF3B5C');
const rand = (a, b) => a + Math.random() * (b - a), lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const V = (x, y, z) => new T.Vector3(x, y, z);

/* ============ PLACES in the arena (x, z, flat radius, blend radius) ============ */
const PLACES = [
  { name: 'HOME BASE', x: 0, z: 0, r0: 13, r1: 22 },
  { name: 'TRAIL VALLEY', x: -62, z: -48, r0: 19, r1: 28 },
  { name: 'HANGAR', x: 58, z: -70, r0: 14, r1: 22 },
  { name: 'DEPOT', x: -50, z: 58, r0: 11, r1: 19 },
  { name: 'THE TOWER', x: 64, z: 46, r0: 10, r1: 18 },
];
const TILE = 3.5, NT = 80, HALF = NT * TILE / 2, STEP = 1.4, BOUND = HALF - 8;

/* ============ ARENA FLOOR: glossy tiles that stand up into terraces ============ */
// Same height maths in JS (for cameras and cycles) and GLSL (for the tiles).
const Hs = (x, z, s) => 3.4 * Math.sin(x * .045 + s) * Math.cos(z * .05 + s * 1.7) + 2.3 * Math.sin((x + z) * .07 + s * 2.3) + 1.4 * Math.cos(x * .11 - z * .09 + s * .7) + .7 * Math.sin(z * .21 + x * .05 + s * 3.1) + 2.2;
const smooth = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
const mask = (x, z) => PLACES.reduce((m, p) => m * smooth(p.r0, p.r1, Math.hypot(x - p.x, z - p.z)), 1);
const tileC = v => (Math.floor(v / TILE) + .5) * TILE;
const tileH = (cx, cz, s) => Math.max(0, Math.floor((Hs(cx, cz, s) - 2.6) * mask(cx, cz) / STEP + .5) * STEP);
const groundAt = (x, z) => Math.abs(x) > HALF || Math.abs(z) > HALF ? 0 : tileH(tileC(x), tileC(z), terrU.uA.value) + .06;

const terrU = { uT: { value: 0 }, uA: { value: 0 }, uB: { value: 0 }, uWave: { value: -1 }, uO: { value: new T.Vector2() },
  uP: { value: PLACES.map(p => new T.Vector4(p.x, p.z, p.r0, p.r1)) }, uCy: { value: CY }, uAm: { value: AM } };
const HEIGHT_GLSL = `
uniform float uT,uA,uB,uWave;uniform vec2 uO;uniform vec4 uP[5];
float Hs(float x,float z,float s){return 3.4*sin(x*.045+s)*cos(z*.05+s*1.7)+2.3*sin((x+z)*.07+s*2.3)+1.4*cos(x*.11-z*.09+s*.7)+.7*sin(z*.21+x*.05+s*3.1)+2.2;}
float maskP(vec2 q){float m=1.;for(int i=0;i<5;i++){m*=smoothstep(uP[i].z,uP[i].w,length(q-uP[i].xy));}return m;}
float tileH(vec2 c,float s){return max(0.,floor((Hs(c.x,c.y,s)-2.6)*maskP(c)/${STEP.toFixed(2)}+.5)*${STEP.toFixed(2)});}
float heightAt(vec2 c,out float ring){
  float d=length(c-uO);
  float m=uWave<0.?0.:1.-smoothstep(uWave-7.,uWave,d);
  ring=uWave<0.?0.:exp(-pow(d-uWave,2.)/14.)*(1.-smoothstep(170.,250.,uWave));
  return mix(tileH(c,uA),tileH(c,uB),m)+ring*1.6*maskP(c);
}`;
{
  const box = new T.BoxGeometry(1, 1, 1).translate(0, .5, 0);
  const g = new T.InstancedBufferGeometry(); g.index = box.index; g.setAttribute('position', box.attributes.position); g.setAttribute('normal', box.attributes.normal);
  const at = new Float32Array(NT * NT * 2); let k = 0;
  for (let i = 0; i < NT; i++) for (let j = 0; j < NT; j++) { at[k++] = -HALF + (i + .5) * TILE; at[k++] = -HALF + (j + .5) * TILE; }
  g.setAttribute('aTile', new T.InstancedBufferAttribute(at, 2)); g.instanceCount = NT * NT;
  const floor = new T.Mesh(g, new T.ShaderMaterial({ uniforms: terrU, extensions: { derivatives: true },
    vertexShader: HEIGHT_GLSL + `attribute vec2 aTile;varying vec3 vL,vN,vW;varying float vRing,vH;
      void main(){float r;float h=heightAt(aTile,r)+.06;vec3 p=position;vL=p;vN=normal;
        vec3 w=vec3(aTile.x+p.x*${(TILE * .965).toFixed(3)},p.y*h,aTile.y+p.z*${(TILE * .965).toFixed(3)});vW=w;vRing=r;vH=h;
        gl_Position=projectionMatrix*viewMatrix*vec4(w,1.);}`,
    fragmentShader: `uniform vec3 uCy,uAm;varying vec3 vL,vN,vW;varying float vRing,vH;
      void main(){
        vec3 n=normalize(vN);float dist=length(vW.xz-cameraPosition.xz);float fade=1.-smoothstep(75.,185.,dist);
        vec3 V=normalize(cameraPosition-vW);vec3 c;
        if(n.y>.5){
          float e=max(abs(vL.x),abs(vL.z));float w=fwidth(e);
          float border=smoothstep(.5-w*2.2,.5-w*.3,e);
          float groove=(1.-smoothstep(0.,w*1.4,abs(e-.34)))*.5;
          float raised=step(.5,vH);
          float gloss=pow(1.-clamp(V.y,0.,1.),4.);
          c=vec3(.008,.011,.016)+vec3(.03,.06,.08)*gloss;
          c+=uCy*(border*(.3+.18*raised)+groove*.05*(1.+raised));
          c+=mix(uCy,uAm,.8)*vRing*(.15+border*1.4);
        } else {
          float strip=smoothstep(.9,.985,vL.y);float base=smoothstep(.12,0.,vL.y);
          c=vec3(.004,.006,.009)+uCy*(strip*.45+base*.05);c+=uAm*vRing*strip;
        }
        gl_FragColor=vec4(c*fade,1.);}` }));
  floor.frustumCulled = false; S.add(floor);
}

/* ============ PERIMETER WALLS, STANDS, OVERHEAD STRUCTURES ============ */
const wallMat = new T.ShaderMaterial({ uniforms: { uCy: { value: CY }, uAm: { value: AM }, uT: terrU.uT }, side: T.DoubleSide, extensions: { derivatives: true },
  vertexShader: 'varying vec3 vW;varying vec2 vUv;void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
  fragmentShader: `uniform vec3 uCy,uAm;uniform float uT;varying vec3 vW;varying vec2 vUv;
    float line(float v,float at,float wd){float f=fwidth(v);return 1.-smoothstep(wd*.5,wd*.5+f*1.5,abs(v-at));}
    void main(){float y=vW.y;float along=vW.x+vW.z;
      float s=line(y,2.2,.18)*.9+line(y,9.,.1)*.5+line(y,21.6,.25)+line(y,15.,.06)*.3;
      float seam=line(fract(along/14.),.5,.02)*.25*smoothstep(2.4,3.,y)*(1.-smoothstep(20.,21.,y));
      float run=pow(.5+.5*sin(along*.12-uT*1.2),24.)*line(y,2.2,.18);
      vec3 c=vec3(.006,.008,.012)+uCy*(s+seam)*.9+uAm*run*1.5;
      gl_FragColor=vec4(c,1.);}` });
for (const [x, z, ry] of [[0, -HALF, 0], [0, HALF, Math.PI], [-HALF, 0, Math.PI / 2], [HALF, 0, -Math.PI / 2]]) {
  const w = new T.Mesh(new T.PlaneGeometry(HALF * 2, 22), wallMat); w.position.set(x, 11, z); w.rotation.y = ry; S.add(w);
}
// tiered stands: rows of small lights climbing into the dark behind the walls
{
  const pos = [], col = [], tierM = new T.MeshBasicMaterial({ color: '#020407' });
  for (let tier = 0; tier < 14; tier++) {
    const D = HALF + 10 + tier * 7, y = 5 + tier * 3.3;
    const slab = new T.Mesh(new T.BoxGeometry(D * 2, 3.2, 7), tierM);
    for (const [x, z, ry] of [[0, -D, 0], [0, D, 0], [-D, 0, Math.PI / 2], [D, 0, Math.PI / 2]]) { const m = slab.clone(); m.position.set(x, y - 2, z); m.rotation.y = ry; S.add(m); }
    for (let side = 0; side < 4; side++) for (let a = -D; a < D; a += 1.7) {
      if (Math.random() < .35) continue;
      const jitter = rand(-.3, .3), p = side === 0 ? [a, y, -D] : side === 1 ? [a, y, D] : side === 2 ? [-D, y, a] : [D, y, a];
      pos.push(p[0] + (side > 1 ? 0 : jitter), p[1] + rand(-.2, .4), p[2] + (side > 1 ? jitter : 0));
      const r = Math.random(), b = rand(.25, .9); const c = r < .08 ? AM : r < .5 ? CY : new T.Color(.85, .95, 1);
      col.push(c.r * b, c.g * b, c.b * b);
    }
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  S.add(new T.Points(g, new T.PointsMaterial({ size: .55, vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false })));
}
// faint horizon haze
S.add(new T.Mesh(new T.SphereGeometry(420, 32, 16), new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, fog: false, uniforms: { uCy: { value: CY } },
  vertexShader: 'varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: 'uniform vec3 uCy;varying vec3 vP;void main(){float h=vP.y;vec3 c=uCy*.06*exp(-abs(h-.12)*9.)+vec3(.01,.02,.035)*exp(-abs(h)*5.);gl_FragColor=vec4(c,1.);}' })));
// dark structures with light edges: ramps, spiral towers, hovering slabs
const EDGE_RIBBON = col => new T.ShaderMaterial({ uniforms: { uT: terrU.uT, uC: { value: col } }, transparent: true, depthWrite: false, side: T.DoubleSide,
  vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: `uniform vec3 uC;uniform float uT;varying vec2 vUv;
    void main(){float e=smoothstep(.07,0.,vUv.y)+smoothstep(.93,1.,vUv.y);
      float run=pow(.5+.5*sin(vUv.x*14.-uT*2.2),30.)*e;
      vec3 c=vec3(.006,.009,.013)+uC*(e*1.25+run*1.5);gl_FragColor=vec4(c,.94);}` });
function ribbon(points, width, col, up) {
  const curve = new T.CatmullRomCurve3(points), n = 220, pos = [], uv = [], idx = [], L = curve.getLength();
  for (let i = 0; i <= n; i++) { const u = i / n, p = curve.getPoint(u), tg = curve.getTangent(u), side = tg.clone().cross(up || V(0, 1, 0)).normalize();
    const a = p.clone().addScaledVector(side, -width / 2), b = p.clone().addScaledVector(side, width / 2); pos.push(a.x, a.y, a.z, b.x, b.y, b.z); uv.push(u * L / 40, 0, u * L / 40, 1);
    if (i) { const k = (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return new T.Mesh(g, EDGE_RIBBON(col));
}
const arena = new T.Group(); S.add(arena);
[[V(-30, 0, -84), V(-80, 0, -98), 22, CY], [V(26, 0, -26), V(34, 0, -60), 18, CY], [V(-92, 0, 40), V(-84, 0, 6), 20, AM], [V(84, 0, 10), V(98, 0, -34), 20, CY], [V(14, 0, 42), V(42, 0, 74), 16, AM], [V(-34, 0, -24), V(-44, 0, -10), 12, CY]].forEach(([a, b, h, c]) => {
  const d = b.clone().sub(a), m = a.clone().add(b).multiplyScalar(.5);
  arena.add(ribbon([a, a.clone().addScaledVector(d, .18).add(V(0, h * .55, 0)), m.clone().add(V(0, h, 0)), a.clone().addScaledVector(d, .82).add(V(0, h * .55, 0)), b], 4, c.clone()));
});
const spirals = [];
[[-112, 8], [18, -112], [114, -24], [4, 114], [-104, -104]].forEach(([x, z], k) => {
  const g = new T.Group(); g.position.set(x, 0, z); arena.add(g); spirals.push(g);
  const pts = []; for (let i = 0; i <= 160; i++) { const a = i / 160 * Math.PI * 2 * 4, y = i / 160 * 50; pts.push(V(Math.cos(a) * 6, y, Math.sin(a) * 6)); }
  g.add(ribbon(pts, 2.4, (k % 2 ? AM : CY).clone(), V(0, 1, 0)));
  const core = new T.Mesh(new T.CylinderGeometry(1.4, 1.8, 54, 6), new T.MeshBasicMaterial({ color: '#020407' })); core.position.y = 27; g.add(core);
  g.add(new T.LineSegments(new T.EdgesGeometry(core.geometry), new T.LineBasicMaterial({ color: CY.clone().multiplyScalar(.9) })).translateY(27));
});
const slabs = [];
[[-34, 34, -20, 30], [36, 40, 16, 24], [-6, 46, -66, 34], [-70, 38, 70, 22]].forEach(([x, y, z, w], i) => {
  const g = new T.Group(); g.position.set(x, y, z); g.rotation.y = i * .7; arena.add(g); slabs.push(g);
  const geo = new T.BoxGeometry(w, 1.6, w * .3); g.add(new T.Mesh(geo, new T.MeshBasicMaterial({ color: '#020407' })));
  g.add(new T.LineSegments(new T.EdgesGeometry(geo), new T.LineBasicMaterial({ color: (i % 2 ? AM : CY).clone().multiplyScalar(1.3) })));
  const under = new T.Mesh(new T.PlaneGeometry(w * .9, w * .22), new T.MeshBasicMaterial({ color: CY.clone().multiplyScalar(.5), transparent: true, opacity: .5, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
  under.rotation.x = Math.PI / 2; under.position.y = -.82; g.add(under);
});

/* ============ DUST drifting in the air ============ */
const ND = 4200, dp = new Float32Array(ND * 3), ds = new Float32Array(ND);
for (let i = 0; i < ND; i++) { dp.set([rand(-HALF, HALF), rand(.5, 22) * Math.pow(Math.random(), .6), rand(-HALF, HALF)], i * 3); ds[i] = Math.random(); }
const dg = new T.BufferGeometry(); dg.setAttribute('position', new T.BufferAttribute(dp, 3)); dg.setAttribute('seed', new T.BufferAttribute(ds, 1));
const dustU = { uSpeed: { value: 0 } };
S.add(new T.Points(dg, new T.ShaderMaterial({ uniforms: Object.assign(dustU, { uPx: { value: DPR } }, terrU), transparent: true, depthWrite: false, blending: T.AdditiveBlending,
  vertexShader: HEIGHT_GLSL + `uniform float uPx,uSpeed;uniform vec3 uCy;attribute float seed;varying float vA;varying vec3 vC;
    void main(){vec3 p=position;float r;float g=heightAt(p.xz,r);
      p.x+=sin(uT*.07+seed*30.)*3.;p.z+=cos(uT*.05+seed*20.)*3.;p.y=g+position.y+sin(uT*.4+seed*12.)*.6+r*4.;
      float tw=.5+.5*sin(uT*(.6+seed)+seed*50.);
      vA=(.35+.7*tw)*(1.-smoothstep(16.,22.,position.y))*(1.+r*2.+uSpeed);
      vC=mix(uCy,vec3(1.),seed*.5);vC=mix(vC,vec3(1.,.62,.3),r);
      vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=(1.2+seed*2.+uSpeed*2.)*uPx*(40./-mv.z);gl_Position=projectionMatrix*mv;}`,
  fragmentShader: 'varying float vA;varying vec3 vC;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;float a=pow(1.-d*2.,1.6)*vA;gl_FragColor=vec4(vC*a,a);}' })));

// near dust: a box of motes that travels with the camera, so there are always particles in the air around you
const NN = 1800, np = new Float32Array(NN * 3), ns = new Float32Array(NN);
for (let i = 0; i < NN; i++) { np.set([rand(-26, 26), rand(.3, 16), rand(-26, 26)], i * 3); ns[i] = Math.random(); }
const ng = new T.BufferGeometry(); ng.setAttribute('position', new T.BufferAttribute(np, 3)); ng.setAttribute('seed', new T.BufferAttribute(ns, 1));
const nearU = { uCam: { value: V() } };
const nearDust = new T.Points(ng, new T.ShaderMaterial({ uniforms: Object.assign(nearU, dustU, { uPx: { value: DPR } }, terrU), transparent: true, depthWrite: false, blending: T.AdditiveBlending,
  vertexShader: HEIGHT_GLSL + `uniform float uPx,uSpeed;uniform vec3 uCam,uCy;attribute float seed;varying float vA;varying vec3 vC;
    void main(){vec3 p=position;p.xz+=vec2(uT*.5,uT*.2)*(.4+seed);p.xz=mod(p.xz-uCam.xz+26.,52.)-26.+uCam.xz;
      float r;p.y=heightAt(p.xz,r)+position.y+sin(uT*.6+seed*20.)*.4;
      float edgeF=1.-smoothstep(18.,26.,length(p.xz-uCam.xz));
      vA=(.35+.5*sin(uT*(1.+seed)+seed*40.)*.5+.25)*edgeF*(1.+uSpeed);vC=mix(uCy,vec3(1.),.35+seed*.4);
      vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=(1.+seed*1.6+uSpeed*2.)*uPx*(14./-mv.z);gl_Position=projectionMatrix*mv;}`,
  fragmentShader: 'varying float vA;varying vec3 vC;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;float a=pow(1.-d*2.,1.5)*vA;gl_FragColor=vec4(vC*a,a);}' }));
nearDust.frustumCulled = false; S.add(nearDust);
// distant pixel clouds: big slow banks made of square pixels, lit from inside by lightning
const cloudU = { uScale: { value: 900 }, uFlash: { value: 0 }, uFP: { value: V() }, uT: terrU.uT, uCy: { value: CY } };
const cloudCenters = [];
{
  const pos = [], seed = [], G = 2.4;
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2 + rand(-.2, .2), d = rand(280, 330), c = V(Math.cos(a) * d, rand(54, 74), Math.sin(a) * d); cloudCenters.push(c);
    const blobs = Array.from({ length: 7 }, () => ({ o: V(rand(-44, 44), rand(-6, 10), rand(-24, 24)), r: rand(13, 26) }));
    for (let j = 0; j < 2600; j++) {
      const b = blobs[Math.floor(Math.random() * blobs.length)], u = V(rand(-1, 1), rand(-1, 1), rand(-1, 1)); if (u.length() > 1) { j--; continue; }
      const q = c.clone().add(b.o).add(V(u.x * b.r * 1.3, u.y * b.r * .45, u.z * b.r));
      pos.push(Math.round(q.x / G) * G, Math.round(q.y / G) * G, Math.round(q.z / G) * G); seed.push(Math.random());
    }
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('seed', new T.Float32BufferAttribute(seed, 1));
  const clouds = new T.Points(g, new T.ShaderMaterial({ uniforms: cloudU, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false,
    vertexShader: `uniform float uScale,uFlash,uT;uniform vec3 uFP,uCy;attribute float seed;varying vec3 vC;varying float vA;
      void main(){vec3 p=position;float lit=uFlash*exp(-pow(length(p-uFP)/30.,2.));
        float under=smoothstep(90.,60.,p.y);
        float tw=.75+.25*sin(uT*.3+seed*30.);
        vC=vec3(.12,.16,.22)+uCy*under*.22+vec3(.7,.85,1.)*lit;vA=(.45+.45*seed)*tw+lit*.9;
        vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=2.1*uScale/-mv.z;gl_Position=projectionMatrix*mv;}`,
    fragmentShader: 'varying vec3 vC;varying float vA;void main(){vec2 q=abs(gl_PointCoord-.5);if(max(q.x,q.y)>.42)discard;gl_FragColor=vec4(vC*vA,vA);}' }));
  clouds.frustumCulled = false; S.add(clouds);
}
let nextFlash = 2, flashT = -9;
function updateClouds(t) {
  if (t > nextFlash) { const c = cloudCenters[Math.floor(Math.random() * cloudCenters.length)]; cloudU.uFP.value.copy(c).add(V(rand(-25, 25), rand(-4, 6), rand(-12, 12))); flashT = t; nextFlash = t + rand(2.5, 7); }
  const k = t - flashT; cloudU.uFlash.value = k < 0 ? 0 : Math.exp(-Math.pow((k - .03) / .03, 2)) + .7 * Math.exp(-Math.pow((k - .16) / .04, 2)) + .5 * Math.exp(-Math.pow((k - .34) / .05, 2));
}

/* ============ HOLOGRAM materials: one set per part so each part flickers on its own ============ */
const holo = col => new T.ShaderMaterial({
  uniforms: { uC: { value: col }, uB: { value: 1 } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
  vertexShader: 'varying vec3 vN,vV;void main(){vec4 w=modelMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vec4 mv=viewMatrix*w;vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
  fragmentShader: 'uniform vec3 uC;uniform float uB;varying vec3 vN,vV;void main(){float f=pow(1.-abs(dot(normalize(vN),vV)),2.2);float a=(.025+f*.42)*uB;gl_FragColor=vec4(uC*a,a);}' });
const edge = col => new T.LineBasicMaterial({ color: col.clone().multiplyScalar(1.15), transparent: true, opacity: .82, blending: T.AdditiveBlending, depthWrite: false });
const pm = g => g.userData.m || (g.userData.m = { h: holo(g.userData.col), e: edge(g.userData.col) });

/* ============ THE BIKES: nine types built from real parts ============ */
// units ≈ metres; x = forward, y = up, z = right side; ground at y = 0.
const BIKE_TYPES = [
  ['naked', 'Naked'], ['sport', 'Sport'], ['scooter', 'Scooter'], ['trike', '3-wheel scooter'], ['underbone', 'Underbone'],
  ['adventure', 'Adventure'], ['cruiser', 'Cruiser'], ['cafe', 'Sport classic'], ['classic', 'Classic naked']
];
function makeBike(type, statusOf) {
  const bike = new T.Group(), parts = {}, anchors = {}, names = {};
  const sts = k => statusOf(k) === 'soon' ? AM : statusOf(k) === 'over' ? RD : CY;
  const P = (key, ex, col) => { if (parts[key]) return parts[key]; const g = new T.Group(); g.userData = { ex: ex.clone(), col: col || sts(key) }; bike.add(g); parts[key] = g; return g; };
  const add = (g, geo, m, noEdge) => { const mesh = new T.Mesh(geo, pm(g).h); if (m) mesh.applyMatrix4(m); g.add(mesh); if (!noEdge) { const e = new T.LineSegments(new T.EdgesGeometry(geo, 28), pm(g).e); if (m) e.applyMatrix4(m); g.add(e); } return mesh; };
  const M = (pos, rot, scl) => new T.Matrix4().compose(pos || V(0, 0, 0), new T.Quaternion().setFromEuler(new T.Euler(...(rot || [0, 0, 0]))), scl || V(1, 1, 1));
  const rod = (g, a, b, r, seg = 10) => { const geo = new T.CylinderGeometry(r, r, a.distanceTo(b), seg, 1); const q = new T.Quaternion().setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()); return add(g, geo, new T.Matrix4().compose(a.clone().add(b).multiplyScalar(.5), q, V(1, 1, 1))); };
  const tube = (g, pts, r, seg = 48, rs = 8) => add(g, new T.TubeGeometry(new T.CatmullRomCurve3(pts), seg, r, rs));
  const lines = (g, pairs) => { const pos = []; pairs.forEach(([a, b]) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z)); const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.add(new T.LineSegments(geo, pm(g).e)); };
  const mirror = (fn) => { fn(-1); fn(1); };

  /* ---- reusable parts ---- */
  const wheel = (g, cx, R, tw, style, z = 0) => {
    const cy = R;
    add(g, new T.TorusGeometry(R - tw, tw, 14, 64), M(V(cx, cy, z)));
    add(g, new T.TorusGeometry(R - tw * 1.9, .011, 6, 48), M(V(cx, cy, z)));
    add(g, new T.CylinderGeometry(.04, .04, .14, 16), M(V(cx, cy, z), [Math.PI / 2, 0, 0]));
    const rr = R - tw * 1.9;
    if (style === 'wire') { const pr = []; for (let i = 0; i < 32; i++) { const a = i / 32 * Math.PI * 2, s = i % 2 ? 1 : -1; pr.push([V(cx + Math.cos(a + .25) * .04, cy + Math.sin(a + .25) * .04, z + s * .05), V(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, z)]); } lines(g, pr); }
    else { const n = style === 'cast5' ? 5 : style === 'scooter' ? 6 : 3, split = style === 'cast3' ? [-.16, .16] : [0];
      for (let i = 0; i < n; i++) for (const o of split) { const a = i / n * Math.PI * 2 + o; rod(g, V(cx + Math.cos(a) * .045, cy + Math.sin(a) * .045, z), V(cx + Math.cos(a + o * .6) * rr * .98, cy + Math.sin(a + o * .6) * rr * .98, z), style === 'scooter' ? .016 : .011, 6); } }
  };
  const disc = (g, cx, cy, R, z) => { add(g, new T.CylinderGeometry(R, R, .006, 40), M(V(cx, cy, z), [Math.PI / 2, 0, 0])); add(g, new T.CylinderGeometry(R * .7, R * .7, .007, 24), M(V(cx, cy, z), [Math.PI / 2, 0, 0])); };
  const caliper = (g, x, y, z, rz = -.6) => add(g, new T.BoxGeometry(.05, .1, .03), M(V(x, y, z), [0, 0, rz]));
  const forks = (g, axle, head, style, spread = .092) => {
    const dir = head.clone().sub(axle);
    mirror(s => { const z = s * spread, a = axle.clone().setZ(z), mid = axle.clone().addScaledVector(dir, .45).setZ(z), top = head.clone().addScaledVector(dir, .06).setZ(z);
      if (style === 'usd') { rod(g, a, mid, .019); rod(g, mid, top, .028); } else { rod(g, a, mid, .027); rod(g, mid, top, .018); if (style === 'gaiter') add(g, new T.CylinderGeometry(.032, .032, .14, 12), new T.Matrix4().compose(mid.clone().addScaledVector(dir, .08), new T.Quaternion().setFromUnitVectors(V(0, 1, 0), dir.clone().normalize()), V(1, 1, 1))); } });
    const rz = -Math.atan2(dir.x, dir.y);
    add(g, new T.BoxGeometry(.07, .03, spread * 2 + .07), M(head.clone().addScaledVector(dir, -.14), [0, 0, rz]));
    add(g, new T.BoxGeometry(.08, .025, spread * 2 + .07), M(head.clone().addScaledVector(dir, .05), [0, 0, rz]));
    add(g, new T.CylinderGeometry(.03, .03, .16, 16), M(head.clone().addScaledVector(dir, -.03), [0, 0, rz]));
    return dir;
  };
  const shock = (g, a, b, r = .028) => { rod(g, a, b, r * .45, 8); const n = 36, d = b.clone().sub(a); const side = V(0, 0, 1);
    tube(g, Array.from({ length: n }, (_, i) => { const k = .15 + i / (n - 1) * .7, ang = i / (n - 1) * Math.PI * 12; const p = a.clone().addScaledVector(d, k); const perp = d.clone().cross(side).normalize(); return p.addScaledVector(perp, Math.cos(ang) * r).addScaledVector(side, Math.sin(ang) * r); }), .005, 90, 4); };
  const bars = (g, at, half, rise = 0, back = 0) => {
    tube(g, [V(at.x - back, at.y + rise, -half), V(at.x, at.y, -half * .45), V(at.x + .01, at.y - .015, 0), V(at.x, at.y, half * .45), V(at.x - back, at.y + rise, half)], .012, 40);
    mirror(s => { rod(g, V(at.x - back, at.y + rise, s * half), V(at.x - back, at.y + rise, s * (half + .08)), .017); rod(g, V(at.x + .01, at.y, s * half * .7), V(at.x + .09, at.y - .01, s * half * .95), .006, 5); });
  };
  const mirrors = (g, base, h = .17, round) => mirror(s => { tube(g, [V(base.x, base.y, s * base.z), V(base.x - .02, base.y + h * .6, s * (base.z + .05)), V(base.x - .04, base.y + h, s * (base.z + .09))], .006, 12, 5);
    add(g, round ? new T.CylinderGeometry(.045, .045, .012, 20) : new T.BoxGeometry(.012, .06, .1), M(V(base.x - .045, base.y + h + .02, s * (base.z + .1)), round ? [0, 0, Math.PI / 2 - .2] : [0, 0, 0])); });
  const roundLight = (g, pos, r = .085) => { add(g, new T.SphereGeometry(r, 20, 14, 0, Math.PI), M(pos, [0, -Math.PI / 2, 0], V(1, 1, .9))); add(g, new T.CylinderGeometry(r * .88, r * .88, .02, 28), M(pos.clone().add(V(.005, 0, 0)), [0, 0, Math.PI / 2])); };
  const fender = (g, cx, R, from, len, w = .13, z = 0) => add(g, new T.CylinderGeometry(R + .04, R + .04, w, 28, 1, true, from, len), M(V(cx, R, z), [Math.PI / 2, 0, 0]));
  const blob = (g, pos, r, scl, rot) => add(g, new T.SphereGeometry(r, 26, 16), M(pos, rot || [0, 0, 0], scl));
  const box = (g, pos, size, rot) => add(g, new T.BoxGeometry(...size), M(pos, rot));
  const fins = (g, pos, w, d, n, step, rz = 0) => { for (let i = 0; i < n; i++) box(g, V(pos.x + Math.sin(-rz) * i * step, pos.y + Math.cos(rz) * i * step, pos.z), [w, .008, d], [0, 0, rz]); };
  const gear = (r, n) => { const s = new T.Shape(); for (let i = 0; i <= n * 2; i++) { const a = i / (n * 2) * Math.PI * 2, rr = i % 2 ? r : r * .88; i ? s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } return new T.ExtrudeGeometry(s, { depth: .008, bevelEnabled: false }); };
  const chainDrive = (g, front, rear, rf = .045, rr = .11, z = -.115) => {
    add(g, gear(rf, 14), M(V(front.x, front.y, z - .005))); add(g, gear(rr, 40), M(V(rear.x, rear.y, z + .005)));
    tube(g, [V(front.x, front.y + rf, z), V((front.x + rear.x) / 2, (front.y + rear.y) / 2 + (rf + rr) / 2, z), V(rear.x, rear.y + rr, z), V(rear.x - rr, rear.y, z), V(rear.x, rear.y - rr, z), V((front.x + rear.x) / 2, (front.y + rear.y) / 2 - (rf + rr) / 2, z), V(front.x, front.y - rf, z), V(front.x + rf, front.y, z)], .006, 140, 4);
  };
  const swingarm = (g, pivot, axle, w = .1) => mirror(s => tube(g, [V(pivot.x, pivot.y, s * w * .7), V((pivot.x + axle.x) / 2, (pivot.y + axle.y) / 2 + .01, s * w), V(axle.x, axle.y, s * w)], .022, 24));
  // engines
  const twinLC = (pos, tilt = -.42) => { const e = P('oil', V(.05, -.3, 0)); box(e, V(pos.x, pos.y, 0), [.36, .2, .3]); add(e, new T.CylinderGeometry(.09, .09, .02, 28), M(V(pos.x - .05, pos.y, .16), [Math.PI / 2, 0, 0])); add(e, new T.CylinderGeometry(.07, .07, .02, 24), M(V(pos.x - .02, pos.y + .01, -.16), [Math.PI / 2, 0, 0])); box(e, V(pos.x + .02, pos.y - .13, 0), [.26, .06, .24]);
    const c = P('spark', V(.15, .35, 0)); box(c, V(pos.x + .12, pos.y + .18, 0), [.18, .2, .26], [0, 0, tilt]); box(c, V(pos.x + .17, pos.y + .3, 0), [.2, .1, .28], [0, 0, tilt]); box(c, V(pos.x + .2, pos.y + .36, 0), [.18, .04, .24], [0, 0, tilt]);
    anchors.oil = V(pos.x + .02, pos.y - .16, .15); anchors.spark = V(pos.x + .22, pos.y + .42, 0); return V(pos.x + .23, pos.y + .26, 0); };
  const twinAC = (pos) => { const e = P('oil', V(.05, -.3, 0)); box(e, V(pos.x, pos.y, 0), [.38, .18, .28]); add(e, new T.CylinderGeometry(.1, .1, .02, 30), M(V(pos.x - .04, pos.y, .15), [Math.PI / 2, 0, 0])); add(e, new T.CylinderGeometry(.08, .08, .02, 24), M(V(pos.x - .02, pos.y, -.15), [Math.PI / 2, 0, 0]));
    const c = P('spark', V(.1, .35, 0)); box(c, V(pos.x + .05, pos.y + .2, 0), [.16, .22, .24], [0, 0, -.12]); fins(c, V(pos.x + .03, pos.y + .1, 0), .22, .3, 11, .02, -.12); box(c, V(pos.x + .08, pos.y + .34, 0), [.2, .07, .28], [0, 0, -.12]);
    anchors.oil = V(pos.x, pos.y - .1, .15); anchors.spark = V(pos.x + .09, pos.y + .4, 0); return V(pos.x + .12, pos.y + .25, 0); };
  const vtwin = (pos) => { const e = P('oil', V(0, -.32, 0)); box(e, V(pos.x, pos.y, 0), [.34, .2, .26]); add(e, new T.CylinderGeometry(.11, .11, .03, 32), M(V(pos.x - .06, pos.y - .02, .15), [Math.PI / 2, 0, 0])); add(e, new T.CylinderGeometry(.12, .12, .03, 32), M(V(pos.x + .1, pos.y, -.15), [Math.PI / 2, 0, 0]));
    const c = P('spark', V(0, .4, 0)); for (const [dx, a] of [[.1, -.42], [-.1, .42]]) { box(c, V(pos.x + dx, pos.y + .24, 0), [.15, .26, .2], [0, 0, a]); fins(c, V(pos.x + dx * .9, pos.y + .14, 0), .2, .22, 10, .022, a); box(c, V(pos.x + dx * 1.9, pos.y + .4, 0), [.17, .07, .22], [0, 0, a]); }
    anchors.oil = V(pos.x, pos.y - .12, .15); anchors.spark = V(pos.x + .2, pos.y + .46, 0); return V(pos.x + .2, pos.y + .3, 0); };
  const singleH = (pos) => { const e = P('oil', V(0, -.25, 0)); box(e, V(pos.x, pos.y, 0), [.26, .18, .22]); add(e, new T.CylinderGeometry(.075, .075, .02, 24), M(V(pos.x - .03, pos.y, .12), [Math.PI / 2, 0, 0]));
    const c = P('spark', V(.3, .1, 0)); box(c, V(pos.x + .2, pos.y + .04, 0), [.16, .13, .15], [0, 0, -1.35]); fins(c, V(pos.x + .14, pos.y + .03, 0), .16, .2, 7, .02, -1.35); box(c, V(pos.x + .3, pos.y + .06, 0), [.07, .14, .17], [0, 0, -1.35]);
    anchors.oil = V(pos.x, pos.y - .1, .12); anchors.spark = V(pos.x + .33, pos.y + .1, 0); return V(pos.x + .33, pos.y + .04, 0); };
  const cvt = (front, rearAxle) => { const e = P('oil', V(0, -.25, 0)); box(e, V(front.x, front.y, 0), [.2, .16, .2]);
    const c = P('spark', V(.25, .15, 0)); box(c, V(front.x + .14, front.y + .05, 0), [.15, .12, .14], [0, 0, -1.1]); box(c, V(front.x + .22, front.y + .09, 0), [.06, .13, .16], [0, 0, -1.1]);
    const b = P('chain', V(0, 0, -.4)); const mid = front.clone().add(rearAxle).multiplyScalar(.5); const len = front.distanceTo(rearAxle) + .12; box(b, V(mid.x, mid.y, -.11), [len, .14, .07], [0, 0, Math.atan2(rearAxle.y - front.y, rearAxle.x - front.x)]);
    add(b, new T.CylinderGeometry(.075, .075, .08, 24), M(V(rearAxle.x, rearAxle.y, -.11), [Math.PI / 2, 0, 0]));
    anchors.oil = V(front.x, front.y - .08, .1); anchors.spark = V(front.x + .24, front.y + .14, 0); anchors.chain = V(mid.x, mid.y + .09, -.15); names.chain = 'CVT BELT'; return V(front.x + .25, front.y + .05, 0); };
  const radiator = (pos, h = .24, w = .3, rz = -.18) => { const r = P('coolant', V(.4, 0, 0)); box(r, pos, [.035, h, w], [0, 0, rz]); for (let i = 0; i < 6; i++) box(r, V(pos.x, pos.y - h / 2 + .03 + i * h / 6.5, pos.z), [.038, .005, w], [0, 0, rz]); anchors.coolant = pos.clone().add(V(.02, h / 2, .1)); };
  const airbox = (pos, size = [.22, .1, .2]) => { const a = P('air', V(0, .45, .35)); box(a, pos, size); anchors.air = pos.clone().add(V(0, .06, .1)); };
  const frontEnd = (axleX, R, head, forkStyle, discs = 2, spread) => {
    const fw = P('frontTyre', V(.75, 0, 0)); const fb = P('brakes', V(.75, .25, .3));
    const fk = P('forks', V(.55, .3, 0), CY); forks(fk, V(axleX, R, 0), head, forkStyle, spread);
    const zs = discs === 2 ? [-.075, .075] : [.075]; zs.forEach(z => { disc(fb, axleX, R, R * .5, z); caliper(fb, axleX - R * .33, R + R * .3, z * 1.15); });
    anchors.frontTyre = V(axleX, R * 2 - .03, 0); anchors.brakes = V(axleX - R * .33, R * 1.42, .09);
    return { fw, fb };
  };
  const rearEnd = (axleX, R, style, tw, discR = .11) => { const rw = P('rearTyre', V(-.7, 0, 0)); wheel(rw, axleX, R, tw, style); const fb = P('brakes', V(.75, .25, .3)); disc(fb, axleX, R, discR, .075); caliper(fb, axleX + .1, R - .06, .085, .5); anchors.rearTyre = V(axleX, R * 2 - .03, 0); return rw; };

  /* ---- the nine types ---- */
  const B = {
    naked() {
      const { fw } = frontEnd(.74, .315, V(.5, .93, 0), 'usd'); wheel(fw, .74, .315, .068, 'cast3');
      const ck = P('cockpit', V(.35, .55, 0), CY); bars(ck, V(.46, .99, 0), .34, .02, .02); mirrors(ck, V(.45, 1.0, .28)); box(ck, V(.53, 1.02, 0), [.03, .08, .13], [0, 0, -.5]);
      const hl = P('headlight', V(.5, .15, 0), CY); blob(hl, V(.6, .86, 0), .1, V(.55, .85, 1.05)); add(hl, new T.CylinderGeometry(.058, .058, .02, 24), M(V(.655, .86, 0), [0, 0, Math.PI / 2])); mirror(s => box(hl, V(.64, .93, s * .06), [.012, .012, .06]));
      const fr = P('frame', V(0, .12, 0), CY); mirror(s => { const z = s * .11; tube(fr, [V(.48, .9, z * .5), V(.32, .86, z), V(.12, .78, z * 1.05), V(-.08, .66, z), V(-.12, .5, z)], .022); tube(fr, [V(-.06, .74, z * .9), V(-.35, .84, z * .85), V(-.62, .92, z * .7)], .013, 32); tube(fr, [V(-.12, .55, z * .9), V(-.4, .78, z * .85), V(-.6, .9, z * .7)], .011, 32); });
      const sprocket = twinLC(V(.08, .4, 0)); radiator(V(.4, .58, 0)); airbox(V(.05, .78, 0));
      const ex = P('exhaust', V(-.1, -.25, .35), CY); mirror(s => tube(ex, [V(.31, .66, s * .05), V(.4, .5, s * .05), V(.36, .26, s * .065), V(.18, .16, .04), V(-.08, .18, .1)], .02, 48)); tube(ex, [V(-.08, .18, .1), V(-.2, .22, .16), V(-.32, .3, .18)], .03, 20); add(ex, new T.CylinderGeometry(.06, .05, .32, 20), M(V(-.45, .36, .19), [0, 0, Math.PI / 2 + .35]));
      const tk = P('tank', V(0, .45, 0), CY); blob(tk, V(.17, .94, 0), .2, V(1.35, .62, .95), [0, 0, -.12]); mirror(s => box(tk, V(.33, .82, s * .17), [.28, .17, .02], [s * .25, s * .1, -.35]));
      const st = P('seat', V(-.1, .35, 0), CY); blob(st, V(-.24, .93, 0), .2, V(1.15, .22, .7), [0, 0, .06]); blob(st, V(-.52, 1.0, 0), .14, V(1, .22, .6), [0, 0, .15]);
      const tl = P('tail', V(-.45, .25, 0), CY); add(tl, new T.ConeGeometry(.1, .4, 4), M(V(-.66, .95, 0), [Math.PI / 4, 0, Math.PI / 2 + .1], V(1, 1, .55))); box(tl, V(-.8, 1.0, 0), [.02, .025, .14]); tube(tl, [V(-.7, .9, 0), V(-.82, .8, 0), V(-.9, .72, 0)], .008, 12, 5); box(tl, V(-.92, .7, 0), [.008, .1, .17], [0, 0, -.25]);
      const sw = P('swingarm', V(-.3, -.12, 0), CY); swingarm(sw, V(-.12, .47), V(-.7, .315)); shock(sw, V(-.2, .44, 0), V(-.1, .72, 0));
      rearEnd(-.7, .315, 'cast3', .068); const ch = P('chain', V(0, 0, -.4)); chainDrive(ch, V(sprocket.x - .2, .38), V(-.7, .315)); anchors.chain = V(-.38, .38, -.12);
    },
    sport() {
      const { fw } = frontEnd(.72, .31, V(.48, .9, 0), 'usd'); wheel(fw, .72, .31, .066, 'cast3');
      const ck = P('cockpit', V(.35, .55, 0), CY); mirror(s => { rod(ck, V(.45, .9, s * .1), V(.42, .89, s * .27), .013); rod(ck, V(.42, .89, s * .27), V(.42, .89, s * .33), .017); });
      const body = P('body', V(.55, .2, 0), CY);
      blob(body, V(.6, .86, 0), .2, V(1.25, .7, .8), [0, 0, -.25]); mirror(s => box(body, V(.73, .84, s * .07), [.03, .03, .08], [0, s * .3, -.3]));
      add(body, new T.PlaneGeometry(.24, .2), M(V(.54, 1.02, 0), [0, Math.PI / 2, -.95])); mirror(s => box(body, V(.4, .62, s * .19), [.5, .34, .015], [s * .12, 0, -.15])); box(body, V(.18, .22, 0), [.42, .08, .26], [0, 0, .08]);
      mirrors(ck, V(.55, .96, .2), .06);
      const fr = P('frame', V(0, .12, 0), CY); mirror(s => tube(fr, [V(.46, .88, s * .06), V(.3, .84, s * .12), V(.05, .72, s * .12), V(-.12, .5, s * .11)], .024)); mirror(s => tube(fr, [V(-.08, .72, s * .09), V(-.6, .98, s * .06)], .012, 20));
      const sprocket = twinLC(V(.06, .4, 0), -.5); radiator(V(.38, .56, 0), .26, .34, -.25); airbox(V(.06, .8, 0));
      const ex = P('exhaust', V(0, -.3, .3), CY); mirror(s => tube(ex, [V(.29, .66, s * .05), V(.38, .45, s * .05), V(.3, .22, s * .05), V(.12, .14, 0)], .019, 40)); box(ex, V(.0, .14, .06), [.28, .1, .14], [0, 0, .05]);
      const tk = P('tank', V(0, .45, 0), CY); blob(tk, V(.18, .92, 0), .2, V(1.25, .6, .92), [0, 0, -.2]);
      const st = P('seat', V(-.1, .35, 0), CY); blob(st, V(-.2, .9, 0), .16, V(1.1, .2, .75), [0, 0, .12]);
      const tl = P('tail', V(-.45, .25, 0), CY); add(tl, new T.ConeGeometry(.11, .5, 4), M(V(-.58, .98, 0), [Math.PI / 4, 0, Math.PI / 2 + .14], V(1, 1, .5))); box(tl, V(-.79, 1.06, 0), [.02, .02, .12]); tube(tl, [V(-.62, .9, 0), V(-.78, .8, 0)], .008, 10, 5); box(tl, V(-.8, .76, 0), [.008, .1, .17], [0, 0, -.3]);
      const sw = P('swingarm', V(-.3, -.12, 0), CY); swingarm(sw, V(-.12, .47), V(-.68, .31)); shock(sw, V(-.2, .44, 0), V(-.1, .7, 0));
      rearEnd(-.68, .31, 'cast3', .07); const ch = P('chain', V(0, 0, -.4)); chainDrive(ch, V(sprocket.x - .22, .38), V(-.68, .31)); anchors.chain = V(-.4, .37, -.12);
    },
    scooter() {
      const { fw } = frontEnd(.62, .26, V(.42, .82, 0), 'conv', 1, .07); wheel(fw, .62, .26, .055, 'scooter');
      const body = P('body', V(.35, .25, 0), CY);
      add(body, new T.CylinderGeometry(.32, .3, .62, 24, 1, true, -Math.PI * .45, Math.PI * .9), M(V(.33, .62, 0), [0, 0, -.22], V(.55, 1, 1)));
      box(body, V(.02, .32, 0), [.52, .05, .34]); blob(body, V(-.36, .62, 0), .24, V(1.9, .75, .95)); fender(body, .62, .26, Math.PI * 1.1, Math.PI * .6, .1);
      const hl = P('headlight', V(.45, .2, 0), CY); box(hl, V(.53, .82, 0), [.03, .06, .2], [0, 0, -.3]); blob(hl, V(.38, .98, 0), .1, V(1.2, .45, 1.8));
      const ck = P('cockpit', V(.3, .5, 0), CY); bars(ck, V(.38, 1.0, 0), .32, .02, .03); mirrors(ck, V(.38, 1.02, .25));
      const st = P('seat', V(-.1, .4, 0), CY); blob(st, V(-.3, .84, 0), .2, V(1.6, .26, .78), [0, 0, .05]);
      const tk = P('tank', V(0, .3, .3), CY); box(tk, V(-.25, .55, 0), [.3, .12, .2]); anchors.tank = V(-.25, .62, .1);
      const tl = P('tail', V(-.35, .2, 0), CY); box(tl, V(-.8, .7, 0), [.03, .04, .2], [0, 0, .4]); box(tl, V(-.84, .55, 0), [.008, .09, .15], [0, 0, -.2]);
      cvt(V(-.08, .32), V(-.62, .26)); airbox(V(-.3, .45, .12), [.2, .1, .08]);
      const ex = P('exhaust', V(-.1, -.2, .35), CY); tube(ex, [V(.12, .34, .04), V(.1, .18, .08), V(-.2, .2, .16)], .018, 24); add(ex, new T.CylinderGeometry(.055, .05, .3, 20), M(V(-.38, .3, .18), [0, 0, Math.PI / 2 + .2]));
      const sw = P('swingarm', V(-.3, -.05, 0), CY); shock(sw, V(-.56, .32, .12), V(-.4, .6, .12), .022);
      rearEnd(-.62, .26, 'scooter', .058, .09); radiator(V(-.02, .5, .15), .12, .14, 0);
    },
    trike() {
      // two leaning front wheels on a parallelogram linkage (Tricity / MP3 style)
      const fw = P('frontTyre', V(.75, 0, 0)), fb = P('brakes', V(.75, .25, .3)), fk = P('forks', V(.55, .3, 0), CY);
      mirror(s => { const z = s * .22; wheel(fw, .64, .24, .05, 'scooter', z); disc(fb, .64, .24, .1, z + s * .05); caliper(fb, .56, .32, z + s * .06); rod(fk, V(.64, .24, z + s * .055), V(.5, .7, z + s * .055), .022); rod(fk, V(.64, .24, z - s * .055), V(.5, .7, z - s * .055), .016); });
      box(fk, V(.5, .7, 0), [.06, .04, .6]); box(fk, V(.47, .6, 0), [.06, .04, .6]); rod(fk, V(.46, .56, 0), V(.38, .86, 0), .03, 12);
      anchors.frontTyre = V(.64, .48, .22); anchors.brakes = V(.56, .34, .3);
      const body = P('body', V(.35, .25, 0), CY);
      add(body, new T.CylinderGeometry(.34, .32, .6, 24, 1, true, -Math.PI * .45, Math.PI * .9), M(V(.32, .7, 0), [0, 0, -.22], V(.55, 1, 1.15)));
      box(body, V(.02, .32, 0), [.5, .05, .34]); blob(body, V(-.36, .62, 0), .24, V(1.9, .75, .95)); mirror(s => fender(body, .64, .24, Math.PI * 1.15, Math.PI * .5, .08, s * .22));
      const hl = P('headlight', V(.45, .2, 0), CY); mirror(s => box(hl, V(.52, .86, s * .09), [.03, .05, .09], [0, 0, -.3])); blob(hl, V(.36, 1.02, 0), .1, V(1.2, .45, 2));
      const ck = P('cockpit', V(.3, .5, 0), CY); bars(ck, V(.36, 1.04, 0), .34, .02, .03); mirrors(ck, V(.36, 1.06, .26));
      const st = P('seat', V(-.1, .4, 0), CY); blob(st, V(-.3, .84, 0), .2, V(1.6, .26, .78), [0, 0, .05]);
      const tk = P('tank', V(0, .3, .3), CY); box(tk, V(-.25, .55, 0), [.3, .12, .2]); anchors.tank = V(-.25, .62, .1);
      const tl = P('tail', V(-.35, .2, 0), CY); box(tl, V(-.8, .7, 0), [.03, .04, .2], [0, 0, .4]);
      cvt(V(-.08, .32), V(-.62, .27)); airbox(V(-.3, .45, .12), [.2, .1, .08]); radiator(V(-.02, .5, .15), .12, .14, 0);
      const ex = P('exhaust', V(-.1, -.2, .35), CY); tube(ex, [V(.12, .34, .04), V(.1, .18, .08), V(-.2, .2, .16)], .018, 24); add(ex, new T.CylinderGeometry(.055, .05, .3, 20), M(V(-.38, .3, .18), [0, 0, Math.PI / 2 + .2]));
      const sw = P('swingarm', V(-.3, -.05, 0), CY); shock(sw, V(-.56, .32, .12), V(-.4, .6, .12), .022);
      rearEnd(-.62, .27, 'scooter', .058, .09);
    },
    underbone() {
      // kapcai: backbone frame, horizontal single, step-through
      const { fw } = frontEnd(.66, .29, V(.43, .88, 0), 'conv', 1, .075); wheel(fw, .66, .29, .045, 'cast5');
      const hl = P('headlight', V(.45, .2, 0), CY); blob(hl, V(.5, .92, 0), .12, V(.9, .55, 1.1), [0, 0, -.35]); box(hl, V(.6, .9, 0), [.02, .04, .12], [0, 0, -.5]);
      const ck = P('cockpit', V(.3, .5, 0), CY); bars(ck, V(.4, .98, 0), .3, .01, .02); mirrors(ck, V(.38, 1.0, .23));
      const body = P('body', V(.1, .3, 0), CY); mirror(s => box(body, V(.33, .62, s * .13), [.22, .3, .015], [s * .15, 0, -.45])); blob(body, V(-.22, .6, 0), .18, V(1.8, .8, .75), [0, 0, .1]); fender(body, .66, .29, Math.PI * 1.05, Math.PI * .55, .07);
      const fr = P('frame', V(0, .12, 0), CY); tube(fr, [V(.43, .86, 0), V(.25, .62, 0), V(.08, .46, 0), V(-.12, .48, 0), V(-.3, .66, 0)], .03, 40); mirror(s => tube(fr, [V(-.3, .66, s * .06), V(-.62, .78, s * .06)], .012, 16));
      const sprocket = singleH(V(-.02, .33, 0)); airbox(V(-.1, .55, -.08), [.18, .1, .1]); radiator(V(.24, .52, 0), .14, .16, -.5);
      const st = P('seat', V(-.1, .35, 0), CY); blob(st, V(-.28, .8, 0), .2, V(1.75, .2, .6), [0, 0, .04]);
      const tk = P('tank', V(0, .3, .3), CY); box(tk, V(-.3, .66, 0), [.26, .08, .18]); anchors.tank = V(-.3, .72, .1);
      const tl = P('tail', V(-.45, .25, 0), CY); add(tl, new T.ConeGeometry(.09, .32, 4), M(V(-.68, .8, 0), [Math.PI / 4, 0, Math.PI / 2 + .08], V(1, 1, .55))); box(tl, V(-.82, .82, 0), [.02, .03, .1]); fender(tl, -.62, .28, Math.PI * .35, Math.PI * .5, .08);
      const ex = P('exhaust', V(-.1, -.2, .35), CY); tube(ex, [V(.3, .37, 0), V(.28, .2, .06), V(.0, .18, .13), V(-.2, .26, .16)], .016, 30); add(ex, new T.CylinderGeometry(.045, .04, .3, 18), M(V(-.38, .36, .17), [0, 0, Math.PI / 2 + .45]));
      const sw = P('swingarm', V(-.3, -.12, 0), CY); swingarm(sw, V(-.1, .36), V(-.62, .29), .085); shock(sw, V(-.45, .36, .09), V(-.5, .7, .09), .02);
      rearEnd(-.62, .29, 'cast5', .045, .09); const ch = P('chain', V(0, 0, -.4)); chainDrive(ch, V(-.06, .33), V(-.62, .29), .04, .1, -.1); anchors.chain = V(-.34, .36, -.11);
    },
    adventure() {
      const { fw } = frontEnd(.8, .37, V(.5, 1.1, 0), 'usd', 2, .1); wheel(fw, .8, .37, .06, 'wire');
      const body = P('body', V(.5, .15, 0), CY); add(body, new T.ConeGeometry(.08, .32, 4), M(V(.7, .85, 0), [0, Math.PI / 4, -Math.PI / 2 - .35], V(1, 1, .8)));
      add(body, new T.PlaneGeometry(.3, .26), M(V(.5, 1.26, 0), [0, Math.PI / 2, -.5])); mirror(s => box(body, V(.36, .9, s * .2), [.36, .3, .015], [s * .2, 0, -.3])); box(body, V(.12, .2, 0), [.36, .03, .26]);
      const pan = P('luggage', V(-.2, .1, 0), CY); mirror(s => box(pan, V(-.5, .8, s * .3), [.42, .34, .14])); box(pan, V(-.62, 1.12, 0), [.34, .03, .26]);
      mirror(s => tube(pan, [V(.4, .9, s * .18), V(.42, .55, s * .27), V(.25, .35, s * .26), V(.0, .4, s * .2)], .012, 24));
      const hl = P('headlight', V(.5, .2, 0), CY); mirror(s => box(hl, V(.62, 1.03, s * .06), [.03, .06, .08], [0, 0, -.4]));
      const ck = P('cockpit', V(.3, .55, 0), CY); bars(ck, V(.44, 1.22, 0), .4, .03, .03); mirrors(ck, V(.44, 1.25, .3)); box(ck, V(.5, 1.2, 0), [.03, .1, .16], [0, 0, -.5]);
      const fr = P('frame', V(0, .12, 0), CY); mirror(s => { tube(fr, [V(.48, 1.06, s * .06), V(.3, .95, s * .12), V(.05, .82, s * .12), V(-.14, .58, s * .11)], .022); tube(fr, [V(-.1, .8, s * .1), V(-.62, 1.06, s * .08)], .013, 20); });
      const sprocket = twinLC(V(.08, .5, 0), -.3); radiator(V(.4, .7, 0), .26, .32, -.2); airbox(V(.05, .92, 0));
      const ex = P('exhaust', V(-.1, -.1, .4), CY); mirror(s => tube(ex, [V(.3, .76, s * .05), V(.38, .55, s * .05), V(.3, .32, .06), V(-.05, .32, .14)], .019, 40)); add(ex, new T.CylinderGeometry(.06, .055, .3, 20), M(V(-.3, .55, .2), [0, 0, Math.PI / 2 + .55]));
      const tk = P('tank', V(0, .5, 0), CY); blob(tk, V(.14, 1.06, 0), .22, V(1.4, .7, 1.15), [0, 0, -.15]);
      const st = P('seat', V(-.1, .4, 0), CY); blob(st, V(-.2, 1.04, 0), .2, V(1.15, .22, .8), [0, 0, .05]); blob(st, V(-.48, 1.1, 0), .14, V(1.1, .22, .7));
      const tl = P('tail', V(-.45, .25, 0), CY); box(tl, V(-.72, 1.06, 0), [.03, .03, .12]); fender(tl, -.72, .34, Math.PI * .3, Math.PI * .45, .1);
      const sw = P('swingarm', V(-.3, -.12, 0), CY); swingarm(sw, V(-.14, .5), V(-.74, .34)); shock(sw, V(-.24, .5, 0), V(-.12, .82, 0));
      rearEnd(-.74, .34, 'wire', .062, .12); const ch = P('chain', V(0, 0, -.4)); chainDrive(ch, V(sprocket.x - .22, .48), V(-.74, .34)); anchors.chain = V(-.42, .45, -.12);
    },
    cruiser() {
      const { fw } = frontEnd(.92, .33, V(.46, .92, 0), 'gaiter', 2, .12); wheel(fw, .92, .33, .085, 'wire');
      const hl = P('headlight', V(.5, .2, 0), CY); roundLight(hl, V(.62, .86, 0), .1); mirror(s => roundLight(hl, V(.64, .74, s * .14), .035));
      const ck = P('cockpit', V(.3, .6, 0), CY); bars(ck, V(.46, 1.04, 0), .38, .06, .16); mirrors(ck, V(.36, 1.08, .3), .17, true);
      const body = P('body', V(0, .3, 0), CY); fender(body, .92, .33, Math.PI * .95, Math.PI * .6, .16); fender(body, -.8, .32, Math.PI * .15, Math.PI * .7, .2);
      const fr = P('frame', V(0, .12, 0), CY); mirror(s => tube(fr, [V(.44, .88, s * .05), V(.3, .5, s * .12), V(.3, .22, s * .14), V(-.2, .2, s * .14), V(-.4, .4, s * .13), V(-.6, .66, s * .12)], .022, 48)); tube(fr, [V(.44, .94, 0), V(.1, .82, 0), V(-.3, .66, 0)], .026, 30);
      const sprocket = vtwin(V(.05, .38, 0)); airbox(V(.12, .72, .14), [.12, .12, .05]);
      const ex = P('exhaust', V(-.1, -.2, .4), CY); for (const [y, x0] of [[.36, .25], [.28, -.1]]) tube(ex, [V(x0, .58, .12), V(x0 + .05, .4, .2), V(x0 - .1, y, .22), V(-.9, y + .02, .22)], .028, 48);
      const tk = P('tank', V(0, .45, 0), CY); blob(tk, V(.12, .88, 0), .2, V(1.45, .6, .85), [0, 0, -.06]);
      const st = P('seat', V(-.1, .35, 0), CY); blob(st, V(-.24, .66, 0), .2, V(1.2, .3, .85), [0, 0, .08]); blob(st, V(-.5, .78, 0), .13, V(1, .3, .65));
      const tl = P('tail', V(-.45, .25, 0), CY); roundLight(tl, V(-.96, .62, 0), .03); mirror(s => box(tl, V(-.4, .32, s * .25), [.14, .02, .05]));
      mirror(s => box(fr, V(.36, .3, s * .26), [.12, .02, .05]));
      const sw = P('swingarm', V(-.3, -.12, 0), CY); swingarm(sw, V(-.2, .34), V(-.8, .32), .12); mirror(s => shock(sw, V(-.66, .34, s * .14), V(-.5, .7, s * .14), .025));
      rearEnd(-.8, .32, 'wire', .09, .13); const ch = P('chain', V(0, 0, -.4)); chainDrive(ch, V(-.05, .3), V(-.8, .32), .06, .14, -.14); anchors.chain = V(-.45, .4, -.15); names.chain = 'FINAL BELT';
    },
    cafe() {
      const { fw } = frontEnd(.72, .31, V(.48, .9, 0), 'conv'); wheel(fw, .72, .31, .06, 'wire');
      const hl = P('headlight', V(.5, .2, 0), CY); roundLight(hl, V(.6, .86, 0)); add(hl, new T.PlaneGeometry(.14, .12), M(V(.6, .98, 0), [0, Math.PI / 2, -.6])); mirror(s => add(hl, new T.CylinderGeometry(.04, .04, .05, 18), M(V(.52, .98, s * .06), [0, 0, -.4])));
      const ck = P('cockpit', V(.35, .55, 0), CY); mirror(s => { rod(ck, V(.46, .9, s * .1), V(.43, .88, s * .26), .013); rod(ck, V(.43, .88, s * .26), V(.43, .88, s * .32), .017); }); mirror(s => roundLight(ck, V(.36, .9, s * .36), .03));
      const fr = P('frame', V(0, .12, 0), CY); mirror(s => { tube(fr, [V(.46, .86, s * .04), V(.3, .55, s * .1), V(.28, .22, s * .12), V(-.1, .2, s * .12), V(-.16, .45, s * .1)], .016, 48); tube(fr, [V(.46, .92, s * .04), V(.1, .84, s * .1), V(-.6, .86, s * .08)], .016, 40); });
      const sprocket = twinAC(V(.08, .38, 0)); airbox(V(-.1, .62, 0), [.16, .14, .2]);
      const ex = P('exhaust', V(-.1, -.2, .4), CY); mirror(s => tube(ex, [V(.18, .56, s * .1), V(.26, .4, s * .17), V(.1, .26, s * .2), V(-.4, .3, s * .21), V(-.82, .42, s * .21)], .022, 48)); mirror(s => add(ex, new T.CylinderGeometry(.04, .04, .36, 18), M(V(-.62, .37, s * .21), [0, 0, Math.PI / 2 + .25])));
      const tk = P('tank', V(0, .45, 0), CY); blob(tk, V(.16, .92, 0), .2, V(1.5, .52, .85), [0, 0, -.03]); add(tk, new T.CylinderGeometry(.04, .04, .015, 18), M(V(.2, 1.03, 0)));
      const st = P('seat', V(-.1, .35, 0), CY); blob(st, V(-.24, .88, 0), .18, V(1.1, .18, .7)); const tl = P('tail', V(-.45, .25, 0), CY); blob(tl, V(-.52, .94, 0), .13, V(.9, .55, .75)); roundLight(tl, V(-.66, .9, 0), .028); fender(tl, -.68, .31, Math.PI * .35, Math.PI * .35, .1);
      const sw = P('swingarm', V(-.3, -.12, 0), CY); swingarm(sw, V(-.16, .42), V(-.68, .31)); mirror(s => shock(sw, V(-.6, .33, s * .12), V(-.48, .82, s * .12), .024));
      rearEnd(-.68, .31, 'wire', .062, .11); const ch = P('chain', V(0, 0, -.4)); chainDrive(ch, V(sprocket.x - .24, .36), V(-.68, .31)); anchors.chain = V(-.38, .37, -.12);
    },
    classic() {
      const { fw } = frontEnd(.74, .32, V(.46, .94, 0), 'gaiter', 1, .1); wheel(fw, .74, .32, .062, 'wire');
      const hl = P('headlight', V(.5, .2, 0), CY); roundLight(hl, V(.6, .88, 0), .09); mirror(s => add(hl, new T.CylinderGeometry(.045, .045, .05, 20), M(V(.5, 1.03, s * .06), [0, 0, -.3])));
      const ck = P('cockpit', V(.3, .6, 0), CY); bars(ck, V(.45, 1.05, 0), .36, .05, .08); mirrors(ck, V(.4, 1.08, .28), .16, true);
      const body = P('body', V(0, .3, 0), CY); fender(body, .74, .32, Math.PI * .85, Math.PI * .75, .12); fender(body, -.7, .32, Math.PI * .1, Math.PI * .75, .14);
      const fr = P('frame', V(0, .12, 0), CY); mirror(s => { tube(fr, [V(.44, .9, s * .04), V(.3, .55, s * .1), V(.28, .22, s * .12), V(-.1, .2, s * .12), V(-.18, .45, s * .1)], .016, 48); tube(fr, [V(.44, .96, s * .04), V(.1, .86, s * .1), V(-.62, .84, s * .09)], .016, 40); tube(fr, [V(-.4, .9, s * .15), V(-.7, .92, s * .13)], .01, 16); });
      const sprocket = twinAC(V(.06, .38, 0)); airbox(V(-.12, .62, 0), [.16, .14, .22]);
      const ex = P('exhaust', V(-.1, -.2, .4), CY); mirror(s => tube(ex, [V(.16, .56, s * .1), V(.26, .4, s * .17), V(.12, .24, s * .2), V(-.35, .25, s * .21), V(-.86, .3, s * .21)], .022, 48)); mirror(s => add(ex, new T.CylinderGeometry(.042, .042, .42, 18), M(V(-.64, .29, s * .21), [0, 0, Math.PI / 2 + .1])));
      const tk = P('tank', V(0, .45, 0), CY); blob(tk, V(.15, .95, 0), .2, V(1.35, .62, .9), [0, 0, -.08]); mirror(s => box(tk, V(.08, .92, s * .17), [.12, .06, .01], [s * .3, 0, 0]));
      const st = P('seat', V(-.1, .35, 0), CY); blob(st, V(-.34, .9, 0), .2, V(1.75, .2, .75), [0, 0, .02]);
      const tl = P('tail', V(-.45, .25, 0), CY); roundLight(tl, V(-.92, .78, 0), .035); box(tl, V(-.95, .66, 0), [.008, .1, .17], [0, 0, -.1]);
      const sw = P('swingarm', V(-.3, -.12, 0), CY); swingarm(sw, V(-.18, .42), V(-.7, .32)); mirror(s => shock(sw, V(-.62, .34, s * .12), V(-.5, .82, s * .12), .026));
      rearEnd(-.7, .32, 'wire', .064, .1); const ch = P('chain', V(0, 0, -.4)); chainDrive(ch, V(sprocket.x - .24, .36), V(-.7, .32)); anchors.chain = V(-.4, .38, -.12);
    }
  };
  (B[type] || B.naked)();
  // air-cooled bikes have no coolant to service
  return { bike, parts, anchors, names, type };
}


/* ============ sample bike data (preview numbers) ============ */
// live state for each bike part, filled from the app's data: { name, val, left (0..1), status: ok|soon|over|unset }
const PART_KEYS = ['frontTyre', 'rearTyre', 'chain', 'oil', 'coolant', 'brakes', 'spark', 'air'];
let PART = {}; PART_KEYS.forEach(k => PART[k] = { name: k.toUpperCase(), val: '—', left: 0, status: 'unset' });
const statusOf = k => (PART[k] || {}).status === 'soon' || (PART[k] || {}).status === 'over' ? PART[k].status : 'ok';
let bikeType = 'naked';
// live view model for panels, fuel, renewals and badges
let VIEW = { odo: null, panels: [], fuel: { frac: 0, litres: null, tank: 13, range: null, kpl: null }, renewals: [], badges: [] };

// flicker: each part has its own clock — brief dropouts, brightness stutters, sideways glitches
// CONJURE: the bike builds itself part by part — outline traces in from the wheels up, then the glass fills with a flash
const BUILD_EDGE = .45, BUILD_FILL = .3, BUILD_SPAN = 1.0;
function startBuild(bk) {
  bk.bike.updateMatrixWorld(true);
  const parts = Object.values(bk.parts).map(p => ({ p, y: new T.Box3().setFromObject(p).min.y })).sort((a, b) => a.y - b.y);
  parts.forEach(({ p }, i) => {
    const b = { at: t + .25 + i / parts.length * BUILD_SPAN, lines: [] };
    p.traverse(o => { if (o.isLineSegments) { const n = o.geometry.attributes.position.count; b.lines.push({ g: o.geometry, n }); o.geometry.setDrawRange(0, 0); } });
    p.userData.build = b; p.userData.bf = 0; p.userData.flash = 0;
  });
  bk.buildEnd = t + .25 + BUILD_SPAN + BUILD_EDGE + BUILD_FILL + .2; bk.buildStart = t;
}
function updateBuild(bk, t) {
  if (!bk.buildEnd) return;
  for (const p of Object.values(bk.parts)) {
    const b = p.userData.build; if (!b) continue;
    if (b.out) { const f = Math.min(1, Math.max(0, (t - b.at) / .2)), k = Math.min(1, Math.max(0, (t - b.at - .15) / .3));
      p.userData.bf = 1 - f; p.userData.flash = 0; p.userData.tracing = f > 0 && k < 1; for (const l of b.lines) l.g.setDrawRange(0, Math.floor(l.n * (1 - k) / 2) * 2); continue; }
    const k = Math.min(1, Math.max(0, (t - b.at) / BUILD_EDGE));
    for (const l of b.lines) l.g.setDrawRange(0, Math.floor(l.n * k / 2) * 2);
    const f = Math.min(1, Math.max(0, (t - b.at - BUILD_EDGE * .8) / BUILD_FILL));
    p.userData.bf = f; p.userData.flash = Math.exp(-Math.pow((t - b.at - BUILD_EDGE * .8 - BUILD_FILL) * 7, 2)) * 1.6 * (k >= 1 ? 1 : 0);
    p.userData.tracing = k < 1 && k > 0;
  }
  if (t > bk.buildEnd) { for (const p of Object.values(bk.parts)) { const b = p.userData.build; if (b && b.out) { p.userData.bf = 0; continue; } if (b) for (const l of b.lines) l.g.setDrawRange(0, Infinity); delete p.userData.build; p.userData.bf = 1; p.userData.flash = 0; p.userData.tracing = false; } bk.buildEnd = 0; }
}
// UN-BUILD: the reverse of the build — glass fades from the top down, then the outlines retract
const UNBUILD_T = .85;
function startUnbuild(bk) {
  bk.bike.updateMatrixWorld(true);
  const parts = Object.values(bk.parts).map(p => ({ p, y: new T.Box3().setFromObject(p).max.y })).sort((a, b) => b.y - a.y);
  parts.forEach(({ p }, i) => {
    const b = { at: t + i / parts.length * .45, lines: [], out: true };
    p.traverse(o => { if (o.isLineSegments) b.lines.push({ g: o.geometry, n: o.geometry.attributes.position.count }); });
    p.userData.build = b; p.userData.bf = 1; p.userData.flash = 0;
  });
  bk.buildEnd = t + UNBUILD_T + .5;
}
// the old bike shatters into fragments in its part colours
function shatterBike(bk) {
  bk.bike.updateMatrixWorld(true); const c = new T.Box3().setFromObject(bk.bike).getCenter(V());
  for (const p of Object.values(bk.parts)) {
    const box = new T.Box3().setFromObject(p); if (box.isEmpty()) continue; const sz = box.getSize(V()), n = Math.min(22, 6 + Math.round((sz.x + sz.y + sz.z) * 3));
    for (let i = 0; i < n; i++) { const q = V(rand(box.min.x, box.max.x), rand(box.min.y, box.max.y), rand(box.min.z, box.max.z)); const v = q.clone().sub(c).setY(0).normalize().multiplyScalar(rand(1.5, 5)).add(V(0, rand(1, 4), 0));
      spawnCube(q, v, p.userData.col.clone().multiplyScalar(rand(.8, 1.4)), rand(.08, .22) * (bk === bigBike ? 1.4 : 1), rand(.9, 1.6)); }
  }
}
let pulseAt = -9;
function flicker(bk, t) {
  for (const [k, p] of Object.entries(bk.parts)) {
    const m = p.userData.m; if (!m) continue;
    const f = p.userData.fl || (p.userData.fl = { next: t + rand(.3, 4), until: 0, kind: 0, off: 0 });
    const soon = statusOf(k) !== 'ok';
    if (t > f.next) { const r = Math.random(); f.kind = r < .45 ? 1 : r < .8 ? 2 : 3; f.start = t; f.until = t + (f.kind === 1 ? rand(.05, .16) : f.kind === 2 ? rand(.25, .5) : rand(.06, .12)); f.next = f.until + (soon ? rand(.25, 1.1) : rand(1.6, 6.5)); f.off = rand(-.05, .05); }
    let b = .9 + .1 * Math.sin(t * 9 + k.length), jx = 0;
    if (t < f.until) {
      if (f.kind === 1) b = Math.random() < .5 ? .04 : .35;
      else if (f.kind === 2) b = .55 + .45 * Math.sign(Math.sin((t - f.start) * 70));
      else { b = 1.7; jx = f.off; }
    }
    if (soon) b *= .85 + .3 * Math.random() * (Math.random() < .15 ? 1 : 0);
    if (p.userData.build) { const bf = p.userData.bf || 0; b = (bf < 1 ? bf : b) + (p.userData.flash || 0); jx = 0; }
    m.h.uniforms.uB.value = b; m.e.opacity = p.userData.tracing ? 1 : .82 * Math.min(1, Math.max(b, p.userData.build ? .9 : 0)); p.userData.jx = jx;
  }
}

/* ============ text on canvas (panels, labels) — redrawn once the fonts arrive ============ */
const LABELS = [];
function label(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const tex = new T.CanvasTexture(c); tex.anisotropy = 4;
  const L = { c, tex, draw, redraw() { const g = c.getContext('2d'); g.clearRect(0, 0, w, h); draw(g, w, h); tex.needsUpdate = true; } };
  L.redraw(); LABELS.push(L); return L;
}
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => LABELS.forEach(l => l.redraw()));
const HEX = c => '#' + c.getHexString();
const F_D = '"Oxanium", "Arial Narrow", sans-serif', F_M = '"JetBrains Mono", ui-monospace, monospace';
function frameBox(g, w, h, col, cut = 26) {
  g.strokeStyle = col; g.lineWidth = 4; g.fillStyle = 'rgba(2,12,20,.72)';
  g.beginPath(); g.moveTo(2, 2); g.lineTo(w - cut, 2); g.lineTo(w - 2, cut); g.lineTo(w - 2, h - 2); g.lineTo(cut, h - 2); g.lineTo(2, h - cut); g.closePath(); g.fill(); g.stroke();
}
const panelMat = tex => new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: T.DoubleSide, toneMapped: false });

/* ============ 01 HOME BASE: the bike bay ============ */
const base = new T.Group(); base.position.set(PLACES[0].x, 0, PLACES[0].z); S.add(base);
const PLAT_Y = .5;
const platform = new T.Group(); base.add(platform);
{
  const body = new T.Mesh(new T.CylinderGeometry(4.6, 5, PLAT_Y, 6), new T.MeshBasicMaterial({ color: '#03080d' })); body.position.y = PLAT_Y / 2; platform.add(body);
  platform.add(new T.LineSegments(new T.EdgesGeometry(body.geometry), new T.LineBasicMaterial({ color: CY.clone().multiplyScalar(1.4) })).translateY(PLAT_Y / 2));
  const top = new T.Mesh(new T.CircleGeometry(4.4, 6), new T.ShaderMaterial({ uniforms: { uT: terrU.uT, uC: { value: CY } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    vertexShader: 'varying vec2 vP;void main(){vP=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform float uT;uniform vec3 uC;varying vec2 vP;void main(){float r=length(vP);float rings=pow(.5+.5*sin(r*5.-uT*2.),14.)*.35;float glow=smoothstep(4.4,0.,r)*.18;gl_FragColor=vec4(uC*(rings+glow),1.);}' }));
  top.rotation.x = -Math.PI / 2; top.position.y = PLAT_Y + .01; platform.add(top);
}
const rimMat = new T.MeshBasicMaterial({ color: CY.clone().multiplyScalar(2) });
const rim = new T.Mesh(new T.TorusGeometry(4.75, .06, 6, 6), rimMat); rim.rotation.x = Math.PI / 2; rim.rotation.z = Math.PI / 6; rim.position.y = PLAT_Y; platform.add(rim);
let dashBike = makeBike(bikeType, statusOf); dashBike.bike.scale.setScalar(3.6); dashBike.bike.position.set(0, PLAT_Y + .02, 0); base.add(dashBike.bike);
// health ring: one arc per service item, lit share = interval left
const RING_KEYS = PART_KEYS, BLOCKS = 9, R_RING = 6.3;
const ringMesh = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), RING_KEYS.length * BLOCKS);
const ringOf = [];
{
  const d = new T.Object3D(), arc = Math.PI * 2 / RING_KEYS.length, gap = .12;
  RING_KEYS.forEach((k, i) => {
    for (let j = 0; j < BLOCKS; j++) {
      const a = i * arc + gap / 2 + (j + .5) * (arc - gap) / BLOCKS, n = i * BLOCKS + j;
      d.position.set(Math.cos(a) * R_RING, .14, Math.sin(a) * R_RING); d.rotation.set(0, -a, 0); d.scale.set(.3, .1, (arc - gap) / BLOCKS * R_RING * .78); d.updateMatrix();
      ringMesh.setMatrixAt(n, d.matrix); ringMesh.setColorAt(n, CY); ringOf[n] = i;
    }
  });
}
base.add(ringMesh);
const partCol = k => PART[k].status === 'over' ? RD : PART[k].status === 'soon' ? AM : PART[k].status === 'unset' ? new T.Color('#2A4650') : CY;
const litOf = k => PART[k].status === 'unset' ? 0 : Math.max(PART[k].status === 'over' ? 0 : 1, Math.round(PART[k].left * BLOCKS));
function paintRing(flashArc = -1, on = false) {
  RING_KEYS.forEach((k, i) => { const col = partCol(k), lit = litOf(k); for (let j = 0; j < BLOCKS; j++) ringMesh.setColorAt(i * BLOCKS + j, col.clone().multiplyScalar(i === flashArc && on ? 3.5 : j < lit ? 2 : .12)); });
  ringMesh.instanceColor.needsUpdate = true;
}
paintRing();
let ringPick = -1, ringPickT = -9;
// three floating panels: range, next service, next renewal
const P_W = 512, P_H = 256;
const PANEL_POS = [V(-3.2, 6.6, 1.4), V(2.6, 8, -1.6), V(3.4, 4.6, 2.6)], PANEL_KIND = ['bar', 'bar', 'ring'];
const panels = PANEL_POS.map((pos, pi) => {
  const p = { pos, kind: PANEL_KIND[pi] }; const vp = () => VIEW.panels[pi] || { title: '—', value: '—', unit: '', sub: '', frac: 0, col: 'cy' };
  const L = label(P_W, P_H, (g, w, h) => {
    const q = vp(), col = q.col === 'am' ? '#FF8A1F' : q.col === 'rd' ? '#FF3B5C' : '#4DF3FF'; p.title = q.title; p.value = q.value; p.unit = q.unit; p.sub = q.sub; p.frac = q.frac; frameBox(g, w, h, col);
    g.fillStyle = col; g.font = `600 26px ${F_M}`; g.fillText(p.title, 30, 52);
    g.fillStyle = '#E8FDFF'; g.font = `800 96px ${F_D}`; g.fillText(p.value, 28, 150); const vw = g.measureText(p.value).width;
    g.fillStyle = '#8FB6C0'; g.font = `600 30px ${F_D}`; g.fillText(p.unit, 40 + vw, 150);
    g.fillStyle = '#BFE3EA'; g.font = `500 24px ${F_M}`; g.fillText(p.sub, 30, 196);
    if (p.kind === 'bar') { g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(30, 218, w - 60, 12); g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 16; g.fillRect(30, 218, (w - 60) * Math.max(.03, p.frac), 12); g.shadowBlur = 0; }
    else { const cx = w - 92, cy = 118, r = 58; g.lineWidth = 12; g.strokeStyle = 'rgba(255,255,255,.1)'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke(); g.strokeStyle = col; g.shadowColor = col; g.shadowBlur = 16; g.beginPath(); g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(.04, p.frac)); g.stroke(); g.shadowBlur = 0; }
  });
  const m = new T.Mesh(new T.PlaneGeometry(3.6, 1.8), panelMat(L.tex)); m.position.copy(p.pos); base.add(m);
  const tether = new T.Line(new T.BufferGeometry().setFromPoints([V(p.pos.x, 0, p.pos.z), p.pos.clone().add(V(0, -.9, 0))]), new T.LineBasicMaterial({ color: CY.clone().multiplyScalar(.8), transparent: true, opacity: .5 })); base.add(tether);
  return { m, p, L, ph: Math.random() * 6 };
});
// odometer on the floor
const odoL2 = label(768, 200, (g, w, h) => {
  frameBox(g, w, h, '#4DF3FF', 22); g.fillStyle = '#4DF3FF'; g.font = `600 26px ${F_M}`; g.fillText('ODOMETER', 30, 46);
  const digits = VIEW.odo == null ? '------' : String(Math.round(VIEW.odo)).padStart(6, '0').slice(-6); g.font = `700 96px ${F_M}`;
  for (let i = 0; i < 6; i++) { const x = 30 + i * 90; g.fillStyle = 'rgba(77,243,255,.08)'; g.fillRect(x, 64, 78, 116); g.strokeStyle = 'rgba(77,243,255,.6)'; g.lineWidth = 3; g.strokeRect(x, 64, 78, 116); g.fillStyle = i === 5 ? '#FF8A1F' : '#E8FDFF'; g.shadowColor = g.fillStyle; g.shadowBlur = 14; g.fillText(digits[i], x + 10, 158); g.shadowBlur = 0; }
  g.fillStyle = '#8FB6C0'; g.font = `600 44px ${F_D}`; g.fillText('KM', 590, 158);
});
const odo = new T.Mesh(new T.PlaneGeometry(4.2, 1.1), panelMat(odoL2.tex)); odo.position.set(.4, 1.1, 5.4); base.add(odo);

/* ============ 02 TRAIL VALLEY: the ride battle on a two-level glass arena ============ */
const VA = { cx: PLACES[1].x, cz: PLACES[1].z, half: 17 }, LOW = .12, UP = 4.12, RAMP_L = 8, BAND = 9, BAND_W = 3;
// the heights a cycle could be at here (null = outside the arena)
function hts(x, z) {
  const lx = x - VA.cx, lz = z - VA.cz; if (Math.abs(lx) > VA.half - .3 || Math.abs(lz) > VA.half - .3) return null;
  const band = Math.abs(Math.abs(lz) - BAND) < BAND_W;
  if (band && lx > 0 && lx < RAMP_L) return [LOW + (UP - LOW) * (1 - lx / RAMP_L)];
  return lx <= 0 ? [LOW, UP] : [LOW];
}
function pickH(x, z, y) { const h = hts(x, z); if (!h) return null; let best = null; for (const v of h) if (Math.abs(v - y) < .65 && (best == null || Math.abs(v - y) < Math.abs(best - y))) best = v; return best; }
function floorBelow(x, z, y) { const h = hts(x, z); if (!h) return groundAt(x, z); let b = 0; for (const v of h) if (v <= y + .05 && v > b) b = v; return b; }
const glassMat = (col, strong) => new T.ShaderMaterial({ uniforms: { uC: { value: col }, uT: terrU.uT, uS: { value: strong ? 1 : .6 } }, transparent: true, depthWrite: false, side: T.DoubleSide, extensions: { derivatives: true },
  vertexShader: 'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
  fragmentShader: `uniform vec3 uC;uniform float uT,uS;varying vec3 vW;
    float gl(float v,float s){float f=fract(v/s);float w=fwidth(v/s);return 1.-smoothstep(0.,w*1.6,min(f,1.-f));}
    void main(){float g=max(gl(vW.x,2.),gl(vW.z,2.));float G=max(gl(vW.x,8.),gl(vW.z,8.));
      vec3 V=normalize(cameraPosition-vW);float fr=pow(1.-abs(V.y),3.);
      vec3 c=uC*(g*.45+G*.6)*uS+vec3(.05,.12,.16)*fr;float a=.06+g*.4*uS+G*.5*uS+fr*.25;
      gl_FragColor=vec4(c,a);}` });
const battleArena = new T.Group(); battleArena.position.set(VA.cx, 0, VA.cz); S.add(battleArena);
{
  const H2 = VA.half;
  const lower = new T.Mesh(new T.PlaneGeometry(H2 * 2, H2 * 2), glassMat(new T.Color('#9FF8FF'), true)); lower.rotation.x = -Math.PI / 2; lower.position.y = LOW - .02; battleArena.add(lower);
  const lowerBase = new T.Mesh(new T.PlaneGeometry(H2 * 2, H2 * 2), new T.MeshBasicMaterial({ color: '#00060a' })); lowerBase.rotation.x = -Math.PI / 2; lowerBase.position.y = .04; battleArena.add(lowerBase);
  const upper = new T.Mesh(new T.PlaneGeometry(H2, H2 * 2), glassMat(new T.Color('#BFFBFF'), true)); upper.rotation.x = -Math.PI / 2; upper.position.set(-H2 / 2, UP - .02, 0); battleArena.add(upper);
  const edgeM = new T.LineBasicMaterial({ color: CY.clone().multiplyScalar(2.2) });
  const deckFill = new T.Mesh(new T.PlaneGeometry(H2, H2 * 2), new T.MeshBasicMaterial({ color: CY.clone().multiplyScalar(.12), transparent: true, opacity: .5, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })); deckFill.rotation.x = -Math.PI / 2; deckFill.position.set(-H2 / 2, UP - .04, 0); battleArena.add(deckFill);
  const deckEdge = [V(-H2, UP, -H2), V(0, UP, -H2), V(0, UP, -BAND - BAND_W), V(0, UP, -BAND + BAND_W), V(0, UP, BAND - BAND_W), V(0, UP, BAND + BAND_W), V(0, UP, H2), V(-H2, UP, H2), V(-H2, UP, -H2)];
  battleArena.add(new T.Line(new T.BufferGeometry().setFromPoints(deckEdge), edgeM)); battleArena.add(new T.Line(new T.BufferGeometry().setFromPoints(deckEdge.map(p => p.clone().setY(UP - .25))), new T.LineBasicMaterial({ color: CY.clone().multiplyScalar(1.1) })));
  for (const s of [-1, 1]) {
    const rg = new T.BufferGeometry(); rg.setAttribute('position', new T.Float32BufferAttribute([0, UP, s * BAND - BAND_W, RAMP_L, LOW, s * BAND - BAND_W, 0, UP, s * BAND + BAND_W, RAMP_L, LOW, s * BAND + BAND_W], 3)); rg.setIndex([0, 1, 2, 1, 3, 2]);
    battleArena.add(new T.Mesh(rg, glassMat(new T.Color('#FFE2B0'), true)));
    for (const e of [-1, 1]) battleArena.add(new T.Line(new T.BufferGeometry().setFromPoints([V(0, UP, s * BAND + e * BAND_W), V(RAMP_L, LOW, s * BAND + e * BAND_W)]), new T.LineBasicMaterial({ color: AM.clone().multiplyScalar(2) })));
  }
  const pillarM = new T.MeshBasicMaterial({ color: '#03080d' });
  for (const [x, z] of [[-H2 + .5, -H2 + .5], [-H2 + .5, H2 - .5], [-.5, -H2 + .5], [-.5, H2 - .5], [-H2 / 2, 0], [-.5, 0]]) {
    const p = new T.Mesh(new T.BoxGeometry(.5, UP, .5), pillarM); p.position.set(x, UP / 2, z); battleArena.add(p);
    battleArena.add(new T.LineSegments(new T.EdgesGeometry(p.geometry), new T.LineBasicMaterial({ color: CY.clone().multiplyScalar(.9) })).translateX(x).translateY(UP / 2).translateZ(z));
  }
  const wm = new T.ShaderMaterial({ uniforms: { uCy: { value: CY }, uT: terrU.uT }, side: T.DoubleSide, transparent: true,
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform vec3 uCy;uniform float uT;varying vec2 vUv;void main(){float top=smoothstep(.9,.98,vUv.y);float base=smoothstep(.06,0.,vUv.y);float run=pow(.5+.5*sin(vUv.x*30.-uT*3.),18.)*top;vec3 c=vec3(.006,.012,.02)+uCy*(top*1.1+base*.3+run*.9);gl_FragColor=vec4(c,.55+top*.4);}' });
  for (const [dx, dz, ry] of [[0, -1, 0], [0, 1, 0], [-1, 0, Math.PI / 2], [1, 0, Math.PI / 2]]) { const w = new T.Mesh(new T.PlaneGeometry(H2 * 2, 5.4), wm); w.position.set(dx * H2, 2.7, dz * H2); w.rotation.y = ry; battleArena.add(w); }
}
// light cycles
const SEG_MAX = 3000;
const segs = [];
const wPos = new Float32Array(SEG_MAX * 4 * 3), wCol = new Float32Array(SEG_MAX * 4 * 3), wV = new Float32Array(SEG_MAX * 4), wA = new Float32Array(SEG_MAX * 4);
const wIdx = new Uint32Array(SEG_MAX * 6); for (let i = 0; i < SEG_MAX; i++) wIdx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 1, i * 4 + 3, i * 4 + 2], i * 6);
const wGeo = new T.BufferGeometry();
wGeo.setAttribute('position', new T.BufferAttribute(wPos, 3)); wGeo.setAttribute('aCol', new T.BufferAttribute(wCol, 3)); wGeo.setAttribute('aV', new T.BufferAttribute(wV, 1)); wGeo.setAttribute('aA', new T.BufferAttribute(wA, 1)); wGeo.setIndex(new T.BufferAttribute(wIdx, 1));
const wMesh = new T.Mesh(wGeo, new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
  vertexShader: 'attribute vec3 aCol;attribute float aV,aA;varying vec3 vC;varying float vV,vA;void main(){vC=aCol;vV=aV;vA=aA;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: 'varying vec3 vC;varying float vV,vA;void main(){float a=vA*(.2+.6*pow(vV,2.2))+vA*smoothstep(.88,1.,vV)*1.3;gl_FragColor=vec4(vC*a*1.5,a);}' }));
wMesh.frustumCulled = false; S.add(wMesh);
const WALL_H = .85;
function rebuildWalls(t) {
  for (let i = segs.length - 1; i >= 0; i--) if (segs[i].die && t > segs[i].die) segs.splice(i, 1);
  let n = 0;
  const put = (s, col, a) => { if (n >= SEG_MAX) return; const o = n * 4;
    wPos.set([s.ax, s.ay, s.az, s.ax, s.ay + WALL_H, s.az, s.bx, s.by, s.bz, s.bx, s.by + WALL_H, s.bz], o * 3);
    for (let k = 0; k < 4; k++) { wCol.set([col.r, col.g, col.b], (o + k) * 3); wA[o + k] = a; } wV.set([0, 1, 0, 1], o); n++; };
  for (const s of segs) put(s, s.col, s.die ? 1 + 2 * Math.max(0, 1 - (s.die - t) * 4) : 1);
  for (const c of battle) if (c.alive && c.last) put({ ax: c.last.x, ay: c.last.y, az: c.last.z, bx: c.pos.x, by: c.pos.y, bz: c.pos.z }, c.col, 1);
  wGeo.setDrawRange(0, n * 6); for (const a of ['position', 'aCol', 'aV', 'aA']) wGeo.attributes[a].needsUpdate = true;
}
function segHit(px, pz, qx, qz, s) {
  const rx = qx - px, rz = qz - pz, sx = s.bx - s.ax, sz = s.bz - s.az, den = rx * sz - rz * sx; if (Math.abs(den) < 1e-9) return -1;
  const u = ((s.ax - px) * sz - (s.az - pz) * sx) / den, v = ((s.ax - px) * rz - (s.az - pz) * rx) / den;
  return u >= 0 && u <= 1 && v >= 0 && v <= 1 ? v : -1;
}
// spatial hash so each cycle only checks the walls near it
const CELL = 1.6, GN = Math.ceil(VA.half * 2 / CELL) + 2, grid = new Array(GN * GN);
const gi = (x, z) => { const i = Math.floor((x - VA.cx + VA.half) / CELL) + 1, j = Math.floor((z - VA.cz + VA.half) / CELL) + 1; return i < 0 || j < 0 || i >= GN || j >= GN ? -1 : i * GN + j; };
function rebuildGrid() {
  for (let i = 0; i < grid.length; i++) grid[i] = null;
  for (const s of segs) { if (s.die) continue; const x0 = Math.min(s.ax, s.bx), x1 = Math.max(s.ax, s.bx), z0 = Math.min(s.az, s.bz), z1 = Math.max(s.az, s.bz);
    for (let x = x0; x <= x1 + CELL; x += CELL) for (let z = z0; z <= z1 + CELL; z += CELL) { const k = gi(Math.min(x, x1), Math.min(z, z1)); if (k >= 0) (grid[k] || (grid[k] = new Set())).add(s); } }
}
function hitWall(c, px, pz, qx, qz, y) {
  const near = new Set();
  for (const [x, z] of [[px, pz], [qx, qz]]) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const k = gi(x + dx * CELL, z + dz * CELL); if (k >= 0 && grid[k]) grid[k].forEach(s => near.add(s)); }
  for (const s of near) { if (s === c.segA || s === c.segB) continue; const v = segHit(px, pz, qx, qz, s); if (v >= 0 && Math.abs(lerp(s.ay, s.by, v) - y) < 1) return s.owner; }
  for (const o of battle) if (o !== c && o.alive && o.last) { const s = { ax: o.last.x, az: o.last.z, bx: o.pos.x, bz: o.pos.z, ay: o.last.y, by: o.pos.y }; const v = segHit(px, pz, qx, qz, s); if (v >= 0 && Math.abs(lerp(s.ay, s.by, v) - y) < 1) return o; }
  return null;
}
function cycleModel(col, sc) {
  const g = new T.Group(), body = new T.MeshBasicMaterial({ color: '#03070b' }), glow = new T.MeshBasicMaterial({ color: col.clone().multiplyScalar(2.6) });
  for (const x of [-.82, .82]) { const w = new T.Mesh(new T.TorusGeometry(.4, .09, 10, 32), glow); w.position.set(x, .49, 0); g.add(w); const hub = new T.Mesh(new T.CylinderGeometry(.3, .3, .22, 24), body); hub.rotation.x = Math.PI / 2; hub.position.set(x, .49, 0); g.add(hub); }
  const shell = new T.Mesh(new T.SphereGeometry(.5, 24, 12), body); shell.scale.set(2.1, .7, .55); shell.position.set(0, .66, 0); g.add(shell);
  for (const z of [-.28, .28]) { const line = new T.Mesh(new T.TorusGeometry(.5, .025, 6, 48, Math.PI), glow); line.scale.set(2.1, .7, 1); line.position.set(0, .66, z); g.add(line); }
  const canopy = new T.Mesh(new T.SphereGeometry(.22, 16, 10), glow); canopy.scale.set(1.8, .6, .9); canopy.position.set(-.1, 1.0, 0); g.add(canopy);
  const outer = new T.Group(); outer.add(g); outer.rotation.order = 'YXZ'; return outer;
}
const SC = .62, SPEED = 8.5, TURN = 2.4;
let battle = [];
function setRiders(list) {
  const key = list.map(r => r.id).join('|'); if (key === setRiders.key) return; setRiders.key = key;
  const old = new Map(battle.map(b => [b.id, b]));
  for (const b of battle) if (!list.find(r => r.id === b.id)) { S.remove(b.mesh); for (const s of segs) if (s.owner === b) s.die = t; }
  battle = list.map((r, i) => { const o = old.get(r.id); if (o) { o.i = i; return o; }
    const n = { id: r.id, i, col: new T.Color(r.col), pos: V(), th: 0, om: 0, tgt: 0, alive: false, last: null, segA: null, segB: null, kills: 0, respawn: (typeof t === 'number' ? t : 0) + .3 + i * .6, think: 0, wander: 0, react: null };
    n.mesh = cycleModel(n.col, SC); n.mesh.visible = false; S.add(n.mesh); return n; });
}
function closeSeg(c) {
  if (!c.last || c.last.distanceTo(c.pos) < .05) return;
  const s = { ax: c.last.x, ay: c.last.y, az: c.last.z, bx: c.pos.x, by: c.pos.y, bz: c.pos.z, owner: c, col: c.col, born: t };
  segs.push(s); c.segB = c.segA; c.segA = s; c.last = c.pos.clone();
  if (segs.length > SEG_MAX - 20) segs.splice(0, 1);
}
function probe(c, ang, L) {
  let x = c.pos.x, z = c.pos.z, y = c.pos.y; const st = .7, dx = Math.cos(ang), dz = Math.sin(ang);
  for (let d = st; d <= L; d += st) { const nx = x + dx * st, nz = z + dz * st, ny = pickH(nx, nz, y); if (ny == null || hitWall(c, x, z, nx, nz, (y + ny) / 2)) return d - st; x = nx; z = nz; y = ny; }
  return L;
}
function spawnIn(c) {
  for (let k = 0; k < 20; k++) {
    const x = VA.cx + rand(-VA.half + 3, VA.half - 3), z = VA.cz + rand(-VA.half + 3, VA.half - 3), hs = hts(x, z); if (!hs) continue;
    c.pos.set(x, hs[Math.floor(Math.random() * hs.length)], z); c.th = Math.floor(rand(0, 4)) * Math.PI / 2; c.alive = false;
    if (probe(c, c.th, 9) >= 8.9) { c.alive = true; c.last = c.pos.clone(); c.segA = c.segB = null; c.om = 0; c.tgt = c.th; c.rezAt = t; c.react = null; c.mesh.position.copy(c.pos); c.mesh.rotation.set(0, -c.th, 0); c.mesh.scale.set(SC, .001, SC); c.mesh.visible = true; return; }
  }
  c.respawn = t + .4;
}
function newGoal(c) {
  const lx = c.pos.x - VA.cx, up = c.pos.y > 2, s = Math.random() < .5 ? -1 : 1;
  c.goal = Math.random() < .75 ? (up ? V(VA.cx + RAMP_L + 3, 0, VA.cz + s * BAND) : (lx > RAMP_L ? V(VA.cx - 5, 0, VA.cz + s * BAND) : V(VA.cx + RAMP_L + 4, 0, VA.cz + s * BAND)))
    : V(VA.cx + rand(-14, 14), 0, VA.cz + rand(-14, 14));
  c.goalT = t + rand(5, 9);
}
function stepCycle(c, dt) {
  if (!c.alive) { if (t > c.respawn) spawnIn(c); return; }
  c.think -= dt;
  const ahead = probe(c, c.th, 4 + SPEED * .35), danger = ahead < 2.4 + SPEED * .3;
  if (danger && c.react == null) c.react = Math.random() < .8; if (!danger) c.react = null;
  if (c.think <= 0 || (danger && c.react)) {
    c.think = rand(.12, .25); if (Math.random() < .08) c.wander = rand(-.9, .9);
    if (!c.goal || t > c.goalT || c.pos.distanceTo(V(c.goal.x, c.pos.y, c.goal.z)) < 2.5) newGoal(c);
    const ga = Math.atan2(c.goal.z - c.pos.z, c.goal.x - c.pos.x);
    let best = c.th + c.wander * .3, bs = -1e9;
    for (const off of [-1.4, -.8, -.4, -.15, 0, .15, .4, .8, 1.4]) { const a = c.th + off; const d = probe(c, a, 12); const gd = Math.abs(Math.atan2(Math.sin(ga - a), Math.cos(ga - a))); const s = Math.min(d, 9) - Math.abs(off) * 1.1 - gd * 2.2 + (Math.sign(off) === Math.sign(c.wander) ? .5 : 0); if (s > bs) { bs = s; best = a; } }
    if (!danger || c.react) c.tgt = best;
  }
  let diff = c.tgt - c.th; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  const om = Math.max(-TURN, Math.min(TURN, diff * 6)); c.om = lerp(c.om, om, .2); const prevTh = c.th; c.th += c.om * dt;
  const nx = c.pos.x + Math.cos(c.th) * SPEED * dt, nz = c.pos.z + Math.sin(c.th) * SPEED * dt, ny = pickH(nx, nz, c.pos.y);
  let hit = ny == null ? 'edge' : hitWall(c, c.pos.x, c.pos.z, nx, nz, (c.pos.y + ny) / 2);
  if (hit) { if (hit !== 'edge' && hit !== c) { hit.kills++; updateScores(); } derez(c); return; }
  const slope = (ny - c.pos.y) / (SPEED * dt);
  c.pos.set(nx, ny, nz);
  if (c.last && (c.last.distanceTo(c.pos) > .6 || Math.abs(c.th - prevTh) > .02 && c.last.distanceTo(c.pos) > .3)) closeSeg(c);
  const rk = Math.min(1, (t - c.rezAt) / .5);
  c.mesh.position.copy(c.pos); c.mesh.rotation.set(0, -c.th, 0); c.mesh.children[0].rotation.set(-c.om * .22, 0, Math.atan(slope)); c.mesh.scale.set(SC, SC * rk, SC);
}
function updateScores() { API.onScore && API.onScore(battle.map(b => b.kills)); }

/* ---- DEREZ: chunky glowing fragments that keep the cycle's momentum; the wall breaks apart too ---- */
const CUBES = 1400;
const cubeMesh = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.ShaderMaterial({
  vertexShader: 'varying vec3 vL,vC;void main(){vL=position;vC=instanceColor;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',
  fragmentShader: 'varying vec3 vL,vC;void main(){vec3 a=abs(vL);float e=max(max(min(a.x,a.y),min(a.y,a.z)),min(a.x,a.z));float edge=smoothstep(.34,.47,e);gl_FragColor=vec4(vC*(.1+edge*1.7),1.);}' }), CUBES);
cubeMesh.frustumCulled = false; S.add(cubeMesh);
const dmc = new T.Object3D(); dmc.scale.setScalar(0); dmc.updateMatrix();
for (let i = 0; i < CUBES; i++) { cubeMesh.setMatrixAt(i, dmc.matrix); cubeMesh.setColorAt(i, CY); }
const cubes = new Array(CUBES).fill(null); let cubeI = 0;
function spawnCube(p, v, col, size, life, at = t) { const k = cubeI++ % CUBES; cubes[k] = { p, v, r: V(rand(0, 6), rand(0, 6), rand(0, 6)), w: V(rand(-7, 7), rand(-7, 7), rand(-7, 7)), born: at, life, size, col }; }
let derezCount = 0;
function derez(c) {
  closeSeg(c); c.alive = false; c.mesh.visible = false; c.respawn = t + rand(2, 3.2); derezCount++;
  const fwd = V(Math.cos(c.th), 0, Math.sin(c.th)), side = V(-fwd.z, 0, fwd.x);
  for (let i = 0; i < 90; i++) {
    const p = c.pos.clone().addScaledVector(fwd, rand(-1.1, 1.1) * SC).addScaledVector(side, rand(-.3, .3) * SC).add(V(0, rand(.2, 1.2) * SC, 0));
    const v = fwd.clone().multiplyScalar(SPEED * rand(.4, 1.15)).addScaledVector(side, rand(-2.2, 2.2)).add(V(0, rand(0, 3.2), 0));
    spawnCube(p, v, c.col.clone().multiplyScalar(rand(.8, 1.5)), rand(.1, .32) * SC * 1.2, rand(1.3, 2.4));
  }
  const own = segs.filter(s => s.owner === c).reverse();
  own.forEach((s, i) => { const at = t + i * .012; s.die = at;
    if (i % 2 === 0) spawnCube(V(lerp(s.ax, s.bx, .5), s.ay + rand(0, WALL_H), lerp(s.az, s.bz, .5)), V(rand(-.8, .8), rand(0, 1.6), rand(-.8, .8)), c.col.clone().multiplyScalar(rand(.7, 1.3)), rand(.07, .18), rand(.7, 1.3), at); });
  c.last = null;
  const d = cam.position.distanceTo(c.pos); if (d < 70) Snd.shatter(c.i, 1 - d / 70);
}
const tmpO = new T.Object3D();
function updateCubes(t, dt) {
  let any = false;
  for (let k = 0; k < CUBES; k++) {
    const q = cubes[k]; if (!q) continue; any = true;
    if (t < q.born) { cubeMesh.setMatrixAt(k, dmc.matrix); continue; }
    const age = (t - q.born) / q.life;
    if (age >= 1) { cubeMesh.setMatrixAt(k, dmc.matrix); cubes[k] = null; continue; }
    q.v.y -= 9.8 * dt; const py = q.p.y; q.p.addScaledVector(q.v, dt);
    const gy = floorBelow(q.p.x, q.p.z, py) + q.size * .5;
    if (q.p.y < gy) { q.p.y = gy; q.v.y *= -.25; q.v.x *= .9; q.v.z *= .9; q.w.multiplyScalar(.9); }
    q.r.addScaledVector(q.w, dt);
    const s = q.size * (age > .65 ? (1 - age) / .35 : 1);
    tmpO.position.copy(q.p); tmpO.rotation.set(q.r.x, q.r.y, q.r.z); tmpO.scale.setScalar(s); tmpO.updateMatrix(); cubeMesh.setMatrixAt(k, tmpO.matrix);
    cubeMesh.setColorAt(k, q.col.clone().multiplyScalar(1 - age * .6));
  }
  if (any) { cubeMesh.instanceMatrix.needsUpdate = true; cubeMesh.instanceColor.needsUpdate = true; }
}

/* ============ 03 HANGAR ============ */
const hangar = new T.Group(); hangar.position.set(PLACES[2].x, 0, PLACES[2].z); S.add(hangar);
let bigBike = makeBike(bikeType, statusOf); bigBike.bike.scale.setScalar(5); bigBike.bike.position.set(0, .1, 0); hangar.add(bigBike.bike);
const turntable = new T.Mesh(new T.RingGeometry(6.4, 6.6, 64), new T.MeshBasicMaterial({ color: CY.clone().multiplyScalar(2), side: T.DoubleSide, transparent: true })); turntable.rotation.x = -Math.PI / 2; turntable.position.y = .1; hangar.add(turntable);
for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + Math.PI / 4; const p = new T.Mesh(new T.BoxGeometry(.5, 9, .5), new T.MeshBasicMaterial({ color: '#020407' })); p.position.set(Math.cos(a) * 10, 4.5, Math.sin(a) * 10); hangar.add(p); hangar.add(new T.LineSegments(new T.EdgesGeometry(p.geometry), new T.LineBasicMaterial({ color: CY.clone().multiplyScalar(.9) })).translateX(p.position.x).translateY(4.5).translateZ(p.position.z)); }

/* ============ 04 DEPOT: your bike's own fuel tank, filled with rings of light ============ */
const depot = new T.Group(); depot.position.set(PLACES[3].x, 0, PLACES[3].z); S.add(depot);
// tank shape per bike type: length, half-width curve, top & bottom curves (x from -1 front … 1 back), cross-section squareness
const TANKS = {
  teardrop: { L: 6.4, w: u => 1.55 * Math.pow(Math.max(0, 1 - Math.pow((u + .25) / 1.25, 2)), .55), top: u => 1.55 + .55 * Math.cos((u + .2) * 1.3) - .25 * u, bot: u => .15 * u * u - .05, n: 2.4 },
  sport: { L: 6, w: u => 1.5 * Math.pow(Math.max(0, 1 - Math.pow((u + .1) / 1.1, 2)), .5), top: u => 1.85 + .2 * Math.cos(u * 1.6) - .65 * u, bot: u => .25 * u + .05, n: 2.8 },
  cruiser: { L: 7, w: u => 1.2 * Math.pow(Math.max(0, 1 - Math.pow((u + .05) / 1.05, 2)), .4), top: u => 1.35 + .15 * Math.cos(u * 1.5), bot: u => .12 * u * u, n: 2.2 },
  classic: { L: 6.6, w: u => 1.45 * Math.pow(Math.max(0, 1 - Math.pow((u + .1) / 1.1, 2)), .5), top: u => 1.6 + .35 * Math.cos(u * 1.4), bot: u => .2 * u * u, n: 2.2 },
  adventure: { L: 6.4, w: u => 1.85 * Math.pow(Math.max(0, 1 - Math.pow((u + .2) / 1.2, 2)), .45), top: u => 2 + .35 * Math.cos((u + .2) * 1.4) - .3 * u, bot: u => .35 * u * u - .1, n: 2.6 },
  under: { L: 5.2, w: u => 1.6 * Math.pow(Math.max(0, 1 - Math.pow(u, 8)), .25), top: u => 1.05 * Math.pow(Math.max(0, 1 - Math.pow(u, 8)), .2) + .05, bot: u => -.05, n: 4.5 },
};
const TANK_OF = { naked: 'teardrop', sport: 'sport', scooter: 'under', trike: 'under', underbone: 'under', adventure: 'adventure', cruiser: 'cruiser', cafe: 'classic', classic: 'classic' };
const tankGroup = new T.Group(); tankGroup.position.y = 1.4; tankGroup.scale.setScalar(1.05); depot.add(tankGroup);
let tank = null, level = .05, lastT = 0;
const fuelCol = new T.Color('#FF9A2E');
function buildTank(type) {
  if (tank) tankGroup.remove(tank.g);
  const P0 = TANKS[TANK_OF[type] || 'teardrop'], P = Object.assign({}, P0, { top: u => P0.top(u) * 1.75, bot: u => P0.bot(u) * 1.2 }), g = new T.Group(), L = P.L;
  const sec = (u, v) => { const x = u * L / 2, top = P.top(u), bot = P.bot(u), yc = (top + bot) / 2, ry = Math.max(.001, (top - bot) / 2), rz = Math.max(.001, P.w(u)), c = Math.cos(v), s = Math.sin(v), e = 2 / P.n;
    return V(x, yc + ry * Math.sign(s) * Math.pow(Math.abs(s), e), rz * Math.sign(c) * Math.pow(Math.abs(c), e)); };
  const shell = new T.ParametricGeometry((u, v, out) => out.copy(sec(u * 2 - 1, v * Math.PI * 2)), 64, 48);
  const sm = holo(CY); sm.uniforms.uB.value = .85; g.add(new T.Mesh(shell, sm));
  const lm = new T.LineBasicMaterial({ color: CY.clone().multiplyScalar(1.3), transparent: true, opacity: .75, blending: T.AdditiveBlending, depthWrite: false });
  for (let i = 1; i < 12; i++) { const u = -1 + i / 6; g.add(new T.LineLoop(new T.BufferGeometry().setFromPoints(Array.from({ length: 48 }, (_, k) => sec(u, k / 48 * Math.PI * 2))), lm)); }
  for (let k = 0; k < 8; k++) g.add(new T.Line(new T.BufferGeometry().setFromPoints(Array.from({ length: 65 }, (_, i) => sec(-1 + i / 32, k / 8 * Math.PI * 2))), lm));
  // filler cap on top of the highest point
  let hi = -1, hu = 0; for (let i = 0; i <= 40; i++) { const u = -1 + i / 20; if (P.top(u) > hi && P.w(u) > .4) { hi = P.top(u); hu = u; } }
  const cap = new T.Mesh(new T.CylinderGeometry(.32, .32, .08, 24), new T.MeshBasicMaterial({ color: CY.clone().multiplyScalar(2) })); cap.position.set(hu * L / 2, hi + .02, 0); g.add(cap);
  // slices of fuel: horizontal outlines of the tank at stacked heights
  let ymin = 1e9, ymax = -1e9; for (let i = 0; i <= 60; i++) { const u = -1 + i / 30; ymin = Math.min(ymin, P.bot(u)); ymax = Math.max(ymax, P.top(u)); }
  const NS = 26, rings = [];
  for (let k = 0; k < NS; k++) {
    const y = ymin + (k + .5) / NS * (ymax - ymin), up = [], dn = [];
    for (let i = 0; i <= 80; i++) { const u = -1 + i / 40, top = P.top(u), bot = P.bot(u); if (y <= bot || y >= top) continue; const yc = (top + bot) / 2, ry = (top - bot) / 2, rz = P.w(u) * .94;
      const z = rz * Math.pow(Math.max(0, 1 - Math.pow(Math.abs((y - yc) / ry), P.n)), 1 / P.n); if (z < .02) continue; up.push(V(u * L / 2 * .97, y, z)); dn.push(V(u * L / 2 * .97, y, -z)); }
    if (up.length < 3) continue;
    const pts = up.concat(dn.reverse()); const geo = new T.TubeGeometry(new T.CatmullRomCurve3(pts, true), 140, .028, 4, true);
    const line = new T.Mesh(geo, new T.MeshBasicMaterial({ color: fuelCol.clone().multiplyScalar(2), transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
    const shp = new T.Shape(pts.map(p => new T.Vector2(p.x, p.z))); const fill = new T.Mesh(new T.ShapeGeometry(shp), new T.MeshBasicMaterial({ color: fuelCol, transparent: true, opacity: .07, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
    fill.rotation.x = Math.PI / 2; fill.position.y = y;
    g.add(line, fill); rings.push({ line, fill, y, base: Float32Array.from(geo.attributes.position.array), frac: (k + .5) / NS });
  }
  tankGroup.add(g); tank = { g, rings, ymin, ymax };
}
buildTank(bikeType);
const fuelL = label(512, 256, (g, w, h) => {
  const f = VIEW.fuel; frameBox(g, w, h, '#FF9A2E');
  g.fillStyle = '#FF9A2E'; g.font = `600 26px ${F_M}`; g.fillText('FUEL', 30, 52);
  const v = f.litres == null ? '—' : f.litres.toFixed(1);
  g.fillStyle = '#E8FDFF'; g.font = `800 96px ${F_D}`; g.fillText(v, 28, 150); const vw = g.measureText(v).width;
  g.fillStyle = '#8FB6C0'; g.font = `600 30px ${F_D}`; g.fillText(`L / ${f.tank || '—'} L`, 40 + vw, 150);
  g.fillStyle = '#BFE3EA'; g.font = `500 24px ${F_M}`; g.fillText(f.range == null ? 'NEEDS 2 FULL FILL-UPS' : `≈ ${Math.round(f.range)} KM · ${f.kpl.toFixed(1)} KM/L`, 30, 200);
});
const fuelPanel = new T.Mesh(new T.PlaneGeometry(3.6, 1.8), panelMat(fuelL.tex)); fuelPanel.position.set(3.6, 7.4, 1.5); depot.add(fuelPanel);
{ const pad = new T.Mesh(new T.RingGeometry(3.8, 4, 6), new T.MeshBasicMaterial({ color: CY.clone().multiplyScalar(1.6), side: T.DoubleSide })); pad.rotation.x = -Math.PI / 2; pad.position.y = .1; depot.add(pad);
  const beamM = new T.MeshBasicMaterial({ color: CY.clone().multiplyScalar(.5), transparent: true, opacity: .18, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
}
function updateTank(t) {
  if (!tank) return; const dtl = Math.min(.1, t - lastT); lastT = t; level = lerp(level, cur === 3 && !travel ? VIEW.fuel.frac : .03, 1 - Math.exp(-dtl * 2.2));
  tankGroup.rotation.y = t * .22; tankGroup.position.y = 1.4 + Math.sin(t * 1.1) * .12;
  let topI = -1; tank.rings.forEach((r, i) => { if (r.frac <= level) topI = i; });
  tank.rings.forEach((r, i) => {
    const on = r.frac <= level, isTop = i === topI;
    r.line.visible = on; r.fill.visible = on;
    r.line.material.color.copy(fuelCol).multiplyScalar(isTop ? 2.6 + Math.sin(t * 6) * .5 : .55 + (i / tank.rings.length) * .45);
    r.fill.material.opacity = isTop ? .14 : .025;
    const a = r.line.geometry.attributes.position;
    if (isTop) { for (let k = 0; k < a.count; k++) a.array[k * 3 + 1] = r.y + Math.sin(a.array[k * 3] * 1.8 + t * 3.4) * .06 + Math.sin(a.array[k * 3 + 2] * 2.4 - t * 2.6) * .04; a.needsUpdate = true; r.wav = true; }
    else if (r.wav) { a.array.set(r.base); a.needsUpdate = true; r.wav = false; }
  });
}

/* ============ 05 CONTROL DECK ============ */
const deck = new T.Group(); deck.position.set(PLACES[4].x, 0, PLACES[4].z); S.add(deck);
const DECK_Y = .6;
{
  const body = new T.Mesh(new T.CylinderGeometry(7, 7.4, DECK_Y, 48), new T.MeshBasicMaterial({ color: '#03080d' })); body.position.y = DECK_Y / 2; deck.add(body);
  const lip = new T.Mesh(new T.TorusGeometry(7.05, .05, 6, 96), new T.MeshBasicMaterial({ color: CY.clone().multiplyScalar(2) })); lip.rotation.x = Math.PI / 2; lip.position.y = DECK_Y; deck.add(lip);
  const core = new T.Mesh(new T.RingGeometry(1.6, 1.75, 48), new T.MeshBasicMaterial({ color: CY.clone().multiplyScalar(1.6), side: T.DoubleSide })); core.rotation.x = -Math.PI / 2; core.position.y = DECK_Y + .01; deck.add(core);
}
const TILES = [['BIKE'], ['RENEWALS'], ['AUTO-LOG'], ['BADGES'], ['RIDE WRAP'], ['SOUND'], ['BACKUP']];
const tiles = TILES.map(([name], i) => {
  const a = -Math.PI / 2 + (i - (TILES.length - 1) / 2) * .62 + Math.PI, R = 4.6;
  const g = new T.Group(); g.position.set(Math.cos(a) * R, DECK_Y, Math.sin(a) * R); g.rotation.y = -a + Math.PI / 2; deck.add(g);
  const geo = new T.BoxGeometry(2.3, .32, 1.5); const box = new T.Mesh(geo, new T.MeshBasicMaterial({ color: '#041019' })); box.position.y = .16; g.add(box);
  const edgeM = new T.LineBasicMaterial({ color: CY.clone().multiplyScalar(1.5) }); g.add(new T.LineSegments(new T.EdgesGeometry(geo), edgeM).translateY(.16));
  const L = label(256, 160, (gg, w, h) => { frameBox(gg, w, h, '#4DF3FF', 18); gg.fillStyle = '#E8FDFF'; gg.font = `700 38px ${F_D}`; gg.textAlign = 'center'; gg.shadowColor = '#4DF3FF'; gg.shadowBlur = 12; gg.fillText(name, w / 2, h / 2 + 12); });
  const lab = new T.Mesh(new T.PlaneGeometry(2, 1.25), panelMat(L.tex)); lab.position.y = 1.15; g.add(lab); lab.userData.tile = true;
  const glyph = new T.Mesh(new T.RingGeometry(.28, .36, 6), new T.MeshBasicMaterial({ color: CY.clone().multiplyScalar(2), side: T.DoubleSide })); glyph.rotation.x = -Math.PI / 2; glyph.position.y = .33; g.add(glyph);
  return { g, box, edgeM, lab, y: 0, ty: 0, i };
});
let tileSel = -1;
// renewal pillars: light drains as the date gets closer
let pillars = [], medals = [];
function buildPillars() {
  pillars.forEach(p => deck.remove(p.g));
  const list = VIEW.renewals.slice(0, 5), N = list.length;
  pillars = list.map(({ name, days, span }, i) => {
  const a = Math.PI * (1.5 + (i - (N - 1) / 2) * .093), R = 15, H = 3.6 + (i % 2) * 1.4, frac = Math.max(0, Math.min(1, days / span)), soon = days <= 30, col = days < 0 ? RD : soon ? AM : CY;
  const g = new T.Group(); g.position.set(Math.cos(a) * R, 0, Math.sin(a) * R); deck.add(g);
  const geo = new T.BoxGeometry(1.1, H, 1.1); const box = new T.Mesh(geo, new T.MeshBasicMaterial({ color: '#03080d' })); box.position.y = H / 2; g.add(box);
  g.add(new T.LineSegments(new T.EdgesGeometry(geo), new T.LineBasicMaterial({ color: CY.clone().multiplyScalar(.9) })).translateY(H / 2));
  const fill = new T.Mesh(new T.BoxGeometry(.7, 1, .7), new T.MeshBasicMaterial({ color: col.clone().multiplyScalar(2.2) })); fill.position.y = .2; g.add(fill);
  const L = label(512, 220, (gg, w, h) => { frameBox(gg, w, h, HEX(col), 22); gg.fillStyle = HEX(col); gg.font = `700 34px ${F_M}`; gg.textAlign = 'center'; gg.fillText(name, w / 2, 66); gg.fillStyle = '#E8FDFF'; gg.shadowColor = '#E8FDFF'; gg.shadowBlur = 10; gg.font = `800 96px ${F_D}`; gg.fillText(days < 0 ? 'OVERDUE' : days > 400 ? (days / 365).toFixed(1) + ' Y' : days + ' D', w / 2, 178); });
  const lab = new T.Mesh(new T.PlaneGeometry(4, 1.72), panelMat(L.tex)); lab.position.y = H + 1.4; g.add(lab);
  return { g, fill, lab, H, frac, soon: soon || days < 0 };
  });
}
function buildMedals() {
  medals.forEach(m => deck.remove(m.g));
// badge medallions floating above the console
const TIER = [new T.Color('#3A4A55'), new T.Color('#D08A4E'), new T.Color('#C9D3DE'), new T.Color('#FFC83D')];
  medals = VIEW.badges.slice(0, 10).map(([name, tier], i) => {
  const g = new T.Group(), row = Math.floor(i / 5), cI = i % 5; g.position.set((cI - 2) * 1.7 + (row ? .85 : 0) - .4, 12.6 - row * 1.5, -3 - row * .4); g.scale.setScalar(.85); deck.add(g);
  const col = TIER[tier], lit = tier > 0;
  const disc = new T.Mesh(new T.CylinderGeometry(.55, .55, .08, 32), new T.MeshBasicMaterial({ color: col.clone().multiplyScalar(lit ? .3 : .15) })); disc.rotation.x = Math.PI / 2; g.add(disc);
  const ring = new T.Mesh(new T.TorusGeometry(.56, .045, 6, 40), new T.MeshBasicMaterial({ color: col.clone().multiplyScalar(lit ? 1.3 : .45) })); g.add(ring);
  const star = new T.Mesh(new T.CircleGeometry(.24, 5), new T.MeshBasicMaterial({ color: col.clone().multiplyScalar(lit ? 1.2 : .35), side: T.DoubleSide })); star.position.z = .05; g.add(star);
  return { g, ph: i * .7 };
  });
}

/* ============ CAMERA VANTAGES + TRAVEL ============ */
const CAMV = [
  { off: V(8, 6.5, 15), look: V(-.6, 3.6, 0) },
  { off: V(21, 15, 24), look: V(-1, 1, 0) },
  { off: V(4, 6, 22), look: V(0, 3, 0) },
  { off: V(10, 7.5, 16), look: V(.6, 3.6, 0) },
  { off: V(1, 13, 23), look: V(0, 5.2, -4) },
];
const camState = { pos: V(), look: V(), yaw: 0, pitch: 0, ty: 0, tp: 0, idle: 0 };
let cur = 0, travel = null;
const vantage = (i, yaw = 0, pitch = 0) => {
  const p = PLACES[i], v = CAMV[i], look = v.look.clone().add(V(p.x, 0, p.z));
  const r = Math.hypot(v.off.x, v.off.z), a = Math.atan2(v.off.z, v.off.x) + yaw, portrait = innerHeight > innerWidth ? 1.25 : 1;
  return { pos: V(p.x + Math.cos(a) * r * portrait, v.off.y * portrait + pitch * 10, p.z + Math.sin(a) * r * portrait), look };
};
function startTravel(to) {
  const v0 = { pos: cam.position.clone(), look: camState.look.clone() }, v1 = vantage(to);
  travel = { to, t: 0, dur: RM ? .6 : 1.25, v0, v1, peak: Math.max(v0.pos.y, v1.pos.y) + 7 };
  cur = to; camState.ty = camState.tp = camState.yaw = camState.pitch = 0; tileSel = -1;
  Snd.whoosh();
}

const tagsEl = document.getElementById('tags');
let labels = [];
function buildTags() {
  tagsEl.innerHTML = '';
  labels = Object.entries(bigBike.anchors).filter(([k]) => PART[k] && bigBike.parts[k] && PART[k].status !== 'unset').map(([k, a]) => {
    const { name: n0, val, status: s } = PART[k]; const name = bigBike.names[k] || n0; const el = document.createElement('div'); el.className = 'tag' + (s === 'soon' ? ' soon' : s === 'over' ? ' over' : '');
    el.innerHTML = `<i></i><span>${name} · ${val}</span>`; tagsEl.appendChild(el); return { k, a, el };
  });
}
buildTags();
// switching bikes: the old one un-builds the way it appeared, then the new one builds
let swapping = false;
function setBike(type) {
  if (type === bikeType || swapping) return; bikeType = type; swapping = true;
  exT = 0; startUnbuild(dashBike); startUnbuild(bigBike); Snd.powerDown();
  setTimeout(() => {
    base.remove(dashBike.bike); hangar.remove(bigBike.bike);
    dashBike = makeBike(type, statusOf); dashBike.bike.scale.setScalar(3.6); dashBike.bike.position.set(0, PLAT_Y + .02, 0); base.add(dashBike.bike);
    bigBike = makeBike(type, statusOf); bigBike.bike.scale.setScalar(5); bigBike.bike.position.set(0, .1, 0); hangar.add(bigBike.bike);
    buildTags(); ex = 0; startBuild(dashBike); startBuild(bigBike); buildTank(type); pulseAt = t; Snd.rez(); swapping = false;
  }, UNBUILD_T * 1000);
}
/* ============ input ============ */
let down = null; const ray = new T.Raycaster(), ndc = new T.Vector2();
let exT = 0, ex = 0;
cv.addEventListener('pointerdown', e => { if (API.locked) return; down = { x: e.clientX, y: e.clientY, t: performance.now(), yaw: camState.ty, pitch: camState.tp }; cv.setPointerCapture(e.pointerId); Snd.start(); });
cv.addEventListener('pointermove', e => { if (!down || travel) return; camState.ty = down.yaw - (e.clientX - down.x) * .005; camState.tp = Math.max(-.5, Math.min(.9, down.pitch + (e.clientY - down.y) * .004)); camState.idle = 0; });
cv.addEventListener('pointerup', e => {
  if (!down) return; const tap = Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8 && performance.now() - down.t < 350; down = null;
  if (!tap || travel) return;
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, cam);
  if (cur === 2 && ray.intersectObject(bigBike.bike, true).length) { exT = exT ? 0 : 1; Snd.click(exT ? 1.2 : .8); return; }
  if (cur === 0) { const h = ray.intersectObject(ringMesh); if (h.length) { pickArc(ringOf[h[0].instanceId]); return; } }
  if (cur === 4) { const h = ray.intersectObjects(tiles.map(x => x.box)); if (h.length) { pickTile(tiles.findIndex(x => x.box === h[0].object)); return; } }
  rebuild(ray);
});
function pickArc(i) {
  ringPick = i; ringPickT = t; const k = RING_KEYS[i]; Snd.click(1); API.onArc && API.onArc(k, bigBike.names[k] || PART[k].name);
}
function pickTile(i) {
  tileSel = tileSel === i ? -1 : i; Snd.click(tileSel >= 0 ? 1.3 : .7);
  if (tileSel >= 0) { const sel = tileSel; setTimeout(() => { API.onTile && API.onTile(TILES[sel][0]); }, 380); }
}
function rebuild(r) {
  const hit = V(); if (!r || !r.ray.intersectPlane(new T.Plane(V(0, 1, 0), -.5), hit) || hit.length() > 400) hit.set(PLACES[cur].x, 0, PLACES[cur].z);
  if (terrU.uWave.value >= 0) terrU.uA.value = terrU.uB.value;
  terrU.uO.value.set(hit.x, hit.z); terrU.uB.value = terrU.uA.value + rand(1.2, 3.4); terrU.uWave.value = 0;
  Snd.rebuild();
}

/* ============ frame loop ============ */
function resize() { cloudU.uScale.value = innerHeight / (2 * Math.tan(cam.fov * Math.PI / 360)); R.setSize(innerWidth, innerHeight, false); composer.setSize(innerWidth, innerHeight); bloom.resolution.set(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); }
addEventListener('resize', resize);
resize(); const clock = new T.Clock(); let t = 0; const v3 = V();
{ const v = vantage(0); cam.position.copy(v.pos).add(V(30, 40, 60)); camState.look.copy(v.look); }
const intro = { t: 0 };
function frame() {
  requestAnimationFrame(frame); if (document.hidden || API.paused) return;
  const dt = Math.min(.05, clock.getDelta()) * (RM ? .5 : 1); t += dt;
  terrU.uT.value = t;
  if (terrU.uWave.value >= 0) { terrU.uWave.value += dt * 34; if (terrU.uWave.value > 270) { terrU.uA.value = terrU.uB.value; terrU.uWave.value = -1; } }
  // camera
  if (travel) {
    travel.t += dt / travel.dur; const k = ease(Math.min(1, travel.t)); dustU.uSpeed.value = Math.sin(Math.min(1, travel.t) * Math.PI);
    cam.position.lerpVectors(travel.v0.pos, travel.v1.pos, k); cam.position.y += Math.sin(k * Math.PI) * (travel.peak - lerp(travel.v0.pos.y, travel.v1.pos.y, k));
    camState.look.lerpVectors(travel.v0.look, travel.v1.look, k);
    if (cam.position.y < groundAt(cam.position.x, cam.position.z) + 5) cam.position.y = groundAt(cam.position.x, cam.position.z) + 5;
    if (travel.t >= 1) travel = null;
  } else {
    dustU.uSpeed.value *= .9; camState.idle += dt; if (!down && camState.idle > 3 && !RM) camState.ty += dt * .04;
    camState.yaw = lerp(camState.yaw, camState.ty, .07); camState.pitch = lerp(camState.pitch, camState.tp, .07);
    const v = vantage(cur, camState.yaw, camState.pitch);
    intro.t = Math.min(1, intro.t + dt / 2.4); const ik = intro.t < 1 ? .03 + intro.t * .05 : .1;
    cam.position.lerp(v.pos, ik); camState.look.lerp(v.look, .1);
  }
  cam.lookAt(camState.look); nearU.uCam.value.copy(cam.position); updateClouds(t);
  // ride battle
  rebuildGrid(); for (const c of battle) stepCycle(c, dt);
  rebuildWalls(t); updateCubes(t, dt);
  // home base
  dashBike.bike.rotation.y = t * .3; platform.rotation.y = t * .3;
  const anyOver = PART_KEYS.some(k => PART[k].status === 'over'); rimMat.color.copy(anyOver ? RD : CY).multiplyScalar(anyOver ? 1.6 + Math.sin(t * 5) * 1.2 : 2);
  if (ringPick >= 0) { if (t - ringPickT < 2.5) paintRing(ringPick, Math.sin((t - ringPickT) * 18) > 0); else { paintRing(); ringPick = -1; } }
  odo.lookAt(cam.position.x, odo.getWorldPosition(v3).y, cam.position.z); tiles.forEach(tl => tl.lab.lookAt(cam.position.x, tl.lab.getWorldPosition(v3).y, cam.position.z));
  for (const p of panels) { p.m.position.y = p.p.pos.y + Math.sin(t * 1.2 + p.ph) * .12; p.m.lookAt(cam.position.x, p.m.getWorldPosition(v3).y, cam.position.z); }
  // hangar
  ex = lerp(ex, exT, .05); const e = ease(Math.min(1, Math.max(0, ex)));
  flicker(bigBike, t); flicker(dashBike, t);
  for (const p of Object.values(bigBike.parts)) { p.position.copy(p.userData.ex).multiplyScalar(e * 1.1); p.position.x += p.userData.jx || 0; }
  for (const p of Object.values(dashBike.parts)) p.position.x = p.userData.jx || 0;
  bigBike.bike.rotation.y = .3 + Math.sin(t * .25) * .3 * (1 - e) + e * .35;
  updateBuild(bigBike, t); updateBuild(dashBike, t);
  { const k = (t - pulseAt) / 1.2; turntable.scale.setScalar(k < 1 ? 1 + Math.sin(k * Math.PI) * .35 : 1); turntable.material.color.copy(CY).multiplyScalar(k < 1 ? 2 + (1 - k) * 3 : 2); }
  // depot
  updateTank(t); fuelPanel.position.y = 7.4 + Math.sin(t * 1.1) * .12; fuelPanel.lookAt(cam.position.x, fuelPanel.getWorldPosition(v3).y, cam.position.z);
  // control deck
  tiles.forEach((tl, i) => { tl.ty = i === tileSel ? 1 : 0; tl.y = lerp(tl.y, tl.ty, .12); tl.g.position.y = DECK_Y + tl.y * 1.1; tl.edgeM.color.copy(CY).multiplyScalar(1.5 + tl.y * 2 + (i === tileSel ? Math.sin(t * 6) * .4 : 0)); });
  pillars.forEach((p, i) => { const f = lerp(p.fill.scale.y / p.H, cur === 4 && !travel ? p.frac : .02, .04); p.fill.scale.y = Math.max(.01, f * p.H); p.fill.position.y = p.fill.scale.y / 2 + .05;
    if (p.soon) p.fill.material.color.copy(AM).multiplyScalar(1.6 + Math.sin(t * 4) * .7); p.lab.lookAt(cam.position.x, p.lab.getWorldPosition(v3).y, cam.position.z); });
  medals.forEach(m => { m.g.rotation.y = Math.sin(t * .9 + m.ph) * .7; m.g.position.y += Math.sin(t * 1.3 + m.ph) * .004; });
  spirals.forEach((g, i) => g.rotation.y = t * (i % 2 ? -.12 : .1)); slabs.forEach((g, i) => { g.rotation.y += .0006 * (i % 2 ? 1 : -1); g.position.y += Math.sin(t * .5 + i) * .01; });
  // service tags (hangar only)
  const showTags = cur === 2 && !travel && !swapping;
  for (const l of labels) {
    if (!showTags) { l.el.style.opacity = 0; continue; }
    v3.copy(l.a); bigBike.parts[l.k].localToWorld(v3); v3.project(cam);
    const x = (v3.x * .5 + .5) * innerWidth, y = (-v3.y * .5 + .5) * innerHeight, w = l.el.offsetWidth, flip = x > innerWidth * .55;
    l.el.style.flexDirection = flip ? 'row-reverse' : 'row'; l.pos = [flip ? x - w + 4 : x - 4, y - 6]; l.el.style.transform = `translate(${l.pos[0]}px,${l.pos[1]}px)`;
    const key = PART[l.k].status !== 'ok' || l.k === 'oil'; l.el.style.opacity = v3.z < 1 && y > innerHeight * .24 && y < innerHeight * .7 && (e > .6 || key) ? 1 : 0;
  }
  { const vis = labels.filter(l => l.el.style.opacity === '1' && l.pos).map(l => ({ l, x: l.pos[0], y: l.pos[1], w: l.el.offsetWidth })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < vis.length; i++) for (let j = 0; j < i; j++) { const a = vis[j], b = vis[i]; if (Math.abs(a.y - b.y) < 22 && a.x < b.x + b.w && b.x < a.x + a.w) { b.y = a.y + 22; b.l.el.style.transform = `translate(${b.x}px,${b.y}px)`; } } }
  composer.render();
}
startBuild(dashBike); startBuild(bigBike); frame();
/* ============ the API the app uses ============ */
Object.assign(API, { BIKE_TYPES,
  go(i) { if (i === cur && !travel) return false; startTravel(i); return true; },
  setBike(type, instant) { if (instant) { if (type === bikeType) return; bikeType = type; base.remove(dashBike.bike); hangar.remove(bigBike.bike);
      dashBike = makeBike(type, statusOf); dashBike.bike.scale.setScalar(3.6); dashBike.bike.position.set(0, PLAT_Y + .02, 0); base.add(dashBike.bike);
      bigBike = makeBike(type, statusOf); bigBike.bike.scale.setScalar(5); bigBike.bike.position.set(0, .1, 0); hangar.add(bigBike.bike); buildTags(); buildTank(type); startBuild(dashBike); startBuild(bigBike); return; }
    setBike(type); },
  update(view, parts, riders) {
    VIEW = view; const prevStatus = PART_KEYS.map(k => PART[k] && PART[k].status).join();
    PART = parts; paintRing(); panels.forEach(p => p.L.redraw()); odoL2.redraw(); fuelL.redraw();
    buildPillars(); buildMedals(); setRiders(riders);
    if (prevStatus !== PART_KEYS.map(k => PART[k].status).join()) { buildTags(); for (const bk of [bigBike, dashBike]) for (const [k, p] of Object.entries(bk.parts)) { if (!p.userData.m) continue; const c = partCol2(k); p.userData.m.h.uniforms.uC.value = c; p.userData.m.e.color.copy(c).multiplyScalar(1.15); } }
  },
  closeTile() { tileSel = -1; },
  rebuild() { rebuild(null); },
  explode(v) { exT = v; },
  debug: { crash() { const c = battle.find(x => x.alive); if (c) derez(c); }, get derez() { return derezCount; } }
});
Object.defineProperties(API, { place: { get: () => cur }, busy: { get: () => !!travel }, kills: { get: () => battle.map(b => b.kills) } });
function partCol2(k) { const s = (PART[k] || {}).status; return (s === 'soon' ? AM : s === 'over' ? RD : CY).clone(); }
return API;

})();
