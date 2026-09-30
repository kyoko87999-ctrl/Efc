// Tekken-style command notation -> parsed command.
// Numpad direction codes: 7 8 9 / 4 5 6 / 1 2 3  (relative to facing: 6 = forward)
import { B1, B2, B3, B4 } from './const.js';

export const DIRN = { n: 5, f: 6, b: 4, u: 8, d: 2, 'd/f': 3, 'd/b': 1, 'u/f': 9, 'u/b': 7, df: 3, db: 1, uf: 9, ub: 7 };
export const DIR_NAME = { 5: 'n', 6: 'f', 4: 'b', 8: 'u', 2: 'd', 3: 'd/f', 1: 'd/b', 9: 'u/f', 7: 'u/b', 0: '' };
export const BTN_MASK = { 1: B1, 2: B2, 3: B3, 4: B4 };
const PREFIX = /^(ws|wr|ss|cd|air|dn|fc)\+/i;

export function parseCmd(str) {
  let ctx = 'stand';
  let body = str.trim();
  const pm = PREFIX.exec(body);
  if (pm) { ctx = pm[1].toLowerCase(); body = body.slice(pm[0].length); }
  const toks = body.split('+');
  let dir = 0, motion = null, i = 0;
  if (!/^[1-4]$/.test(toks[0])) {
    const parts = toks[0].split(',').map((s) => s.trim());
    const dirs = parts.map((p) => {
      const d = DIRN[p];
      if (d === undefined) throw new Error(`bad direction '${p}' in '${str}'`);
      return d;
    });
    dir = dirs[dirs.length - 1];
    if (dirs.length > 1) motion = dirs;
    i = 1;
  }
  let btn = 0;
  for (; i < toks.length; i++) {
    const b = BTN_MASK[toks[i]];
    if (!b) throw new Error(`bad button '${toks[i]}' in '${str}'`);
    btn |= b;
  }
  return { ctx, dir, motion, btn };
}

export function btnNames(mask) {
  const n = [];
  if (mask & B1) n.push('1');
  if (mask & B2) n.push('2');
  if (mask & B3) n.push('3');
  if (mask & B4) n.push('4');
  return n;
}

// Human readable notation, e.g. "d/f+2", "f,f+2", "ws+4", "1+2"
export function fmtCmd(m) {
  const pre = m.ctx && !['stand', 'chain'].includes(m.ctx) && !m.ctx.startsWith('st:') ? m.ctx.toUpperCase() + '+' : '';
  const btns = btnNames(m.btn).join('+');
  if (m.motion) return `${pre}${m.motion.map((d) => DIR_NAME[d]).join(',')}${btns ? '+' + btns : ''}`;
  if (m.dir) return `${pre}${DIR_NAME[m.dir]}${btns ? '+' + btns : ''}`;
  return `${pre}${btns}`;
}
