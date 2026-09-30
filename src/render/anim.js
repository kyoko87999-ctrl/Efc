// State -> pose. All limb targets are authored in root space (feet on the floor = y 0) and converted
// to pelvis space at the end so pelvis rotations (flips, spins, lying down) keep the IK working.
import { newPose, clonePose, copyPose, lerpPose, finalize, add3, set3, cp3, DEG } from './pose.js';
import { STYLES, applyStrike, progress } from './styles.js';
import { ST } from '../sim/fighter.js';
import { sampleVic } from '../sim/move.js';
import { clamp, lerp, easeOut, easeInOut, smooth } from '../util.js';

const sideOf = (limb) => (limb.endsWith('L') ? -1 : limb === 'hd' || limb === 'sh' ? 1 : 1);
const cl01 = (v) => clamp(v, 0, 1);

// ------------------------------------------------------------------ base stances
function stand(C, P = newPose()) {
  const R = C.R, I = C.ch.idle || {};
  const T = C.T;
  const bob = Math.sin(T * (I.bobSpeed ?? 2.6)) * (I.bob ?? 0.012);
  set3(P.hips, 0, (I.hips ?? 0.90) + bob, 0.02);
  set3(P.hipsRot, 3, I.hipsYaw ?? -6, 0);
  set3(P.spine, 7, I.spineYaw ?? -12, 0);
  set3(P.head, -4, 5, 0);
  P._r.hL = R.hL.slice(); P._r.hR = R.hR.slice(); P._r.fL = R.fL.slice(); P._r.fR = R.fR.slice();
  const hy = Math.sin(T * (I.bobSpeed ?? 2.6) + 1) * 0.018;
  P._r.hL[1] += hy; P._r.hR[1] -= hy * 0.6;
  if (I.hands === 'high') { P._r.hL[1] += 0.14; P._r.hR[1] += 0.16; P._r.hL[2] += 0.06; P._r.hR[2] += 0.08; }
  if (I.hands === 'low') { P._r.hL[1] -= 0.30; P._r.hR[1] -= 0.30; P._r.hL[0] -= 0.06; P._r.hR[0] += 0.06; }
  if (I.hands === 'wide') { P._r.hL = [-0.55, 1.05, 0.25]; P._r.hR = [0.55, 1.05, 0.25]; }
  if (I.bounce) {
    const b = Math.sin(T * (I.bounceSpeed ?? 9));
    P.hips[1] += Math.abs(b) * I.bounce;
    P._r.fL[1] += Math.max(0, b) * I.bounce * 1.6; P._r.fR[1] += Math.max(0, -b) * I.bounce * 1.6;
  }
  if (I.sway) {
    const s = Math.sin(T * (I.swaySpeed ?? 2.2));
    P.hips[0] += s * I.sway; P.hipsRot[2] += s * 6; P._r.fL[0] += s * I.sway * 1.6; P._r.fR[0] += s * I.sway * 1.6;
    P._r.fL[2] += Math.cos(T * (I.swaySpeed ?? 2.2)) * I.sway * 1.5; P._r.fR[2] -= Math.cos(T * (I.swaySpeed ?? 2.2)) * I.sway * 1.5;
  }
  P.kneePole = null; P.elbowPole = null; P.ankle[0] = 0; P.ankle[1] = 0; P.wrist = null;
  return P;
}

function crouchPose(C, P = newPose(), depth = 1) {
  const R = C.R;
  set3(P.hips, 0, 0.90 - 0.36 * depth, 0.0);
  set3(P.hipsRot, 8 * depth, -6, 0);
  set3(P.spine, 20 * depth, -10, 0);
  set3(P.head, -14 * depth, 4, 0);
  P._r.fL = [-0.22, 0, 0.26]; P._r.fR = [0.22, 0, -0.10];
  P._r.hL = [-0.20, 0.98, 0.36]; P._r.hR = [0.16, 0.93, 0.28];
  if ((C.ch.idle || {}).hands === 'wide') { P._r.hL = [-0.5, 0.9, 0.2]; P._r.hR = [0.5, 0.9, 0.2]; }
  P.kneePole = [0.25, 0.0, 1.0];
  void R;
  return P;
}

