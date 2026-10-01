// State poses (everything except attacks).  A pose function receives the animation context C and a reset pose P and authors
// the target pose for the current simulation state.  Limb targets are authored in ROOT space (feet on the floor = y 0) in P._r;
// poses of lying / airborne bodies are authored in PELVIS space (P.hL ...) and converted by canon().
//
// C: { f, ch, R (rest), T (s), sub (sub-frame offset for integer counters), root, mark(P), pin, tmp(i), gait }
import { set3, add3, copyPose, lerpPose, resetPose, canon } from './pose.js';
import { ST } from '../sim/fighter.js';
import { clamp, lerp, easeOut, easeInOut, smooth } from '../util.js';

export const cl01 = (v) => clamp(v, 0, 1);
export const tf = (C, n) => Math.max(0, n + C.sub);
const ph = (t, a, b) => cl01((t - a) / Math.max(1e-6, b - a));          // 0..1 progress of t inside [a, b]
const L3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// ------------------------------------------------------------------------------------------------ base postures
export function stand(C, P) {
  const R = C.R, I = C.ch.idle || {}, T = C.T;
  set3(P.hips, 0, I.hips ?? 0.90, 0.02);
  set3(P.hipsRot, 3, I.hipsYaw ?? -6, 0);
  set3(P.spine, 7, I.spineYaw ?? -12, 0);
  set3(P.head, -4, 5, 0);
  P._r.hL = R.hL.slice(); P._r.hR = R.hR.slice(); P._r.fL = R.fL.slice(); P._r.fR = R.fR.slice();
  P.kneePole = [0.12, 0.05, 1.0]; P.elbowPole = [0.55, -0.7, -0.45];
  P.fist = [0.62, 0.62]; P.shL = [0.015, 0.012]; P.shR = [0.015, 0.012];
  P.footL[1] = 4; P.footR[1] = -26;
  if (I.hands === 'high') { P._r.hL[1] += 0.14; P._r.hR[1] += 0.16; P._r.hL[2] += 0.06; P._r.hR[2] += 0.08; }
  if (I.hands === 'low') { P._r.hL[1] -= 0.30; P._r.hR[1] -= 0.30; P._r.hL[0] -= 0.06; P._r.hR[0] += 0.06; P.fist = [0.35, 0.35]; P.elbowPole = [0.6, -0.9, -0.2]; }
  if (I.hands === 'wide') { P._r.hL = [-0.55, 1.05, 0.25]; P._r.hR = [0.55, 1.05, 0.25]; P.elbowPole = [0.8, -0.5, -0.3]; }
  if (I.bounce) {
    // bouncing on the balls of the feet: heels alternately lifted
    const b = Math.sin(T * (I.bounceSpeed ?? 9));
    P.hips[1] += Math.abs(b) * I.bounce;
    P.footL[0] += 14 * Math.max(0, b); P.footR[0] += 14 * Math.max(0, -b);
    P._r.fL[1] += Math.max(0, b) * I.bounce * 0.8; P._r.fR[1] += Math.max(0, -b) * I.bounce * 0.8;
    P.toe[0] += 8 * Math.max(0, b); P.toe[1] += 8 * Math.max(0, -b);
  }
  if (I.sway) {
    const s = Math.sin(T * (I.swaySpeed ?? 2.2));
    P.hips[0] += s * I.sway; P.hipsRot[2] += s * 6; P._r.fL[0] += s * I.sway * 1.6; P._r.fR[0] += s * I.sway * 1.6;
    P._r.fL[2] += Math.cos(T * (I.swaySpeed ?? 2.2)) * I.sway * 1.5; P._r.fR[2] -= Math.cos(T * (I.swaySpeed ?? 2.2)) * I.sway * 1.5;
  }
  C.mark(P);
  return P;
}

