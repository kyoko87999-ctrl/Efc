// Hit resolution: strikes, blocks, counters, juggles, throws, power crush, parry.
import { ST } from './fighter.js';
import { THROW_BREAK_WIN, LAUNCH_MUL } from './const.js';
import { clamp, closestSegSeg } from '../util.js';

const BLOCK_STAND = new Set(['h', 'm', 'sm']);
const BLOCK_CROUCH = new Set(['l', 'h']);

function inWindow(w, f) { return w && f >= w[0] && f <= w[1]; }

function dot2(ax, az, bx, bz) { return ax * bx + az * bz; }

export function evalStrike(match, att, def) {
  if (att.state !== ST.ATK || att.hitDone || !att.move) return null;
  const m = att.move;
  if (att.mf < m.st || att.mf > m.st + m.ac - 1) return null;
  if (m.noHit) return null;
  if (def.state === ST.GRAB || def.state === ST.KO || def.state === ST.INTRO || def.state === ST.WIN || def.state === ST.LOSE) return null;
  if (m.lv === 't') return evalThrow(match, att, def);

  const cap = att.moveCapsule(m);
  const hc = def.hurtCapsule();
  if (hc.zone === 'down' && !m.gh) return null;
  if (hc.zone === 'air' && !m.ja) return null;
  if (m.lv === 'h' && hc.zone === 'crouch') return null;
  if (m.lv === 'l' && (def.state === ST.JUMP || hc.zone === 'air')) return null;
  const cl = closestSegSeg(cap.a, cap.b, hc.a, hc.b);
  const slack = hc.zone === 'down' ? 0.12 : 0;
  if (cl.d > cap.r + hc.r + slack) return null;

  // invulnerable frames on the defender's current move
  if (def.state === ST.ATK && def.move.inv) {
    for (const w of def.move.inv) if (def.mf >= w[0] && def.mf <= w[1] && (w[2] === 'all' || w[2] === m.lv || (w[2] === 'hm' && (m.lv === 'h' || m.lv === 'm' || m.lv === 'sm')))) return null;
  }
  if (def.state === ST.GETUP && def.tech && def.stT < 10) return null;

  const pos = [(cl.c1[0] + cl.c2[0]) / 2, (cl.c1[1] + cl.c2[1]) / 2, (cl.c1[2] + cl.c2[2]) / 2];
  const res = { att, def, m, pos, kind: 'hit', counter: false, punish: false };

  // parry
  if (def.state === ST.ATK && def.move.pry && inWindow(def.move.pry.w, def.mf) && def.move.pry.lv.includes(m.lv)) { res.kind = 'parry'; return res; }
  // power crush
  if (def.state === ST.ATK && def.move.pc && inWindow(def.move.pc, def.mf) && (m.lv === 'h' || m.lv === 'm' || m.lv === 'sm')) { res.kind = 'pc'; return res; }

  // guard
  const toAttX = att.x - def.x, toAttZ = att.z - def.z;
  const frontal = dot2(def.fx, def.fz, toAttX, toAttZ) > -0.05 * Math.hypot(toAttX, toAttZ);
  if (def.guard && frontal && !m.unbl && def.state !== ST.ATK) {
    const ok = def.guard === 'stand' ? BLOCK_STAND.has(m.lv) : BLOCK_CROUCH.has(m.lv);
    if (ok) { res.kind = 'block'; return res; }
  }
  if (def.state === ST.ATK) {
    const dm = def.move;
    const active = def.mf <= dm.st + dm.ac - 1;
    if (active) res.counter = true; else res.punish = true;
  } else if (def.state === ST.DASHF && def.stT < 12) res.counter = true;
  return res;
}

