// Match: two fighters, arena, round flow, throws, walls, KO, events.
import { Fighter, ST, ycAt } from './fighter.js';
import { resolveCombat, checkThrowBreak, applyDamage } from './combat.js';
import { START_DIST, BODY_R, RAGE_FRAC } from './const.js';
import { Rng, clamp } from '../util.js';
import { sampleVic } from './move.js';

export const DEFAULT_RULES = {
  rounds: 2,          // round wins needed
  time: 60,           // seconds, 0 = infinite
  heat: true,
  rage: true,
  recoverable: true,
  tech: true,
  dmgMul: 1,
  infHp: false,
  practice: false,
  autoReset: false,
};

const DEFAULT_STAGE = {
  phases: [{ bounds: { type: 'rect', hx: 9, hz: 7 }, walls: { px: true, nx: true, pz: true, nz: true } }],
};

export class Match {
  constructor({ chars, stage = DEFAULT_STAGE, rules = {}, seed = 1234 }) {
    this.rules = { ...DEFAULT_RULES, ...rules };
    this.rng = new Rng(seed);
    this.stage = stage;
    this.pIdx = 0;
    this.events = [];
    this.frame = 0;
    this.hitstop = 0;
    this.shakeAmt = 0;
    this.timeScale = 1;
    this.bg = { x: 0, z: -1 };
    this.axis = { x: 1, z: 0 };
    this.fighters = [new Fighter(this, 0, chars[0]), new Fighter(this, 1, chars[1])];
    this.wins = [0, 0];
    this.round = 0;
    this.over = false;
    this.winner = -1;
    this.roundOverFlag = false;
    this.measure = null;
    this.lastRoundWinner = -1;
    this.cine = null;
    this.startRound();
  }

  get bounds() { return this.stage.phases[this.pIdx]; }

