// A single fighter: input parsing, locomotion, move execution and state machine.
// Pure logic (no rendering) so it can run headless for tests / AI / replays.
import {
  BODY_R, BASE_H, G, HIST_LEN, CHORD_WINDOW, CMD_BUFFER, DASH_WINDOW, HEAT_FRAMES, HP_MAX, RAGE_FRAC,
} from './const.js';
import { limbAt } from './move.js';
import { clamp, easeOut, easeInOut, DEG } from '../util.js';

export const ST = {
  IDLE: 'idle', DASHF: 'dashF', DASHB: 'dashB', RUN: 'run', SS: 'ss', JUMP: 'jump', LAND: 'land', CD: 'cd',
  ATK: 'atk', HIT: 'hit', BLK: 'blk', AIR: 'air', DOWN: 'down', GETUP: 'getup', WALL: 'wall',
  GRAB: 'grab', KO: 'ko', INTRO: 'intro', WIN: 'win', LOSE: 'lose',
};

const WALK_F = 0.034, WALK_B = 0.026, SIDE_W = 0.03, RUN_V = 0.072;
const DASH_F_N = 24, DASH_F_D = 2.3, DASH_B_N = 24, DASH_B_D = 1.7, SS_N = 22, SS_D = 1.15, CD_N = 26, CD_D = 1.5;

const DIRS_STRICT = { 1: true, 2: true, 3: true };
const FALLBACK_DIRS = { 1: [2, 4], 3: [2, 6], 7: [4], 9: [6] };

export class Fighter {
  constructor(match, idx, ch) {
    this.match = match;
    this.idx = idx;
    this.ch = ch;
    this.sc = ch.body?.scale ?? 1;
    this.maxHp = Math.round(HP_MAX * (ch.hpMul ?? 1));
    this.hist = new Int32Array(HIST_LEN);
    this.fr = 0;
    this.reset(0, 0);
  }

  reset(x, z, fx = 1, fz = 0) {
    this.x = x; this.y = 0; this.z = z;
    this.px = x; this.py = 0; this.pz = z;
    this.vx = 0; this.vz = 0; this.vy = 0;
    this.fx = fx; this.fz = fz;
    this.pfx = fx; this.pfz = fz;
    this.hp = this.maxHp;
    this.rec = 0;
    this.heat = { avail: !!this.match.rules.heat, on: false, t: 0 };
    this.rage = false;
    this.rageUsed = false;
    this.state = ST.IDLE;
    this.stT = 0;
    this.lock = 0;
    this.move = null;
    this.mf = 0;
    this.moveStart = 0;
    this.stun = 0;
    this.stunTotal = 0;
    this.hk = null;          // hit kind info for animation
    this.contact = null;     // 'hit' | 'block' | null for current move
    this.hitDone = false;
    this.chainQ = null;
    this.cmdBuf = null;
    this.chord = null;
    this.prevBtn = 0; this.holdPressed = 0;
    this.dir = 5; this.pdir = 5; this.btn = 0; this.pressed = 0;
    this.lockSSFr = -99;
    this.crouch = false;
    this.guard = null;
    this.dHold = 0; this.dPure = true; this.crouchLen = 0; this.lastCrouch = -99;
    this.ssPend = 0; this.cdPend = 0; this.swDir = 0; this.walkDir = 0; this.sideWalk = 0;
    this.stance = null; this.stanceT = 0;
    this.hitstop = 0;
    this.gm = 1;               // gravity modifier while juggled
    this.air = null;
    this.comboHits = 0; this.comboDmg = 0; this.airHits = 0; this.usedBound = false; this.usedWall = false; this.usedScrew = false;
    this.comboOut = { hits: 0, dmg: 0, t: 0 };
    this.lockF = { x: fx, z: fz };
    this.aerial = false;
    this.faceUp = true;
    this.grabBy = null; this.capT = 0; this.grabbing = null;
    this.walkPhase = 0;
    this.lastMoveId = '';
    this.runT = 0;
    this.airUsed = false;
    this.koFly = false;
    this.techWin = 0;
    this.airT = 0;
    this.parryT = 0;
    this.heatDashed = false;
    this.flash = 0;
    this.stats = this.stats || { dmg: 0, maxCombo: 0, throws: 0, counters: 0, punishes: 0, heats: 0, rages: 0, walls: 0, hits: 0, whiffs: 0 };
    this.startupSeen = 0;
    this.vis = { pushT: 0, dir: 0 };
  }

