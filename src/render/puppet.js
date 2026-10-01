// A Puppet = rig + animator driven by a sim Fighter, plus the root transform.
// It has no WebGL / scene dependency, so the same code runs in the game, in Node tests and in tools.
import { Rig, mergeBody } from './rig.js';
import { Animator } from './anim.js';
import * as THREE from 'three';
import { lerp, angleDiff, DEG } from '../util.js';

const _e = new THREE.Euler(0, 0, 0, 'YXZ'), _v = new THREE.Vector3(), _w = new THREE.Vector3(), _Y = new THREE.Vector3(0, 1, 0);

export class Puppet {
  constructor(f, ch, cust) {
    this.f = f; this.ch = ch;
    const alt = ch.alts && cust?.alt != null ? ch.alts[cust.alt - 1] : null;
    this.rig = new Rig(mergeBody(ch.body, alt, cust?.custom));
    this.rig.root.rotation.order = 'YXZ';
    this.anim = new Animator(this.rig, f, ch);
    this.pos = { x: 0, y: 0, z: 0, yaw: 0 };
    this.root = { x: 0, y: 0, z: 0, yaw: 0, sc: f.sc || 1, vx: 0, vz: 0, teleport: true };
    this.started = false;
  }

  // alpha: sub-frame interpolation between the previous and current sim frame; dtF: sim frames since the last call (0 while frozen)
  update(alpha, T, dtF, freeze) {
    const f = this.f, rig = this.rig, R = this.root;
    const x = lerp(f.px, f.x, alpha), y = lerp(f.py, f.y, alpha), z = lerp(f.pz, f.z, alpha);
    const a0 = Math.atan2(f.pfx, f.pfz), a1 = Math.atan2(f.fx, f.fz);
    const yaw = a0 + angleDiff(a0, a1) * alpha;
    const jump = !this.started || Math.hypot(x - this.pos.x, z - this.pos.z) > 0.7;
    R.x = x; R.y = y; R.z = z; R.yaw = yaw; R.sc = f.sc || 1; R.vx = f.x - f.px; R.vz = f.z - f.pz; R.teleport = jump;
    this.started = true;
    const P = this.anim.update(alpha, T, dtF, freeze, R);
    let jx = 0, jz = 0;
    if (this.anim.tremble) { jx = Math.cos(T * 173) * 0.012 * R.sc; jz = Math.sin(T * 151) * 0.012 * R.sc; }
    const q = 1 + P.squash;
    let ox = 0, oy = 0, oz = 0;
    if (P.rootPivot && (P.rootPitch || P.rootRoll)) {
      // rolls turn about a point inside the body, not about the floor
      _e.set(P.rootPitch * DEG, 0, P.rootRoll * DEG, 'YXZ');
      _v.set(0, P.rootPivot, 0); _w.copy(_v).applyEuler(_e); _v.sub(_w).multiplyScalar(R.sc).applyAxisAngle(_Y, yaw);
      ox = _v.x; oy = _v.y; oz = _v.z;
    }
    rig.root.position.set(x + jx + ox, y + P.rootY + oy, z + jz + oz);
    rig.root.rotation.set(P.rootPitch * DEG, yaw + P.rootYaw * DEG, P.rootRoll * DEG);
    rig.root.scale.set(R.sc / Math.sqrt(q), R.sc * q, R.sc / Math.sqrt(q));
    this.pos.x = x; this.pos.y = y; this.pos.z = z; this.pos.yaw = yaw;
    // spring chains (hair, tails, belts, wings) need the final world transform
    rig.dynamics(dtF / 60, R.sc, jump);
    return P;
  }

  dispose() { this.rig.dispose(); }
}
