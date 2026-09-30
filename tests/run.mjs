// Headless simulation tests. Run: node tests/run.mjs
import kenzo from '../src/data/chars/kenzo.js';
import { mk, run, place, evs, inp, NEUTRAL, ST } from './helpers.mjs';

let pass = 0, fail = 0;
function ok(name, cond, info = '') {
  if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + ' ' + info); }
}

// 1. jab connects at close range, frame data matches
{
  const m = mk(kenzo, kenzo);
  place(m, 1.3);
  const [a, b] = m.fighters;
  const hp0 = b.hp;
  run(m, [[1, { b1: true }], [1, {}]], null, 30);
  const h = evs(m, 'hit');
  ok('jab hits at 1.3m', h.length === 1, JSON.stringify(h.map((e) => e.f)));
  ok('jab damage 6', hp0 - b.hp === 6, 'dmg ' + (hp0 - b.hp));
  const mv = evs(m, 'move')[0];
  const hitFrame = h[0] && mv ? h[0].f - mv.f + 1 : -1;
  ok('jab startup i10 (measured ' + hitFrame + ')', hitFrame === 10 || hitFrame === 11, 'startup ' + hitFrame);
}

// 2. jab whiffs at long range
{
  const m = mk(kenzo, kenzo);
  place(m, 3.2);
  run(m, [[1, { b1: true }], [1, {}]], null, 40);
  ok('jab whiffs at 3.2m', evs(m, 'hit').length === 0);
}

// 3. block: defender holds back (P2 back = right key)
{
  const m = mk(kenzo, kenzo);
  place(m, 1.0);
  const [a, b] = m.fighters;
  run(m, [[1, { b1: true }], [1, {}]], [[40, { r: true }]], 0);
  ok('jab blocked', evs(m, 'block').length === 1 && evs(m, 'hit').length === 0, 'blocks ' + evs(m, 'block').length);
}

// 4. low beats stand block, mid beats crouch block
{
  const m = mk(kenzo, kenzo);
  place(m, 0.95);
  run(m, [[1, { d: true, b1: true }], [1, { d: true }], [1, {}]], [[45, { r: true }]], 0);
  ok('low hits standing blocker', evs(m, 'hit').length === 1 && evs(m, 'block').length === 0, JSON.stringify(m.events.filter((e) => e.t === 'hit' || e.t === 'block' || e.t === 'move')));
}
{
  const m = mk(kenzo, kenzo);
  place(m, 1.3);
  // p1 uses d/f+1 (mid); p2 crouch-blocks (d + back)
  run(m, [[1, { d: true, r: true, b1: true }], [40, {}]], [[10, { d: true, r: true }], [40, { d: true, r: true }]], 0);
  ok('mid hits crouch blocker', evs(m, 'hit').length === 1 && evs(m, 'block').length === 0, JSON.stringify(m.events.filter((e) => e.t === 'hit' || e.t === 'block' || e.t === 'move')));
}

// 5. high whiffs against crouching
{
  const m = mk(kenzo, kenzo);
  place(m, 1.3);
  run(m, [[1, { b1: true }], [30, {}]], [[45, { d: true }]], 0);
  ok('high (jab) whiffs on crouching target', evs(m, 'hit').length === 0);
}

// 6. throw + throw break
{
  const m = mk(kenzo, kenzo);
  place(m, 1.1);
  const hp0 = m.fighters[1].hp;
  run(m, [[1, { b1: true, b3: true }], [1, {}]], null, 120);
  ok('throw connects and damages 30', hp0 - m.fighters[1].hp === 30, 'dmg ' + (hp0 - m.fighters[1].hp));
}
{
  const m = mk(kenzo, kenzo);
  place(m, 1.1);
  const hp0 = m.fighters[1].hp;
  run(m, [[1, { b1: true, b3: true }], [1, {}]], [[12, {}], [1, { b1: true }], [1, {}]], 60);
  ok('throw break negates damage', evs(m, 'break').length === 1 && m.fighters[1].hp === hp0, 'breaks ' + evs(m, 'break').length + ' hp ' + m.fighters[1].hp);
}

// 7. launcher + juggle: df+2 launches then j1 etc. (checks airborne state)
{
  const m = mk(kenzo, kenzo);
  place(m, 1.3);
  const [a, b] = m.fighters;
  run(m, [[1, { d: true, r: true, b2: true }], [1, {}]], null, 30);
  ok('d/f+2 launches (P2 airborne)', b.state === ST.AIR && b.y > 0.3, b.state + ' y=' + b.y);
}

// 8. AI-free stability: random inputs for 5000 frames, no NaN, hp bounds
{
  const m = mk(kenzo, kenzo, { time: 0 });
  let seed = 12345;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  let bad = null;
  for (let i = 0; i < 6000 && !bad; i++) {
    const r = () => inp({ l: rnd() < 0.3, r: rnd() < 0.3, u: rnd() < 0.15, d: rnd() < 0.2, b1: rnd() < 0.12, b2: rnd() < 0.12, b3: rnd() < 0.12, b4: rnd() < 0.12 });
    m.step([r(), r()]);
    for (const f of m.fighters) {
      if (!Number.isFinite(f.x) || !Number.isFinite(f.y) || !Number.isFinite(f.z) || f.hp > f.maxHp + 0.001) bad = `frame ${i} f${f.idx} x=${f.x} y=${f.y} hp=${f.hp}`;
    }
    if (m.over) break;
  }
  ok('random-input fuzz stable', !bad, bad || '');
  console.log('   fuzz end: phase', m.phase, 'wins', m.wins, 'round', m.round);
}

// 9. wall break: both fighters end up apart inside the next arena, and a new round resets the arena
{
  const tawan = (await import('../src/data/chars/tawan.js')).default;
  const { STAGES } = await import('../src/render/stagesData.js');
  const dojo = STAGES.find((s) => s.id === 'dojo');
  const m = mk(tawan, kenzo, { time: 0 }, dojo);
  const [a, b] = m.fighters;
  a.x = 6.55; b.x = 7.7; a.z = 0; b.z = 0;
  run(m, [[1, { r: true, b2: true }], [1, {}]], null, 60);
  const wb = evs(m, 'wallbreak');
  ok('wall break happens on the dojo wall', wb.length === 1 && m.pIdx === 1, 'events ' + wb.length + ' pIdx ' + m.pIdx);
  const cx = dojo.phases[1].center[0];
  const sep = Math.hypot(a.x - b.x, a.z - b.z);
  ok('fighters are separated in the new arena (' + sep.toFixed(2) + ' m)', sep > 0.5, 'sep ' + sep);
  ok('fighters stay near the new arena centre', Math.abs(a.x - cx) < 8 && Math.abs(b.x - cx) < 8, `a.x ${a.x} b.x ${b.x}`);
  m.startRound();
  ok('new round resets arena phase', m.pIdx === 0 && evs(m, 'phase').length >= 1);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
