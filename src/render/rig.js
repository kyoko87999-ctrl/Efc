// Procedural humanoid rig built from primitives, posed with 4-effector two-bone IK.
// Skeleton: pelvis > lumbar > chest > neck > head (eyes, lids, brows, mouth); chest > clavicles > arms (hand: palm, fingers, thumb);
// pelvis > legs (foot: heel block + toe hinge); spring chains for hair / tails / belts / scarves / wings.
// Mesh space: +Z forward, +Y up, +X = character's LEFT.  Pose space uses [side(+right), up, fwd].
import * as THREE from 'three';
import { DEG, clamp } from '../util.js';
import { LEN, ANKLE_H, BALL_Z, HIP_X, HIP_Y, SPINE_Y, CHEST_Y, NECK_Y, SH_X, SH_Y } from './skel.js';
import { SpringChain } from './springs.js';

export { LEN };

const V3 = THREE.Vector3, Q = THREE.Quaternion, M4 = THREE.Matrix4, E = THREE.Euler;
const _u = new V3(), _v = new V3(), _e = new V3(), _d0 = new V3(), _d1 = new V3(), _n = new V3(), _x = new V3(), _y = new V3(), _z = new V3(), _t2 = new V3();
const _m = new M4(), _p0 = new V3(), _tg = new V3(), _pole = new V3(), _lk = new V3(), _hc = new V3();
const _qLw = new Q(), _qB = new Q(), _qS = new Q(), _qC = new Q(), _qPar = new Q(), _q0 = new Q(), _qBend = new Q(), _qTmp = new Q(), _qFoot = new Q(), _qL = new Q(), _qH = new Q(), _qN = new Q(), _qI = new Q();
const _eul = new E(0, 0, 0, 'YXZ'), _eul2 = new E(0, 0, 0, 'YXZ');
const _mB = new M4(), _mS = new M4(), _mC = new M4(), _mAcc = new M4();
const AX = new V3(1, 0, 0);

