// Animator: drives a Rig from a simulation Fighter.
//
//   state pose (poses.js / attacks.js)   authored target for the current sim state, limb targets in root space
//   hand carry                           guard hands travel with the torso modifiers of the pose
//   inertialization                      state changes never cross-fade: the old motion's offset + velocity decays (inertia.js)
//   layers                               breathing + weight shift, look-at, expression (layers.js)
//   reactor                              hits / blocks kick damped springs that whip the body (react.js)
//   foot stepper                         feet are planted in the world, steps are generated from root motion (stepper.js)
//   limb lag                             hands / feet trail behind pelvis accelerations (layers.js)
//   reach solver                         body lunges / twists just enough to touch the point the sim says is hit (reach.js)
//   finalize + rig.apply                 root -> pelvis space, two-bone IK, face, hands
import { newPose, resetPose, copyPose, canon, finalize, ankleLift, syncPoles } from './pose.js';
import { Inertializer, NCH, flatten, unflatten, channelsOf } from './inertia.js';
import { FootStepper } from './stepper.js';
import { Reactor } from './react.js';
import { LimbLag, breathe, lookAt, expression, fidget } from './layers.js';
import { solveReach } from './reach.js';
import { carryHands } from './carry.js';
import { statePose } from './poses.js';
import { attackPose } from './attacks.js';
import { ST } from '../sim/fighter.js';
import { Rng, clamp, DEG } from '../util.js';

const MIN_ARM = 0.27;
const ROOT0 = { x: 0, y: 0, z: 0, yaw: 0, sc: 1, vx: 0, vz: 0, teleport: false };

// inertia half-lives (frames) by destination state: { torso, arms, legs, face }
const HL = {
  [ST.ATK]: { torso: 2.6, arms: 2.0, legs: 3.0, face: 0 },
  [ST.HIT]: { torso: 2.0, arms: 2.0, legs: 3.2, face: 0 },
  [ST.BLK]: { torso: 2.4, arms: 2.0, legs: 3.0, face: 0 },
  [ST.AIR]: { torso: 3.0, arms: 3.0, legs: 3.5, face: 0 },
  [ST.JUMP]: { torso: 3.0, arms: 3.0, legs: 2.5, face: 0 },
  [ST.DOWN]: { torso: 3.2, arms: 3.2, legs: 3.2, face: 0 },
  [ST.KO]: { torso: 3.5, arms: 3.5, legs: 3.5, face: 0 },
  [ST.GETUP]: { torso: 3.0, arms: 3.0, legs: 3.0, face: 0 },
  [ST.GRAB]: { torso: 2.0, arms: 2.0, legs: 2.0, face: 0 },
  [ST.WALL]: { torso: 2.0, arms: 2.0, legs: 2.0, face: 0 },
  [ST.DASHF]: { torso: 4.0, arms: 4.0, legs: 4.0, face: 0 },
  [ST.SS]: { torso: 3.5, arms: 3.5, legs: 3.5, face: 0 },
  [ST.DASHB]: { torso: 2.5, arms: 3.0, legs: 2.5, face: 0 },
  [ST.IDLE]: { torso: 5.0, arms: 4.0, legs: 5.0, face: 0 },
};
const WINGS = { [ST.IDLE]: 0.25, [ST.ATK]: 0.75, [ST.AIR]: 0.95, [ST.JUMP]: 0.9, [ST.HIT]: 0.7, [ST.BLK]: 0.5, [ST.DASHF]: 0.85, [ST.DASHB]: 0.7, [ST.RUN]: 0.85, [ST.DOWN]: 0.0, [ST.KO]: 0.0, [ST.WIN]: 0.9, [ST.LOSE]: 0.0, [ST.INTRO]: 0.5, [ST.GETUP]: 0.4 };
const HL_DEFAULT = { torso: 4, arms: 3.5, legs: 4, face: 0 };

