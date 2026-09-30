// CPU opponent. Produces raw inputs frame by frame, exactly like a human controller would.
import { ST } from './fighter.js';
import { closestSegSeg, clamp, Rng } from '../util.js';
import { BODY_R, G } from './const.js';

export const LEVELS = [
  { name: 'Beginner', react: 26, block: 0.18, brk: 0.10, punish: 0.10, juggle: 0.25, aggr: 0.35, sidestep: 0.02, duck: 0.05, heat: 0.05, mix: 0.15, wall: 0 },
  { name: 'Easy', react: 20, block: 0.38, brk: 0.30, punish: 0.30, juggle: 0.5, aggr: 0.5, sidestep: 0.08, duck: 0.15, heat: 0.2, mix: 0.3, wall: 0.2 },
  { name: 'Normal', react: 15, block: 0.58, brk: 0.50, punish: 0.55, juggle: 0.75, aggr: 0.6, sidestep: 0.15, duck: 0.3, heat: 0.4, mix: 0.5, wall: 0.5 },
  { name: 'Hard', react: 11, block: 0.78, brk: 0.68, punish: 0.8, juggle: 0.92, aggr: 0.7, sidestep: 0.25, duck: 0.5, heat: 0.6, mix: 0.7, wall: 0.8 },
  { name: 'Expert', react: 8, block: 0.9, brk: 0.82, punish: 0.95, juggle: 1, aggr: 0.75, sidestep: 0.35, duck: 0.65, heat: 0.8, mix: 0.85, wall: 1 },
  { name: 'Master', react: 6, block: 0.95, brk: 0.9, punish: 1, juggle: 1, aggr: 0.8, sidestep: 0.4, duck: 0.75, heat: 0.95, mix: 1, wall: 1 },
];

const NEUTRAL = { l: false, r: false, u: false, d: false, b1: false, b2: false, b3: false, b4: false };

// numpad direction -> booleans relative to facing
function dirBits(dir) {
  return {
    f: dir === 6 || dir === 9 || dir === 3,
    b: dir === 4 || dir === 7 || dir === 1,
    u: dir === 7 || dir === 8 || dir === 9,
    d: dir === 1 || dir === 2 || dir === 3,
  };
}

export class CpuBrain {
  constructor(idx, level = 2, seed = 1, opts = {}) {
    this.idx = idx;
    this.setLevel(level);
    this.rng = new Rng(seed * 7919 + idx * 31 + 5);
    this.q = [];             // queued input frames {dir, btn}
    this.hold = { dir: 5, n: 0 };
    this.guardFor = null;    // {kind:'stand'|'crouch'|'duck', until}
    this.decidedFor = -1;
    this.cool = 10 + this.rng.int(20);
    this.lastMove = '';
    this.repeat = 0;
    this.plan = null;
    this.pendingChain = null;
    this.breakAt = -1;
    this.breakBtn = 1;
    this.ghost = opts.ghost || null;
    this.prof = opts.profile || { blockH: 0, blockL: 0, throwBreak: 0, sidestep: 0, attacks: 0, throws: 0, backdash: 0, crouch: 0 };
    this.lastOppState = '';
    this.lastOppMove = '';
    this.pool = null;
    this.stanceWant = 0;
  }

  setLevel(l) { this.level = clamp(l, 0, LEVELS.length - 1); this.P = LEVELS[Math.round(this.level)]; }

