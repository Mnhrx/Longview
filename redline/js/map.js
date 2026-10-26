/* Redline ride map: your rides as light trails over Singapore and southern Johor, drawn into a card.
   Plain 2D canvas. It animates only while trails draw in, then sits still. */
window.MAP = (() => {
const GEO = {"sg":[[[103.96,1.3903],[103.9852,1.3852],[103.9996,1.3801],[104.0032,1.3734],[103.9924,1.3548],[103.9744,1.3345],[103.9528,1.3176],[103.9312,1.3109],[103.906,1.3092],[103.888,1.3008],[103.852,1.2771],[103.8484,1.2721],[103.8448,1.2687],[103.8376,1.267],[103.8268,1.2636],[103.8016,1.2653],[103.7908,1.2687],[103.7836,1.2737],[103.7764,1.2873],[103.7548,1.2974],[103.7296,1.3025],[103.708,1.3058],[103.6648,1.3041],[103.6468,1.3092],[103.6396,1.3227],[103.6432,1.3379],[103.6756,1.3801],[103.6792,1.3987],[103.6828,1.4105],[103.6936,1.4207],[103.708,1.4291],[103.7188,1.4308],[103.7404,1.4274],[103.762,1.4308],[103.7908,1.4443],[103.8052,1.4494],[103.8304,1.4477],[103.8556,1.4392],[103.9312,1.4004],[103.96,1.3903]]],"my":[[[103.9528,2.3088],[103.9564,2.2987],[103.9636,2.2869],[103.9816,2.2649],[103.9852,2.2531],[103.9816,2.2447],[103.9708,2.2244],[103.9708,2.2126],[103.978,2.1923],[104.0248,2.1349],[104.05,2.0724],[104.068,2.0471],[104.0788,2.0218],[104.086,2.0117],[104.1076,1.9863],[104.1112,1.9762],[104.122,1.9542],[104.122,1.934],[104.1184,1.8918],[104.1256,1.8698],[104.1364,1.8495],[104.1508,1.8377],[104.1616,1.8479],[104.1688,1.8479],[104.194,1.7989],[104.2048,1.7533],[104.2228,1.7263],[104.2264,1.7128],[104.23,1.679],[104.2336,1.6638],[104.248,1.6503],[104.2552,1.6385],[104.2516,1.6267],[104.2552,1.6131],[104.2624,1.5726],[104.284,1.5169],[104.2948,1.4713],[104.2948,1.446],[104.2876,1.4358],[104.2804,1.4257],[104.284,1.3818],[104.2768,1.3666],[104.2408,1.3666],[104.2336,1.3632],[104.2228,1.3497],[104.2192,1.3464],[104.1724,1.348],[104.1544,1.3531],[104.1148,1.3683],[104.1076,1.3751],[104.104,1.3852],[104.1076,1.4038],[104.1004,1.419],[104.0896,1.4291],[104.0752,1.4392],[104.0644,1.4494],[104.0608,1.4848],[104.086,1.5034],[104.122,1.5169],[104.1472,1.5456],[104.1292,1.549],[104.1112,1.5456],[104.0932,1.5355],[104.0608,1.5101],[104.0536,1.5068],[104.05,1.5135],[104.0428,1.5304],[104.0104,1.5963],[103.9888,1.6317],[103.9672,1.6486],[103.96,1.6351],[103.9708,1.6081],[104.0068,1.549],[104.0068,1.5355],[104.0032,1.5068],[104.0068,1.4933],[104.0104,1.4798],[104.014,1.4646],[104.0104,1.4494],[103.9744,1.4207],[103.9276,1.4325],[103.8412,1.4764],[103.816,1.4747],[103.7728,1.4544],[103.7548,1.4494],[103.7116,1.4527],[103.6972,1.451],[103.6828,1.4426],[103.6288,1.3767],[103.6,1.3531],[103.564,1.3599],[103.564,1.3649],[103.5568,1.3751],[103.5496,1.3818],[103.5424,1.3767],[103.546,1.3666],[103.5496,1.3514],[103.5496,1.343],[103.5496,1.3312],[103.5316,1.3058],[103.5172,1.2704],[103.5028,1.2906],[103.4704,1.3193],[103.456,1.3396],[103.4452,1.3599],[103.4128,1.4679],[103.3948,1.5068],[103.366,1.5389],[103.3264,1.5659],[103.2076,1.6098],[103.0384,1.7162],[102.9952,1.7347],[102.9736,1.7415],[102.952,1.7432],[102.934,1.7482],[102.9232,1.7584],[102.9052,1.7837],[102.8872,1.8073],[102.8872,3.2],[103.9528,3.2]]],"id":[[[103.6684,0.8398],[103.7044,0.8145],[103.7188,0.7976],[103.726,0.7807],[103.726,0.7672],[103.7116,0.7621],[103.7008,0.7655],[103.6936,0.7739],[103.69,0.7908],[103.6648,0.8229],[103.6684,0.8398]],[[103.4632,0.9191],[103.474,0.909],[103.4812,0.8938],[103.4776,0.8786],[103.4704,0.8702],[103.4596,0.8702],[103.4452,0.8736],[103.4344,0.8803],[103.4272,0.8904],[103.42,0.8972],[103.4092,0.9039],[103.4056,0.9107],[103.4524,0.9208],[103.4632,0.9191]],[[103.5172,0.8178],[103.5244,0.8077],[103.5244,0.7993],[103.5244,0.7773],[103.492,0.8212],[103.4776,0.833],[103.4416,0.8448],[103.4272,0.855],[103.42,0.8736],[103.4308,0.8685],[103.4884,0.8448],[103.4956,0.8398],[103.5064,0.8347],[103.5136,0.8263],[103.5172,0.8178]],[[103.8196,0.8871],[103.8628,0.8769],[103.8988,0.8533],[103.924,0.8229],[103.942,0.7908],[103.942,0.7756],[103.9312,0.7705],[103.9204,0.7722],[103.9096,0.7807],[103.8952,0.8111],[103.888,0.8178],[103.852,0.8347],[103.8448,0.8432],[103.8412,0.8499],[103.8196,0.8803],[103.8196,0.8871]],[[103.4884,0.7773],[103.5028,0.7638],[103.5064,0.7554],[103.51,0.7435],[103.4812,0.6844],[103.4596,0.6574],[103.4344,0.6473],[103.4164,0.6574],[103.402,0.6777],[103.3948,0.6996],[103.384,0.7081],[103.3444,0.7638],[103.3408,0.7841],[103.3372,0.8043],[103.3408,0.8178],[103.3516,0.8398],[103.3588,0.8719],[103.3696,0.8854],[103.384,0.8887],[103.402,0.8803],[103.4092,0.8651],[103.4164,0.8465],[103.4272,0.8313],[103.4596,0.8212],[103.4704,0.8077],[103.4884,0.7773]],[[103.8016,0.8533],[103.816,0.8415],[103.8304,0.8161],[103.8412,0.7891],[103.8376,0.7689],[103.834,0.7655],[103.8268,0.7655],[103.8196,0.7689],[103.8016,0.7841],[103.7656,0.8043],[103.7476,0.8229],[103.7296,0.8482],[103.726,0.8736],[103.744,0.8938],[103.7512,0.8887],[103.7692,0.8837],[103.7764,0.8803],[103.8016,0.8533]],[[103.942,0.9968],[103.9528,0.9884],[103.96,0.9749],[103.9672,0.9597],[103.9672,0.9478],[103.96,0.9394],[103.9456,0.936],[103.9312,0.9343],[103.9204,0.9343],[103.9096,0.9377],[103.8556,0.9681],[103.8448,0.9782],[103.8412,0.9901],[103.8376,1.0036],[103.8448,1.012],[103.8556,1.0137],[103.8736,1.0036],[103.8736,1.012],[103.8808,1.0323],[103.8916,1.0137],[103.9096,1.0053],[103.942,0.9968]],[[103.4416,1.012],[103.4452,1.0069],[103.4452,1.0002],[103.4416,0.9951],[103.438,0.9918],[103.4236,0.9901],[103.4092,0.9951],[103.3804,1.0103],[103.3588,1.0053],[103.3408,1.0188],[103.3156,1.061],[103.3156,1.0728],[103.3228,1.0931],[103.3336,1.1116],[103.3408,1.1201],[103.348,1.1218],[103.366,1.1319],[103.3768,1.1336],[103.3912,1.1302],[103.3912,1.1218],[103.3876,1.1116],[103.3876,1.0998],[103.3948,1.0762],[103.3984,1.0644],[103.4056,1.0542],[103.4092,1.0509],[103.4236,1.0492],[103.4272,1.0475],[103.4308,1.0424],[103.4308,1.0373],[103.4308,1.034],[103.4308,1.0289],[103.4344,1.0238],[103.4416,1.0171],[103.4416,1.012]],[[104.1472,1.1606],[104.1508,1.1403],[104.1508,1.1201],[104.1328,1.0492],[104.122,1.0492],[104.1076,1.0644],[104.104,1.0576],[104.104,1.0509],[104.1076,1.0458],[104.1112,1.0373],[104.104,1.034],[104.1004,1.0272],[104.0968,1.0188],[104.0932,1.0103],[104.0932,1.0053],[104.0932,0.9934],[104.0932,0.9901],[104.0896,0.9884],[104.0752,0.9901],[104.0716,0.9901],[104.05,0.985],[104.032,0.9901],[103.996,1.0103],[103.9888,1.0103],[103.9672,1.0086],[103.9564,1.0103],[103.9492,1.0137],[103.9168,1.0509],[103.906,1.0711],[103.9024,1.0897],[103.9132,1.0998],[103.924,1.0964],[103.9384,1.0796],[103.9492,1.0779],[103.9564,1.0846],[103.9564,1.0931],[103.9528,1.1032],[103.9456,1.1251],[103.942,1.1302],[103.9456,1.1353],[103.9564,1.1403],[103.9672,1.142],[103.9888,1.1336],[103.996,1.1336],[104.0104,1.1454],[104.0176,1.1792],[104.032,1.1876],[104.0428,1.1809],[104.0716,1.1454],[104.086,1.1336],[104.0932,1.1454],[104.0932,1.1589],[104.086,1.1707],[104.0788,1.1809],[104.0896,1.1876],[104.104,1.1893],[104.1148,1.1876],[104.1292,1.1809],[104.1364,1.1724],[104.1436,1.1657],[104.1472,1.1606]],[[104.6548,1.0964],[104.6548,1.0796],[104.6692,1.0306],[104.6512,1.0086],[104.6476,0.9968],[104.6548,0.9766],[104.6548,0.9478],[104.6584,0.9411],[104.662,0.9377],[104.6584,0.9276],[104.6512,0.9191],[104.6368,0.9141],[104.6224,0.9124],[104.6152,0.9056],[104.6152,0.8972],[104.6116,0.8837],[104.6008,0.8347],[104.5684,0.8296],[104.482,0.8584],[104.4892,0.8752],[104.482,0.8938],[104.4712,0.9073],[104.4496,0.9141],[104.4496,0.9208],[104.4748,0.9208],[104.4856,0.9225],[104.4892,0.9276],[104.4856,0.9377],[104.4748,0.9394],[104.4496,0.9411],[104.428,0.9495],[104.4208,0.9563],[104.4208,0.9681],[104.428,0.9749],[104.464,0.9833],[104.4568,0.9934],[104.4568,1.0019],[104.464,1.0171],[104.4676,1.0188],[104.4784,1.0255],[104.4856,1.034],[104.4712,1.0373],[104.4676,1.0407],[104.4568,1.0542],[104.4532,1.0576],[104.4388,1.0576],[104.4316,1.0542],[104.3848,1.0306],[104.3704,1.0255],[104.3488,1.0238],[104.3416,1.0205],[104.3272,1.0069],[104.3164,1.0036],[104.2804,1.0019],[104.2696,1.0036],[104.2444,1.0171],[104.2408,1.0357],[104.2408,1.0559],[104.2336,1.0762],[104.2336,1.0931],[104.2552,1.1083],[104.3056,1.1268],[104.3164,1.1336],[104.3236,1.1387],[104.3308,1.1539],[104.338,1.1657],[104.338,1.1741],[104.3416,1.1792],[104.356,1.1809],[104.3776,1.1758],[104.3884,1.1792],[104.3956,1.191],[104.3992,1.2028],[104.4136,1.2011],[104.4352,1.1876],[104.4748,1.1775],[104.5072,1.1792],[104.5396,1.191],[104.572,1.2096],[104.5684,1.2197],[104.5756,1.2248],[104.5864,1.2197],[104.5936,1.1994],[104.5864,1.1623],[104.5864,1.1454],[104.6008,1.1268],[104.6476,1.1049],[104.6548,1.0964]],[[104.2264,0.8803],[104.2408,0.8769],[104.2588,0.8685],[104.266,0.8567],[104.2588,0.8398],[104.2516,0.8296],[104.2408,0.8229],[104.1868,0.7993],[104.176,0.7993],[104.1688,0.8043],[104.1616,0.8195],[104.1544,0.8465],[104.1472,0.8584],[104.1328,0.8668],[104.1076,0.8736],[104.0932,0.8803],[104.1004,0.8955],[104.0932,0.9327],[104.1004,0.9495],[104.1112,0.9529],[104.1292,0.9428],[104.158,0.9107],[104.1616,0.9023],[104.1652,0.8921],[104.1724,0.8837],[104.1832,0.8803],[104.2264,0.8803]]]};
const K = Math.cos(1.35 * Math.PI / 180); // squash longitude so the island isn't stretched
const SG = [103.6, 1.21, 104.06, 1.48];
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
let cv = null, g = null, W = 0, H = 0, DPR = 1, cam = null, home = null, rides = [], focus = null, drawIn = 1, raf = 0, last = 0;
let fly = null, vel = null, dot = null, moved = false;
const px = (lo, la) => [(lo - cam.x) * K * cam.z + W / 2, (cam.y - la) * cam.z + H / 2];
const unpx = (x, y) => [(x - W / 2) / (K * cam.z) + cam.x, cam.y - (y - H / 2) / cam.z];
function boundsOf(list, withSG) {
  let b = null; for (const r of list) for (const [la, lo] of r.path || []) { if (!b) b = [lo, la, lo, la]; b = [Math.min(b[0], lo), Math.min(b[1], la), Math.max(b[2], lo), Math.max(b[3], la)]; }
  if (!b) return SG; if (!withSG) { const p = .01; return [b[0] - p, b[1] - p, b[2] + p, b[3] + p]; }
  return [Math.min(b[0], SG[0]), Math.min(b[1], SG[1]), Math.max(b[2], SG[2]), Math.max(b[3], SG[3])];
}
function fit(b, pad = 18, w = W, h = H) { const z = Math.min((w - pad * 2) / ((b[2] - b[0]) * K), (h - pad * 2) / (b[3] - b[1])); return { x: (b[0] + b[2]) / 2, y: (b[1] + b[3]) / 2, z }; }
function poly(r) { g.beginPath(); r.forEach(([lo, la], i) => { const [x, y] = px(lo, la); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); }
function label(t, lo, la, a) { const [x, y] = px(lo, la); g.font = '700 10px "Bricolage Grotesque",system-ui,sans-serif'; g.fillStyle = `rgba(246,235,221,${a})`; g.textAlign = 'center'; g.fillText(t, x, y); }
function land() {
  g.fillStyle = '#0F0C12'; g.fillRect(0, 0, W, H);
  for (const set of [GEO.my, GEO.id, GEO.sg]) for (const r of set) { poly(r); g.fillStyle = set === GEO.sg ? '#2A2330' : '#211B26'; g.fill(); g.strokeStyle = set === GEO.sg ? 'rgba(246,235,221,.18)' : 'rgba(246,235,221,.08)'; g.lineWidth = 1; g.stroke(); }
  label('SINGAPORE', 103.82, 1.30, .22); label('JOHOR BAHRU', 103.74, 1.53, .16);
}
// OneMap's night street map under the trails (roads, expressways, names). Tiles are Web Mercator; this close to the
// equator that's almost exactly the same as our flat map, so each tile is simply stretched onto its corners.
const TILE = 'https://www.onemap.gov.sg/maps/tiles/Night/{z}/{x}/{y}.png', tiles = new Map(); let tilesOK = 0;
const tLon = (x, z) => x / 2 ** z * 360 - 180, tLat = (y, z) => Math.atan(Math.sinh(Math.PI * (1 - 2 * y / 2 ** z))) * 180 / Math.PI;
function tileImg(z, x, y) { const k = z + '/' + x + '/' + y; let t = tiles.get(k);
  if (!t) { t = new Image(); t.onload = () => { t.ok = 1; tilesOK++; tick(); }; t.onerror = () => { t.bad = 1; }; t.src = TILE.replace('{z}', z).replace('{x}', x).replace('{y}', y); tiles.set(k, t); if (tiles.size > 400) tiles.delete(tiles.keys().next().value); }
  return t; }
function streetMap() {
  if (window.PREVIEW_NOTILES) return false;
  const z = Math.max(10, Math.min(18, Math.round(Math.log2(K * cam.z * 360 / 256 * Math.min(DPR, 1.5))))), n = 2 ** z;
  const [lo0, la0] = unpx(0, 0), [lo1, la1] = unpx(W, H);
  const x0 = Math.floor((lo0 + 180) / 360 * n), x1 = Math.floor((lo1 + 180) / 360 * n);
  const yOf = la => { const r = la * Math.PI / 180; return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n); };
  const y0 = yOf(la0), y1 = yOf(la1); if ((x1 - x0 + 1) * (y1 - y0 + 1) > 60) return false;
  let drew = 0;
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) { let t = tileImg(z, x, y), zz = z, sx = 0, sy = 0, sw = 256;
    // while a sharp tile loads, stretch its parent so the map never goes blank
    if (!t.ok) { const p = tiles.get((z - 1) + '/' + (x >> 1) + '/' + (y >> 1)); if (p && p.ok) { t = p; zz = z - 1; sx = (x & 1) * 128; sy = (y & 1) * 128; sw = 128; } else continue; }
    const [ax, ay] = px(tLon(x, z), tLat(y, z)), [bx, by] = px(tLon(x + 1, z), tLat(y + 1, z));
    g.drawImage(t, sx, sy, sw, sw, ax, ay, bx - ax + .5, by - ay + .5); drew++; }
  if (drew) { g.fillStyle = 'rgba(15,12,18,.28)'; g.fillRect(0, 0, W, H); } // dim it a touch so the trails stay the star
  return drew > 0;
}
const KC = { gps: '69,224,162', pick: '90,184,255', guess: '255,176,32', typed: '181,171,186' };
function trail(r, a, hot) {
  const p = r.path; if (!p || p.length < 2) return; const n = Math.max(2, Math.ceil(p.length * drawIn));
  const path = () => { g.beginPath(); for (let i = 0; i < n; i++) { const [x, y] = px(p[i][1], p[i][0]); i ? g.lineTo(x, y) : g.moveTo(x, y); } };
  g.lineCap = 'round'; g.lineJoin = 'round';
  // colour by where the line came from: green = real GPS, blue = road you picked, amber = Redline's guess (dashed), grey = typed in
  const c = KC[r.kind] || KC.pick;
  path(); g.strokeStyle = `rgba(${c},${.14 * a})`; g.lineWidth = hot ? 12 : 8; g.stroke();
  path(); g.strokeStyle = `rgba(${c},${.32 * a})`; g.lineWidth = hot ? 4.5 : 3; g.stroke();
  if (r.kind === 'guess') g.setLineDash(hot ? [7, 6] : [5, 5]);
  const op = g.globalCompositeOperation; g.globalCompositeOperation = 'source-over'; // keep the core its true colour (adding light would turn it white)
  path(); g.strokeStyle = `rgba(${c},${hot ? 1 : .9 * a})`; g.lineWidth = hot ? 2.6 : 1.6; g.stroke(); g.setLineDash([]); g.globalCompositeOperation = op;
  // the real GPS points OwnTracks sent, as small dots on the focused ride
  if (hot && r.gps && drawIn >= 1) for (const q of r.gps) { const [x, y] = px(q[1], q[0]); g.fillStyle = 'rgba(69,224,162,.95)'; g.beginPath(); g.arc(x, y, 2.6, 0, 7); g.fill(); }
  if (hot) for (const q of [p[0], p[p.length - 1]]) { const [x, y] = px(q[1], q[0]); g.fillStyle = '#FFF8F0'; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
}
// a point a fraction of the way along a path (by distance)
function along(p, f) {
  let tot = 0; const d = [0]; for (let i = 1; i < p.length; i++) { tot += Math.hypot((p[i][1] - p[i - 1][1]) * K, p[i][0] - p[i - 1][0]); d.push(tot); }
  const t = f * tot; let i = 1; while (i < p.length - 1 && d[i] < t) i++; const k = (t - d[i - 1]) / ((d[i] - d[i - 1]) || 1);
  return [p[i - 1][0] + (p[i][0] - p[i - 1][0]) * k, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * k];
}
function draw() {
  if (!cv) return; g.setTransform(DPR, 0, 0, DPR, 0, 0); g.globalCompositeOperation = 'source-over';
  land(); streetMap();
  g.globalCompositeOperation = 'lighter';
  const now = Date.now();
  // one ride tapped: only that ride shows, so overlapping trails don't confuse it
  if (!focus) for (const r of rides) trail(r, Math.max(.4, 1 - (now - r.t) / 864e5 / 120), false);
  const f = focus && rides.find(r => r.id === focus); if (f) trail(f, 1, true);
  g.globalCompositeOperation = 'source-over';
  // the rider: a glowing dot that rides the focused trail once the camera lands
  if (f && dot && dot.t >= 0) { const k = Math.min(1, dot.t); const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    for (let i = 6; i >= 0; i--) { const q = along(f.path, Math.max(0, e - i * .012)); const [x, y] = px(q[1], q[0]); g.fillStyle = `rgba(255,106,43,${i ? .5 * (1 - i / 7) : 1})`; g.beginPath(); g.arc(x, y, i ? 5 - i * .4 : 6.5, 0, 7); g.fill(); }
    const q = along(f.path, e), [x, y] = px(q[1], q[0]); g.strokeStyle = '#FFF8F0'; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, 7.5, 0, 7); g.stroke(); }
}
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
function tick() { if (!raf) raf = requestAnimationFrame(frame); }
function frame(now) {
  raf = 0; const dt = Math.min(.05, (now - (last || now)) / 1000); last = now; let busy = false;
  if (drawIn < 1) { drawIn = Math.min(1, drawIn + dt / 1.3); busy = true; }
  if (fly) { // fly-to: pan in a straight line, zoom out mid-way then in (like a map app)
    fly.t = Math.min(1, fly.t + dt / fly.dur); const e = ease(fly.t), a = fly.a, b = fly.b;
    const lz = Math.log(a.z) + (Math.log(b.z) - Math.log(a.z)) * e - fly.dip * Math.sin(Math.PI * e);
    cam = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, z: Math.exp(lz) };
    if (fly.t >= 1) { cam = b; fly = null; if (focus && !RM) dot = { t: 0 }; } busy = true; }
  if (vel) { cam.x -= vel.x * dt / (K * cam.z); cam.y += vel.y * dt / cam.z; vel.x *= Math.pow(.015, dt); vel.y *= Math.pow(.015, dt); if (Math.hypot(vel.x, vel.y) < 8) vel = null; else busy = true; }
  if (dot && dot.t < 1) { dot.t = Math.min(1, dot.t + dt / 2.6); busy = true; }
  clampCam(); draw(); if (busy) tick(); else last = 0;
}
// never let the map wander off Singapore and southern Johor
function clampCam() { if (!cam) return; cam.x = Math.min(104.15, Math.max(103.5, cam.x)); cam.y = Math.min(1.65, Math.max(1.15, cam.y)); }
// a tapped ride is framed in the space between the month label (top) and the ride card (bottom)
function target() { if (!focus) return fit(boundsOf(rides, true), 16);
  const top = 66, bot = 108, c = fit(boundsOf(rides.filter(r => r.id === focus), false), 10, W, Math.max(80, H - top - bot)); c.y -= ((bot - top) / 2) / c.z; return c; }