export function crouch(C, P, depth = 1) {
  stand(C, P);
  const d = depth, wide = (C.ch.idle || {}).hands === 'wide';
  P.hips[1] -= 0.36 * d; P.hips[2] -= 0.02 * d;
  P.hipsRot[0] += 5 * d; P.spine[0] += 13 * d; P.spine[1] += 2 * d; P.head[0] -= 10 * d;
  P._r.fL = L3(P._r.fL, [-0.22, 0, 0.26], d); P._r.fR = L3(P._r.fR, [0.22, 0, -0.10], d);
  P._r.hL = L3(P._r.hL, wide ? [-0.5, 0.9, 0.2] : [-0.20, 0.98, 0.36], d); P._r.hR = L3(P._r.hR, wide ? [0.5, 0.9, 0.2] : [0.16, 0.93, 0.28], d);
  P.kneePole = [0.12 + 0.13 * d, 0.0, 1.0];
  P.footL[0] += 0; P.shL[1] += 0.01 * d; P.shR[1] += 0.01 * d;
  C.mark(P);
  return P;
}

// lying on the floor (pelvis-space limbs).  faceUp: on the back, head away from the opponent
export function lying(C, P, faceUp = true) {
  const s = faceUp ? 1 : -1;
  set3(P.hips, 0, 0.20, 0.0);
  set3(P.hipsRot, -90 * s, 0, 0);
  set3(P.spine, 0, 0, 0); set3(P.chest, 0, 0, 0);
  set3(P.head, faceUp ? -8 : 20, 0, 0);
  for (const k of ['hL', 'hR', 'fL', 'fR']) P._r[k] = null;
  set3(P.hL, -0.34, 0.0, 0.03 * s); set3(P.hR, 0.34, 0.0, 0.03 * s);
  set3(P.fL, -0.13, -0.84, 0.02); set3(P.fR, 0.13, -0.84, 0.02);
  P.kneePole = [0.1, 0, 1]; P.elbowPole = [0.4, 0.1, -0.9];
  P.fist = [0.2, 0.2]; P.shL = [0, 0]; P.shR = [0, 0];
  P.footL[0] = 12; P.footR[0] = 12;
  return P;
}

// ------------------------------------------------------------------------------------------------ locomotion
export function idlePose(C, P) {
  const f = C.f;
  if (f.stance && C.ch.stances && C.ch.stances[f.stance]) { stand(C, P); stancePose(C, P, C.ch.stances[f.stance]); return P; }
  if (f.crouch) crouch(C, P, 1); else stand(C, P);
  if (f.crouch) C.gait.mode = 'lock';
  const hi = (f.guard && !f.crouch) || f.guard === 'crouch';
  if (f.guard && !f.crouch) { P._r.hL = [-0.13, 1.5, 0.38]; P._r.hR = [0.10, 1.43, 0.36]; add3(P.spine, 4, 0, 0); P.fist = [0.8, 0.8]; P.elbowPole = [0.4, -0.9, -0.1]; }
  if (f.guard === 'crouch') { P._r.hL = [-0.13, 1.12, 0.38]; P._r.hR = [0.1, 1.06, 0.36]; P.fist = [0.8, 0.8]; }
  void hi;
  if (!f.crouch && (f.walkDir || f.sideWalk)) {
    const w = f.walkDir;
    if (w) { add3(P.spine, w > 0 ? 3.5 : -2, 0, 0); add3(P.hips, 0, 0, 0.012 * w); add3(P.hipsRot, w > 0 ? 1.5 : -1, 0, 0); C.gait.amt = 0.35; C.gait.T = w > 0 ? 8 : 9; }
    else { C.gait.amt = 0.2; C.gait.T = 8; add3(P.spine, 0, 0, -f.sideWalk * 2); }
  }
  return P;
}

