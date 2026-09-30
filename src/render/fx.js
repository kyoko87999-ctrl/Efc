// Sprite based particles: hit sparks, rings, dust, embers, limb trails.
import * as THREE from 'three';
import { clamp, lerp } from '../util.js';

function canvasTex(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeTextures() {
  return {
    glow: canvasTex(64, (g, s) => {
      const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,0.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, s, s);
    }),
    star: canvasTex(128, (g, s) => {
      g.translate(s / 2, s / 2);
      const r = g.createRadialGradient(0, 0, 0, 0, 0, s / 2);
      r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.7)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(-s / 2, -s / 2, s, s);
      g.fillStyle = 'rgba(255,255,255,0.95)';
      for (let i = 0; i < 8; i++) {
        g.rotate(Math.PI / 4);
        g.beginPath(); g.moveTo(0, -3 - (i % 2) * 1); g.lineTo(s * (i % 2 ? 0.28 : 0.46), 0); g.lineTo(0, 3 + (i % 2) * 1); g.closePath(); g.fill();
      }
    }),
    ring: canvasTex(128, (g, s) => {
      g.strokeStyle = 'rgba(255,255,255,1)'; g.lineWidth = 7;
      g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 10, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 14;
      g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 12, 0, Math.PI * 2); g.stroke();
    }),
    smoke: canvasTex(64, (g, s) => {
      const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      r.addColorStop(0, 'rgba(255,255,255,0.55)'); r.addColorStop(0.6, 'rgba(255,255,255,0.2)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, s, s);
    }),
    streak: canvasTex(64, (g, s) => {
      const r = g.createLinearGradient(0, 0, s, 0);
      r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.7, 'rgba(255,255,255,0.9)'); r.addColorStop(1, 'rgba(255,255,255,1)');
      g.fillStyle = r; g.beginPath(); g.moveTo(0, s / 2); g.lineTo(s, s / 2 - 5); g.lineTo(s, s / 2 + 5); g.closePath(); g.fill();
    }),
    bolt: canvasTex(128, (g, s) => {
      g.strokeStyle = 'rgba(255,255,255,1)'; g.lineWidth = 5; g.lineCap = 'round'; g.lineJoin = 'round';
      g.shadowColor = 'white'; g.shadowBlur = 10;
      g.beginPath(); g.moveTo(8, s / 2);
      let x = 8; while (x < s - 8) { x += 14 + Math.random() * 10; g.lineTo(Math.min(x, s - 8), s / 2 + (Math.random() - 0.5) * 46); }
      g.stroke();
    }),
  };
}

export class Fx {
  constructor(scene) {
    this.scene = scene;
    this.tex = makeTextures();
    this.items = [];
    this.pool = [];
    this.group = new THREE.Group();
    scene.add(this.group);
    this.mats = new Map();
  }

