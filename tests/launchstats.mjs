// hits per launcher-started combo when both sides are AI: node tests/launchstats.mjs [games=6] [level=3]
import { CHARS } from '../src/data/roster.js';
import { compileChar } from '../src/sim/move.js';
import { Match } from '../src/sim/match.js';
import { CpuBrain } from '../src/sim/ai.js';
import { Fighter } from '../src/sim/fighter.js';
import { STAGES } from '../src/render/stagesData.js';
const N = +(process.argv[2] || 6), LV = +(process.argv[3] || 3);
const orig = Fighter.prototype.endCombo;
const combos = [];
Fighter.prototype.endCombo = function () { if (this.comboHits > 0) combos.push({ hits: this.comboHits, dmg: this.comboDmg, air: this.airHits, launch: this.comboLaunch, id: this.ch.id }); orig.call(this); };
const compiled = CHARS.map(compileChar);
for (let g = 0; g < N; g++) for (let i = 0; i < compiled.length; i++) {
  const m = new Match({ chars: [compiled[i], compiled[(i + 3 + g) % compiled.length]], stage: STAGES[g % STAGES.length], rules: { time: 60 }, seed: g * 31 + i });
  const A = new CpuBrain(0, LV, g + 1), B = new CpuBrain(1, LV, g + 5);
  let fr = 0;
  while (!m.over && fr < 60 * 60 * 5) { m.step([A.think(m), B.think(m)]); fr++; }
}
const air = combos.filter((c) => c.air > 0);
const hist = {}; for (const c of air) hist[Math.min(c.hits, 9)] = (hist[Math.min(c.hits, 9)] || 0) + 1;
const avg = (a, k) => (a.reduce((s, c) => s + c[k], 0) / Math.max(1, a.length)).toFixed(1);
console.log('combos', combos.length, 'with air hits', air.length, 'avg hits', avg(air, 'hits'), 'avg dmg', avg(air, 'dmg'), 'max dmg', Math.max(...air.map((c) => c.dmg)));
console.log('hits histogram (juggle combos)', JSON.stringify(hist));
