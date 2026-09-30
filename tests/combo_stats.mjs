import { CHARS } from '../src/data/roster.js';
import { compileChar } from '../src/sim/move.js';
import { Match } from '../src/sim/match.js';
import { CpuBrain } from '../src/sim/ai.js';
import { Fighter } from '../src/sim/fighter.js';
import { STAGES } from '../src/render/stagesData.js';
const orig = Fighter.prototype.endCombo;
const combos = [];
Fighter.prototype.endCombo = function () { if (this.comboHits > 0) combos.push({ hits: this.comboHits, dmg: this.comboDmg, air: this.airHits }); orig.call(this); };
const compiled = CHARS.map(compileChar);
let rounds = 0, hpLeft = [], firstHitFrames = [];
for (let g = 0; g < 3; g++) for (let i = 0; i < compiled.length; i++) {
  const m = new Match({ chars: [compiled[i], compiled[(i + 3 + g) % compiled.length]], stage: STAGES[0], rules: { time: 60 }, seed: g * 31 + i });
  const A = new CpuBrain(0, 3, g + 1), B = new CpuBrain(1, 3, g + 5);
  let fr = 0;
  while (!m.over && fr < 60 * 60 * 5) { m.step([A.think(m), B.think(m)]); fr++; }
  rounds += m.round;
}
const big = combos.filter((c) => c.hits >= 3);
const avg = (a, k) => (a.reduce((s, c) => s + c[k], 0) / Math.max(1, a.length)).toFixed(1);
console.log('combos total', combos.length, 'avg hits', avg(combos, 'hits'), 'avg dmg', avg(combos, 'dmg'));
console.log('3+ hit combos', big.length, 'avg hits', avg(big, 'hits'), 'avg dmg', avg(big, 'dmg'), 'max dmg', Math.max(...combos.map((c) => c.dmg)));
const buckets = {}; for (const c of combos) buckets[Math.min(c.hits, 8)] = (buckets[Math.min(c.hits, 8)] || 0) + 1;
console.log('hits histogram', JSON.stringify(buckets));
