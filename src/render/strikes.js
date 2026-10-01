// Strike animation.  The simulation fixes WHEN a limb is where (windup, startup, active, recovery); this module decides HOW the
// body gets it there:
//   * kinetic chain: pelvis leads, then spine, then shoulder; each segment finishes at the first active frame but starts earlier
//   * anticipation: before the strike the body loads in the opposite direction and the limb is drawn back / chambered
//   * the limb accelerates into the target (the sim's own approach curve decelerates), retracts quickly, the body settles slower
//   * support foot pivots, heel lifts, weight shifts; free arm balances; hand / foot shapes
// During the active frames the limb path is exactly the simulation's (P -> Q), so the visuals cannot disagree with the hit volume.
import { add3, set3 } from './pose.js';
import { clamp, easeInOut, vlerp } from '../util.js';

const sm = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

// ------------------------------------------------------------------------------------------------ envelopes
// extension of a body segment: 0 at rest, 1 on the strike.  d (0..1) delays the start of the segment (0 = pelvis, 1 = hand-side
// extremity) and, on the way back, the return.
export function env(m, mf, d = 0) {
  const last = m.st + m.ac - 1;
  if (mf <= m.wf) return 0;
  if (mf < m.st) { const k = 0.55 * d; return sm(((mf - m.wf) / (m.st - m.wf) - k) / (1 - k)); }
  if (mf <= last) return 1;
  const r = (mf - last) / Math.max(1, m.total - last), k = 0.38 * d;
  return 1 - sm((r - k) / (1 - k));
}

// anticipation: loads over the windup, is released as the strike starts
export function windEnv(m, mf) {
  if (mf <= 0) return 0;
  if (mf < m.wf) return easeInOut(mf / m.wf);
  if (mf < m.st) return 1 - env(m, mf, 0);
  return 0;
}

// ------------------------------------------------------------------------------------------------ style table
// angles in degrees, lengths in metres.  See punchModel / kickModel for the meaning of the fields.
const PUNCH = { hy: 0, hyL: 0, ty: 0, tyL: 0, lean: 0, leanL: 0, roll: 0, hp: 0, lunge: 0, lungeL: 0, drop: 0, dropL: 0, shift: 0, head: 0, pv: 0.8, heel: 20, sh: 0.04, shUp: 0.015, wind: [0, -0.04, -0.14], acc: 2, pole: [0.4, -1, -0.2], fist: 1, wrist: 0 };
const KICK = { hy: 0, hyL: 0, hp: 0, hpL: 0, tilt: 0, ty: 0, roll: 0, sp: 0, spL: 0, lunge: 0, lungeL: 0, drop: 0, dropL: 0, head: 0, pv: 0.8, heel: 8, chamber: [0, 0.4, 0], fp: 20, fy: 0, fr: 0, arc: 0, acc: 1.8, arms: 'balance', pole: [0.15, 0.1, 1], armOut: 1 };

const P_ = (o) => ({ model: 'punch', ...PUNCH, ...o });
const K_ = (o) => ({ model: 'kick', ...KICK, ...o });