function evalThrow(match, att, def) {
  const m = att.move, g = m.grab;
  if (!g) return null;
  const dx = def.x - att.x, dz = def.z - att.z;
  const d = Math.hypot(dx, dz);
  if (d > g.range * att.sc + 0.2 * def.sc) return null;
  if (d > 0.01 && dot2(att.lockF.x, att.lockF.z, dx / d, dz / d) < 0.55) return null;
  if (Math.abs(def.y - att.y) > 0.5) return null;
  let ok = false;
  switch (def.state) {
    case ST.IDLE: case ST.LAND: case ST.SS: case ST.DASHB: case ST.DASHF: case ST.RUN: case ST.CD: ok = true; break;
    case ST.ATK: ok = def.mf < def.move.st || def.move.lv === 't'; break;
    default: ok = false;
  }
  if (!ok) return null;
  if (def.zone() === 'crouch' && !g.low) return null;
  const res = { att, def, m, kind: 'throw', pos: [def.x, def.y + 1.1 * def.sc, def.z] };
  if (def.state === ST.ATK && def.move.lv === 't') res.kind = 'clash';
  return res;
}

function hitstopFor(m, dmg, counter) {
  if (m.hs !== null && m.hs !== undefined) return m.hs + (counter ? 2 : 0);
  return (dmg >= 25 ? 13 : dmg >= 15 ? 10 : dmg >= 8 ? 8 : 6) + (counter ? 2 : 0);
}

export function resolveCombat(match) {
  if (match.roundOverFlag && match.phase !== 'fight') return;
  const [a, b] = match.fighters;
  const ra = evalStrike(match, a, b);
  const rb = evalStrike(match, b, a);
  // strikes beat throws on the same frame
  if (ra && rb && ra.kind === 'throw' && rb.kind !== 'throw' && rb.kind !== 'clash') { apply(match, rb); return; }
  if (ra && rb && rb.kind === 'throw' && ra.kind !== 'throw' && ra.kind !== 'clash') { apply(match, ra); return; }
  if (ra) apply(match, ra);
  if (rb) apply(match, rb);
}

function apply(match, r) {
  switch (r.kind) {
    case 'hit': return applyHit(match, r);
    case 'block': return applyBlock(match, r);
    case 'pc': return applyPowerCrush(match, r);
    case 'parry': return applyParry(match, r);
    case 'throw': return applyThrow(match, r);
    case 'clash': return applyClash(match, r);
    default:
  }
}

function awayVec(att) {
  return { x: att.lockF.x, z: att.lockF.z };
}

const LAUNCH_REC = 0.35;   // share of the remaining recovery that is left after a launcher connects
const JUGGLE_REC = 0.45;   // ... after a hit on an airborne opponent

function comboScale(n) {
  if (n <= 1) return 1;
  return Math.max(0.45, 1 - 0.075 * (n - 1));
}

