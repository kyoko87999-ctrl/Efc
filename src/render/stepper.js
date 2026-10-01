// Foot planting + procedural stepping.
// Feet are locked to world positions while they are on the floor.  When the body moves (walking, push-back, lunges,
// circling) a foot that lags behind its "home" position (where the pose wants it, relative to the root) swings to a
// predicted landing spot.  Alternating steps give a boxer's shuffle for any root motion without per-state gait code.
import { clamp } from '../util.js';

const mkFoot = () => ({ mode: 'plant', wx: 0, wz: 0, y: 0, sx: 0, sz: 0, t: 0, T: 8, lift: 0.08, pitch: 0, toe: 0 });
const smooth = (u) => u * u * (3 - 2 * u);

export class FootStepper {
  constructor() { this.reset(); }

  reset() {
    this.feet = [mkFoot(), mkFoot()];
    this.init = false;
    this.lastSwing = 1;
    this.walking = false;
    this.idleT = 0;
    this.hipsX = 0; this.hipsY = 0;
    this.stepCount = 0;
  }

  // P: pose (root-space foot homes in P._r.fL / fR), c = {
  //   x, z, yaw, sc          root transform (yaw in radians)
  //   vx, vz                 world velocity of the root per sim frame
  //   dtF                    frames advanced (0 while frozen)
  //   mode                   'lock' | 'free' | 'slide'
  //   T, lift                swing duration (frames) / lift height for the current state
  //   settle                 distance from home that triggers a corrective step when standing still
  //   teleport               the root jumped: re-plant at the homes
  // }
  update(P, c) {
    const sc = c.sc || 1, ca = Math.cos(c.yaw), sa = Math.sin(c.yaw);
    const toW = (side, fwd) => { const xm = -side * sc, zm = fwd * sc; return [c.x + xm * ca + zm * sa, c.z - xm * sa + zm * ca]; };
    const toL = (wx, wz) => { const dx = wx - c.x, dz = wz - c.z; return [-(dx * ca - dz * sa) / sc, (dx * sa + dz * ca) / sc]; };
    const speed = Math.hypot(c.vx, c.vz) / sc;
    const moving = speed > 0.012;
    const homes = [P._r.fL, P._r.fR];
    const out = { hipsX: 0, hipsY: 0, swinging: -1 };

    if (!this.init || c.teleport) {
      for (let i = 0; i < 2; i++) { const f = this.feet[i]; const w = toW(homes[i][0], homes[i][2]); f.wx = w[0]; f.wz = w[1]; f.mode = 'plant'; f.y = 0; f.pitch = 0; f.toe = 0; }
      this.init = true; this.walking = false;
    }

    // local velocity direction (root frame)
    let vd = [0, 0];
    if (moving) { const a = toL(c.x + c.vx, c.z + c.vz), b = toL(c.x, c.z); vd = [a[0] - b[0], a[1] - b[1]]; const n = Math.hypot(vd[0], vd[1]) || 1; vd = [vd[0] / n, vd[1] / n]; }
    if (!moving) { this.idleT += c.dtF; if (this.idleT > 5) this.walking = false; } else this.idleT = 0;

    const T0 = c.T ?? 8;
    let swinging = -1;
    const free = c.mode === 'free' || c.mode === 'slide';
    for (let i = 0; i < 2; i++) {
      const f = this.feet[i], h = homes[i];
      if (free || h[1] > 0.04) { const w = toW(h[0], h[2]); f.mode = 'free'; f.wx = w[0]; f.wz = w[1]; f.y = h[1]; f.pitch = 0; f.toe = 0; continue; }
      if (f.mode === 'free') { const w = toW(h[0], h[2]); f.mode = 'plant'; f.wx = w[0]; f.wz = w[1]; f.y = 0; f.pitch = 0; f.toe = 0; }
      if (f.mode === 'swing') swinging = i;
    }

    // ---- decide whether a planted foot should start a step
    if (swinging < 0 && !free) {
      let pick = -1, best = -1;
      const info = [];
      for (let i = 0; i < 2; i++) {
        const f = this.feet[i], h = homes[i];
        if (f.mode !== 'plant') { info.push(null); continue; }
        const loc = toL(f.wx, f.wz);
        const ex = loc[0] - h[0], ez = loc[1] - h[2];
        const err = Math.hypot(ex, ez);
        const lag = moving ? -(ex * vd[0] + ez * vd[1]) : 0;
        info.push({ err, lag, ahead: h[0] * vd[0] + h[2] * vd[1] });
      }
      const halfStride = 0.5 * speed * T0;
      for (let i = 0; i < 2; i++) {
        const q = info[i];
        if (!q) continue;
        let need = false, score = 0;
        if (moving) {
          if (q.lag > Math.max(0.05, halfStride)) { need = true; score = q.lag; }
          else if (q.err > Math.max(c.settle ?? 0.2, halfStride * 1.6)) { need = true; score = q.err; }
        } else if (q.err > (c.settle ?? 0.2)) { need = true; score = q.err; }
        if (need && i === this.lastSwing && !(q.err > 0.34)) score *= 0.4;          // alternate feet
        if (need && score > best) { best = score; pick = i; }
      }
      // the first step of a walk starts at once with the foot that leads in the walking direction
      if (pick < 0 && moving && !this.walking && info[0] && info[1]) pick = info[0].ahead >= info[1].ahead ? 0 : 1;
      if (pick >= 0) {
        const f = this.feet[pick];
        f.mode = 'swing'; f.sx = f.wx; f.sz = f.wz; f.t = 0;
        f.T = clamp(moving ? T0 * (speed > 0.06 ? 0.7 : 1) : T0 * 1.2, 4, 16);
        f.lift = c.lift ?? (moving ? clamp(0.05 + speed * 1.2, 0.06, 0.15) : 0.05);
        swinging = pick; this.lastSwing = pick; this.stepCount++;
        if (moving) this.walking = true;
      }
    }

    // ---- advance the swing
    for (let i = 0; i < 2; i++) {
      const f = this.feet[i], h = homes[i];
      if (f.mode !== 'swing') continue;
      const homeW = toW(h[0], h[2]);
      f.t += c.dtF;
      const u = clamp(f.t / f.T, 0, 1), rem = Math.max(0, f.T - f.t);
      // landing spot = where home will be when the swing ends, plus half a stride so the foot passes under the body mid-stance
      const lead = moving ? 0.5 * f.T : 0;
      const lx = homeW[0] + c.vx * (rem + lead), lz = homeW[1] + c.vz * (rem + lead);
      const s = smooth(u);
      f.wx = f.sx + (lx - f.sx) * s; f.wz = f.sz + (lz - f.sz) * s;
      f.y = f.lift * Math.sin(Math.PI * Math.pow(u, 0.8));
      f.pitch = 24 * (1 - smooth(clamp(u / 0.3, 0, 1))) - 14 * smooth(clamp((u - 0.7) / 0.3, 0, 1));
      f.toe = 22 * (1 - smooth(clamp(u / 0.3, 0, 1)));
      if (u >= 1) { f.mode = 'plant'; f.y = 0; f.pitch = 0; f.toe = 0; f.wx = lx; f.wz = lz; }
      else { out.swinging = i; out.hipsX += (i === 0 ? 1 : -1) * 0.013 * Math.sin(Math.PI * u); out.hipsY -= 0.012 * Math.sin(Math.PI * u); }
    }

    // ---- write the locked targets back into the pose
    for (let i = 0; i < 2; i++) {
      const f = this.feet[i], key = i === 0 ? 'fL' : 'fR';
      if (f.mode === 'free') continue;
      const l = toL(f.wx, f.wz);
      P._r[key][0] = l[0]; P._r[key][2] = l[1]; P._r[key][1] = Math.max(P._r[key][1], 0) + f.y;
      (i === 0 ? P.footL : P.footR)[0] += f.pitch;
      P.toe[i] += f.toe;
    }
    const k = Math.min(1, 0.35 * Math.max(c.dtF, 0));
    this.hipsX += (out.hipsX - this.hipsX) * k; this.hipsY += (out.hipsY - this.hipsY) * k;
    out.hipsX = this.hipsX; out.hipsY = this.hipsY;
    return out;
  }
}
