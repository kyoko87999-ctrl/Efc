import { buildMoves, PRE, mv, rageArt, heatSmash, rageDrive, THR } from '../lib.js';

// Jae-ho Park - Taekwondo: long kicks, triple kicks, sway stance
const k343 = mv('k343', null, 'Triple Kick', 'h', 7, 3, 26, 15, -11, 0, 'kickhiR', { ht: 'stag', push: 0.7 });
const df34 = mv('df34', null, 'Stab-Roundhouse', 'm', 8, 3, 24, 13, -12, 0, 'midround', { ht: 'stag' });
const moves = buildMoves(
  { dmg: 1.0, spd: -1, reach: 1.06 },
  {
    j1: { dmg: 5 }, j2: { dmg: 7 }, j123: { name: 'Punch-Punch-Kick', dmg: 13 },
    k3: { name: 'Snap Kick', st: 11, dmg: 8, blk: -3, hit: 5, next: { 4: 'k34' } },
    k34: { name: 'Snap-Roundhouse', st: 8, dmg: 15, next: { 3: 'k343' } },
    k4: { name: 'Speed Roundhouse', st: 13, dmg: 15, blk: -7 },
    f2: { name: 'Palm Strike', ...PRE.palm, he: false, dmg: 12 },
    f3: { name: 'Axe Kick', ...PRE.axe, lv: 'm', st: 19, ac: 3, rec: 24, dmg: 18, blk: -13, hit: 0, he: true, cht: 'launch', ht: 'n', ws: true, wsDmg: 8 },
    f4: { name: 'Flamingo Kick', ...PRE.sidekick, lv: 'm', st: 17, dmg: 17, ht: 'stag', push: 1.0 },
    df3: { name: 'Stab Kick', next: { 4: 'df34' } },
    df4: { name: 'Hook Kick', ...PRE.hiroundL, lv: 'm', dmg: 17 },
    df2: { name: 'Rising Fist', st: 15 },
    d4: { name: 'Sweep Kick' }, ws3: { name: 'Rising Toe' }, ws4: { name: 'Crescent Launcher', st: 14 },
    air4: { name: 'Flying Roundhouse', dmg: 15 },
    th13: { name: 'Judo Toss', grab: THR.hip(10, 26), an: { script: 'hip' }, dmg: 26 },
    th24: { name: 'Leg Trip Throw', grab: THR.back(10, 26), an: { script: 'back' }, dmg: 26 },
  },
  [
    k343, df34,
    mv('backkick', 'b+4', 'Back Kick', 'm', 16, 3, 26, 17, -13, 0, 'sidekick', { ht: 'kd', push: 1.2, an: { spin: [1, 12, 180] } }),
    mv('tornado', '3+4', 'Tornado Kick', 'h', 21, 3, 32, 22, -16, 0, 'spinkick', { ht: 'launch', lvy: 0.165, aiWeight: 1.3, hom: true }),
    mv('swayin', 'd/b+3', 'Sway Stance', 'm', 8, 1, 6, 0, 0, 0, 'kickhigh', { toStance: 'sway', noHit: true, noAI: true, dmg: 0 }),
    mv('sw_side', '3', 'Sway Side Kick', 'm', 11, 2, 22, 12, -9, 2, 'sidekick', { ctx: 'st:sway', ht: 'stag' }),
    mv('sw_round', '4', 'Sway Roundhouse', 'h', 12, 3, 24, 16, -10, 0, 'hiround', { ctx: 'st:sway', ht: 'stag', aiWeight: 1.5 }),
    mv('sw_low', 'd+3', 'Sway Low', 'l', 12, 2, 22, 8, -12, 0, 'lowkick', { ctx: 'st:sway' }),
    mv('sw_axe', '2', 'Sway Axe Kick', 'm', 16, 3, 26, 15, -13, 0, 'axe', { ctx: 'st:sway', ht: 'kd' }),
    rageArt({ name: 'Thousand Kick Blitz', first: 10, hits: [3, 3, 4, 4, 4, 5, 5, 6, 8, 14], after: 'launch', pre: 'midround', script: 'rageA', spacing: 5, an: { seq: ['fR', 'fL', 'fR', 'fL', 'fR', 'fL', 'fR', 'fL', 'fR'], finish: 'fR' } }),
    heatSmash({ name: 'Meteor Kick', hits: [8, 8, 16], pre: 'midround', an: { seq: ['fR', 'fL'], finish: 'fR' } }),
    rageDrive({ name: 'Sky Piercer', dmg: 25, pre: 'flykick' }),
  ],
);

export default {
  id: 'jaeho', name: 'Jae-ho Park', nameTH: 'แจโฮ ปาร์ค', title: 'Storm Kick', style: 'Taekwondo', styleTH: 'เทควันโด', country: 'KR',
  desc: 'Long-range kicker with blazing speed. Safe pokes and multi-hit kick strings.',
  descTH: 'นักเตะระยะไกลความเร็วสูง โจมตีระยะปลอดภัยและคอมโบเตะหลายทอด',
  stats: { power: 3, speed: 5, range: 5, tech: 4, defense: 2 }, difficulty: 3,
  lead: 'L', intro: 'fists', win: 'flip', dashB: 1.1,
  idle: { hands: 'low', bounce: 0.02, bounceSpeed: 7 },
  body: {
    scale: 1.04, build: [0.95, 0.9, 0.9, 1.0, 0.95], skin: '#f0cba5',
    hair: { style: 'spiky', color: '#e6d9a0' },
    top: { kind: 'gi', color: '#f2f2f2', trim: '#1e4ac8' }, bottom: { kind: 'gi', color: '#f2f2f2', trim: '#1e4ac8' },
    hands: { kind: 'bare' }, feet: { kind: 'bare' }, extra: ['belt:#111111'], glow: '#5aa0ff',
  },
  alts: [
    { name: 'Red Dobok', top: { color: '#f2f2f2', trim: '#c81e1e' }, bottom: { color: '#f2f2f2', trim: '#c81e1e' } },
    { name: 'Black Dobok', top: { color: '#151515', trim: '#f2f2f2' }, bottom: { color: '#151515', trim: '#f2f2f2' }, extra: ['belt:#f2f2f2'] },
    { name: 'Sunset', top: { color: '#ff8a3d', trim: '#151515' }, bottom: { color: '#151515', trim: '#ff8a3d' }, hair: { color: '#151515' } },
  ],
  moves,
  stances: {
    sway: { name: 'Sway Stance', exitBack: true, timeout: 120, walk: 0.5, look: { hipsRot: [4, -22, 0], spine: [4, -26, 0], hL: [-0.4, 1.0, 0.2], hR: [0.3, 1.1, 0.15], fL: [-0.16, 0, 0.42], fR: [0.24, 0, -0.34], bob: 0.02 } },
  },
};