export const STY = {
  jab: P_({ hy: 5, hyL: 3, ty: 14, tyL: 6, lean: 6, leanL: 2, lunge: 0.05, lungeL: 0.015, drop: 0.02, dropL: 0.015, head: 6, pv: 0.6, heel: 14, sh: 0.05, wind: [0.03, -0.04, -0.12], pole: [0.35, -1, -0.2] }),
  cross: P_({ hy: 26, hyL: 12, ty: 38, tyL: 14, lean: 9, leanL: 3, roll: 3, lunge: 0.08, lungeL: 0.03, drop: 0.04, dropL: 0.025, head: 8, pv: 0.9, heel: 38, sh: 0.07, wind: [0.03, -0.05, -0.2], acc: 2.2, pole: [0.4, -1, -0.15] }),
  hook: P_({ hy: 30, hyL: 14, ty: 56, tyL: 24, lean: 6, roll: 8, lunge: 0.05, lungeL: 0.02, drop: 0.035, dropL: 0.03, head: 6, pv: 0.85, heel: 30, sh: 0.05, wind: [0.3, 0.02, -0.1], acc: 1.8, pole: [1, 0.15, -0.1] }),
  upper: P_({ hy: 14, hyL: 6, ty: 26, tyL: 8, lean: -22, leanL: -12, lunge: 0.06, drop: -0.06, dropL: 0.17, head: -8, pv: 0.8, heel: 24, sh: 0.05, wind: [0.05, -0.32, -0.08], pole: [0.3, -1, -0.4] }),
  elbow: P_({ hy: 22, hyL: 8, ty: 34, tyL: 10, lean: 14, lunge: 0.12, lungeL: 0.03, drop: 0.03, head: 8, wind: [0.1, 0.08, -0.22], pole: [1, 0.1, -0.3], fist: 0.5 }),
  chop: P_({ hy: 6, hyL: 4, ty: 10, tyL: 8, lean: 32, leanL: -14, lunge: 0.1, drop: 0.14, dropL: -0.03, head: 6, wind: [0.04, 0.55, -0.12], pole: [0.5, 0.6, -0.6], fist: 0.1 }),
  palm: P_({ hy: 14, hyL: 6, ty: 24, tyL: 8, lean: 6, lunge: 0.12, lungeL: 0.03, drop: 0.03, head: 4, wind: [0, -0.04, -0.22], fist: 0.05, pole: [0.4, -1, -0.15] }),
  burst: P_({ hy: 4, ty: 6, lean: 12, leanL: -8, lunge: 0.06, drop: 0.06, head: 6, wind: [0, -0.05, -0.28], fist: 0.1 }),
  lowpunch: P_({ hy: 8, ty: 8, lean: 34, lunge: 0.08, drop: 0.32, dropL: 0.05, head: 14, wind: [0.04, -0.1, -0.15] }),
  gpunch: P_({ hy: 4, ty: 0, lean: 52, leanL: -12, lunge: 0.15, drop: 0.42, dropL: 0.25, head: 20, wind: [0.04, 0.1, -0.1] }),
  spinback: P_({ hy: 0, ty: 20, lean: 6, drop: 0.03, wind: [0.2, 0.0, -0.2], pole: [0.8, 0.2, -0.3], acc: 1.6 }),
  shoulder: P_({ hy: 14, ty: 30, lean: 32, leanL: -6, lunge: 0.16, lungeL: 0.04, drop: 0.14, dropL: 0.04, head: 14, pv: 1, heel: 30, sh: 0.08 }),
  headbutt: P_({ lean: 34, leanL: -10, lunge: 0.12, lungeL: 0.04, drop: 0.06, head: 20, headL: -20, wind: [0, 0, 0] }),
  grab: P_({ lean: 12, lunge: 0.1, drop: 0.05, head: 4, fist: 0, wind: [0, 0, -0.1] }),
  // ---- kicks
  teep: K_({ hp: -16, hpL: -6, sp: 10, lunge: 0.05, drop: 0.02, head: 6, chamber: [0, 0.44, 0.08], fp: -68, acc: 1.7 }),
  kickhi: K_({ hp: -26, hpL: -8, tilt: 10, sp: 12, lunge: 0.03, head: 4, chamber: [0, 0.58, 0.06], fp: 30 }),
  lowkick: K_({ hy: 18, hyL: 6, ty: 12, sp: 16, lunge: 0.03, drop: 0.1, chamber: [0, 0.12, -0.26], fp: 22, acc: 2 }),
  round: K_({ hy: 46, hyL: 14, hp: -6, tilt: 12, ty: 22, sp: 4, lunge: 0.0, drop: 0.02, chamber: [0.06, 0.5, -0.2], fp: 35, fy: 38, arc: 0.22, acc: 1.9 }),
  roundhi: K_({ hy: 52, hyL: 18, hp: -8, tilt: 24, ty: 26, roll: 8, chamber: [0.06, 0.64, -0.2], fp: 35, fy: 40, arc: 0.26, acc: 1.9 }),
  roundlo: K_({ hy: 46, hyL: 16, hp: 8, tilt: 10, ty: 22, sp: 24, drop: 0.30, dropL: 0.06, chamber: [0.05, 0.2, -0.34], fp: 25, fy: 30, arc: 0.2 }),
  sweep: K_({ hy: 70, hyL: 20, hp: 6, ty: 30, sp: 32, drop: 0.44, dropL: 0.3, chamber: [0.05, 0.05, -0.3], fp: 10, fy: 20, arc: 0.12, armOut: 1.3 }),
  axe: K_({ hp: 8, hpL: -20, sp: 12, spL: -10, lunge: 0.06, lungeL: -0.02, drop: 0.04, chamber: [0, 1.5, 0.15], fp: 5, acc: 2.2, pole: [0.1, 0.1, 1] }),
  rise: K_({ hp: -22, hpL: 10, sp: 12, spL: 10, lunge: 0.06, drop: -0.06, dropL: 0.16, chamber: [0, 0.0, -0.4], fp: 28, acc: 1.8 }),
  knee: K_({ hp: -14, sp: 8, lunge: 0.04, drop: -0.04, chamber: [0, 0.2, -0.25], fp: 40, arms: 'clinch', acc: 1.8 }),
  stomp: K_({ hp: -6, hpL: -6, sp: 12, lunge: 0.05, drop: 0.05, chamber: [0, 0.58, 0.1], fp: -30, acc: 2.2 }),
  flykick: K_({ hp: -36, sp: 12, lunge: 0.1, drop: -0.1, chamber: [0, 0.28, -0.2], fp: -20, acc: 1.8 }),
  jumppunch: P_({ ty: 22, lean: 16, wind: [0.04, -0.04, -0.2], air: true }),
  jumpkick: K_({ hp: -22, sp: 8, chamber: [0, 0.3, -0.1], fp: -20, air: true }),
  spinkick: K_({ hp: -8, tilt: 14, chamber: [0.05, 0.4, -0.3], fp: 30, fy: 40, arc: 0.25, acc: 1.7 }),
};

