import { buildMoves, PRE, mv, rageArt, heatSmash, rageDrive, THR } from '../lib.js';

// Marcus "Hammer" Reed - boxer: fast jab strings, hooks, weaves, peek-a-boo guard
const j121 = mv('j121', null, 'Jab-Cross-Hook', 'h', 6, 2, 17, 10, -7, 2, 'hookL', { next: { 2: 'j1212' }, ht: 'stag', push: 0.5 });
const j1212 = mv('j1212', null, 'One-Two-Hook-Cross', 'h', 6, 2, 22, 13, -10, 0, 'cross', { ht: 'stag', push: 0.7 });
const wv_hook = mv('wv_hook', null, 'Weave Hook', 'm', 8, 2, 20, 12, -8, 3, 'bodyhook', { ht: 'stag' });
const wv_up = mv('wv_up', null, 'Weave Uppercut', 'm', 10, 2, 24, 15, -14, 0, 'upperL', { ht: 'launch', lvy: 0.165 });
const wv = mv('weave', 'd/b+1', 'Bob & Weave', 'm', 15, 1, 8, 0, 0, 0, 'jab', { noHit: true, noAI: true, hb: [[1, 22, 'crouch']], inv: [[3, 20, 'h']], next: { 1: 'wv_hook', 2: 'wv_up' }, cf: 12, cw: 3, cwe: 22, crouchMove: true, mv: [[2, 14, 0.3]], aiWeight: 1 });
const moves = buildMoves(
  { dmg: 1.1, spd: 0 },
  {
    j1: { name: 'Jab', dmg: 7, st: 9 }, j2: { name: 'Cross', dmg: 10, st: 11 },
    j12: { name: 'One-Two', dmg: 10, next: { 1: 'j121' } },
    j123: null,
    j21: { name: 'Cross-Jab' },
    k3: { name: 'Front Kick', dmg: 6, st: 14, next: {} }, k4: { name: 'Roundhouse', dmg: 9, st: 17 },
    f2: { name: 'Haymaker', ...PRE.hook, lv: 'm', st: 16, ac: 3, rec: 24, dmg: 18, blk: -12, hit: 3, he: true, cht: 'launch', ws: true, wsDmg: 8, wb: true, push: 0.9, ht: 'stag', aiWeight: 1.5 },
    f3: { name: 'Push Kick', dmg: 8 }, f4: { name: 'Roundhouse Kick', dmg: 12 },
    df1: { name: 'Body Jab', st: 11 },
    df2: { name: 'Gazelle Uppercut', ...PRE.upperL, st: 14, dmg: 15, lvy: 0.168 },
    df3: { name: 'Low Kick', ...PRE.lowkick, lv: 'l', dmg: 8, blk: -12, ht: 'n' },
    df4: { name: 'Body Blow', ...PRE.bodyhook, st: 15, dmg: 14, ht: 'stag' },
    th13: { name: 'Clinch Toss', grab: THR.hip(10, 24), an: { script: 'hip' }, dmg: 24 },
    th24: { name: 'Spin Toss', grab: THR.suplex(10, 26), an: { script: 'suplex' }, dmg: 26 },
    ws2: { name: 'Flash Uppercut', st: 13, dmg: 14 }, ws4: { name: 'Rising Knee', ...PRE.knee, lv: 'm', st: 14, ht: 'launch', lvy: 0.16, dmg: 13 },
  },
  [
    j121, j1212, wv, wv_hook, wv_up,
    mv('bolo', '1+2', 'Corkscrew Blow', 'm', 15, 2, 22, 16, -14, 0, 'upper', { ht: 'launch', lvy: 0.17, pc: [3, 14], aiWeight: 1 }),
    mv('flick', 'wr+1', 'Flicker Jab', 'h', 9, 2, 12, 6, -3, 4, 'jab', { mv: [[1, 8, 0.5]] }),
    mv('peekin', 'd/f+1+2', 'Peek-a-Boo', 'm', 10, 1, 6, 0, 0, 0, 'jab', { toStance: 'peek', noHit: true, noAI: true, dmg: 0 }),
    mv('pk_jab', '1', 'Peek Jab', 'h', 9, 2, 13, 6, 0, 6, 'jab', { ctx: 'st:peek' }),
    mv('pk_hook', '2', 'Peek Hook', 'm', 13, 2, 20, 13, -9, 2, 'hook', { ctx: 'st:peek', ht: 'stag' }),
    mv('pk_body', '3', 'Peek Body Shot', 'm', 12, 2, 18, 10, -6, 3, 'bodyhookL', { ctx: 'st:peek' }),
    mv('pk_up', '4', 'Peek Uppercut', 'm', 15, 2, 24, 15, -14, 0, 'upper', { ctx: 'st:peek', ht: 'launch', lvy: 0.165 }),
    rageArt({ name: 'Knockout Barrage', first: 10, hits: [4, 4, 5, 5, 6, 6, 8, 10, 14], after: 'launch', script: 'rageA', spacing: 6, pre: 'jab', an: { seq: ['hL', 'hR', 'hL', 'hR', 'hL', 'hR', 'hL', 'hR'], finish: 'hL' } }),
    heatSmash({ name: 'Bolo Blast', hits: [6, 10, 18], an: { seq: ['hL', 'hR'], finish: 'hR' } }),
    rageDrive({ name: 'Hammer Drive', dmg: 26, pre: 'upper' }),
  ],
).filter(Boolean);
// boxers do not chain kicks
for (const m of moves) if (m.id === 'j123' || m.id === 'k34') m.__drop = true;

