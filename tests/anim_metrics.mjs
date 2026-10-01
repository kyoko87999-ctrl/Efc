// Animation quality metrics (headless, no WebGL).  node tests/anim_metrics.mjs [--json out.json] [--quick]
//
//  footSlip     metres a grounded foot point slides per second of ground contact (walk / run / idle / sidestep ...)
//  reach        distance between the intended strike point (sim data) and where the limb really is (all moves)
//  pops         angular jump (deg) of the biggest joint on the frame an animation state changes, vs. the usual per-frame motion
//  jerk         99th percentile angular acceleration of the main joints (deg / frame^2) during real AI fights
//  headAim      mean error (deg) between the head's facing and the opponent during neutral play
//  life         RMS motion of chest + head while standing still (is the character alive?)
import * as THREE from 'three';
import { writeFileSync } from 'node:fs';
import { CHARS } from '../src/data/roster.js';
import { compileChar, limbAt } from '../src/sim/move.js';
import { Match } from '../src/sim/match.js';
import { CpuBrain } from '../src/sim/ai.js';
import { ST } from '../src/sim/fighter.js';
import { STAGES } from '../src/render/stagesData.js';
import { Puppet } from '../src/render/puppet.js';
import { NEUTRAL, inp } from './helpers.mjs';

const args = process.argv.slice(2);
const QUICK = args.includes('--quick');
const SHOW_POPS = args.includes('--pops');
const popLog = [];
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const COMPILED = new Map(CHARS.map((c) => [c.id, compileChar(c)]));
const V = THREE.Vector3;
const GRID = STAGES.find((s) => s.id === 'grid');

// ------------------------------------------------------------------ harness
function arena(a, b, { dist = 2.7, rules = {} } = {}) {
  const m = new Match({ chars: [COMPILED.get(a), COMPILED.get(b)], stage: GRID, rules: { time: 0, rounds: 5, infHp: true, ...rules }, seed: 11 });
  while (m.phase === 'intro') m.step([NEUTRAL, NEUTRAL]);
  m.fighters[0].x = -dist / 2; m.fighters[1].x = dist / 2; m.fighters[0].px = m.fighters[0].x; m.fighters[1].px = m.fighters[1].x;
  m.updateAxis();
  const pup = m.fighters.map((f, i) => new Puppet(f, COMPILED.get(i ? b : a), null));
  const ctx = { m, pup, t: 0, frame: 0 };
  ctx.step = (i0 = NEUTRAL, i1 = NEUTRAL) => {
    m.step([i0, i1]);
    ctx.frame++; ctx.t = ctx.frame / 60;
    const freeze = m.hitstop > 0;
    pup.forEach((p) => p.update(freeze ? 0 : 1, ctx.t, freeze ? 0 : 1, freeze));
    pup.forEach((p) => p.rig.root.updateMatrixWorld(true));
    return freeze;
  };
  // settle: a few frames so the pose / inertia state is initialised
  for (let i = 0; i < 20; i++) ctx.step();
  return ctx;
}

const tmp = new V(), tmp2 = new V();
const FOOT_PTS = [[0, -0.065, -0.06], [0, -0.065, 0.17]];      // heel / ball in ankle-local space (legacy foot geometry)
function footPoints(p, side) {
  const rig = p.rig;
  const j2 = rig.limbs[side === 0 ? 'fL' : 'fR'].j2;
  const pts = (rig.footPoints ? rig.footPoints(side) : FOOT_PTS).slice(0, 2);
  return pts.map((q) => j2.localToWorld(tmp.set(q[0], q[1], q[2])).toArray());
}
const anchor = (p, name) => p.rig.anchorWorld(name, new V()).toArray();
const dxz = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

// ------------------------------------------------------------------ footSlip
function slipScenario(name, script, who = 0) {
  const c = arena('kenzo', 'tawan', { dist: 5 });
  // a sample point counts as "on the floor" when it is within 1.5 cm of its height while standing still (rig independent)
  const rest = [0, 1].map((s) => footPoints(c.pup[who], s).map((p) => p[1]));
  let prev = null, slip = 0, contactFrames = 0, maxStep = 0, frames = 0;
  for (const [n, i0] of script) {
    for (let k = 0; k < n; k++) {
      c.step(i0 ? inp(i0) : NEUTRAL, NEUTRAL);
      frames++;
      const cur = [0, 1].map((s) => footPoints(c.pup[who], s));
      if (prev) {
        for (let s = 0; s < 2; s++) for (let q = 0; q < cur[s].length; q++) {
          const lim = rest[s][q] + 0.015;
          if (cur[s][q][1] < lim && prev[s][q][1] < lim) { const d = dxz(cur[s][q], prev[s][q]); slip += d; contactFrames++; if (d > maxStep) maxStep = d; }
        }
      }
      prev = cur;
    }
  }
  // m per second of contact (60 fps) - lower is better
  return { name, slipPerSec: contactFrames ? slip / contactFrames * 60 : 0, maxStepCm: maxStep * 100, frames };
}