function stancePose(C, P, sd) {
  const L = sd.look || {};
  const T = C.T;
  if (L.hips) set3(P.hips, L.hips[0], L.hips[1], L.hips[2]);
  if (L.hipsRot) set3(P.hipsRot, L.hipsRot[0], L.hipsRot[1], L.hipsRot[2]);
  if (L.spine) set3(P.spine, L.spine[0], L.spine[1], L.spine[2]);
  if (L.head) set3(P.head, L.head[0], L.head[1], L.head[2]);
  for (const k of ['hL', 'hR', 'fL', 'fR']) if (L[k]) P._r[k] = L[k].slice();
  if (L.kneePole) P.kneePole = L.kneePole;
  if (L.bob) { const b = Math.sin(T * 3.1) * L.bob; P.hips[1] += b; P._r.hL[1] += b; P._r.hR[1] -= b; }
  if (L.sway) { const s = Math.sin(T * 2.4) * L.sway; P.hips[0] += s; P.hipsRot[2] += s * 30; }
  if (C.f.walkDir) { C.gait.amt = 0.3; C.gait.T = 9; }
  C.mark(P);
  return P;
}

export function dashPose(C, P, back) {
  const f = C.f, R = C.R;
  const t = cl01(tf(C, f.stT) / 24);
  stand(C, P);
  if (!back) {
    const lean = 20 * (1 - easeOut(t) * 0.55);
    add3(P.hipsRot, lean * 0.4, 0, 0); add3(P.spine, lean, 0, 0);
    P.hips[1] -= 0.06; P.hips[2] += 0.05;
    P._r.hL = [-0.2, 1.12, 0.24]; P._r.hR = [0.2, 1.12, 0.22];
    P.fist = [0.7, 0.7];
    C.gait.T = 6.5; C.gait.lift = 0.17; C.gait.amt = 0.8; C.gait.settle = 0.34;
  } else {
    // hop backwards: push off, glide with the feet just above the floor, absorb the landing
    const hop = Math.sin(Math.PI * ph(t, 0.08, 0.92));
    add3(P.hipsRot, -6 * hop, 0, 0); add3(P.spine, -5 * hop, 0, 0);
    P.hips[1] += 0.035 * hop - 0.035 * (1 - hop) * 0.7;
    P._r.fL = [R.fL[0], 0.15 * hop, R.fL[2] - 0.20 * hop]; P._r.fR = [R.fR[0], 0.17 * hop, R.fR[2] - 0.2 * hop];
    P.footL[0] += 20 * hop; P.footR[0] += 20 * hop; P.toe[0] += 10 * hop; P.toe[1] += 10 * hop;
    P._r.hL[1] -= 0.04 * hop; P._r.hR[1] -= 0.04 * hop;
    C.gait.mode = hop > 0.12 ? 'free' : 'slide';
  }
  C.mark(P);
  return P;
}

export function runPose(C, P) {
  stand(C, P);
  add3(P.hipsRot, 8, 0, 0); add3(P.spine, 18, 0, 0); P.head[0] += 6;
  P.hips[1] -= 0.08; P.hips[2] += 0.07;
  P._r.hL = [-0.2, 1.12, 0.28]; P._r.hR = [0.2, 1.12, 0.28];
  P.elbowPole = [0.45, -0.9, -0.3]; P.fist = [0.75, 0.75];
  C.gait.T = 7; C.gait.lift = 0.2; C.gait.amt = 1; C.gait.settle = 0.4;
  C.mark(P);
  return P;
}

export function sidestepPose(C, P) {
  const f = C.f;
  const t = cl01(tf(C, f.stT) / 22);
  const sg = (f.idx === 0 ? -1 : 1) * (f.ssSgn || 1);   // + = toward the fighter's right
  const k = Math.sin(Math.PI * cl01(t * 1.1));
  stand(C, P);
  P.hips[1] -= 0.06 * k; P.hips[0] += sg * 0.05 * k;
  add3(P.hipsRot, 4 * k, -sg * 10 * k, sg * 6 * k);
  add3(P.spine, 6 * k, 0, -sg * 5 * k);
  C.gait.T = 7; C.gait.lift = 0.1; C.gait.amt = 0.2; C.gait.settle = 0.3;
  C.mark(P);
  return P;
}