  buildPool(me) {
    const ch = me.ch;
    const list = ch.moveList.filter((m) => m.cmd && m.ctx === 'stand' && !m.req && !m.noAI);
    this.pool = {
      pokes: list.filter((m) => m.lv !== 't' && m.lv !== 'l' && m.st <= 13 && m.blk >= -8 && !m.ht.startsWith('l')),
      mids: list.filter((m) => (m.lv === 'm' || m.lv === 'sm') && m.blk >= -13 && m.ht !== 'launch' && m.st <= 18),
      highs: list.filter((m) => m.lv === 'h' && m.st <= 17),
      lows: list.filter((m) => m.lv === 'l' && !m.gh),
      launchers: list.filter((m) => (m.ht === 'launch') && m.lv !== 't'),
      throws: list.filter((m) => m.lv === 't'),
      longs: list.filter((m) => m.lv !== 't' && m.reach >= 1.55 && m.st <= 20 && !m.gh),
      all: list.filter((m) => m.lv !== 't' && !m.gh),
      ground: list.filter((m) => m.gh),
      wr: ch.moveList.filter((m) => m.ctx === 'wr'),
      ss: ch.moveList.filter((m) => m.ctx === 'ss'),
      ws: ch.moveList.filter((m) => m.ctx === 'ws'),
      air: ch.moveList.filter((m) => m.ctx === 'air'),
      dn: ch.moveList.filter((m) => m.ctx === 'dn'),
      cd: ch.moveList.filter((m) => m.ctx === 'cd'),
      special: list.filter((m) => m.aiWeight && !m.noHit),
      ra: ch.moveList.find((m) => m.ra),
      hs: ch.moveList.find((m) => m.hs),
      rd: ch.moveList.find((m) => m.rd),
      hb: ch.moveList.find((m) => m.hbst),
      he: ch.moveList.filter((m) => m.he && m.ctx === 'stand'),
    };
    void BODY_R;
  }

  // ---- macro helpers -------------------------------------------------------
  frames(cmd) {
    const out = [];
    const F = (dir, btn, n = 1) => { for (let i = 0; i < n; i++) out.push({ dir, btn }); };
    const m = /^(ws|wr|ss|cd|air|dn)\+/.exec(cmd);
    if (m) cmd = cmd.slice(m[0].length);
    const toks = cmd.split('+');
    let btn = 0, dseq = null;
    const bm = { 1: 1, 2: 2, 3: 4, 4: 8 };
    const DN = { n: 5, f: 6, b: 4, u: 8, d: 2, 'd/f': 3, 'd/b': 1, 'u/f': 9, 'u/b': 7 };
    let i = 0;
    if (!/^[1-4]$/.test(toks[0])) { dseq = toks[0].split(',').map((s) => DN[s.trim()]); i = 1; }
    for (; i < toks.length; i++) btn |= bm[toks[i]];
    if (dseq) {
      for (let k = 0; k < dseq.length - 1; k++) F(dseq[k], 0, dseq[k] === 5 ? 1 : 2);
      const last = dseq[dseq.length - 1];
      F(last, 0, 1);
      F(last, btn, 2);
    } else F(5, btn, 2);
    return out;
  }

  press(cmd, ctx) {
    // ctx prefixes need the right state to be active; caller ensures it
    const fr = this.frames(cmd);
    this.q.push(...fr);
    void ctx;
  }

  // frames needed to reach the context (crouch-release, dash, sidestep, jump...) before a move's own input
  ctxFrames(m) {
    const out = [];
    const F = (dir, btn, n = 1) => { for (let i = 0; i < n; i++) out.push({ dir, btn }); };
    switch (m.ctx) {
      case 'ws': F(2, 0, 12); break;
      case 'wr': F(6, 0, 1); F(5, 0, 2); F(6, 0, 10); break;
      case 'ss': F(8, 0, 1); F(5, 0, 8); break;
      case 'cd': out.push(...this.frames('f,n,d,d/f')); F(5, 0, 8); break;
      case 'air': F(9, 0, 3); F(9, 0, 5); break;
      default: break;
    }
    return out;
  }

  pressMove(m) {
    const seq = this.ctxFrames(m);
    const F = (dir, btn, n = 1) => { for (let i = 0; i < n; i++) seq.push({ dir, btn }); };
    if (m.ctx === 'wr') { F(6, m.btn, 2); this.q.push(...seq); return; }
    if (m.motion) {
      for (let k = 0; k < m.motion.length - 1; k++) F(m.motion[k], 0, m.motion[k] === 5 ? 1 : 2);
      const last = m.motion[m.motion.length - 1];
      F(last, 0, 1); F(last, m.btn, 2);
    } else if (m.dir) { F(m.dir, 0, 2); F(m.dir, m.btn, 2); }
    else if (m.ctx === 'ws' || m.ctx === 'ss' || m.ctx === 'cd' || m.ctx === 'air') F(m.ctx === 'air' ? 9 : 5, m.btn, 2);
    else F(5, m.btn, 2);
    this.q.push(...seq);
  }

  toRaw(dir, btn, me) {
    const b = dirBits(dir);
    const mir = this.idx === 1;
    return {
      l: mir ? b.f : b.b, r: mir ? b.b : b.f, u: b.u, d: b.d,
      b1: !!(btn & 1), b2: !!(btn & 2), b3: !!(btn & 4), b4: !!(btn & 8),
    };
  }

