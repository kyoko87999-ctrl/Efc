// Attack poses: base stance + strike style (strikes.js) + the reach spec that lets the solver bring the striking limb to the
// point the simulation says it hits.
import { lerpPose, copyPose, syncPoles } from './pose.js';
import { applyStyle } from './strikes.js';
import { stand, crouch, lying, snap, tf, cl01 } from './poses.js';
import { scriptPose } from './scripts.js';
import { REACH } from './reach.js';
import { easeInOut, smooth } from '../util.js';

const sideOf = (limb) => (limb.endsWith('L') ? -1 : 1);
const OTHER_FOOT = { fL: 'fR', fR: 'fL' };

export function attackPose(C, P) {
  const f = C.f, m = f.move;
  const mf = tf(C, f.mf);
  const R = C.R;
  const limb = m.limb, sd = sideOf(limb);
  const wake = m.an && m.an.wake;
  if (m.crouchMove || m.ctx === 'cd') crouch(C, P, 0.85); else stand(C, P);
  syncPoles(P);
  const S = {
    C, P, m, mf, sd, R, limb, f, pt: null,
    armsBalance(dir, e) {
      // the free arm swings out for balance, the other one guards
      const free = dir < 0 ? 'hR' : 'hL';
      const o = dir < 0 ? 1 : -1;
      P._r[free] = [o * (0.28 + 0.34 * e), 1.05 + 0.25 * e, -0.05 - 0.25 * e];
      C.pin[free] = true;
    },
  };
  C.gait.mode = 'lock'; C.gait.settle = 0.34;
  const airMove = f.aerial || f.y > 0.05 || m.style === 'jumppunch' || m.style === 'jumpkick';
  if (airMove) C.gait.mode = 'free';
  if (wake) {
    const lyingP = snap(C, 0, (T) => lying(C, T, f.faceUp !== false));
    const to = snap(C, 1, (T) => stand(C, T));
    const k = smooth(cl01(mf / 9));
    const out = C.tmp(2); lerpPose(out, lyingP, to, k); copyPose(P, out);
    S.armsBalance = () => {};
    C.gait.mode = mf < 12 ? 'free' : 'lock';
  }
  if (m.style === 'grab' && m.grab && f.mf >= m.st && f.grabbing) { scriptPose(C, P, m, mf); return P; }
  const pt = applyStyle(S);
  // special shapes
  if (m.style === 'burst') {
    P._r.hL = [-pt[0] - 0.14, pt[1] - 0.02, pt[2]]; P._r.hR = [pt[0] + 0.14, pt[1] - 0.02, pt[2]];
    C.pin.hL = C.pin.hR = true; P.fist = [0.2, 0.2];
  } else if (m.style === 'grab') {
    P._r.hL = [-0.20, pt[1], pt[2] + 0.02]; P._r.hR = [0.20, pt[1], pt[2] + 0.02]; C.pin.hL = C.pin.hR = true; P.fist = [0, 0];
  } else if (m.style === 'shoulder' || m.style === 'headbutt') {
    P._r.hL = [-0.2, 1.1, 0.35]; P._r.hR = [0.2, 1.1, 0.35]; C.pin.hL = C.pin.hR = true;
  }
  if (airMove) {
    // tuck the legs that are not striking
    if (limb[0] === 'f') { const other = OTHER_FOOT[limb]; P._r[other] = other === 'fL' ? [-0.13, 0.35, 0.12] : [0.13, 0.32, -0.02]; }
    else { P._r.fL = [-0.13, 0.35, 0.12]; P._r.fR = [0.13, 0.32, -0.02]; }
    P.kneePole = [0.2, 0, 1]; P.kneePoleS = [0.2, 0, 1];
  }
  // a whiffed strike carries the body: it lurches forward a little while the recovery plays out
  if (!f.contact && !m.noHit && m.lv !== 't') {
    const last = m.st + m.ac - 1;
    if (mf > last) {
      const r = cl01((mf - last) / Math.max(1, m.total - last)), w = Math.sin(Math.PI * r) * Math.min(1, 0.4 + m.dmg / 18);
      P.spine[0] += 5 * w; P.hips[2] += 0.03 * w; P.headAdd[0] += 4 * w; P.hips[1] -= 0.012 * w;
    }
  }
  // full-body spin / flip
  if (m.an) {
    if (m.an.spin) { const [a, b, deg] = m.an.spin; P.hipsRot[1] += -sd * deg * easeInOut(cl01((mf - a) / (b - a))); }
    if (m.an.flip) { const [a, b, deg] = m.an.flip; P.hipsRot[0] += -deg * easeInOut(cl01((mf - a) / (b - a))); }
    if (m.an.script && (m.an.script === 'rageA' || m.an.script === 'smashA' || m.an.script === 'rageB') && f.grabbing) { scriptPose(C, P, m, mf); return P; }
  }
  // limbs authored in root space do not follow the torso
  if (limb[0] === 'h') C.pin[limb] = true;
  if (limb[0] === 'e') C.pin[limb === 'eL' ? 'hL' : 'hR'] = true;
  if (m.noHit) return P;
  // ---- reach spec
  if (limb[0] === 'h') P.reach = { key: limb, track: true, reach: REACH.arm };
  else if (limb[0] === 'f') P.reach = { key: limb, track: true, reach: REACH.leg, support: [OTHER_FOOT[limb]] };
  else if (limb[0] === 'k') {
    // the KNEE is the weapon: shin hangs below / behind it, the knee pole is aimed at the strike point
    const foot = limb === 'kL' ? 'fL' : 'fR';
    P._r[foot] = [pt[0], Math.max(0.02, pt[1] - 0.40), pt[2] - 0.18];
    P.reach = { key: foot, target: pt, reach: REACH.thigh, support: [OTHER_FOOT[foot]], pole: pt, poleKey: foot };
  } else if (limb[0] === 'e') {
    // the ELBOW is the weapon: forearm folds back across the body
    const hand = limb === 'eL' ? 'hL' : 'hR';
    P._r[hand] = [pt[0] - sd * 0.17, pt[1] + 0.13, pt[2] - 0.24];
    P.reach = { key: hand, target: pt, reach: REACH.upper, pole: pt, poleKey: hand };
  }
  else if (limb === 'sh') P.reach = { key: sd < 0 ? 'hL' : 'hR', target: pt, reach: 0.03 };
  else if (limb === 'hd') P.reach = { key: 'hd', target: pt, reach: 0.04 };
  return P;
}