function flyTo(b) {
  if (!cam || RM) { cam = b; draw(); return; }
  const span = Math.hypot((b.x - cam.x) * K, b.y - cam.y) * Math.min(cam.z, b.z) / Math.max(W, 1);
  fly = { a: { ...cam }, b, t: 0, dur: .75 + Math.min(.5, span * .6), dip: Math.min(.7, span * .9) }; vel = null; dot = null; tick();
}
function size() { if (!cv) return; DPR = Math.min(devicePixelRatio || 1, 2); const r = cv.getBoundingClientRect(); W = r.width; H = r.height; cv.width = W * DPR; cv.height = H * DPR; cam = target(); home = cam; draw(); }
addEventListener('resize', size);
function setMoved(v) { if (moved === v) return; moved = v; cv && cv.dispatchEvent(new CustomEvent('mapmoved', { bubbles: true, detail: v })); }
// drag with one finger (sideways first, so the page can still scroll), pinch and pan with two, double-tap to zoom
function gestures(c) {
  const pts = new Map(); let start = null, lastMove = null, lastTap = 0;
  const snap = () => { const a = [...pts.values()]; const cx = a.reduce((s, p) => s + p.x, 0) / a.length, cy = a.reduce((s, p) => s + p.y, 0) / a.length; const d = a.length > 1 ? Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) : 0; return { cx, cy, d, cam: { ...cam } }; };
  c.addEventListener('pointerdown', e => { const r = c.getBoundingClientRect(); pts.set(e.pointerId, { x: e.clientX - r.left, y: e.clientY - r.top }); start = snap(); fly = null; vel = null; lastMove = { t: performance.now(), x: start.cx, y: start.cy, vx: 0, vy: 0 };
    if (e.pointerType !== 'touch') c.setPointerCapture(e.pointerId); });
  c.addEventListener('pointermove', e => { if (!pts.has(e.pointerId) || !start) return; const r = c.getBoundingClientRect(); pts.set(e.pointerId, { x: e.clientX - r.left, y: e.clientY - r.top });
    const s = snap(); if (pts.size !== (start.d ? 2 : 1)) { start = s; return; }
    let z = start.cam.z; if (start.d && s.d) z = Math.min(start.cam.z * 40, Math.max(home.z * .7, start.cam.z * s.d / start.d));
    // keep the point under the fingers fixed
    const [lo0, la0] = (() => { const c0 = cam; cam = start.cam; const v = unpx(start.cx, start.cy); cam = c0; return v; })();
    cam = { x: lo0 - (s.cx - W / 2) / (K * z), y: la0 + (s.cy - H / 2) / z, z };
    const t = performance.now(), dt = Math.max(1, t - lastMove.t); lastMove = { t, x: s.cx, y: s.cy, vx: (s.cx - lastMove.x) / dt * 1000, vy: (s.cy - lastMove.y) / dt * 1000 };
    setMoved(true); clampCam(); draw(); });
  const up = e => { if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId);
    if (!pts.size) { const tap = Math.hypot(lastMove.x - start.cx, lastMove.y - start.cy) < 6 && !start.d; const now = performance.now();
      if (tap && now - lastTap < 300) { const [lo, la] = unpx(lastMove.x, lastMove.y); flyTo({ x: lo, y: la, z: Math.min(cam.z * 2.2, home.z * 40) }); setMoved(true); lastTap = 0; }
      else { if (tap) lastTap = now; if (!RM && performance.now() - lastMove.t < 80 && Math.hypot(lastMove.vx, lastMove.vy) > 60) { const sp = Math.hypot(lastMove.vx, lastMove.vy), cap = Math.min(1, 900 / sp); vel = { x: lastMove.vx * cap, y: lastMove.vy * cap }; tick(); } }
      start = null; } else start = snap(); };
  c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
}
function inPoly(r, lo, la) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > la) !== (yj > la) && lo < (xj - xi) * (la - yi) / (yj - yi) + xi) c = !c; } return c; }
return {
  // attach to a canvas inside a card; animate = draw the trails in
  mount(canvas, animate) { cv = canvas; g = cv.getContext('2d'); moved = false; fly = vel = dot = null; size(); gestures(cv); if (focus) { dot = RM ? null : { t: 0 }; tick(); } if (animate && !RM) { drawIn = 0; tick(); } },
  setRides(list) { rides = list.filter(r => r.path && r.path.length > 1); if (cv) { home = target(); if (!fly && !moved) cam = home; draw(); } },
  focus(id) { focus = id; if (cv) { home = target(); setMoved(false); flyTo(home); } }, get focused() { return focus; },
  recentre() { if (!cv) return; home = target(); setMoved(false); flyTo(home); },
  replay() { if (focus && !RM) { dot = { t: 0 }; tick(); } },
  get tiles() { return tilesOK > 0; },
  inSG: (la, lo) => la < 1.445 || inPoly(GEO.sg[0], lo, la), GEO, K, land: (ctx, w, h, c) => { const s = { g, W, H, cam }; g = ctx; W = w; H = h; cam = c; land(); g = s.g; W = s.W; H = s.H; cam = s.cam; }, fit: (b, pad, w, h) => fit(b, pad, w, h),
};
})();

