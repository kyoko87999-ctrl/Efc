// Dynamic fight camera: frames both fighters, orbits as they circle, cuts for KOs and cinematic moves.
import * as THREE from 'three';
import { clamp, lerp, angleDiff, DEG } from '../util.js';
import { ST } from '../sim/fighter.js';

const V = THREE.Vector3;

export class CameraRig {
  constructor(camera) {
    this.cam = camera;
    this.pos = new V(0, 2, 8);
    this.look = new V(0, 1.1, 0);
    this.ang = Math.PI / 2;      // azimuth of camera around the mid point
    this.fov = 40;
    this.shakeAmp = 0;
    this.punch = 0;
    this.roll = 0;
    this.time = 0;
    this.manual = null;         // {pos, look, fov} for menus
    this.cineT = 0;
    this.lastMode = '';
    this._p = new V(); this._l = new V();
  }

  shake(a) { this.shakeAmp = Math.max(this.shakeAmp, a); }
  zoomPunch(a) { this.punch = Math.max(this.punch, a); }

  setManual(pos, look, fov = 38, snap = false) {
    this.manual = { pos: new V(...pos), look: new V(...look), fov };
    if (snap) { this.pos.set(...pos); this.look.set(...look); this.fov = fov; }
  }
  clearManual() { this.manual = null; }

