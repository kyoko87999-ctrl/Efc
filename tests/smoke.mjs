import { compileChar } from '../src/sim/move.js';
import kenzo from '../src/data/chars/kenzo.js';
const c = compileChar(kenzo);
console.log('moves', c.moveList.length);
for (const m of c.moveList.slice(0, 12)) console.log(m.id.padEnd(8), (m.display || '').padEnd(14), m.lv, 'i' + m.st, m.hitStun, m.blkStun, m.total);