  // ------------------------------------------------------------------ input
  feed(raw, hold = false) {
    if (!hold) this.fr++;
    const mir = this.idx === 1;
    const fwd = mir ? raw.l : raw.r, back = mir ? raw.r : raw.l;
    const dx = (fwd ? 1 : 0) - (back ? 1 : 0);
    const dy = (raw.u ? 1 : 0) - (raw.d ? 1 : 0);
    const dir = dy === 0 ? (dx === 0 ? 5 : dx > 0 ? 6 : 4) : dy > 0 ? (dx === 0 ? 8 : dx > 0 ? 9 : 7) : (dx === 0 ? 2 : dx > 0 ? 3 : 1);
    const btn = (raw.b1 ? 1 : 0) | (raw.b2 ? 2 : 0) | (raw.b3 ? 4 : 0) | (raw.b4 ? 8 : 0);
    const newly = btn & ~this.prevBtn;
    this.prevBtn = btn;
    const slot = this.fr % HIST_LEN;
    if (hold) {
      // hit-stop frame: keep the same history slot, remember presses so nothing is lost
      this.holdPressed |= newly;
      this.hist[slot] = dir | (btn << 4) | (((this.hist[slot] >> 8) | newly) << 8);
      this.dir = dir; this.btn = btn;
    } else {
      const pressed = newly | this.holdPressed;
      this.holdPressed = 0;
      this.pdir = this.dir;
      this.dir = dir; this.btn = btn; this.pressed = pressed;
      this.hist[slot] = dir | (btn << 4) | (pressed << 8);
    }
    if (newly) {
      if (!this.chord) this.chord = { mask: 0, t0: this.fr };
      this.chord.mask |= newly;
    }
    if (this.chord && (hold || this.fr - this.chord.t0 >= CHORD_WINDOW - 1)) {
      this.cmdBuf = { mask: this.chord.mask, pf: this.fr, exp: this.fr + CMD_BUFFER };
      this.chord = null;
    }
  }

  dirAt(off) { return this.hist[(((this.fr - off) % HIST_LEN) + HIST_LEN) % HIST_LEN] & 15; }
  histAt(off) { return this.hist[(((this.fr - off) % HIST_LEN) + HIST_LEN) % HIST_LEN]; }

  // double-tap detection on direction `d` (6 = dash forward, 4 = back dash)
  doubleTap(d) {
    if (this.dir !== d || this.pdir === d) return false;
    let gap = 0, o = 1;
    while (o < DASH_WINDOW && this.dirAt(o) !== d) { gap++; o++; }
    return gap > 0 && o < DASH_WINDOW;
  }

  // sequence match, ending at (now - endOff)
  matchMotion(seq, endOff, span = 22) {
    let idx = seq.length - 1;
    let last = -1;
    for (let o = endOff; o < endOff + span && idx >= 0; o++) {
      const d = this.dirAt(o);
      if (d === seq[idx]) {
        if (last !== d || o - 0 >= 0) { /* advance once per contiguous run */ }
        idx--;
        // skip the rest of this contiguous run
        while (o + 1 < endOff + span && this.dirAt(o + 1) === d) o++;
        last = d;
      }
    }
    return idx < 0;
  }

  // ------------------------------------------------------------------ helpers
  get opp() { return this.match.fighters[1 - this.idx]; }
  get canAct() { return this.state === ST.IDLE && this.lock <= 0; }
  get airborne() { return this.y > 0.02 || this.state === ST.AIR || this.state === ST.JUMP; }
  get inHitstun() { return this.state === ST.HIT || this.state === ST.AIR || this.state === ST.WALL || this.state === ST.BLK; }
  get scale() { return this.sc; }

  enter(s) { this.state = s; this.stT = 0; }

  faceOpp() {
    const o = this.opp;
    let dx = o.x - this.x, dz = o.z - this.z;
    const l = Math.hypot(dx, dz);
    if (l < 1e-4) return;
    this.fx = dx / l; this.fz = dz / l;
  }

  turnToward(rate) {
    const o = this.opp;
    let dx = o.x - this.x, dz = o.z - this.z;
    const l = Math.hypot(dx, dz);
    if (l < 1e-4) return;
    dx /= l; dz /= l;
    const a0 = Math.atan2(this.lockF.x, this.lockF.z);
    const a1 = Math.atan2(dx, dz);
    let d = a1 - a0;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    d = clamp(d, -rate, rate);
    const a = a0 + d;
    this.lockF.x = Math.sin(a); this.lockF.z = Math.cos(a);
  }

  get rightX() { return -this.fz; }
  get rightZ() { return this.fx; }

  push(dx, dz) { this.x += dx; this.z += dz; }

  addRec(v) { this.rec = clamp(this.rec + v, 0, this.maxHp - this.hp); }

  // ------------------------------------------------------------------ commands
  ctxList() {
    const c = [];
    switch (this.state) {
      case ST.IDLE:
        if (this.stance) { c.push('st:' + this.stance); const sd = this.ch.stances?.[this.stance]; if (sd?.fallback) c.push('stand'); }
        else {
          if (!this.crouch && this.fr - this.lastCrouch <= 9 && this.crouchLen >= 7) c.push('ws');
          c.push('stand');
        }
        break;
      case ST.DASHF: if (this.stT >= 8) c.push('wr'); break;
      case ST.RUN: c.push('wr'); break;
      case ST.SS: if (this.stT >= 8) c.push('ss', 'stand'); break;
      case ST.CD: if (this.stT >= 6) c.push('cd'); break;
      case ST.JUMP: if (!this.airUsed) c.push('air'); break;
      case ST.DOWN: c.push('dn'); break;
      case ST.DASHB: if (this.stT >= 16) c.push('stand'); break;
      case ST.LAND: break;
      default: break;
    }
    return c;
  }

  reqOk(m) {
    switch (m.req) {
      case 'rage': return this.rage && !this.rageUsed;
      case 'heat': return this.heat.on;
      case 'noheat': return this.heat.avail && !this.heat.on;
      case 'heatany': return this.heat.avail || this.heat.on;
      case 'crouch': return this.crouch;
      default: return true;
    }
  }

