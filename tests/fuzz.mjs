// Random-input fuzz over every character / stage: node tests/fuzz.mjs [frames=5000] [rounds=1]
import { CHARS } from '../src/data/roster.js';
import { compileChar } from '../src/sim/move.js';
import { Match } from '../src/sim/match.js';
import { ST } from '../src/sim/fighter.js';
import { STAGES } from '../src/render/stagesData.js';
import { NEUTRAL } from './helpers.mjs';

const FRAMES = +(process.argv[2] || 5000);
const REPS = +(process.argv[3] || 1);
const compiled = CHARS.map(compileChar);
let seed = 987654321;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
let problems = 0, runs = 0, kos = 0;
const bad = (m) => { problems++; if (problems < 25) console.log('PROBLEM', m); };
for (let rep = 0; rep < REPS; rep++) for (let i = 0; i < compiled.length; i++) for (const j of [(i + 1) % 10, (i + 4) % 10, i]) {
  const stage = STAGES[(i * 3 + j + rep) % STAGES.length];
  const m = new Match({ chars: [compiled[i], compiled[j]], stage, rules: { time: 60, rounds: 3 }, seed: rep * 100 + i });
  // each fighter has a random "style": biases towards directions / buttons / holding
  const style = [0, 1].map(() => ({ fwd: rnd() * 0.5, back: rnd() * 0.4, up: rnd() * 0.2, down: rnd() * 0.3, btn: 0.04 + rnd() * 0.25, multi: rnd() * 0.4, hold: 2 + Math.floor(rnd() * 14) }));
  const cur = [{ ...NEUTRAL }, { ...NEUTRAL }], left = [0, 0];
  const stuck = [0, 0], lastKey = ['', ''];
  runs++;
  for (let f = 0; f < FRAMES && !m.over; f++) {
    for (let p = 0; p < 2; p++) {
      if (left[p]-- <= 0) {
        const s = style[p];
        const r = { l: rnd() < s.back, r: rnd() < s.fwd, u: rnd() < s.up, d: rnd() < s.down, b1: false, b2: false, b3: false, b4: false };
        if (rnd() < s.btn) { const k = ['b1', 'b2', 'b3', 'b4']; r[k[Math.floor(rnd() * 4)]] = true; if (rnd() < s.multi) r[k[Math.floor(rnd() * 4)]] = true; }
        cur[p] = r; left[p] = 1 + Math.floor(rnd() * s.hold);
      }
    }
    try { m.step([cur[0], cur[1]]); } catch (e) { bad(`EXCEPTION ${compiled[i].id} vs ${compiled[j].id} on ${stage.id} f${f}: ${e.stack.split('\n').slice(0, 3).join(' | ')}`); break; }
    m.events.length = 0;
    for (const fi of m.fighters) {
      const key = fi.state + (fi.move ? fi.move.id : '');
      if (!Number.isFinite(fi.x + fi.y + fi.z + fi.hp)) { bad(`NaN ${fi.ch.id} state ${fi.state}`); m.over = true; break; }
      if (fi.hp < -1e-6 || fi.hp > fi.maxHp + 1e-6) bad(`hp ${fi.hp} ${fi.ch.id}`);
      if (fi.y < -0.01 || fi.y > 12) bad(`y=${fi.y.toFixed(2)} ${fi.ch.id} state ${fi.state}`);
      const skip = fi.state === ST.IDLE || fi.state === ST.WIN || fi.state === ST.LOSE || fi.state === ST.KO || fi.state === ST.INTRO || fi.state === ST.DOWN || fi.state === ST.RUN || fi.state === ST.BLK;
      if (key === lastKey[fi.idx] && !skip) { if (++stuck[fi.idx] > 420) { bad(`STUCK ${fi.ch.id} in ${key} (phase ${m.phase}) vs ${m.fighters[1 - fi.idx].ch.id} on ${stage.id}`); stuck[fi.idx] = -1e6; } }
      else { stuck[fi.idx] = 0; lastKey[fi.idx] = key; }
    }
    // arena bounds (allow the next-phase centre)
    const bd = m.bounds, cx = bd.center ? bd.center[0] : 0, cz = bd.center ? bd.center[1] : 0;
    for (const fi of m.fighters) {
      const dx = fi.x - cx, dz = fi.z - cz;
      const lim = bd.bounds.type === 'rect' ? Math.max(bd.bounds.hx, bd.bounds.hz) * 1.6 : bd.bounds.r * 1.3;
      if (Math.hypot(dx, dz) > lim + 2 && fi.state !== ST.GRAB) { bad(`out of arena ${fi.ch.id} at ${dx.toFixed(1)},${dz.toFixed(1)} on ${stage.id} state ${fi.state}`); break; }
    }
  }
  if (m.over) kos++;
}
console.log(`fuzz: ${runs} matches, ${kos} finished, ${problems} problems`);
process.exit(problems ? 1 : 0);