function lyingPose(C, P = newPose(), faceUp = true) {
  const s = faceUp ? 1 : -1;
  set3(P.hips, 0, 0.20, 0.0);
  set3(P.hipsRot, -90 * s, 0, 0);
  set3(P.spine, 0, 0, 0);
  set3(P.head, faceUp ? -8 : 20, 0, 0);
  P._r = {};
  set3(P.hL, -0.33, 0.0, 0.03 * s); set3(P.hR, 0.33, 0.0, 0.03 * s);
  set3(P.fL, -0.12, -0.86, 0.02); set3(P.fR, 0.12, -0.86, 0.02);
  P.kneePole = [0.1, 0, 1]; P.ankle[0] = 0; P.ankle[1] = 0;
  return P;
}

function setBody(P, key, x, y, z) { P._r[key] = null; set3(P[key], x, y, z); }

// ------------------------------------------------------------------ movement
function walkPose(C, P) {
  const f = C.f, R = C.R;
  const ph = f.walkPhase;
  const s = Math.sin(ph), c = Math.cos(ph);
  if (f.walkDir) {
    const st = 0.2 * f.walkDir;
    P._r.fL = [R.fL[0], Math.max(0, c) * 0.1, R.fL[2] + st * s];
    P._r.fR = [R.fR[0], Math.max(0, -c) * 0.1, R.fR[2] - st * s];
    P.hips[1] -= Math.abs(s) * 0.02;
    P.hips[2] += 0.01 * f.walkDir;
    add3(P.spine, f.walkDir > 0 ? 3 : -2, 0, 0);
    P._r.hL[2] += s * 0.02; P._r.hR[2] -= s * 0.02;
  } else if (f.sideWalk) {
    const sg = (f.idx === 0 ? -1 : 1) * f.sideWalk;
    P._r.fL = [R.fL[0] + sg * 0.16 * s, Math.max(0, c) * 0.09, R.fL[2]];
    P._r.fR = [R.fR[0] + sg * 0.16 * s, Math.max(0, -c) * 0.09, R.fR[2]];
    P.hips[0] += sg * 0.03; P.hipsRot[2] += -sg * 4;
  }
  return P;
}

function dashPose(C, P, back) {
  const f = C.f, R = C.R;
  const t = cl01(f.stT / 24);
  if (!back) {
    const ph = f.stT * 0.55;
    const s = Math.sin(ph), c = Math.cos(ph);
    const lean = 20 * (1 - easeOut(t) * 0.5);
    add3(P.hipsRot, lean * 0.4, 0, 0); add3(P.spine, lean, 0, 0);
    P.hips[1] -= 0.06; P.hips[2] += 0.05;
    P._r.fL = [R.fL[0], Math.max(0, c) * 0.16, R.fL[2] + 0.34 * s];
    P._r.fR = [R.fR[0], Math.max(0, -c) * 0.16, R.fR[2] - 0.34 * s];
    P._r.hL[2] -= 0.05; P._r.hR[2] -= 0.05;
  } else {
    const hop = Math.sin(Math.PI * cl01(t * 1.15)) ;
    add3(P.hipsRot, -8 * hop, 0, 0); add3(P.spine, -4 * hop, 0, 0);
    P.hips[1] += 0.03 * hop - 0.03;
    P._r.fL = [R.fL[0], 0.14 * hop, R.fL[2] - 0.16 * hop];
    P._r.fR = [R.fR[0], 0.16 * hop, R.fR[2] - 0.18 * hop];
  }
  return P;
}

function runPose(C, P) {
  const f = C.f, R = C.R;
  const ph = f.walkPhase;
  const s = Math.sin(ph), c = Math.cos(ph);
  add3(P.hipsRot, 8, 0, 0); add3(P.spine, 20, 0, 0);
  P.hips[1] -= 0.08; P.hips[2] += 0.07;
  P._r.fL = [R.fL[0], Math.max(0, c) * 0.22, R.fL[2] + 0.36 * s];
  P._r.fR = [R.fR[0], Math.max(0, -c) * 0.22, R.fR[2] - 0.36 * s];
  P._r.hL = [-0.2, 1.15 + 0.06 * s, 0.30 + 0.22 * s]; P._r.hR = [0.2, 1.15 - 0.06 * s, 0.30 - 0.22 * s];
  return P;
}