  findMove(cmd) {
    const ctxs = this.ctxList();
    if (!ctxs.length) return null;
    const mask = cmd.mask;
    const back = this.fr - cmd.pf;
    const dNow = this.dirAt(back);
    const recent = [this.dirAt(back), this.dirAt(back + 1), this.dirAt(back + 2)];
    for (const cx of ctxs) {
      const list = this.ch.byCtx[cx];
      if (!list) continue;
      let cands = list.filter((m) => m.btn === mask && this.reqOk(m));
      if (!cands.length) {
        // subset fallback: pressed a chord that has no move, use the biggest matching subset
        cands = list.filter((m) => m.btn && (m.btn & mask) === m.btn && this.reqOk(m)).sort((a, b) => popc(b.btn) - popc(a.btn));
        if (cands.length) { const top = popc(cands[0].btn); cands = cands.filter((m) => popc(m.btn) === top); }
      }
      if (!cands.length) continue;
      for (const m of cands) if (m.motion && this.matchMotion(m.motion, back)) return m;
      for (const m of cands) if (!m.motion && m.dir && m.dir === dNow) return m;
      for (const m of cands) if (!m.motion && m.dir && recent.includes(m.dir) && !DIRS_STRICT[dNow] === !DIRS_STRICT[m.dir]) return m;
      for (const m of cands) if (!m.motion && m.dir && recent.includes(m.dir)) return m;
      for (const fd of FALLBACK_DIRS[dNow] || []) for (const m of cands) if (!m.motion && m.dir === fd) return m;
      for (const m of cands) if (!m.motion && !m.dir) return m;
    }
    return null;
  }

  startMove(m) {
    const wasAir = this.state === ST.JUMP;
    if (wasAir) this.airUsed = true;
    if (m.req === 'rage') { this.rageUsed = true; this.rage = false; this.stats.rages++; this.match.emit({ t: 'rageart', who: this.idx }); }
    if (m.req === 'heat' && m.hs) { this.heat.on = false; this.heat.t = 0; this.heat.avail = false; this.match.emit({ t: 'heatsmash', who: this.idx }); }
    if (m.hbst) { this.heat.avail = false; this.match.emit({ t: 'heatburst', who: this.idx }); }
    this.move = m;
    this.mf = 0;
    this.moveStart = this.fr;
    this.state = ST.ATK;
    this.stT = 0;
    this.contact = null;
    this.hitDone = false;
    this.recEnd = null;
    this.chainQ = null;
    this.cmdBuf = null;
    this.aerial = wasAir || (this.y > 0.05 && !m.yc);
    this.lockF.x = this.fx; this.lockF.z = this.fz;
    this.stance = null;
    this.lastMoveId = m.id;
    this.crouch = m.ctx === 'cd' || (m.dir && (m.dir === 1 || m.dir === 2 || m.dir === 3) && m.btn && !m.motion) ? this.crouch : false;
    this.heDone = false;
    this.match.emit({ t: 'move', who: this.idx, id: m.id });
  }

  endMove() {
    const m = this.move;
    this.move = null;
    this.mf = 0;
    this.chainQ = null;
    this.stT = 0;
    if (this.aerial && this.y > 0.05) { this.aerial = false; this.state = ST.JUMP; return; }
    this.aerial = false;
    if (this.y > 0.02) { this.y = 0; }
    this.state = ST.IDLE;
    this.lock = 0;
    this.stance = m && m.toStance ? m.toStance : null;
    this.stanceT = 0;
    if (m && m.lockEnd) this.lock = m.lockEnd;
    this.contact = null;
  }

  enterIdleClean() {
    this.state = ST.IDLE; this.stT = 0; this.move = null; this.mf = 0; this.stun = 0; this.hk = null;
    this.y = 0; this.vx = 0; this.vz = 0; this.vy = 0; this.lock = 0; this.chainQ = null; this.cmdBuf = null; this.chord = null;
    this.grabBy = null; this.grabbing = null; this.stance = null; this.crouch = false; this.aerial = false; this.air = null;
    this.contact = null; this.capRot = null; this.gm = 1; this.endCombo();
  }

