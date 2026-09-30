// Move compilation: raw authoring data -> runtime move object (frame data, hit volumes, stuns).
import { parseCmd, fmtCmd } from './notation.js';
import { easeOut, easeInOut, vlerp, lerp } from '../util.js';

const DEF = {
  lv: 'h', st: 12, ac: 2, rec: 14, dmg: 8, blk: -5, hit: 2, ch: null,
  push: 0.3, pushB: 0.4, ht: 'n', r: 0.2, side: 'f',
  limb: 'hR', A: null, P: [0, 1.4, 0.9], Q: null, style: 'punch',
  mv: null, yc: null, hb: null, inv: null, pc: null,
  gh: false, ja: null, hom: false, ws: false, wb: false, pry: null, he: false,
  req: null, next: null, cf: null, cw: null, cwe: null, grab: null, auto: null, an: null,
  unbl: false, chip: null, hs: null, sfx: null, cine: null,
};

export const DEFAULT_REST = {
  hL: [-0.20, 1.30, 0.32], hR: [0.16, 1.26, 0.24], fL: [-0.17, 0, 0.28], fR: [0.17, 0, -0.14],
  kL: [-0.16, 0.50, 0.34], kR: [0.16, 0.50, -0.08], eL: [-0.24, 1.15, 0.20], eR: [0.22, 1.12, 0.12],
  hd: [0, 1.62, 0.1], sh: [0.1, 1.40, 0.1],
};

export const LEVEL_NAME = { h: 'High', m: 'Mid', l: 'Low', sm: 'Mid', t: 'Throw' };

export function compileMove(d) {
  const m = { ...DEF, ...d };
  if (m.cmd) {
    const p = parseCmd(m.cmd);
    m.dir = p.dir; m.motion = p.motion; m.btn = p.btn;
    if (!d.ctx) m.ctx = p.ctx;
  } else { m.dir = 0; m.motion = null; m.btn = 0; m.ctx = d.ctx || 'chain'; }
  if (!m.id) throw new Error('move without id: ' + JSON.stringify(d));
  m.total = m.st + m.ac - 1 + m.rec;
  m.wf = Math.max(1, m.wf ?? Math.round(m.st * 0.45));
  if (m.wf >= m.st) m.wf = Math.max(1, m.st - 1);
  if (!m.Q) m.Q = m.P;
  if (m.ja === null) m.ja = m.lv !== 'l' && m.lv !== 't';
  const remain = m.total - m.st;
  const stun = (adv) => Math.max(4, remain + 1 + adv);
  m.hitStun = stun(m.hit);
  m.blkStun = stun(m.blk);
  m.chAdv = m.ch ?? m.hit + 3;
  m.chStun = stun(m.chAdv);
  if (m.cf === null) m.cf = m.st + m.ac;
  if (m.cw === null) m.cw = Math.max(1, m.st - 4);
  if (m.cwe === null) m.cwe = m.cf + 4;
  m.pushV = m.push * 0.18;
  m.pushBV = m.pushB * 0.18;
  let mvd = 0;
  if (m.mv) for (const s of m.mv) mvd += s[2];
  m.mvDist = mvd;
  m.reach = Math.max(m.P[2], m.Q[2]) + mvd + m.r;
  m.display = m.cmd ? fmtCmd(m) : '';
  m.cls = m.grab && m.lv === 't' ? 'throw' : m.ht === 'launch' ? 'launcher' : m.lv === 'l' ? 'low' : m.lv === 'sm' ? 'mid' : m.st <= 12 ? 'poke' : m.lv === 'm' ? 'mid' : 'high';
  return m;
}

// Where is the striking limb (root space [side, up, fwd], scale 1) at move frame f?
export function limbAt(m, f, rest) {
  const last = m.st + m.ac - 1;
  if (f <= 0) return rest;
  const A = m.A || vlerp(rest, m.P, 0.5);
  if (f < m.wf) return vlerp(rest, A, easeInOut(f / m.wf));
  if (f < m.st) return vlerp(A, m.P, easeOut((f - m.wf) / (m.st - m.wf)));
  if (f <= last) return m.ac > 1 ? vlerp(m.P, m.Q, (f - m.st) / (m.ac - 1)) : m.P;
  const t = (f - last) / Math.max(1, m.total - last);
  return vlerp(m.Q, rest, easeInOut(t));
}