// ------------------------------------------------------------------------------------------------ limb path
// visual path of the end effector (root space).  P -> Q during the active frames is the simulation's own; everything else is shaped.
export function visualLimb(S, sty) {
  const { m, mf, sd, R, limb } = S;
  const rest = R[limb] || R.hR;
  const P = m.P, Q = m.Q, last = m.st + m.ac - 1;
  if (mf <= 0) return rest.slice();
  let A;
  if (m.A) A = m.A;
  else if (sty.model === 'kick') {
    const base = restFoot(S);
    A = [base[0] + sd * sty.chamber[0], Math.max(base[1] + sty.chamber[1], 0), base[2] + sty.chamber[2]];
  } else A = [rest[0] + sd * sty.wind[0], rest[1] + sty.wind[1], rest[2] + sty.wind[2]];
  if (mf < m.wf) return vlerp(rest, A, easeInOut(mf / m.wf));
  if (mf < m.st) {
    const t = (mf - m.wf) / (m.st - m.wf);
    const p = vlerp(A, P, Math.pow(t, sty.acc));
    if (sty.arc) { const a = Math.sin(Math.PI * t) * sty.arc; p[0] += sd * a; p[1] += a * 0.5; }
    return p;
  }
  if (mf <= last) return m.ac > 1 ? vlerp(P, Q, (mf - m.st) / (m.ac - 1)) : P.slice();
  const t = clamp((mf - last) / Math.max(1, m.total - last), 0, 1);
  return vlerp(Q, rest, 1 - Math.pow(1 - t, 2.4));
}

function restFoot(S) {
  const R = S.R, l = S.limb;
  return (l === 'fL' || l === 'fR') ? R[l] : (R.fR || [0.17, 0, -0.14]);
}

// ------------------------------------------------------------------------------------------------ body models
function pivotFoot(P, side, yaw, heel) {
  const foot = side === 'L' ? P.footL : P.footR;
  foot[1] += yaw; foot[0] += heel; P.toe[side === 'L' ? 0 : 1] += heel * 0.4;
}