  // ------------------------------------------------------------------ update
  update() {
    this.pfx = this.fx; this.pfz = this.fz;
    this.px = this.x; this.py = this.y; this.pz = this.z;
    this.stT++;
    if (this.flash > 0) this.flash--;
    if (this.heat.on) {
      this.heat.t--;
      if (this.heat.t <= 0) { this.heat.on = false; this.match.emit({ t: 'heatend', who: this.idx }); }
      else if (this.rec > 0) { const r = Math.min(this.rec, 0.06); this.rec -= r; this.hp += r; }
    }
    if (this.comboOut.t > 0) this.comboOut.t--;
    if (this.rec > 0 && this.state !== ST.ATK && this.state !== ST.HIT && this.state !== ST.AIR) this.rec = Math.max(0, this.rec - 0.02);
    switch (this.state) {
      case ST.IDLE: this.tickIdle(); break;
      case ST.DASHF: this.tickDashF(); break;
      case ST.DASHB: this.tickDashB(); break;
      case ST.RUN: this.tickRun(); break;
      case ST.SS: this.tickSS(); break;
      case ST.CD: this.tickCD(); break;
      case ST.JUMP: this.tickJump(); break;
      case ST.LAND: this.tickLand(); break;
      case ST.ATK: this.tickAtk(); break;
      case ST.HIT: this.tickHit(); break;
      case ST.BLK: this.tickBlk(); break;
      case ST.AIR: this.tickAir(); break;
      case ST.DOWN: this.tickDown(); break;
      case ST.GETUP: this.tickGetup(); break;
      case ST.WALL: this.tickWall(); break;
      case ST.GRAB: this.tickGrab(); break;
      case ST.KO: this.tickKO(); break;
      default: this.faceOpp(); break;
    }
    // slide (pushback) integration
    if (this.state !== ST.AIR && this.state !== ST.GRAB) {
      this.x += this.vx; this.z += this.vz;
      this.vx *= 0.82; this.vz *= 0.82;
      if (Math.abs(this.vx) < 1e-4) this.vx = 0;
      if (Math.abs(this.vz) < 1e-4) this.vz = 0;
    }
  }

  updateGuard() {
    let g = null;
    if (this.canGuard()) {
      if (this.dir === 4) g = 'stand';
      else if (this.dir === 1) g = 'crouch';
      else if (this.stance && this.ch.stances?.[this.stance]?.autoGuard) g = this.crouch ? 'crouch' : 'stand';
    }
    this.guard = g;
  }

  canGuard() {
    switch (this.state) {
      case ST.IDLE: case ST.LAND: return this.lock < 8 || this.state === ST.IDLE;
      case ST.BLK: return true;
      case ST.DASHB: return this.stT >= 14;
      case ST.SS: return this.stT >= 10;
      case ST.CD: return this.stT >= 12;
      default: return false;
    }
  }

  // ---- idle / neutral
  tickIdle() {
    this.faceOpp();
    if (this.lock > 0) { this.lock--; this.updateGuard(); return; }
    const d = this.dir;
    const sd = this.stance ? this.ch.stances?.[this.stance] : null;

    // crouch tracking
    const dn = d === 1 || d === 2 || d === 3;
    const wasHeld = this.dHold;
    if (dn) { this.dHold++; if (d !== 2) this.dPure = false; }
    else {
      if (wasHeld > 0 && wasHeld <= 6 && this.dPure && d === 5 && !this.stance && this.fr - this.lockSSFr > 3) {
        this.dHold = 0; this.dPure = true;
        this.startSS(-1); return;
      }
      this.dHold = 0; this.dPure = true;
    }
    if (dn && this.dHold >= 3) { this.crouch = true; this.crouchLen++; this.lastCrouch = this.fr; }
    else if (!dn) { this.crouch = false; }
    if (!dn) this.crouchLenPrev = this.crouchLen;
    if (!dn && this.fr - this.lastCrouch > 12) this.crouchLen = 0;

    this.updateGuard();

    // buffered attack commands
    if (this.cmdBuf) {
      if (this.fr > this.cmdBuf.exp) this.cmdBuf = null;
      else {
        const m = this.findMove(this.cmdBuf);
        if (m) { this.beginMove(m); return; }
        if (this.cmdBuf.mask && this.fr - this.cmdBuf.pf >= 1) this.cmdBuf = null;
      }
    }

    if (sd) {
      // in a stance: limited movement / exit rules
      this.stanceT++;
      if (d === 4 && sd.exitBack !== false && this.stanceT > 8) { this.stance = null; return; }
      if (sd.timeout && this.stanceT > sd.timeout) { this.stance = null; return; }
      if (sd.walk) {
        if (d === 6) { this.moveFwd(WALK_F * sd.walk); this.walkDir = 1; }
        else if (d === 4) { this.moveFwd(-WALK_B * sd.walk); this.walkDir = -1; }
        else this.walkDir = 0;
      } else this.walkDir = 0;
      if (this.doubleTap(6)) { this.stance = null; this.startDashF(); return; }
      if (this.doubleTap(4)) { this.stance = null; this.startDashB(); return; }
      return;
    }

    // dashes
    if (this.doubleTap(6) && !dn) { this.startDashF(); return; }
    if (this.doubleTap(4) && !dn) { this.startDashB(); return; }
    // crouch dash  f,n,d,d/f
    if (d === 3 && this.pdir !== 3 && this.matchMotion([6, 5, 2, 3], 0, 16) && this.ch.cdAllowed !== false) this.cdPend = 3;
    if (this.cdPend > 0) {
      if (this.cmdBuf) this.cdPend = 0;
      else if (--this.cdPend === 0) { this.startCD(); return; }
    }

    // jump
    if ((d === 9 || d === 7) && this.pdir !== 9 && this.pdir !== 7 && !this.crouch) { this.startJump(d === 9 ? 1 : -1); return; }
    // sidestep (pure up), delayed two frames so u/f isn't mistaken for a sidestep
    if (d === 8 && this.pdir !== 8 && this.pdir !== 7 && this.pdir !== 9) this.ssPend = 3;
    if (this.ssPend > 0) {
      this.ssPend--;
      if (d === 9 || d === 7) { this.ssPend = 0; this.startJump(d === 9 ? 1 : -1); return; }
      if (this.ssPend === 0) { this.startSS(1); return; }
    }
    // walking
    this.walkDir = 0; this.sideWalk = 0;
    if (!this.crouch) {
      if (d === 6) { this.moveFwd(WALK_F * this.ch.walkF); this.walkDir = 1; }
      else if (d === 4 || d === 7) { this.moveFwd(-WALK_B * this.ch.walkB); this.walkDir = -1; }
      else if (d === 8 && this.fr - this.lockSSFr > 8) { this.sideMove(1, SIDE_W); this.sideWalk = 1; }
    }
    if (this.swDir && (d === 2 || d === 8)) {
      this.sideMove(this.swDir, SIDE_W); this.sideWalk = this.swDir; this.crouch = false;
    } else if (this.swDir && d !== 2 && d !== 8) this.swDir = 0;
    if (this.walkDir || this.sideWalk) this.walkPhase += 0.24; else this.walkPhase *= 0.9;
  }