  // ---- perception helpers ------------------------------------------------------
  dist(me, opp) { return Math.hypot(opp.x - me.x, opp.z - me.z); }

  inRange(m, me, opp, margin = 0) {
    const d = this.dist(me, opp);
    return d <= m.reach * me.sc + BODY_R * opp.sc + margin && d > 0.3;
  }

  // predicted ballistic position of an airborne opponent after n frames
  predictAir(opp, n) {
    let x = opp.x, y = opp.y, z = opp.z, vy = opp.vy, vx = opp.vx, vz = opp.vz;
    for (let i = 0; i < n; i++) {
      vy -= G * (opp.gm || 1); y += vy; x += vx; z += vz;
      if (vy > 0) { vx *= 0.995; vz *= 0.995; } else { vx *= 0.98; vz *= 0.98; }
      if (y < 0) { y = 0; break; }
    }
    return { x, y, z };
  }

  willJuggle(m, me, opp) {
    if (!m.ja && m.lv !== 't') return false;
    const lead = m.st + ((m.dir || m.motion) ? 3 : 1);
    const p = this.predictAir(opp, lead);
    // my position at the hit frame (root motion done by then)
    let mx = me.x, mz = me.z;
    if (m.mv) for (const s of m.mv) { const n = Math.max(0, Math.min(m.st, s[1]) - s[0] + 1); const tot = s[1] - s[0] + 1; mx += me.fx * (s[2] * n / tot) * me.sc; mz += me.fz * (s[2] * n / tot) * me.sc; }
    const s = me.sc, fx = me.fx, fz = me.fz, rx = -fz, rz = fx;
    const w = (q) => [mx + (rx * q[0] + fx * q[2]) * s, me.y + q[1] * s, mz + (rz * q[0] + fz * q[2]) * s];
    const a = w(m.P), b = w(m.Q);
    const ha = [p.x, p.y, p.z], hb = [p.x, p.y + 1.1 * opp.sc, p.z];
    const cl = closestSegSeg(a, b, ha, hb);
    return cl.d <= m.r * s + 0.52 * opp.sc;
  }

  // ---- main ----------------------------------------------------------------------
  think(match) {
    this.match = match;
    const me = match.fighters[this.idx], opp = match.fighters[1 - this.idx];
    if (!this.pool) this.buildPool(me);
    const P = this.P;
    // observe the human: update profile
    this.observe(me, opp);
    if (match.phase !== 'fight') { this.q.length = 0; return NEUTRAL; }
    // throw break
    if (me.state === ST.GRAB) return this.doBreak(me, opp);
    // macro playback (moves being entered)
    if (this.q.length) {
      const f = this.q.shift();
      return this.toRaw(f.dir, f.btn, me);
    }
    // string continuation
    if (this.pendingChain && me.state === ST.ATK && me.move === this.pendingChain.from) {
      if (me.mf >= me.move.cw + 1 && me.mf <= me.move.cwe) {
        const btn = this.pendingChain.btn;
        this.pendingChain = null;
        this.q.push({ dir: 5, btn }, { dir: 5, btn });
        const f = this.q.shift();
        return this.toRaw(f.dir, f.btn, me);
      }
    } else if (this.pendingChain && me.state !== ST.ATK) this.pendingChain = null;

    const d = this.dist(me, opp);
    let dir = 5;

    // ---------------- defensive reactions
    const guard = this.defend(me, opp, d);
    if (guard !== null) return this.toRaw(guard, 0, me);

    if (this.hold.n > 0) {
      this.hold.n--;
      dir = this.hold.dir;
      if (me.state === ST.IDLE || me.state === ST.BLK || me.state === ST.SS || me.state === ST.DASHB || me.state === ST.LAND) {
        // allow interrupting hold when an opportunity appears
        if (!(this.hold.guard) && this.hold.n % 3 === 0) { const act = this.offense(me, opp, d); if (act) return act; }
        return this.toRaw(dir, 0, me);
      }
    }

    // ---------------- offense / neutral
    const act = this.offense(me, opp, d);
    if (act) return act;
    return this.toRaw(dir, 0, me);
  }

