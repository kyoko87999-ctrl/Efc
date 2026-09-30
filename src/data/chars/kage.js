import { buildMoves, PRE, mv, rageArt, heatSmash, rageDrive, THR } from '../lib.js';

// Kage - ninja: extremely fast strings, evasive shadow step, crouching shadow stance
const shslash = mv('shslash', null, 'Shadow Slash', 'm', 3, 2, 26, 16, -13, 0, 'stab', { ht: 'launch', lvy: 0.16, ws: true });
const moves = buildMoves(
  { dmg: 0.9, spd: -1 },
  {
    j1: { name: 'Blade Jab', st: 9, dmg: 5 }, j12: { name: 'Blade-Blade', dmg: 7 }, j123: { name: 'Blade-Blade-Kick', st: 8, dmg: 11 },
    j2: { st: 10, dmg: 7 },
    f2: { name: 'Shuriken Palm', ...PRE.stab, lv: 'm', st: 13, dmg: 13, he: true, cht: 'launch', blk: -8 },
    f3: { name: 'Crescent Kick', dmg: 10 }, f4: { name: 'Wind Roundhouse', dmg: 14, st: 16 },
    df1: { name: 'Quick Stab', st: 11 }, df2: { name: 'Moonrise', st: 14, dmg: 11, lvy: 0.165 }, df3: { name: 'Crawler Kick', st: 13 },
    d1: { name: 'Low Blade', st: 10 }, d3: { name: 'Ankle Cut', st: 13 }, d4: { name: 'Shadow Sweep', st: 15 },
    th13: { name: 'Neck Snap Toss', grab: THR.hip(9, 24), an: { script: 'hip' }, dmg: 24 },
    th24: { name: 'Shadow Suplex', grab: THR.back(9, 26), an: { script: 'back' }, dmg: 26 },
    wr2: { name: 'Dashing Slash', st: 11 },
  },
  [
    shslash,
    mv('shstep', '3+4', 'Shadow Step', 'm', 12, 1, 8, 0, 0, 0, 'stab', { noHit: true, noAI: true, inv: [[1, 12, 'all']], mv: [[1, 11, 2.2]], auto: { on: 'always', id: 'shslash', at: 13 }, aiWeight: 1.5 }),
    mv('vanish', 'b+3+4', 'Vanish', 'm', 14, 1, 8, 0, 0, 0, 'stab', { noHit: true, noAI: true, inv: [[1, 14, 'all']], mv: [[1, 13, -1.7]] }),
    mv('shadowin', 'd/f+3+4', 'Shadow Stance', 'm', 8, 1, 6, 0, 0, 0, 'stab', { toStance: 'shadow', noHit: true, noAI: true, dmg: 0, crouchMove: true }),
    mv('sh_1', '1', 'Shadow Jab', 'm', 9, 2, 14, 5, -2, 5, 'lowjab', { ctx: 'st:shadow', lv: 'l' }),
    mv('sh_2', '2', 'Shadow Stab', 'm', 11, 2, 18, 10, -8, 3, 'stab', { ctx: 'st:shadow', crouchMove: true }),
    mv('sh_3', '3', 'Shadow Sweep', 'l', 12, 3, 24, 8, -14, 0, 'sweep', { ctx: 'st:shadow', ht: 'kd' }),
    mv('sh_4', '4', 'Shadow Rise', 'm', 14, 3, 24, 13, -14, 0, 'rise', { ctx: 'st:shadow', ht: 'launch', lvy: 0.16 }),
    rageArt({ name: 'Thousand Blades', first: 8, hits: [3, 3, 3, 4, 4, 4, 5, 5, 6, 16], after: 'launch', pre: 'stab', script: 'rageA', spacing: 5, an: { seq: ['hR', 'hL', 'hR', 'hL', 'hR', 'hL', 'hR', 'hL', 'fR'], finish: 'hR' } }),
    heatSmash({ name: 'Crescent Cut', hits: [5, 8, 20], pre: 'stab', an: { seq: ['hR', 'hL'], finish: 'hR' } }),
    rageDrive({ name: 'Dragon Fang', dmg: 22, pre: 'stab' }),
  ],
);

export default {
  id: 'kage', name: 'Kage', nameTH: 'คาเงะ', title: 'Shadow Blade', style: 'Ninjutsu', styleTH: 'นินจุตสึ', country: 'JP',
  desc: 'A shadow-step assassin. Fast, evasive and tricky - with the lowest health pool of the roster.',
  descTH: 'นักฆ่าเงามืด รวดเร็ว หลบหลีกและอาศัยกลลวง แต่พลังชีวิตน้อยที่สุดในเกม',
  stats: { power: 2, speed: 5, range: 3, tech: 4, defense: 1 }, difficulty: 4,
  lead: 'L', intro: 'taunt', win: 'flip', hpMul: 0.94, dashF: 1.2, dashB: 1.15, ss: 1.2, run: 1.15,
  idle: { hands: 'low', bounce: 0.012, bounceSpeed: 6 },
  body: {
    scale: 0.97, build: [0.92, 0.88, 0.9, 0.95, 0.98], skin: '#c9a17a',
    hair: { style: 'bald', color: '#111' },
    top: { kind: 'long', color: '#16161e', trim: '#8a1c1c' }, bottom: { kind: 'pants', color: '#16161e', trim: '#8a1c1c' },
    hands: { kind: 'wraps', color: '#8a1c1c' }, feet: { kind: 'shoes', color: '#0d0d12' }, extra: ['ninja:#16161e', 'scarf:#8a1c1c'], glow: '#ff3b3b',
  },
  alts: [
    { name: 'Ghost', top: { color: '#e8e8f0', trim: '#5a5a7a' }, bottom: { color: '#e8e8f0', trim: '#5a5a7a' }, extra: ['ninja:#e8e8f0', 'scarf:#5a5a7a'] },
    { name: 'Emerald', top: { color: '#0e2a1c', trim: '#3cff9a' }, bottom: { color: '#0e2a1c', trim: '#3cff9a' }, extra: ['ninja:#0e2a1c', 'scarf:#3cff9a'] },
    { name: 'Crimson', top: { color: '#5a0f14', trim: '#111' }, bottom: { color: '#5a0f14', trim: '#111' }, extra: ['ninja:#5a0f14', 'scarf:#111111'] },
  ],
  moves,
  stances: {
    shadow: { name: 'Shadow Stance', exitBack: true, timeout: 120, walk: 0.6,
      look: { hips: [0, 0.5, 0.05], hipsRot: [10, -18, 0], spine: [24, -20, 0], head: [-16, 6, 0], hL: [-0.3, 0.8, 0.4], hR: [0.18, 0.9, 0.2], fL: [-0.28, 0, 0.4], fR: [0.26, 0, -0.16], kneePole: [0.3, 0, 1], bob: 0.008 } },
  },
};