function sidestepPose(C, P) {
  const f = C.f, R = C.R;
  const t = cl01(f.stT / 22);
  const sg = (f.idx === 0 ? -1 : 1) * (f.ssSgn || 1);   // + = toward the fighter's right
  const k = Math.sin(Math.PI * cl01(t * 1.1));
  P.hips[1] -= 0.06 * k; P.hips[0] += sg * 0.06 * k;
  add3(P.hipsRot, 4 * k, -sg * 10 * k, sg * 8 * k);
  add3(P.spine, 6 * k, 0, -sg * 6 * k);
  const cross = Math.sin(t * Math.PI * 2);
  P._r.fL = [R.fL[0] + sg * 0.22 * k * (cross > 0 ? 1 : 0.4), Math.max(0, Math.sin(t * Math.PI * 2)) * 0.12, R.fL[2]];
  P._r.fR = [R.fR[0] + sg * 0.22 * k, Math.max(0, -Math.sin(t * Math.PI * 2)) * 0.12, R.fR[2]];
  return P;
}

function jumpPose(C, P) {
  const f = C.f;
  const rising = f.vy > 0;
  const tuck = rising ? 1 : 0.55;
  set3(P.hips, 0, 0.90, 0.02);
  add3(P.hipsRot, 4 * f.jumpDir, 0, 0); add3(P.spine, 8, 0, 0);
  P._r = {};
  set3(P.fL, -0.13, -0.55 * tuck - 0.3 * (1 - tuck), 0.16); set3(P.fR, 0.13, -0.5 * tuck - 0.34 * (1 - tuck), -0.02);
  P._r.hL = [-0.28, 1.15, 0.30]; P._r.hR = [0.26, 1.15, 0.28];
  P.kneePole = [0.2, 0, 1];
  return P;
}

// ------------------------------------------------------------------ reactions
function blockPose(C, P) {
  const f = C.f;
  const imp = Math.pow(cl01(1 - f.stT / 10), 1.3);
  const crouch = f.blkCrouch;
  if (crouch) crouchPose(C, P, 0.9);
  P._r.hL = [-0.13, crouch ? 1.12 : 1.50, 0.38]; P._r.hR = [0.10, crouch ? 1.06 : 1.43, 0.36];
  add3(P.spine, 8 * imp + 4, 0, 0); add3(P.head, -10, 0, 0);
  add3(P.hips, 0, -0.02, -0.07 * imp);
  add3(P.hipsRot, -6 * imp, 0, 0);
  return P;
}

function hitPose(C, P) {
  const f = C.f, hk = f.hk || {};
  const age = f.stT;
  const imp = Math.pow(cl01(1 - age / (hk.heavy ? 22 : 15)), 1.15);
  const sdir = hk.side === 'l' ? 1 : hk.side === 'r' ? -1 : 0;
  const R = C.R;
  const kind = hk.kind;
  const lv = hk.lv;
  // hunched, arms dropped
  P._r.hL = [-0.28, 1.0, 0.22]; P._r.hR = [0.26, 0.98, 0.20];
  add3(P.spine, 10, 0, 0);
  if (kind === 'crumple') {
    const t = cl01(age / 16);
    P.hips[1] = 0.90 - 0.44 * easeOut(t); add3(P.spine, 34 * t, 0, 0); add3(P.head, 18 * t, 0, 0);
    P._r.fL = [-0.22, 0, 0.3]; P._r.fR = [0.22, 0, -0.1];
    P._r.hL = [-0.3, 0.6 - 0.2 * t, 0.2]; P._r.hR = [0.3, 0.6 - 0.2 * t, 0.2];
    P.kneePole = [0.25, 0.0, 1.0];
    return P;
  }
  if (kind === 'brk') {
    P._r.hL = [-0.5, 1.5, 0.15]; P._r.hR = [0.5, 1.5, 0.15];
    add3(P.spine, -12 * imp, 0, 0); add3(P.hips, 0, 0, -0.05 * imp);
    return P;
  }
  if (kind === 'parried') {
    P._r.hL = [-0.7, 1.35, 0.0]; P._r.hR = [0.7, 1.35, 0.0];
    add3(P.spine, -22 * imp, 0, 0); add3(P.hipsRot, -12 * imp, 0, 0); add3(P.hips, 0, 0, -0.1 * imp);
    return P;
  }
  const big = hk.heavy ? 1.35 : 1;
  if (lv === 'h') {
    add3(P.head, -34 * imp * big, sdir * 26 * imp, sdir * -10 * imp);
    add3(P.spine, -14 * imp * big, sdir * 16 * imp, sdir * -8 * imp);
    add3(P.hips, 0, 0, -0.07 * imp * big);
    P._r.hL[1] += 0.25 * imp; P._r.hR[1] += 0.25 * imp;
  } else if (lv === 'l') {
    P.hips[1] -= 0.16 * imp * big;
    add3(P.spine, 16 * imp * big, sdir * 10 * imp, 0);
    add3(P.head, 10 * imp, 0, 0);
    P.kneePole = [0.2, 0, 1];
    P._r.fL = [R.fL[0], 0.04 * imp, R.fL[2] - 0.05 * imp];
  } else {
    add3(P.spine, 40 * imp * big, sdir * 20 * imp, sdir * -8 * imp);
    add3(P.head, 10 * imp, sdir * 14 * imp, 0);
    add3(P.hips, 0, -0.05 * imp, -0.10 * imp * big);
    P._r.hL = [-0.16, 0.95 + 0.1 * (1 - imp), 0.3]; P._r.hR = [0.16, 0.95 + 0.1 * (1 - imp), 0.3];
  }
  if (kind === 'stag') {
    const ph = age * 0.4;
    P._r.fL = [R.fL[0], Math.max(0, Math.cos(ph)) * 0.08, R.fL[2] - 0.12 * Math.sin(ph) - 0.05];
    P._r.fR = [R.fR[0], Math.max(0, -Math.cos(ph)) * 0.08, R.fR[2] + 0.12 * Math.sin(ph) - 0.05];
    add3(P.spine, 8, 0, 0);
  }
  return P;
}

