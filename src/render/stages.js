// Stage definitions (sim data + procedural visuals).
import * as THREE from 'three';
import { Rng } from '../util.js';

import { STAGES, stageById } from './stagesList.js';
export { STAGES, stageById };

// ------------------------------------------------------------------ helpers
function canvasTexture(w, h, draw, repeat = null) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

const M = {
  std: (color, o = {}) => {
    const p = { color, roughness: o.rough ?? 0.8, metalness: o.metal ?? 0.05, emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1 };
    if (o.map) p.map = o.map;
    if (o.side !== undefined) p.side = o.side;
    return new THREE.MeshStandardMaterial(p);
  },
  basic: (color, o = {}) => {
    const p = { color, transparent: !!o.alpha, opacity: o.alpha ?? 1, fog: o.fog ?? true };
    if (o.side !== undefined) p.side = o.side;
    return new THREE.MeshBasicMaterial(p);
  },
};

function mesh(geo, mat, x = 0, y = 0, z = 0, cast = true, recv = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = recv;
  return m;
}

function skyDome(top, mid, bottom, radius = 120) {
  const g = new THREE.SphereGeometry(radius, 24, 16);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(top) }, mid: { value: new THREE.Color(mid) }, bot: { value: new THREE.Color(bottom) } },
    vertexShader: 'varying vec3 vp; void main(){ vp = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec3 vp; uniform vec3 top; uniform vec3 mid; uniform vec3 bot; void main(){ float h = normalize(vp).y; vec3 c = h > 0.0 ? mix(mid, top, pow(h, 0.55)) : mix(mid, bot, pow(-h, 0.6)); gl_FragColor = vec4(c, 1.0); }',
  });
  return new THREE.Mesh(g, m);
}

function stars(count, radius = 110, rng = new Rng(3)) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const a = rng.next() * Math.PI * 2, e = Math.acos(1 - rng.next() * 0.95);
    pos[i * 3] = Math.sin(e) * Math.cos(a) * radius; pos[i * 3 + 1] = Math.cos(e) * radius; pos[i * 3 + 2] = Math.sin(e) * Math.sin(a) * radius;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.8, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 }));
}

function skyline(rng, n, rMin, rMax, hMin, hMax, glow = [0xffcc66, 0x66ccff, 0xff66aa]) {
  const g = new THREE.Group();
  const winTex = canvasTexture(64, 128, (c, w, h) => {
    c.fillStyle = '#0b0d16'; c.fillRect(0, 0, w, h);
    for (let y = 4; y < h - 4; y += 10) for (let x = 4; x < w - 4; x += 10) {
      if (rng.next() < 0.45) { const cs = ['#ffd27a', '#8fd6ff', '#ffb0d6', '#fff2c8']; c.fillStyle = cs[rng.int(cs.length)]; c.fillRect(x, y, 5, 6); }
    }
  }, [1, 1]);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng.range(-0.05, 0.05), r = rng.range(rMin, rMax);
    const w = rng.range(4, 10), h = rng.range(hMin, hMax), d = rng.range(4, 9);
    const mat = new THREE.MeshStandardMaterial({ color: 0x151826, roughness: 0.9, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: 0.9 });
    const b = mesh(new THREE.BoxGeometry(w, h, d), mat, Math.cos(a) * r, h / 2 - 10, Math.sin(a) * r, false, false);
    b.rotation.y = -a;
    g.add(b);
    if (rng.chance(0.3)) { const s = mesh(new THREE.BoxGeometry(0.4, 3, 0.4), M.basic(glow[rng.int(glow.length)]), Math.cos(a) * r, h - 10 + 1.5, Math.sin(a) * r, false, false); g.add(s); }
  }
  return g;
}