  update(dtF, match, camMax = 12) {
    this.time += dtF;
    let wantPos = this._p, wantLook = this._l, wantFov = 40, rate = 0.12, snapAng = false;
    if (this.manual && !match) {
      wantPos.copy(this.manual.pos); wantLook.copy(this.manual.look); wantFov = this.manual.fov; rate = 0.08;
    } else if (match) {
      const [a, b] = match.fighters;
      const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
      const sep = Math.hypot(a.x - b.x, a.z - b.z);
      const ax = match.axis.x, az = match.axis.z;
      const desiredAng = Math.atan2(ax, -az);   // direction of n = (-az, ax) -> atan2(z, x) = atan2(ax, -az)
      const dAng = angleDiff(this.ang, desiredAng);
      const angRate = 1 - Math.pow(1 - 0.09, dtF);
      this.ang += dAng * angRate;
      const n = { x: Math.cos(this.ang), z: Math.sin(this.ang) };
      const skew = 0.16;
      const nx = n.x * Math.cos(skew) - n.z * Math.sin(skew), nz = n.x * Math.sin(skew) + n.z * Math.cos(skew);
      let D = clamp(3.3 + sep * 0.8, 4.6, 9.2);
      D = Math.min(D, camMax);
      let H = 1.38 + clamp(sep * 0.05, 0, 0.45);
      wantPos.set(mx + nx * D, H, mz + nz * D);
      wantLook.set(mx, 1.12, mz);
      wantFov = 38;
      // intro sweep
      if (match.phase === 'intro') {
        const t = match.phaseT / match.introLen;
        const focus = t < 0.36 ? a : t < 0.66 ? b : null;
        if (match.round === 1 && focus) {
          const f = focus;
          const ang = f.idx === 0 ? 0.9 : -0.9;
          const fx = f.fx, fz = f.fz, rx = -fz, rz = fx;
          const k = (t < 0.36 ? t / 0.36 : (t - 0.36) / 0.3);
          const dist = lerp(3.4, 2.6, k);
          wantPos.set(f.x + (fx * Math.cos(ang) + rx * Math.sin(ang)) * dist, 1.35 + k * 0.1, f.z + (fz * Math.cos(ang) + rz * Math.sin(ang)) * dist);
          wantLook.set(f.x, 1.35, f.z); wantFov = 34; rate = 0.5;
        } else {
          const k = t;
          wantPos.set(mx + nx * (D + 3 - k * 3), H + 0.4 - k * 0.4, mz + nz * (D + 3 - k * 3));
        }
      }
      // KO / round end
      if (match.phase === 'ko' && match.roundWhy === 'ko') {
        const loser = match.roundWinner === 0 ? b : a;
        const t = match.phaseT;
        const ang = this.ang + 0.9 + t * 0.006;
        wantPos.set(loser.x + Math.cos(ang) * 3.2, 1.0 + 0.3 * Math.sin(t * 0.02), loser.z + Math.sin(ang) * 3.2);
        wantLook.set(loser.x, 0.9, loser.z);
        wantFov = 32; rate = 0.06;
      } else if (match.phase === 'roundend' || match.phase === 'matchend') {
        const w = match.roundWinner >= 0 ? match.fighters[match.roundWinner] : null;
        if (w) {
          const t = Math.min(1, match.phaseT / 60);
          wantPos.set(w.x + w.fx * 3.0 + (-w.fz) * 1.0, 1.3, w.z + w.fz * 3.0 + w.fx * 1.0);
          wantLook.set(w.x, 1.3, w.z); wantFov = 36 - 3 * t; rate = 0.08;
        }
      }
      // cinematic moves (rage art / heat smash)
      const att = a.grabbing && a.move && a.move.cine ? a : b.grabbing && b.move && b.move.cine ? b : null;
      if (att && att.grabbing) {
        const def = att.grabbing;
        const m = att.move;
        const t = att.mf - m.st;
        const hits = m.grab.hits || [];
        let idx = 0; for (let i = 0; i < hits.length; i++) if (att.mf >= hits[i].f - 3) idx = i + 1;
        const ux = def.x - att.x, uz = def.z - att.z, ul = Math.hypot(ux, uz) || 1;
        const dx = ux / ul, dz = uz / ul, px = -dz, pz = dx;
        const cx = (att.x + def.x) / 2, cz = (att.z + def.z) / 2;
        const shot = idx % 4;
        const last = idx >= hits.length;
        const s = (this.cineT = this.cineT + dtF);
        if (last) { wantPos.set(cx + px * 5.0 - dx * 1.0, 1.7, cz + pz * 5.0 - dz * 1.0); wantLook.set(cx, 1.1, cz); wantFov = 40; }
        else if (shot === 0) { wantPos.set(cx + px * 2.8 - dx * 0.4, 1.25, cz + pz * 2.8 - dz * 0.4); wantLook.set(cx, 1.15, cz); wantFov = 31; }
        else if (shot === 1) { wantPos.set(att.x - dx * 1.3 + px * 0.9, 1.75, att.z - dz * 1.3 + pz * 0.9); wantLook.set(def.x, 1.2, def.z); wantFov = 40; }
        else if (shot === 2) { wantPos.set(cx - px * 2.2 + dx * 0.3, 0.55, cz - pz * 2.2 + dz * 0.3); wantLook.set(cx, 1.35, cz); wantFov = 36; }
        else { wantPos.set(def.x + dx * 1.4 + px * 1.2, 1.5, def.z + dz * 1.4 + pz * 1.2); wantLook.set(att.x, 1.2, att.z); wantFov = 38; }
        rate = 0.45;
        void t;
      } else this.cineT = 0;
    }
    const k = 1 - Math.pow(1 - rate, dtF);
    this.pos.lerp(wantPos, k);
    this.look.lerp(wantLook, k);
    this.fov = lerp(this.fov, wantFov - this.punch * 4, 1 - Math.pow(0.85, dtF));
    this.punch *= Math.pow(0.9, dtF);
    this.shakeAmp *= Math.pow(0.88, dtF);
    const s = this.shakeAmp;
    const c = this.cam;
    c.position.copy(this.pos);
    if (s > 0.004) { c.position.x += (Math.random() - 0.5) * s * 0.35; c.position.y += (Math.random() - 0.5) * s * 0.35; c.position.z += (Math.random() - 0.5) * s * 0.35; }
    c.lookAt(this.look);
    if (s > 0.004) c.rotateZ((Math.random() - 0.5) * s * 0.05);
    if (Math.abs(c.fov - this.fov) > 0.01) { c.fov = this.fov; c.updateProjectionMatrix(); }
  }
}