function airPose(C, P) {
  const f = C.f, a = f.air || {};
  const t = f.airT || 0;
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
  P._r = {};
  const flail = Math.sin(t * 0.8) * 0.05;
  if (pitch < 0) {
    set3(P.hL, -0.55, 0.25 + flail, -0.25); set3(P.hR, 0.55, 0.25 - flail, -0.25);
    set3(P.fL, -0.18, -0.72, 0.15); set3(P.fR, 0.18, -0.78, 0.05);
  } else {
    set3(P.hL, -0.5, 0.15, 0.25); set3(P.hR, 0.5, 0.15, 0.25);
    set3(P.fL, -0.18, -0.8, -0.1); set3(P.fR, 0.18, -0.72, -0.12);
  }
  P.kneePole = [0.2, 0, 1];
  return P;
}

function downPose(C, P) {
  const f = C.f;
  lyingPose(C, P, f.faceUp !== false);
  const breathe = Math.sin(C.T * 3) * 0.004;
  P.hips[1] += breathe;
  return P;
}

function getupPose(C, P) {
  const f = C.f;
  const t = cl01(f.stT / f.getN);
  const from = lyingPose(C, newPose(), f.faceUp !== false);
  const to = stand(C, newPose());
  finalize(to);
  if (f.getKind === 'stand') {
    const mid = crouchPose(C, newPose(), 0.9); finalize(mid);
    const out = newPose();
    if (t < 0.5) lerpPose(out, from, mid, easeInOut(t * 2)); else lerpPose(out, mid, to, easeInOut((t - 0.5) * 2));
    copyPose(P, out); P._r = {};
    return P;
  }
  // rolls: lying pose spinning about the vertical axis, then pop up
  const out = newPose();
  if (t < 0.7) {
    copyPose(out, from);
    const dirRoll = f.getKind === 'bg' ? 1 : f.getKind === 'cam' ? -1 : 0;
    out.hipsRot[1] = (f.getKind === 'back' || f.getKind === 'fwd') ? 0 : dirRoll * 360 * easeInOut(t / 0.7);
    out.hipsRot[0] = (f.getKind === 'back' || f.getKind === 'fwd') ? lerp(from.hipsRot[0], from.hipsRot[0] + (f.getKind === 'back' ? -1 : 1) * 380 * 0.0, 0) : from.hipsRot[0];
    if (f.getKind === 'back' || f.getKind === 'fwd') out.hipsRot[0] = from.hipsRot[0] + (f.getKind === 'back' ? -1 : 1) * 360 * easeInOut(t / 0.7);
    out.hips[1] = 0.28;
  } else {
    const mid = crouchPose(C, newPose(), 0.9); finalize(mid);
    lerpPose(out, mid, to, easeInOut((t - 0.7) / 0.3));
  }
  copyPose(P, out); P._r = {};
  return P;
}