  moveFwd(v) {
    this.x += this.fx * v * this.sc; this.z += this.fz * v * this.sc;
  }
  sideMove(sgn, v) {
    // sgn = +1 -> toward background
    const b = this.match.bg;
    this.x += b.x * sgn * v; this.z += b.z * sgn * v;
  }

  // ---- dashes / run
  startDashF() { this.enter(ST.DASHF); this.dashPrev = 0; this.runT = 0; if (this.cmdBuf) this.cmdBuf.exp = this.fr + 11; this.match.emit({ t: 'dash', who: this.idx, back: false }); }
  startDashB() { this.enter(ST.DASHB); this.dashPrev = 0; this.match.emit({ t: 'dash', who: this.idx, back: true }); }
  tickDashF() {
    this.faceOpp();
    const t = Math.min(1, this.stT / DASH_F_N);
    const e = easeOut(t);
    const step = (e - this.dashPrev) * DASH_F_D * this.ch.dashF; this.dashPrev = e;
    this.moveFwd(step);
    this.updateGuard();
    if (this.stT >= 8) { if (this.tryCmd()) return; }
    if (this.stT >= 14 && (this.dir === 6 || this.dir === 9 || this.dir === 3) && !this.heatDashFlag) { this.enter(ST.RUN); return; }
    if (this.stT >= DASH_F_N) { this.enter(ST.IDLE); this.lock = 0; }
  }
  tickDashB() {
    this.faceOpp();
    const t = Math.min(1, this.stT / DASH_B_N);
    const e = easeInOut(t * 0.9 + 0.1 * t);
    const step = (e - this.dashPrev) * DASH_B_D * this.ch.dashB; this.dashPrev = e;
    this.moveFwd(-step);
    this.updateGuard();
    if (this.stT >= 16) { if (this.tryCmd()) return; }
    if (this.stT >= DASH_B_N) { this.enter(ST.IDLE); }
  }
  tickRun() {
    this.faceOpp();
    this.runT++;
    this.moveFwd(RUN_V * this.ch.run);
    this.walkPhase += 0.36;
    if (this.tryCmd()) return;
    if (!(this.dir === 6 || this.dir === 9 || this.dir === 3)) { this.enter(ST.IDLE); this.lock = 6; }
  }

  tryCmd() {
    if (!this.cmdBuf) return false;
    if (this.fr > this.cmdBuf.exp) { this.cmdBuf = null; return false; }
    const m = this.findMove(this.cmdBuf);
    if (m) { this.beginMove(m); return true; }
    return false;
  }

  beginMove(m) { this.startMove(m); this.tickAtk(); }

  // ---- sidestep
  startSS(sgn) {
    this.enter(ST.SS); this.ssSgn = sgn; this.dashPrev = 0; this.lockSSFr = this.fr;
    this.match.emit({ t: 'ss', who: this.idx });
  }
  tickSS() {
    this.faceOpp();
    const t = Math.min(1, this.stT / SS_N);
    const e = easeOut(t);
    const step = (e - this.dashPrev) * SS_D * this.ch.ss; this.dashPrev = e;
    this.sideMove(this.ssSgn, step);
    this.updateGuard();
    if (this.stT >= 8 && this.tryCmd()) return;
    if (this.stT >= 12 && this.dir === 6 && this.stT >= 16 && false) return;
    if (this.stT >= SS_N) {
      this.enter(ST.IDLE); this.lockSSFr = this.fr;
      if (this.dir === 8 && this.ssSgn > 0) { /* sidewalk handled by idle */ }
      if (this.dir === 2 && this.ssSgn < 0) this.swDir = -1;
      if (this.dir === 8 && this.ssSgn > 0) this.swDir = 1;
    }
  }

  startCD() { this.enter(ST.CD); this.dashPrev = 0; this.crouch = true; this.match.emit({ t: 'dash', who: this.idx, back: false, crouch: true }); }
  tickCD() {
    this.faceOpp();
    const t = Math.min(1, this.stT / CD_N);
    const e = easeOut(t);
    const step = (e - this.dashPrev) * CD_D * this.ch.cd; this.dashPrev = e;
    this.moveFwd(step);
    this.updateGuard();
    if (this.stT >= 6 && this.tryCmd()) return;
    if (this.stT >= CD_N) { this.enter(ST.IDLE); this.crouch = this.dir === 1 || this.dir === 2 || this.dir === 3; this.dHold = 6; }
  }

