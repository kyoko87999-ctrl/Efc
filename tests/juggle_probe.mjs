import kenzo from '../src/data/chars/kenzo.js';
import { mk, run, place, evs, inp, NEUTRAL, ST } from './helpers.mjs';
const moves = process.argv.slice(2).length ? process.argv.slice(2) : ['b1', 'b2', 'df1', 'f2', 'k4', 'j2'];
const inputFor = { b1: { b1: true }, b2: { b2: true }, df1: { d: true, r: true, b1: true }, f2: { r: true, b2: true }, k4: { b4: true }, j2: { b2: true } };
for (const mvn of moves) {
  const res = [];
  for (let s = 10; s <= 62; s += 2) {
    const m = mk(kenzo, kenzo);
    place(m, 1.3);
    const [a, b] = m.fighters;
    const seq = [[1, { d: true, r: true, b2: true }], [s, {}], [1, inputFor[mvn]], [30, {}]];
    let maxHits = 0, ys = [];
    const scr = []; for (const [n, i] of seq) for (let k = 0; k < n; k++) scr.push(inp(i));
    for (const x of scr) { m.step([x, NEUTRAL]); maxHits = Math.max(maxHits, b.comboHits); }
    res.push(`${s}:${maxHits}`);
  }
  console.log(mvn.padEnd(5), res.join(' '));
}
// trajectory
{
  const m = mk(kenzo, kenzo); place(m, 1.3); const [a, b] = m.fighters;
  const traj = [];
  for (let i = 0; i < 90; i++) { m.step([inp(i === 0 ? { d: true, r: true, b2: true } : {}), NEUTRAL]); if (b.state === ST.AIR && i % 6 === 0) traj.push(`t${i}: y=${b.y.toFixed(2)} x=${(b.x - a.x).toFixed(2)}`); }
  console.log(traj.join(' | '));
}