export class Animator {
  constructor(rig, fighter, ch) {
    this.rig = rig; this.f = fighter; this.ch = ch;
    this.P = newPose(); this.M = newPose();
    this._tmp = [newPose(), newPose(), newPose(), newPose(), newPose(), newPose()];
    this.inert = new Inertializer(); this.flat = new Float64Array(NCH);
    this.stepper = new FootStepper();
    this.react = new Reactor(Math.max(0.6, (fighter.sc || 1) ** 2));
    this.lag = new LimbLag();
    this.look = { ready: false, s: 0, u: 0, f: 0, off: 0 };
    this.fid = { kind: -1, t: 0, len: 40, next: 120 + (fighter.idx || 0) * 70, sg: 1, off: 0 };
    this.prevState = fighter.state;
    let seed = (fighter.idx || 0) * 7919 + 17;
    for (const c of String(ch.id || 'x')) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
    this._rng = new Rng(seed);
    this.breathPh = this._rng.next() * 6; this.swayPh = this._rng.next() * 6; this.breath = 0;
    this.breathAmt = clamp(((ch.idle && ch.idle.bob) ?? 0.012) / 0.012, 0.5, 1.8);
    this.blinkT = 40 + this._rng.next() * 100; this.blinkPhase = -1; this.blinkDouble = false;
    this.expr = { blink: 0, mouth: 0, brow: 0.22, browUp: 0, squint: 0 };
    this.key = ''; this.impSeq = fighter.impactSeq | 0; this.strikeSeq = fighter.strikeSeq | 0;
    this.prevVel = [0, 0, 0]; this.velReady = false;
    this.tremble = 0; this.wingS = 0.25;
    this.cur = this.P;
    this._sh = [0, 0, 0];
    this.handDir = { hL: [-0.3, 0, 0.9], hR: [0.3, 0, 0.9] };
    this.rCache = {};
    for (const k of ['hL', 'hR', 'fL', 'fR']) this.rCache[k] = channelsOf(k, true);
    const A = this;
    this.C = {
      f: fighter, ch, R: ch.rest, T: 0, dtF: 1, alpha: 1, sub: 0, freeze: false, root: ROOT0, speed: 0, teleport: false,
      pin: { hL: false, hR: false }, marked: false, hasWings: !!rig.wingGroups, wings: 0,
      face: { mouth: 0, brow: null, squint: 0, browUp: 0 },
      gait: { mode: 'lock', T: 8, lift: null, settle: 0.2, amt: 0 },
      mark(P) { copyPose(A.M, P); this.marked = true; },
      tmp(i) { return A._tmp[i]; },
    };
  }

  rng() { return this._rng.next(); }

  reset() {
    this.inert.reset(); this.stepper.reset(); this.react.reset(); this.lag.reset();
    this.look.ready = false; this.key = ''; this.velReady = false; this.tremble = 0; this.rig.resetIK();
  }

  poseKey() {
    const f = this.f;
    let k = f.state;
    if (f.move) k += ':' + f.move.id;
    switch (f.state) {
      case ST.HIT: k += ':' + (f.hk && f.hk.kind); break;
      case ST.AIR: k += ':' + (f.air && f.air.kind); break;
      case ST.GETUP: k += ':' + f.getKind; break;
      default:
    }
    return k + (f.stance ? ':' + f.stance : '') + (f.crouch ? 'c' : '') + (f.guard ? 'g' : '');
  }

  // squash & stretch on take-off / landing / ground impacts
  onState(from, to) {
    const f = this.f;
    if (to === ST.JUMP) this.react.kickSquash(0.018);
    else if (to === ST.LAND) this.react.kickSquash(-0.035);
    else if ((to === ST.DOWN || to === ST.KO) && from === ST.AIR) this.react.kickSquash(-0.05);
    else if (to === ST.WALL) this.react.kickSquash(-0.06);
    else if (from === ST.GRAB && to === ST.AIR) this.react.kickSquash(0.02);
    void f;
  }

  // a hit / block landed on this fighter: kick the reaction springs
  onImpact(imp) {
    const f = this.f;
    const fx = f.fx, fz = f.fz, rx = -fz, rz = fx;
    let pf = imp.dx * fx + imp.dz * fz, ps = imp.dx * rx + imp.dz * rz;
    const sdir = imp.side === 'l' ? 1 : imp.side === 'r' ? -1 : 0;
    ps += sdir * 0.65;
    this.react.impact({ kind: imp.kind, lv: imp.lv, dmg: imp.dmg, counter: imp.counter, heavy: imp.heavy, launch: imp.launch }, pf, ps);
  }