export default {
  id: 'marcus', name: 'Marcus Reed', nameTH: 'มาร์คัส รีด', title: 'The Hammer', style: 'Boxing', styleTH: 'มวยสากล', country: 'US',
  desc: 'Heavyweight boxer. Deadly punch strings, weaving under highs and an auto-guarding Peek-a-Boo stance.',
  descTH: 'นักมวยสากลรุ่นเฮฟวี่เวท หมัดต่อเนื่องอันตราย หลบด้วย Weave และท่าตั้งการ์ด Peek-a-Boo',
  stats: { power: 4, speed: 4, range: 2, tech: 3, defense: 4 }, difficulty: 3,
  lead: 'L', intro: 'fists', win: 'fist', walkF: 1.02,
  idle: { hands: 'high', bounce: 0.014, bounceSpeed: 8 },
  body: {
    scale: 1.05, build: [1.15, 1.15, 1.2, 1.0, 1.0], skin: '#7a4a30',
    hair: { style: 'bald', color: '#111' },
    top: { kind: 'none', color: '#000' }, bottom: { kind: 'trunks', color: '#1a2a5a', trim: '#ffd23f' },
    hands: { kind: 'gloves', color: '#c81e1e' }, feet: { kind: 'boots', color: '#111111' }, extra: ['chain:#f2c94c'], glow: '#ffd23f',
  },
  alts: [
    { name: 'Gold Gloves', hands: { color: '#d4a017' }, bottom: { color: '#111', trim: '#d4a017' } },
    { name: 'Green Machine', hands: { color: '#1ea85a' }, bottom: { color: '#0e3a22', trim: '#f2f2f2' } },
    { name: 'White Lightning', hands: { color: '#f2f2f2' }, bottom: { color: '#f2f2f2', trim: '#1a2a5a' }, hair: { style: 'short', color: '#111' } },
  ],
  moves: moves.filter((m) => !m.__drop),
  stances: {
    peek: { name: 'Peek-a-Boo', exitBack: true, timeout: 200, walk: 0.7, autoGuard: true,
      look: { hips: [0, 0.82, 0.02], hipsRot: [8, -6, 0], spine: [16, -10, 0], head: [-16, 4, 0], hL: [-0.12, 1.5, 0.28], hR: [0.10, 1.46, 0.26], bob: 0.014 } },
  },
};
