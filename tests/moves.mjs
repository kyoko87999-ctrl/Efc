// Every move of every fighter must be executable from its documented command and finish cleanly.
import { CHARS } from '../src/data/roster.js';
import { compileChar } from '../src/sim/move.js';
import { Match } from '../src/sim/match.js';
import { CpuBrain } from '../src/sim/ai.js';
import { ST } from '../src/sim/fighter.js';
import { NEUTRAL } from './helpers.mjs';

let bad = 0, tested = 0;
const only = process.argv[2];
for (const def of CHARS) {
  if (only && def.id !== only) continue;
  const cc = compileChar(def);
  for (const m of cc.moveList) {
    if (!m.cmd || m.noAI && !m.toStance && !m.inv && !m.pry) { if (!m.cmd) continue; }
    if (m.ctx === 'dn') continue;
    const other = compileChar(CHARS.find((c) => c.id === (def.id === 'bruno' ? 'kenzo' : 'bruno')));
    const match = new Match({ chars: [cc, other], rules: { time: 0, heat: true, rage: true, infHp: true }, seed: 3 });
    while (match.phase === 'intro') match.step([NEUTRAL, NEUTRAL]);
    const a = match.fighters[0], b = match.fighters[1];
    a.x = 0; b.x = 1.15; a.z = b.z = 0;
    a.px = a.x; b.px = b.x;
    if (m.req === 'rage') { a.hp = 30; a.rage = true; a.rageUsed = false; }
    if (m.req === 'heat') { a.heat.on = true; a.heat.t = 600; a.heat.avail = false; }
    if (m.req === 'noheat') a.heat.avail = true;
    const brain = new CpuBrain(0, 5, 1);
    brain.pool = brain.buildPool(a) || brain.pool;
    // enter stance first when needed
    const pre = [];
    if (m.ctx && m.ctx.startsWith('st:')) {
      const entry = cc.moveList.find((x) => x.toStance === m.ctx.slice(3));
      if (entry) pre.push(entry);
    }
    const seq = [...pre, m];
    let started = false, finished = false, frames = 0, idx = 0;
    const isMove = (x) => a.state === ST.ATK && a.move && a.move.id === x.id;
    brain.q = [];
    let queued = false;
    for (frames = 0; frames < 700; frames++) {
      if (!queued && a.state === ST.IDLE && a.lock <= 0 && brain.q.length === 0 && idx < seq.length) {
        // wait until the previous entry finished
        brain.pressMove(seq[idx]); queued = true;
      }
      const f = brain.q.shift();
      const raw = f ? brain.toRaw(f.dir, f.btn, a) : NEUTRAL;
      match.step([raw, NEUTRAL]);
      if (isMove(seq[idx])) { if (idx === seq.length - 1) started = true; else { idx++; queued = false; } }
      if (started && a.state !== ST.ATK && a.state !== ST.JUMP && a.state !== ST.DASHF && a.state !== ST.RUN && a.state !== ST.SS && a.state !== ST.CD) { finished = true; break; }
      if (m.ctx === 'air' && started && a.state === ST.LAND) { finished = true; break; }
    }
    tested++;
    if (!started || !finished) { bad++; console.log(`FAIL ${def.id}:${m.id} (${m.display}) started=${started} finished=${finished} state=${a.state}`); }
  }
}
console.log(`tested ${tested} moves, ${bad} failures`);
process.exit(bad ? 1 : 0);