export function jumpPose(C, P) {
  const f = C.f;
  stand(C, P);
  // tuck while rising, reach for the floor while falling
  const u = cl01(0.5 - f.vy / 0.2);
  set3(P.hips, 0, 0.90, 0.02);
  add3(P.hipsRot, 4 * f.jumpDir, 0, 0); add3(P.spine, 8 - 6 * u, 0, 0);
  P._r.fL = L3([-0.13, 0.30, 0.20], [-0.15, 0.10, 0.26], u); P._r.fR = L3([0.13, 0.34, -0.04], [0.15, 0.12, -0.10], u);
  P.footL[0] += 30 - 25 * u; P.footR[0] += 36 - 28 * u;
  P._r.hL = L3([-0.28, 1.2, 0.30], [-0.34, 1.05, 0.26], u); P._r.hR = L3([0.26, 1.2, 0.28], [0.34, 1.05, 0.24], u);
  P.fist = [0.6, 0.6];
  P.kneePole = [0.2, 0, 1];
  C.gait.mode = 'free';
  C.mark(P);
  return P;
}

export function landPose(C, P) {
  const f = C.f, k = cl01(1 - tf(C, f.stT) / 5);
  crouch(C, P, 0.7 * k + 0.1);
  return P;
}

// ------------------------------------------------------------------------------------------------ reactions
export function blockPose(C, P) {
  const f = C.f;
  const cr = f.blkCrouch;
  if (cr) crouch(C, P, 0.9); else stand(C, P);
  P._r.hL = [-0.13, cr ? 1.12 : 1.50, 0.38]; P._r.hR = [0.10, cr ? 1.06 : 1.43, 0.36];
  P.elbowPole = [0.35, -0.9, -0.1]; P.fist = [0.85, 0.85];
  add3(P.spine, 5, 0, 0); add3(P.head, -8, 0, 0); add3(P.hips, 0, -0.02, -0.02);
  P.shL[0] += 0.03; P.shR[0] += 0.03; P.shL[1] += 0.03; P.shR[1] += 0.03;
  C.gait.mode = C.speed > 0.05 ? 'slide' : 'lock'; C.gait.settle = 0.3;
  C.mark(P);
  return P;
}