  observe(me, opp) {
    const st = opp.state + (opp.move ? opp.move.id : '');
    if (st !== this.lastOppState) {
      if (opp.state === ST.ATK && opp.move) this.prof.attacks++;
      if (opp.state === ST.SS) this.prof.sidestep++;
      if (opp.state === ST.DASHB) this.prof.backdash++;
      if (opp.state === ST.BLK) { if (opp.blkLv === 'l') this.prof.blockL++; else this.prof.blockH++; }
      if (opp.crouch && opp.state === ST.IDLE) this.prof.crouch++;
      this.lastOppState = st;
    }
  }

  doBreak(me, opp) {
    const att = me.grabBy;
    if (!att || !att.move || !att.move.grab || !att.move.grab.brk) { return NEUTRAL; }
    if (this.breakAt < 0 || this.breakFor !== att.moveStart) {
      this.breakFor = att.moveStart;
      this.breakAt = 3 + this.rng.int(9);
      const right = this.rng.chance(this.P.brk);
      this.breakBtn = right ? (att.move.grab.brk === '1' ? 1 : 2) : (att.move.grab.brk === '1' ? 2 : 1);
      this.breakFrames = 0;
      if (!this.rng.chance(clamp(this.P.brk + 0.25, 0, 1))) this.breakAt = 99; // fails to react at all
    }
    this.breakFrames++;
    if (this.breakFrames === this.breakAt || this.breakFrames === this.breakAt + 1) return this.toRaw(5, this.breakBtn, me);
    return NEUTRAL;
  }

  // returns a numpad dir to hold, or null
  defend(me, opp, d) {
    const P = this.P;
    const canBlock = me.state === ST.IDLE || me.state === ST.BLK || me.state === ST.LAND || me.state === ST.SS || me.state === ST.DASHB || me.state === ST.CD;
    // stay guarding while in blockstun
    if (me.state === ST.BLK) {
      const g = this.guardFor;
      return g && g.kind === 'crouch' ? 1 : 4;
    }
    if (opp.state !== ST.ATK || !opp.move) { this.decidedFor = -1; this.guardFor = null; return null; }
    const m = opp.move;
    const tHit = m.st - opp.mf;
    if (m.lv === 't') return null;
    const threat = d <= m.reach * opp.sc + BODY_R * me.sc + 0.9;
    if (!threat) return null;
    if (this.guardFor && this.guardFor.until >= opp.mf && this.guardFor.mv === opp.moveStart) {
      return this.guardFor.kind === 'crouch' ? 1 : this.guardFor.kind === 'duck' ? 2 : this.guardFor.kind === 'stand' ? 4 : null;
    }
    if (opp.moveStart === this.decidedFor) return null;
    if (tHit > P.react + 2 || tHit < -m.ac) return null;
    if (!canBlock) return null;
    this.decidedFor = opp.moveStart;
    const r = this.rng.next();
    let skill = P.block;
    // predictable opponents get read more often
    if (this.rng.chance(0.08 * (1 - P.block))) skill *= 0.5;
    if (r < skill) {
      let kind = m.lv === 'l' ? 'crouch' : 'stand';
      if (m.lv === 'h' && this.rng.chance(P.duck)) kind = 'duck';
      // occasional mistake: wrong guard
      if (this.rng.chance((1 - P.block) * 0.3)) kind = kind === 'crouch' ? 'stand' : 'crouch';
      this.guardFor = { kind, until: opp.move.st + opp.move.ac + 1, mv: opp.moveStart };
      return kind === 'crouch' ? 1 : kind === 'duck' ? 2 : 4;
    }
    if (r < skill + P.sidestep && (m.style === 'jab' || m.style === 'cross' || m.style === 'teep' || m.lv === 'h')) {
      this.q.push({ dir: 8, btn: 0 }, { dir: 8, btn: 0 }, { dir: 5, btn: 0 });
      return null;
    }
    return null;
  }

