// Secondary motion: spring-damper bone chains (hair, tails, belts, scarves, wings).
// Each bone is a THREE.Group whose tip (bone.userData.tail, a local offset) is simulated as a damped point mass in
// WORLD space, so the chain lags, swings and overshoots when its parent moves.
import * as THREE from 'three';

const V3 = THREE.Vector3, Q = THREE.Quaternion;
const _head = new V3(), _pq = new Q(), _rq = new Q(), _dir = new V3(), _rest = new V3(), _to = new V3(), _loc = new V3(), _inv = new Q(), _d = new Q(), _acc = new V3();
const GRAV = new V3(0, -9.8, 0);

export class SpringChain {
  // bones: [Group, ...] parent -> child, each with userData.tail (V3 local tip offset)
  // opts: w (natural frequency, rad/s), z (damping ratio), g (gravity scale), amax (clamp, m/s^2), side (limits twist)
  constructor(bones, opts = {}) {
    this.bones = bones.map((g) => {
      const tail = g.userData.tail || new V3(0, -0.1, 0);
      return { g, restQ: g.quaternion.clone(), len: tail.length(), dirLocal: tail.clone().normalize(), tip: new V3(), vel: new V3(), ready: false };
    });
    this.w = opts.w ?? 16; this.z = opts.z ?? 0.4; this.g = opts.g ?? 0.5; this.amax = opts.amax ?? 400; this.gain = opts.gain ?? 1;
  }

  reset() { for (const b of this.bones) b.ready = false; }

  // dt seconds; sc = world scale of the character; call after the parent bones have valid world matrices
  update(dt, sc = 1) {
    if (dt <= 0) return;
    const steps = Math.max(1, Math.min(4, Math.ceil(dt / (1 / 100)))), h = dt / steps;
    const w2 = this.w * this.w, zw = 2 * this.z * this.w;
    for (let s = 0; s < steps; s++) {
      for (const b of this.bones) {
        const g = b.g;
        g.updateMatrixWorld(true);
        g.getWorldPosition(_head);
        g.parent.getWorldQuaternion(_pq);
        _rq.copy(_pq).multiply(b.restQ);
        _dir.copy(b.dirLocal).applyQuaternion(_rq);
        const L = b.len * sc;
        _rest.copy(_head).addScaledVector(_dir, L);
        if (!b.ready) { b.tip.copy(_rest); b.vel.set(0, 0, 0); b.ready = true; }
        // spring toward the rest tip, damping, gravity
        _acc.copy(_rest).sub(b.tip).multiplyScalar(w2).addScaledVector(b.vel, -zw).addScaledVector(GRAV, this.g);
        const am = _acc.length(); if (am > this.amax) _acc.multiplyScalar(this.amax / am);
        b.vel.addScaledVector(_acc, h);
        b.tip.addScaledVector(b.vel, h);
        // keep the bone length
        _to.copy(b.tip).sub(_head);
        const d = _to.length() || 1e-6;
        _to.multiplyScalar(L / d);
        b.tip.copy(_head).add(_to);
        // remove the radial velocity component so the chain swings instead of stretching
        const rv = b.vel.dot(_to) / (L * L || 1);
        b.vel.addScaledVector(_to, -rv);
        // aim the bone: rotation from the rest direction to the simulated direction (in the parent's frame)
        _inv.copy(_rq).invert();
        _loc.copy(_to).normalize().applyQuaternion(_inv);
        _d.setFromUnitVectors(b.dirLocal, _loc);
        if (this.gain !== 1) _d.slerp(new Q(), 1 - this.gain);
        g.quaternion.copy(b.restQ).multiply(_d);
      }
    }
  }
}

// teleports (round reset, wall break) should not whip the chains around
export function resetChains(chains) { for (const c of chains) c.reset(); }
