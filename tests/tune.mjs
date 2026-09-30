// AI/damage tuning harness: node tests/tune.mjs [games=4] [level=3] [dmgMul=1]
import { CHARS } from '../src/data/roster.js';
import { compileChar } from '../src/sim/move.js';
import { Match } from '../src/sim/match.js';
import { CpuBrain } from '../src/sim/ai.js';
import { STAGES } from '../src/render/stagesData.js';

const compiled = CHARS.map(compileChar);
const N = +(process.argv[2] || 4), LV = +(process.argv[3] || 3), DM = +(process.argv[4] || 1);
const S = { rounds: 0, ko: 0, timeup: 0, frames: 0, moves: 0, hits: 0, blocks: 0, launches: 0, dmgTaken: 0, koFrames: 0, comboDmg: 0, combos: 0, big: 0, bigDmg: 0 };
const wins = {}, games = {};
const per = {};
for (let g = 0; g < N; g++) {
  for (let i = 0; i < compiled.length; i++) {
    const a = compiled[i], b = compiled[(i + 1 + g) % compiled.length];
    const m = new Match({ chars: [a, b], stage: STAGES[(i + g) % STAGES.length], rules: { time: 60, rounds: 2, dmgMul: DM }, seed: 300 + g * 17 + i });
    const A = new CpuBrain(0, LV, g + 1), B = new CpuBrain(1, LV, g + 9);
    let frames = 0, roundStart = 0;
    const seen = { moves: 0 };
    while (!m.over && frames < 60 * 60 * 6) {
      m.step([A.think(m), B.think(m)]);
      frames++;
      for (const e of m.events) {
        if (e.t === 'move') S.moves++;
        else if (e.t === 'hit') { S.hits++; if (e.launch) S.launches++; }
        else if (e.t === 'block') S.blocks++;
        else if (e.t === 'ko') { S.ko++; }
        else if (e.t === 'timeup') S.timeup++;
      }
      m.events = [];
    }
    S.rounds += m.round; S.frames += frames;
    const w = m.winner >= 0 ? m.fighters[m.winner].ch.id : 'draw';
    wins[w] = (wins[w] || 0) + 1; games[a.id] = (games[a.id] || 0) + 1; games[b.id] = (games[b.id] || 0) + 1;
    for (const f of m.fighters) { S.dmgTaken += f.stats.dmg; const p = per[f.ch.id] || (per[f.ch.id] = { dmg: 0, hits: 0, moves: 0, whiffs: 0, throws: 0, rounds: 0, maxCombo: 0, launches: 0 }); p.dmg += f.stats.dmg; p.hits += f.stats.hits; p.whiffs += f.stats.whiffs; p.throws += f.stats.throws; p.rounds += m.round; p.maxCombo = Math.max(p.maxCombo, f.stats.maxCombo); }
  }
}
const pct = (x, y) => (100 * x / Math.max(1, y)).toFixed(0) + '%';
console.log(`level ${LV} dmgMul ${DM}: rounds ${S.rounds}  KO ${S.ko} (${pct(S.ko, S.rounds)})  timeouts ${S.timeup} (${pct(S.timeup, S.rounds)})  avg round ${(S.frames / S.rounds / 60).toFixed(1)}s`);
console.log(`per round: moves ${(S.moves / S.rounds).toFixed(1)}  hits ${(S.hits / S.rounds).toFixed(1)}  blocks ${(S.blocks / S.rounds).toFixed(1)}  launches ${(S.launches / S.rounds).toFixed(1)}  dmg dealt(total both) ${(S.dmgTaken / S.rounds).toFixed(0)}`);
console.log('winrates', Object.keys(games).map((k) => `${k}:${pct(wins[k] || 0, games[k])}`).join(' '));

for (const id of Object.keys(per)) { const p = per[id]; console.log(id.padEnd(9), `dmg/round ${(p.dmg / p.rounds).toFixed(0)}  hits/round ${(p.hits / p.rounds).toFixed(1)}  dmg/hit ${(p.dmg / Math.max(1, p.hits)).toFixed(1)}  whiffs/round ${(p.whiffs / p.rounds).toFixed(1)}  throws ${p.throws}  maxCombo ${p.maxCombo}`); }
