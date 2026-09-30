import { buildMoves, PRE, mv, rageArt, heatSmash, rageDrive, THR } from '../lib.js';

// IRONCLAD-9 - combat automaton: heavy servo hits, power crush, rocket fist
const moves = buildMoves(
  { dmg: 1.12, spd: 1, reach: 1.02 },
  {
    j1: { name: 'Servo Jab', dmg: 7 }, j2: { name: 'Piston Cross', dmg: 10 }, j123: { name: 'Piston Combo', dmg: 15 },
    k4: { name: 'Servo Kick', dmg: 15 },
    f2: { name: 'Piston Punch', ...PRE.cross, lv: 'm', st: 15, ac: 3, rec: 22, dmg: 19, blk: -10, hit: 4, he: true, cht: 'launch', pc: [5, 14], ws: true, wsDmg: 10, wb: true, push: 0.9, ht: 'stag', mv: [[3, 12, 0.3]] },
    f3: { name: 'Thruster Kick', dmg: 14 }, f4: { name: 'Hydraulic Kick', dmg: 19, st: 19, pc: [6, 18] },
    df2: { name: 'Uplift Hammer', st: 16, dmg: 16, lvy: 0.165, pc: [4, 15] },
    df4: { name: 'Crusher Kick', dmg: 17, st: 18, ht: 'kd' },
    d4: { name: 'Sweep Blade', dmg: 11 },
    p14: { name: 'Charge Ram', dmg: 19, pc: [4, 17], ws: true, wsDmg: 12 },
    th13: { name: 'Crushing Grip', grab: THR.slam(10, 36), an: { script: 'slam' }, dmg: 36 },
    th24: { name: 'Grinder', grab: THR.bear(10, 38), an: { script: 'bear' }, dmg: 38 },
  },
  [
    mv('rocket', 'wr+1+2', 'Rocket Fist', 'm', 22, 2, 34, 18, -16, 0, 'rocket', { ht: 'kd', lvp: 0.09, push: 1.2, aiWeight: 1.3, mv: [[1, 8, 0.4]] }),
    mv('laser', 'd/f+1+2', 'Chest Laser', 'm', 26, 6, 26, 12, -12, 0, 'beam', { ht: 'stag', push: 0.9, hom: true, aiWeight: 1, r: 0.3 }),
    mv('jet', 'wr+4', 'Jet Boost Kick', 'm', 16, 3, 26, 16, -13, 0, 'flykick', { ht: 'kd', lvp: 0.07, mv: [[1, 14, 1.3]], pc: [3, 15] }),
    mv('overclock', '3+4', 'Overclock Slam', 'm', 22, 3, 32, 24, -19, 0, 'chop', { ht: 'bound', gh: true, pc: [4, 20], aiWeight: 1 }),
    rageArt({ name: 'Meltdown', first: 12, hits: [6, 8, 10, 12, 14, 20], after: 'launch', pre: 'cross', script: 'rageA', spacing: 9, an: { seq: ['hR', 'hL', 'hR', 'fR', 'hL'], finish: 'hR' } }),
    heatSmash({ name: 'Overdrive Crush', hits: [9, 12, 20], an: { seq: ['hR', 'hL'], finish: 'hR' } }),
    rageDrive({ name: 'Ram Protocol', dmg: 30, pre: 'shoulder' }),
  ],
);

export default {
  id: 'ironclad', name: 'IRONCLAD-9', nameTH: 'ไอรอนแคลด-9', title: 'Combat Automaton', style: 'Combat Robot', styleTH: 'หุ่นรบ', country: 'XX',
  desc: 'A military prototype. Heavy hits, power crush armour, laser and rocket fist for range.',
  descTH: 'หุ่นรบต้นแบบทางทหาร โจมตีหนัก มีเกราะ Power Crush เลเซอร์และหมัดจรวดระยะไกล',
  stats: { power: 5, speed: 2, range: 4, tech: 2, defense: 5 }, difficulty: 1,
  lead: 'L', intro: 'roar', win: 'roar', hpMul: 1.08, walkF: 0.92, walkB: 0.9, dashF: 0.95,
  idle: { hands: 'wide', bob: 0.006, bobSpeed: 2 },
  body: {
    scale: 1.16, build: [1.3, 1.35, 1.4, 1.35, 1.0], skin: '#7a828f', eyeGlow: '#ff3b3b',
    hair: { style: 'helmet', color: '#5b6472' },
    top: { kind: 'armor', color: '#5b6472', trim: '#9fb2c8' }, bottom: { kind: 'armor', color: '#4a5260', trim: '#9fb2c8' },
    hands: { kind: 'gloves', color: '#3d4552' }, feet: { kind: 'boots', color: '#3d4552' }, extra: ['visor:#ff3b3b', 'shoulderpads:#6c7686'], glow: '#ff3b3b',
  },
  alts: [
    { name: 'Arctic', top: { color: '#dfe6ee', trim: '#3a7bd5' }, bottom: { color: '#c8d0da', trim: '#3a7bd5' }, hair: { color: '#dfe6ee' }, extra: ['visor:#3ad0ff', 'shoulderpads:#c8d0da'] },
    { name: 'Gold Plated', top: { color: '#c9a227', trim: '#151515' }, bottom: { color: '#a8841c', trim: '#151515' }, hair: { color: '#c9a227' }, extra: ['visor:#fff2a0', 'shoulderpads:#c9a227'] },
    { name: 'Stealth', top: { color: '#1a1c22', trim: '#2b8a5a' }, bottom: { color: '#15171c', trim: '#2b8a5a' }, hair: { color: '#1a1c22' }, extra: ['visor:#3cff9a', 'shoulderpads:#22252c'] },
  ],
  moves, stances: {},
};