export function applyHit(match, r) {
  const { att, def, m, pos } = r;
  const rules = match.rules;
  att.hitDone = true; att.contact = 'hit';
  att.lastWsDmg = m.wsDmg ?? 0; att.lastWb = !!m.wb;
  const inCombo = def.state === ST.HIT || def.state === ST.AIR || def.state === ST.WALL;
  if (!inCombo) def.endCombo();
  const counter = r.counter && !inCombo;
  let ht = m.ht;
  if (counter && m.cht) ht = m.cht;
  // damage
  let dmg = counter ? m.dmg * (m.chDmg ?? 1.2) : m.dmg;
  if (att.rage) dmg *= 1.15;
  if (att.heat.on && m.heatDmg) dmg *= m.heatDmg;
  dmg *= comboScale(def.comboHits + 1);
  dmg = Math.max(1, Math.round(dmg * (rules.dmgMul ?? 1)));
  if (m.gh && def.zone() === 'down') dmg = Math.max(1, Math.round(dmg * 0.8));
  applyDamage(match, def, att, dmg, false);
  def.comboHits++; def.comboDmg += dmg;
  att.comboOut.hits = def.comboHits; att.comboOut.dmg = def.comboDmg; att.comboOut.t = 100;
  att.stats.maxCombo = Math.max(att.stats.maxCombo, def.comboHits);
  att.stats.hits++;
  if (counter) att.stats.counters++;
  if (r.punish) att.stats.punishes++;
  // meter
  if (rules.recoverable) {
    def.addRec(dmg * 0.4);
    if (att.rec > 0) { const g = Math.min(att.rec, dmg * 0.6); att.rec -= g; att.hp = Math.min(att.maxHp, att.hp + g); }
  }
  // hitstop
  const hs = hitstopFor(m, dmg, counter);
  match.hitstop = Math.max(match.hitstop, hs);
  att.flash = 0;

  const away = awayVec(att);
  const heavy = dmg >= 15 || ht === 'launch';
  const stunNormal = counter ? m.chStun : m.hitStun;
  const hk = { lv: m.lv, side: m.side, heavy, ws: m.ws, counter, fx: att.fx, fz: att.fz };
  const wasAir = def.state === ST.AIR || def.state === ST.WALL;

  if (def.hp <= 0) {
    match.koHit(def, att, m, away, hs);
  } else if (wasAir) {
    juggleHit(match, def, att, m, ht, away);
    att.cutRecovery(JUGGLE_REC);
  } else {
    switch (ht) {
      case 'launch': case 'tornado': case 'screw': {
        const vy = (m.lvy ?? (ht === 'launch' ? 0.165 : 0.145)) * LAUNCH_MUL;
        const vp = m.lvp ?? 0.012;
        def.enterAir(vy, { x: away.x * vp, z: away.z * vp }, { kind: ht === 'launch' ? 'launch' : ht, spin: ht === 'screw' ? 1 : 0, noTech: !!m.noTech });
        def.air.ws = m.ws; def.gm = 1;
        att.cutRecovery(LAUNCH_REC);
        break;
      }
      case 'kd': {
        def.enterAir(m.lvy ?? 0.07, { x: away.x * (m.lvp ?? 0.05), z: away.z * (m.lvp ?? 0.05) }, { kind: 'kd', faceUp: !m.faceDown, noTech: !!m.noTech });
        def.air.ws = m.ws;
        break;
      }
      case 'bound': {
        def.enterAir(0.1, { x: away.x * 0.03, z: away.z * 0.03 }, { kind: 'bound', bound: true, noTech: true });
        def.vy = 0.02;
        break;
      }
      case 'crumple':
        def.enterHit('crumple', Math.max(stunNormal, 30), hk);
        def.vx = away.x * m.pushV; def.vz = away.z * m.pushV;
        break;
      default:
        def.enterHit(ht === 'stag' ? 'stag' : 'n', stunNormal, hk);
        def.vx = away.x * m.pushV; def.vz = away.z * m.pushV;
        if (m.ws) wallCarry(match, def, away, m.pushV);
    }
  }
  if (m.he && att.heat.avail && !att.heat.on && rules.heat) { /* handled by tickAtk via contact */ }

  const kind = dmg >= 18 ? 'heavy' : dmg >= 9 ? 'med' : 'light';
  match.emit({ t: 'hit', pos, kind, counter, punish: r.punish, lv: m.lv, dmg, att: att.idx, def: def.idx, sfx: m.sfx, launch: ht === 'launch' || ht === 'tornado' || ht === 'screw' });
  if (counter) match.emit({ t: 'text', who: att.idx, text: 'counter' });
  else if (r.punish) match.emit({ t: 'text', who: att.idx, text: 'punish' });
  if (m.gh && r.pos) { /* ground hit fx handled by the renderer */ }
  match.shake(heavy ? 0.5 : 0.2);
  if (m.grab && m.grab.mode === 'onhit' && def.hp > 0) beginCapture(match, att, def, m);
  match.measureContact(att, def, 'hit');
}

function wallCarry(match, def, away, v0) {
  const d = match.distToWall(def, away);
  if (d !== null && d < 2.6) {
    const need = (d + 0.2) * 0.185;
    def.vx = away.x * Math.max(v0, need); def.vz = away.z * Math.max(v0, need);
  }
}