  update(alpha, T, dtF, freeze, root = ROOT0) {
    const f = this.f, C = this.C, P = this.P;
    C.T = T; C.dtF = dtF; C.alpha = alpha; C.freeze = freeze; C.root = root; C.teleport = !!root.teleport;
    C.sub = freeze ? 0 : alpha - 1;
    C.speed = Math.hypot(root.vx, root.vz) / (root.sc || 1);
    if (C.teleport) this.reset();

    const imp = f.impact;
    if (imp && imp.seq !== this.impSeq) { this.impSeq = imp.seq; this.onImpact(imp); }
    const stk = f.strike;
    if (stk && stk.seq !== this.strikeSeq) { this.strikeSeq = stk.seq; this.react.recoil(stk.hit, f.move && f.move.dmg >= 15, 1); }

    if (f.state !== this.prevState) { this.onState(this.prevState, f.state); this.prevState = f.state; }

    // ---- 1. authored state pose
    resetPose(P);
    C.pin.hL = C.pin.hR = false; C.marked = false;
    C.face.mouth = 0; C.face.brow = null; C.face.squint = 0; C.face.browUp = 0; C.wings = -1;
    const g = C.gait; g.mode = 'lock'; g.T = 8; g.lift = null; g.settle = 0.2; g.amt = 0;
    if (f.state === ST.ATK && f.move) attackPose(C, P); else { statePose(C, P); syncPoles(P); }
    canon(P);
    if (C.marked) carryHands(this.rig, P, this.M, C.pin);

    // ---- 2. inertialization (state changes)
    const key = this.poseKey();
    const transition = key !== this.key;
    if (transition) { this.key = key; this.inert.setHalflife(HL[f.state] || HL_DEFAULT); }
    flatten(P, this.flat);
    const w = this.inert.w; w.fill(1);
    if (f.state === ST.ATK && f.move && P.reach) {
      // the striking limb must be exactly on its path by the first active frame
      const m = f.move, mf = Math.max(0, f.mf + C.sub);
      const k = clamp(mf / Math.max(2, m.st - 1.5), 0, 1);
      const wt = 1 - k * k * (3 - 2 * k);
      const lk = P.reach.key;
      if (this.rCache[lk]) for (const n of this.rCache[lk]) w[n] = wt;
    }
    unflatten(this.inert.update(this.flat, dtF, transition), P);

    // ---- 3. layers
    const calm = f.state === ST.ATK ? 0.25 : f.state === ST.HIT || f.state === ST.BLK ? 0.3 : f.state === ST.DOWN || f.state === ST.KO ? 1.2 : 1;
    breathe(this, C, P, this.breathAmt * calm);
    lookAt(this, C, P);
    fidget(this, C, P);
    expression(this, C, P);

    // ---- 4. reaction springs
    this.react.step(dtF);
    this.react.apply(P, 1, f.state === ST.ATK && P.reach && this.rCache[P.reach.key] ? { [P.reach.key]: true } : null);

    // wings (Asura): spread with the action, flare on impacts
    if (this.rig.wingGroups) {
      const target = C.wings >= 0 ? C.wings : WINGS[f.state] ?? 0.3;
      this.wingS += (target + Math.min(0.5, this.react.energy * 0.3) - this.wingS) * (1 - Math.exp(-Math.max(dtF, 0) / 7));
      this.rig.setWings(clamp(this.wingS, 0, 1), 0.4 * Math.sin(T * 2.4) * (0.4 + this.wingS));
    }

    // ---- 5. feet
    const sc = root.sc || 1;
    const st = this.stepper.update(P, { x: root.x, z: root.z, yaw: root.yaw, sc, vx: root.vx, vz: root.vz, dtF, mode: g.mode, T: g.T, lift: g.lift ?? undefined, settle: g.settle, teleport: C.teleport });
    P.hips[0] += st.hipsX; P.hips[1] += st.hipsY;
    if (g.amt > 0 && g.mode !== 'free') {
      const R = C.R, sw = (P._r.fL[2] - P._r.fR[2]) - (R.fL[2] - R.fR[2]);
      const a = g.amt;
      P.hipsRot[1] -= clamp(sw, -0.5, 0.5) * 14 * a; P.spine[1] += clamp(sw, -0.5, 0.5) * 9 * a;
      const sc2 = clamp(sw, -0.45, 0.45);
      if (!C.pin.hL) { P._r.hL[2] -= sc2 * 0.26 * a; P._r.hL[1] -= Math.max(0, sc2) * 0.05 * a; }
      if (!C.pin.hR) { P._r.hR[2] += sc2 * 0.26 * a; P._r.hR[1] -= Math.max(0, -sc2) * 0.05 * a; }
    }

    // ---- 6. limb lag
    this.updateLag(C, P, dtF);

    // ---- 7. reach
    if (P.reach && f.state === ST.ATK) {
      const r = P.reach;
      let target = r.target;
      if (r.track) { const t = P._r[r.key]; target = [t[0], t[1] + (r.key[0] === 'f' ? ankleLift((r.key === 'fL' ? P.footL[0] + P.ankle[0] : P.footR[0] + P.ankle[1])) : 0), t[2]]; }
      solveReach(this.rig, P, { key: r.key, target, reach: r.reach, support: r.support });
    }

    // ---- 8. apply
    this.keepHandsOut(P);
    finalize(P);
    this.rig.ikStep = 0.6 * Math.max(dtF, 0.3);
    if (P.reach && P.reach.pole && f.state === ST.ATK) {
      // elbow / knee strikes: bend the joint toward the point that has to hit
      const r = P.reach, out = r.poleKey[0] === 'h' ? P.elbowPoleS : P.kneePoleS;
      this.rig.poleToward(P, r.poleKey, r.pole, out);
      if (r.poleKey[0] === 'h') P.strikeArm = r.poleKey; else P.strikeLeg = r.poleKey;
    }
    this.rig.apply(P);
    this.cur = P;
    this.tremble = freeze && (f.state === ST.HIT || f.state === ST.BLK) && f.stT <= 3 ? 1 : 0;
    return P;
  }

