// Pose data structure + helpers (independent of three.js scene graph, but uses its math for rotations).
import * as THREE from 'three';
import { DEG, clamp, lerp } from '../util.js';

export function newPose() {
  return {
    hips: [0, 0.91, 0.02], hipsRot: [3, -6, 0], spine: [7, -12, 0], head: [-4, 5, 0],
    hL: [0, 0, 0], hR: [0, 0, 0], fL: [0, 0, 0], fR: [0, 0, 0],
    kneePole: null, elbowPole: null, ankle: [0, 0], wrist: null,
    _r: {},
    rootYaw: 0, rootPitch: 0, rootRoll: 0, rootY: 0, rootFwd: 0, rootSide: 0,
  };
}

const KEYS3 = ['hips', 'hipsRot', 'spine', 'head', 'hL', 'hR', 'fL', 'fR'];

export function clonePose(p) {
  const o = newPose();
  copyPose(o, p);
  return o;
}

export function copyPose(o, p) {
  for (const k of KEYS3) { o[k][0] = p[k][0]; o[k][1] = p[k][1]; o[k][2] = p[k][2]; }
  o.ankle[0] = p.ankle[0]; o.ankle[1] = p.ankle[1];
  o.kneePole = p.kneePole ? p.kneePole.slice() : null;
  o.elbowPole = p.elbowPole ? p.elbowPole.slice() : null;
  o.wrist = p.wrist ? p.wrist.slice() : null;
  o.rootYaw = p.rootYaw; o.rootPitch = p.rootPitch; o.rootRoll = p.rootRoll; o.rootY = p.rootY; o.rootFwd = p.rootFwd; o.rootSide = p.rootSide;
  return o;
}

export function lerpPose(out, a, b, t) {
  for (const k of KEYS3) for (let i = 0; i < 3; i++) out[k][i] = a[k][i] + (b[k][i] - a[k][i]) * t;
  out.ankle[0] = lerp(a.ankle[0], b.ankle[0], t); out.ankle[1] = lerp(a.ankle[1], b.ankle[1], t);
  out.kneePole = b.kneePole || a.kneePole;
  out.elbowPole = b.elbowPole || a.elbowPole;
  out.wrist = b.wrist || a.wrist;
  out.rootYaw = lerp(a.rootYaw, b.rootYaw, t); out.rootPitch = lerp(a.rootPitch, b.rootPitch, t); out.rootRoll = lerp(a.rootRoll, b.rootRoll, t);
  out.rootY = lerp(a.rootY, b.rootY, t); out.rootFwd = lerp(a.rootFwd, b.rootFwd, t); out.rootSide = lerp(a.rootSide, b.rootSide, t);
  return out;
}

const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ');

// root-space [side, up, fwd] -> pelvis space (uses the pose's hips transform)
export function r2b(pose, p, out) {
  const h = pose.hips, r = pose.hipsRot;
  _v.set(-(p[0] - h[0]), p[1] - h[1], p[2] - h[2]);
  _e.set(r[0] * DEG, r[1] * DEG, r[2] * DEG, 'YXZ');
  _q.setFromEuler(_e).invert();
  _v.applyQuaternion(_q);
  out[0] = -_v.x; out[1] = _v.y; out[2] = _v.z;
  return out;
}

// convert every root-space target into body space (call after hips/hipsRot are final)
export function finalize(P) {
  for (const k of ['hL', 'hR', 'fL', 'fR']) if (P._r[k]) r2b(P, P._r[k], P[k]);
  return P;
}

export const add3 = (a, x, y, z) => { a[0] += x; a[1] += y; a[2] += z; return a; };
export const set3 = (a, x, y, z) => { a[0] = x; a[1] = y; a[2] = z; return a; };
export const cp3 = (a, b) => { a[0] = b[0]; a[1] = b[1]; a[2] = b[2]; return a; };
export { clamp, lerp, DEG };
