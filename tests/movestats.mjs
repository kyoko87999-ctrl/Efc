// per-move usage / hit / block stats for one character when driven by the AI: node tests/movestats.mjs kage [games=6] [level=3]
import { CHARS } from '../src/data/roster.js';
import { compileChar } from '../src/sim/move.js';
import { Match } from '../src/sim/match.js';
import { CpuBrain } from '../src/sim/ai.js';
import { STAGES } from '../src/render/stagesData.js';
const id = process.argv[2] || 'kage', N = +(process.argv[3] || 6), LV = +(process.argv[4] || 3);
const compiled = CHARS.map(compileChar);
const me = compiled.find((c) => c.id === id);
const st = {};
const row = (k) => st[k] || (st[k] = { used: 0, hit: 0, block: 0, dmg: 0 });
let rounds = 0, wins = 0, games = 0;
for (let g = 0; g < N; g++) for (const opp of compiled) {
  if (opp.id === id) continue;
  const side = g % 2;
  const chars = side ? [opp, me] : [me, opp];
  const m = new Match({ chars, stage: STAGES[g % STAGES.length], rules: { time: 60, rounds: 2 }, seed: 900 + g * 13 + compiled.indexOf(opp) });
  const A = new CpuBrain(0, LV, g + 3), B = new CpuBrain(1, LV, g + 11);
  const orig = m.emit.bind(m);
  m.emit = (e) => {
    if (e.t === 'move' && e.who === side) row(e.id).used++;
    if ((e.t === 'hit' || e.t === 'block') && e.att === side) { const mv = m.fighters[side].move; if (mv) { const r = row(mv.id); if (e.t === 'hit') { r.hit++; r.dmg += e.dmg || 0; } else r.block++; } }
    orig(e);
  };
  let f = 0;
  while (!m.over && f++ < 60 * 60 * 6) m.step([A.think(m), B.think(m)]);
  rounds += m.round; games++; if (m.winner === side) wins++;
}
console.log(`${id}: games ${games} wins ${wins} (${(100 * wins / games).toFixed(0)}%) rounds ${rounds}`);
const rows = Object.entries(st).sort((a, b) => b[1].used - a[1].used);
for (const [k, r] of rows.slice(0, 28)) console.log(k.padEnd(12), 'used', String(r.used).padStart(4), ' hit', String(r.hit).padStart(3), ' blk', String(r.block).padStart(3), ' whiff%', (100 * (1 - (r.hit + r.block) / Math.max(1, r.used))).toFixed(0).padStart(3), ' dmg', r.dmg);
