import { buildMoves, PRE, mv, rageArt, heatSmash, rageDrive, THR } from '../lib.js';

// Mei Lan Zhao - Kung fu: fast palms, soft-palm parry, snake stance
const soft = mv('soft', 'b+2', 'Soft Palm (Parry)', 'm', 6, 1, 26, 0, -10, 0, 'palm', { noHit: true, noAI: true, unbl: true, pry: { w: [3, 18], lv: ['h', 'm'], to: 'softc' }, toStance: null, aiWeight: 0.7 });
const softc = mv('softc', null, 'Reversal Palm', 'm', 4, 2, 20, 16, -8, 0, 'palm', { ht: 'launch', lvy: 0.15, push: 0.3, ws: true });
const twin2 = mv('twin2', null, 'Twin Palms 2', 'h', 5, 2, 17, 8, -5, 3, 'palm');
const twin3 = mv('twin3', null, 'Twin Palms 3', 'm', 7, 2, 22, 12, -12, 0, 'teep', { limb: 'fR', ht: 'stag', push: 0.6 });
twin2.next = { 3: 'twin3' };
const moves = buildMoves(
  { dmg: 0.95, spd: -1 },
  {
    j1: { name: 'Palm Jab', ...PRE.palmL, st: 9, dmg: 5 },
    j2: { name: 'Palm Thrust', ...PRE.palm, st: 11 },
    j123: { name: 'Palm-Palm-Kick', st: 8 },
    f2: { name: 'Iron Palm', ...PRE.palm, he: true, cht: 'launch', st: 14, dmg: 14, ws: true, wsDmg: 7, wb: true },
    f3: { name: 'Crane Kick', ...PRE.kickhigh, lv: 'm', st: 14, dmg: 12, ht: 'stag' },
    f4: { name: 'Dragon Tail Kick', dmg: 16 },
    df2: { name: 'Rising Dragon', st: 14, dmg: 12, lvy: 0.165 },
    df3: { name: 'Tiger Toe', st: 13 },
    d4: { name: 'Whirlwind Sweep', ...PRE.sweep, lv: 'l', st: 16, ht: 'kd' },
    th13: { name: 'Arm Wrap Throw', grab: THR.hip(10, 26), an: { script: 'hip' }, dmg: 26 },
    th24: { name: 'Cartwheel Throw', grab: THR.back(10, 26), an: { script: 'back' }, dmg: 26 },
  },
  [
    mv('twin', 'f+1', 'Twin Palms', 'h', 11, 2, 16, 7, -5, 3, 'palmL', { next: { 2: 'twin2' } }),
    twin2, twin3, soft, softc,
    mv('crane', '3+4', 'Crane Flight', 'm', 19, 3, 30, 17, -14, 0, 'flipkick', { ht: 'launch', lvy: 0.17, yc: [[0, 0], [8, 0.3], [16, 0.55], [26, 0]], aiWeight: 1.2 }),
    mv('snakein', 'd/f+1+2', 'Snake Stance', 'm', 10, 1, 6, 0, 0, 0, 'palm', { toStance: 'snake', noHit: true, noAI: true, crouchMove: true, dmg: 0 }),
    mv('sn_jab', '1', 'Snake Jab', 'm', 10, 2, 16, 6, -1, 6, 'palmL', { ctx: 'st:snake', crouchMove: true }),
    mv('sn_bite', '2', 'Snake Bite', 'm', 13, 2, 20, 11, -8, 2, 'stab', { ctx: 'st:snake', crouchMove: true, ht: 'stag', aiWeight: 2 }),
    mv('sn_low', '3', 'Snake Trip', 'l', 12, 2, 22, 7, -12, 1, 'lowkick', { ctx: 'st:snake', crouchMove: true }),
    mv('sn_rise', '4', 'Rising Fang', 'm', 15, 3, 25, 13, -14, 0, 'rise', { ctx: 'st:snake', ht: 'launch', lvy: 0.16 }),
    rageArt({ name: 'Hundred Palms', first: 9, hits: [3, 3, 4, 4, 5, 5, 6, 8, 12], after: 'launch', pre: 'palm', script: 'rageA', spacing: 6, an: { seq: ['hR', 'hL', 'hR', 'hL', 'hR', 'hL', 'hR', 'hL'], finish: 'fR' } }),
    heatSmash({ name: "Dragon's Roar", hits: [6, 8, 18], pre: 'palm', an: { seq: ['hR', 'hL'], finish: 'hR' } }),
    rageDrive({ name: 'Crane Drive', dmg: 24, pre: 'palm' }),
  ],
);

export default {
  id: 'meilan', name: 'Mei Lan Zhao', nameTH: 'เหม่ยหลาน เจ้า', title: 'Silent Dragon', style: 'Kung Fu', styleTH: 'กังฟู', country: 'CN',
  desc: 'Lightning-fast palms and a parry that turns aggression into launches. Low damage, high skill.',
  descTH: 'ฝ่ามือเร็วดั่งสายฟ้า พร้อมท่า Parry ที่เปลี่ยนการโจมตีของศัตรูให้เป็นการลอยตัว ดาเมจต่ำแต่ใช้ทักษะสูง',
  stats: { power: 2, speed: 5, range: 2, tech: 5, defense: 3 }, difficulty: 5,
  lead: 'L', intro: 'fists', win: 'fist', walkF: 1.06, dashF: 1.05, ss: 1.1,
  idle: { hands: 'high', bob: 0.010 },
  body: {
    scale: 0.96, build: [0.9, 0.82, 0.85, 0.92, 0.98], skin: '#f0c4a0',
    hair: { style: 'buns', color: '#141018' },
    top: { kind: 'tank', color: '#b3122b', trim: '#f2c94c' }, bottom: { kind: 'pants', color: '#141414', trim: '#b3122b' },
    hands: { kind: 'bare' }, feet: { kind: 'shoes', color: '#b3122b' }, extra: ['sash:#f2c94c'], glow: '#ffd23f',
  },
  alts: [
    { name: 'Jade', top: { color: '#1e8a5a', trim: '#f2f2f2' }, bottom: { color: '#101a14', trim: '#1e8a5a' }, feet: { color: '#1e8a5a' }, extra: ['sash:#f2f2f2'] },
    { name: 'Violet', top: { color: '#6b2bd1', trim: '#ffd0f0' }, bottom: { color: '#141018', trim: '#6b2bd1' }, feet: { color: '#6b2bd1' }, hair: { color: '#3a2a5a' }, extra: ['sash:#ffd0f0'] },
    { name: 'Snow', top: { color: '#f2f2f2', trim: '#3a7bd5' }, bottom: { color: '#f2f2f2', trim: '#3a7bd5' }, feet: { color: '#3a7bd5' }, extra: ['sash:#3a7bd5'] },
  ],
  moves,
  stances: {
    snake: { name: 'Snake Stance', exitBack: true, timeout: 140, walk: 0.35,
      look: { hips: [0, 0.55, 0.02], hipsRot: [8, -14, 0], spine: [20, -16, 0], head: [-12, 6, 0], hL: [-0.32, 0.9, 0.5], hR: [0.16, 1.0, 0.28], fL: [-0.24, 0, 0.32], fR: [0.24, 0, -0.14], kneePole: [0.3, 0, 1], bob: 0.01 } },
  },
};
