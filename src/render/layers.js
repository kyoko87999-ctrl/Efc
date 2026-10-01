// Procedural animation layers that sit on top of the state poses: breathing, weight shift, head look-at,
// facial expression and limb inertia ("lag").  All of them are additive and cheap.
import { ST } from '../sim/fighter.js';
import { clamp, DEG } from '../util.js';

const TAU = Math.PI * 2;

// ------------------------------------------------------------------ breathing + weight shift
export function breathe(an, C, P, amount = 1) {
  const f = C.f;
  const hp = clamp(f.hp / f.maxHp, 0, 1);
  const rate = 1 + (1 - hp) * 0.9 + (f.rage ? 0.35 : 0) + Math.min(0.8, an.react.energy * 0.3);
  an.breathPh += C.dtF * rate * TAU / 200;
  an.swayPh += C.dtF * TAU / 330;
  const b = Math.sin(an.breathPh), sw = Math.sin(an.swayPh);
  an.breath = b * amount;
  P.chest[0] -= 1.1 * b * amount;
  P.spine[0] += 0.5 * b * amount;
  P.headAdd[0] -= 0.9 * b * amount;
  P.shL[1] += 0.009 * b * amount; P.shR[1] += 0.009 * b * amount;
  P.hips[1] += 0.0025 * b * amount;
  // slow weight shift between the feet
  P.hips[0] += 0.009 * sw * amount;
  P.hipsRot[2] += 0.9 * sw * amount;
  P.spine[2] -= 0.8 * sw * amount;
  P.headAdd[2] += 0.6 * sw * amount;
}

// ------------------------------------------------------------------ look-at
const LOOK_W = {
  [ST.IDLE]: 1, [ST.BLK]: 1, [ST.ATK]: 1, [ST.DASHF]: 1, [ST.DASHB]: 1, [ST.RUN]: 1, [ST.SS]: 1, [ST.CD]: 1, [ST.LAND]: 1, [ST.JUMP]: 1, [ST.INTRO]: 1,
  [ST.WIN]: 0.55, [ST.LOSE]: 0.15, [ST.HIT]: 0.3, [ST.GRAB]: 0.1, [ST.AIR]: 0.2, [ST.WALL]: 0, [ST.DOWN]: 0.1, [ST.KO]: 0, [ST.GETUP]: 0.4,
};

export function lookAt(an, C, P) {
  const f = C.f, opp = f.opp, r = C.root;
  if (!opp) { P.lookT = null; P.lookW = 0; return; }
  const sc = r.sc || 1, ca = Math.cos(r.yaw), sa = Math.sin(r.yaw);
  const oy = opp.state === ST.DOWN || opp.state === ST.KO ? 0.3 : 1.55 * opp.sc;
  const dx = opp.x - r.x, dz = opp.z - r.z;
  const t = [-(dx * ca - dz * sa) / sc, (opp.y + oy - r.y) / sc, (dx * sa + dz * ca) / sc];      // pose space [side, up, fwd]
  const L = an.look;
  if (!L.ready || C.teleport) { L.s = t[0]; L.u = t[1]; L.f = t[2]; L.ready = true; }
  else { const k = 1 - Math.exp(-Math.max(C.dtF, 0) / 3.5); L.s += (t[0] - L.s) * k; L.u += (t[1] - L.u) * k; L.f += (t[2] - L.f) * k; }
  P.lookT = [L.s + (L.off || 0), L.u + (L.off ? 0.1 : 0), L.f];
  let w = LOOK_W[f.state] ?? 1;
  if (f.state === ST.ATK && f.move && f.move.an && f.move.an.wake) w = 0.3;
  P.lookW = w;
}

