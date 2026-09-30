import { buildMoves, PRE, mv, rageArt, heatSmash, rageDrive, THR } from '../lib.js';

// Asura - the Demon Lord: long-range beam, blink, wings
const moves = buildMoves(
  { dmg: 1.1, spd: 0, reach: 1.05 },
  {
    j1: { name: 'Claw Jab', dmg: 7 }, j2: { name: 'Claw Cross', dmg: 10 }, j123: { name: 'Claw Combo', dmg: 15 },
    f2: { name: 'Demon Claw', ...PRE.cross, lv: 'm', st: 14, ac: 3, rec: 22, dmg: 18, blk: -10, hit: 4, he: true, cht: 'launch', ws: true, wsDmg: 10, wb: true, ht: 'stag', push: 0.8, mv: [[3, 12, 0.3]] },
    f4: { name: 'Hell Kick', dmg: 18 },
    df2: { name: 'Devil Uppercut', st: 14, dmg: 16, lvy: 0.17 },
    df4: { name: 'Infernal Kick', dmg: 16, ht: 'kd' },
    d4: { name: 'Tail Sweep' },
    th13: { name: 'Soul Grasp', grab: THR.slam(10, 34), an: { script: 'slam' }, dmg: 34 },
    th24: { name: 'Abyss Drop', grab: THR.suplex(10, 34), an: { script: 'suplex' }, dmg: 34 },
    p14: { name: 'Demon Charge', dmg: 18, pc: [4, 16], ws: true, wsDmg: 10 },
  },
  [
    mv('hellbeam', 'd/f+2+3', 'Hell Beam', 'm', 24, 8, 30, 15, -14, 0, 'beam', { ht: 'stag', push: 1.0, hom: true, r: 0.3, aiWeight: 1.2 }),
    mv('blink', '3+4', 'Void Blink', 'm', 14, 1, 8, 0, 0, 0, 'stab', { noHit: true, noAI: true, inv: [[1, 14, 'all']], mv: [[1, 13, 2.6]], auto: { on: 'always', id: 'blinkhit', at: 15 }, aiWeight: 1.2 }),
    mv('blinkhit', null, 'Blink Strike', 'm', 4, 2, 22, 16, -12, 0, 'cross', { ht: 'launch', lvy: 0.16 }),
    mv('wingsweep', 'f,f+1+2', 'Wing Slash', 'm', 21, 3, 34, 20, -17, 0, 'hook', { ht: 'kd', ws: true, wsDmg: 8, pc: [4, 20] }),
    mv('soulrip', 'wr+2', 'Soul Rip', 'm', 14, 2, 24, 18, -13, 0, 'palm', { ht: 'stag', mv: [[1, 12, 0.9]] }),
    rageArt({ name: 'Judgment Day', first: 12, hits: [6, 8, 10, 12, 14, 18, 22], after: 'kd', pre: 'cross', script: 'rageA', spacing: 9, an: { seq: ['hR', 'hL', 'fR', 'hR', 'hL', 'fL'], finish: 'hR' } }),
    heatSmash({ name: 'Abyss Crush', hits: [10, 12, 22], an: { seq: ['hR', 'hL'], finish: 'hR' } }),
    rageDrive({ name: 'Demon Drive', dmg: 30, pre: 'shoulder' }),
  ],
);

export default {
  id: 'asura', name: 'Asura', nameTH: 'อสุระ', title: 'Demon Lord', style: 'Demonic Art', styleTH: 'วิชาอสูร', country: 'XX',
  desc: 'The final challenger. Wings, blink, and a screen-wide Hell Beam.',
  descTH: 'ผู้ท้าชิงคนสุดท้าย มีปีก เทเลพอร์ต และลำแสงนรกระยะไกลทั่วจอ',
  stats: { power: 5, speed: 3, range: 5, tech: 4, defense: 4 }, difficulty: 4,
  lead: 'L', intro: 'roar', win: 'roar', hpMul: 1.08, boss: true,
  idle: { hands: 'wide', bob: 0.012 },
  body: {
    scale: 1.22, build: [1.25, 1.2, 1.3, 1.2, 1.05], skin: '#7a2a3a', eyeGlow: '#c13bff',
    hair: { style: 'horns', color: '#1a0a12' },
    top: { kind: 'none', color: '#000' }, bottom: { kind: 'armor', color: '#2a0e1a', trim: '#c13bff' },
    hands: { kind: 'bare' }, feet: { kind: 'bare' }, extra: ['wings:#2a0a2e', 'tail:#7a2a3a', 'chain:#c13bff'], glow: '#c13bff',
  },
  alts: [
    { name: 'Inferno', skin: '#b3271b', bottom: { color: '#3a0d05', trim: '#ff9a2b' }, extra: ['wings:#3a0d05', 'tail:#b3271b', 'chain:#ff9a2b'] },
    { name: 'Frost', skin: '#5a86a8', bottom: { color: '#0e2233', trim: '#9fe8ff' }, hair: { color: '#dfeeff' }, extra: ['wings:#12283d', 'tail:#5a86a8', 'chain:#9fe8ff'] },
    { name: 'Gilded', skin: '#c9a227', bottom: { color: '#2a1f05', trim: '#fff2a0' }, extra: ['wings:#2a1f05', 'tail:#c9a227', 'chain:#fff2a0'] },
  ],
  moves, stances: {},
};
