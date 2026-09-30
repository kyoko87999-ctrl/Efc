import kenzo from '../src/data/chars/kenzo.js';
import { compileChar } from '../src/sim/move.js';
import { Match } from '../src/sim/match.js';
import { CpuBrain } from '../src/sim/ai.js';
import { ST } from '../src/sim/fighter.js';
import { NEUTRAL } from './helpers.mjs';
const c = compileChar(kenzo);
const m = new Match({ chars: [c, c], rules: { time: 0 }, seed: 5 });
const A = new CpuBrain(0, 5, 3);
let logging = 0, n = 0;
for (let i = 0; i < 4000 && n < 3; i++) {
  const a = m.fighters[0], b = m.fighters[1];
  const inpA = A.think(m);
  m.step([inpA, NEUTRAL]);
  if (b.state === ST.AIR && logging === 0) { logging = 90; n++; console.log('--- launch at frame', i, 'dist', Math.hypot(b.x - a.x, b.z - a.z).toFixed(2)); }
  if (logging > 0) {
    logging--;
    if (logging % 3 === 0) console.log(String(90 - logging).padStart(3), 'me', a.state, a.move ? a.move.id + '@' + a.mf : '', 'lock', a.lock, '| opp', b.state, 'y', b.y.toFixed(2), 'combo', b.comboHits, 'q', A.q.length, 'hold', A.hold.n);
  }
  if (b.hp < 60) { b.hp = b.maxHp; }
}