function juggleHit(match, def, att, m, ht, away) {
  const wasWall = def.state === ST.WALL;
  def.airHits++;
  const n = def.airHits;
  let vy = m.jvy ?? Math.max(0.05, 0.105 - 0.007 * n);
  let vp = m.jp ?? 0.022;
  let kind = def.air ? def.air.kind : 'launch';
  const ws = m.ws;
  if (wasWall) { vy = m.wvy ?? 0.12; vp = m.jp ?? 0.04; def.usedWall = true; def.enterAir(vy, { x: away.x * vp, z: away.z * vp }, { kind: 'launch' }); def.gm = 1 + 0.06 * n; def.air.ws = false; return; }
  if (n >= 9) { vy = Math.min(vy, -0.02); }
  const a = def.air || {};
  if (ht === 'launch') vy = (m.lvy ?? Math.max(0.09, 0.14 - 0.012 * n)) * (m.lvy ? LAUNCH_MUL : 1);
  if (ht === 'tornado' || ht === 'screw') {
    if (!def.usedScrew) { vy = (m.lvy ?? 0.15) * LAUNCH_MUL; def.usedScrew = true; kind = ht; vp = m.lvp ?? 0.01; }
    else vy = 0.06;
  }
  let bound = false;
  if (ht === 'bound' && !def.usedBound) { bound = true; vy = -0.14; vp = 0.03; }
  // a hit on a target that is already high only nudges it, so it comes back down within reach for the next hit
  if (m.jvy === undefined && ht !== 'launch' && ht !== 'tornado' && ht !== 'screw' && !bound && vy > 0) vy *= Math.max(0.25, Math.min(1, 1 - (def.y - 0.9) / 1.3));
  def.vy = vy; def.vx = away.x * vp; def.vz = away.z * vp;
  def.gm = 1 + 0.06 * n;
  def.stT = 0;
  if (def.air) {
    def.air.kind = kind; def.air.bound = bound || def.air.bound; def.air.ws = ws; def.air.noTech = def.air.noTech || bound || !!m.noTech;
    def.air.bounced = false;
    if (bound) def.faceUp = false;
  }
  if (ws && !def.usedWall) { const d = match.distToWall(def, away); if (d !== null && d < 2.4) { def.vx = away.x * Math.max(vp, (d + 0.2) * 0.02); def.vz = away.z * Math.max(vp, (d + 0.2) * 0.02); } }
}

export function applyDamage(match, def, att, dmg, chip) {
  if (match.rules.infHp) { def.hp = Math.max(def.hp - dmg, 1); att.stats.dmg += dmg; return; }
  def.hp -= dmg;
  if (chip && def.hp < 1) def.hp = 1;
  if (def.hp < 0) def.hp = 0;
  att.stats.dmg += dmg;
}

function applyBlock(match, r) {
  const { att, def, m, pos } = r;
  att.hitDone = true; att.contact = 'block';
  const crouch = def.guard === 'crouch';
  const away = awayVec(att);
  def.enterBlock(m.blkStun, crouch, m.lv);
  def.vx = away.x * m.pushBV; def.vz = away.z * m.pushBV;
  att.vx = -away.x * m.pushBV * 0.35; att.vz = -away.z * m.pushBV * 0.35;
  let chip = 0;
  if (att.heat.on || m.chip) { chip = m.chip ?? Math.max(1, Math.round(m.dmg * 0.18)); applyDamage(match, def, att, chip, true); }
  const hs = Math.max(4, hitstopFor(m, m.dmg, false) - 3);
  match.hitstop = Math.max(match.hitstop, hs);
  if (match.rules.recoverable && att.rec > 0) { const g = Math.min(att.rec, 1.5); att.rec -= g; att.hp += g; }
  match.emit({ t: 'block', pos, att: att.idx, def: def.idx, lv: m.lv, chip, kind: m.dmg >= 15 ? 'heavy' : 'light' });
  match.shake(0.08);
  match.measureContact(att, def, 'block');
}

