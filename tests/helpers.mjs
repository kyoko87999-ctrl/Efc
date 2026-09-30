import { compileChar } from '../src/sim/move.js';
import { Match } from '../src/sim/match.js';
import { ST } from '../src/sim/fighter.js';

export const NEUTRAL = { l: false, r: false, u: false, d: false, b1: false, b2: false, b3: false, b4: false };
export const inp = (o = {}) => ({ ...NEUTRAL, ...o });

export function mk(defA, defB, rules = {}, stage) {
  const m = new Match({ chars: [compileChar(defA), compileChar(defB)], rules: { time: 0, ...rules }, stage, seed: 7 });
  // skip intro
  let g = 0;
  while (m.phase === 'intro' && g++ < 1000) m.step([NEUTRAL, NEUTRAL]);
  return m;
}

// a scripted input player: sequence of [frames, input]
export class Script {
  constructor(seq) { this.seq = []; for (const [n, i] of seq) for (let k = 0; k < n; k++) this.seq.push(inp(i)); this.i = 0; }
  next() { return this.i < this.seq.length ? this.seq[this.i++] : NEUTRAL; }
  get done() { return this.i >= this.seq.length; }
}

export function run(m, s0, s1, extra = 0) {
  const a = s0 ? new Script(s0) : null, b = s1 ? new Script(s1) : null;
  const n = Math.max(a ? a.seq.length : 0, b ? b.seq.length : 0) + extra;
  for (let i = 0; i < n; i++) m.step([a ? a.next() : NEUTRAL, b ? b.next() : NEUTRAL]);
}

export function place(m, dist, z2 = 0) {
  const [a, b] = m.fighters;
  a.x = 0; a.z = 0; b.x = dist; b.z = z2;
}

export function evs(m, type) { return m.events.filter((e) => e.t === type); }
export { ST };