function footSlipAll() {
  const out = [];
  out.push(slipScenario('idle', [[180, null]]));
  out.push(slipScenario('walk fwd', [[30, null], [150, { r: true }]]));
  out.push(slipScenario('walk back', [[30, null], [150, { l: true }]]));
  out.push(slipScenario('sidewalk', [[30, null], [10, { u: true }], [150, { u: true }]]));
  out.push(slipScenario('run', [[30, null], [2, { r: true }], [2, null], [150, { r: true }]]));
  out.push(slipScenario('crouch', [[30, null], [60, { d: true }]]));
  return out;
}

// ------------------------------------------------------------------ reach (strike contact accuracy)
const LIMB_ANCHOR = { hL: 'hL', hR: 'hR', fL: 'fL', fR: 'fR', kL: 'kL', kR: 'kR', eL: 'eL', eR: 'eR', sh: 'chest', hd: 'head' };
function worldOfLocal(p, v) {
  // v = [side(+right), up, fwd] -> mesh space (+X = left)
  return p.rig.root.localToWorld(tmp2.set(-v[0], v[1], v[2])).toArray();
}

// Drive a move through the sim with the AI's input macros and sample the limb every active frame.
function reachMove(def, mv) {
  const c = arena(def.id, def.id === 'bruno' ? 'kenzo' : 'bruno', { dist: 6 });
  const a = c.m.fighters[0];
  if (mv.req === 'rage') { a.hp = 30; a.rage = true; a.rageUsed = false; }
  if (mv.req === 'heat') { a.heat.on = true; a.heat.t = 600; a.heat.avail = false; }
  const brain = new CpuBrain(0, 5, 1);
  brain.pool = brain.buildPool(a) || brain.pool;
  const seq = [];
  if (mv.ctx && mv.ctx.startsWith('st:')) { const e = COMPILED.get(def.id).moveList.find((x) => x.toStance === mv.ctx.slice(3)); if (e) seq.push(e); }
  seq.push(mv);
  let idx = 0, active = null;
  const errs = [], firstErr = [];
  for (let f = 0; f < 480; f++) {
    let raw = NEUTRAL;
    if (a.state === ST.IDLE && a.lock <= 0 && brain.q.length === 0 && idx < seq.length) { brain.pressMove(seq[idx]); idx++; }
    if (brain.q.length) { const q = brain.q.shift(); raw = brain.toRaw(q.dir, q.btn, a); }
    c.step(raw, NEUTRAL);
    if (a.state === ST.ATK && a.move && a.move.id === mv.id && !mv.grab && !mv.noHit) {
      const m = a.move, mf = a.mf;
      const last = m.st + m.ac - 1;
      if (mf >= m.st && mf <= last && LIMB_ANCHOR[m.limb]) {
        const want = worldOfLocal(c.pup[0], limbAt(m, mf, COMPILED.get(def.id).rest[m.limb] || COMPILED.get(def.id).rest.hR));
        const got = anchor(c.pup[0], LIMB_ANCHOR[m.limb]);
        const e = Math.hypot(want[0] - got[0], want[1] - got[1], want[2] - got[2]) / (a.sc || 1);
        errs.push(e);
        if (mf === m.st) firstErr.push(e);
      }
      active = m;
    }
    if (active && a.state !== ST.ATK && a.state !== ST.IDLE) break;
    if (idx >= seq.length && a.state === ST.IDLE && a.lock <= 0 && brain.q.length === 0 && f > 30 && active) break;
  }
  if (!errs.length) return null;
  return { id: mv.id, first: firstErr[0] ?? errs[0], mean: errs.reduce((s, x) => s + x, 0) / errs.length, max: Math.max(...errs) };
}

function reachAll(ids) {
  const rows = [];
  for (const id of ids) {
    const def = COMPILED.get(id);
    for (const mv of def.moveList) {
      if (!mv.cmd || mv.ctx === 'dn' || mv.grab || mv.noHit || Math.max(mv.P[2], (mv.Q || mv.P)[2]) > 1.6) continue;   // projectiles (beam / rocket) are not meant to be reached by the body
      if (QUICK && rows.length % 3) { rows.push(null); continue; }
      let r = null;
      try { r = reachMove(def, mv); } catch (e) { r = null; }
      if (r) { r.char = id; rows.push(r); } else rows.push(null);
    }
  }
  return rows.filter(Boolean);
}