export function hitPose(C, P) {
  const f = C.f, hk = f.hk || {};
  const age = tf(C, f.stT);
  const kind = hk.kind, lv = hk.lv;
  const big = hk.heavy ? 1.3 : 1;
  const sdir = hk.side === 'l' ? 1 : hk.side === 'r' ? -1 : 0;
  // hold the stagger, relax over the last frames of the stun so the recovery blends into the guard
  const w = smooth(clamp((f.stun - C.sub * 0) / 10, 0, 1));
  const R = C.R;
  stand(C, P);
  C.gait.mode = C.speed > 0.045 ? 'slide' : 'lock'; C.gait.settle = 0.28;
  if (kind === 'crumple') {
    crouch(C, P, 1);
    const t = cl01(age / 18);
    P.hips[1] = 0.90 - 0.44 * easeOut(t) * (0.4 + 0.6 * w); add3(P.spine, 26 * t * w, 0, 0); add3(P.head, 14 * t * w, 0, 0);
    P._r.hL = [-0.3, 0.62 - 0.2 * t, 0.2]; P._r.hR = [0.3, 0.62 - 0.2 * t, 0.2];
    P.kneePole = [0.25, 0.0, 1.0]; P.fist = [0.3, 0.3];
    C.pin.hL = C.pin.hR = false;
    C.mark(P);
    return P;
  }
  if (kind === 'brk') {
    P._r.hL = [-0.5, 1.5, 0.15]; P._r.hR = [0.5, 1.5, 0.15]; P.fist = [0.2, 0.2];
    add3(P.spine, -10 * w, 0, 0); add3(P.hips, 0, 0, -0.04 * w);
    return P;
  }
  if (kind === 'parried') {
    P._r.hL = [-0.7, 1.35, 0.0]; P._r.hR = [0.7, 1.35, 0.0]; P.fist = [0.2, 0.2];
    add3(P.spine, -20 * w, 0, 0); add3(P.hipsRot, -10 * w, 0, 0); add3(P.hips, 0, 0, -0.08 * w);
    return P;
  }
  // arms drop / flail
  P._r.hL = [-0.28, 1.0, 0.22]; P._r.hR = [0.26, 0.98, 0.20];
  P.fist = [0.3, 0.3]; P.elbowPole = [0.7, -0.7, -0.4];
  if (lv === 'h') {
    add3(P.head, -16 * w * big, sdir * 20 * w, sdir * -8 * w);
    add3(P.spine, -10 * w * big, sdir * 12 * w, sdir * -6 * w);
    add3(P.hipsRot, -3 * w, sdir * 6 * w, 0);
    add3(P.hips, 0, -0.01, -0.05 * w * big);
    P._r.hL[1] += 0.25 * w; P._r.hR[1] += 0.25 * w; P._r.hL[0] -= 0.1 * w; P._r.hR[0] += 0.1 * w;
    P.shL[1] += 0.03 * w; P.shR[1] += 0.03 * w;
  } else if (lv === 'l') {
    P.hips[1] -= 0.14 * w * big;
    add3(P.spine, 16 * w * big, sdir * 10 * w, 0); add3(P.head, 10 * w, 0, 0);
    P.kneePole = [0.2, 0, 1];
    P._r.fL = [R.fL[0], 0.0, R.fL[2] - 0.04 * w];
  } else {
    add3(P.spine, 30 * w * big, sdir * 16 * w, sdir * -6 * w);
    add3(P.head, 8 * w, sdir * 12 * w, 0);
    add3(P.hipsRot, 4 * w, sdir * 8 * w, 0);
    add3(P.hips, 0, -0.05 * w, -0.08 * w * big);
    P._r.hL = [-0.16, 0.95 + 0.1 * (1 - w), 0.3]; P._r.hR = [0.16, 0.95 + 0.1 * (1 - w), 0.3];
  }
  if (kind === 'stag') {
    add3(P.spine, 6 * w, 0, 0);
    C.gait.mode = 'slide';
  }
  C.mark(P);
  return P;
}

export function airPose(C, P) {
  const f = C.f, a = f.air || {};
  const t = tf(C, f.airT || 0);
  const up = a.faceUp !== false && f.faceUp !== false;
  const k = a.kind;
  let pitch, hy = 0.9, roll = 0, yaw = 0;
  const fall = cl01(t / 12);
  if (k === 'bound' || (!up && k !== 'slump')) {
    pitch = lerp(0, 82, easeOut(fall)); hy = lerp(0.9, 0.55, fall);
  } else if (k === 'slump') {
    pitch = lerp(0, 70, cl01(t / 20)); hy = lerp(0.9, 0.4, cl01(t / 20));
  } else if (k === 'kd') {
    pitch = lerp(0, -70, easeOut(cl01(t / 14))); hy = lerp(0.9, 0.55, cl01(t / 14));
  } else {
    pitch = lerp(0, -78, easeOut(fall)); hy = lerp(0.9, 0.5, fall);
    if (k === 'tornado' || k === 'screw') { yaw = t * 26; roll = Math.sin(t * 0.3) * 6; }
    else roll = Math.sin(t * 0.5) * 5;
  }
  if (k === 'ko') { pitch = lerp(0, -84, easeOut(cl01(t / 14))); roll = 0; }
  set3(P.hips, 0, hy, 0);
  set3(P.hipsRot, pitch, yaw, roll);
  set3(P.spine, 0, 0, 0);
  set3(P.head, up ? -14 * fall : 14 * fall, 0, 0);
  for (const kk of ['hL', 'hR', 'fL', 'fR']) P._r[kk] = null;
  const flail = Math.sin(t * 0.8) * 0.05;
  if (pitch < 0) {
    set3(P.hL, -0.55, 0.25 + flail, -0.25); set3(P.hR, 0.55, 0.25 - flail, -0.25);
    set3(P.fL, -0.18, -0.72, 0.15); set3(P.fR, 0.18, -0.78, 0.05);
  } else {
    set3(P.hL, -0.5, 0.15, 0.25); set3(P.hR, 0.5, 0.15, 0.25);
    set3(P.fL, -0.18, -0.8, -0.1); set3(P.fR, 0.18, -0.72, -0.12);
  }
  P.kneePole = [0.2, 0, 1]; P.elbowPole = [0.5, -0.4, -0.6]; P.fist = [0.2, 0.2];
  C.gait.mode = 'free';
  return P;
}

