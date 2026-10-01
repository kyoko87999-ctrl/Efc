// Victim-holding scripts (throws, rage arts, heat smashes): the attacker's hands follow the captive and the body performs
// the throw.  The captive's own pose comes from the simulation (capRot / capY), see poses.grabbedPose.
import { set3, add3 } from './pose.js';
import { sampleVic } from '../sim/move.js';
import { clamp, lerp, easeOut, easeInOut } from '../util.js';

const cl01 = (v) => clamp(v, 0, 1);

export function scriptPose(C, P, m, mf) {
  const f = C.f, g = m.grab;
  const script = m.an && m.an.script;
  const t = mf - m.st;
  const vp = g.vic ? sampleVic(g.vic, Math.floor(mf)).p : [0, 1, 0.7];
  const R = C.R;
  C.pin.hL = C.pin.hR = true;
  P.fist = [0.9, 0.9];
  const hold = (dx = 0.18, dy = 0.0, dz = -0.12) => {
    P._r.hL = [vp[0] - dx, Math.max(0.4, vp[1] + dy), vp[2] + dz];
    P._r.hR = [vp[0] + dx, Math.max(0.4, vp[1] + dy), vp[2] + dz];
  };
  void f;
  switch (script) {
    case 'hip': {
      const k1 = easeInOut(cl01(t / 14)), k2 = easeInOut(cl01((t - 14) / 12)), k3 = easeOut(cl01((t - 26) / 8)), k4 = easeInOut(cl01((t - 36) / 10));
      set3(P.hipsRot, 4 + 34 * k2 * (1 - k4) + 12 * k3, -40 * k1 + 110 * k2 * (1 - k4), 0);
      add3(P.spine, 20 * k1 + 20 * k2 - 30 * k4, 20 * k2 * (1 - k4), 0);
      P.hips[1] = 0.86 - 0.10 * k1 + 0.08 * k3;
      hold(0.2, -0.2, -0.05);
      break;
    }
    case 'suplex': {
      const k1 = easeInOut(cl01(t / 14)), k2 = easeInOut(cl01((t - 14) / 16)), k3 = easeInOut(cl01((t - 30) / 12));
      set3(P.hipsRot, -8 * k1 - 30 * k2 + 45 * k3, 0, 0);
      set3(P.spine, -14 * k1 - 32 * k2 + 30 * k3, 0, 0);
      P.hips[2] = -0.04 * k2 - 0.2 * k3; P.hips[1] = 0.84 - 0.04 * k3;
      hold(0.2, 0.05, -0.1);
      break;
    }
    case 'slam': {
      const k1 = easeInOut(cl01(t / 14)), k3 = easeOut(cl01((t - 26) / 12));
      set3(P.hipsRot, -6 * k1 + 40 * k3, 0, 0);
      set3(P.spine, -10 * k1 + 50 * k3, 0, 0);
      P.hips[1] = 0.90 - 0.2 * k3;
      hold(0.2, 0.0, -0.1);
      break;
    }
    case 'knees': {
      const cyc = t / 12;
      const knee = Math.abs(Math.sin(Math.PI * cyc));
      const idx = Math.floor(cyc) % 2;
      hold(0.16, 0.25, -0.1);
      P._r[idx ? 'fL' : 'fR'] = [idx ? -0.16 : 0.16, 0.25 + 0.4 * knee, 0.3 + 0.35 * knee];
      set3(P.spine, 12 + 12 * knee, 0, 0);
      set3(P.hipsRot, -8 * knee, 0, 0);
      break;
    }
    case 'bear': {
      const k1 = easeInOut(cl01(t / 20)), k2 = easeInOut(cl01((t - 20) / 24));
      set3(P.hipsRot, -8 * k1 - 24 * k2 + 30 * cl01((t - 44) / 6), 0, 0);
      set3(P.spine, -12 * k1 - 28 * k2 + 30 * cl01((t - 44) / 6), 0, 0);
      hold(0.22, -0.05, -0.05);
      break;
    }
    case 'back': {
      const k1 = easeInOut(cl01(t / 14)), k2 = easeInOut(cl01((t - 14) / 16));
      set3(P.hipsRot, 16 * k1 + 30 * k2, 0, 0); set3(P.spine, 20 * k1 + 40 * k2, 0, 0);
      hold(0.2, 0.0, -0.05);
      break;
    }
    case 'rageA': case 'rageB': case 'smashA': {
      // barrage: alternate punches / kicks to the held victim on each hit frame
      const hits = g.hits;
      let idx = -1;
      for (let i = 0; i < hits.length; i++) if (mf >= hits[i].f - 4) idx = i;
      const last = idx === hits.length - 1;
      C.pin.hL = C.pin.hR = false;
      if (idx >= 0) {
        const h = hits[idx];
        const k = cl01(1 - Math.abs(mf - h.f) / 4);
        const limbs = (m.an.seq || ['hL', 'hR', 'hL', 'hR', 'fR', 'hR', 'hR']);
        const use = last ? (m.an.finish || 'hR') : limbs[idx % limbs.length];
        const s2 = use.endsWith('L') ? -1 : 1;
        const tgt = [vp[0] + s2 * 0.08, use[0] === 'f' ? 0.95 : 1.25, vp[2] - 0.1];
        const restP = P._r[use] || R[use];
        P._r[use] = [lerp(restP[0], tgt[0], k), lerp(restP[1], tgt[1], k), lerp(restP[2], tgt[2], k)];
        if (use[0] === 'h') C.pin[use] = true;
        add3(P.spine, 8 * k + (last ? 14 * k : 0), s2 * (last ? 40 : 22) * k, 0);
        add3(P.hipsRot, 0, s2 * 10 * k, 0);
        add3(P.hips, 0, -0.04 * k, 0.05 * k);
      }
      break;
    }
    default: hold();
  }
  return P;
}
