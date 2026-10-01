// Reach solver: moves the body (shoulder protraction, chest twist, lean, lunge, pelvis) just enough that a striking
// limb can really touch the point the simulation says it hits.  Without this the arms / legs (fixed length) stop short of
// the hit volume.  The least-effort combination of body motions is chosen, so punches that are already in reach look
// exactly like authored poses and long ones get a natural lunge.
import { ARM_REACH, LEG_REACH, LEN, ANKLE_H } from './skel.js';
import { clamp } from '../util.js';

const _S = [0, 0, 0], _S2 = [0, 0, 0];

// parameter set -------------------------------------------------------------------------------
function armParams(P, key) {
  const sh = key === 'hL' ? P.shL : P.shR;
  return [
    { get: () => sh[0], set: (v) => { sh[0] = v; }, lo: 0, hi: 0.1, c: 0.4, eps: 0.01 },
    { get: () => P.chest[1], set: (v) => { P.chest[1] = v; }, lo: -34, hi: 34, c: 0.9 / 900, eps: 2 },
    { get: () => P.spine[0], set: (v) => { P.spine[0] = v; }, lo: -6, hi: 42, c: 1.6 / 400, eps: 2 },
    { get: () => P.hips[2], set: (v) => { P.hips[2] = v; }, lo: -0.06, hi: 0.26, c: 1.0 * 4, eps: 0.015 },
    { get: () => P.hipsRot[1], set: (v) => { P.hipsRot[1] = v; }, lo: -30, hi: 30, c: 1.2 / 900, eps: 2 },
    { get: () => P.hipsRot[0], set: (v) => { P.hipsRot[0] = v; }, lo: -14, hi: 55, c: 2.6 / 900, eps: 2 },
    { get: () => P.hips[1], set: (v) => { P.hips[1] = v; }, lo: 0.5, hi: 1.0, c: 7, eps: 0.015 },
  ];
}
function legParams(P, key) {
  return [
    { get: () => P.hips[2], set: (v) => { P.hips[2] = v; }, lo: -0.12, hi: 0.2, c: 3.0, eps: 0.015 },
    { get: () => P.hipsRot[0], set: (v) => { P.hipsRot[0] = v; }, lo: -42, hi: 14, c: 1.0 / 900, eps: 2 },
    { get: () => P.hipsRot[2], set: (v) => { P.hipsRot[2] = v; }, lo: -30, hi: 30, c: 1.4 / 900, eps: 2 },
    { get: () => P.hips[1], set: (v) => { P.hips[1] = v; }, lo: 0.5, hi: 0.98, c: 6, eps: 0.012 },
    { get: () => P.spine[0], set: (v) => { P.spine[0] = v; }, lo: -14, hi: 22, c: 2.2 / 400, eps: 2 },
  ];
}

const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// spec: { key: 'hL' | 'hR' | 'fL' | 'fR' (limb whose root joint is measured), target: [s,u,f], reach, support?: ['fR'] }
// Returns the remaining error (m) after the best effort.
export function solveReach(rig, P, spec) {
  const key = spec.key, target = spec.target;
  const leg = key[0] === 'f';
  const params = leg ? legParams(P, key) : armParams(P, key);
  const reach = spec.reach;
  let err = 0;
  for (let it = 0; it < 3; it++) {
    rig.jointRoot(P, key, _S);
    const vx = target[0] - _S[0], vy = target[1] - _S[1], vz = target[2] - _S[2];
    const d = Math.hypot(vx, vy, vz);
    err = d - reach;
    if (err <= 0.004) return 0;
    const u = [vx / d, vy / d, vz / d];
    // gradient of the root-joint position along u for each parameter (finite differences)
    const g = params.map((p) => {
      const v0 = p.get();
      p.set(v0 + p.eps); rig.jointRoot(P, key, _S2); p.set(v0);
      return ((_S2[0] - _S[0]) * u[0] + (_S2[1] - _S[1]) * u[1] + (_S2[2] - _S[2]) * u[2]) / p.eps;
    });
    // least-cost allocation of `err` over the parameters that help, honouring bounds
    const delta = new Array(params.length).fill(0);
    const free = params.map((_, i) => Math.abs(g[i]) > 1e-4);
    let rem = err;
    for (let round = 0; round < 3 && rem > 0.0005; round++) {
      let den = 0;
      params.forEach((p, i) => { if (free[i]) den += g[i] * g[i] / p.c; });
      if (den < 1e-9) break;
      const lam = rem / den;
      let used = 0;
      params.forEach((p, i) => {
        if (!free[i]) return;
        const want = lam * g[i] / p.c;
        const cur = p.get() + delta[i];
        const nxt = clamp(cur + want, p.lo, p.hi);
        const dd = nxt - cur;
        delta[i] += dd; used += g[i] * dd;
        if (Math.abs(dd - want) > 1e-9) free[i] = false;
      });
      rem -= used;
    }
    params.forEach((p, i) => { if (delta[i]) p.set(p.get() + delta[i]); });
    // keep the supporting legs inside their own reach
    if (spec.support) {
      for (const sk of spec.support) {
        const ft = P._r[sk];
        if (!ft) continue;
        for (let s = 0; s < 4; s++) {
          rig.jointRoot(P, sk, _S2);
          const dd = dist3(_S2, [ft[0], ft[1] + ANKLE_H, ft[2]]);
          if (dd <= (LEN.thigh + LEN.shin) * 0.97) break;
          // pull the offending parameters back halfway
          params.forEach((p, i) => { if (delta[i]) p.set(p.get() - delta[i] * 0.5); delta[i] *= 0.5; });
        }
      }
    }
  }
  rig.jointRoot(P, key, _S);
  return Math.max(0, dist3(_S, target) - reach);
}

export const REACH = { arm: ARM_REACH * 0.985, leg: LEG_REACH * 0.985, upper: LEN.upper * 0.98, thigh: LEN.thigh * 0.98 };