  pick(list, me, opp, filterRange = true, margin = 0) {
    let c = list;
    if (filterRange) c = c.filter((m) => this.inRange(m, me, opp, margin));
    if (!c.length) return null;
    // avoid spamming the same move
    const nr = c.filter((m) => m.id !== this.lastMove || this.repeat < 2);
    const pool = nr.length ? nr : c;
    const oppBlocks = this.prof.blockH + this.prof.blockL;
    // prefer moves that are safe on block; the more the opponent blocks, the more it matters
    const safety = (m) => { const risk = m.blk >= -7 ? 1.25 : m.blk >= -10 ? 1 : m.blk >= -13 ? 0.6 : 0.35; return m.ht === 'launch' && m.lv !== 'l' ? Math.max(risk, 0.7) : 1 + (risk - 1) * (0.6 + Math.min(0.4, oppBlocks / 40)); };
    let tot = 0; const w = pool.map((m) => { const x = (m.aiWeight || 1) * (m.id === this.lastMove ? 0.5 : 1) * safety(m); tot += x; return x; });
    let r = this.rng.next() * tot;
    for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i]; }
    return pool[pool.length - 1];
  }

  fire(m, me) {
    this.repeat = m.id === this.lastMove ? this.repeat + 1 : 0;
    this.lastMove = m.id;
    this.pressMove(m);
    // maybe plan a string continuation
    if (m.nextList && m.nextList.length && this.rng.chance(0.5 + this.P.mix * 0.3)) {
      const nx = m.nextList[this.rng.int(m.nextList.length)];
      this.pendingChain = { from: m, btn: nx.mask };
    }
    const f = this.q.shift();
    return this.toRaw(f.dir, f.btn, me);
  }

  offense(me, opp, d) {
    const P = this.P, pool = this.pool, rng = this.rng;
    const s = me.state;
    const canAct = s === ST.IDLE && me.lock <= 0;

    // --- juggle
    if (opp.state === ST.AIR && (opp.y > 0.1) && (canAct || s === ST.DASHF || s === ST.RUN)) {
      if (!rng.chance(P.juggle)) return null;
      let best = null, bs = -1;
      for (const m of pool.all.concat(pool.launchers, pool.ws)) {
        if (m.req || !m.ja) continue;
        if (m.lv === 'l') continue;
        if (!this.willJuggle(m, me, opp)) continue;
        let sc = m.dmg * (opp.airHits >= 4 ? 0.4 : 1) + (m.ht === 'bound' && !opp.usedBound ? 8 : 0) + (m.ws && P.wall > 0.5 ? 4 : 0) - m.st * 0.2;
        if (m.ht === 'launch' && opp.airHits > 1) sc -= 6;
        if (sc > bs) { bs = sc; best = m; }
      }
      if (best) return this.fire(best, me);
      if (d > 1.9 && opp.y < 1.6) this.hold = { dir: 6, n: 3 };
      return null;
    }
    // --- wall splat follow up: launcher
    if (opp.state === ST.WALL && canAct) {
      const c = [...pool.launchers, ...pool.mids, ...pool.pokes].filter((m) => this.inRange(m, me, opp));
      const m = c.sort((a, b) => b.dmg - a.dmg)[0];
      if (m && rng.chance(P.juggle)) return this.fire(m, me);
    }
    // --- oki
    if (opp.state === ST.DOWN && canAct) {
      if (d > 1.4) { this.hold = { dir: 6, n: 4 }; return null; }
      const g = this.pick(pool.ground, me, opp, true, 0.2);
      if (g && rng.chance(0.75)) return this.fire(g, me);
      if (rng.chance(0.2)) { const t = this.pick(pool.mids, me, opp); if (t) return this.fire(t, me); }
      return null;
    }
    if (me.state === ST.DOWN) {
      const t = me.downT || 0;
      if (t >= 14 && !this.q.length) {
        const r = rng.next();
        if (r < 0.25 && pool.dn.length) { this.pressMove(pool.dn[rng.int(pool.dn.length)]); }
        else if (r < 0.5) this.q.push({ dir: 4, btn: 0 }, { dir: 4, btn: 0 });
        else if (r < 0.65) this.q.push({ dir: 8, btn: 0 }, { dir: 8, btn: 0 });
        else if (r < 0.75) this.q.push({ dir: 2, btn: 0 }, { dir: 2, btn: 0 });
      }
      return null;
    }
    if (me.state === ST.AIR && me.airT > 5 && rng.chance(0.1 * P.brk * 3) && me.techWin <= 0) return this.toRaw(5, 1, me);

    // --- inside a stance: use stance attacks or leave
    if (me.stance && canAct) {
      const sm = me.ch.byCtx['st:' + me.stance] || [];
      if (sm.length && rng.chance(0.14)) { const m = this.pick(sm, me, opp, true, 0.2) || sm[rng.int(sm.length)]; if (m) return this.fire(m, me); }
      if (rng.chance(0.02)) { this.hold = { dir: 4, n: 14 }; }
      return null;
    }
    // --- rage / heat usage
    if (canAct) {
      if (me.rage && !me.rageUsed && pool.ra) {
        const close = d < 1.35;
        if ((opp.state === ST.HIT || opp.state === ST.BLK && false) && close && rng.chance(P.heat)) return this.fire(pool.ra, me);
        if (close && rng.chance(0.006 * P.heat * 4)) return this.fire(pool.ra, me);
        if (pool.rd && d < 1.6 && rng.chance(0.004 * P.heat * 4)) return this.fire(pool.rd, me);
      }
      if (me.heat.on && pool.hs && d < 1.3 && rng.chance(0.012 * P.heat)) return this.fire(pool.hs, me);
      if (me.heat.avail && !me.heat.on && pool.hb && d < 1.6 && rng.chance(0.006 * P.heat)) return this.fire(pool.hb, me);
      if (me.heat.avail && !me.heat.on && pool.he.length && rng.chance(0.03 * P.heat)) { const m = this.pick(pool.he, me, opp); if (m) return this.fire(m, me); }
    }

    // --- punish opponent's recovery
    if (canAct && opp.state === ST.ATK && opp.move && opp.mf > opp.move.st + opp.move.ac - 1) {
      const remain = (opp.recEnd ?? opp.move.total) - opp.mf;
      if (remain >= 9 && rng.chance(P.punish)) {
        const cands = [...pool.launchers, ...pool.mids, ...pool.pokes, ...pool.all].filter((m) => m.st + 1 <= remain - 1 && this.inRange(m, me, opp, 0.05));
        cands.sort((a, b) => (b.ht === 'launch' ? 25 : 0) + b.dmg - (a.ht === 'launch' ? 25 : 0) - a.dmg);
        if (cands.length) return this.fire(cands[0], me);
      }
      // whiff punish from range: dash in
      if (remain >= 16 && d > 1.8 && d < 3.2 && rng.chance(P.punish * 0.5) && pool.wr.length) {
        const w = this.pick(pool.wr, me, opp, false);
        if (w) { this.q.push(...this.frames('f,f')); this.q.push({ dir: 6, btn: 0 }, { dir: 6, btn: 0 }, { dir: 6, btn: 0 }, { dir: 6, btn: 0 }, { dir: 6, btn: 0 }, { dir: 6, btn: 0 }, { dir: 6, btn: 0 }); this.q.push(...this.frames(w.cmd).map((f) => ({ dir: 6, btn: f.btn }))); const f = this.q.shift(); return this.toRaw(f.dir, f.btn, me); }
      }
    }
    // punish after blocking / while opponent stuck in hitstun & I'm free (frame advantage)
    if (canAct && (opp.state === ST.BLK || opp.state === ST.HIT) && opp.stun > 0) {
      const adv = opp.stun;  // frames the opponent is stuck for (I am free now)
      const cands = pool.all.filter((m) => m.st + 1 <= adv && this.inRange(m, me, opp, 0.05));
      if (cands.length && rng.chance(0.4 + 0.5 * P.aggr)) {
        const lau = cands.filter((m) => m.ht === 'launch' && opp.state === ST.HIT);
        if (lau.length && rng.chance(P.juggle)) return this.fire(lau[rng.int(lau.length)], me);
        return this.fire(this.pick(cands, me, opp, false), me);
      }
    }

    // --- neutral game
    if (!canAct) return null;
    if (this.cool > 0) { this.cool--; return null; }
    // urgency: attack harder late in the round, or when behind on health
    const mt = this.match;
    const clock = mt.timeLeft < 0 ? 1 : mt.timeLeft / (mt.rules.time * 60);
    const behind = me.hp < opp.hp - 20;
    const ag = clamp(P.aggr + (clock < 0.45 ? 0.15 : 0) + (behind ? 0.1 : 0), 0, 0.95);
    this.ag = ag;
    this.cool = Math.round(2 + (1 - ag) * 18 + rng.int(8));

    const r = rng.next();
    const oppAtk = opp.state === ST.ATK;
    const oppOnGround = opp.state === ST.DOWN;
    if (oppOnGround) return null;

    // out of range: approach
    if (d > 3.6) {
      if (rng.chance(0.4)) { this.q.push(...this.frames('f,f')); return this.popQ(me); }
      this.hold = { dir: 6, n: 14 + rng.int(20) }; return null;
    }
    if (d > 2.5) {
      if (r < 0.28 && pool.wr.length) {
        const w = pool.wr[rng.int(pool.wr.length)];
        this.q.push(...this.frames('f,f'));
        for (let i = 0; i < 8; i++) this.q.push({ dir: 6, btn: 0 });
        this.q.push(...this.frames(w.cmd).map((f) => ({ dir: 6, btn: f.btn })));
        return this.popQ(me);
      }
      if (r < 0.42) { const m = this.pick(pool.longs, me, opp, true, 0.05); if (m) return this.fire(m, me); }
      if (r < 0.52) { this.q.push({ dir: 8, btn: 0 }, { dir: 8, btn: 0 }, { dir: 5, btn: 0 }); return this.popQ(me); }
      if (r < 0.62 && me.heat.avail && rng.chance(P.heat)) { this.q.push(...this.frames('f,f')); return this.popQ(me); }
      this.hold = { dir: 6, n: 8 + rng.int(14) }; return null;
    }
    if (d > 1.7) {
      // poke range
      if (r < 0.32) { const m = this.pick(pool.longs.concat(pool.mids), me, opp, true, 0.0); if (m) return this.fire(m, me); }
      if (r < 0.46) { const m = this.pick(pool.pokes, me, opp, true, 0.0); if (m) return this.fire(m, me); }
      if (r < 0.54 && pool.lows.length) { const m = this.pick(pool.lows, me, opp); if (m) return this.fire(m, me); }
      if (r < 0.62) { this.hold = { dir: 4, n: 6 + rng.int(10), guard: true }; return null; }
      if (r < 0.72 && P.sidestep > 0.1) { this.q.push({ dir: rng.chance(0.5) ? 8 : 2, btn: 0 }, { dir: 5, btn: 0 }); return this.popQ(me); }
      this.hold = { dir: 6, n: 6 + rng.int(8) }; return null;
    }
    // close range mixups
    if (r < 0.26) { const m = this.pick(pool.pokes, me, opp, true, 0.1); if (m) return this.fire(m, me); }
    if (r < 0.44) { const m = this.pick(pool.mids, me, opp, true, 0.1); if (m) return this.fire(m, me); }
    if (r < 0.56 && pool.lows.length) { const m = this.pick(pool.lows, me, opp, true, 0.1); if (m) return this.fire(m, me); }
    if (r < 0.66 && pool.throws.length) {
      const bias = 0.4 + this.prof.blockH / Math.max(1, this.prof.blockH + this.prof.blockL + 4);
      if (rng.chance(bias)) { const m = pool.throws[rng.int(pool.throws.length)]; if (this.inRange({ reach: m.grab.range - 0.3 }, me, opp, 0.1)) return this.fire(m, me); }
    }
    if (r < 0.76 && pool.launchers.length && rng.chance(0.4 + 0.3 * P.mix)) { const m = this.pick(pool.launchers, me, opp, true, 0.05); if (m) return this.fire(m, me); }
    if (r < 0.84 && pool.ws.length) { const m = this.pick(pool.ws, me, opp, true, 0.05); if (m) { this.q.push({ dir: 2, btn: 0 }, { dir: 2, btn: 0 }, { dir: 2, btn: 0 }, { dir: 2, btn: 0 }, { dir: 2, btn: 0 }, { dir: 2, btn: 0 }, { dir: 2, btn: 0 }, { dir: 5, btn: 0 }); this.pressMove(m); return this.popQ(me); } }
    if (r < 0.9 && pool.special.length) { const m = this.pick(pool.special, me, opp, true, 0.1); if (m) return this.fire(m, me); }
    if (r < 0.95 && oppAtk === false) { this.hold = { dir: 4, n: 8 + rng.int(8), guard: true }; return null; }
    if (d < 1.0) { this.q.push({ dir: 4, btn: 0 }, { dir: 5, btn: 0 }, { dir: 4, btn: 0 }, { dir: 4, btn: 0 }); return this.popQ(me); }
    return null;
  }

  popQ(me) { const f = this.q.shift(); return f ? this.toRaw(f.dir, f.btn, me) : NEUTRAL; }
}
