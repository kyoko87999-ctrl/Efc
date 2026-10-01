// node tools/dbg_reach.mjs <char> <move>   : per-frame reach debug of one move (active frames)
import * as THREE from 'three';
import { CHARS } from '../src/data/roster.js';
import { compileChar, limbAt } from '../src/sim/move.js';
import { Match } from '../src/sim/match.js';
import { CpuBrain } from '../src/sim/ai.js';
import { ST } from '../src/sim/fighter.js';
import { STAGES } from '../src/render/stagesData.js';
import { Puppet } from '../src/render/puppet.js';
import { NEUTRAL } from '../tests/helpers.mjs';

const [cid, mid] = process.argv.slice(2);
const COMPILED = new Map(CHARS.map((c) => [c.id, compileChar(c)]));
const def = COMPILED.get(cid), mv = def.moveMap.get(mid);
const m = new Match({ chars: [def, COMPILED.get(cid === 'bruno' ? 'kenzo' : 'bruno')], stage: STAGES.find((s) => s.id === 'grid'), rules: { time: 0, rounds: 5, infHp: true }, seed: 11 });
while (m.phase === 'intro') m.step([NEUTRAL, NEUTRAL]);
m.fighters[0].x = -3; m.fighters[1].x = 3; m.fighters[0].px = -3; m.fighters[1].px = 3; m.updateAxis();
const pup = m.fighters.map((f, i) => new Puppet(f, i ? COMPILED.get(cid === 'bruno' ? 'kenzo' : 'bruno') : def, null));
const a = m.fighters[0];
const brain = new CpuBrain(0, 5, 1); brain.pool = brain.buildPool(a) || brain.pool;
let t = 0, idx = 0;
const V = THREE.Vector3;
for (let f = 0; f < 200; f++) {
  let raw = NEUTRAL;
  if (a.state === ST.IDLE && a.lock <= 0 && brain.q.length === 0 && idx < 1) { brain.pressMove(mv); idx++; }
  if (brain.q.length) { const q = brain.q.shift(); raw = brain.toRaw(q.dir, q.btn, a); }
  m.step([raw, NEUTRAL]); t++;
  pup.forEach((p) => p.update(1, t / 60, 1, false)); pup.forEach((p) => p.rig.root.updateMatrixWorld(true));
  if (a.state === ST.ATK && a.move && a.move.id === mid) {
    const mm = a.move, mf = a.mf;
    const want = limbAt(mm, mf, def.rest[mm.limb] || def.rest.hR);
    const L = pup[0].rig.limbs[mm.limb[0] === 'k' ? (mm.limb === 'kL' ? 'fL' : 'fR') : mm.limb[0] === 'e' ? (mm.limb === 'eL' ? 'hL' : 'hR') : mm.limb] || pup[0].rig.limbs.hR;
    const got = pup[0].rig.anchorWorld(mm.limb === 'sh' ? 'chest' : mm.limb, new V());
    const w = pup[0].rig.root.localToWorld(new V(-want[0], want[1], want[2]));
    const P = pup[0].anim.P;
    console.log(`mf ${String(mf).padStart(2)} y=${a.y.toFixed(2)} want ${want.map((x) => x.toFixed(2))} err ${(got.distanceTo(w) / a.sc * 100).toFixed(0)}cm  hips ${P.hips.map((x) => x.toFixed(2))} hipsRot ${P.hipsRot.map((x) => x.toFixed(0))} spine ${P.spine.map((x) => x.toFixed(0))} chest ${P.chest.map((x) => x.toFixed(0))} sh ${P.shL.concat(P.shR).map((x) => x.toFixed(2))}`);
    void L;
  }
}