// ------------------------------------------------------------------ pops / jerk / head aim / life over AI fights
const KEY_JOINTS = (rig) => [rig.body, rig.spine, rig.chest, rig.head, rig.limbs.hL.j0, rig.limbs.hR.j0, rig.limbs.hL.j1, rig.limbs.hR.j1, rig.limbs.fL.j0, rig.limbs.fR.j0, rig.limbs.fL.j1, rig.limbs.fR.j1];
const _q = new THREE.Quaternion();
function jointWorldQuats(rig) { return KEY_JOINTS(rig).map((j) => j.getWorldQuaternion(new THREE.Quaternion())); }
const angBetween = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a.dot(b)))) * 180 / Math.PI;

function fightMetrics(games, frames) {
  const pops = [], pre = [], steady = [], jerks = [], headErr = [];
  for (let g = 0; g < games; g++) {
    const A = CHARS[g % CHARS.length].id, B = CHARS[(g * 3 + 1) % CHARS.length].id;
    const c = arena(A, B, { dist: 2.7, rules: { time: 0 } });
    const brains = [new CpuBrain(0, 3, g + 1), new CpuBrain(1, 3, g + 7)];
    const prevQ = [null, null], prevD = [null, null], prevKey = ['', ''], jarg = [0, 0], jhist = [[], []], snap = [[], []];
    const hist = [[], []];            // per fighter: per-frame max joint delta
    const pending = [[], []];         // transitions waiting for their 3-frame look-ahead
    for (let f = 0; f < frames; f++) {
      const raws = brains.map((b) => b.think(c.m));
      const frozen = c.step(raws[0], raws[1]);
      if (frozen) continue;
      for (let i = 0; i < 2; i++) {
        const p = c.pup[i];
        const qs = jointWorldQuats(p.rig);
        const key = p.anim.key;
        let dmax = 0;
        if (prevQ[i]) {
          const d = qs.map((q, k) => angBetween(q, prevQ[i][k]));
          dmax = Math.max(...d); jarg[i] = d.indexOf(dmax);
          if (prevD[i]) { const acc = d.map((x, k) => Math.abs(x - prevD[i][k])); jerks.push(Math.max(...acc)); }
          prevD[i] = d;
        }
        hist[i].push(dmax); jhist[i].push(jarg[i]);
        if (SHOW_POPS) { const P = p.anim.P, fx = (a) => a.map((x) => x.toFixed(2)).join(','); (snap[i] = snap[i] || []).push(`${hist[i].length} ${key} hL ${fx(P.hL)} r ${fx(P._r.hL)} pole ${fx(P.elbowPole)}/${fx(P.elbowPoleS)} ${P.strikeArm} hips ${fx(P.hips)} rot ${fx(P.hipsRot)} sp ${fx(P.spine)} ch ${fx(P.chest)} shL ${fx(P.shL)} d ${dmax.toFixed(0)}`); }
        const n = hist[i].length;
        if (prevQ[i] && key !== prevKey[i] && n > 8) { pending[i].push(n); pending[i].info = pending[i].info || []; pending[i].info.push(prevKey[i] + ' -> ' + key); }        // transition frame index
        prevQ[i] = qs; prevKey[i] = key;
        // resolve transitions whose next 3 frames are known
        while (pending[i].length && n >= pending[i][0] + 3) {
          const t = pending[i].shift();
          const post = Math.max(...hist[i].slice(t - 1, t + 3));                 // the transition frame and the next three
          const before = Math.max(...hist[i].slice(t - 5, t - 1));
          pops.push(post); pre.push(before);
          if (SHOW_POPS) { const w = hist[i].slice(t - 1, t + 3); const jj = jhist[i][t - 1 + w.indexOf(Math.max(...w))]; if (post - before > 150) console.log('POP ' + (post - before).toFixed(0) + '\n' + snap[i].slice(t - 1, t + 4).join('\n')); popLog.push({ post, before, tr: pending[i].info.shift() + ' joint=' + ['body', 'spine', 'chest', 'head', 'hL.j0', 'hR.j0', 'hL.j1', 'hR.j1', 'fL.j0', 'fR.j0', 'fL.j1', 'fR.j1'][jj] + ' f=' + t }); }
        }
        if (n > 8 && !pending[i].length) steady.push(dmax);
        // head aim in neutral states
        const fi = c.m.fighters[i];
        if (fi.state === ST.IDLE || fi.state === ST.BLK) {
          const hp = p.rig.anchorWorld('head', new V()), op = c.pup[1 - i].rig.anchorWorld('head', new V());
          const dir = op.clone().sub(hp).setY(0).normalize();
          const fwd = new V(0, 0, 1).applyQuaternion(p.rig.head.getWorldQuaternion(new THREE.Quaternion())); fwd.y = 0; fwd.normalize();
          headErr.push(Math.acos(Math.max(-1, Math.min(1, fwd.dot(dir)))) * 180 / Math.PI);
        }
      }
    }
  }
  const pct = (arr, p) => { const s = arr.slice().sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0; };
  const mean = (arr) => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0;
  const excess = pops.map((p, i) => Math.max(0, p - pre[i]));
  return {
    transitions: pops.length,
    popPostMean: mean(pops), popPostP90: pct(pops, 0.9),
    popExcessMean: mean(excess), popExcessP90: pct(excess, 0.9),
    steadyMean: mean(steady),
    jerkP99: pct(jerks, 0.99), jerkMean: mean(jerks),
    headAimDeg: mean(headErr),
  };
}

