// Beam-search the longest/best juggle combos per character: node tests/combofind.mjs [charId] [depth=4]
import { CHARS } from '../src/data/roster.js';
import { compileChar } from '../src/sim/move.js';
import { Match } from '../src/sim/match.js';
import { CpuBrain } from '../src/sim/ai.js';
import { ST } from '../src/sim/fighter.js';
import { mk, place, NEUTRAL } from './helpers.mjs';
const only = process.argv[2] && process.argv[2] !== 'all' ? process.argv[2] : null;
const DEPTH = +(process.argv[3] || 4);
const BEAM = 5;

function toRaw(dir, btn) {
  // facing right (P1 on the left): numpad dir -> raw booleans
  return { l: [1, 4, 7].includes(dir), r: [3, 6, 9].includes(dir), u: [7, 8, 9].includes(dir), d: [1, 2, 3].includes(dir), b1: !!(btn & 1), b2: !!(btn & 2), b3: !!(btn & 4), b4: !!(btn & 8) };
}

for (const def of CHARS) {
  if (only && def.id !== only) continue;
  const cc = compileChar(def);
  const brain = new CpuBrain(0, 3, 1);
  const simple = cc.moveList.filter((m) => m.cmd && m.ctx === 'stand' && !m.req && !m.noAI && m.lv !== 't' && /^((f|b|d|d\/f|d\/b|u\/f|u\/b)\+)?[1-4]$|^[1-4](,[1-4])+$/.test(m.display || m.cmd) === true);
  const cands = [];
  for (const m of simple) {
    const disp = m.display || m.cmd;
    if (/,/.test(disp)) {
      // chain: press buttons with gaps
      cands.push({ id: m.id, name: disp, chain: disp.split(',').map((x) => +x) });
    } else if (m.cmd) cands.push({ id: m.id, name: disp, frames: brain.frames(m.cmd) });
  }
  const launchers = simple.filter((m) => m.ht === 'launch' && !/,/.test(m.display || m.cmd));
  const framesOf = (c) => {
    if (c.frames) return c.frames.map((f) => toRaw(f.dir, f.btn));
    const out = [];
    const bm = { 1: 1, 2: 2, 3: 4, 4: 8 };
    c.chain.forEach((b, i) => { if (i) for (let k = 0; k < 9; k++) out.push(toRaw(5, 0)); out.push(toRaw(5, bm[b])); out.push(toRaw(5, 0)); });
    return out;
  };
  const evalScript = (script) => {
    const m = mk(def, CHARS[(CHARS.indexOf(def) + 1) % CHARS.length]);
    place(m, 1.25);
    const [a, b] = m.fighters;
    let hits = 0, air = false, maxHits = 0, wall = false;
    for (const x of script) {
      m.step([x, NEUTRAL]);
      maxHits = Math.max(maxHits, b.comboHits);
      if (b.state === ST.AIR) air = true;
      if (b.state === ST.WALL) wall = true;
    }
    return { hits: maxHits, dmg: b.comboDmg || 0, air, ko: b.hp <= 0, hp: b.hp, wall, comboDmgOut: a.comboOut ? a.comboOut.dmg : 0 };
  };
  let best = null;
  for (const L of launchers) {
    const start = [];
    for (const f of framesOf({ frames: brain.frames(L.cmd) })) start.push(f);
    let beam = [{ script: start, desc: [L.display], score: 0 }];
    for (let depth = 0; depth < DEPTH; depth++) {
      const next = [];
      for (const node of beam) {
        for (const c of cands) {
          for (let delay = depth === 0 ? 16 : 0; delay <= (depth === 0 ? 64 : 34); delay += 2) {
            const script = node.script.concat(Array.from({ length: delay }, () => NEUTRAL), framesOf(c));
            const padded = script.concat(Array.from({ length: 90 }, () => NEUTRAL));
            const r = evalScript(padded);
            if (!r.air) continue;
            const score = r.hits * 100 + r.comboDmgOut;
            next.push({ script, desc: [...node.desc, c.name + '@' + delay], score, r });
          }
        }
      }
      if (!next.length) break;
      next.sort((a, b) => b.score - a.score);
      // dedupe
      const seen = new Set(); beam = [];
      for (const n of next) { const k = n.r.hits + ':' + n.r.comboDmgOut; if (seen.has(k)) continue; seen.add(k); beam.push(n); if (beam.length >= BEAM) break; }
      if (!best || beam[0].score > best.score) best = beam[0];
    }
  }
  if (best) console.log(def.id.padEnd(9), `hits ${best.r.hits} dmg ${best.r.comboDmgOut}${best.r.wall ? ' wall' : ''}`, best.desc.join(' > '));
  else console.log(def.id, 'no launcher combo found');
}