function wallPose(C, P) {
  const f = C.f;
  const t = f.stT;
  const sl = cl01((t - 34) / 18);
  set3(P.hips, 0, 0.88 - 0.1 * sl, -0.02);
  set3(P.hipsRot, -10 + 24 * sl, 180, 0);       // back against the wall (turned away from the attacker)
  set3(P.spine, -8 + 22 * sl, 0, 0);
  set3(P.head, -22 + 30 * sl, 0, 0);
  P._r = {};
  const flap = Math.sin(t * 1.4) * 0.05 * (1 - sl);
  set3(P.hL, -0.62, 0.45 + flap, -0.05); set3(P.hR, 0.62, 0.45 - flap, -0.05);
  set3(P.fL, -0.17, -0.80, 0.07); set3(P.fR, 0.19, -0.82, 0.05);
  P.kneePole = [0.2, 0, 1];
  return P;
}

function grabbedPose(C, P) {
  const f = C.f;
  const rot = f.capRot || [0, 0, 0];
  const sc = f.sc;
  const py = Math.max(0.2, (f.capY ?? 0.9 * sc) / sc);
  set3(P.hips, 0, py, 0);
  set3(P.hipsRot, rot[0], rot[1], rot[2]);
  set3(P.spine, 0, 0, 0);
  const wob = Math.sin(f.capT * 0.6) * 4;
  set3(P.head, -8 + wob, 0, 0);
  P._r = {};
  set3(P.hL, -0.4, 0.05, 0.02); set3(P.hR, 0.4, 0.05, 0.02);
  set3(P.fL, -0.14, -0.86, 0.02 + Math.sin(f.capT * 0.5) * 0.06); set3(P.fR, 0.14, -0.86, 0.02 - Math.sin(f.capT * 0.5) * 0.06);
  return P;
}

// ------------------------------------------------------------------ celebration / intro
function introPose(C, P) {
  const f = C.f;
  const t = f.stT;
  const style = C.ch.intro || 'fists';
  const k = cl01(t / 40);
  if (style === 'bow') {
    const b = Math.sin(Math.PI * cl01((t - 20) / 60)) * 1;
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
    // fists up, shadow boxing
    const s = Math.sin(t * 0.35);
    P._r.hL = [-0.2, 1.3, 0.35 + 0.28 * Math.max(0, s)]; P._r.hR = [0.16, 1.28, 0.25 + 0.28 * Math.max(0, -s)];
    add3(P.spine, 0, s * 8, 0);
  }
  void k;
  return P;
}

function winPose(C, P) {
  const f = C.f;
  const t = f.stT;
  const style = C.ch.win || 'fist';
  if (style === 'bow') {
    const b = Math.sin(Math.PI * cl01((t - 20) / 70));
    add3(P.spine, 34 * b, 0, 0); P._r.hL = [-0.2, 0.8, 0.1]; P._r.hR = [0.2, 0.8, 0.1];
  } else if (style === 'flip') {
    const fl = cl01((t - 6) / 34);
    P.hips[1] += Math.sin(Math.PI * fl) * 0.6 * 0; add3(P.hipsRot, -360 * easeInOut(fl), 0, 0);
    P._r.hL = [-0.3, 1.5, 0.2]; P._r.hR = [0.3, 1.5, 0.2];
    P.rootY = Math.sin(Math.PI * fl) * 0.9;
  } else if (style === 'roar') {
    P._r.hL = [-0.55, 1.8, 0.1]; P._r.hR = [0.55, 1.8, 0.1]; add3(P.spine, -18, 0, 0); add3(P.head, -22, 0, 0);
  } else {
    const s = Math.sin(t * 0.2);
    P._r.hR = [0.3, 1.95 + 0.04 * s, 0.1]; P._r.hL = [-0.2, 1.0, 0.3]; add3(P.spine, -6, 10, 0); add3(P.head, -6, 0, 0);
  }
  return P;
}