function applyPowerCrush(match, r) {
  const { att, def, m, pos } = r;
  att.hitDone = true; att.contact = 'hit';
  const dmg = Math.max(1, Math.round(m.dmg * 0.8));
  applyDamage(match, def, att, dmg, false);
  def.addRec(dmg * 0.4);
  match.hitstop = Math.max(match.hitstop, 5);
  match.emit({ t: 'hit', pos, kind: 'med', counter: false, punish: false, lv: m.lv, dmg, att: att.idx, def: def.idx, pcrush: true });
  match.emit({ t: 'text', who: def.idx, text: 'powercrush' });
  if (def.hp <= 0) match.koHit(def, att, m, awayVec(att), 8);
}

function applyParry(match, r) {
  const { att, def, m, pos } = r;
  att.hitDone = true; att.contact = 'block';
  const to = def.move.pry.to;
  att.enterHit('parried', 30, { lv: m.lv, side: m.side, heavy: false });
  const away = awayVec(att);
  att.vx = -away.x * 0.03; att.vz = -away.z * 0.03;
  match.hitstop = Math.max(match.hitstop, 10);
  match.emit({ t: 'parry', pos, att: att.idx, def: def.idx });
  match.emit({ t: 'text', who: def.idx, text: 'parry' });
  if (to) { def.startMove(def.ch.moveMap.get(to)); def.contact = null; }
}

function applyThrow(match, r) {
  const { att, def, m } = r;
  att.hitDone = true; att.contact = 'hit';
  att.stats.throws++;
  att.grabbing = def;
  def.grabBy = att; def.capT = 0;
  def.state = ST.GRAB; def.stT = 0;
  def.move = null; def.mf = 0; def.chainQ = null; def.aerial = false; def.stance = null; def.crouch = false;
  def.vx = 0; def.vz = 0;
  att.grabF = att.mf;
  match.hitstop = Math.max(match.hitstop, 4);
  match.emit({ t: 'grab', att: att.idx, def: def.idx, pos: r.pos });
  match.measureContact(att, def, 'hit');
}

function applyClash(match, r) {
  const { att, def } = r;
  att.hitDone = true;
  breakThrow(match, att, def, true);
}

export function beginCapture(match, att, def, m) {
  att.grabbing = def;
  def.grabBy = att; def.capT = 0;
  def.state = ST.GRAB; def.stT = 0;
  def.move = null; def.mf = 0; def.chainQ = null; def.aerial = false; def.stance = null; def.crouch = false;
  def.vx = 0; def.vz = 0; def.vy = 0; def.y = Math.max(0, def.y);
  att.grabF = att.mf;
  match.emit({ t: 'capture', att: att.idx, def: def.idx, cine: m.cine });
}

export function breakThrow(match, att, def, clash = false) {
  att.grabbing = null;
  def.grabBy = null;
  const away = { x: att.lockF.x, z: att.lockF.z };
  def.enterHit('brk', 22, { lv: 'm', side: 'f', heavy: false, face: false });
  att.enterHit('brk', 22, { lv: 'm', side: 'f', heavy: false, face: false });
  def.vx = away.x * 0.05; def.vz = away.z * 0.05;
  att.vx = -away.x * 0.05; att.vz = -away.z * 0.05;
  match.hitstop = Math.max(match.hitstop, 6);
  match.emit({ t: 'break', att: att.idx, def: def.idx, pos: [(att.x + def.x) / 2, 1.2, (att.z + def.z) / 2] });
  match.emit({ t: 'text', who: def.idx, text: 'break' });
}

export function checkThrowBreak(match, def) {
  const att = def.grabBy;
  if (!att || !att.move || !att.move.grab) return false;
  const g = att.move.grab;
  if (!g.brk || g.mode === 'onhit') return false;
  const mask = g.brk === '1' ? 1 : g.brk === '2' ? 2 : 3;
  if (def.capT >= 1 && def.capT <= THROW_BREAK_WIN && (def.pressed & mask)) {
    breakThrow(match, att, def);
    return true;
  }
  return false;
}
