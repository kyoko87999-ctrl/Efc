// Procedural humanoid rig built from primitives, posed with 4-effector two-bone IK.
// Mesh space: +Z forward, +Y up, +X = character's LEFT.  Pose space uses [side(+right), up, fwd].
import * as THREE from 'three';
import { DEG, clamp } from '../util.js';

export const LEN = { thigh: 0.44, shin: 0.43, upper: 0.30, fore: 0.28 };
const HIP_X = 0.09, HIP_Y = -0.06;
const SPINE_Y = 0.10, CHEST_Y = 0.24, SH_X = 0.20, SH_Y = 0.22, NECK_Y = 0.31;

const V3 = THREE.Vector3, Q = THREE.Quaternion, M4 = THREE.Matrix4, E = THREE.Euler;
const _u = new V3(), _v = new V3(), _e = new V3(), _d0 = new V3(), _d1 = new V3(), _n = new V3(), _x = new V3(), _y = new V3(), _z = new V3(), _t2 = new V3();
const _m = new M4(), _p0 = new V3(), _tg = new V3(), _pole = new V3();
const _qB = new Q(), _qS = new Q(), _qC = new Q(), _qPar = new Q(), _q0 = new Q(), _qBend = new Q(), _qTmp = new Q(), _qFoot = new Q();
const _eul = new E(0, 0, 0, 'YXZ');
const _mB = new M4(), _mS = new M4(), _mC = new M4(), _mAcc = new M4();
const AX = new V3(1, 0, 0);

function solveTwoBone(p0, t, pole, L1, L2, outQ) {
  _u.subVectors(t, p0);
  let d = _u.length();
  const maxD = (L1 + L2) * 0.9995, minD = Math.abs(L1 - L2) + 0.03;
  if (d < 1e-6) { _u.set(0, -1, 0); d = minD; } else _u.divideScalar(d);
  d = clamp(d, minD, maxD);
  const cosA = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1);
  const A = Math.acos(cosA), sinA = Math.sin(A);
  _v.copy(pole);
  _v.addScaledVector(_u, -_v.dot(_u));
  if (_v.lengthSq() < 1e-6) { _v.set(0, 0, 1); _v.addScaledVector(_u, -_v.dot(_u)); if (_v.lengthSq() < 1e-6) _v.set(1, 0, 0); }
  _v.normalize();
  _e.copy(p0).addScaledVector(_u, cosA * L1).addScaledVector(_v, sinA * L1);
  _d0.subVectors(_e, p0).normalize();
  _t2.copy(p0).addScaledVector(_u, d);
  _d1.subVectors(_t2, _e).normalize();
  _n.crossVectors(_d0, _d1);
  const s = _n.length();
  const phi = Math.atan2(s, _d0.dot(_d1));
  if (s < 1e-5) { _n.crossVectors(_d0, pole); if (_n.lengthSq() < 1e-8) _n.set(1, 0, 0); }
  _n.normalize();
  _x.copy(_n); _y.copy(_d0).negate(); _z.crossVectors(_x, _y);
  _m.makeBasis(_x, _y, _z);
  outQ.setFromRotationMatrix(_m);
  return phi;
}

export function mixColor(a, b, t) {
  const ca = new THREE.Color(a), cb = new THREE.Color(b);
  return ca.lerp(cb, t);
}

export function mergeBody(base, alt, cust) {
  const o = JSON.parse(JSON.stringify(base));
  const apply = (src) => {
    if (!src) return;
    for (const k of ['top', 'bottom', 'hands', 'feet', 'hair']) if (src[k]) o[k] = { ...(o[k] || {}), ...src[k] };
    if (src.skin) o.skin = src.skin;
    if (src.extra) o.extra = src.extra.slice();
    if (src.glow) o.glow = src.glow;
  };
  apply(alt);
  apply(cust);
  return o;
}

