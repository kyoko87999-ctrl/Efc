import { buildMoves, PRE, mv, link, rageArt, heatSmash, rageDrive } from '../lib.js';

// Kenzo Ashida - Shotokan-style karate, electrifying crouch-dash game
const demon1 = mv('demon1', null, 'Demon Fist Combo', 'h', 6, 2, 22, 11, -10, 0, 'jab', { limb: 'hL', ht: 'stag', push: 0.5 });
const fang2 = mv('fang2', null, 'Fang Combo', 'h', 6, 2, 18, 9, -6, 2, 'cross');
const moves = buildMoves(
  { dmg: 1.0, spd: 0 },
  {
    f2: { name: 'Lightning Elbow', he: true, cht: 'launch', dmg: 15, ws: true, wsDmg: 6 },
    df2: { name: 'Rising Fist', st: 14 },
    ws4: { name: 'Crescent Kick' },
    df12: { next: { 1: 'demon1' } },
    p12: { name: 'Double Palm Thrust' },
  },
  [
    mv('thunder', 'f,n,d,d/f+2', 'Thunder Fist', 'm', 13, 2, 24, 18, -9, 0, 'upper', { ht: 'launch', lvy: 0.175, ws: true, wsDmg: 8, wb: true, push: 0.4, pushB: 0.8, mv: [[2, 12, 0.35]], an: { elec: true }, aiWeight: 2 }),
    mv('hellsweep', 'f,n,d,d/f+4', 'Hell Sweep', 'l', 15, 3, 30, 14, -17, 0, 'sweep', { ht: 'kd', lvp: 0.05, push: 0.3, an: { elec: true }, aiWeight: 1 }),
    mv('f1', 'f+1', 'Twin Fang', 'h', 12, 2, 16, 8, -4, 4, 'jab', { limb: 'hL', next: { 2: 'fang2' }, hom: false }),
    fang2, demon1,
    mv('heel', '3+4', 'Spinning Heel', 'm', 21, 3, 30, 19, -15, 0, 'spinkick', { ht: 'kd', lvp: 0.07, push: 0.5, hom: true, aiWeight: 1 }),
    mv('wr5', 'wr+2+3', 'Rushing Blade', 'm', 14, 2, 26, 17, -13, 0, 'palm', { mv: [[1, 12, 0.9]], ht: 'launch', lvy: 0.16 }),
    rageArt({ name: 'Storm Judgment', first: 10, hits: [4, 4, 6, 6, 8, 10, 14], after: 'launch', script: 'rageA', an: { seq: ['hL', 'hR', 'hL', 'hR', 'fR', 'hR', 'hL'], finish: 'hR' } }),
    heatSmash({ name: 'Thunder Crash', hits: [6, 8, 16], after: 'kd', script: 'smashA', an: { seq: ['hL', 'hR'], finish: 'fR' } }),
    rageDrive({ name: 'Storm Drive', dmg: 26 }),
  ],
);

export default {
  id: 'kenzo', name: 'Kenzo Ashida', nameTH: 'เคนโซ อาชิดะ', title: 'Storm Fist', style: 'Shotokan Karate', styleTH: 'คาราเต้โชโตกัน', country: 'JP',
  desc: 'A balanced karate master. His crouch-dash lightning strikes reward perfect timing.',
  descTH: 'ปรมาจารย์คาราเต้สมดุล โจมตีสายฟ้าจาก crouch dash ต้องอาศัยจังหวะที่แม่นยำ',
  stats: { power: 4, speed: 4, range: 3, tech: 5, defense: 3 }, difficulty: 4,
  lead: 'L', intro: 'fists', win: 'fist',
  body: {
    scale: 1.0, build: [1.0, 1.0, 1.0, 1.0, 1.0], skin: '#e6b48a',
    hair: { style: 'spiky', color: '#161616' },
    top: { kind: 'gi', color: '#f2f2ee', trim: '#b71c1c' }, bottom: { kind: 'gi', color: '#151515', trim: '#b71c1c' },
    hands: { kind: 'bare' }, feet: { kind: 'bare' }, extra: ['belt:#7f1010'], glow: '#7fd0ff',
  },
  alts: [
    { name: 'Crimson', top: { color: '#7f1010', trim: '#f2f2ee' }, bottom: { color: '#1b1b1b' }, extra: ['belt:#f2f2ee'] },
    { name: 'Midnight', top: { color: '#1c2b4a', trim: '#7fd0ff' }, bottom: { color: '#0d0d14' }, hair: { color: '#9aa7c7' }, extra: ['belt:#7fd0ff'] },
    { name: 'Gold', top: { color: '#d8b04a', trim: '#151515' }, bottom: { color: '#151515' }, extra: ['belt:#151515'] },
  ],
  moves, stances: {},
};
