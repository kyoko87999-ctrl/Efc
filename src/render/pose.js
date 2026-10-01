// Pose data structure + helpers (independent of the three.js scene graph, but uses its math for rotations).
//
// A pose is a flat set of small arrays.  Limb targets (hands / feet) are authored in ROOT space
// ([side(+right), up, fwd], feet on the floor = y 0, "foot" = ankle position over the sole) in `_r`,
// and converted to pelvis space by finalize() so pelvis rotations (flips, spins, lying down) keep the IK working.
import * as THREE from 'three';
import { DEG, clamp, lerp } from '../util.js';
import { ANKLE_H, BALL_Z } from './skel.js';

export function newPose() {
  return {
    hips: [0, 0.91, 0.02], hipsRot: [3, -6, 0], spine: [7, -12, 0], chest: [0, 0, 0], neck: [0, 0, 0], head: [-4, 5, 0], headAdd: [0, 0, 0],
    hL: [0, 0, 0], hR: [0, 0, 0], fL: [0, 0, 0], fR: [0, 0, 0],          // pelvis space (derived by finalize)
    _r: {},                                                               // root-space targets: hL hR fL fR
    kneePole: [0.12, 0.05, 1.0], elbowPole: [0.55, -0.7, -0.45],          // multiplied by the limb side on x
    kneePoleS: [0.12, 0.05, 1.0], elbowPoleS: [0.55, -0.7, -0.45],        // pole vectors of the striking limb (P.strikeArm / P.strikeLeg)
    strikeArm: null, strikeLeg: null,
    ankle: [0, 0],                                                        // legacy ankle pitch (deg), added to footL/R pitch
    wristL: [0, 0, 0], wristR: [0, 0, 0],
    shL: [0, 0], shR: [0, 0],                                             // shoulder girdle offsets [fwd, up]
    footL: [0, 0, 0], footR: [0, 0, 0],                                   // root-space foot orientation [pitch, yaw, roll] deg
    toe: [0, 0],                                                          // toe bend, deg (+ = toes up)
    fist: [0.5, 0.5],                                                     // 0 open hand .. 1 closed fist (L, R)
    gaze: [0, 0],                                                         // eye yaw / pitch relative to the head (deg)
    lookW: 1, blink: 0, mouth: 0, brow: 0, browUp: 0, squint: 0,
    rootYaw: 0, rootPitch: 0, rootRoll: 0, rootY: 0, rootFwd: 0, rootSide: 0, rootPivot: 0,   // root pitch / roll turn about the point (0, rootPivot, 0)
    squash: 0,                                                            // + stretch / - squash of the whole body (-0.2 .. 0.2)
    lookT: null,                                                          // optional root-space look-at target [side, up, fwd]
    reach: null,                                                          // optional reach-solver spec for the striking limb
  };
}

// every numeric channel: [key, length, isAngle]
export const VEC = [
  ['hips', 3, 0], ['hipsRot', 3, 1], ['spine', 3, 1], ['chest', 3, 1], ['neck', 3, 1], ['head', 3, 1], ['headAdd', 3, 1],
  ['kneePole', 3, 0], ['elbowPole', 3, 0], ['kneePoleS', 3, 0], ['elbowPoleS', 3, 0], ['ankle', 2, 1], ['wristL', 3, 1], ['wristR', 3, 1],
  ['shL', 2, 0], ['shR', 2, 0], ['footL', 3, 1], ['footR', 3, 1], ['toe', 2, 1], ['fist', 2, 0], ['gaze', 2, 1],
];
export const SCALARS = ['lookW', 'blink', 'mouth', 'brow', 'browUp', 'squint', 'rootYaw', 'rootPitch', 'rootRoll', 'rootY', 'rootFwd', 'rootSide', 'rootPivot', 'squash'];
export const SCALAR_ANGLE = new Set(['rootYaw', 'rootPitch', 'rootRoll']);
export const R_KEYS = ['hL', 'hR', 'fL', 'fR'];

const DEFAULT = newPose();
export function clonePose(p) { return copyPose(newPose(), p); }
// reset a pose to the neutral defaults without allocating
export function resetPose(P) { copyPose(P, DEFAULT); P.reach = null; P.strikeArm = null; P.strikeLeg = null; for (const k of R_KEYS) P._r[k] = null; return P; }