function lifeMetric() {
  const c = arena('kenzo', 'tawan', { dist: 3 });
  const chest = [], head = [];
  for (let f = 0; f < 240; f++) {
    c.step(NEUTRAL, NEUTRAL);
    chest.push(anchor(c.pup[0], 'chest')); head.push(c.pup[0].rig.head.getWorldQuaternion(new THREE.Quaternion()));
  }
  const rms = (pts) => { const m = [0, 1, 2].map((k) => pts.reduce((s, p) => s + p[k], 0) / pts.length); return Math.sqrt(pts.reduce((s, p) => s + [0, 1, 2].reduce((t, k) => t + (p[k] - m[k]) ** 2, 0), 0) / pts.length); };
  let hq = 0; for (let i = 1; i < head.length; i++) hq += angBetween(head[i], head[i - 1]);
  return { chestRmsCm: rms(chest) * 100, headTurnDegPerSec: hq / head.length * 60 };
}

// ------------------------------------------------------------------ run
const t0 = Date.now();
const result = {};
result.footSlip = footSlipAll();
result.life = lifeMetric();
result.fights = fightMetrics(QUICK ? 4 : 10, QUICK ? 900 : 1500);
const reachIds = QUICK ? ['kenzo', 'tawan'] : CHARS.map((c) => c.id);
const rows = reachAll(reachIds);
const pct = (arr, p) => { const s = arr.slice().sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0; };
const mean = (arr) => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0;
result.reach = {
  moves: rows.length,
  firstFrameMeanCm: mean(rows.map((r) => r.first)) * 100, firstFrameP90Cm: pct(rows.map((r) => r.first), 0.9) * 100, firstFrameMaxCm: Math.max(...rows.map((r) => r.first)) * 100,
  activeMeanCm: mean(rows.map((r) => r.mean)) * 100, activeMaxCm: Math.max(...rows.map((r) => r.max)) * 100,
  over5cm: rows.filter((r) => r.first > 0.05).length, over15cm: rows.filter((r) => r.first > 0.15).length,
  worst: rows.slice().sort((a, b) => b.first - a.first).slice(0, 8).map((r) => `${r.char}:${r.id} ${(r.first * 100).toFixed(0)}cm`),
};

const f2 = (x) => x.toFixed(2);
console.log('\n=== foot slip (m of sliding per second of ground contact; lower is better) ===');
for (const r of result.footSlip) console.log(r.name.padEnd(10), 'slip', f2(r.slipPerSec).padStart(6), 'm/s   worst single-frame step', f2(r.maxStepCm).padStart(6), 'cm');
console.log('\n=== life while standing ===');
console.log('chest RMS motion', f2(result.life.chestRmsCm), 'cm   head turn', f2(result.life.headTurnDegPerSec), 'deg/s');
console.log('\n=== AI fights (', QUICK ? 4 : 10, 'matches ) ===');
console.log(JSON.stringify(Object.fromEntries(Object.entries(result.fights).map(([k, v]) => [k, +v.toFixed(3)]))));
if (SHOW_POPS) { const rows = popLog.map((p) => ({ ...p, ex: p.post - p.before })).sort((a, b) => b.ex - a.ex).slice(0, 25); console.log('\n=== worst pops ===\n' + rows.map((r) => `${r.ex.toFixed(0).padStart(4)}  (${r.before.toFixed(0)} -> ${r.post.toFixed(0)})  ${r.tr}`).join('\n')); }
console.log('\n=== strike reach: intended strike point vs where the limb really is ===');
console.log(JSON.stringify(Object.fromEntries(Object.entries(result.reach).map(([k, v]) => [k, typeof v === 'number' ? +v.toFixed(2) : v]))));
console.log(`\nelapsed ${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(result, null, 2));
