import kenzo from '../src/data/chars/kenzo.js';
import { mk, run, place, evs, inp, NEUTRAL, ST, Script } from './helpers.mjs';
import { evalStrike } from '../src/sim/combat.js';
{
  const m = mk(kenzo, kenzo);
  place(m, 1.3);
  const [a, b] = m.fighters;
  const s0 = new Script([[1, { b1: true }], [1, {}]]), s1 = new Script([[40, { r: true }]]);
  for (let i = 0; i < 20; i++) {
    m.step([s0.next(), s1.next()]);
    console.log(i, 'a', a.state, a.mf, a.move && a.move.id, 'b', b.state, 'guard', b.guard, 'dir', b.dir, 'hp', b.hp, 'hitstop', m.hitstop);
  }
  console.log(m.events.filter(e => e.t !== 'move'));
}
console.log('---- low');
{
  const m = mk(kenzo, kenzo);
  place(m, 1.3);
  const [a, b] = m.fighters;
  const s0 = new Script([[1, { d: true, b1: true }], [1, { d: true }], [1, {}]]), s1 = new Script([[45, { r: true }]]);
  for (let i = 0; i < 30; i++) {
    m.step([s0.next(), s1.next()]);
    const cap = a.strikeCapsule();
    console.log(i, 'a', a.state, a.mf, a.move && a.move.id, 'x', a.x.toFixed(2), 'b', b.state, 'bx', b.x.toFixed(2), 'cap', cap && cap.a.map(v=>v.toFixed(2)).join(','), cap && cap.r.toFixed(2), 'hp', b.hp);
  }
}