function losePose(C, P) {
  const t = C.f.stT;
  const k = cl01(t / 30);
  P.hips[1] = 0.9 - 0.4 * easeOut(k);
  add3(P.spine, 30 * k, 0, 0); add3(P.head, 25 * k, 0, 0);
  P._r.hL = [-0.2, 0.55, 0.1]; P._r.hR = [0.2, 0.55, 0.1];
  P._r.fL = [-0.2, 0, 0.2]; P._r.fR = [0.2, 0, -0.1];
  P.kneePole = [0.2, 0, 1];
  return P;
}

// ------------------------------------------------------------------ attacks
function attackPose(C, P, T) {
  const f = C.f, m = f.move;
  const mfF = f.mf + C.frac;
  const R = C.R;
  const { wind, ext } = progress(m, mfF);
  const limb = m.limb;
  const sd = sideOf(limb);
  const S = {
    P, m, mf: mfF, ext, wind, sd, R, limb, f, pt: null,
    armsBalance(dir, e) {
      // free arm swings out for balance, the other one guards
      const free = dir < 0 ? 'hR' : 'hL';
      const o = dir < 0 ? 1 : -1;
      P._r[free] = [o * (0.28 + 0.34 * e), 1.05 + 0.25 * e, -0.05 - 0.25 * e];
    },
    airTuck() {
      P._r.fL = [-0.13, 0.35, 0.12]; P._r.fR = [0.13, 0.32, -0.02];
      P.kneePole = [0.2, 0, 1];
    },
  };
  // base stance
  const wake = m.an && m.an.wake;
  if (m.crouchMove || m.ctx === 'cd') crouchPose(C, P, 0.85);
  if (wake) {
    const lyingP = lyingPose(C, newPose(), f.faceUp !== false); finalize(lyingP);
    const to = stand(C, newPose()); finalize(to);
    const k = smooth(cl01(mfF / 9));
    const out = newPose(); lerpPose(out, lyingP, to, k); copyPose(P, out); P._r = {};
    S.armsBalance = () => {};
  }
  if (m.style === 'grab' && m.grab && f.mf >= m.st && f.grabbing) return scriptPose(C, P, m, mfF, S);
  applyStrike(S);
  const fn = STYLES[m.style];
  if (fn) fn(S);
  // full-body spin / flip
  if (m.an) {
    if (m.an.spin) {
      const [a, b, deg] = m.an.spin;
      const k = easeInOut(cl01((mfF - a) / (b - a)));
      P.hipsRot[1] += -sd * deg * k * 1;
    }
    if (m.an.flip) {
      const [a, b, deg] = m.an.flip;
      const k = easeInOut(cl01((mfF - a) / (b - a)));
      P.hipsRot[0] += -deg * k;
    }
  }
  if (m.style === 'jumppunch' || m.style === 'jumpkick') { /* airborne moves keep their tuck */ }
  // cinematic scripts (rage art / heat smash)
  if (m.an && (m.an.script === 'rageA' || m.an.script === 'smashA' || m.an.script === 'rageB') && f.grabbing) return scriptPose(C, P, m, mfF, S);
  return P;
}