  emit(e) { e.f = this.frame; this.events.push(e); if (this.events.length > 2000) this.events.splice(0, 1000); }
  shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); }

  // ------------------------------------------------------------------ rounds
  startRound() {
    this.round++;
    this.pIdx = 0;
    this.roundOverFlag = false;
    this.hitstop = 0;
    this.timeScale = 1;
    this.cine = null;
    const half = START_DIST / 2;
    const [a, b] = this.fighters;
    a.reset(-half, 0, 1, 0);
    b.reset(half, 0, -1, 0);
    if (this.round === 1 && this.rules.startHp) { a.hp = Math.max(1, Math.round(a.maxHp * this.rules.startHp[0])); b.hp = Math.max(1, Math.round(b.maxHp * this.rules.startHp[1])); }
    for (const f of this.fighters) { f.enter(ST.INTRO); f.introFirst = this.round === 1; }
    this.phase = 'intro';
    this.phaseT = 0;
    this.introLen = this.rules.practice ? 1 : (this.round === 1 ? 150 : 100);
    this.timeLeft = this.rules.time > 0 ? this.rules.time * 60 : -1;
    this.updateAxis();
    this.emit({ t: 'round', n: this.round, wins: [...this.wins] });
  }

  updateAxis() {
    const [a, b] = this.fighters;
    let dx = b.x - a.x, dz = b.z - a.z;
    const l = Math.hypot(dx, dz) || 1;
    dx /= l; dz /= l;
    this.axis.x = dx; this.axis.z = dz;
    this.bg.x = dz; this.bg.z = -dx;
  }

  // ------------------------------------------------------------------ main step
  step(inputs) {
    this.frame++;
    const [a, b] = this.fighters;
    this.shakeAmt *= 0.9;
    if (this.phase === 'intro') { this.stepIntro(inputs); return; }

    const hold = this.hitstop > 0;
    const idle = { l: false, r: false, u: false, d: false, b1: false, b2: false, b3: false, b4: false };
    const locked = this.phase !== 'fight';
    a.feed(locked ? idle : inputs[0], hold);
    b.feed(locked ? idle : inputs[1], hold);
    if (hold) { this.hitstop--; return; }

    this.updateAxis();
    a.update(); b.update();
    this.updateGrabs();
    resolveCombat(this);
    this.separate();
    this.bounds_();
    this.updateAxis();
    this.rageCheck();
    this.tickMeasure();
    if (this.phase === 'fight') this.roundLogic();
    else if (this.phase === 'ko') this.koLogic();
    else if (this.phase === 'roundend') this.roundEndLogic();
    if (this.rules.practice) this.practiceLogic();
  }

  stepIntro(inputs) {
    this.phaseT++;
    for (const f of this.fighters) { f.fr++; f.stT++; f.faceOpp(); }
    if (this.phaseT === this.introLen - 45) this.emit({ t: 'ready' });
    if (this.phaseT >= this.introLen) {
      this.phase = 'fight'; this.phaseT = 0;
      for (const f of this.fighters) { f.enter(ST.IDLE); f.lock = 0; f.cmdBuf = null; f.chord = null; }
      this.emit({ t: 'fight' });
    }
  }

  rageCheck() {
    if (!this.rules.rage) return;
    for (const f of this.fighters) {
      if (!f.rage && !f.rageUsed && f.hp > 0 && f.hp <= f.maxHp * RAGE_FRAC && this.phase === 'fight') {
        f.rage = true;
        this.emit({ t: 'rage', who: f.idx });
      }
    }
  }

  roundLogic() {
    const [a, b] = this.fighters;
    this.phaseT++;
    if (this.timeLeft > 0) {
      this.timeLeft--;
      if (this.timeLeft === 0) { this.emit({ t: 'timeup' }); this.endRound(this.timeWinner(), 'time'); return; }
    }
  }

  timeWinner() {
    const [a, b] = this.fighters;
    const pa = a.hp / a.maxHp, pb = b.hp / b.maxHp;
    if (Math.abs(pa - pb) < 1e-6) return -1;
    return pa > pb ? 0 : 1;
  }

  // called by combat when a hit reduces hp to 0
  koHit(def, att, m, away, hs) {
    if (this.phase !== 'fight') { def.hp = Math.max(def.hp, 0); }
    const power = m.lvp ?? 0.03;
    def.enterAir(0.115, { x: away.x * (0.085 + power), z: away.z * (0.085 + power) }, { kind: 'ko', ko: true, noTech: true, faceUp: true });
    def.gm = 1;
    def.endCombo();
    def.koFly = true;
    this.hitstop = Math.max(this.hitstop, 14);
    const winner = def.hp <= 0 && att.hp <= 0 ? -1 : att.idx;
    this.endRound(winner, 'ko');
    this.emit({ t: 'ko', who: def.idx, by: att.idx });
  }

  endRound(winner, why) {
    if (this.phase !== 'fight') return;
    const [a, b] = this.fighters;
    this.phase = 'ko';
    this.phaseT = 0;
    this.roundOverFlag = true;
    this.roundWinner = winner;
    this.roundWhy = why;
    this.timeScale = why === 'ko' ? 0.3 : 1;
    if (winner >= 0) this.wins[winner]++;
    else { this.wins[0]++; this.wins[1]++; }
    this.perfect = winner >= 0 && why === 'ko' && this.fighters[winner].hp >= this.fighters[winner].maxHp;
    this.lastRoundWinner = winner;
    for (const f of this.fighters) { f.cmdBuf = null; f.chord = null; f.guard = null; }
  }

  koLogic() {
    this.phaseT++;
    const [a, b] = this.fighters;
    const lim = this.roundWhy === 'ko' ? 130 : 30;
    if (this.phaseT > 60 && this.timeScale < 1) this.timeScale = Math.min(1, this.timeScale + 0.02);
    if (this.phaseT >= lim) {
      this.timeScale = 1;
      this.phase = 'roundend'; this.phaseT = 0;
      for (const f of this.fighters) {
        if (this.roundWinner === f.idx) { f.pendingWin = true; }
      }
      this.emit({ t: 'roundend', winner: this.roundWinner, perfect: this.perfect });
    }
  }

  roundEndLogic() {
    this.phaseT++;
    if (this.phaseT === 1) {
      for (const f of this.fighters) {
        if (f.state === ST.KO || f.state === ST.AIR || f.state === ST.DOWN) continue;
        if (this.roundWinner === f.idx) { f.enter(ST.WIN); }
        else if (this.roundWinner >= 0) { f.enter(ST.LOSE); }
        else f.enter(ST.LOSE);
      }
      const w = this.roundWinner;
      if (w >= 0) { const wf = this.fighters[w]; if (wf.state !== ST.WIN) { wf.state = ST.WIN; wf.stT = 0; } }
    }
    const done = this.wins[0] >= this.rules.rounds || this.wins[1] >= this.rules.rounds;
    if (this.phaseT >= 170) {
      if (done) {
        this.over = true;
        this.winner = this.wins[0] === this.wins[1] ? -1 : (this.wins[0] > this.wins[1] ? 0 : 1);
        this.phase = 'matchend';
        this.emit({ t: 'matchend', winner: this.winner });
      } else this.startRound();
    }
  }

  practiceLogic() {
    if (this.phase !== 'fight') return;
    const [a, b] = this.fighters;
    const R = this.rules;
    for (const f of this.fighters) {
      const calm = f.state === ST.IDLE || f.state === ST.DOWN;
      if (R.infHp && calm) { f.hp = f.maxHp; f.rec = 0; }
      if (R.infHeat && !f.heat.on && f.state === ST.IDLE) f.heat.avail = true;
      if (R.infRage && f.state === ST.IDLE) { f.rage = true; f.rageUsed = false; if (f.hp > f.maxHp * RAGE_FRAC) f.hp = Math.round(f.maxHp * RAGE_FRAC * 0.9); }
      if (f.hp <= 0) f.hp = 1;
    }
    this.timeLeft = -1;
  }

  // reset positions in practice
  resetPositions(swap = false) {
    const half = START_DIST / 2;
    const [a, b] = this.fighters;
    const l = swap ? b : a, r = swap ? a : b;
    for (const f of this.fighters) { f.hp = f.maxHp; f.rec = 0; f.enterIdleClean(); }
    a.x = swap ? half : -half; b.x = swap ? -half : half; a.z = 0; b.z = 0;
    this.pIdx = 0;
    this.updateAxis();
  }

  // ------------------------------------------------------------------ world
  separate() {
    const [a, b] = this.fighters;
    const skip = (f) => f.state === ST.DOWN || f.state === ST.KO || f.state === ST.GRAB || (f.state === ST.AIR && f.y > 0.5) || f.state === ST.GETUP && f.getKind !== 'stand';
    if (skip(a) || skip(b)) return;
    if (a.y > 0.9 || b.y > 0.9) return;
    let dx = b.x - a.x, dz = b.z - a.z;
    const d = Math.hypot(dx, dz);
    const minD = BODY_R * (a.sc + b.sc) * 1.02;
    if (d < minD) {
      if (d < 1e-4) { dx = this.axis.x; dz = this.axis.z; } else { dx /= d; dz /= d; }
      const pen = (minD - d) * 0.5;
      const wa = a.state === ST.WALL ? 0 : 1, wb = b.state === ST.WALL ? 0 : 1;
      const tot = wa + wb || 1;
      a.x -= dx * pen * 2 * wa / tot; a.z -= dz * pen * 2 * wa / tot;
      b.x += dx * pen * 2 * wb / tot; b.z += dz * pen * 2 * wb / tot;
    }
  }

  // distance from fighter to the wall along direction (dx,dz); null when no wall that way
  distToWall(f, dir) {
    const bd = this.bounds;
    const B = bd.bounds;
    const m = BODY_R * f.sc;
    let best = null;
    const consider = (t, wall) => { if (t >= 0 && wall && (best === null || t < best)) best = t; };
    if (B.type === 'rect') {
      if (dir.x > 1e-4) consider((B.hx - m - f.x) / dir.x, bd.walls.px);
      if (dir.x < -1e-4) consider((-B.hx + m - f.x) / dir.x, bd.walls.nx);
      if (dir.z > 1e-4) consider((B.hz - m - f.z) / dir.z, bd.walls.pz);
      if (dir.z < -1e-4) consider((-B.hz + m - f.z) / dir.z, bd.walls.nz);
    } else {
      // circle centred at origin
      const R = B.r - m;
      const bx = f.x, bz = f.z;
      const a = dir.x * dir.x + dir.z * dir.z, bq = 2 * (bx * dir.x + bz * dir.z), c = bx * bx + bz * bz - R * R;
      const disc = bq * bq - 4 * a * c;
      if (disc >= 0) { const t = (-bq + Math.sqrt(disc)) / (2 * a); if (bd.walls.all) consider(t, true); }
    }
    return best;
  }

  bounds_() {
    const bd = this.bounds;
    const B = bd.bounds;
    for (const f of this.fighters) {
      if (f.state === ST.GRAB) continue;
      const m = BODY_R * f.sc;
      let nx = 0, nz = 0, pen = 0, side = null;
      if (B.type === 'rect') {
        if (f.x > B.hx - m) { pen = f.x - (B.hx - m); f.x = B.hx - m; nx = -1; side = 'px'; }
        else if (f.x < -B.hx + m) { pen = -B.hx + m - f.x; f.x = -B.hx + m; nx = 1; side = 'nx'; }
        if (f.z > B.hz - m) { const p = f.z - (B.hz - m); f.z = B.hz - m; if (p >= pen) { pen = p; nx = 0; nz = -1; side = 'pz'; } }
        else if (f.z < -B.hz + m) { const p = -B.hz + m - f.z; f.z = -B.hz + m; if (p >= pen) { pen = p; nx = 0; nz = 1; side = 'nz'; } }
      } else {
        const R = B.r - m;
        const d = Math.hypot(f.x, f.z);
        if (d > R) { pen = d - R; nx = -f.x / d; nz = -f.z / d; f.x = -nx * R; f.z = -nz * R; side = 'all'; }
      }
      if (pen > 0.004 && side) {
        const walls = bd.walls;
        const hasWall = walls.all || walls[side];
        const splatty = (f.state === ST.HIT && f.hk && f.hk.ws) || (f.state === ST.AIR && f.air && f.air.ws && f.airHits >= 0);
        if (hasWall && splatty && !f.usedWall && pen > 0.004) {
          f.usedWall = true;
          const att = f.opp;
          f.enterWall(nx, nz);
          const wsd = att.lastWsDmg ?? 0;
          if (wsd) applyDamage(this, f, att, wsd, false);
          att.stats.walls++;
          this.hitstop = Math.max(this.hitstop, 9);
          this.shake(0.7);
          if (f.hp <= 0) { f.hp = 1; }
          // wall break?
          const brk = bd.wallBreak;
          if (brk && (brk === side || brk === 'all') && (att.move && att.move.wb || att.lastWb)) this.wallBreak(f, att);
        } else if (f.state === ST.AIR || f.state === ST.HIT) {
          // bounce a little off the wall
          if (f.state === ST.AIR) { const vn = f.vx * nx + f.vz * nz; if (vn < 0) { f.vx -= 1.4 * vn * nx; f.vz -= 1.4 * vn * nz; } }
          f.vx *= 0.6; f.vz *= 0.6;
        }
      }
    }
  }

  wallBreak(f, att) {
    const next = this.stage.phases[this.pIdx + 1];
    if (!next) return;
    this.emit({ t: 'wallbreak', who: f.idx, x: f.x, z: f.z, to: this.pIdx + 1 });
    this.pIdx++;
    const half = START_DIST / 2;
    const [a, b] = this.fighters;
    const dmg = 12;
    applyDamage(this, f, att, dmg, false);
    if (f.hp <= 0) f.hp = 1;
    // both land in the next arena; victim on the ground
    const cx = next.center?.[0] ?? 0, cz = next.center?.[1] ?? 0;
    if (att.idx === 0) { a.x = cx - half; b.x = cx + half; } else { a.x = cx - half; b.x = cx + half; }
    a.z = cz; b.z = cz;
    for (const p of this.fighters) { p.vx = 0; p.vz = 0; p.px = p.x; p.pz = p.z; }
    f.enterAir(0.02, { x: 0, z: 0 }, { kind: 'kd', faceUp: false, noTech: true });
    f.y = 0.02;
    att.enterIdleClean();
    att.lock = 40;
    this.hitstop = 0;
    this.shake(1);
    this.updateAxis();
  }

  // ------------------------------------------------------------------ throws / captures
  updateGrabs() {
    for (const att of this.fighters) {
      const def = att.grabbing;
      if (!def) continue;
      if (att.state !== ST.ATK || def.state !== ST.GRAB || !att.move || !att.move.grab) { att.grabbing = null; if (def.state === ST.GRAB) this.releaseCapture(att, def, 'kd'); continue; }
      const m = att.move, g = m.grab;
      // break check
      if (checkThrowBreak(this, def)) continue;
      const mf = att.mf;
      // victim transform
      const kf = g.vic;
      if (kf && kf.length) {
        const k = sampleVic(kf, mf);
        const s = att.sc;
        const fx = att.lockF.x, fz = att.lockF.z, rx = -fz, rz = fx;
        def.x = att.x + (rx * k.p[0] + fx * k.p[2]) * s;
        def.z = att.z + (rz * k.p[0] + fz * k.p[2]) * s;
        def.y = 0; def.capY = k.p[1] * s;
        def.capRot = k.r;
        def.fx = -fx; def.fz = -fz;
      }
      for (const h of g.hits || []) {
        if (mf === h.f) {
          let dmg = h.dmg;
          if (att.rage && !m.ra) dmg = Math.round(dmg * 1.1);
          dmg = Math.max(1, Math.round(dmg * (this.rules.dmgMul ?? 1)));
          applyDamage(this, def, att, dmg, false);
          def.addRec(dmg * 0.35);
          att.comboOut.hits = (att.comboOut.hits || 0) + 1; att.comboOut.dmg += dmg; att.comboOut.t = 100;
          this.emit({ t: 'hit', pos: [def.x, def.y + 1.1 * def.sc, def.z], kind: h.spark || 'med', counter: false, dmg, att: att.idx, def: def.idx, cap: true, sfx: h.sfx });
          this.shake(h.spark === 'heavy' ? 0.6 : 0.25);
          if (h.stop) this.hitstop = Math.max(this.hitstop, h.stop);
          def.flash = 6;
          if (def.hp <= 0) {
            def.hp = 0;
          }
        }
      }
      if (mf >= (g.end ?? m.total - 4)) {
        this.releaseCapture(att, def, g.after || 'kd');
        att.grabbing = null;
        if (def.hp <= 0) {
          const away = { x: att.lockF.x, z: att.lockF.z };
          this.koHit(def, att, { lvp: 0.03 }, away, 10);
        }
      }
    }
  }

  releaseCapture(att, def, how) {
    const away = { x: att.lockF.x, z: att.lockF.z };
    def.grabBy = null;
    def.capRot = null;
    def.endCombo();
    switch (how) {
      case 'launch': def.enterAir(0.16, { x: away.x * 0.03, z: away.z * 0.03 }, { kind: 'launch' }); def.usedBound = false; break;
      case 'wall': def.enterAir(0.05, { x: away.x * 0.1, z: away.z * 0.1 }, { kind: 'kd', faceUp: true, noTech: true }); def.air.ws = true; break;
      case 'side': def.enterAir(0.05, { x: 0, z: 0 }, { kind: 'kd', faceUp: false, noTech: true }); break;
      case 'stagger': def.enterHit('n', 26, { lv: 'm', side: 'f', heavy: true }); break;
      default: def.enterAir(0.045, { x: away.x * 0.01, z: away.z * 0.01 }, { kind: 'kd', faceUp: false, noTech: true }); break;
    }
    if (def.y < 0.02) def.y = 0.02;
  }

  // ------------------------------------------------------------------ frame data measurement (practice)
  measureContact(att, def, kind) {
    this.measure = { t0: this.frame, att: att.idx, def: def.idx, kind, aFree: null, dFree: null, move: att.move ? att.move.id : '' };
  }
  tickMeasure() {
    const m = this.measure;
    if (!m) return;
    const a = this.fighters[m.att], d = this.fighters[m.def];
    const free = (f) => f.state === ST.IDLE && f.lock <= 0;
    if (m.aFree === null && free(a)) m.aFree = this.frame;
    if (m.dFree === null && free(d)) m.dFree = this.frame;
    if (m.aFree !== null && m.dFree !== null) {
      this.lastMeasure = { att: m.att, kind: m.kind, adv: m.dFree - m.aFree, move: m.move };
      this.measure = null;
      this.emit({ t: 'measure', ...this.lastMeasure });
    } else if (this.frame - m.t0 > 200) this.measure = null;
  }
}

