// Impact reactions: damped springs that are kicked when a hit / block lands, so the body whips, doubles over,
// overshoots and settles instead of just playing a fixed flinch pose.
import { clamp } from '../util.js';

class Spring {
  constructor(w, z) { this.x = 0; this.v = 0; this.w = w; this.z = z; }
  kick(v) { this.v += v; }
  step(dt) {
    // semi-implicit Euler with sub-steps (frames)
    const n = Math.max(1, Math.ceil(dt / 0.5)), h = dt / n;
    for (let i = 0; i < n; i++) {
      this.v += (-this.w * this.w * this.x - 2 * this.z * this.w * this.v) * h;
      this.x += this.v * h;
    }
  }
}

export class Reactor {
  constructor(mass = 1) {
    this.mass = mass;
    const S = (w, z) => new Spring(w, z);
    this.s = {
      spine: S(0.26, 0.32), spineYaw: S(0.24, 0.3), roll: S(0.24, 0.3),
      headP: S(0.34, 0.26), headY: S(0.32, 0.26), headR: S(0.3, 0.3),
      hipsZ: S(0.2, 0.45), hipsX: S(0.2, 0.45), hipsY: S(0.3, 0.4),
      armZ: S(0.3, 0.28), armX: S(0.3, 0.28), armY: S(0.3, 0.3),
      shoulder: S(0.34, 0.3), squash: S(0.38, 0.4),
    };
    this.seq = 0;
    this.energy = 0;
  }

  reset() { for (const k in this.s) { this.s[k].x = 0; this.s[k].v = 0; } this.energy = 0; }

  // info: { kind: 'hit'|'block'|'crush', lv, dmg, counter, heavy, launch }, pf / ps: push direction in the defender's frame
  // (pf > 0 pushes the defender forward, ps > 0 to its right)
  impact(info, pf, ps) {
    const hit = info.kind !== 'block';
    let m = clamp((info.dmg || 8) / 15, 0.35, 2.3) * (info.counter ? 1.25 : 1) * (info.heavy ? 1.15 : 1) * (hit ? 1 : 0.4);
    m /= Math.sqrt(this.mass);
    const s = this.s, lv = info.lv;
    const high = lv === 'h', low = lv === 'l';
    // torso: high hits snap the upper body back, mid hits fold it, low hits bend it forward
    const front = Math.max(0, -pf), rear = Math.max(0, pf);
    s.spine.kick(high ? 5.5 * pf * m : low ? 4 * m : (8 * front - 4 * rear) * m);
    s.spineYaw.kick(ps * 6 * m);
    s.roll.kick(-ps * 4.5 * m);
    s.headP.kick(high ? 14 * pf * m : low ? 3 * m : (7 * front - 3 * rear) * m);
    s.headY.kick(ps * 11 * m);
    s.headR.kick(-ps * 6 * m);
    s.hipsZ.kick(pf * 0.012 * m);
    s.hipsX.kick(ps * 0.008 * m);
    s.hipsY.kick((low ? -0.016 : -0.006) * m);
    s.armZ.kick(pf * 0.03 * m);
    s.armX.kick(ps * 0.02 * m);
    s.armY.kick((high ? 0.02 : 0.012) * m);
    s.shoulder.kick(-0.01 * m);
    s.squash.kick(-0.006 * m);
    this.energy = Math.min(2.5, this.energy + m);
  }

  // the attacker's own body feels its strike connect: a short rock-back of the torso / shoulder girdle (never touches the striking arm)
  recoil(hit, heavy, pf) {
    const s = this.s, m = (hit ? 1 : 0.6) * (heavy ? 1.4 : 1) / Math.sqrt(this.mass);
    s.spine.kick(-1.4 * m); s.headP.kick(-2.2 * m); s.shoulder.kick(-0.008 * m); s.hipsZ.kick(-0.004 * m * (pf || 1));
    this.energy = Math.min(2.5, this.energy + 0.3 * m);
  }

  // squash & stretch impulse (landing, take-off, big impacts); + stretches
  kickSquash(v) { this.s.squash.kick(v); this.energy = Math.min(2.5, this.energy + Math.abs(v) * 8); }

  step(dtF) {
    if (dtF <= 0) return;
    for (const k in this.s) this.s[k].step(dtF);
    this.energy *= Math.pow(0.95, dtF);
  }

  // add the spring offsets to a pose (w scales the whole effect)
  apply(P, w = 1, skipHands = null) {
    const s = this.s;
    P.spine[0] += s.spine.x * w; P.spine[1] += s.spineYaw.x * w; P.spine[2] += s.roll.x * w;
    P.headAdd[0] += s.headP.x * w; P.headAdd[1] += s.headY.x * w; P.headAdd[2] += s.headR.x * w;
    P.hips[2] += s.hipsZ.x * w; P.hips[0] += s.hipsX.x * w; P.hips[1] += s.hipsY.x * w;
    P.shL[1] += s.shoulder.x * w; P.shR[1] += s.shoulder.x * w;
    P.squash += s.squash.x * w;
    for (const k of ['hL', 'hR']) {
      const r = P._r[k];
      if (r && !(skipHands && skipHands[k])) { r[0] += s.armX.x * w; r[1] += s.armY.x * w; r[2] += s.armZ.x * w; }
    }
  }
}
