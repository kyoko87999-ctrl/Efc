// AI vs AI simulation across the roster: crash / stall / stuck-state detection and rough stats.
import { CHARS } from '../src/data/roster.js';
import { compileChar } from '../src/sim/move.js';
import { Match } from '../src/sim/match.js';
import { CpuBrain } from '../src/sim/ai.js';
import { ST } from '../src/sim/fighter.js';
import { STAGES } from '../src/render/stagesData.js';

const compiled = CHARS.map(compileChar);
const argv = process.argv.slice(2);
const N = +(argv[0] || 6);
const LV = +(argv[1] || 3);
const only = argv[2];
let issues = 0;
const tot = { rounds: 0, kos: 0, frames: 0, hits: 0, blocks: 0, throws: 0, breaks: 0, launches: 0, walls: 0, counters: 0, heats: 0, rages: 0, wallbreaks: 0, timeouts: 0 };
const winsBy = {};
const t0 = Date.now();
for (let g = 0; g < N; g++) {
  for (let i = 0; i < compiled.length; i++) {
    const a = compiled[i], b = compiled[(i + 1 + g) % compiled.length];
    if (only && a.id !== only && b.id !== only) continue;
    const stage = STAGES[(i + g) % STAGES.length];
    const m = new Match({ chars: [a, b], stage, rules: { time: 60, rounds: 2 }, seed: 100 + g * 17 + i });
    const A = new CpuBrain(0, LV, g + 1), B = new CpuBrain(1, LV, g + 9);
    let frames = 0, stuck = [0, 0], lastStates = ['', ''], lastHp = m.fighters.map((f) => f.hp), quiet = 0;
    while (!m.over && frames < 60 * 60 * 6) {
      m.step([A.think(m), B.think(m)]);
      frames++;
      for (const f of m.fighters) {
        if (!Number.isFinite(f.x + f.y + f.z + f.hp)) { console.log('NaN', a.id, b.id, f.idx, f.state); issues++; m.over = true; }
        if (f.hp > f.maxHp + 1e-6 || f.hp < -1e-6) { console.log('hp range', a.id, b.id, f.hp); issues++; }
        const key = f.state + (f.move ? f.move.id : '');
        if (key === lastStates[f.idx] && f.state !== ST.IDLE && f.state !== ST.WIN && f.state !== ST.LOSE && f.state !== ST.KO && f.state !== ST.INTRO && f.state !== ST.DOWN && f.state !== ST.RUN) { if (++stuck[f.idx] > 360) { console.log(`STUCK ${a.id} vs ${b.id} f${f.idx} in ${key} for ${stuck[f.idx]} frames (phase ${m.phase})`); issues++; stuck[f.idx] = -100000; } }
        else { stuck[f.idx] = 0; lastStates[f.idx] = key; }
      }
      if (m.phase === 'fight') {
        const hp = m.fighters.map((f) => f.hp);
        if (hp[0] === lastHp[0] && hp[1] === lastHp[1]) quiet++; else quiet = 0;
        lastHp = hp;
        if (quiet > 60 * 25 && m.rules.time === 0) { console.log('STALL', a.id, b.id); issues++; break; }
      }
    }
    if (!m.over) { console.log('MATCH DID NOT FINISH', a.id, b.id, 'phase', m.phase, 'round', m.round, 'wins', m.wins); issues++; }
    const ev = (t) => m.events.filter((e) => e.t === t).length;
    tot.rounds += m.round; tot.frames += frames; tot.hits += ev('hit'); tot.blocks += ev('block'); tot.throws += ev('grab'); tot.breaks += ev('break');
    tot.launches += m.events.filter((e) => e.t === 'hit' && e.launch).length; tot.walls += ev('wallsplat'); tot.counters += m.events.filter((e) => e.t === 'hit' && e.counter).length;
    tot.heats += ev('heat') + ev('heatburst'); tot.rages += ev('rage'); tot.wallbreaks += ev('wallbreak'); tot.kos += ev('ko'); tot.timeouts += ev('timeup');
    const w = m.winner >= 0 ? m.fighters[m.winner].ch.id : 'draw';
    winsBy[w] = (winsBy[w] || 0) + 1;
    winsBy[a.id + ':games'] = (winsBy[a.id + ':games'] || 0) + 1; winsBy[b.id + ':games'] = (winsBy[b.id + ':games'] || 0) + 1;
  }
}
console.log('totals', JSON.stringify(tot));
console.log('avg round frames', (tot.frames / Math.max(1, tot.rounds)).toFixed(0), `(${(tot.frames / Math.max(1, tot.rounds) / 60).toFixed(1)}s)`);
console.log('wins', JSON.stringify(winsBy));
console.log(`issues: ${issues}   elapsed ${((Date.now() - t0) / 1000).toFixed(1)}s`);
process.exit(issues ? 1 : 0);