  // a hand folded into its own shoulder (elbow angle beyond ~140 degrees) is anatomically wrong and makes the elbow plane flip:
  // keep hand targets at least MIN_ARM from the shoulder
  keepHandsOut(P) {
    for (const key of ['hL', 'hR']) {
      const t = P._r[key];
      if (!t) continue;
      const S = this._sh;
      this.rig.jointRoot(P, key, S);
      let vx = t[0] - S[0], vy = t[1] - S[1], vz = t[2] - S[2];
      const d = Math.hypot(vx, vy, vz), last = this.handDir[key];
      if (d < MIN_ARM) {
        if (d > 0.02) { vx /= d; vy /= d; vz /= d; } else { vx = last[0]; vy = last[1]; vz = last[2]; }
        t[0] = S[0] + vx * MIN_ARM; t[1] = S[1] + vy * MIN_ARM; t[2] = S[2] + vz * MIN_ARM;
        last[0] = vx; last[1] = vy; last[2] = vz;
      } else { last[0] = vx / d; last[1] = vy / d; last[2] = vz / d; }
    }
  }

  updateLag(C, P, dtF) {
    const f = this.f, root = C.root, sc = root.sc || 1;
    const ca = Math.cos(root.yaw), sa = Math.sin(root.yaw);
    const v = [-(root.vx * ca - root.vz * sa) / sc, (f.vy || 0) / sc, (root.vx * sa + root.vz * ca) / sc];
    if (dtF > 0) {
      const a = [0, 0, 0];
      if (this.velReady) for (let i = 0; i < 3; i++) a[i] = (v[i] - this.prevVel[i]) / Math.max(dtF, 0.25);
      this.prevVel = v; this.velReady = true;
      const air = f.state === ST.AIR || f.state === ST.JUMP || f.state === ST.GRAB;
      this.lag.update(dtF, a, { hL: 8, hR: 8, fL: air ? 7 : 0, fR: air ? 7 : 0 });
    }
    this.lag.apply(P, f.state === ST.ATK ? [] : ['hL', 'hR', 'fL', 'fR']);
  }
}
