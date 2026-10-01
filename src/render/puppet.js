// A Puppet = rig + animator driven by a sim Fighter, plus the root transform.
// It has no WebGL / scene dependency, so the same code runs in the game, in Node tests and in tools.
import { Rig, mergeBody } from './rig.js';
import { Animator } from './anim.js';
import { lerp, angleDiff, DEG } from '../util.js';

export class Puppet {
  constructor(f, ch, cust) {
    this.f = f; this.ch = ch;
    const alt = ch.alts && cust?.alt != null ? ch.alts[cust.alt - 1] : null;
    this.rig = new Rig(mergeBody(ch.body, alt, cust?.custom));
    this.anim = new Animator(this.rig, f, ch);
    this.pos = { x: 0, y: 0, z: 0, yaw: 0 };
  }

  // alpha: sub-frame interpolation between the previous and current sim frame
  update(alpha, T, dtF, freeze) {
    const f = this.f, rig = this.rig;
    const P = this.anim.update(alpha, T, freeze);
    if (this.anim.blend > 0) this.anim.blend = Math.max(0, this.anim.blend - dtF);
    const x = lerp(f.px, f.x, alpha), y = lerp(f.py, f.y, alpha), z = lerp(f.pz, f.z, alpha);
    const a0 = Math.atan2(f.pfx, f.pfz), a1 = Math.atan2(f.fx, f.fz);
    const yaw = a0 + angleDiff(a0, a1) * alpha;
    rig.root.position.set(x, y + P.rootY, z);
    rig.root.rotation.y = yaw + P.rootYaw * DEG;
    rig.root.scale.setScalar(f.sc);
    this.pos.x = x; this.pos.y = y; this.pos.z = z; this.pos.yaw = yaw;
    return P;
  }

  dispose() { this.rig.dispose(); }
}
