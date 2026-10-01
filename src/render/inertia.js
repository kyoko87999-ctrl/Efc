// Inertialization: smooth transitions between animation states without cross-fading.
// When the animation state changes, the difference between the last output and the new target is stored as an
// offset (+ velocity) that decays with a critically damped spring.  Unlike a cross-fade this keeps the velocity of the
// old motion, never averages two poses (no shrinking limbs) and the new animation plays at full strength from frame one.
import { VEC, SCALARS, SCALAR_ANGLE, R_KEYS } from './pose.js';

// flat channel layout --------------------------------------------------------------------------
const LAYOUT = [];                       // { key, i, angle, group, r }
const GROUP_OF = {
  hips: 'torso', hipsRot: 'torso', spine: 'torso', chest: 'torso', neck: 'torso', head: 'torso', headAdd: 'torso',
  kneePole: 'legs', elbowPole: 'arms', kneePoleS: 'legs', elbowPoleS: 'arms', ankle: 'legs', wristL: 'arms', wristR: 'arms', shL: 'arms', shR: 'arms',
  footL: 'legs', footR: 'legs', toe: 'legs', fist: 'arms', gaze: 'face',
};
for (const [key, n, angle] of VEC) for (let i = 0; i < n; i++) LAYOUT.push({ key, i, angle: !!angle, group: GROUP_OF[key] || 'torso', r: false });
for (const key of SCALARS) LAYOUT.push({ key, i: -1, angle: SCALAR_ANGLE.has(key), group: /^(blink|mouth|brow|browUp|squint)$/.test(key) ? 'face' : 'torso', r: false });
for (const key of R_KEYS) for (let i = 0; i < 3; i++) LAYOUT.push({ key, i, angle: false, group: key[0] === 'h' ? 'arms' : 'legs', r: true });
export const NCH = LAYOUT.length;

export function channelIndex(group, key) { const out = []; LAYOUT.forEach((c, n) => { if (c.group === group && (!key || c.key === key)) out.push(n); }); return out; }
export function channelsOf(key, isR = false) { const out = []; LAYOUT.forEach((c, n) => { if (c.key === key && c.r === isR) out.push(n); }); return out; }

export function flatten(P, out) {
  for (let n = 0; n < NCH; n++) {
    const c = LAYOUT[n];
    out[n] = c.r ? (P._r[c.key] ? P._r[c.key][c.i] : P[c.key][c.i]) : c.i < 0 ? P[c.key] : P[c.key][c.i];
  }
  return out;
}

export function unflatten(arr, P) {
  for (let n = 0; n < NCH; n++) {
    const c = LAYOUT[n];
    if (c.r) { if (!P._r[c.key]) P._r[c.key] = [P[c.key][0], P[c.key][1], P[c.key][2]]; P._r[c.key][c.i] = arr[n]; }
    else if (c.i < 0) P[c.key] = arr[n]; else P[c.key][c.i] = arr[n];
  }
  return P;
}

const wrap = (d) => { d %= 360; return d > 180 ? d - 360 : d < -180 ? d + 360 : d; };
const LN2 = Math.LN2;

export class Inertializer {
  constructor() {
    this.off = new Float64Array(NCH); this.vel = new Float64Array(NCH);
    this.target = new Float64Array(NCH);        // last target (post-transition)
    this.tvel = new Float64Array(NCH);          // last target velocity (per frame)
    this.out = new Float64Array(NCH);
    this.ready = false;
    this.hl = new Float64Array(NCH).fill(4);
    this.w = new Float64Array(NCH).fill(1);        // per-channel weight of the offset (0 = already on target)
  }

  reset() { this.off.fill(0); this.vel.fill(0); this.w.fill(1); this.ready = false; }

  // halflife: { torso, arms, legs, face } in frames (face <= 0 disables inertia for those channels)
  setHalflife(h) { for (let n = 0; n < NCH; n++) { const g = LAYOUT[n].group; this.hl[n] = h[g] ?? h.torso ?? 4; } }

  // tgt: flat target of this frame; dt: frames advanced; transition: state changed this frame
  update(tgt, dt, transition) {
    const { off, vel, target, tvel, out, hl } = this;
    if (!this.ready) { for (let n = 0; n < NCH; n++) { target[n] = tgt[n]; tvel[n] = 0; off[n] = 0; vel[n] = 0; out[n] = tgt[n]; } this.ready = true; return out; }
    if (dt <= 0 && !transition) { for (let n = 0; n < NCH; n++) out[n] = tgt[n] + off[n] * this.w[n]; return out; }
    for (let n = 0; n < NCH; n++) {
      const c = LAYOUT[n];
      let tv;
      if (transition) {
        // continuity of position and velocity with what was on screen
        const prevOut = out[n];                                // what was on screen
        const prevVel = tvel[n] + vel[n];
        let o = prevOut - tgt[n];
        if (c.angle) o = wrap(o);
        const lim = c.angle ? 160 : 0.9;
        off[n] = o > lim ? lim : o < -lim ? -lim : o;
        const pv = c.angle ? 14 : 0.09;                        // per-frame velocity cap
        vel[n] = prevVel > pv ? pv : prevVel < -pv ? -pv : prevVel;
        tv = 0;
      } else {
        let d = tgt[n] - target[n];
        if (c.angle) d = wrap(d);
        tv = d / dt;
      }
      const h = hl[n];
      if (h <= 0) { off[n] = 0; vel[n] = 0; }
      else if (dt > 0) {
        const w = 2 * LN2 / h, e = Math.exp(-w * dt);
        const j1 = vel[n] + off[n] * w;
        off[n] = e * (off[n] + j1 * dt);
        vel[n] = e * (vel[n] - j1 * w * dt);
      }
      if (dt > 0 || transition) { target[n] = tgt[n]; tvel[n] = tv; }
      out[n] = tgt[n] + off[n] * this.w[n];
    }
    return out;
  }

  // scale the offsets of some channels (e.g. force the striking limb onto its target before the first active frame)
  damp(indices, k) { for (const n of indices) { this.off[n] *= k; this.vel[n] *= k; } }
}