const _pv = new V3();
// st: per-limb state { pv: V3, has } - the bend plane (swivel of the elbow / knee around the shoulder-wrist axis) is rate limited:
// when the pole vector is nearly parallel to the limb the projected plane can swing by 180 degrees from one frame to the next,
// which makes the forearm / hand twirl.  maxStep (radians) is the largest swivel allowed in this call.
function solveTwoBone(p0, t, pole, L1, L2, outQ, st, maxStep = 0.7) {
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
  if (st) {
    if (st.has) {
      _pv.copy(st.pv).addScaledVector(_u, -st.pv.dot(_u));
      const pn = _pv.length();
      if (pn > 1e-3) {
        _pv.divideScalar(pn);
        const ang = Math.atan2(_u.dot(_n.crossVectors(_pv, _v)), _pv.dot(_v));
        if (Math.abs(ang) > maxStep) {
          const a = ang > 0 ? maxStep : -maxStep;
          _n.crossVectors(_u, _pv);
          _v.copy(_pv).multiplyScalar(Math.cos(a)).addScaledVector(_n, Math.sin(a)).normalize();
        }
      }
    }
    st.pv.copy(_v); st.has = true;
  }
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
    this.neck.position.set(0, NECK_Y, 0);
    this.limbs = {};
    this.anchor = {};
    this.chains = [];           // SpringChain[]
    this.wingChains = [];
    this.face = null;
    this.hands = {};
    this.feet = {};
    this.hasMouth = true;
    this.ikStep = 0.7;          // max swivel (rad) of the elbow / knee plane per apply()
    this.gazeAuto = [0, 0];     // eye gaze (deg) derived from the look-at residual
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

  group(parent, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }

  // a hanging chain of capsule segments driven by spring physics
  hangChain(parent, pos, lens, radii, mat, o = {}) {
    const bones = [];
    let p = parent, at = pos;
    for (let i = 0; i < lens.length; i++) {
      const g = this.group(p, at[0], at[1], at[2]);
      if (i === 0 && o.rotX) g.rotation.x = o.rotX;
      if (i === 0 && o.rotZ) g.rotation.z = o.rotZ;
      g.userData.tail = new V3(0, -lens[i], 0);
      const r = radii[Math.min(i, radii.length - 1)];
      const m = this.add(g, this.capsule(r, lens[i] + r * 0.6), mat, 0, -lens[i] / 2, 0, o.sx ?? 1, 1, o.sz ?? 1);
      void m;
      bones.push(g);
      p = g; at = [0, -lens[i], 0];
    }
    const chain = new SpringChain(bones, { w: o.w ?? 16, z: o.z ?? 0.4, g: o.g ?? 0.5, gain: o.gain ?? 1 });
    this.chains.push(chain);
    return chain;
  }

  build() {
    const c = this.cfg;
    const [shW, trW, armT, legT, headS] = c.build || [1, 1, 1, 1, 1];
    const skin = this.mat(c.skin || '#d9a679', { rough: 0.7 });
    this.skinMat = skin;
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
    this.add(this.spine, this.capsule(0.125 * trW, 0.26), top.kind === 'none' ? skin : topM, 0, 0.08, 0, 1.0, 1, 0.85);
    this.chestMesh = this.add(this.chest, new THREE.CapsuleGeometry(0.16, 0.16, 6, 16), chestM, 0, 0.11, 0, 1.28 * trW * shW, 1, 0.82);
    if (top.kind === 'gi' || top.kind === 'jacket') {
      this.add(this.chest, new THREE.BoxGeometry(0.05, 0.32, 0.03), trimM, 0.055, 0.15, 0.135, 1, 1, 1).rotation.z = -0.32;
      this.add(this.chest, new THREE.BoxGeometry(0.05, 0.32, 0.03), trimM, -0.055, 0.15, 0.135, 1, 1, 1).rotation.z = 0.32;
    }
    if (top.kind === 'tank' && top.trim) this.add(this.chest, new THREE.TorusGeometry(0.09, 0.012, 6, 16), trimM, 0, 0.30, 0.02, 1.6, 1, 0.6).rotation.x = Math.PI / 2;
    if (armored) this.add(this.chest, new THREE.BoxGeometry(0.34 * shW, 0.16, 0.06), this.mat(top.trim || top.color, metal), 0, 0.12, 0.12);

    // ---- head + face
    const hs = headS;
    this.hs = hs;
    this.add(this.neck, new THREE.CylinderGeometry(0.045, 0.055, 0.1, 10), skin, 0, -0.02, 0);
    this.add(this.head, new THREE.SphereGeometry(0.115 * hs, 20, 16), skin, 0, 0.13, 0.005, 0.95, 1.08, 1.0);
    this.add(this.head, new THREE.SphereGeometry(0.025 * hs, 8, 6), skin, 0.105 * hs, 0.13, -0.005);
    this.add(this.head, new THREE.SphereGeometry(0.025 * hs, 8, 6), skin, -0.105 * hs, 0.13, -0.005);
    this.buildFace(c, hs, skin);
    this.buildHair(c.hair || { style: 'short', color: '#222' }, hs);

    // ---- extras
    for (const ex of c.extra || []) this.buildExtra(ex, hs, trW, shW);

    // ---- arms (clavicle > shoulder > elbow > wrist/hand)
    for (const side of [1, -1]) {
      const n = side === 1 ? 'L' : 'R';
      const clav = this.group(this.chest, side * SH_X * shW, SH_Y, 0);
      const j0 = this.group(clav);
      const j1 = this.group(j0, 0, -LEN.upper, 0);
      const j2 = this.group(j1, 0, -LEN.fore, 0);
      this.add(j0, new THREE.SphereGeometry(0.078 * armT, 12, 10), armored ? armUpperM : (top.kind === 'none' || top.kind === 'tank' ? skin : armUpperM));
      this.add(j0, this.capsule(0.058 * armT, LEN.upper + 0.02), armUpperM, 0, -LEN.upper / 2 + 0.005, 0);
      this.add(j1, new THREE.SphereGeometry(0.052 * armT, 10, 8), armLowerM);
      this.add(j1, this.capsule(0.05 * armT, LEN.fore + 0.02), armLowerM, 0, -LEN.fore / 2 + 0.005, 0);
      this.buildHand(n, side, j1, j2, hands, skin, armT);
      this.limbs['h' + n] = { j0, j1, j2, clav, L1: LEN.upper, L2: LEN.fore, arm: true, side, root: new V3(side * SH_X * shW, SH_Y, 0) };
      this.anchor['h' + n] = j2; this.anchor['e' + n] = j1;
    }

    // ---- legs (hip > knee > ankle > toe)
    for (const side of [1, -1]) {
      const n = side === 1 ? 'L' : 'R';
      const j0 = this.group(this.body, side * HIP_X * trW, HIP_Y, 0);
      const j1 = this.group(j0, 0, -LEN.thigh, 0);
      const j2 = this.group(j1, 0, -LEN.shin, 0);
      this.add(j0, this.capsule(0.09 * legT * wide, LEN.thigh + 0.03), legUpperM, 0, -LEN.thigh / 2 + 0.01, 0);
      this.add(j1, new THREE.SphereGeometry(0.068 * legT * wide, 10, 8), legLowerM);
      this.add(j1, this.capsule(0.066 * legT * wide, LEN.shin + 0.02), legLowerM, 0, -LEN.shin / 2 + 0.005, 0);
      this.buildFoot(n, j1, j2, feet, skin, legT);
      if (bot.kind === 'shorts' || bot.kind === 'trunks') {
        if (bot.trim) this.add(j0, new THREE.CylinderGeometry(0.097 * legT, 0.097 * legT, 0.03, 12), botTrim, 0, -0.19, 0);
      }
      this.limbs['f' + n] = { j0, j1, j2, L1: LEN.thigh, L2: LEN.shin, arm: false, side, root: new V3(side * HIP_X * trW, HIP_Y, 0) };
      this.anchor['f' + n] = j2; this.anchor['k' + n] = j1;
    }
    this.anchor.head = this.head; this.anchor.chest = this.chest; this.anchor.pelvis = this.body;
    this.anchor.hd = this.head; this.anchor.sh = this.chest;
  }

  // ---------------------------------------------------------------- hands / feet / face
  buildHand(n, side, j1, j2, hands, skin, armT) {
    const gl = hands.kind === 'gloves';
    const handM = gl ? this.mat(hands.color || '#b71c1c', { rough: 0.5 }) : skin;
    if (gl) {
      this.add(j2, new THREE.SphereGeometry(0.082, 12, 10), handM, 0, -0.04, 0.005, 1, 1.05, 1.05);
      this.add(j1, new THREE.CylinderGeometry(0.062, 0.058, 0.1, 10), handM, 0, -LEN.fore + 0.04, 0);
      this.hands[n] = { fingers: null, thumb: null, glove: true };
    } else {
      this.add(j2, new THREE.BoxGeometry(0.078, 0.07, 0.04), handM, 0, -0.046, 0);
      const fingers = this.group(j2, 0, -0.082, 0);
      const fg = new THREE.BoxGeometry(0.018, 0.058, 0.021);
      for (let i = 0; i < 4; i++) this.add(fingers, fg, handM, (i - 1.5) * 0.0215, -0.027, 0);
      const thumb = this.group(j2, -side * 0.043, -0.03, 0.002);
      this.add(thumb, new THREE.BoxGeometry(0.021, 0.05, 0.022), handM, 0, -0.022, 0);
      this.hands[n] = { fingers, thumb, glove: false };
    }
    if (hands.kind === 'wraps') this.add(j1, new THREE.CylinderGeometry(0.056 * armT, 0.054 * armT, 0.17, 10), this.mat(hands.color || '#f2f2f2', { rough: 0.9 }), 0, -LEN.fore + 0.09, 0);
  }

  buildFoot(n, j1, j2, feet, skin, legT) {
    const shoes = feet.kind === 'shoes' || feet.kind === 'boots';
    const footM = shoes ? this.mat(feet.color || '#222', { rough: 0.6 }) : skin;
    const k = shoes ? 1.12 : 1;
    // heel / midfoot block, then a hinged toe block
    this.add(j2, new THREE.BoxGeometry(0.092 * k, 0.06 * k, 0.19), footM, 0, -ANKLE_H + 0.03 * k, 0.03);
    const toe = this.group(j2, 0, -ANKLE_H + 0.03, BALL_Z);
    this.add(toe, new THREE.BoxGeometry(0.092 * k, 0.04 * k, 0.078), footM, 0, 0.0, 0.039);
    this.add(toe, new THREE.SphereGeometry(0.02 * k, 8, 6), footM, 0, 0.0, 0.08, 2.3, 1, 1);
    if (feet.kind === 'boots') this.add(j1, new THREE.CylinderGeometry(0.075 * legT, 0.07 * legT, 0.2, 10), footM, 0, -LEN.shin + 0.1, 0);
    this.feet[n] = { toe };
  }

  buildFace(c, hs, skin) {
    const eyeM = this.mat(c.eyes || '#0d0d10', { rough: 0.3 });
    const glow = c.eyeGlow ? this.mat(c.eyeGlow, { basic: true }) : null;
    const white = this.mat('#ecebe6', { rough: 0.35 });
    const face = { eyes: [], brows: [], mouth: null, glow: !!glow };
    for (const s of [1, -1]) {
      const eg = this.group(this.head, s * 0.044 * hs, 0.15, 0.1 * hs);
      if (glow) {
        this.add(eg, new THREE.SphereGeometry(0.017 * hs, 8, 6), glow, 0, 0, 0.004, 1, 1, 0.6);
        face.eyes.push({ eg, pupil: null, lid: null });
      } else {
        this.add(eg, new THREE.SphereGeometry(0.021 * hs, 10, 8), white, 0, 0, 0.002, 1, 0.9, 0.55);
        const pupil = this.add(eg, new THREE.SphereGeometry(0.0105 * hs, 8, 6), eyeM, 0, 0, 0.0125 * hs, 1, 1, 0.5);
        const lid = this.add(this.head, new THREE.BoxGeometry(0.052 * hs, 0.02, 0.014), skin, s * 0.044 * hs, 0.172, 0.108 * hs);
        face.eyes.push({ eg, pupil, lid });
      }
      const br = this.add(this.head, new THREE.BoxGeometry(0.05 * hs, 0.011, 0.014), this.mat(c.hair?.color || '#111'), s * 0.045 * hs, 0.185, 0.106 * hs);
      br.rotation.z = -s * 0.28;
      face.brows.push({ mesh: br, s });
    }
    this.add(this.head, new THREE.BoxGeometry(0.03 * hs, 0.06 * hs, 0.03), skin, 0, 0.115, 0.115 * hs, 1, 1, 1);
    if (!glow) {
      const mouthM = this.mat('#4a1218', { rough: 0.5 });
      const mouth = this.add(this.head, new THREE.SphereGeometry(0.5, 10, 8), mouthM, 0, 0.082, 0.108 * hs, 0.044, 0.004, 0.014);
      face.mouth = mouth;
    }
    this.face = face;
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
    // a single cone / blob on a spring (base pivot, tip along +Y)
    const tuft = (geo, len, x, y, z, rx, rz, o = {}) => {
      const g = this.group(hd, x, y, z);
      g.rotation.x = rx; g.rotation.z = rz;
      g.userData.tail = new V3(0, len, 0);
      this.add(g, geo, m, 0, len / 2, 0);
      this.chains.push(new SpringChain([g], { w: o.w ?? 28, z: o.z ?? 0.45, g: o.g ?? 0.2, gain: o.gain ?? 0.8 }));
    };
    switch (h.style) {
      case 'bald': break;
      case 'spiky': {
        cap();
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2;
          const len = 0.17 * hs;
          tuft(new THREE.ConeGeometry(0.04 * hs, len, 6), len, Math.cos(a) * 0.07 * hs, 0.245 + (i % 2) * 0.02 - len / 2 + 0.01, Math.sin(a) * 0.07 * hs - 0.02, Math.sin(a) * 0.5, -Math.cos(a) * 0.5);
        }
        tuft(new THREE.ConeGeometry(0.05 * hs, 0.22 * hs, 6), 0.22 * hs, 0, 0.29 - 0.11 * hs, 0, 0, 0, { w: 24 });
        break;
      }
      case 'short': cap(1.02); break;
      case 'ponytail': {
        cap(1.02);
        this.hairTailChain = this.hangChain(hd, [0, 0.2, -0.1 * hs], [0.12, 0.12, 0.11], [0.04 * hs, 0.036 * hs, 0.03 * hs], m, { rotX: 0.25, w: 14, z: 0.35, g: 0.6 });
        break;
      }
      case 'long': {
        cap(1.05);
        this.hairTailChain = this.hangChain(hd, [0, 0.19, -0.09 * hs], [0.14, 0.14, 0.13, 0.12], [0.075 * hs, 0.07 * hs, 0.06 * hs, 0.05 * hs], m, { w: 12, z: 0.4, g: 0.7, sx: 1.2, sz: 0.6 });
        break;
      }
      case 'mohawk': {
        for (let i = 0; i < 6; i++) {
          const len = 0.16 * hs;
          tuft(new THREE.ConeGeometry(0.035 * hs, len, 6), len, 0, 0.245 - len / 2 + 0.01, 0.07 * hs - i * 0.03 * hs, -0.1 * (i - 2), 0, { w: 26 });
        }
        this.add(hd, new THREE.BoxGeometry(0.03 * hs, 0.04, 0.2 * hs), m, 0, 0.24, -0.01);
        break;
      }
      case 'buns': {
        cap(1.02);
        tuft(new THREE.SphereGeometry(0.06 * hs, 10, 8), 0.04, 0.09 * hs, 0.24, -0.02, 0, 0, { w: 22, gain: 0.6 });
        tuft(new THREE.SphereGeometry(0.06 * hs, 10, 8), 0.04, -0.09 * hs, 0.24, -0.02, 0, 0, { w: 22, gain: 0.6 });
        break;
      }
      case 'afro': this.add(hd, new THREE.SphereGeometry(0.17 * hs, 14, 12), m, 0, 0.2, -0.02, 1.0, 0.95, 1.0); break;
      case 'topknot': {
        cap(1.0);
        tuft(new THREE.SphereGeometry(0.05 * hs, 10, 8), 0.05, 0, 0.26, -0.02, 0, 0, { w: 20, gain: 0.7 });
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
        this.beltChain = this.hangChain(this.body, [0.07, 0.07, 0.115], [0.13, 0.13], [0.022, 0.02], cm({ rough: 0.8 }), { rotZ: 0.1, w: 15, z: 0.35, g: 0.55 });
        break;
      }
      case 'headband': {
        const b = this.add(this.head, new THREE.TorusGeometry(0.118 * hs, 0.016, 8, 20), cm({ rough: 0.8 }), 0, 0.19, 0, 1, 1, 1); b.rotation.x = Math.PI / 2; b.scale.set(0.97, 1.03, 1);
        this.hangChain(this.head, [0.04, 0.19, -0.125], [0.1, 0.1], [0.014, 0.012], cm({ rough: 0.8 }), { rotZ: -0.1, w: 17, z: 0.3, g: 0.5 });
        break;
      }
      case 'mongkhon': {
        const b = this.add(this.head, new THREE.TorusGeometry(0.12 * hs, 0.022, 8, 22), this.mat(col || '#f5f5f5', { rough: 0.9 }), 0, 0.2, 0);
        b.rotation.x = Math.PI / 2; b.scale.set(0.97, 1.03, 1);
        this.add(this.head, new THREE.SphereGeometry(0.02, 8, 6), this.mat('#d4a017', { rough: 0.3, metal: 0.8 }), 0, 0.2, 0.125 * hs);
        break;
      }
      case 'mask': { this.hasMouth = false; this.add(this.head, new THREE.SphereGeometry(0.119 * hs, 16, 12, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.32), cm({ rough: 0.9 }), 0, 0.135, 0.005, 0.96, 1.08, 1.02); break; }
      case 'ninja': {
        this.hasMouth = false;
        this.add(this.head, new THREE.SphereGeometry(0.122 * hs, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.86), cm({ rough: 0.9 }), 0, 0.135, -0.003, 0.97, 1.08, 1.03);
        this.add(this.head, new THREE.BoxGeometry(0.24 * hs, 0.05, 0.02), this.mat('#f2c94c'), 0, 0.185, 0.118 * hs);
        // eye slit: skin band sits behind the real eyes so they stay visible
        this.add(this.head, new THREE.BoxGeometry(0.16 * hs, 0.04, 0.01), this.mat('#e0b48a'), 0, 0.153, 0.099 * hs);
        this.hangChain(this.head, [0.0, 0.2, -0.12], [0.12, 0.12, 0.11], [0.03, 0.026, 0.022], cm({ rough: 0.9 }), { rotX: 0.2, w: 13, z: 0.35, g: 0.6 });
        break;
      }
      case 'armbands': for (const s of [1, -1]) { const b = this.add(this.chest, new THREE.TorusGeometry(0.065, 0.014, 6, 12), cm(), s * SH_X * shW, SH_Y - 0.13, 0); b.rotation.x = Math.PI / 2; } break;
      case 'glasses': {
        for (const s of [1, -1]) this.add(this.head, new THREE.CylinderGeometry(0.035 * hs, 0.035 * hs, 0.012, 12), this.mat(col || '#101820', { rough: 0.1, metal: 0.6 }), s * 0.048 * hs, 0.152, 0.116 * hs).rotation.x = Math.PI / 2;
        this.add(this.head, new THREE.BoxGeometry(0.1 * hs, 0.012, 0.012), this.mat('#111'), 0, 0.152, 0.118 * hs);
        break;
      }
      case 'scarf': {
        const b = this.add(this.neck, new THREE.TorusGeometry(0.075, 0.03, 8, 16), cm({ rough: 0.9 }), 0, -0.02, 0); b.rotation.x = Math.PI / 2;
        this.scarfChain = this.hangChain(this.chest, [0.03, 0.27, -0.13], [0.14, 0.14, 0.13], [0.032, 0.03, 0.028], cm({ rough: 0.9 }), { rotX: -0.1, w: 11, z: 0.3, g: 0.6 });
        break;
      }
      case 'shoulderpads': for (const s of [1, -1]) this.add(this.chest, new THREE.SphereGeometry(0.11, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), cm({ rough: 0.35, metal: 0.7 }), s * (SH_X * shW + 0.02), SH_Y + 0.015, 0, 1, 0.85, 1); break;
      case 'visor': this.hasMouth = false; this.add(this.head, new THREE.BoxGeometry(0.2 * hs, 0.05, 0.05), this.mat(col || '#00e5ff', { basic: true }), 0, 0.155, 0.1 * hs); break;
      case 'wings': {
        // bat-like wings: membrane shape + finger bones, each wing on a spring so it drags behind the body
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
        this.wingGroups = [];
        for (const s of [1, -1]) {
          const g = this.group(this.chest, s * 0.07, 0.2, -0.14);
          const inner = this.group(g); inner.scale.set(s * 1.25, 1.25, 1);
          inner.add(new THREE.Mesh(geo, wm));
          for (const [ex2, ey, w] of [[0.75, 0.75, 0.02], [0.95, 0.25, 0.015], [0.52, -0.2, 0.012]]) {
            const len = Math.hypot(ex2, ey);
            const b2 = new THREE.Mesh(new THREE.CylinderGeometry(w, w * 1.4, len, 5), bone);
            b2.position.set(ex2 / 2, ey / 2, 0.005); b2.rotation.z = Math.atan2(ex2, ey) * -1;
            inner.add(b2);
          }
          g.rotation.y = s * 0.55; g.rotation.z = s * 0.05;
          g.userData.tail = new V3(s * 0.9, 0.9, 0);
          this.wingGroups.push(g);
          const ch = new SpringChain([g], { w: 13, z: 0.4, g: 0.15, gain: 0.55 });
          this.wingChains.push(ch);
        }
        break;
      }
      case 'tail': { this.hangChain(this.body, [0, -0.08, -0.15], [0.15, 0.15, 0.15, 0.13], [0.03, 0.028, 0.024, 0.02], cm(), { rotX: -0.7, w: 11, z: 0.3, g: 0.7 }); break; }
      case 'earring': this.add(this.head, new THREE.TorusGeometry(0.02, 0.005, 6, 10), this.mat(col || '#f2c94c', { metal: 0.9, rough: 0.2 }), 0.11 * hs, 0.08, 0); break;
      case 'chain': { const b = this.add(this.chest, new THREE.TorusGeometry(0.12, 0.012, 6, 18), this.mat(col || '#f2c94c', { metal: 0.9, rough: 0.2 }), 0, 0.3, 0.02, 1.2, 1, 0.9); b.rotation.x = Math.PI / 2 + 0.3; break; }
      case 'sash': { const b = this.add(this.chest, this.capsule(0.03, 0.55), cm({ rough: 0.8 }), 0, 0.16, 0.135, 1, 1, 0.5); b.rotation.z = 0.7; break; }
      default:
    }
  }

  // ---------------------------------------------------------------- posing
  // torso transforms for a pose (shared by apply() and the reach solver)
  _torso(P) {
    const h = P.hips, hr = P.hipsRot;
    this.body.position.set(-h[0], h[1], h[2]);
    _eul.set(hr[0] * DEG, hr[1] * DEG, hr[2] * DEG, 'YXZ');
    this.body.quaternion.setFromEuler(_eul);
    const sp = P.spine, ch = P.chest;
    _eul.set(sp[0] * 0.45 * DEG, sp[1] * 0.45 * DEG, sp[2] * 0.45 * DEG, 'YXZ'); this.spine.quaternion.setFromEuler(_eul);
    _eul.set((sp[0] * 0.55 + ch[0]) * DEG, (sp[1] * 0.55 + ch[1]) * DEG, (sp[2] * 0.55 + ch[2]) * DEG, 'YXZ'); this.chest.quaternion.setFromEuler(_eul);
    this.body.updateMatrix(); this.spine.updateMatrix(); this.chest.updateMatrix();
    _mB.copy(this.body.matrix);
    _mS.copy(this.spine.matrix);
    _mC.copy(this.chest.matrix);
    _mAcc.multiplyMatrices(_mB, _mS).multiply(_mC);
    _qB.copy(this.body.quaternion);
    _qS.copy(_qB).multiply(this.spine.quaternion);
    _qC.copy(_qS).multiply(this.chest.quaternion);
  }

  // shoulder position (pose space) and chest orientation (mesh space) of a pose - used to carry hand targets with the torso
  shoulderFrame(P, key, outPos, outQuat) {
    this.jointRoot(P, key, outPos);
    outQuat.copy(_qC);
    return outPos;
  }

  // root-space position of a limb's root joint (shoulder / hip) in pose space [side, up, fwd]; key 'hd' = head centre
  jointRoot(P, key, out) {
    this._torso(P);
    if (key === 'hd') {
      _p0.set(0, NECK_Y + 0.14, 0).applyMatrix4(_mAcc);
      out[0] = -_p0.x; out[1] = _p0.y; out[2] = _p0.z;
      return out;
    }
    const L = this.limbs[key];
    _p0.copy(L.root);
    let base = _mB;
    if (L.arm) { const sh = key === 'hL' ? P.shL : P.shR; _p0.y += sh[1]; _p0.z += sh[0]; base = _mAcc; }
    _p0.applyMatrix4(base);
    out[0] = -_p0.x; out[1] = _p0.y; out[2] = _p0.z;
    return out;
  }

  // pole vector (limb-local, as stored in P.elbowPole / P.kneePole) that makes the elbow / knee of limb `key` bend toward the
  // point E (pose space).  Needs the pelvis-space limb target of the pose (call after finalize()).
  poleToward(P, key, E, out) {
    this._torso(P);
    const L = this.limbs[key];
    _p0.copy(L.root);
    let base = _mB, qb = _qB;
    if (L.arm) { const sh = key === 'hL' ? P.shL : P.shR; _p0.y += sh[1]; _p0.z += sh[0]; base = _mAcc; qb = _qC; }
    _p0.applyMatrix4(base);
    const t = P[key];
    _tg.set(-t[0], t[1], t[2]).applyMatrix4(_mB);
    _lk.set(-E[0], E[1], E[2]).sub(_hc.addVectors(_p0, _tg).multiplyScalar(0.5));
    _qI.copy(qb).invert();
    _lk.applyQuaternion(_qI);
    const n = _lk.length() || 1;
    out[0] = _lk.x * L.side / n; out[1] = _lk.y / n; out[2] = _lk.z / n;
    return out;
  }

  // pose: see pose.js.  hips/hipsRot/spine/chest/head rotations in degrees; limb targets in pelvis space (finalize() fills them)
  apply(P) {
    this._torso(P);

    // ---- neck / head: authored rotation blended with an optional look-at
    const hd = P.head, ha = P.headAdd;
    let haveLook = false, lookW = 0;
    _eul.set(hd[0] * DEG, hd[1] * DEG, hd[2] * DEG, 'YXZ'); _qH.setFromEuler(_eul);
    if (P.lookT && P.lookW > 0.001) {
      _hc.set(0, NECK_Y + 0.14, 0).applyMatrix4(_mAcc);             // head centre in root (mesh) space
      _lk.set(-P.lookT[0], P.lookT[1], P.lookT[2]).sub(_hc);
      const dl = _lk.length();
      if (dl > 1e-4) {
        _lk.divideScalar(dl);
        const yaw = Math.atan2(_lk.x, _lk.z), pitch = -Math.asin(clamp(_lk.y, -1, 1));
        _eul2.set(pitch, yaw, 0, 'YXZ');
        _qL.setFromEuler(_eul2);
        _qI.copy(_qC).invert();
        _qL.premultiply(_qI);                                        // look rotation relative to the chest
        // clamp yaw / pitch relative to the chest
        _eul2.setFromQuaternion(_qL, 'YXZ');
        const ly = clamp(_eul2.y, -75 * DEG, 75 * DEG), lp = clamp(_eul2.x, -42 * DEG, 38 * DEG);
        _qLw.copy(_qL);                                              // wanted gaze (relative to the chest), before clamping
        _eul2.set(lp, ly, 0, 'YXZ');
        _qL.setFromEuler(_eul2);
        _qH.slerp(_qL, clamp(P.lookW, 0, 1));
        lookW = clamp(P.lookW, 0, 1); haveLook = true;
      }
    }
    _eul.set(ha[0] * DEG, ha[1] * DEG, ha[2] * DEG, 'YXZ'); _qTmp.setFromEuler(_eul);
    _qH.multiply(_qTmp);
    const ne = P.neck;
    _eul.set(ne[0] * DEG, ne[1] * DEG, ne[2] * DEG, 'YXZ'); _qN.setFromEuler(_eul);
    // neck takes ~40% of the head rotation, head the rest
    _qL.identity().slerp(_qH, 0.4);
    this.neck.quaternion.copy(_qL).multiply(_qN);
    this.head.quaternion.copy(_qL).invert().multiply(_qH);
    // the eyes take up whatever the head could not (or was not allowed to) turn: gaze = wanted look in head space
    if (haveLook && lookW > 0.05) {
      _qTmp.copy(_qL).multiply(_qN).multiply(this.head.quaternion);          // final head rotation relative to the chest
      _qI.copy(_qTmp).invert().multiply(_qLw);
      _eul2.setFromQuaternion(_qI, 'YXZ');
      this.gazeAuto[0] = clamp(_eul2.y / DEG, -26, 26) * lookW; this.gazeAuto[1] = clamp(_eul2.x / DEG, -18, 20) * lookW;
    } else { this.gazeAuto[0] *= 0.8; this.gazeAuto[1] *= 0.8; }

    // ---- limbs
    for (const key of ['hL', 'hR', 'fL', 'fR']) {
      const L = this.limbs[key];
      const t = P[key];
      _tg.set(-t[0], t[1], t[2]).applyMatrix4(_mB);
      let mBase, qBase;
      _p0.copy(L.root);
      if (L.arm) {
        const sh = key === 'hL' ? P.shL : P.shR;
        _p0.y += sh[1]; _p0.z += sh[0];
        L.clav.position.set(L.root.x, L.root.y + sh[1], sh[0]);
        mBase = _mAcc; qBase = _qC;
      } else { mBase = _mB; qBase = _qB; }
      _p0.applyMatrix4(mBase);
      if (L.arm) { const ep = P.strikeArm === key ? P.elbowPoleS : P.elbowPole; _pole.set(L.side * ep[0], ep[1], ep[2]); }
      else { const kp = P.strikeLeg === key ? P.kneePoleS : P.kneePole; _pole.set(L.side * kp[0], kp[1], kp[2]); }
      _pole.applyQuaternion(qBase);
      const phi = solveTwoBone(_p0, _tg, _pole, L.L1, L.L2, _q0, L.ik || (L.ik = { pv: new V3(), has: false }), this.ikStep);
      _qPar.copy(qBase).invert();
      L.j0.quaternion.copy(_qPar).multiply(_q0);
      L.j1.quaternion.setFromAxisAngle(AX, phi);
      if (L.arm) {
        const w = key === 'hL' ? P.wristL : P.wristR;
        _eul.set(w[0] * DEG, w[1] * DEG, w[2] * DEG, 'YXZ');
        L.j2.quaternion.setFromEuler(_eul);
        const hnd = this.hands[key[1]];
        if (hnd && hnd.fingers) {
          const f = clamp(key === 'hL' ? P.fist[0] : P.fist[1], 0, 1);
          hnd.fingers.rotation.x = (f * 105 + 4) * DEG;
          hnd.thumb.rotation.x = (f * 55) * DEG; hnd.thumb.rotation.z = -L.side * (1 - f) * 0.5;
        }
      } else {
        // foot orientation lives in ROOT space (soles stay flat on the floor regardless of the pelvis)
        _qBend.setFromAxisAngle(AX, phi);
        _qTmp.copy(_q0).multiply(_qBend).invert();
        const ft = key === 'fL' ? P.footL : P.footR;
        const ap = ft[0] + (key === 'fL' ? P.ankle[0] : P.ankle[1]);
        _eul.set(ap * DEG, ft[1] * DEG, ft[2] * DEG, 'YXZ');
        _qFoot.setFromEuler(_eul);
        L.j2.quaternion.copy(_qTmp).multiply(_qFoot);
        const tb = this.feet[key[1]];
        if (tb) tb.toe.rotation.x = -(key === 'fL' ? P.toe[0] : P.toe[1]) * DEG;
      }
    }
    this.setFace(P);
  }

  setFace(P) {
    const F = this.face;
    if (!F) return;
    const blink = clamp(P.blink + P.squint * 0.55, 0, 1);
    const g = P.gaze;
    for (const e of F.eyes) {
      if (e.lid) {
        const hgt = Math.max(0.002, 0.044 * blink);
        e.lid.scale.y = hgt / 0.02;
        e.lid.position.y = 0.173 - hgt / 2;
      }
      if (e.eg) { e.eg.rotation.y = (g[0] + this.gazeAuto[0]) * DEG; e.eg.rotation.x = (g[1] + this.gazeAuto[1]) * DEG; }
    }
    for (const b of F.brows) {
      b.mesh.rotation.z = -b.s * (0.28 + 0.38 * P.brow);
      b.mesh.position.y = 0.185 + 0.012 * P.browUp - 0.004 * Math.max(0, P.brow);
    }
    if (F.mouth) {
      F.mouth.visible = this.hasMouth;
      const open = clamp(P.mouth, 0, 1);
      F.mouth.scale.set(0.044 + 0.012 * open, 0.004 + 0.034 * open, 0.012 + 0.006 * open);
      F.mouth.position.y = 0.082 - 0.008 * open;
    }
  }

  resetIK() { for (const k in this.limbs) if (this.limbs[k].ik) this.limbs[k].ik.has = false; }

  // wing flap: angle 0 = relaxed, 1 = spread wide; called by the animator (spring chains add the lag on top)
  setWings(spread, flap) {
    if (!this.wingGroups) return;
    this.wingGroups.forEach((g, i) => {
      const s = i === 0 ? 1 : -1;
      const ch = this.wingChains[i];
      _eul.set(0, s * (0.55 + 0.5 * spread) , s * (0.05 + 0.5 * flap), 'YXZ');
      ch.bones[0].restQ.setFromEuler(_eul);
      g.quaternion.copy(ch.bones[0].restQ);
    });
  }

  // run spring chains (call after the root transform has been applied)
  dynamics(dt, sc = 1, teleport = false) {
    if (teleport) { for (const c of this.chains) c.reset(); for (const c of this.wingChains) c.reset(); }
    if (!this.chains.length && !this.wingChains.length) return;
    this.root.updateMatrixWorld(true);
    for (const c of this.chains) c.update(dt, sc);
    for (const c of this.wingChains) c.update(dt, sc);
  }

  // world position of an anchor (for FX)
  anchorWorld(name, out = new V3()) {
    const a = this.anchor[name];
    if (!a) return out.set(0, 0, 0);
    a.updateWorldMatrix(true, false);
    return out.setFromMatrixPosition(a.matrixWorld);
  }

  // sample points of a foot in ANKLE-local space (heel, ball, toe tip) - used by tests
  footPoints() { return [[0, -ANKLE_H, -0.06], [0, -ANKLE_H, BALL_Z], [0, -ANKLE_H, BALL_Z + 0.09]]; }

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
