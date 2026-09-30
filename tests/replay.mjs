// Determinism: re-running recorded inputs must reproduce the same match.
import { CHARS } from '../src/data/roster.js';
import { compileChar } from '../src/sim/move.js';
import { Match } from '../src/sim/match.js';
import { CpuBrain } from '../src/sim/ai.js';
import { STAGES } from '../src/render/stagesList.js';
const cc = Object.fromEntries(CHARS.map((c) => [c.id, compileChar(c)]));
let fails = 0;
for (const [a, b, st] of [['kenzo', 'tawan', 1], ['bruno', 'luna', 2], ['asura', 'kage', 5]]) {
  const stage = STAGES[st];
  const mk = () => new Match({ chars: [cc[a], cc[b]], stage, rules: { time: 60, rounds: 2 }, seed: 4242 });
  const m1 = mk();
  const A = new CpuBrain(0, 3, 7), B = new CpuBrain(1, 3, 8);
  const rec = [];
  let f = 0;
  while (!m1.over && f < 60 * 60 * 4) { const r = [A.think(m1), B.think(m1)]; rec.push(r); m1.step(r); f++; }
  const m2 = mk();
  for (const r of rec) m2.step(r);
  const sig = (m) => JSON.stringify([m.wins, m.round, m.fighters.map((x) => [x.hp.toFixed(3), x.x.toFixed(4), x.z.toFixed(4), x.state])]);
  const ok = sig(m1) === sig(m2);
  console.log(ok ? 'ok  ' : 'FAIL', a, 'vs', b, 'frames', f, sig(m1).slice(0, 90));
  if (!ok) fails++;
}
process.exit(fails ? 1 : 0);