function floorMat(kind) {
  switch (kind) {
    case 'wood': return M.std(0xffffff, { rough: 0.55, map: canvasTexture(512, 512, (c, w, h) => {
      for (let i = 0; i < 12; i++) { const y = i * (h / 12); const s = 120 + (i * 37) % 40; c.fillStyle = `rgb(${s + 40},${s},${s - 40})`; c.fillRect(0, y, w, h / 12 - 2); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, y + h / 12 - 2, w, 2); for (let k = 0; k < 40; k++) { c.fillStyle = 'rgba(60,30,10,0.08)'; c.fillRect(Math.random() * w, y + Math.random() * (h / 12), 40 + Math.random() * 80, 1); } }
    }, [3, 3]) });
    case 'stone': return M.std(0xffffff, { rough: 0.9, map: canvasTexture(512, 512, (c, w, h) => {
      c.fillStyle = '#5b5750'; c.fillRect(0, 0, w, h);
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const s = 70 + Math.random() * 30; c.fillStyle = `rgb(${s + 10},${s + 6},${s})`; c.fillRect(x * 128 + 3, y * 128 + 3, 122, 122); for (let k = 0; k < 40; k++) { c.fillStyle = 'rgba(0,0,0,0.06)'; c.fillRect(x * 128 + Math.random() * 120, y * 128 + Math.random() * 120, 4, 4); } }
    }, [4, 4]) });
    case 'asphalt': return M.std(0xffffff, { rough: 0.35, metal: 0.3, map: canvasTexture(512, 512, (c, w, h) => {
      c.fillStyle = '#1b1c22'; c.fillRect(0, 0, w, h);
      for (let k = 0; k < 900; k++) { const s = 20 + Math.random() * 30; c.fillStyle = `rgb(${s},${s},${s + 4})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
      c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = 3; c.setLineDash([40, 30]); c.beginPath(); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.stroke();
    }, [6, 2]) });
    case 'grid': return M.std(0xffffff, { rough: 0.5, metal: 0.2, map: canvasTexture(256, 256, (c, w, h) => {
      c.fillStyle = '#10151c'; c.fillRect(0, 0, w, h); c.strokeStyle = '#2bd68a'; c.lineWidth = 2; c.strokeRect(1, 1, w - 2, h - 2);
      c.strokeStyle = 'rgba(43,214,138,0.25)'; c.lineWidth = 1; c.beginPath(); c.moveTo(w / 2, 0); c.lineTo(w / 2, h); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.stroke();
    }, [20, 16]) });
    case 'concrete': return M.std(0xffffff, { rough: 0.85, map: canvasTexture(512, 512, (c, w, h) => {
      c.fillStyle = '#3a3d47'; c.fillRect(0, 0, w, h);
      for (let k = 0; k < 1500; k++) { const s = 40 + Math.random() * 40; c.fillStyle = `rgba(${s},${s},${s + 6},0.5)`; c.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
      c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 3; c.strokeRect(0, 0, w, h);
    }, [5, 4]) });
    case 'ice': return M.std(0xffffff, { rough: 0.15, metal: 0.4, map: canvasTexture(512, 512, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#a8dcf0'); g.addColorStop(1, '#7ab3d6'); c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 2; for (let k = 0; k < 18; k++) { c.beginPath(); let x = Math.random() * w, y = Math.random() * h; c.moveTo(x, y); for (let j = 0; j < 5; j++) { x += (Math.random() - 0.5) * 120; y += (Math.random() - 0.5) * 120; c.lineTo(x, y); } c.stroke(); }
    }, [3, 3]) });
    case 'basalt': return M.std(0xffffff, { rough: 0.85, map: canvasTexture(512, 512, (c, w, h) => {
      c.fillStyle = '#231d1b'; c.fillRect(0, 0, w, h);
      for (let k = 0; k < 500; k++) { const s = 30 + Math.random() * 25; c.fillStyle = `rgb(${s + 8},${s},${s - 4})`; c.beginPath(); c.arc(Math.random() * w, Math.random() * h, 6 + Math.random() * 16, 0, 7); c.fill(); }
      c.strokeStyle = 'rgba(255,90,20,0.55)'; c.lineWidth = 3; for (let k = 0; k < 9; k++) { c.beginPath(); let x = Math.random() * w, y = Math.random() * h; c.moveTo(x, y); for (let j = 0; j < 6; j++) { x += (Math.random() - 0.5) * 90; y += (Math.random() - 0.5) * 90; c.lineTo(x, y); } c.stroke(); }
    }, [2, 2]) });
    case 'canvas': return M.std(0xffffff, { rough: 0.7, map: canvasTexture(512, 512, (c, w, h) => {
      c.fillStyle = '#9a8d78'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(0,0,0,0.05)'; for (let y = 0; y < h; y += 4) c.fillRect(0, y, w, 1);
      c.strokeStyle = '#1b3a8a'; c.lineWidth = 16; c.strokeRect(20, 20, w - 40, h - 40);
    }, [1, 1]) });
    default: return M.std(0x444444);
  }
}

function addFloor(g, shape, kind, r) {
  const mat = floorMat(kind);
  let geo;
  if (shape === 'circle') geo = new THREE.CylinderGeometry(r, r, 0.5, 48);
  else geo = new THREE.BoxGeometry(r[0] * 2, 0.5, r[1] * 2);
  const f = mesh(geo, mat, 0, -0.25, 0, false, true);
  g.add(f);
  return f;
}

function torch(g, x, z, color = 0xff9a3c, y = 1.6) {
  const stick = mesh(new THREE.CylinderGeometry(0.06, 0.09, y, 8), M.std(0x3a2a1c), x, y / 2, z, true, false);
  const flame = mesh(new THREE.SphereGeometry(0.18, 10, 8), M.basic(color), x, y + 0.18, z, false, false);
  flame.scale.set(1, 1.5, 1);
  const light = new THREE.PointLight(color, 9, 9, 1.6); light.position.set(x, y + 0.3, z);
  g.add(stick, flame, light);
  return { flame, light, base: light.intensity };
}

// ------------------------------------------------------------------ builders
const BUILD = {
  rooftop(q) {
    const g = new THREE.Group(); const rng = new Rng(11); const anim = [];
    g.add(skyDome(0x1a1140, 0xd86a9c, 0x0b0a18)); g.add(stars(160));
    addFloor(g, 'rect', 'concrete', [9, 7]);
    // parapet
    const wallM = M.std(0x2c2f3c, { rough: 0.8 });
    for (const [x, z, w, d] of [[0, -7.15, 18.6, 0.5], [0, 7.15, 18.6, 0.5], [-9.15, 0, 0.5, 14], [9.15, 0, 0.5, 14]]) g.add(mesh(new THREE.BoxGeometry(w, 0.9, d), wallM, x, 0.45, z));
    for (const x of [-8, -4, 0, 4, 8]) { const l = mesh(new THREE.BoxGeometry(0.15, 0.15, 0.15), M.basic(0xff5fa2), x, 1.0, -7.15, false, false); g.add(l); }
    g.add(skyline(rng, 60, 40, 90, 20, 90));
    // neon sign
    const sign = mesh(new THREE.BoxGeometry(6, 1.2, 0.2), M.basic(0xff3c8a), 0, 6.5, -12, false, false); g.add(sign); anim.push((t) => { sign.material.color.setHSL(0.93 + Math.sin(t * 0.7) * 0.02, 1, 0.5 + Math.sin(t * 5) * 0.03); });
    const key = new THREE.DirectionalLight(0xffc4dd, 2.2); key.position.set(-6, 10, 8); key.castShadow = true;
    const rim = new THREE.DirectionalLight(0x6fa8ff, 1.6); rim.position.set(6, 6, -8);
    const hemi = new THREE.HemisphereLight(0x9a7cc9, 0x2a2035, 0.9);
    const p1 = new THREE.PointLight(0xff3c8a, 40, 22, 1.5); p1.position.set(0, 6, -10);
    g.add(key, rim, hemi, p1);
    return { group: g, fog: [0x2a1636, 0.012], key, anim, rain: 0.6 };
  },
  dojo(q) {
    const g = new THREE.Group(); const anim = [];
    g.add(skyDome(0x0a1230, 0x27407a, 0x0a0f1a)); g.add(stars(240));
    const moon = mesh(new THREE.SphereGeometry(4, 20, 16), M.basic(0xfdf6d8, { fog: false }), -40, 45, -70, false, false); g.add(moon);
    addFloor(g, 'rect', 'wood', [9, 6.5]);
    // walls with shoji panels
    const shoji = canvasTexture(256, 256, (c, w, h) => { c.fillStyle = '#efe6cf'; c.fillRect(0, 0, w, h); c.strokeStyle = '#5a3d22'; c.lineWidth = 6; for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(i * w / 4, 0); c.lineTo(i * w / 4, h); c.stroke(); c.beginPath(); c.moveTo(0, i * h / 4); c.lineTo(w, i * h / 4); c.stroke(); } });
    const shojiM = M.std(0xffffff, { rough: 0.9, map: shoji, emissive: 0xffe2a8, ei: 0.35 });
    const beamM = M.std(0x4a2e1a, { rough: 0.7 });
    const walls = [], culls = [];
    for (const [x, z, w, d, ry] of [[0, -6.6, 18.4, 0.2, 0], [0, 6.6, 18.4, 0.2, 0], [-9.1, 0, 13.4, 0.2, Math.PI / 2], [9.1, 0, 13.4, 0.2, Math.PI / 2]]) {
      const wl = mesh(new THREE.BoxGeometry(w, 4, d), shojiM, x, 2, z); wl.rotation.y = ry; g.add(wl); walls.push(wl);
      culls.push(z ? { mesh: wl, ax: 'z', dir: Math.sign(z), at: 6.6 } : { mesh: wl, ax: 'x', dir: Math.sign(x), at: 9.1 });
      const top = mesh(new THREE.BoxGeometry(w + 0.4, 0.3, 0.4), beamM, x, 4.1, z); top.rotation.y = ry; g.add(top);
    }
    for (const [x, z] of [[-9.1, -6.6], [9.1, -6.6], [-9.1, 6.6], [9.1, 6.6]]) g.add(mesh(new THREE.BoxGeometry(0.5, 4.2, 0.5), beamM, x, 2.1, z));
    g.add(mesh(new THREE.BoxGeometry(19.5, 0.3, 14.5), beamM, 0, 4.4, 0));
    // ceiling lanterns
    for (const x of [-5, 0, 5]) { const l = mesh(new THREE.SphereGeometry(0.35, 12, 10), M.basic(0xffd9a0), x, 3.4, 0, false, false); g.add(l); }
    const key = new THREE.DirectionalLight(0xffe0b0, 1.8); key.position.set(-5, 10, 7); key.castShadow = true;
    const fill = new THREE.PointLight(0xffd9a0, 22, 24, 1.4); fill.position.set(0, 3.6, 0);
    const hemi = new THREE.HemisphereLight(0xbfd0ff, 0x30241a, 0.75);
    g.add(key, fill, hemi);
    g.userData.walls = walls;
    return { group: g, fog: [0x0f1a33, 0.01], key, anim, walls, culls, phase2: 'garden' };
  },
  garden(q) {
    const g = new THREE.Group(); const anim = [];
    g.add(skyDome(0x0a1230, 0x27407a, 0x0a0f1a)); g.add(stars(240));
    g.add(mesh(new THREE.SphereGeometry(4, 20, 16), M.basic(0xfdf6d8, { fog: false }), -40, 45, -70, false, false));
    const fl = mesh(new THREE.CylinderGeometry(8.2, 8.2, 0.5, 40), floorMat('stone'), 0, -0.25, 0, false, true); g.add(fl);
    g.add(mesh(new THREE.CylinderGeometry(30, 30, 0.2, 40), M.std(0x1c3b24, { rough: 1 }), 0, -0.6, 0, false, true));
    const pond = mesh(new THREE.CylinderGeometry(4, 4, 0.05, 36), M.std(0x1a3550, { rough: 0.05, metal: 0.7 }), -13, -0.45, -8, false, true); g.add(pond);
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; const l = torch(g, Math.cos(a) * 9.2, Math.sin(a) * 9.2, 0xffb45c, 1.2); anim.push((t) => { l.flame.scale.y = 1.4 + Math.sin(t * 11 + i) * 0.2; }); }
    const rng = new Rng(4);
    for (let i = 0; i < 26; i++) { const a = rng.next() * 6.28, r = rng.range(14, 34); const h = rng.range(3, 7); g.add(mesh(new THREE.CylinderGeometry(0.2, 0.3, h, 6), M.std(0x3b2a1a), Math.cos(a) * r, h / 2, Math.sin(a) * r)); g.add(mesh(new THREE.SphereGeometry(rng.range(1.6, 3), 8, 6), M.std(0x1f5a2e, { rough: 0.9 }), Math.cos(a) * r, h + 1, Math.sin(a) * r)); }
    const key = new THREE.DirectionalLight(0xcfe0ff, 2.0); key.position.set(-6, 12, 8); key.castShadow = true;
    const hemi = new THREE.HemisphereLight(0x9fb7ff, 0x1d2b1a, 0.85);
    g.add(key, hemi);
    return { group: g, fog: [0x0f1a33, 0.012], key, anim };
  },
  temple(q) {
    const g = new THREE.Group(); const anim = [];
    g.add(skyDome(0x120b0a, 0x3a1a10, 0x050403));
    addFloor(g, 'circle', 'stone', 8.2);
    // rune ring
    const ring = mesh(new THREE.TorusGeometry(5, 0.05, 6, 64), M.basic(0xffb347), 0, 0.02, 0, false, false); ring.rotation.x = Math.PI / 2; g.add(ring);
    const ring2 = mesh(new THREE.TorusGeometry(3.2, 0.04, 6, 64), M.basic(0xff8a3d), 0, 0.02, 0, false, false); ring2.rotation.x = Math.PI / 2; g.add(ring2);
    anim.push((t) => { ring.material.color.setHSL(0.09, 1, 0.5 + Math.sin(t * 2) * 0.1); });
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2, r = 9;
      const h = 7 + (i % 3);
      g.add(mesh(new THREE.CylinderGeometry(0.7, 0.85, h, 10), M.std(0x6d655a, { rough: 0.9 }), Math.cos(a) * r, h / 2, Math.sin(a) * r));
      g.add(mesh(new THREE.BoxGeometry(1.8, 0.4, 1.8), M.std(0x59524a), Math.cos(a) * r, h + 0.2, Math.sin(a) * r));
      if (i % 2 === 0) { const l = torch(g, Math.cos(a) * 7.6, Math.sin(a) * 7.6, 0xff8a2b, 1.9); anim.push((t) => { l.flame.scale.y = 1.4 + Math.sin(t * 13 + i * 3) * 0.25; l.light.intensity = l.base * (0.85 + 0.15 * Math.sin(t * 17 + i)); }); }
    }
    // low wall
    const lw = mesh(new THREE.CylinderGeometry(8.35, 8.35, 0.9, 48, 1, true), M.std(0x5d564c, { side: THREE.DoubleSide }), 0, 0.45, 0); g.add(lw);
    const key = new THREE.DirectionalLight(0xffb27a, 1.4); key.position.set(-5, 10, 6); key.castShadow = true;
    const hemi = new THREE.HemisphereLight(0x8a6a4a, 0x1a100a, 0.8);
    g.add(key, hemi);
    return { group: g, fog: [0x140a06, 0.03], key, anim, mist: true };
  },
  alley(q) {
    const g = new THREE.Group(); const anim = []; const rng = new Rng(21);
    g.add(skyDome(0x040613, 0x1a1040, 0x020208)); g.add(stars(80));
    addFloor(g, 'rect', 'asphalt', [11, 4.5]);
    // buildings both sides
    const wallM = M.std(0x1a1c2b, { rough: 0.85 });
    const culls = [];
    for (const z of [-4.9, 4.9]) {
      const w = mesh(new THREE.BoxGeometry(24, 14, 0.6), wallM, 0, 7, z * 1.0); g.add(w);
      culls.push({ mesh: w, ax: 'z', dir: Math.sign(z), at: 4.9 });
    }
    for (const x of [-11.2, 11.2]) { const w = mesh(new THREE.BoxGeometry(0.6, 14, 10), wallM, x, 7, 0); g.add(w); culls.push({ mesh: w, ax: 'x', dir: Math.sign(x), at: 11.2 }); }
    const cols = [0xff3c8a, 0x31e6ff, 0xffd23f, 0x9b5cff, 0x3cff9a];
    for (let i = 0; i < 12; i++) {
      const c = cols[i % cols.length]; const z = i % 2 ? 4.55 : -4.55; const x = -9 + i * 1.65;
      const s = mesh(new THREE.BoxGeometry(1.1, rng.range(1, 2.4), 0.12), M.basic(c), x, rng.range(3, 8), z, false, false);
      g.add(s); const L = new THREE.PointLight(c, 6, 9, 1.6); L.position.set(x, s.position.y, z * 0.85); g.add(L);
      anim.push((t) => { s.material.color.setHex(c); s.material.opacity = 1; s.visible = Math.sin(t * (2 + i) + i * 4) > -0.92; });
    }
    // lamp posts + cover
    for (const x of [-7, 0, 7]) { g.add(mesh(new THREE.CylinderGeometry(0.06, 0.08, 4, 6), M.std(0x222), x, 2, -4.2)); g.add(mesh(new THREE.SphereGeometry(0.25, 8, 6), M.basic(0xfff1c0), x, 4.1, -4.2, false, false)); }
    for (let i = 0; i < 6; i++) g.add(mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), M.std(0x2b2f3e), rng.range(-9, 9), 0.45, rng.pick([-4.3, 4.3]), true, true));
    const key = new THREE.DirectionalLight(0x8aa8ff, 1.5); key.position.set(-4, 10, 8); key.castShadow = true;
    const hemi = new THREE.HemisphereLight(0x6a5aa8, 0x101018, 0.8);
    g.add(key, hemi);
    return { group: g, fog: [0x080a1a, 0.02], key, anim, rain: 1, culls };
  },
  volcano(q) {
    const g = new THREE.Group(); const anim = []; const rng = new Rng(8);
    g.add(skyDome(0x1a0806, 0x7a2410, 0x2a0a04)); g.add(stars(50));
    addFloor(g, 'circle', 'basalt', 8.4);
    const lava = mesh(new THREE.CylinderGeometry(60, 60, 0.2, 48), M.std(0xff5a1a, { emissive: 0xff4a10, ei: 1.6, rough: 0.6 }), 0, -3, 0, false, false); g.add(lava);
    anim.push((t) => { lava.material.emissiveIntensity = 1.4 + Math.sin(t * 1.3) * 0.3; });
    for (let i = 0; i < 16; i++) { const a = i / 16 * 6.28 + rng.next() * 0.3, r = rng.range(15, 45); const h = rng.range(6, 24); g.add(mesh(new THREE.ConeGeometry(rng.range(2, 6), h, 6), M.std(0x2a1c18, { rough: 0.95 }), Math.cos(a) * r, h / 2 - 3, Math.sin(a) * r)); }
    const vol = mesh(new THREE.ConeGeometry(40, 55, 20, 1, true), M.std(0x2a1a14, { side: THREE.DoubleSide, rough: 1 }), -20, 14, -70, false, false); g.add(vol);
    const glow = new THREE.PointLight(0xff5a1a, 90, 40, 1.4); glow.position.set(0, -1, 0); g.add(glow);
    anim.push((t) => { glow.intensity = 80 + Math.sin(t * 2.7) * 14 + Math.sin(t * 7.1) * 6; });
    const key = new THREE.DirectionalLight(0xffa066, 1.7); key.position.set(-5, 10, 7); key.castShadow = true;
    const hemi = new THREE.HemisphereLight(0xff8a5a, 0x2a0e08, 0.9);
    g.add(key, hemi);
    return { group: g, fog: [0x2a0e08, 0.018], key, anim, embers: true };
  },
  ring(q) {
    const g = new THREE.Group(); const anim = []; const rng = new Rng(31);
    g.add(skyDome(0x03040a, 0x0a0f1e, 0x010103));
    // stadium floor
    g.add(mesh(new THREE.CylinderGeometry(40, 40, 0.3, 40), M.std(0x1a1d2b, { rough: 0.9 }), 0, -0.55, 0, false, true));
    // ring canvas + apron
    g.add(mesh(new THREE.BoxGeometry(12.6, 0.6, 12.6), floorMat('canvas'), 0, -0.3, 0, false, true));
    g.add(mesh(new THREE.BoxGeometry(14.2, 0.3, 14.2), M.std(0x8a1414, { rough: 0.8 }), 0, -0.55, 0, false, true));
    // posts and ropes
    const postM = M.std(0xd8d8e0, { rough: 0.3, metal: 0.5 });
    const cols = [0xc81e1e, 0xffffff, 0x1e4ac8];
    for (const [x, z] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) { g.add(mesh(new THREE.CylinderGeometry(0.16, 0.18, 1.9, 10), postM, x, 0.95, z)); g.add(mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), M.std(0xc81e1e), x, 0.5, z)); }
    for (let r = 0; r < 3; r++) {
      const y = 0.55 + r * 0.42; const rm = M.std(cols[r], { rough: 0.6 });
      const r1 = mesh(new THREE.CylinderGeometry(0.045, 0.045, 12, 8), rm, 0, y, -6, false, false); r1.rotation.z = Math.PI / 2; g.add(r1);
      const r2 = mesh(new THREE.CylinderGeometry(0.045, 0.045, 12, 8), rm, 0, y, 6, false, false); r2.rotation.z = Math.PI / 2; g.add(r2);
      const a = mesh(new THREE.CylinderGeometry(0.045, 0.045, 12, 8), rm, -6, y, 0, false, false); a.rotation.x = Math.PI / 2; g.add(a);
      const b = mesh(new THREE.CylinderGeometry(0.045, 0.045, 12, 8), rm, 6, y, 0, false, false); b.rotation.x = Math.PI / 2; g.add(b);
    }
    // crowd rings (instanced)
    const crowd = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.22, 0.5, 4, 8), new THREE.MeshStandardMaterial({ roughness: 0.9 }), 420);
    const dummy = new THREE.Object3D(); const base = []; const c = new THREE.Color();
    let n = 0;
    for (let row = 0; row < 6; row++) {
      const rad = 12 + row * 1.35; const count = Math.floor(rad * 2.1);
      for (let i = 0; i < count && n < 420; i++, n++) {
        const a = i / count * Math.PI * 2; const y = 0.5 + row * 0.75;
        dummy.position.set(Math.cos(a) * rad, y, Math.sin(a) * rad); dummy.rotation.y = -a; dummy.updateMatrix();
        crowd.setMatrixAt(n, dummy.matrix); c.setHSL(rng.next(), 0.5, 0.35 + rng.next() * 0.25); crowd.setColorAt(n, c);
        base.push([Math.cos(a) * rad, y, Math.sin(a) * rad, a, rng.next() * 6.28]);
      }
      g.add(mesh(new THREE.CylinderGeometry(rad + 0.6, rad + 0.6, 0.3, 40, 1, true), M.std(0x20222e, { side: THREE.DoubleSide }), 0, 0.2 + row * 0.75 - 0.5, 0, false, false));
    }
    crowd.count = n; crowd.instanceMatrix.needsUpdate = true; if (crowd.instanceColor) crowd.instanceColor.needsUpdate = true; g.add(crowd);
    anim.push((t, ctx) => {
      const excite = ctx?.excite || 0;
      for (let i = 0; i < n; i++) { const b = base[i]; dummy.position.set(b[0], b[1] + Math.abs(Math.sin(t * (3 + excite * 5) + b[4])) * (0.05 + excite * 0.35), b[2]); dummy.rotation.y = -b[3]; dummy.updateMatrix(); crowd.setMatrixAt(i, dummy.matrix); }
      crowd.instanceMatrix.needsUpdate = true;
    });
    // spotlights
    for (const [x, z] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) { const s = new THREE.SpotLight(0xfff0d0, 60, 40, 0.5, 0.5, 1.2); s.position.set(x * 1.6, 13, z * 1.6); s.target.position.set(0, 0, 0); g.add(s, s.target); }
    // scoreboard glow
    const sb = mesh(new THREE.BoxGeometry(5, 2, 0.4), M.basic(0x203a8a), 0, 10, -16, false, false); g.add(sb);
    const key = new THREE.DirectionalLight(0xfff0d8, 1.0); key.position.set(-4, 12, 6); key.castShadow = true;
    const hemi = new THREE.HemisphereLight(0xb0b8d8, 0x201810, 0.5);
    g.add(key, hemi);
    return { group: g, fog: [0x05060c, 0.014], key, anim };
  },
  ice(q) {
    const g = new THREE.Group(); const anim = []; const rng = new Rng(5);
    const sky = skyDome(0x040c22, 0x14406a, 0x0a1a2a); g.add(sky); g.add(stars(300));
    // aurora curtains
    for (let i = 0; i < 4; i++) {
      const m = new THREE.MeshBasicMaterial({ color: [0x3cffb0, 0x59a8ff, 0xa06bff, 0x3cffb0][i], transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
      const p = new THREE.Mesh(new THREE.PlaneGeometry(90, 26, 24, 1), m); p.position.set(-30 + i * 20, 38, -70 - i * 8); p.rotation.y = 0.2 * (i - 1.5); g.add(p);
      anim.push((t) => { const pos = p.geometry.attributes.position; for (let k = 0; k < pos.count; k++) pos.setY(k, (k < 25 ? 13 : -13) + Math.sin(pos.getX(k) * 0.12 + t * 0.6 + i) * 3); pos.needsUpdate = true; m.opacity = 0.13 + Math.sin(t * 0.5 + i) * 0.05; });
    }
    addFloor(g, 'circle', 'ice', 8.4);
    g.add(mesh(new THREE.CylinderGeometry(70, 70, 0.3, 40), M.std(0xdff2ff, { rough: 0.9 }), 0, -1.2, 0, false, true));
    for (let i = 0; i < 22; i++) { const a = rng.next() * 6.28, r = rng.range(11, 50), h = rng.range(2, 16); g.add(mesh(new THREE.ConeGeometry(rng.range(1, 4), h, 5), M.std(0xbfe6ff, { rough: 0.15, metal: 0.3, emissive: 0x2a5a8a, ei: 0.4 }), Math.cos(a) * r, h / 2 - 1, Math.sin(a) * r)); }
    const key = new THREE.DirectionalLight(0xcfe8ff, 2.0); key.position.set(-5, 10, 8); key.castShadow = true;
    const hemi = new THREE.HemisphereLight(0x8fd0ff, 0x203040, 1.0);
    const p = new THREE.PointLight(0x59d0ff, 30, 24, 1.5); p.position.set(0, 4, 0);
    g.add(key, hemi, p);
    return { group: g, fog: [0x0e2236, 0.014], key, anim, snow: true };
  },
  throne(q) {
    const g = new THREE.Group(); const anim = []; const rng = new Rng(66);
    g.add(skyDome(0x12001c, 0x5a0f3a, 0x08000c)); g.add(stars(120));
    addFloor(g, 'circle', 'basalt', 9);
    const sig = mesh(new THREE.TorusGeometry(6.5, 0.07, 6, 6), M.basic(0xc13bff), 0, 0.03, 0, false, false); sig.rotation.x = Math.PI / 2; g.add(sig);
    const sig2 = mesh(new THREE.TorusGeometry(6.5, 0.07, 6, 6), M.basic(0xff3c6a), 0, 0.03, 0, false, false); sig2.rotation.x = Math.PI / 2; sig2.rotation.z = Math.PI / 6; g.add(sig2);
    anim.push((t) => { sig.rotation.z = t * 0.2; sig2.rotation.z = -t * 0.15 + 0.5; });
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2, r = 10.5, h = 9 + (i % 2) * 3;
      g.add(mesh(new THREE.ConeGeometry(0.9, h, 5), M.std(0x1c1020, { rough: 0.6, metal: 0.4 }), Math.cos(a) * r, h / 2, Math.sin(a) * r));
      const s = mesh(new THREE.SphereGeometry(0.4, 10, 8), M.basic(0xc13bff), Math.cos(a) * r, h + 0.4, Math.sin(a) * r, false, false); g.add(s);
      anim.push((t) => { s.scale.setScalar(1 + Math.sin(t * 3 + i) * 0.25); });
    }
    // throne in the back
    g.add(mesh(new THREE.BoxGeometry(3, 5, 1.2), M.std(0x1a1020, { metal: 0.5, rough: 0.4 }), 0, 2.5, -13)); g.add(mesh(new THREE.ConeGeometry(0.5, 3, 4), M.std(0x2a1030), -1.4, 6.3, -13)); g.add(mesh(new THREE.ConeGeometry(0.5, 3, 4), M.std(0x2a1030), 1.4, 6.3, -13));
    const orb = new THREE.PointLight(0xc13bff, 120, 40, 1.6); orb.position.set(0, 8, 0); g.add(orb);
    anim.push((t) => { orb.intensity = 100 + Math.sin(t * 2) * 25; });
    const red = new THREE.PointLight(0xff2a5a, 60, 30, 1.6); red.position.set(0, 3, -10); g.add(red);
    const key = new THREE.DirectionalLight(0xe0a0ff, 1.5); key.position.set(-5, 10, 7); key.castShadow = true;
    const hemi = new THREE.HemisphereLight(0x9a3ac8, 0x200820, 0.9);
    g.add(key, hemi);
    return { group: g, fog: [0x14001c, 0.018], key, anim, embers: true, ember: 0xc13bff };
  },
  grid(q) {
    const g = new THREE.Group(); const anim = [];
    g.add(skyDome(0x081018, 0x0e2a24, 0x04070a));
    addFloor(g, 'rect', 'grid', [10, 8]);
    for (const [x, z, w, d] of [[0, -8.15, 20.6, 0.3], [0, 8.15, 20.6, 0.3], [-10.15, 0, 0.3, 16], [10.15, 0, 0.3, 16]]) g.add(mesh(new THREE.BoxGeometry(w, 1.2, d), M.std(0x0f2b22, { emissive: 0x0a5a38, ei: 0.6 }), x, 0.6, z));
    for (let i = -4; i <= 4; i++) g.add(mesh(new THREE.BoxGeometry(0.06, 6, 0.06), M.basic(0x2bd68a), i * 2.4, 3, -8.2, false, false));
    const key = new THREE.DirectionalLight(0xddffee, 2.0); key.position.set(-4, 10, 8); key.castShadow = true;
    const hemi = new THREE.HemisphereLight(0x8affc8, 0x102018, 0.9);
    g.add(key, hemi);
    return { group: g, fog: [0x061410, 0.01], key, anim };
  },
};

export function buildStage(id, quality = 1) {
  const fn = BUILD[id] || BUILD.grid;
  const s = fn(quality);
  s.group.traverse((o) => { if (o.isMesh && o.material && !o.material.isShaderMaterial) o.material.fog = o.material.fog ?? true; });
  return s;
}
export const buildStagePhase = (name, q) => buildStage(name, q);
