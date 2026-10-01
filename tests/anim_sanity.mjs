// Animation sanity: random AI fights, every frame checks that the pose is finite, that grounded feet do not sink into the floor
// and that nothing flies off.  node tests/anim_sanity.mjs [matches] [frames]
import * as THREE from 'three';
import { CHARS } from '../src/data/roster.js';
import { compileChar } from '../src/sim/move.js';
import { Match } from '../src/sim/match.js';
import { CpuBrain } from '../src/sim/ai.js';
import { ST } from '../src/sim/fighter.js';
import { STAGES } from '../src/render/stagesData.js';
import { Puppet } from '../src/render/puppet.js';
import { NEUTRAL } from './helpers.mjs';

const MATCHES = +(process.argv[2] || 10), FRAMES = +(process.argv[3] || 1500), SUB = +(process.argv[4] || 1);       // SUB: render frames per sim frame (3 = 180 Hz)
const COMPILED = new Map(CHARS.map((c) => [c.id, compileChar(c)]));
const GRID = STAGES.find((s) => s.id === 'grid');
const V = THREE.Vector3;
const bad = { nan: 0, far: 0, sink: 0 }, byState = {}, firsts = [];
let frames = 0, minFoot = 0;
const detail = {};
const note = (kind, key, info) => { bad[kind]++; (detail[kind + ' ' + key + ' ' + info.split(' ')[0]] = detail[kind + ' ' + key + ' ' + info.split(' ')[0]] || []).push(info); byState[key] = byState[key] || {}; byState[key][kind] = (byState[key][kind] || 0) + 1; if (firsts.length < 12) firsts.push(kind + ' ' + key + ' ' + info); };

for (let g = 0; g < MATCHES; g++) {
  const A = CHARS[g % CHARS.length].id, B = CHARS[(g * 3 + 1) % CHARS.length].id;
  const m = new Match({ chars: [COMPILED.get(A), COMPILED.get(B)], stage: GRID, rules: { time: 0, rounds: 5 }, seed: 31 + g });
  const pup = m.fighters.map((f, i) => new Puppet(f, COMPILED.get(i ? B : A), null));
  const brains = [new CpuBrain(0, 4, g + 1), new CpuBrain(1, 4, g + 9)];
  let t = 0;
  for (let n = 0; n < FRAMES; n++) {
    m.step(brains.map((b) => b.think(m)));
    t++;
    const freeze = m.hitstop > 0;
    for (let s = 1; s <= SUB; s++) pup.forEach((p) => p.update(freeze ? 0 : s / SUB, t / 60, freeze ? 0 : 1 / SUB, freeze));
    pup.forEach((p) => p.rig.root.updateMatrixWorld(true));
    if (freeze) continue;
    frames++;
    for (let i = 0; i < 2; i++) {
      const f = m.fighters[i], p = pup[i], key = f.state + (f.move ? ':' + f.move.id : '');
      const st = f.state + (f.state === ST.HIT && f.hk ? ':' + f.hk.kind : '') + (f.state === ST.AIR && f.air ? ':' + f.air.kind : '');
      const pts = [];
      p.rig.root.traverse((o) => { if (o.isMesh) return; });
      for (const k of ['hL', 'hR', 'fL', 'fR']) { const L = p.rig.limbs[k]; pts.push(L.j0.getWorldPosition(new V()), L.j1.getWorldPosition(new V()), L.j2.getWorldPosition(new V())); }
      pts.push(p.rig.head.getWorldPosition(new V()), p.rig.chest.getWorldPosition(new V()), p.rig.body.getWorldPosition(new V()));
      let ok = true;
      for (const q of pts) { if (!Number.isFinite(q.x + q.y + q.z)) { ok = false; note('nan', st, key); break; } }
      if (!ok) continue;
      for (const q of pts) if (Math.hypot(q.x - f.x, q.z - f.z) > 4.5 || q.y > 6 || q.y < -0.3) { note('far', st, key + ` y=${q.y.toFixed(2)}`); break; }
      // grounded feet (heel / ball / toe) must stay above the floor
      if (f.y < 0.03 && st !== ST.AIR && f.state !== ST.WALL && f.state !== ST.GRAB) {
        for (const k of ['fL', 'fR']) {
          const j2 = p.rig.limbs[k].j2;
          const fp = p.rig.footPoints(k === 'fL' ? 0 : 1).map((a) => j2.localToWorld(new V(a[0], a[1], a[2])));
          for (let qi = 0; qi < fp.length; qi++) { const q = fp[qi]; if (q.y < minFoot) minFoot = q.y; if (q.y < -0.03) { const P = p.anim.P; note('sink', st, key + ` y=${q.y.toFixed(3)} foot=${k} pt=${qi} pitch=${(k === 'fL' ? P.footL : P.footR).map((x) => x.toFixed(0))} toe=${P.toe.map((x) => x.toFixed(0))} r=${P._r[k].map((x) => x.toFixed(2))} fy=${f.y.toFixed(2)}`); break; } }
        }
      }
    }
  }
}
console.log(`frames ${frames}  minFootHeight ${minFoot.toFixed(3)} m   nan ${bad.nan}  far ${bad.far}  sink ${bad.sink}`);
const rows = Object.entries(byState).map(([k, v]) => `${k}: ${Object.entries(v).map(([a, b]) => a + '=' + b).join(' ')}`).sort();
if (rows.length) console.log(rows.join('\n'));
if (firsts.length) console.log('first offenders:\n' + firsts.join('\n'));
console.log('by move:\n' + Object.entries(detail).map(([k, v]) => k + ' x' + v.length + ' ' + v[0]).slice(0, 30).join('\n'));
process.exit(bad.nan ? 1 : 0);
