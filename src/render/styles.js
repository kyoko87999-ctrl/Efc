// Attack posture styles. Each style receives the pose (already set to the base stance) and
// adjusts torso / hips / support limbs while the striking limb follows the sim-defined path.
import { limbAt } from '../sim/move.js';
import { easeOut, easeInOut, clamp, lerp } from '../util.js';
import { add3, set3, cp3 } from './pose.js';

export function progress(m, mf) {
  const st = m.st, last = m.st + m.ac - 1, wf = m.wf, total = m.total;
  let wind = 0, ext = 0;
  if (mf < wf) { wind = easeInOut(mf / wf); }
  else if (mf < st) { const t = (mf - wf) / Math.max(1, st - wf); wind = 1 - easeOut(t); ext = easeOut(t); }
  else if (mf <= last) { ext = 1; }
  else { const t = clamp((mf - last) / Math.max(1, total - last), 0, 1); ext = 1 - easeInOut(t); }
  return { wind, ext };
}

const sideOf = (limb) => (limb.endsWith('L') ? -1 : 1);

// helpers
const rot = (a, p, y, r) => { a[0] += p; a[1] += y; a[2] += r; };

// Each style: (S) where S = { P, m, mf, ext, wind, sd, R, pt, limb, f }
const punchCommon = (S, twist, lean, lunge, drop = 0.03) => {
  const { P, ext, wind, sd } = S;
  rot(P.spine, lean * ext, sd * twist * ext - sd * 0.5 * twist * wind, 0);
  rot(P.hipsRot, 0, sd * twist * 0.5 * ext, 0);
  add3(P.hips, 0, -drop * ext, lunge * ext);
  rot(P.head, -5 * ext, -sd * 4 * ext, 0);
};