  // ---- jump
  startJump(dir) {
    this.enter(ST.JUMP);
    this.vy = 0.104 * this.ch.jump; this.jumpDir = dir;
    this.jvx = dir * (dir > 0 ? 0.05 : 0.04);
    this.match.emit({ t: 'jump', who: this.idx });
  }
  tickJump() {
    this.faceOpp();
    this.vy -= G;
    this.y += this.vy;
    this.moveFwd(this.jvx);
    if (this.tryCmd()) return;
    if (this.y <= 0) { this.y = 0; this.vy = 0; this.airUsed = false; this.enter(ST.LAND); this.lock = 0; this.match.emit({ t: 'land', who: this.idx, x: this.x, z: this.z, big: false }); }
  }
  tickLand() {
    this.airUsed = false;
    this.faceOpp();
    this.updateGuard();
    if (this.stT >= 5) this.enter(ST.IDLE);
  }

  // ---- attacking
  tickAtk() {
    const m = this.move;
    this.mf++;
    const mf = this.mf;
    // facing
    if (mf < m.st) this.turnToward(m.hom ? 6 * DEG : 0.7 * DEG);
    else if (m.hom && mf <= m.st + m.ac) this.turnToward(3 * DEG);
    this.fx = this.lockF.x; this.fz = this.lockF.z;
    // root motion along the locked facing
    if (m.mv) {
      for (const s of m.mv) {
        if (mf >= s[0] && mf <= s[1]) {
          const n = s[1] - s[0] + 1;
          const dist = (s[2] / n) * this.sc;
          this.x += this.lockF.x * dist; this.z += this.lockF.z * dist;
          if (s[3]) { this.x += -this.lockF.z * (s[3] / n) * this.sc; this.z += this.lockF.x * (s[3] / n) * this.sc; }
        }
      }
    }
    if (m.yc) this.y = ycAt(m.yc, mf) * this.sc;
    else if (this.aerial) {
      this.vy -= G; this.y += this.vy;
      this.x += this.fx * (this.jvx || 0);
      this.z += this.fz * (this.jvx || 0);
      if (this.y <= 0) {
        this.y = 0; this.vy = 0; this.aerial = false; this.airUsed = false;
        this.move = null; this.mf = 0; this.enter(ST.LAND); this.match.emit({ t: 'land', who: this.idx, x: this.x, z: this.z, big: false });
        return;
      }
    }
    // heat engager on contact
    if (m.he && this.contact && !this.heDone && this.heat.avail && !this.heat.on && this.match.rules.heat) {
      this.heDone = true; this.activateHeat();
    }
    if (m.hbst && mf === m.st && !this.heDone) { this.heDone = true; this.activateHeat(); }
    // parry window handling is in combat.js
    // chained follow up
    if (m.nextList) {
      const c = this.cmdBuf;
      if (c && !this.chainQ && this.fr <= c.exp) {
        const lk = m.nextList.find((n) => n.mask === c.mask) || m.nextList.find((n) => (n.mask & c.mask) === n.mask && c.mask);
        if (lk && c.pf >= this.moveStart + m.cw - 1 - 6 && mf <= m.cwe) { this.chainQ = lk; this.cmdBuf = null; }   // presses made just before this move began (e.g. during the last hitstop) still count
      }
      if (this.chainQ && mf >= m.cf) {
        const nm = this.chainQ.move;
        if (!(nm.req && !this.reqOk(nm))) { const buf = this.cmdBuf; this.startMove(nm); this.cmdBuf = buf; this.keepStanceFrom(m); return; }
        this.chainQ = null;
      }
    }
    // auto follow ups (multi-hit specials)
    if (m.auto && mf === (m.auto.at ?? m.cf)) {
      const on = m.auto.on || 'always';
      const ok = on === 'always' || (on === 'contact' && this.contact) || (on === 'hit' && this.contact === 'hit') || (on === 'block' && this.contact === 'block');
      if (ok) { const nm = this.ch.moveMap.get(m.auto.id); this.startMove(nm); return; }
    }
    // Heat dash cancel
    if (this.heat.on && this.contact && mf >= m.st + m.ac - 1 && !this.heatDashed && this.dir === 6 && this.pdir !== 6 && this.doubleTap(6)) {
      this.heatDashed = true; this.heat.t = Math.max(1, this.heat.t - 60);
      this.endMove(); this.startDashF(); this.heatDashFlag = false; this.match.emit({ t: 'heatdash', who: this.idx });
      return;
    }
    if (m.grab && m.lv === 't' && !this.hitDone && mf >= m.st + m.ac - 1 + (m.grab.whiffRec ?? 24)) { this.endMove(); return; }
    if (mf > (this.recEnd ?? m.total)) this.endMove();
  }

  // launches and juggle hits shorten the attacker's recovery so follow-ups can connect (Tekken-style hit advantage)
  cutRecovery(f) {
    const m = this.move;
    if (!m) return;
    const eff = this.recEnd ?? m.total;
    const from = Math.max(this.mf, m.st + m.ac - 1);
    if (eff <= from) return;
    this.recEnd = from + Math.round((eff - from) * f);
  }

