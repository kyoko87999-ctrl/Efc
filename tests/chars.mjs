import { CHARS } from '../src/data/roster.js';
import { compileChar } from '../src/sim/move.js';
for (const c of CHARS) {
  const cc = compileChar(c);
  const cmds = cc.moveList.filter((m) => m.display).map((m) => m.display);
  console.log(c.id.padEnd(10), 'moves', String(cc.moveList.length).padStart(3), 'stances', Object.keys(c.stances || {}).length, 'chain', cc.moveList.filter((m) => m.ctx === 'chain').length);
}