export const STYLES = {
  jab(S) { punchCommon(S, 10, 9, 0.05); },
  cross(S) {
    punchCommon(S, 40, 10, 0.08);
    rot(S.P.hipsRot, 0, S.sd * 10 * S.ext, 0);
  },
  hook(S) {
    const { P, ext, wind, sd } = S;
    rot(P.spine, 6 * ext, sd * 52 * ext - sd * 40 * wind, -sd * 10 * ext);
    rot(P.hipsRot, 0, sd * 24 * ext - sd * 18 * wind, 0);
    add3(P.hips, 0, -0.03 * ext, 0.04 * ext);
  },
  upper(S) {
    const { P, ext, wind, sd } = S;
    add3(P.hips, 0, -0.17 * wind - 0.06 * ext, 0.06 * ext);
    rot(P.spine, 12 * wind - 22 * ext, sd * 26 * ext, 0);
    rot(P.hipsRot, 0, sd * 12 * ext, 0);
    rot(P.head, -8 * ext, 0, 0);
    S.P._r.fL = S.P._r.fL || S.R.fL; // planted
  },
  elbow(S) { punchCommon(S, 36, 14, 0.12); },
  chop(S) {
    const { P, ext, wind, sd } = S;
    add3(P.hips, 0, 0.02 * wind - 0.14 * ext, 0.1 * ext);
    rot(P.spine, -12 * wind + 34 * ext, sd * 16 * ext, 0);
    rot(P.head, -6 * ext, 0, 0);
  },
  palm(S) { punchCommon(S, 24, 6, 0.12); },
  burst(S) {
    const { P, ext, wind } = S;
    add3(P.hips, 0, -0.06 * ext, 0.06 * ext);
    rot(P.spine, 12 * ext - 8 * wind, 0, 0);
    // both hands thrust forward
    const p = S.pt;
    P._r.hL = [-p[0] - 0.14, p[1] - 0.02, p[2]];
    P._r.hR = [p[0] + 0.14, p[1] - 0.02, p[2]];
  },
  lowpunch(S) {
    const { P, ext } = S;
    add3(P.hips, 0, -0.32 * ext - 0.05, 0.08 * ext);
    rot(P.spine, 34 * ext, S.sd * 8 * ext, 0);
    rot(P.head, -20 * ext, 0, 0);
    P._r.fL = [-0.24, 0, 0.30]; P._r.fR = [0.22, 0, -0.12];
  },
  gpunch(S) {
    const { P, ext, wind } = S;
    add3(P.hips, 0, -0.42 * Math.max(ext, wind * 0.6) - 0.05, 0.15 * ext);
    rot(P.spine, 52 * ext + 12 * wind, 0, 0);
    rot(P.head, -30 * ext, 0, 0);
    P._r.fL = [-0.26, 0, 0.30]; P._r.fR = [0.24, 0, -0.10];
  },
  // ---------------------------------------------------------------- kicks
  teep(S) {
    const { P, ext, wind, sd } = S;
    rot(P.hipsRot, -16 * ext - 6 * wind, 0, 0);
    add3(P.hips, 0, 0.0 - 0.02 * ext, -0.06 * ext);
    rot(P.spine, 10 * ext, 0, 0);
    rot(P.head, 6 * ext, 0, 0);
    S.armsBalance(sd, ext);
  },
  kickhi(S) {
    const { P, ext, wind, sd } = S;
    rot(P.hipsRot, -26 * ext - 8 * wind, 0, -sd * -8 * ext);
    add3(P.hips, 0, 0.0, -0.08 * ext);
    rot(P.spine, 14 * ext, 0, 0);
    S.armsBalance(sd, ext);
  },
  lowkick(S) {
    const { P, ext, wind, sd } = S;
    add3(P.hips, 0, -0.10 * ext, 0.03 * ext);
    rot(P.spine, 16 * ext, sd * 14 * ext, 0);
    rot(P.hipsRot, 0, sd * 18 * ext, 0);
  },
  round(S) {
    const { P, ext, wind, sd } = S;
    rot(P.hipsRot, -6 * ext, sd * 46 * ext - sd * 16 * wind, -sd * 12 * ext);
    rot(P.spine, 0, -sd * 22 * ext, 0);
    add3(P.hips, 0, -0.02 * ext, 0);
    S.armsBalance(sd, ext);
  },
  roundhi(S) {
    const { P, ext, wind, sd } = S;
    rot(P.hipsRot, -8 * ext, sd * 52 * ext - sd * 18 * wind, -sd * 24 * ext);
    rot(P.spine, 0, -sd * 26 * ext, -sd * 8 * ext);
    add3(P.hips, 0, 0, -0.02 * ext);
    S.armsBalance(sd, ext);
  },
  roundlo(S) {
    const { P, ext, wind, sd } = S;
    add3(P.hips, 0, -0.30 * ext - 0.06 * wind, 0);
    rot(P.hipsRot, 8 * ext, sd * 46 * ext - sd * 16 * wind, -sd * 10 * ext);
    rot(P.spine, 24 * ext, -sd * 22 * ext, 0);
    S.armsBalance(sd, ext);
  },
  sweep(S) {
    const { P, ext, wind, sd } = S;
    add3(P.hips, 0, -0.44 * Math.max(ext, wind * 0.8), 0);
    rot(P.hipsRot, 6 * ext, sd * 70 * ext - sd * 20 * wind, 0);
    rot(P.spine, 32 * ext, -sd * 30 * ext, 0);
    P._r.hL = [-0.5, 0.25, 0.55]; P._r.hR = [0.5, 0.3, 0.4];
    P._r.fL = [-0.30, 0, 0.30];
  },
  axe(S) {
    const { P, ext, wind, sd } = S;
    rot(P.hipsRot, -20 * wind + 8 * ext, 0, 0);
    add3(P.hips, 0, 0.04 * wind - 0.04 * ext, -0.02 * wind + 0.06 * ext);
    rot(P.spine, -10 * wind + 12 * ext, 0, 0);
    S.armsBalance(sd, ext + wind);
  },
  rise(S) {
    const { P, ext, wind, sd } = S;
    add3(P.hips, 0, -0.16 * wind + 0.06 * ext, 0.06 * ext);
    rot(P.hipsRot, 10 * wind - 22 * ext, 0, 0);
    rot(P.spine, 12 * wind - 18 * ext, 0, 0);
    S.armsBalance(sd, ext);
  },
  knee(S) {
    const { P, ext, wind, sd } = S;
    rot(P.hipsRot, -12 * ext, 0, 0);
    add3(P.hips, 0, 0.04 * ext, 0.04 * ext);
    rot(P.spine, 8 * ext, 0, 0);
    // hands pull down like a clinch
    P._r.hL = [-0.13, 1.30 - 0.15 * ext, 0.62]; P._r.hR = [0.13, 1.30 - 0.15 * ext, 0.62];
  },
  stomp(S) {
    const { P, ext, wind, sd } = S;
    rot(P.hipsRot, -6 * wind, 0, 0);
    add3(P.hips, 0, 0.03 * wind - 0.05 * ext, 0.05 * ext);
    rot(P.spine, 12 * ext, 0, 0);
    S.armsBalance(sd, ext);
  },
  flykick(S) {
    const { P, ext, wind, sd } = S;
    rot(P.hipsRot, -36 * ext, 0, 0);
    add3(P.hips, 0, 0.10 * ext, 0.1 * ext);
    rot(P.spine, 12 * ext, 0, 0);
    P._r[sd < 0 ? 'fR' : 'fL'] = [sd < 0 ? 0.16 : -0.16, 0.28 + 0.1 * ext, -0.25];
    S.armsBalance(sd, ext);
  },
  jumppunch(S) {
    const { P, ext, sd } = S;
    S.airTuck();
    rot(P.spine, 16 * ext, sd * 22 * ext, 0);
  },
  jumpkick(S) {
    const { P, ext, sd } = S;
    S.airTuck();
    rot(P.hipsRot, -22 * ext, 0, 0);
    P._r[sd < 0 ? 'fR' : 'fL'] = [sd < 0 ? 0.16 : -0.16, 0.3, -0.2];
  },
  shoulder(S) {
    const { P, ext, wind, sd } = S;
    add3(P.hips, 0, -0.14 * ext - 0.04 * wind, 0.16 * ext);
    rot(P.spine, 32 * ext - 6 * wind, sd * -30 * ext, sd * 6 * ext);
    rot(P.hipsRot, 0, -sd * 14 * ext, 0);
    rot(P.head, -14 * ext, 0, 0);
    P._r.hL = [-0.2, 1.1, 0.35]; P._r.hR = [0.2, 1.1, 0.35];
  },
  headbutt(S) {
    const { P, ext, wind } = S;
    add3(P.hips, 0, -0.06 * ext, 0.12 * ext);
    rot(P.spine, 34 * ext - 10 * wind, 0, 0);
    rot(P.head, 20 * ext - 20 * wind, 0, 0);
    P._r.hL = [-0.3, 1.0, 0.25]; P._r.hR = [0.3, 1.0, 0.25];
  },
  spinback(S) {
    const { P, ext, wind, sd } = S;
    rot(P.spine, 6 * ext, -sd * 20 * ext, 0);
    add3(P.hips, 0, -0.03 * ext, 0);
  },
  spinkick(S) {
    const { P, ext, wind, sd } = S;
    rot(P.hipsRot, -8 * ext, 0, -sd * 14 * ext);
    add3(P.hips, 0, -0.02 * ext, 0);
    S.armsBalance(sd, ext);
  },
  grab(S) {
    const { P, ext, wind } = S;
    rot(P.spine, 12 * ext, 0, 0);
    add3(P.hips, 0, -0.05 * ext, 0.1 * ext);
    const p = S.pt;
    P._r.hL = [-0.20, p[1], p[2] + 0.02]; P._r.hR = [0.20, p[1], p[2] + 0.02];
  },
};

// ---------------------------------------------------------------- limb target + support handling
export function applyStrike(S) {
  const { P, m, mf, R, limb, f } = S;
  const pt = limbAt(m, mf, R[limb] || R.hR);
  S.pt = pt;
  const kind = limb[0];
  const sd = S.sd;
  switch (kind) {
    case 'h': P._r[limb] = pt; break;
    case 'f': P._r[limb] = pt; P.ankle[sd < 0 ? 0 : 1] = 25 * S.ext; break;
    case 'k': {
      // knee strike: foot hangs below and behind the knee
      const foot = limb === 'kL' ? 'fL' : 'fR';
      P._r[foot] = [pt[0], Math.max(0.02, pt[1] - 0.36), pt[2] - 0.20];
      P.kneePole = [0.05, 0.0, 1.0];
      break;
    }
    case 'e': {
      const hand = limb === 'eL' ? 'hL' : 'hR';
      P._r[hand] = [pt[0] - sd * 0.02, pt[1] + 0.16, pt[2] - 0.20];
      P.elbowPole = [0.3, -0.1, -0.9];
      break;
    }
    default: break;
  }
  return pt;
}
