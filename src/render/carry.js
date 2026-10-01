// Hand "carry": a hand target authored in root space for a given torso pose is moved rigidly with the shoulder when the torso is
// then modified (twist, lean, lunge ...).  Guard hands therefore stay with the body instead of staying put in the air.
import * as THREE from 'three';

const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3();
const _s0 = [0, 0, 0], _s1 = [0, 0, 0];

// rig: Rig; P: pose after torso modifiers; M: pose snapshot the hand targets were authored for
export function carryHands(rig, P, M, pinned) {
  for (const key of ['hL', 'hR']) {
    const t = P._r[key];
    if (!t || (pinned && pinned[key])) continue;
    rig.shoulderFrame(M, key, _s0, _q1);
    rig.shoulderFrame(P, key, _s1, _q2);
    _q1.invert(); _q2.multiply(_q1);                                      // rotation from the authored chest to the current chest
    _v.set(-(t[0] - _s0[0]), t[1] - _s0[1], t[2] - _s0[2]).applyQuaternion(_q2);
    t[0] = _s1[0] - _v.x; t[1] = _s1[1] + _v.y; t[2] = _s1[2] + _v.z;
  }
}
