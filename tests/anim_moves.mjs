// Animation sweep over EVERY move of every fighter (throws and rage arts included, the opponent stands in range):
// the pose must stay finite, joints must not leave the arena or sink far below the floor.   node tests/anim_moves.mjs [char]
import * as THREE from 'three';
import { CHARS } from '../src/data/roster.js';
import { compileChar } from '../src/sim/move.js';
import { Match } from '../src/sim/match.js';
import { CpuBrain } from '../src/sim/ai.js';
import { ST } from '../src/sim/fighter.js';
import { STAGES } from '../src/render/stagesData.js';
import { Puppet } from '../src/render/puppet.js';
import { NEUTRAL } from './helpers.mjs';

const only = process.argv[2];
const COMPILED = new Map(CHARS.map((c) => [c.id, compileChar(c)]));
const GRID = STAGES.find((s) => s.id === 'grid');
const V = THREE.Vector3;
let moves = 0, frames = 0;
const problems = [];

for (const ch of CHARS) {
  if (only && ch.id !== only) continue;
  const def = COMPILED.get(ch.id);
  const foeId = ch.id === 'bruno' ? 'kenzo' : 'bruno';
  for (const mv of def.moveList) {
    if (!mv.cmd && mv.ctx === 'chain') continue;
    const m = new Match({ chars: [def, COMPILED.get(foeId)], stage: GRID, rules: { time: 0, rounds: 5, infHp: true }, seed: 7 });
    while (m.phase === 'intro') m.step([NEUTRAL, NEUTRAL]);
    const a = m.fighters[0], b = m.fighters[1];
    a.x = -0.55; a.px = -0.55; b.x = 0.65; b.px = 0.65; m.updateAxis();
    if (mv.req === 'rage') { a.hp = 30; a.rage = true; a.rageUsed = false; }
    if (mv.req === 'heat') { a.heat.on = true; a.heat.t = 600; a.heat.avail = false; }
    const pup = [new Puppet(a, def, null), new Puppet(b, COMPILED.get(foeId), null)];
    const brain = new CpuBrain(0, 5, 1); brain.pool = brain.buildPool(a) || brain.pool;
    const seq = [];
    if (mv.ctx && mv.ctx.startsWith('st:')) { const e = def.moveList.find((x) => x.toStance === mv.ctx.slice(3)); if (e) seq.push(e); }
    seq.push(mv);
    let idx = 0, t = 0, started = false, bad = null;
    moves++;
    for (let f = 0; f < 320 && !bad; f++) {
      let raw = NEUTRAL;
      if (a.state === ST.IDLE && a.lock <= 0 && brain.q.length === 0 && idx < seq.length) { brain.pressMove(seq[idx]); idx++; }
      if (brain.q.length) { const q = brain.q.shift(); raw = brain.toRaw(q.dir, q.btn, a); }
      m.step([raw, NEUTRAL]); t++;
      const freeze = m.hitstop > 0;
      for (const p of pup) p.update(freeze ? 0 : 1, t / 60, freeze ? 0 : 1, freeze);
      for (const p of pup) p.rig.root.updateMatrixWorld(true);
      if (a.state === ST.ATK && a.move && a.move.id === mv.id) started = true;
      if (started && a.state === ST.IDLE && a.lock <= 0 && idx >= seq.length && f > 20) break;
      for (let i = 0; i < 2 && !bad; i++) {
        const fi = m.fighters[i], p = pup[i];
        frames++;
        const pts = [];
        for (const k of ['hL', 'hR', 'fL', 'fR']) { const L = p.rig.limbs[k]; pts.push(L.j0.getWorldPosition(new V()), L.j1.getWorldPosition(new V()), L.j2.getWorldPosition(new V())); }
        pts.push(p.rig.head.getWorldPosition(new V()), p.rig.chest.getWorldPosition(new V()), p.rig.body.getWorldPosition(new V()));
        for (const q of pts) {
          if (!Number.isFinite(q.x + q.y + q.z)) { bad = `${ch.id}:${mv.id} NaN (${fi.state})`; break; }
          if (Math.hypot(q.x - fi.x, q.z - fi.z) > 5 || q.y > 7 || q.y < -0.25) { bad = `${ch.id}:${mv.id} joint out of range y=${q.y.toFixed(2)} d=${Math.hypot(q.x - fi.x, q.z - fi.z).toFixed(1)} (${fi.state})`; break; }
        }
      }
    }
    if (bad) problems.push(bad);
  }
}
console.log(`${moves} moves, ${frames} fighter-frames, ${problems.length} problems`);
for (const p of problems.slice(0, 40)) console.log('  ' + p);
process.exit(problems.length ? 1 : 0);