  keepStanceFrom() {}

  activateHeat() {
    this.heat.avail = false; this.heat.on = true; this.heat.t = HEAT_FRAMES; this.stats.heats++;
    this.match.emit({ t: 'heat', who: this.idx });
  }

  // ---- reactions
  enterHit(kind, stun, hk) {
    this.state = ST.HIT; this.stT = 0; this.stun = stun; this.stunTotal = stun;
    this.hk = { kind, ...hk };
    this.move = null; this.mf = 0; this.chainQ = null; this.aerial = false; this.stance = null;
    this.crouch = kind === 'crumple' ? true : false;
    if (this.y > 0) this.y = 0;
  }
  tickHit() {
    if (this.hk.face !== false) this.faceOpp();
    this.stun--;
    if (this.stun <= 0) { this.enter(ST.IDLE); this.lock = 0; this.hk = null; this.endCombo(); }
  }
  enterBlock(stun, crouch, lv) {
    this.state = ST.BLK; this.stT = 0; this.stun = stun; this.stunTotal = stun;
    this.blkCrouch = crouch; this.crouch = crouch; this.blkLv = lv;
    this.move = null; this.mf = 0; this.chainQ = null; this.aerial = false;
  }
  tickBlk() {
    this.faceOpp();
    this.stun--;
    if (this.stun <= 0) { this.enter(ST.IDLE); this.lock = 0; this.crouch = this.blkCrouch && (this.dir === 1 || this.dir === 2); }
    this.updateGuard();
  }
  endCombo() {
    this.comboHits = 0; this.comboDmg = 0; this.airHits = 0; this.usedBound = false; this.usedWall = false; this.usedScrew = false; this.gm = 1;
  }

  enterAir(vy, vh, opts = {}) {
    this.state = ST.AIR; this.stT = 0;
    this.vy = vy; this.vx = vh.x; this.vz = vh.z;
    this.air = { kind: opts.kind || 'launch', spin: opts.spin || 0, bound: !!opts.bound, faceUp: opts.faceUp !== false, noTech: !!opts.noTech, ko: !!opts.ko, bounced: false };
    this.faceUp = this.air.faceUp;
    this.move = null; this.mf = 0; this.chainQ = null; this.aerial = false; this.stance = null;
    this.techWin = 0; this.airT = 0;
    if (this.y < 0.02) this.y = 0.02;
  }
  tickAir() {
    this.airT++;
    if (this.pressed) this.techWin = 8; else if (this.techWin > 0) this.techWin--;
    this.vy -= G * this.gm;
    this.y += this.vy;
    this.x += this.vx; this.z += this.vz;
    if (this.vy > 0) { this.vx *= 0.995; this.vz *= 0.995; } else { this.vx *= 0.98; this.vz *= 0.98; }
    if (this.y <= 0 && this.vy < 0) this.land();
  }
  land() {
    const a = this.air;
    this.y = 0;
    if (a.bound && !this.usedBound && !a.bounced) {
      this.usedBound = true; a.bounced = true;
      this.vy = 0.125; this.vx *= 0.3; this.vz *= 0.3; this.faceUp = false; a.faceUp = false;
      this.match.emit({ t: 'bound', who: this.idx, x: this.x, z: this.z });
      this.match.shake(0.5);
      return;
    }
    const heavy = this.vy < -0.1;
    this.vx *= 0.3; this.vz *= 0.3;
    this.match.emit({ t: 'land', who: this.idx, x: this.x, z: this.z, big: heavy });
    if (a.ko) { this.enter(ST.KO); this.koFly = false; return; }
    // tech roll (ukemi)
    if (!a.noTech && this.techWin > 0 && this.match.rules.tech !== false) {
      const d = this.dir;
      this.roll(d === 8 ? 'bg' : d === 2 ? 'cam' : d === 4 ? 'back' : d === 6 ? 'fwd' : 'back', true);
      this.endCombo();
      return;
    }
    this.enter(ST.DOWN); this.vy = 0; this.faceUp = a.faceUp;
    this.downT = 0;
    this.endCombo();
  }

  enterWall(nx, nz) {
    this.state = ST.WALL; this.stT = 0; this.wallN = { x: nx, z: nz };
    this.move = null; this.mf = 0; this.chainQ = null; this.aerial = false;
    this.vx = 0; this.vz = 0; this.vy = 0; this.y = Math.max(0, Math.min(this.y * 0.3, 0.3));
    this.stun = 52; this.stunTotal = 52;
    this.match.emit({ t: 'wallsplat', who: this.idx, x: this.x, z: this.z, nx, nz });
  }
  tickWall() {
    this.stun--;
    this.vx = 0; this.vz = 0;
    if (this.stun <= 0) {
      this.enterAir(0.02, { x: this.wallN.x * 0.02, z: this.wallN.z * 0.02 }, { kind: 'slump', faceUp: false, noTech: true });
      this.endCombo();
    }
  }