// ------------------------------------------------------------------ expression
export function expression(an, C, P) {
  const f = C.f, st = f.state;
  // blinking (not while squinting / knocked out)
  an.blinkT -= C.dtF;
  if (an.blinkT <= 0 && an.blinkPhase < 0) { an.blinkPhase = 0; an.blinkT = 70 + an.rng() * 160; if (an.rng() < 0.18) an.blinkDouble = true; }
  let blink = 0;
  if (an.blinkPhase >= 0) {
    an.blinkPhase += C.dtF;
    const u = an.blinkPhase / 7;
    blink = u < 0.4 ? u / 0.4 : Math.max(0, 1 - (u - 0.4) / 0.6);
    if (an.blinkPhase > 7) { an.blinkPhase = -1; if (an.blinkDouble) { an.blinkDouble = false; an.blinkT = 3; } }
  }
  let mouth = 0, brow = 0.22, browUp = 0, squint = 0;
  const hpLow = f.hp < f.maxHp * 0.3;
  if (hpLow) mouth = 0.1 + 0.08 * Math.max(0, an.breath);
  if (f.rage) { brow = 0.9; mouth = Math.max(mouth, 0.15); }
  switch (st) {
    case ST.ATK: {
      const m = f.move;
      if (m && !m.noHit) {
        const near = f.mf >= m.st - 4 && f.mf <= m.st + m.ac + 3;
        if (near && (m.dmg >= 9 || m.limb[0] === 'f')) mouth = Math.max(mouth, clamp(m.dmg / 16, 0.45, 1));
        brow = Math.max(brow, 0.55);
        squint = near ? 0.25 : 0;
      }
      break;
    }
    case ST.HIT: {
      const k = clamp(1 - f.stT / 18, 0, 1);
      mouth = Math.max(mouth, 0.85 * k + 0.25); squint = 0.75 * k; brow = -0.5; browUp = f.hk && f.hk.counter ? 0.7 : 0;
      if (f.stT < 4) blink = Math.max(blink, 1);
      break;
    }
    case ST.BLK: mouth = 0.12; brow = 0.55; squint = 0.35; break;
    case ST.AIR: mouth = 0.7; squint = 0.4; brow = -0.4; break;
    case ST.WALL: mouth = 0.6; squint = 0.6; brow = -0.6; break;
    case ST.GRAB: mouth = 0.55; squint = 0.5; brow = -0.5; break;
    case ST.DOWN: case ST.KO: blink = 0.75 + 0.25 * (st === ST.KO ? 1 : 0); mouth = 0.35; brow = -0.3; break;
    case ST.GETUP: squint = 0.3; mouth = 0.2; brow = 0.1; break;
    case ST.WIN: brow = -0.1; browUp = 0.4; mouth = 0.3 + 0.2 * Math.sin(f.stT * 0.12); break;
    case ST.LOSE: brow = -0.9; mouth = 0.1; squint = 0.3; break;
    case ST.INTRO: brow = 0.7; break;
    default: break;
  }
  // hints from the pose (shouts, taunts ...)
  const fh = C.face;
  if (fh) { mouth = Math.max(mouth, fh.mouth); if (fh.brow !== null) brow = fh.brow; squint = Math.max(squint, fh.squint); browUp = Math.max(browUp, fh.browUp); }
  an.expr.blink += (blink - an.expr.blink) * Math.min(1, C.dtF * 0.9 + 0.05);
  an.expr.mouth += (mouth - an.expr.mouth) * Math.min(1, C.dtF * 0.5 + 0.02);
  an.expr.brow += (brow - an.expr.brow) * Math.min(1, C.dtF * 0.4 + 0.02);
  an.expr.browUp += (browUp - an.expr.browUp) * Math.min(1, C.dtF * 0.4 + 0.02);
  an.expr.squint += (squint - an.expr.squint) * Math.min(1, C.dtF * 0.5 + 0.02);
  P.blink = an.expr.blink; P.mouth = an.expr.mouth; P.brow = an.expr.brow; P.browUp = an.expr.browUp; P.squint = an.expr.squint;
}

// ------------------------------------------------------------------ limb inertia
// Hands (and airborne feet) lag behind the body: offsets are driven by the pelvis acceleration in the character's frame.
export class LimbLag {
  constructor() { this.o = { hL: [0, 0, 0], hR: [0, 0, 0], fL: [0, 0, 0], fR: [0, 0, 0] }; this.v = { hL: [0, 0, 0], hR: [0, 0, 0], fL: [0, 0, 0], fR: [0, 0, 0] }; }
  reset() { for (const k in this.o) { this.o[k].fill(0); this.v[k].fill(0); } }
  // a: pelvis acceleration in pose space [side, up, fwd] (units / frame^2); gain per limb group
  update(dtF, a, gains) {
    if (dtF <= 0) return;
    const n = Math.max(1, Math.ceil(dtF / 0.5)), h = dtF / n, w = 0.34, z = 0.38;
    for (const k in this.o) {
      const g = gains[k] || 0, o = this.o[k], v = this.v[k];
      for (let s = 0; s < n; s++) for (let i = 0; i < 3; i++) {
        const tgt = clamp(-a[i] * g, -0.16, 0.16);
        v[i] += (w * w * (tgt - o[i]) - 2 * z * w * v[i]) * h;
        o[i] += v[i] * h;
      }
    }
  }
  apply(P, keys) { for (const k of keys) { const r = P._r[k]; if (r) { r[0] += this.o[k][0]; r[1] += this.o[k][1]; r[2] += this.o[k][2]; } } }
}

// ------------------------------------------------------------------ idle fidgets
// every few seconds a standing fighter does something small (roll a shoulder, stretch the neck, flex a hand, shift weight, glance away)
export function fidget(an, C, P) {
  const f = C.f, F = an.fid;
  const calm = f.state === ST.IDLE && !f.walkDir && !f.sideWalk && !f.crouch && !f.guard && !f.stance;
  if (!calm) { F.kind = -1; F.next = Math.max(F.next, 150); F.off = 0; an.look.off = 0; return; }
  if (F.kind < 0) {
    F.next -= C.dtF;
    if (F.next > 0) return;
    F.kind = Math.floor(an.rng() * 6); F.t = 0; F.len = 34 + an.rng() * 26; F.sg = an.rng() < 0.5 ? -1 : 1;
  }
  F.t += C.dtF;
  const u = F.t / F.len;
  if (u >= 1) { F.kind = -1; F.next = 240 + an.rng() * 380; an.look.off = 0; return; }
  const b = Math.pow(Math.sin(Math.PI * u), 1.4), s = F.sg;
  switch (F.kind) {
    case 0: { const w = Math.sin(TAU * u); P.shL[1] += 0.05 * b; P.shR[1] += 0.05 * b; P.shL[0] += 0.03 * w * b; P.shR[0] -= 0.03 * w * b; P.spine[1] += 3 * w * b; break; }
    case 1: P.headAdd[2] += 11 * s * b; P.headAdd[1] += 6 * s * b; P.neck[2] += 3 * s * b; break;
    case 2: { const k = 0.3 + 0.7 * Math.abs(Math.sin(TAU * u * 1.5)); P.fist[0] = 0.62 - 0.55 * b * k; P.fist[1] = 0.62 - 0.4 * b * (1 - k); P.wristL[2] += 12 * b; break; }
    case 3: P.hips[0] += 0.03 * s * b; P.hipsRot[2] += 3 * s * b; P.spine[2] -= 2 * s * b; break;
    case 4: an.look.off = 1.1 * s * b; break;
    default: P.headAdd[0] += -7 * b; P.chest[0] -= 2 * b; break;
  }
}