  mat(map, blend, color) {
    const key = map.uuid + blend + color;
    let m = this.mats.get(key);
    if (!m) {
      m = new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, blending: blend === 'add' ? THREE.AdditiveBlending : THREE.NormalBlending, color });
      this.mats.set(key, m);
    }
    return m;
  }

  spawn(o) {
    let s = this.pool.pop();
    const mat = this.mat(o.map, o.blend || 'add', o.color || 0xffffff).clone();
    if (!s) { s = new THREE.Sprite(mat); this.group.add(s); }
    else { s.material.dispose(); s.material = mat; s.visible = true; }
    s.position.set(o.x, o.y, o.z);
    s.scale.setScalar(o.s0);
    s.material.opacity = o.a0 ?? 1;
    s.material.rotation = o.rot ?? 0;
    this.items.push({
      s, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, g: o.g || 0, drag: o.drag ?? 0.92,
      life: 0, max: o.life, s0: o.s0, s1: o.s1 ?? o.s0, a0: o.a0 ?? 1, spin: o.spin || 0, fadeIn: o.fadeIn || 0,
    });
  }

  update(dtF) {
    // dtF in sim frames
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.life += dtF;
      const k = it.life / it.max;
      if (k >= 1) { it.s.visible = false; this.pool.push(it.s); this.items.splice(i, 1); continue; }
      const dr = Math.pow(it.drag, dtF);
      it.vx *= dr; it.vy = it.vy * dr - it.g * dtF; it.vz *= dr;
      it.s.position.x += it.vx * dtF; it.s.position.y += it.vy * dtF; it.s.position.z += it.vz * dtF;
      const sz = lerp(it.s0, it.s1, Math.sqrt(k));
      it.s.scale.setScalar(sz);
      let a = it.a0 * (1 - k * k);
      if (it.fadeIn && it.life < it.fadeIn) a *= it.life / it.fadeIn;
      it.s.material.opacity = a;
      it.s.material.rotation += it.spin * dtF;
    }
  }

  // ---- effect recipes
  hit(pos, kind, opts = {}) {
    const [x, y, z] = pos;
    const T = this.tex;
    const big = kind === 'heavy' ? 1.6 : kind === 'med' ? 1.15 : 0.8;
    const col = opts.counter ? 0xff4d6d : opts.pcrush ? 0xffd23f : opts.color ?? 0xffb347;
    this.spawn({ map: T.star, x, y, z, s0: 0.35 * big, s1: 1.5 * big, life: 9, color: col, spin: 0.02 });
    this.spawn({ map: T.glow, x, y, z, s0: 0.4 * big, s1: 1.8 * big, life: 11, color: 0xffffff, a0: 0.9 });
    this.spawn({ map: T.ring, x, y, z, s0: 0.2 * big, s1: 2.0 * big, life: 12, color: opts.counter ? 0xff9ad5 : 0xffffff, a0: 0.9 });
    const n = kind === 'heavy' ? 12 : kind === 'med' ? 8 : 5;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = (Math.random() - 0.2) * 1.2, sp = (0.05 + Math.random() * 0.07) * big;
      this.spawn({ map: T.glow, x, y, z, vx: Math.cos(a) * sp, vy: Math.sin(e) * sp + 0.02, vz: Math.sin(a) * sp, g: 0.004, s0: 0.12 * big, s1: 0.02, life: 16 + Math.random() * 10, color: col, drag: 0.94 });
    }
    if (kind !== 'light') for (let i = 0; i < 3; i++) this.spawn({ map: T.smoke, x, y, z, vx: (Math.random() - 0.5) * 0.02, vy: 0.01, vz: (Math.random() - 0.5) * 0.02, s0: 0.3, s1: 0.9 * big, life: 22, color: 0xddd0c0, blend: 'normal', a0: 0.35 });
  }

  block(pos, kind) {
    const [x, y, z] = pos;
    const T = this.tex;
    const big = kind === 'heavy' ? 1.3 : 0.9;
    this.spawn({ map: T.ring, x, y, z, s0: 0.15, s1: 1.1 * big, life: 10, color: 0x7fd8ff });
    this.spawn({ map: T.star, x, y, z, s0: 0.2, s1: 0.8 * big, life: 7, color: 0xcaf0ff });
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2, sp = 0.04 + Math.random() * 0.05;
      this.spawn({ map: T.glow, x, y, z, vx: Math.cos(a) * sp, vy: (Math.random() - 0.3) * sp, vz: Math.sin(a) * sp, s0: 0.08, s1: 0.02, life: 14, color: 0x9fdcff });
    }
  }

  dust(x, z, big = false) {
    const T = this.tex;
    const n = big ? 8 : 4;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random();
      this.spawn({ map: T.smoke, x, y: 0.08, z, vx: Math.cos(a) * 0.03, vy: 0.008, vz: Math.sin(a) * 0.03, s0: 0.3, s1: big ? 1.4 : 0.8, life: 26, color: 0xb9ae9d, blend: 'normal', a0: 0.5 });
    }
    if (big) this.spawn({ map: T.ring, x, y: 0.05, z, s0: 0.4, s1: 3.2, life: 16, color: 0xffffff, a0: 0.6 });
  }

  burst(pos, color, radius = 3) {
    const [x, y, z] = pos;
    const T = this.tex;
    this.spawn({ map: T.ring, x, y, z, s0: 0.3, s1: radius, life: 18, color, a0: 1 });
    this.spawn({ map: T.ring, x, y, z, s0: 0.1, s1: radius * 0.7, life: 14, color: 0xffffff, a0: 0.8 });
    this.spawn({ map: T.glow, x, y, z, s0: 0.5, s1: radius * 1.2, life: 16, color, a0: 0.8 });
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2, sp = 0.06 + Math.random() * 0.08;
      this.spawn({ map: T.glow, x, y, z, vx: Math.cos(a) * sp, vy: (Math.random() - 0.2) * sp, vz: Math.sin(a) * sp, s0: 0.14, s1: 0.02, life: 26, color, g: 0.002 });
    }
  }

  ember(x, y, z, color = 0xff8a3d) {
    this.spawn({ map: this.tex.glow, x: x + (Math.random() - 0.5) * 0.5, y, z: z + (Math.random() - 0.5) * 0.5, vx: (Math.random() - 0.5) * 0.004, vy: 0.012 + Math.random() * 0.012, vz: (Math.random() - 0.5) * 0.004, s0: 0.1 + Math.random() * 0.08, s1: 0.01, life: 34 + Math.random() * 20, color, drag: 0.99 });
  }

  bolt(a, b, color = 0x8fe3ff, w = 0.5) {
    const T = this.tex;
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, mz = (a[2] + b[2]) / 2;
    const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    this.spawn({ map: T.bolt, x: mx, y: my, z: mz, s0: Math.max(0.5, d * 1.1 * w * 2), s1: Math.max(0.5, d * 1.1 * w * 2), life: 5, color, rot: Math.random() * Math.PI * 2 });
  }
}