export function copyPose(o, p) {
  for (const [k, n] of VEC) { const a = o[k], b = p[k]; for (let i = 0; i < n; i++) a[i] = b[i]; }
  for (const k of SCALARS) o[k] = p[k];
  for (const k of R_KEYS) {
    if (p._r[k]) { if (!o._r[k]) o._r[k] = [0, 0, 0]; o._r[k][0] = p._r[k][0]; o._r[k][1] = p._r[k][1]; o._r[k][2] = p._r[k][2]; } else o._r[k] = null;
    const a = o[k], b = p[k]; a[0] = b[0]; a[1] = b[1]; a[2] = b[2];
  }
  o.lookT = p.lookT ? p.lookT.slice() : null;
  o.strikeArm = p.strikeArm; o.strikeLeg = p.strikeLeg;
  return o;
}

// plain lerp (used for authored sequences such as get-up); angles are lerped linearly (poses are authored to be continuous)
export function lerpPose(out, a, b, t) {
  for (const [k, n] of VEC) for (let i = 0; i < n; i++) out[k][i] = a[k][i] + (b[k][i] - a[k][i]) * t;
  for (const k of SCALARS) out[k] = a[k] + (b[k] - a[k]) * t;
  for (const k of R_KEYS) {
    const ra = a._r[k], rb = b._r[k];
    if (ra && rb) { if (!out._r[k]) out._r[k] = [0, 0, 0]; for (let i = 0; i < 3; i++) out._r[k][i] = ra[i] + (rb[i] - ra[i]) * t; }
    else out._r[k] = (rb || ra) ? (rb || ra).slice() : null;
    for (let i = 0; i < 3; i++) out[k][i] = a[k][i] + (b[k][i] - a[k][i]) * t;
  }
  out.lookT = b.lookT || a.lookT;
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

// pelvis space -> root space (inverse of r2b)
export function b2r(pose, p, out) {
  const h = pose.hips, r = pose.hipsRot;
  _v.set(-p[0], p[1], p[2]);
  _e.set(r[0] * DEG, r[1] * DEG, r[2] * DEG, 'YXZ');
  _q.setFromEuler(_e);
  _v.applyQuaternion(_q);
  out[0] = -_v.x + h[0]; out[1] = _v.y + h[1]; out[2] = _v.z + h[2];
  return out;
}

// ankle joint height for a foot whose ball (pitch > 0, heel raised) or heel (pitch < 0) is on the floor
export function ankleLift(pitchDeg) {
  const a = pitchDeg * DEG, c = Math.cos(a), s = Math.abs(Math.sin(a));
  return ANKLE_H * c + (pitchDeg >= 0 ? BALL_Z : 0.06) * s;
}

// make sure every limb has a root-space target (poses authored in pelvis space get converted)
export function canon(P) {
  for (const k of R_KEYS) if (!P._r[k]) P._r[k] = b2r(P, P[k], [0, 0, 0]);
  return P;
}

// convert every root-space target into pelvis space (call after hips / hipsRot are final)
export function finalize(P) {
  for (const k of ['hL', 'hR']) if (P._r[k]) r2b(P, P._r[k], P[k]);
  for (const k of ['fL', 'fR']) {
    const t = P._r[k];
    if (!t) continue;
    const pitch = (k === 'fL' ? P.footL[0] : P.footR[0]) + (k === 'fL' ? P.ankle[0] : P.ankle[1]);
    // feet are authored as "ankle over the sole": lift the ankle when the heel / toes are raised
    _a3[0] = t[0]; _a3[1] = t[1] + ankleLift(pitch); _a3[2] = t[2];
    r2b(P, _a3, P[k]);
  }
  return P;
}
const _a3 = [0, 0, 0];

// the striking-limb poles default to the guard poles so a strike starts from the pose the arm / leg is already in
export function syncPoles(P) { cp3(P.elbowPoleS, P.elbowPole); cp3(P.kneePoleS, P.kneePole); return P; }

export const add3 = (a, x, y, z) => { a[0] += x; a[1] += y; a[2] += z; return a; };
export const set3 = (a, x, y, z) => { a[0] = x; a[1] = y; a[2] = z; return a; };
export const cp3 = (a, b) => { a[0] = b[0]; a[1] = b[1]; a[2] = b[2]; return a; };
export { clamp, lerp, DEG };
