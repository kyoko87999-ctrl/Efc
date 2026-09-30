// Small shared helpers (no DOM / three.js so the simulation can run in Node)
export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
export const easeIn = (t) => { t = clamp(t, 0, 1); return t * t * t; };
export const easeInOut = (t) => { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const invLerp = (a, b, v) => (a === b ? 0 : clamp((v - a) / (b - a), 0, 1));

export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

// Deterministic PRNG so matches / replays are reproducible.
export class Rng {
  constructor(seed = 1) { this.s = (seed >>> 0) || 1; }
  next() {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
  int(n) { return Math.floor(this.next() * n); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[this.int(arr.length)]; }
}

export const v3 = (x = 0, y = 0, z = 0) => [x, y, z];
export const vlerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const vscale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const vlen = (a) => Math.hypot(a[0], a[1], a[2]);

// Closest distance between point p and segment ab (all [x,y,z])
export function distPointSeg(p, a, b) {
  const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2];
  const apx = p[0] - a[0], apy = p[1] - a[1], apz = p[2] - a[2];
  const l2 = abx * abx + aby * aby + abz * abz;
  let t = l2 > 1e-9 ? (apx * abx + apy * aby + apz * abz) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = apx - abx * t, dy = apy - aby * t, dz = apz - abz * t;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// Closest distance between segments p1q1 and p2q2 (Ericson, Real-Time Collision Detection)
export function distSegSeg(p1, q1, p2, q2) {
  const d1 = [q1[0] - p1[0], q1[1] - p1[1], q1[2] - p1[2]];
  const d2 = [q2[0] - p2[0], q2[1] - p2[1], q2[2] - p2[2]];
  const r = [p1[0] - p2[0], p1[1] - p2[1], p1[2] - p2[2]];
  const a = d1[0] * d1[0] + d1[1] * d1[1] + d1[2] * d1[2];
  const e = d2[0] * d2[0] + d2[1] * d2[1] + d2[2] * d2[2];
  const f = d2[0] * r[0] + d2[1] * r[1] + d2[2] * r[2];
  const EPS = 1e-9;
  let s, t;
  if (a <= EPS && e <= EPS) { s = t = 0; }
  else if (a <= EPS) { s = 0; t = clamp(f / e, 0, 1); }
  else {
    const c = d1[0] * r[0] + d1[1] * r[1] + d1[2] * r[2];
    if (e <= EPS) { t = 0; s = clamp(-c / a, 0, 1); }
    else {
      const b = d1[0] * d2[0] + d1[1] * d2[1] + d1[2] * d2[2];
      const denom = a * e - b * b;
      s = denom > EPS ? clamp((b * f - c * e) / denom, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp(-c / a, 0, 1); }
      else if (t > 1) { t = 1; s = clamp((b - c) / a, 0, 1); }
    }
  }
  const c1 = [p1[0] + d1[0] * s, p1[1] + d1[1] * s, p1[2] + d1[2] * s];
  const c2 = [p2[0] + d2[0] * t, p2[1] + d2[1] * t, p2[2] + d2[2] * t];
  return Math.hypot(c1[0] - c2[0], c1[1] - c2[1], c1[2] - c2[2]);
}

export function fmtTime(frames) {
  const s = Math.floor(frames / 60);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Closest points between two segments; returns { d, c1, c2 }
export function closestSegSeg(p1, q1, p2, q2) {
  const d1 = [q1[0] - p1[0], q1[1] - p1[1], q1[2] - p1[2]];
  const d2 = [q2[0] - p2[0], q2[1] - p2[1], q2[2] - p2[2]];
  const r = [p1[0] - p2[0], p1[1] - p2[1], p1[2] - p2[2]];
  const a = d1[0] * d1[0] + d1[1] * d1[1] + d1[2] * d1[2];
  const e = d2[0] * d2[0] + d2[1] * d2[1] + d2[2] * d2[2];
  const f = d2[0] * r[0] + d2[1] * r[1] + d2[2] * r[2];
  const EPS = 1e-9;
  let s, t;
  if (a <= EPS && e <= EPS) { s = t = 0; }
  else if (a <= EPS) { s = 0; t = clamp(f / e, 0, 1); }
  else {
    const c = d1[0] * r[0] + d1[1] * r[1] + d1[2] * r[2];
    if (e <= EPS) { t = 0; s = clamp(-c / a, 0, 1); }
    else {
      const b = d1[0] * d2[0] + d1[1] * d2[1] + d1[2] * d2[2];
      const denom = a * e - b * b;
      s = denom > EPS ? clamp((b * f - c * e) / denom, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp(-c / a, 0, 1); }
      else if (t > 1) { t = 1; s = clamp((b - c) / a, 0, 1); }
    }
  }
  const c1 = [p1[0] + d1[0] * s, p1[1] + d1[1] * s, p1[2] + d1[2] * s];
  const c2 = [p2[0] + d2[0] * t, p2[1] + d2[1] * t, p2[2] + d2[2] * t];
  return { d: Math.hypot(c1[0] - c2[0], c1[1] - c2[1], c1[2] - c2[2]), c1, c2 };
}