// victim-holding scripts (throws, rage arts)
function scriptPose(C, P, m, mf, S) {
  const f = C.f, g = m.grab;
  const script = m.an && m.an.script;
  const t = mf - m.st;
  const vic = f.grabbing ? f.grabbing : null;
  const sd = 1;
  const vp = g.vic ? sampleVic(g.vic, Math.floor(mf)).p : [0, 1, 0.7];
  const R = C.R;
  const hold = (dx = 0.18, dy = 0.0, dz = -0.12) => {
    P._r.hL = [vp[0] - dx, Math.max(0.4, vp[1] + dy), vp[2] + dz];
    P._r.hR = [vp[0] + dx, Math.max(0.4, vp[1] + dy), vp[2] + dz];
  };
  void vic; void sd; void R;
  switch (script) {
    case 'hip': {
      const k1 = easeInOut(cl01(t / 14)), k2 = easeInOut(cl01((t - 14) / 12)), k3 = easeOut(cl01((t - 26) / 8)), k4 = easeInOut(cl01((t - 36) / 10));
      set3(P.hipsRot, 4 + 34 * k2 * (1 - k4) + 12 * k3, -40 * k1 + 110 * k2 * (1 - k4), 0);
      add3(P.spine, 20 * k1 + 20 * k2 - 30 * k4, 20 * k2 * (1 - k4), 0);
      P.hips[1] = 0.86 - 0.10 * k1 + 0.08 * k3;
      hold(0.2, -0.2, -0.05);
      break;
    }
    case 'suplex': {
      const k1 = easeInOut(cl01(t / 14)), k2 = easeInOut(cl01((t - 14) / 16)), k3 = easeInOut(cl01((t - 30) / 12));
      set3(P.hipsRot, -8 * k1 - 30 * k2 + 45 * k3, 0, 0);
      set3(P.spine, -14 * k1 - 32 * k2 + 30 * k3, 0, 0);
      P.hips[2] = -0.04 * k2 - 0.2 * k3; P.hips[1] = 0.84 - 0.04 * k3;
      hold(0.2, 0.05, -0.1);
      break;
    }
    case 'slam': {
      const k1 = easeInOut(cl01(t / 14)), k2 = easeInOut(cl01((t - 14) / 10)), k3 = easeOut(cl01((t - 26) / 12));
      set3(P.hipsRot, -6 * k1 + 40 * k3, 0, 0);
      set3(P.spine, -10 * k1 + 50 * k3, 0, 0);
      P.hips[1] = 0.90 - 0.2 * k3;
      hold(0.2, 0.0, -0.1);
      void k2;
      break;
    }
    case 'knees': {
      const cyc = t / 12;
      const knee = Math.abs(Math.sin(Math.PI * cyc));
      const idx = Math.floor(cyc) % 2;
      hold(0.16, 0.25, -0.1);
      P._r[idx ? 'fL' : 'fR'] = [idx ? -0.16 : 0.16, 0.25 + 0.4 * knee, 0.3 + 0.35 * knee];
      set3(P.spine, 12 + 12 * knee, 0, 0);
      set3(P.hipsRot, -8 * knee, 0, 0);
      break;
    }
    case 'bear': {
      const k1 = easeInOut(cl01(t / 20)), k2 = easeInOut(cl01((t - 20) / 24));
      set3(P.hipsRot, -8 * k1 - 24 * k2 + 30 * cl01((t - 44) / 6), 0, 0);
      set3(P.spine, -12 * k1 - 28 * k2 + 30 * cl01((t - 44) / 6), 0, 0);
      hold(0.22, -0.05, -0.05);
      break;
    }
    case 'back': {
      const k1 = easeInOut(cl01(t / 14)), k2 = easeInOut(cl01((t - 14) / 16));
      set3(P.hipsRot, 16 * k1 + 30 * k2, 0, 0); set3(P.spine, 20 * k1 + 40 * k2, 0, 0);
      hold(0.2, 0.0, -0.05);
      break;
    }
    case 'rageA': case 'rageB': case 'smashA': {
      // barrage: alternate punches / kicks to the held victim on each hit frame
      const hits = g.hits;
      let idx = -1;
      for (let i = 0; i < hits.length; i++) if (mf >= hits[i].f - 4) idx = i;
      const last = idx === hits.length - 1;
      if (idx >= 0) {
        const h = hits[idx];
        const k = cl01(1 - Math.abs(mf - h.f) / 4);
        const limbs = (m.an.seq || ['hL', 'hR', 'hL', 'hR', 'fR', 'hR', 'hR']);
        const use = last ? (m.an.finish || 'hR') : limbs[idx % limbs.length];
        const s2 = use.endsWith('L') ? -1 : 1;
        const tgt = [vp[0] + s2 * 0.08, use[0] === 'f' ? 0.95 : 1.25, vp[2] - 0.1];
        const restP = P._r[use] || R[use];
        P._r[use] = [lerp(restP[0], tgt[0], k), lerp(restP[1], tgt[1], k), lerp(restP[2], tgt[2], k)];
        add3(P.spine, 8 * k + (last ? 14 * k : 0), s2 * (last ? 40 : 22) * k, 0);
        add3(P.hipsRot, 0, s2 * 10 * k, 0);
        add3(P.hips, 0, -0.04 * k, 0.05 * k);
      }
      break;
    }
    default: hold();
  }
  return P;
}