export class Rig {
  constructor(body) {
    this.cfg = body;
    this.mats = [];
    this.matCache = new Map();
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.spine = new THREE.Group();
    this.chest = new THREE.Group();
    this.neck = new THREE.Group();
    this.head = new THREE.Group();
    this.root.add(this.body);
    this.body.add(this.spine);
    this.spine.add(this.chest);
    this.chest.add(this.neck);
    this.neck.add(this.head);
    this.spine.position.set(0, SPINE_Y, 0);
    this.chest.position.set(0, CHEST_Y, 0);
    this.neck.position.set(0, NECK_Y - CHEST_Y - SPINE_Y + 0.0, 0);
    this.neck.position.set(0, 0.30, 0);
    this.limbs = {};
    this.anchor = {};
    this.build();
    this.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  }

  mat(color, o = {}) {
    const key = color + '|' + (o.rough ?? 0.65) + '|' + (o.metal ?? 0.05) + '|' + (o.emissive || '') + '|' + (o.basic ? 'b' : '');
    if (this.matCache.has(key)) return this.matCache.get(key);
    const m = o.basic ? new THREE.MeshBasicMaterial({ color }) : new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.65, metalness: o.metal ?? 0.05 });
    if (o.emissive) { m.emissive = new THREE.Color(o.emissive); m.emissiveIntensity = o.ei ?? 1; }
    m.userData.base = new THREE.Color(color);
    m.userData.baseE = m.emissive ? m.emissive.clone() : new THREE.Color(0, 0, 0);
    m.userData.baseEI = m.emissiveIntensity ?? 0;
    this.matCache.set(key, m);
    this.mats.push(m);
    return m;
  }

  add(parent, geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    parent.add(m);
    return m;
  }

  capsule(r, len) { return new THREE.CapsuleGeometry(r, Math.max(0.001, len - 2 * r), 6, 14); }

  build() {
    const c = this.cfg;
    const [shW, trW, armT, legT, headS] = c.build || [1, 1, 1, 1, 1];
    const skin = this.mat(c.skin || '#d9a679', { rough: 0.7 });
    const top = c.top || { kind: 'none', color: '#333' };
    const bot = c.bottom || { kind: 'shorts', color: '#333' };
    const topM = this.mat(top.color || '#333', { rough: 0.8 });
    const trimM = this.mat(top.trim || top.color || '#333', { rough: 0.7 });
    const botM = this.mat(bot.color || '#333', { rough: 0.8 });
    const botTrim = this.mat(bot.trim || bot.color || '#333', { rough: 0.7 });
    const hands = c.hands || { kind: 'bare' };
    const feet = c.feet || { kind: 'bare' };
    const armored = top.kind === 'armor';
    const metal = { rough: 0.35, metal: 0.7 };
    const chestM = armored ? this.mat(top.color, metal) : (top.kind === 'none' ? skin : topM);
    const sleeveKind = top.kind; // none | tank | gi | jacket | long | armor
    const armUpperM = (sleeveKind === 'gi' || sleeveKind === 'jacket' || sleeveKind === 'long' || armored) ? (armored ? this.mat(top.color, metal) : topM) : skin;
    const armLowerM = (sleeveKind === 'long' || armored) ? (armored ? this.mat(top.trim || top.color, metal) : topM) : skin;
    const legUpperM = bot.kind === 'pants' || bot.kind === 'gi' || bot.kind === 'armor' || bot.kind === 'shorts' || bot.kind === 'trunks' ? (bot.kind === 'armor' ? this.mat(bot.color, metal) : botM) : skin;
    const legLowerM = bot.kind === 'pants' || bot.kind === 'gi' ? botM : (bot.kind === 'armor' ? this.mat(bot.color, metal) : skin);
    const wide = bot.kind === 'gi' ? 1.18 : 1;

    // ---- pelvis + torso
    this.add(this.body, new THREE.SphereGeometry(0.15, 16, 12), bot.kind === 'none' ? skin : botM, 0, 0, 0, 1.15 * trW, 0.78, 0.86);
    this.add(this.spine, this.capsule(0.125 * trW, 0.26), top.kind === 'none' || top.kind === 'tank' && false ? skin : (top.kind === 'none' ? skin : topM), 0, 0.08, 0, 1.0, 1, 0.85);
    const chest = this.add(this.chest, new THREE.CapsuleGeometry(0.16, 0.16, 6, 16), chestM, 0, 0.11, 0, 1.28 * trW * shW, 1, 0.82);
    void chest;
    if (top.kind === 'gi' || top.kind === 'jacket') {
      // collar / lapel
      this.add(this.chest, new THREE.BoxGeometry(0.05, 0.32, 0.03), trimM, 0.055, 0.15, 0.135, 1, 1, 1).rotation.z = -0.32;
      this.add(this.chest, new THREE.BoxGeometry(0.05, 0.32, 0.03), trimM, -0.055, 0.15, 0.135, 1, 1, 1).rotation.z = 0.32;
    }
    if (top.kind === 'tank' && top.trim) this.add(this.chest, new THREE.TorusGeometry(0.09, 0.012, 6, 16), trimM, 0, 0.30, 0.02, 1.6, 1, 0.6).rotation.x = Math.PI / 2;
    if (armored) {
      this.add(this.chest, new THREE.BoxGeometry(0.34 * shW, 0.16, 0.06), this.mat(top.trim || top.color, metal), 0, 0.12, 0.12);
    }

    // ---- head
    const hs = headS;
    this.add(this.neck, new THREE.CylinderGeometry(0.045, 0.055, 0.1, 10), skin, 0, -0.02, 0);
    this.add(this.head, new THREE.SphereGeometry(0.115 * hs, 20, 16), skin, 0, 0.13, 0.005, 0.95, 1.08, 1.0);
    // ears
    this.add(this.head, new THREE.SphereGeometry(0.025 * hs, 8, 6), skin, 0.105 * hs, 0.13, -0.005);
    this.add(this.head, new THREE.SphereGeometry(0.025 * hs, 8, 6), skin, -0.105 * hs, 0.13, -0.005);
    // eyes / brows
    const eyeM = this.mat(c.eyes || '#0d0d10', { rough: 0.3, basic: false });
    const glow = c.eyeGlow ? this.mat(c.eyeGlow, { basic: true }) : null;
    for (const s of [1, -1]) {
      this.add(this.head, new THREE.SphereGeometry(0.017 * hs, 8, 6), glow || eyeM, s * 0.044 * hs, 0.15, 0.104 * hs, 1, 1, 0.6);
      const br = this.add(this.head, new THREE.BoxGeometry(0.05 * hs, 0.011, 0.014), this.mat(c.hair?.color || '#111'), s * 0.045 * hs, 0.185, 0.106 * hs);
      br.rotation.z = -s * 0.28;
    }
    this.add(this.head, new THREE.BoxGeometry(0.03 * hs, 0.06 * hs, 0.03), skin, 0, 0.115, 0.115 * hs, 1, 1, 1);
    this.buildHair(c.hair || { style: 'short', color: '#222' }, hs);

    // ---- extras
    for (const ex of c.extra || []) this.buildExtra(ex, hs, trW, shW);

    // ---- arms
    for (const side of [1, -1]) {
      const n = side === 1 ? 'L' : 'R';
      const j0 = new THREE.Group(); this.chest.add(j0); j0.position.set(side * SH_X * shW, SH_Y + 0.11 - 0.01, 0);
      const j1 = new THREE.Group(); j0.add(j1); j1.position.set(0, -LEN.upper, 0);
      const j2 = new THREE.Group(); j1.add(j2); j2.position.set(0, -LEN.fore, 0);
      this.add(j0, new THREE.SphereGeometry(0.078 * armT, 12, 10), armored ? armUpperM : (top.kind === 'none' || top.kind === 'tank' ? skin : armUpperM));
      const up = this.add(j0, this.capsule(0.058 * armT, LEN.upper + 0.02), armUpperM, 0, -LEN.upper / 2 + 0.005, 0);
      void up;
      this.add(j1, new THREE.SphereGeometry(0.052 * armT, 10, 8), armLowerM);
      this.add(j1, this.capsule(0.05 * armT, LEN.fore + 0.02), armLowerM, 0, -LEN.fore / 2 + 0.005, 0);
      const gl = hands.kind === 'gloves';
      const handM = gl ? this.mat(hands.color || '#b71c1c', { rough: 0.5 }) : skin;
      this.add(j2, new THREE.SphereGeometry(gl ? 0.082 : 0.06, 12, 10), handM, 0, -0.04, 0.005, 1, 1.05, 1.05);
      if (hands.kind === 'wraps') this.add(j1, new THREE.CylinderGeometry(0.056 * armT, 0.054 * armT, 0.17, 10), this.mat(hands.color || '#f2f2f2', { rough: 0.9 }), 0, -LEN.fore + 0.09, 0);
      if (gl) this.add(j1, new THREE.CylinderGeometry(0.062, 0.058, 0.1, 10), handM, 0, -LEN.fore + 0.04, 0);
      this.limbs['h' + n] = { j0, j1, j2, L1: LEN.upper, L2: LEN.fore, arm: true, side, root: new V3(side * SH_X * shW, SH_Y + 0.11 - 0.01, 0) };
      this.anchor['h' + n] = j2; this.anchor['e' + n] = j1;
    }

    // ---- legs
    for (const side of [1, -1]) {
      const n = side === 1 ? 'L' : 'R';
      const j0 = new THREE.Group(); this.body.add(j0); j0.position.set(side * HIP_X * trW, HIP_Y, 0);
      const j1 = new THREE.Group(); j0.add(j1); j1.position.set(0, -LEN.thigh, 0);
      const j2 = new THREE.Group(); j1.add(j2); j2.position.set(0, -LEN.shin, 0);
      this.add(j0, this.capsule(0.09 * legT * wide, LEN.thigh + 0.03), legUpperM, 0, -LEN.thigh / 2 + 0.01, 0);
      this.add(j1, new THREE.SphereGeometry(0.068 * legT * wide, 10, 8), legLowerM);
      this.add(j1, this.capsule(0.066 * legT * wide, LEN.shin + 0.02), legLowerM, 0, -LEN.shin / 2 + 0.005, 0);
      const shoes = feet.kind === 'shoes' || feet.kind === 'boots';
      const footM = shoes ? this.mat(feet.color || '#222', { rough: 0.6 }) : skin;
      const foot = this.add(j2, new THREE.BoxGeometry(0.095, 0.07, 0.25), footM, 0, -0.03, 0.06);
      void foot;
      this.add(j2, new THREE.SphereGeometry(0.05, 8, 6), footM, 0, -0.02, 0.17, 1.0, 0.7, 1);
      if (feet.kind === 'boots') this.add(j1, new THREE.CylinderGeometry(0.075 * legT, 0.07 * legT, 0.2, 10), footM, 0, -LEN.shin + 0.1, 0);
      if (bot.kind === 'shorts' || bot.kind === 'trunks') {
        if (bot.trim) this.add(j0, new THREE.CylinderGeometry(0.097 * legT, 0.097 * legT, 0.03, 12), botTrim, 0, -0.19, 0);
      }
      this.limbs['f' + n] = { j0, j1, j2, L1: LEN.thigh, L2: LEN.shin, arm: false, side, root: new V3(side * HIP_X * trW, HIP_Y, 0) };
      this.anchor['f' + n] = j2; this.anchor['k' + n] = j1;
    }
    this.anchor.head = this.head; this.anchor.chest = this.chest; this.anchor.pelvis = this.body;
    this.anchor.hd = this.head; this.anchor.sh = this.chest;
  }

  buildHair(h, hs) {
    const m = this.mat(h.color || '#222', { rough: 0.55 });
    const hd = this.head;
    const cap = (s = 1.0) => {
      const g = new THREE.SphereGeometry(0.122 * hs * s, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.56);
      const mesh = this.add(hd, g, m, 0, 0.14, -0.008, 0.98, 1.08, 1.03);
      mesh.rotation.x = -0.18;
      return mesh;
    };
    switch (h.style) {
      case 'bald': break;
      case 'spiky': {
        cap();
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2;
          const c = this.add(hd, new THREE.ConeGeometry(0.04 * hs, 0.17 * hs, 6), m, Math.cos(a) * 0.07 * hs, 0.245 + (i % 2) * 0.02, Math.sin(a) * 0.07 * hs - 0.02);
          c.rotation.z = -Math.cos(a) * 0.5; c.rotation.x = Math.sin(a) * 0.5;
        }
        const c0 = this.add(hd, new THREE.ConeGeometry(0.05 * hs, 0.22 * hs, 6), m, 0, 0.29, 0.0); void c0;
        break;
      }
      case 'short': cap(1.02); break;
      case 'ponytail': {
        cap(1.02);
        const g = new THREE.Group(); hd.add(g); g.position.set(0, 0.2, -0.1 * hs);
        this.add(g, this.capsule(0.04 * hs, 0.34), m, 0, -0.16, -0.03).rotation.x = 0.25;
        this.hairTail = g;
        break;
      }
      case 'long': {
        cap(1.05);
        const g = new THREE.Group(); hd.add(g); g.position.set(0, 0.19, -0.09 * hs);
        this.add(g, this.capsule(0.08 * hs, 0.5), m, 0, -0.24, -0.02, 1.2, 1, 0.6);
        this.hairTail = g;
        break;
      }
      case 'mohawk': {
        for (let i = 0; i < 6; i++) {
          const c = this.add(hd, new THREE.ConeGeometry(0.035 * hs, 0.16 * hs, 6), m, 0, 0.245, 0.07 * hs - i * 0.03 * hs);
          c.rotation.x = -0.1 * (i - 2);
        }
        this.add(hd, new THREE.BoxGeometry(0.03 * hs, 0.04, 0.2 * hs), m, 0, 0.24, -0.01);
        break;
      }
      case 'buns': {
        cap(1.02);
        this.add(hd, new THREE.SphereGeometry(0.06 * hs, 10, 8), m, 0.09 * hs, 0.26, -0.02);
        this.add(hd, new THREE.SphereGeometry(0.06 * hs, 10, 8), m, -0.09 * hs, 0.26, -0.02);
        break;
      }
      case 'afro': this.add(hd, new THREE.SphereGeometry(0.17 * hs, 14, 12), m, 0, 0.2, -0.02, 1.0, 0.95, 1.0); break;
      case 'topknot': {
        cap(1.0);
        this.add(hd, new THREE.SphereGeometry(0.05 * hs, 10, 8), m, 0, 0.29, -0.02);
        break;
      }
      case 'horns': {
        cap(1.0);
        for (const s of [1, -1]) {
          const c = this.add(hd, new THREE.ConeGeometry(0.04 * hs, 0.26 * hs, 8), this.mat('#d8d0c0', { rough: 0.4 }), s * 0.09 * hs, 0.27, 0.0);
          c.rotation.z = -s * 0.5; c.rotation.x = -0.25;
        }
        break;
      }
      case 'helmet': {
        this.add(hd, new THREE.SphereGeometry(0.13 * hs, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), this.mat(h.color, { rough: 0.3, metal: 0.8 }), 0, 0.14, 0, 1.0, 1.08, 1.05);
        break;
      }
      default: cap();
    }
  }

  buildExtra(ex, hs, trW, shW) {
    const [kind, col] = ex.split(':');
    const cm = (o) => this.mat(col || '#c00', o);
    switch (kind) {
      case 'belt': {
        const b = this.add(this.body, new THREE.TorusGeometry(0.155 * trW, 0.03, 8, 20), cm({ rough: 0.8 }), 0, 0.09, 0, 1.0, 1, 1); b.rotation.x = Math.PI / 2; b.scale.set(1.06, 0.84, 1);
        this.add(this.body, new THREE.BoxGeometry(0.05, 0.05, 0.03), cm({ rough: 0.5, metal: 0.4 }), 0, 0.09, 0.13 * trW);
        this.add(this.body, this.capsule(0.022, 0.26), cm({ rough: 0.8 }), 0.07, -0.02, 0.11).rotation.z = 0.15;
        break;
      }
      case 'headband': { const b = this.add(this.head, new THREE.TorusGeometry(0.118 * hs, 0.016, 8, 20), cm({ rough: 0.8 }), 0, 0.19, 0, 1, 1, 1); b.rotation.x = Math.PI / 2; b.scale.set(0.97, 1.03, 1); this.add(this.head, this.capsule(0.014, 0.2), cm({ rough: 0.8 }), 0.05, 0.13, -0.13).rotation.z = 0.25; break; }
      case 'mongkhon': {
        const b = this.add(this.head, new THREE.TorusGeometry(0.12 * hs, 0.022, 8, 22), this.mat(col || '#f5f5f5', { rough: 0.9 }), 0, 0.2, 0);
        b.rotation.x = Math.PI / 2; b.scale.set(0.97, 1.03, 1);
        this.add(this.head, new THREE.SphereGeometry(0.02, 8, 6), this.mat('#d4a017', { rough: 0.3, metal: 0.8 }), 0, 0.2, 0.125 * hs);
        break;
      }
      case 'mask': this.add(this.head, new THREE.SphereGeometry(0.119 * hs, 16, 12, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.32), cm({ rough: 0.9 }), 0, 0.135, 0.005, 0.96, 1.08, 1.02); break;
      case 'ninja': {
        this.add(this.head, new THREE.SphereGeometry(0.122 * hs, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.86), cm({ rough: 0.9 }), 0, 0.135, -0.003, 0.97, 1.08, 1.03);
        const band = this.add(this.head, new THREE.BoxGeometry(0.24 * hs, 0.05, 0.02), this.mat('#f2c94c'), 0, 0.185, 0.118 * hs);
        void band;
        // eyes slit
        this.add(this.head, new THREE.BoxGeometry(0.16 * hs, 0.04, 0.02), this.mat('#e0b48a'), 0, 0.155, 0.118 * hs);
        break;
      }
      case 'armbands': for (const s of [1, -1]) { const b = this.add(this.limbs ? this.chest : this.chest, new THREE.TorusGeometry(0.065, 0.014, 6, 12), cm(), s * SH_X * shW, SH_Y + 0.1 - 0.13, 0); b.rotation.x = Math.PI / 2; } break;
      case 'glasses': {
        for (const s of [1, -1]) this.add(this.head, new THREE.CylinderGeometry(0.035 * hs, 0.035 * hs, 0.012, 12), this.mat(col || '#101820', { rough: 0.1, metal: 0.6 }), s * 0.048 * hs, 0.152, 0.11 * hs).rotation.x = Math.PI / 2;
        this.add(this.head, new THREE.BoxGeometry(0.1 * hs, 0.012, 0.012), this.mat('#111'), 0, 0.152, 0.112 * hs);
        break;
      }
      case 'scarf': { const b = this.add(this.neck, new THREE.TorusGeometry(0.075, 0.03, 8, 16), cm({ rough: 0.9 }), 0, -0.02, 0); b.rotation.x = Math.PI / 2; const t = this.add(this.chest, this.capsule(0.03, 0.4), cm({ rough: 0.9 }), 0.03, 0.05, -0.16); t.rotation.x = -0.15; this.scarfTail = t; break; }
      case 'shoulderpads': for (const s of [1, -1]) this.add(this.chest, new THREE.SphereGeometry(0.11, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), cm({ rough: 0.35, metal: 0.7 }), s * (SH_X * shW + 0.02), SH_Y + 0.115, 0, 1, 0.85, 1); break;
      case 'visor': this.add(this.head, new THREE.BoxGeometry(0.2 * hs, 0.05, 0.05), this.mat(col || '#00e5ff', { basic: true }), 0, 0.155, 0.1 * hs); break;
      case 'wings': {
        // bat-like wings: membrane shape + finger bones
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.lineTo(0.35, 0.55); shape.lineTo(0.75, 0.75);
        shape.quadraticCurveTo(0.8, 0.5, 0.95, 0.25);
        shape.quadraticCurveTo(0.8, 0.28, 0.72, 0.05);
        shape.quadraticCurveTo(0.6, 0.12, 0.52, -0.2);
        shape.quadraticCurveTo(0.4, -0.02, 0.3, -0.42);
        shape.quadraticCurveTo(0.18, -0.15, 0, -0.35);
        shape.lineTo(0, 0);
        const geo = new THREE.ShapeGeometry(shape, 8);
        const wm = new THREE.MeshStandardMaterial({ color: col || '#2a0a2e', roughness: 0.8, side: THREE.DoubleSide, emissive: new THREE.Color(col || '#2a0a2e').multiplyScalar(0.3) });
        const bone = this.mat('#120616', { rough: 0.6 });
        for (const s of [1, -1]) {
          const g = new THREE.Group(); this.chest.add(g); g.position.set(s * 0.07, 0.2, -0.14);
          const inner = new THREE.Group(); g.add(inner); inner.scale.set(s * 1.25, 1.25, 1);
          inner.add(new THREE.Mesh(geo, wm));
          for (const [ex, ey, w] of [[0.75, 0.75, 0.02], [0.95, 0.25, 0.015], [0.52, -0.2, 0.012]]) {
            const len = Math.hypot(ex, ey);
            const b = new THREE.Mesh(new THREE.CylinderGeometry(w, w * 1.4, len, 5), bone);
            b.position.set(ex / 2, ey / 2, 0.005); b.rotation.z = Math.atan2(ex, ey) * -1;
            inner.add(b);
          }
          g.rotation.y = s * 0.55; g.rotation.z = s * 0.05;
          this.wings = this.wings || []; this.wings.push(g);
        }
        break;
      }
      case 'tail': { const t = this.add(this.body, this.capsule(0.03, 0.6), cm(), 0, -0.1, -0.16); t.rotation.x = 0.9; break; }
      case 'earring': this.add(this.head, new THREE.TorusGeometry(0.02, 0.005, 6, 10), this.mat(col || '#f2c94c', { metal: 0.9, rough: 0.2 }), 0.11 * hs, 0.08, 0); break;
      case 'chain': { const b = this.add(this.chest, new THREE.TorusGeometry(0.12, 0.012, 6, 18), this.mat(col || '#f2c94c', { metal: 0.9, rough: 0.2 }), 0, 0.3, 0.02, 1.2, 1, 0.9); b.rotation.x = Math.PI / 2 + 0.3; break; }
      case 'sash': { const b = this.add(this.chest, this.capsule(0.03, 0.55), cm({ rough: 0.8 }), 0, 0.16, 0.135, 1, 1, 0.5); b.rotation.z = 0.7; break; }
      default:
    }
  }

  // ---------------------------------------------------------------- posing
  // pose: { hips:[s,u,f], hipsRot:[p,y,r], spine:[p,y,r], head:[p,y,r], hL,hR,fL,fR:[s,u,f] (body space), kneePole, ankle:[pl,pr] }
  apply(pose) {
    const h = pose.hips, hr = pose.hipsRot;
    this.body.position.set(-h[0], h[1], h[2]);
    _eul.set(hr[0] * DEG, hr[1] * DEG, hr[2] * DEG, 'YXZ');
    this.body.quaternion.setFromEuler(_eul);
    const sp = pose.spine;
    _eul.set(sp[0] * 0.45 * DEG, sp[1] * 0.45 * DEG, sp[2] * 0.45 * DEG, 'YXZ'); this.spine.quaternion.setFromEuler(_eul);
    _eul.set(sp[0] * 0.55 * DEG, sp[1] * 0.55 * DEG, sp[2] * 0.55 * DEG, 'YXZ'); this.chest.quaternion.setFromEuler(_eul);
    const hd = pose.head;
    _eul.set(hd[0] * DEG, hd[1] * DEG, hd[2] * DEG, 'YXZ'); this.head.quaternion.setFromEuler(_eul);

    this.body.updateMatrix(); this.spine.updateMatrix(); this.chest.updateMatrix();
    _mB.copy(this.body.matrix);
    _mS.copy(this.spine.matrix);
    _mC.copy(this.chest.matrix);
    _mAcc.multiplyMatrices(_mB, _mS).multiply(_mC);
    _qB.copy(this.body.quaternion);
    _qS.copy(_qB).multiply(this.spine.quaternion);
    _qC.copy(_qS).multiply(this.chest.quaternion);

    for (const key of ['hL', 'hR', 'fL', 'fR']) {
      const L = this.limbs[key];
      const t = pose[key];
      _tg.set(-t[0], t[1], t[2]).applyMatrix4(_mB);
      let mBase, qBase;
      if (L.arm) { mBase = _mAcc; qBase = _qC; } else { mBase = _mB; qBase = _qB; }
      _p0.copy(L.root).applyMatrix4(mBase);
      if (L.arm) _pole.set(L.side * 0.55, -0.7, -0.45); else _pole.set(L.side * 0.12, 0.05, 1.0);
      if (!L.arm && pose.kneePole) _pole.set(L.side * pose.kneePole[0], pose.kneePole[1], pose.kneePole[2]);
      if (L.arm && pose.elbowPole) _pole.set(L.side * pose.elbowPole[0], pose.elbowPole[1], pose.elbowPole[2]);
      _pole.applyQuaternion(qBase);
      const phi = solveTwoBone(_p0, _tg, _pole, L.L1, L.L2, _q0);
      _qPar.copy(qBase).invert();
      L.j0.quaternion.copy(_qPar).multiply(_q0);
      L.j1.quaternion.setFromAxisAngle(AX, phi);
      if (L.arm) {
        L.j2.quaternion.identity();
        if (pose.wrist) L.j2.rotation.set(pose.wrist[0] * DEG, 0, 0);
      } else {
        // keep the foot aligned with the body, plus ankle pitch
        _qBend.setFromAxisAngle(AX, phi);
        _qTmp.copy(_q0).multiply(_qBend).invert();
        const ap = (key === 'fL' ? pose.ankle?.[0] : pose.ankle?.[1]) ?? 0;
        _eul.set(ap * DEG, 0, 0, 'YXZ');
        _qFoot.copy(_qB).multiply(new Q().setFromEuler(_eul));
        L.j2.quaternion.copy(_qTmp).multiply(_qFoot);
      }
    }
  }

  // world position of an anchor (for FX)
  anchorWorld(name, out = new V3()) {
    const a = this.anchor[name];
    if (!a) return out.set(0, 0, 0);
    a.updateWorldMatrix(true, false);
    return out.setFromMatrixPosition(a.matrixWorld);
  }

  // colour / glow tinting (hit flash, heat, rage)
  tint(color, amount) {
    const c = _tintC.set(color);
    for (const m of this.mats) {
      if (!m.emissive) continue;
      m.emissive.copy(m.userData.baseE).lerp(c, amount);
      m.emissiveIntensity = m.userData.baseEI + amount * 0.9;
    }
  }

  dispose() {
    this.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    for (const m of this.mats) m.dispose();
  }
}
const _tintC = new THREE.Color();