export function downPose(C, P) {
  const f = C.f;
  lying(C, P, f.faceUp !== false);
  C.gait.mode = 'free';
  return P;
}

// the snapshot poses used by get-up sequences
export function snap(C, i, build) { const T = C.tmp(i); resetPose(T); const keep = C.pin; C.pin = {}; build(T); C.pin = keep; canon(T); return T; }

export function getupPose(C, P) {
  const f = C.f;
  const faceUp = f.faceUp !== false;
  const t = cl01(tf(C, f.stT) / Math.max(1, f.getN));
  const kind = f.getKind;
  const fromLying = snap(C, 0, (T) => lying(C, T, faceUp));
  const crouchK = snap(C, 1, (T) => crouch(C, T, 0.85));
  const stdK = snap(C, 2, (T) => stand(C, T));
  const out = C.tmp(3);
  // sit up, plant the feet, rise
  const kneel = snap(C, 4, (T) => {
    crouch(C, T, 1);
    T.hips[1] = 0.36; T.hips[2] = -0.06; set3(T.hipsRot, 12, -10, 0); set3(T.spine, 28, -8, 0); set3(T.head, -6, 4, 0);
    T._r.fL = [-0.2, 0, 0.30]; T._r.fR = [0.2, 0, -0.18];
    T._r.hL = [-0.28, 0.1, 0.42]; T._r.hR = [0.28, 0.08, 0.40];
    T.kneePole = [0.2, 0, 1]; T.fist = [0.2, 0.2];
  });
  const rise = (from, u) => {
    if (u < 0.5) lerpPose(out, from, kneel, easeInOut(u / 0.5));
    else if (u < 0.82) lerpPose(out, kneel, crouchK, easeInOut((u - 0.5) / 0.32));
    else lerpPose(out, crouchK, stdK, easeInOut((u - 0.82) / 0.18));
  };
  C.gait.mode = t < 0.8 ? 'free' : 'lock';
  if (kind === 'stand') { rise(fromLying, t); copyPose(P, out); return P; }
  if (kind === 'back' || kind === 'fwd') {
    // curl into a ball and tumble along the floor, then unroll into a crouch
    const ball = snap(C, 5, (T) => {
      crouch(C, T, 1);
      T.hips[1] = 0.36; T.hips[2] = -0.04; set3(T.hipsRot, 40, -4, 0); set3(T.spine, 52, 0, 0); set3(T.head, 34, 0, 0);
      T._r.fL = [-0.1, 0.22, 0.34]; T._r.fR = [0.1, 0.2, 0.30];
      T._r.hL = [-0.14, 0.34, 0.38]; T._r.hR = [0.14, 0.32, 0.36];
      T.kneePole = [0.1, 0.3, 1]; T.fist = [0.9, 0.9]; T.rootPivot = 0.36;
    });
    const d = kind === 'back' ? -1 : 1;
    if (t < 0.22) { lerpPose(out, fromLying, ball, easeInOut(t / 0.22)); copyPose(P, out); return P; }
    if (t < 0.74) {
      copyPose(P, ball);
      const u = (t - 0.22) / 0.52;
      P.rootPivot = 0.36; P.rootPitch = d * 360 * easeInOut(u);
      return P;
    }
    rise(ball, (t - 0.74) / 0.26 * 0.7 + 0.3); copyPose(P, out);
    return P;
  }
  // log roll about the body's long axis, arms tucked
  const tuck = snap(C, 5, (T) => {
    lying(C, T, faceUp);
    set3(T.hL, -0.15, 0.2, 0.12); set3(T.hR, 0.15, 0.2, 0.12);
    set3(T.fL, -0.1, -0.7, 0.06); set3(T.fR, 0.1, -0.7, 0.06);
    T._r.hL = T._r.hR = T._r.fL = T._r.fR = null; T.rootPivot = 0.2;
  });
  const sgn = kind === 'bg' ? 1 : kind === 'cam' ? -1 : 0;
  if (t < 0.14) { lerpPose(out, fromLying, tuck, easeInOut(t / 0.14)); copyPose(P, out); return P; }
  if (t < 0.64) {
    copyPose(P, tuck);
    P.rootPivot = 0.2; P.rootRoll = sgn * 360 * easeInOut((t - 0.14) / 0.5);
    return P;
  }
  rise(tuck, (t - 0.64) / 0.36 * 0.7 + 0.3); copyPose(P, out);
  return P;
}

