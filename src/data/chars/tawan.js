import { buildMoves, PRE, mv, link, rageArt, heatSmash, rageDrive, THR } from '../lib.js';

// Tawan Srisuk - Muay Thai: elbows, knees, roundhouses, clinch
const moves = buildMoves(
  { dmg: 1.03, spd: 0, reach: 1.0 },
  {
    j123: { name: 'Jab-Cross-Knee', ...PRE.knee, lv: 'm', st: 9, ac: 2, rec: 22, dmg: 13, blk: -10, hit: 0, ht: 'stag', push: 0.7, pushB: 0.6 },
    k3: { name: 'Teep', ...PRE.teep, next: {} },
    k4: { name: 'Thai Roundhouse', dmg: 17, ht: 'stag', push: 0.7, st: 15, blk: -9 },
    f2: { name: 'Sok Ti (Elbow)', he: true, cht: 'launch', dmg: 16, ws: true, wsDmg: 8, wb: true },
    f3: { name: 'Khao Trong (Knee)', ...PRE.kneeL, lv: 'm', st: 14, ac: 3, rec: 21, dmg: 13, blk: -8, hit: 3, ht: 'stag', push: 0.7 },
    f4: { name: 'Lek Kick', dmg: 18 },
    df2: { name: 'Sok Ngat (Rising Elbow)', ...PRE.upper, limb: 'eR', style: 'upper', A: [0.20, 0.8, 0.2], P: [0.06, 1.0, 0.8], Q: [0.02, 1.55, 0.9], r: 0.22, st: 14 },
    df3: { name: 'Low Roundhouse', ...PRE.loround, lv: 'l', st: 14, dmg: 9, blk: -13, hit: -1, ht: 'n' },
    df4: { name: 'Kick Check', dmg: 16 },
    d3: { name: 'Leg Kick', ...PRE.lowkickR, lv: 'l', st: 13, dmg: 8, blk: -12 },
    ws4: { name: 'Rising Shin' },
    th13: { name: 'Clinch Knees', grab: THR.knees(10, 7), an: { script: 'knees' }, dmg: 30 },
    th24: { name: 'Muay Thai Toss', grab: THR.hip(10, 30), an: { script: 'hip' } },
  },
  [
    mv('spinelbow', 'b+2', 'Sok Klap (Spinning Elbow)', 'h', 17, 2, 26, 17, -12, 0, 'spinback', { ht: 'stag', push: 0.7, aiWeight: 1 }),
    mv('flyknee', '3+4', 'Kao Loi (Flying Knee)', 'm', 18, 3, 28, 20, -14, 0, 'knee', { ht: 'launch', lvy: 0.17, mv: [[2, 16, 1.0]], yc: [[0, 0], [9, 0.32], [18, 0.4], [26, 0]], aiWeight: 1.5 }),
    mv('guardup', 'b+3', 'Yok Khao (Knee Guard)', 'm', 12, 1, 8, 0, 0, 0, 'kneeL', { toStance: 'khao', P: [-0.06, 0.7, 0.3], Q: [-0.06, 0.7, 0.3], r: 0.1, dmg: 0, ac: 1, unbl: true, noHit: true, noAI: true }),
    mv('kh_kick', '4', 'Guard Kick', 'm', 12, 3, 22, 16, -10, 0, 'midround', { ctx: 'st:khao', ht: 'stag', push: 0.6, aiWeight: 2 }),
    mv('kh_knee', '3', 'Guard Knee', 'm', 10, 2, 19, 11, -6, 2, 'kneeL', { ctx: 'st:khao', mv: [[2, 8, 0.3]] }),
    mv('kh_elbow', '2', 'Guard Elbow', 'm', 11, 2, 20, 13, -8, 3, 'elbow', { ctx: 'st:khao', ht: 'stag' }),
    mv('kh_jab', '1', 'Guard Jab', 'h', 9, 2, 14, 6, -1, 6, 'jab', { ctx: 'st:khao' }),
    mv('kh_low', 'd+4', 'Guard Low Kick', 'l', 13, 2, 22, 9, -12, 0, 'lowkickR', { ctx: 'st:khao', dmg: 9 }),
    rageArt({ name: 'Ram Muay Fury', first: 10, hits: [5, 5, 6, 8, 8, 10, 14], after: 'launch', script: 'rageA', pre: 'elbow', an: { seq: ['hR', 'fL', 'hL', 'fR', 'hR', 'fL', 'hR'], finish: 'fR' } }),
    heatSmash({ name: 'Tiger Knee Strike', hits: [7, 9, 17], script: 'smashA', an: { seq: ['fR', 'hL'], finish: 'hR' } }),
    rageDrive({ name: 'Naga Knee', dmg: 26, pre: 'knee' }),
  ],
);
const byId = Object.fromEntries(moves.map((m) => [m.id, m]));
byId.j12.next = { 3: 'j123' };

export default {
  id: 'tawan', name: 'Tawan Srisuk', nameTH: 'ตะวัน ศรีสุข', title: 'Eight Limbs', style: 'Muay Thai', styleTH: 'มวยไทย', country: 'TH',
  desc: 'A Muay Thai champion from Bangkok. Elbows, knees and brutal roundhouses; the Knee Guard stance mixes offence and defence.',
  descTH: 'แชมป์มวยไทยจากกรุงเทพฯ ใช้ศอก เข่า และเตะกวาดสุดโหด ท่าตั้งการ์ดเข่าผสมทั้งรุกและรับ',
  stats: { power: 4, speed: 4, range: 3, tech: 3, defense: 3 }, difficulty: 3,
  lead: 'L', intro: 'bow', win: 'fist',
  idle: { hands: 'high', bounce: 0.010, bounceSpeed: 8 },
  body: {
    scale: 1.0, build: [1.05, 1.0, 1.05, 1.08, 1.0], skin: '#c48a5a',
    hair: { style: 'short', color: '#121212' },
    top: { kind: 'none', color: '#000' }, bottom: { kind: 'trunks', color: '#c81e1e', trim: '#f2c94c' },
    hands: { kind: 'wraps', color: '#f2f2f2' }, feet: { kind: 'bare' }, extra: ['mongkhon:#f5f5f5', 'armbands:#c81e1e'], glow: '#ffd23f',
  },
  alts: [
    { name: 'Azure', bottom: { color: '#1e5ac8', trim: '#f2f2f2' }, extra: ['mongkhon:#f5f5f5', 'armbands:#1e5ac8'] },
    { name: 'Gold Champion', bottom: { color: '#d4a017', trim: '#111111' }, extra: ['mongkhon:#111111', 'armbands:#d4a017'] },
    { name: 'Shadow', bottom: { color: '#111111', trim: '#c81e1e' }, skin: '#a9724a', extra: ['mongkhon:#c81e1e', 'armbands:#111111'] },
  ],
  moves,
  stances: {
    khao: { name: 'Knee Guard', exitBack: true, timeout: 150, walk: 0.5, autoGuard: false,
      look: { hipsRot: [3, -8, 0], hL: [-0.16, 1.5, 0.30], hR: [0.14, 1.46, 0.28], fL: [-0.14, 0.42, 0.42], fR: [0.2, 0, -0.14], kneePole: [0.1, 0.1, 1], bob: 0.012 } },
  },
};