export function compileChar(def) {
  const moves = new Map();
  const list = [];
  for (const d of def.moves) {
    const m = compileMove(d);
    if (moves.has(m.id)) throw new Error(`duplicate move id ${def.id}:${m.id}`);
    moves.set(m.id, m);
    list.push(m);
  }
  const byCtx = {};
  for (const m of list) {
    if (m.ctx === 'chain') continue;
    (byCtx[m.ctx] ||= []).push(m);
  }
  // priority: motion moves first, then more buttons, then directional, then plain
  for (const k of Object.keys(byCtx)) {
    byCtx[k].sort((a, b) => (b.req ? 1 : 0) - (a.req ? 1 : 0) || (b.motion ? 1 : 0) - (a.motion ? 1 : 0) || (b.motion?.length || 0) - (a.motion?.length || 0));
  }
  // resolve chain links
  for (const m of list) {
    if (m.next && Object.keys(m.next).length) {
      m.nextList = Object.entries(m.next).map(([btn, id]) => {
        const c = moves.get(id);
        if (!c) throw new Error(`${def.id}:${m.id} chains to unknown move ${id}`);
        return { mask: parseCmd(btn).btn, id, move: c };
      });
    }
    if (m.auto && !moves.get(m.auto.id)) throw new Error(`${def.id}:${m.id} auto-chains to unknown ${m.auto.id}`);
    if (m.pry && m.pry.to && !moves.get(m.pry.to)) throw new Error(`${def.id}:${m.id} parry to unknown ${m.pry.to}`);
  }
  // display notation for chained moves ("1,2,3")
  const parent = new Map();
  for (const m of list) if (m.nextList) for (const n of m.nextList) if (!parent.has(n.id)) parent.set(n.id, m.id);
  for (const m of list) {
    if (m.ctx === 'chain' && !m.cmd) {
      const parts = [];
      let cur = m;
      const seen = new Set();
      while (cur && !seen.has(cur.id)) {
        seen.add(cur.id);
        const p = parent.get(cur.id);
        const pm = p && moves.get(p);
        if (pm) {
          const link = pm.nextList.find((n) => n.id === cur.id);
          parts.unshift(String([1, 2, 3, 4].filter((i) => link.mask & (1 << (i - 1))).join('+')));
        } else parts.unshift(cur.display);
        cur = pm;
      }
      m.display = parts.join(',');
    }
  }
  const rest = { ...DEFAULT_REST, ...(def.rest || {}) };
  const mul = { walkF: 1, walkB: 1, dashF: 1, dashB: 1, ss: 1, cd: 1, run: 1, jump: 1 };
  return { ...mul, ...def, rest, moveList: list, moveMap: moves, byCtx };
}

export function sampleVic(kf, f) {
  if (f <= kf[0][0]) return { p: kf[0][1], r: kf[0][2] || [0, 0, 0] };
  for (let i = 1; i < kf.length; i++) {
    if (f <= kf[i][0]) {
      const a = kf[i - 1], b = kf[i];
      const t = easeInOut((f - a[0]) / Math.max(1, b[0] - a[0]));
      const ra = a[2] || [0, 0, 0], rb = b[2] || [0, 0, 0];
      return {
        p: [lerp(a[1][0], b[1][0], t), lerp(a[1][1], b[1][1], t), lerp(a[1][2], b[1][2], t)],
        r: [lerp(ra[0], rb[0], t), lerp(ra[1], rb[1], t), lerp(ra[2], rb[2], t)],
      };
    }
  }
  const l = kf[kf.length - 1];
  return { p: l[1], r: l[2] || [0, 0, 0] };
}