  tickDown() {
    this.downT = (this.downT || 0) + 1;
    const t = this.downT;
    if (this.match.roundOverFlag) return;
    if (t >= 12 && this.cmdBuf) {
      const m = this.findMove(this.cmdBuf);
      this.cmdBuf = null;
      if (m) { this.beginMove(m); return; }
    }
    if (t >= 16) {
      const d = this.dir;
      if (d === 8 || d === 9 || d === 7) return this.roll('bg', false);
      if (d === 2 || d === 3 || d === 1) { if (t >= 20) return this.roll('cam', false); }
      if (d === 4) return this.roll('back', false);
      if (d === 6) return this.roll('fwd', false);
    }
    if (t >= 60) this.getUp('stand');
  }
  roll(kind, tech) {
    this.enter(ST.GETUP); this.getKind = kind; this.getN = kind === 'stand' ? 24 : 30; this.dashPrev = 0; this.tech = tech;
    this.match.emit({ t: 'roll', who: this.idx, tech });
  }
  getUp(kind) {
    this.enter(ST.GETUP); this.getKind = kind; this.getN = 24; this.dashPrev = 0;
  }
  tickGetup() {
    this.faceOpp();
    if (this.getKind !== 'stand') {
      const t = Math.min(1, this.stT / this.getN);
      const e = easeInOut(t);
      const step = (e - this.dashPrev) * 1.5; this.dashPrev = e;
      const dz = this.getKind === 'back' ? -1 : this.getKind === 'fwd' ? 1 : 0;
      if (dz) this.moveFwd(step * dz * 0.8);
      else this.sideMove(this.getKind === 'bg' ? 1 : -1, step * 0.9);
    }
    if (this.stT >= this.getN) { this.enter(ST.IDLE); this.lock = 0; this.crouch = false; }
  }

  tickGrab() {
    // victim of a throw: position is driven by the attacker in Match.updateGrab
    this.capT++;
  }

  tickKO() {
    // lying on the floor for good
  }

  // hurt volume(s) used by the hit tests
  zone() {
    switch (this.state) {
      case ST.DOWN: case ST.KO: return 'down';
      case ST.AIR: return 'air';
      case ST.GETUP: return this.getKind === 'stand' ? (this.stT < 12 ? 'down' : 'crouch') : 'down';
      case ST.CD: return 'crouch';
      case ST.BLK: return this.blkCrouch ? 'crouch' : 'stand';
      case ST.HIT: return this.hk && this.hk.kind === 'crumple' ? 'crouch' : 'stand';
      case ST.ATK: {
        const m = this.move;
        if (m && m.hb) for (const h of m.hb) if (this.mf >= h[0] && this.mf <= h[1]) return h[2];
        if (m && (m.ctx === 'cd' || m.crouchMove)) return 'crouch';
        return 'stand';
      }
      case ST.IDLE: return this.crouch ? 'crouch' : 'stand';
      default: return 'stand';
    }
  }

  hurtCapsule() {
    const s = this.sc, R = BODY_R * s, y = this.y;
    switch (this.zone()) {
      case 'down': {
        const cx = this.x, cz = this.z;
        return { a: [cx - this.fx * 0.75 * s, y + 0.2 * s, cz - this.fz * 0.75 * s], b: [cx + this.fx * 0.75 * s, y + 0.2 * s, cz + this.fz * 0.75 * s], r: 0.22 * s, zone: 'down' };
      }
      case 'crouch': return { a: [this.x, y + 0.32 * s, this.z], b: [this.x, y + 0.75 * s, this.z], r: R, zone: 'crouch' };
      case 'air': return { a: [this.x, y + 0.0 * s, this.z], b: [this.x, y + 1.1 * s, this.z], r: 0.52 * s, zone: 'air' };
      default: return { a: [this.x, y + 0.3 * s, this.z], b: [this.x, y + 1.5 * s, this.z], r: R, zone: 'stand' };
    }
  }

  // world-space hit volume of the current move (null when not active)
  strikeCapsule() {
    const m = this.move;
    if (!m || this.state !== ST.ATK) return null;
    if (this.mf < m.st || this.mf > m.st + m.ac - 1) return null;
    return this.moveCapsule(m);
  }

  moveCapsule(m) {
    const s = this.sc;
    const fx = this.lockF.x, fz = this.lockF.z, rx = -fz, rz = fx;
    const w = (p) => [this.x + (rx * p[0] + fx * p[2]) * s, this.y + p[1] * s, this.z + (rz * p[0] + fz * p[2]) * s];
    return { a: w(m.P), b: w(m.Q), r: m.r * s };
  }

  // world position of a root-space local point
  localToWorld(p) {
    const s = this.sc, fx = this.fx, fz = this.fz, rx = -fz, rz = fx;
    return [this.x + (rx * p[0] + fx * p[2]) * s, this.y + p[1] * s, this.z + (rz * p[0] + fz * p[2]) * s];
  }

  limbPoint(m, f) {
    return limbAt(m, f, this.ch.rest[m.limb] || [0, 1.2, 0.3]);
  }
}

function popc(v) { let c = 0; while (v) { c += v & 1; v >>= 1; } return c; }

export function ycAt(pts, f) {
  if (f <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (f <= pts[i][0]) {
      const a = pts[i - 1], b = pts[i];
      const t = (f - a[0]) / Math.max(1, b[0] - a[0]);
      return a[1] + (b[1] - a[1]) * t;
    }
  }
  return pts[pts.length - 1][1];
}