// ribbon trail following a point in world space
export class Trail {
  constructor(scene, color = 0xffffff, len = 12) {
    this.len = len;
    this.pts = [];
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(len * 2 * 3);
    this.col = new Float32Array(len * 2 * 4);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 4));
    const idx = [];
    for (let i = 0; i < len - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    geo.setIndex(idx);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.color = new THREE.Color(color);
    scene.add(this.mesh);
    this.active = false;
    this.fade = 0;
  }
  setColor(c) { this.color.set(c); }
  push(p, up, width = 0.08) {
    this.pts.unshift({ x: p.x, y: p.y, z: p.z, ux: up.x, uy: up.y, uz: up.z, w: width });
    if (this.pts.length > this.len) this.pts.pop();
  }
  clear() { this.pts.length = 0; this.mesh.visible = false; }
  update(active) {
    if (!active && this.pts.length) this.pts.pop();
    if (!this.pts.length) { this.mesh.visible = false; return; }
    this.mesh.visible = true;
    const n = this.len;
    for (let i = 0; i < n; i++) {
      const p = this.pts[Math.min(i, this.pts.length - 1)];
      const k = i < this.pts.length ? 1 - i / n : 0;
      const w = p.w * (0.3 + 0.7 * k);
      this.pos.set([p.x + p.ux * w, p.y + p.uy * w, p.z + p.uz * w, p.x - p.ux * w, p.y - p.uy * w, p.z - p.uz * w], i * 6);
      const a = k * k * 0.75;
      this.col.set([this.color.r, this.color.g, this.color.b, a, this.color.r, this.color.g, this.color.b, a], i * 8);
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.color.needsUpdate = true;
  }
  dispose() { this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.mesh.parent?.remove(this.mesh); }
}

export { clamp };
