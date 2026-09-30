import { buildMoves, PRE, mv, rageArt, heatSmash, rageDrive, THR } from '../lib.js';

// Luna Vega - Capoeira: ginga sway, handstand stance, evasive low kicks
const moves = buildMoves(
  { dmg: 1.06, spd: 0, reach: 1.03 },
  {
    j1: { name: 'Quick Jab', dmg: 5 }, j2: { name: 'Cross', dmg: 8 },
    j123: { name: 'Jab-Cross-Meia Lua', ...PRE.hiroundL, lv: 'm', st: 9, ac: 3, rec: 22, dmg: 14, blk: -11, hit: 0, ht: 'stag' },
    k3: { name: 'Ponteira', ...PRE.teep, lv: 'h', st: 12, dmg: 8, next: { 4: 'k34' } },
    k34: { name: 'Ponteira-Armada', ...PRE.spinkick, lv: 'h', st: 10, ac: 3, rec: 26, dmg: 16, blk: -12, ht: 'stag' },
    k4: { name: 'Meia Lua de Frente', ...PRE.hiround, dmg: 15, st: 15 },
    f2: { name: 'Cabecada', ...PRE.headbutt, lv: 'm', st: 15, ac: 2, rec: 22, dmg: 14, blk: -9, hit: 4, he: true, cht: 'launch', ws: true, wsDmg: 6, wb: true },
    f3: { name: 'Queixada', ...PRE.hopkick, lv: 'm', st: 16, dmg: 13, blk: -10 },
    f4: { name: 'Martelo', dmg: 17, st: 17 },
    df1: { name: 'Low Ginga Jab' },
    df2: { name: 'Bencao Launch', ...PRE.rise, st: 15, dmg: 13, ht: 'launch', lvy: 0.165 },
    df3: { name: 'Rasteira', ...PRE.sweep, lv: 'l', st: 15, dmg: 10, blk: -16, hit: 0, ht: 'kd' },
    df4: { name: 'Meia Lua de Compasso', ...PRE.spinkick, lv: 'm', st: 18, dmg: 16, ht: 'stag' },
    d3: { name: 'Low Kick' }, d4: { name: 'Sweep Kick', st: 17 },
    th13: { name: 'Leg Scissor Throw', grab: THR.back(10, 24), an: { script: 'back' }, dmg: 24 },
    th24: { name: 'Flip Toss', grab: THR.suplex(10, 26), an: { script: 'suplex' }, dmg: 26 },
  },
  [
    mv('gingain', 'd+3+4', 'Handstand (Bananeira)', 'm', 14, 1, 8, 0, 0, 0, 'handstand', { toStance: 'hand', noHit: true, noAI: true, dmg: 0, crouchMove: true }),
    mv('hd_kick', '3', 'Handstand Kick', 'm', 11, 3, 24, 13, -9, 1, 'handstand', { ctx: 'st:hand', ht: 'stag', hb: [[1, 30, 'crouch']] }),
    mv('hd_spin', '4', 'Handstand Spin Kick', 'h', 13, 3, 26, 15, -11, 0, 'spinkick', { ctx: 'st:hand', ht: 'launch', lvy: 0.155, aiWeight: 1.5 }),
    mv('hd_sweep', '1', 'Handstand Sweep', 'l', 12, 3, 24, 9, -13, 0, 'sweep', { ctx: 'st:hand', ht: 'kd' }),
    mv('hd_flip', '2', 'Flip Out', 'm', 16, 3, 28, 15, -14, 0, 'flipkick', { ctx: 'st:hand', ht: 'launch', lvy: 0.16, yc: [[0, 0], [8, 0.3], [16, 0.5], [26, 0]] }),
    mv('au', '3+4', 'Au Batido (Cartwheel Kick)', 'h', 20, 3, 32, 17, -16, 0, 'flipkick', { ht: 'kd', lvp: 0.06, an: { flip: [4, 22, -360] }, yc: [[0, 0], [8, 0.4], [16, 0.7], [26, 0]], aiWeight: 1 }),
    mv('macaco', 'b+4', 'Macaco', 'm', 17, 3, 26, 15, -12, 0, 'sidekick', { hb: [[1, 12, 'crouch']], an: { spin: [1, 14, 180] }, ht: 'stag' }),
    rageArt({ name: 'Ginga Storm', first: 10, hits: [4, 4, 5, 5, 6, 7, 8, 9, 14], after: 'launch', pre: 'spinkick', script: 'rageA', spacing: 6, an: { seq: ['fR', 'fL', 'fR', 'fL', 'hR', 'fR', 'fL', 'hL'], finish: 'fR' } }),
    heatSmash({ name: 'Roda de Fogo', hits: [6, 9, 18], pre: 'spinkick', an: { seq: ['fR', 'fL'], finish: 'fR' } }),
    rageDrive({ name: 'Mortal Spin', dmg: 24, pre: 'flipkick' }),
  ],
);

export default {
  id: 'luna', name: 'Luna Vega', nameTH: 'ลูน่า เวก้า', title: 'Ginga Queen', style: 'Capoeira', styleTH: 'คาโปเอร่า', country: 'BR',
  desc: 'Swaying, evasive and unpredictable. Handstand stance opens kicks that dodge highs.',
  descTH: 'ขยับไหวพริบ หลบหลีกและคาดเดายาก ท่าตั้งมือหมุนเตะที่หลบท่าสูงได้',
  stats: { power: 3, speed: 4, range: 4, tech: 5, defense: 2 }, difficulty: 5,
  lead: 'L', intro: 'taunt', win: 'flip', ss: 1.15,
  idle: { hands: 'low', sway: 0.03, swaySpeed: 2.2, bob: 0.008 },
  body: {
    scale: 0.98, build: [0.9, 0.86, 0.9, 0.98, 0.98], skin: '#a86b45',
    hair: { style: 'long', color: '#2a1608' },
    top: { kind: 'tank', color: '#f2c94c', trim: '#1ea85a' }, bottom: { kind: 'pants', color: '#f2f2f2', trim: '#1ea85a' },
    hands: { kind: 'bare' }, feet: { kind: 'bare' }, extra: ['armbands:#1ea85a'], glow: '#3cff9a',
  },
  alts: [
    { name: 'Carnival', top: { color: '#ff3c8a', trim: '#ffd23f' }, bottom: { color: '#101018', trim: '#ff3c8a' }, extra: ['armbands:#ffd23f'] },
    { name: 'Ocean', top: { color: '#1e9ad6', trim: '#f2f2f2' }, bottom: { color: '#f2f2f2', trim: '#1e9ad6' }, extra: ['armbands:#f2f2f2'] },
    { name: 'Nightfall', top: { color: '#2a2a3a', trim: '#9b5cff' }, bottom: { color: '#15151f', trim: '#9b5cff' }, hair: { color: '#9b5cff' }, extra: ['armbands:#9b5cff'] },
  ],
  moves,
  stances: {
    hand: { name: 'Handstand', exitBack: false, timeout: 100, walk: 0,
      look: { hips: [0, 0.56, 0.05], hipsRot: [58, 0, 0], spine: [0, 0, 0], head: [-30, 0, 0], hL: [-0.3, 0.05, 0.75], hR: [0.3, 0.05, 0.75], fL: [-0.18, 1.5, -0.2], fR: [0.18, 1.5, -0.2], bob: 0.01 } },
  },
};