function punchModel(S, p) {
  const { P, m, mf, sd } = S;
  const e0 = env(m, mf, 0), e1 = env(m, mf, 0.35), e2 = env(m, mf, 0.7), w = windEnv(m, mf);
  const hy = sd * (p.hy * e0 - p.hyL * w);
  P.hipsRot[1] += hy;
  P.hipsRot[0] += p.hp * e0;
  P.spine[1] += sd * (p.ty * e1 - p.tyL * w);
  P.spine[0] += p.lean * e1 - p.leanL * w;
  P.spine[2] += -sd * p.roll * e1;
  P.hips[2] += p.lunge * e0 - p.lungeL * w;
  P.hips[1] += -p.drop * e0 - p.dropL * w;
  P.hips[0] += -sd * p.shift * e0;
  P.headAdd[0] += p.head * e1 - (p.headL || 0) * w;
  const sh = sd < 0 ? P.shL : P.shR;
  sh[0] += p.sh * e2 - 0.03 * w; sh[1] += p.shUp * e2;
  // rear foot: heel lifts and the foot turns with the hips (the pelvis drives off the back leg)
  pivotFoot(P, 'R', hy * p.pv, p.heel * e0);
  // hand shape
  const hand = S.limb[0] === 'e' ? (S.limb === 'eL' ? 0 : 1) : (sd < 0 ? 0 : 1);
  P.fist[hand] = 0.6 + (p.fist - 0.6) * clamp(w * 1.4 + e0, 0, 1);
  // elbow of the striking arm
  const ep = P.elbowPole;
  for (let i = 0; i < 3; i++) P.elbowPoleS[i] = ep[i] + (p.pole[i] - ep[i]) * e1;
}

function kickModel(S, p) {
  const { P, m, mf, sd } = S;
  const e0 = env(m, mf, 0), e1 = env(m, mf, 0.4), w = windEnv(m, mf);
  const hy = sd * (p.hy * e0 - p.hyL * w);
  P.hipsRot[1] += hy;
  P.hipsRot[0] += p.hp * e0 - (p.hpL || 0) * -w * 0 + (p.hpL || 0) * w;
  P.hipsRot[2] += -sd * p.tilt * e0;
  P.spine[0] += p.sp * e1 - (p.spL || 0) * w;
  P.spine[1] += -sd * p.ty * e1;
  P.spine[2] += -sd * p.roll * e1;
  P.hips[2] += p.lunge * e0 - p.lungeL * w;
  P.hips[1] += -p.drop * e0 - p.dropL * w;
  P.headAdd[0] += p.head * e1;
  // support foot pivots with the pelvis, heel slightly up
  pivotFoot(P, S.limb === 'fL' || S.limb === 'kL' ? 'R' : 'L', hy * p.pv, p.heel * e0);
  // striking foot shape: pitch (+ = toes pointed), yaw, roll
  const k = S.limb === 'fL' ? 0 : 1;
  const kf = k === 0 ? P.footL : P.footR;
  const pose = clamp(e0 + w * 0.5, 0, 1);
  kf[0] += p.fp * pose; kf[1] += sd * p.fy * e0; kf[2] += sd * p.fr * e0;
  const kp = P.kneePole;
  for (let i = 0; i < 3; i++) P.kneePoleS[i] = kp[i] + (p.pole[i] - kp[i]) * e0;
  // arms
  const e = clamp(e0 + w * 0.5, 0, 1);
  if (p.arms === 'balance') S.armsBalance(sd, e * (p.armOut || 1));
  else if (p.arms === 'clinch') { P._r.hL = [-0.13, 1.30 - 0.15 * e0, 0.62]; P._r.hR = [0.13, 1.30 - 0.15 * e0, 0.62]; S.C.pin.hL = S.C.pin.hR = true; }
}

// ------------------------------------------------------------------------------------------------ entry
export function applyStyle(S) {
  const { P, m, limb } = S;
  const sty = STY[m.style] || STY.jab;
  const sd = S.sd;
  const pt = visualLimb(S, sty);
  S.pt = pt;
  switch (limb[0]) {
    case 'h': P._r[limb] = pt.slice(); P.strikeArm = limb; break;
    case 'f': P._r[limb] = pt.slice(); P.strikeLeg = limb; break;
    case 'k': {
      // knee strike: the foot hangs below and behind the knee
      const foot = limb === 'kL' ? 'fL' : 'fR';
      P._r[foot] = [pt[0], Math.max(0.02, pt[1] - 0.38), pt[2] - 0.2];
      P.strikeLeg = foot;
      break;
    }
    case 'e': {
      const hand = limb === 'eL' ? 'hL' : 'hR';
      P._r[hand] = [pt[0] - sd * 0.02, pt[1] + 0.16, pt[2] - 0.20]; P.strikeArm = hand;
      break;
    }
    default: break;
  }
  if (sty.model === 'punch') punchModel(S, sty); else kickModel(S, sty);
  return pt;
}