// ------------------------------------------------------------------ builder
export function buildPose(C) {
  const f = C.f;
  const P = stand(C);
  switch (f.state) {
    case ST.IDLE:
      if (f.stance && C.ch.stances?.[f.stance]) { stancePose(C, P, C.ch.stances[f.stance]); break; }
      if (f.crouch) crouchPose(C, P, 1); else if (f.walkDir || f.sideWalk) walkPose(C, P);
      if (f.guard && !f.crouch) { P._r.hL = [-0.13, 1.5, 0.38]; P._r.hR = [0.10, 1.43, 0.36]; add3(P.spine, 4, 0, 0); }
      if (f.guard === 'crouch') { P._r.hL = [-0.13, 1.12, 0.38]; P._r.hR = [0.1, 1.06, 0.36]; }
      break;
    case ST.DASHF: dashPose(C, P, false); break;
    case ST.DASHB: dashPose(C, P, true); break;
    case ST.RUN: runPose(C, P); break;
    case ST.SS: sidestepPose(C, P); break;
    case ST.CD: crouchPose(C, P, 1); add3(P.spine, 8, 0, 0); P.hips[2] += 0.06; break;
    case ST.JUMP: jumpPose(C, P); break;
    case ST.LAND: { const k = cl01(1 - f.stT / 5); crouchPose(C, P, 0.7 * k + 0.1); break; }
    case ST.ATK: attackPose(C, P); break;
    case ST.HIT: hitPose(C, P); break;
    case ST.BLK: blockPose(C, P); break;
    case ST.AIR: airPose(C, P); break;
    case ST.DOWN: case ST.KO: downPose(C, P); break;
    case ST.GETUP: getupPose(C, P); break;
    case ST.WALL: wallPose(C, P); break;
    case ST.GRAB: grabbedPose(C, P); break;
    case ST.INTRO: introPose(C, P); break;
    case ST.WIN: winPose(C, P); break;
    case ST.LOSE: losePose(C, P); break;
    default: break;
  }
  if (f.state === ST.ATK && f.aerial) { /* keep tuck from style */ }
  return finalize(P);
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
  if (C.f.walkDir) { const ph = C.f.walkPhase; if (P._r.fL) P._r.fL[2] += 0.1 * Math.sin(ph) * C.f.walkDir; if (P._r.fR) P._r.fR[2] -= 0.1 * Math.sin(ph) * C.f.walkDir; }
  return P;
}

// ------------------------------------------------------------------ Animator
const BLEND = { [ST.HIT]: 2, [ST.BLK]: 2, [ST.AIR]: 3, [ST.ATK]: 3, [ST.IDLE]: 6, [ST.DOWN]: 4, [ST.GETUP]: 3, [ST.GRAB]: 2, [ST.WALL]: 2 };

export class Animator {
  constructor(rig, fighter, ch) {
    this.rig = rig; this.f = fighter; this.ch = ch;
    this.cur = newPose(); this.prev = newPose(); this.out = newPose();
    this.key = ''; this.blend = 0; this.blendLen = 1; this.hasPrev = false;
    this.C = { f: fighter, ch, R: ch.rest, T: 0, frac: 0 };
    this.yawSmooth = null;
  }

  poseKey() {
    const f = this.f;
    return f.state + (f.move ? ':' + f.move.id : '') + (f.state === ST.HIT ? ':' + (f.hk && f.hk.kind) : '') + (f.stance ? ':' + f.stance : '') + (f.crouch ? 'c' : '') + (f.guard ? 'g' : '');
  }

  update(alpha, T, freeze) {
    const f = this.f;
    const C = this.C;
    C.T = T; C.frac = freeze ? 0 : alpha; C.alpha = alpha;
    const target = buildPose(C);
    const key = this.poseKey();
    if (key !== this.key) {
      const bl = f.state === ST.ATK ? 3 : (BLEND[f.state] ?? 4);
      if (this.hasPrev && !(this.key.startsWith('atk:') && f.state === ST.ATK && bl < 0)) { copyPose(this.prev, this.out); this.blend = bl; this.blendLen = bl; }
      this.key = key;
    }
    let P = target;
    if (this.blend > 0) {
      const k = 1 - this.blend / this.blendLen;
      lerpPose(this.out, this.prev, target, easeOut(k));
      P = this.out;
      // reduce (not tick per render frame) - decrement in sim frames handled by caller via tickBlend
    } else copyPose(this.out, target);
    this.hasPrev = true;
    this.cur = P;
    this.rig.apply(P);
    return P;
  }

  tickBlend(frames = 1) { if (this.blend > 0) this.blend = Math.max(0, this.blend - frames); }
}
