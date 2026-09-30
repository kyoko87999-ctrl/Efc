import { buildMoves, PRE, mv, rageArt, heatSmash, rageDrive, THR } from '../lib.js';

// Bruno "The Bear" Kowalski - heavyweight wrestler: armoured shoulders, five different throws
const moves = buildMoves(
  { dmg: 1.2, spd: 2, reach: 1.03 },
  {
    j1: { name: 'Stiff Jab', dmg: 8 },
    j2: { name: 'Overhand', dmg: 11 },
    j123: { name: 'One-Two-Boot', dmg: 16 },
    f2: { name: 'Lariat', ...PRE.hook, lv: 'm', st: 17, ac: 3, rec: 26, dmg: 20, blk: -12, hit: 2, he: true, ht: 'stag', push: 1.1, pushB: 0.9, ws: true, wsDmg: 12, wb: true, cht: 'launch', aiWeight: 1.5 },
    f3: { name: 'Boot', dmg: 14 },
    f4: { name: 'Big Boot', ...PRE.teepR, lv: 'm', st: 20, dmg: 20, blk: -14, ht: 'kd', push: 1.0, lvp: 0.09 },
    df2: { name: 'Gut Buster Upper', st: 17, dmg: 18, lvy: 0.16, pc: [4, 15] },
    df3: { name: 'Knee Drop', ...PRE.kneeL, lv: 'm', st: 16, dmg: 14 },
    df4: { name: 'Stomp Kick', dmg: 18, st: 18 },
    d3: { name: 'Low Boot', dmg: 9 }, d4: { name: 'Low Drop Kick', dmg: 12, st: 19 },
    th13: { name: 'Powerbomb', grab: THR.slam(10, 36), an: { script: 'slam' }, dmg: 36 },
    th24: { name: 'Bear Hug', grab: THR.bear(10, 40), an: { script: 'bear' }, dmg: 40 },
    p14: { name: 'Charging Shoulder', st: 16, dmg: 20, pc: [4, 16], ws: true, wsDmg: 12, push: 1.2 },
  },
  [
    mv('gut', 'f+1+3', 'Gutwrench Suplex', 't', 11, 1, 56, 34, 0, 0, 'grab', { unbl: true, grab: THR.suplex(11, 34), an: { script: 'suplex' }, aiWeight: 1 }),
    mv('back', 'b+2+4', 'Backbreaker', 't', 12, 1, 46, 28, 0, 0, 'grab', { unbl: true, grab: THR.back(12, 28), an: { script: 'back' } }),
    mv('pile', 'd/f+1+2', 'Piledriver', 't', 14, 1, 56, 38, 0, 0, 'grab', { unbl: true, grab: { ...THR.slam(14, 38), low: true }, an: { script: 'slam' }, aiWeight: 1 }),
    mv('splash', '3+4', 'Elbow Drop', 'm', 22, 3, 34, 22, -18, 0, 'chop', { ht: 'kd', gh: true, yc: [[0, 0], [10, 0.3], [20, 0.5], [30, 0]], pc: [6, 18] }),
    mv('clothes', 'wr+2', 'Charging Clothesline', 'm', 14, 3, 28, 20, -14, 0, 'hook', { ht: 'stag', mv: [[1, 12, 1.0]], push: 1.1, ws: true, wsDmg: 10 }),
    rageArt({ name: 'Total Devastation', first: 12, hits: [8, 10, 12, 16, 24], after: 'kd', script: 'rageA', pre: 'hook', spacing: 10, an: { seq: ['hR', 'hL', 'hR', 'hL'], finish: 'hR' } }),
    heatSmash({ name: 'Giant Crush', hits: [10, 12, 20], script: 'smashA', an: { seq: ['hR', 'hL'], finish: 'hR' } }),
    rageDrive({ name: 'Wrecking Ball', dmg: 30, pre: 'shoulder' }),
  ],
);

export default {
  id: 'bruno', name: 'Bruno Kowalski', nameTH: 'บรูโน โควัลสกี', title: 'The Bear', style: 'Pro Wrestling', styleTH: 'มวยปล้ำอาชีพ', country: 'PL',
  desc: 'A 150 kg wrestler. Slow but enormous damage, power-crushing shoulders and five different throws.',
  descTH: 'นักมวยปล้ำร่างยักษ์ ช้าแต่ดาเมจมหาศาล มีท่า Power Crush และท่าทุ่มถึง 5 แบบ',
  stats: { power: 5, speed: 1, range: 3, tech: 3, defense: 4 }, difficulty: 2,
  lead: 'L', intro: 'roar', win: 'roar', hpMul: 1.06, walkF: 0.88, walkB: 0.9, dashF: 0.92, run: 0.9, jump: 0.92,
  idle: { hands: 'wide', bob: 0.014 },
  body: {
    scale: 1.12, build: [1.25, 1.32, 1.35, 1.25, 1.05], skin: '#e0b090',
    hair: { style: 'short', color: '#4a2f16' },
    top: { kind: 'none', color: '#000' }, bottom: { kind: 'trunks', color: '#1e4ac8', trim: '#f2f2f2' },
    hands: { kind: 'wraps', color: '#f2f2f2' }, feet: { kind: 'boots', color: '#f0f0f0' }, extra: ['belt:#f2c94c'], glow: '#5aa0ff',
  },
  alts: [
    { name: 'Red Bull', bottom: { color: '#b3122b', trim: '#111' }, feet: { color: '#111' } },
    { name: 'Forest', bottom: { color: '#1e6b3a', trim: '#f2c94c' }, feet: { color: '#2a2a2a' } },
    { name: 'Blackout', bottom: { color: '#111', trim: '#c81e1e' }, feet: { color: '#111' }, hands: { color: '#c81e1e' } },
  ],
  moves, stances: {},
};