export function wallPose(C, P) {
  const f = C.f;
  const t = tf(C, f.stT);
  const sl = cl01((t - 34) / 18);
  set3(P.hips, 0, 0.88 - 0.1 * sl, -0.02);
  set3(P.hipsRot, -10 + 24 * sl, 180, 0);       // back against the wall (turned away from the attacker)
  set3(P.spine, -8 + 22 * sl, 0, 0);
  set3(P.head, -22 + 30 * sl, 0, 0);
  for (const k of ['hL', 'hR', 'fL', 'fR']) P._r[k] = null;
  const flap = Math.sin(t * 1.4) * 0.05 * (1 - sl);
  set3(P.hL, -0.62, 0.45 + flap, -0.05); set3(P.hR, 0.62, 0.45 - flap, -0.05);
  set3(P.fL, -0.17, -0.80, 0.07); set3(P.fR, 0.19, -0.82, 0.05);
  P.kneePole = [0.2, 0, 1]; P.fist = [0.2, 0.2];
  C.gait.mode = 'free';
  return P;
}

export function grabbedPose(C, P) {
  const f = C.f;
  const rot = f.capRot || [0, 0, 0];
  const sc = f.sc;
  const py = Math.max(0.2, (f.capY ?? 0.9 * sc) / sc);
  set3(P.hips, 0, py, 0);
  set3(P.hipsRot, rot[0], rot[1], rot[2]);
  set3(P.spine, 0, 0, 0);
  const wob = Math.sin(f.capT * 0.6) * 4;
  set3(P.head, -8 + wob, 0, 0);
  for (const k of ['hL', 'hR', 'fL', 'fR']) P._r[k] = null;
  set3(P.hL, -0.4, 0.05, 0.02); set3(P.hR, 0.4, 0.05, 0.02);
  set3(P.fL, -0.14, -0.86, 0.02 + Math.sin(f.capT * 0.5) * 0.06); set3(P.fR, 0.14, -0.86, 0.02 - Math.sin(f.capT * 0.5) * 0.06);
  P.fist = [0.2, 0.2];
  C.gait.mode = 'free';
  return P;
}

// ------------------------------------------------------------------------------------------------ showmanship
export function introPose(C, P) {
  const f = C.f;
  const t = tf(C, f.stT);
  const style = C.ch.intro || 'fists';
  stand(C, P);
  if (style === 'bow') {
    const b = Math.sin(Math.PI * cl01((t - 20) / 60));
    add3(P.spine, 32 * b, 0, 0); add3(P.hipsRot, 8 * b, 0, 0);
    P._r.hL = [-0.2, 0.8, 0.1]; P._r.hR = [0.2, 0.8, 0.1];
  } else if (style === 'roar') {
    const b = Math.sin(t * 0.25);
    P._r.hL = [-0.5, 1.7 + 0.05 * b, 0.1]; P._r.hR = [0.5, 1.7 - 0.05 * b, 0.1];
    add3(P.spine, -14, 0, 0); add3(P.head, -20, 0, 0);
  } else if (style === 'taunt') {
    P._r.hL = [-0.2, 1.3, 0.5]; P._r.hR = [0.3, 1.0 + 0.2 * Math.sin(t * 0.3), 0.6];
    add3(P.spine, -4, 12, 0);
  } else {
    const s = Math.sin(t * 0.35);
    P._r.hL = [-0.2, 1.3, 0.35 + 0.28 * Math.max(0, s)]; P._r.hR = [0.16, 1.28, 0.25 + 0.28 * Math.max(0, -s)];
    add3(P.spine, 0, s * 8, 0);
  }
  C.mark(P);
  return P;
}

export function winPose(C, P) {
  const f = C.f;
  const t = tf(C, f.stT);
  const style = C.ch.win || 'fist';
  stand(C, P);
  if (style === 'bow') {
    const b = Math.sin(Math.PI * cl01((t - 20) / 70));
    add3(P.spine, 34 * b, 0, 0); P._r.hL = [-0.2, 0.8, 0.1]; P._r.hR = [0.2, 0.8, 0.1];
  } else if (style === 'flip') {
    const fl = cl01((t - 6) / 34);
    add3(P.hipsRot, -360 * easeInOut(fl), 0, 0);
    P._r.hL = [-0.3, 1.5, 0.2]; P._r.hR = [0.3, 1.5, 0.2];
    P.rootY = Math.sin(Math.PI * fl) * 0.9;
    C.gait.mode = fl > 0 && fl < 1 ? 'free' : 'lock';
  } else if (style === 'roar') {
    P._r.hL = [-0.55, 1.8, 0.1]; P._r.hR = [0.55, 1.8, 0.1]; add3(P.spine, -18, 0, 0); add3(P.head, -22, 0, 0);
  } else {
    const s = Math.sin(t * 0.2);
    P._r.hR = [0.3, 1.95 + 0.04 * s, 0.1]; P._r.hL = [-0.2, 1.0, 0.3]; add3(P.spine, -6, 10, 0); add3(P.head, -6, 0, 0);
  }
  C.mark(P);
  return P;
}

export function losePose(C, P) {
  const t = tf(C, C.f.stT);
  const k = cl01(t / 30);
  stand(C, P);
  P.hips[1] = 0.9 - 0.4 * easeOut(k);
  add3(P.spine, 30 * k, 0, 0); add3(P.head, 25 * k, 0, 0);
  P._r.hL = [-0.2, 0.55, 0.1]; P._r.hR = [0.2, 0.55, 0.1];
  P._r.fL = [-0.2, 0, 0.2]; P._r.fR = [0.2, 0, -0.1];
  P.kneePole = [0.2, 0, 1];
  C.mark(P);
  return P;
}

// ------------------------------------------------------------------------------------------------ dispatcher
export function statePose(C, P) {
  const f = C.f;
  switch (f.state) {
    case ST.IDLE: return idlePose(C, P);
    case ST.DASHF: return dashPose(C, P, false);
    case ST.DASHB: return dashPose(C, P, true);
    case ST.RUN: return runPose(C, P);
    case ST.SS: return sidestepPose(C, P);
    case ST.CD: crouch(C, P, 1); add3(P.spine, 8, 0, 0); P.hips[2] += 0.06; C.gait.T = 9; C.gait.amt = 0.2; return P;
    case ST.JUMP: return jumpPose(C, P);
    case ST.LAND: return landPose(C, P);
    case ST.HIT: return hitPose(C, P);
    case ST.BLK: return blockPose(C, P);
    case ST.AIR: return airPose(C, P);
    case ST.DOWN: case ST.KO: return downPose(C, P);
    case ST.GETUP: return getupPose(C, P);
    case ST.WALL: return wallPose(C, P);
    case ST.GRAB: return grabbedPose(C, P);
    case ST.INTRO: return introPose(C, P);
    case ST.WIN: return winPose(C, P);
    case ST.LOSE: return losePose(C, P);
    default: return stand(C, P);
  }
}
