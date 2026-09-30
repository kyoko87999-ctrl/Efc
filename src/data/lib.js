// Shared move library: hit-volume presets, the universal 4-button move set, throw / cinematic templates.
// Coordinates are fighter-local, scale 1: [side (+right), up, forward].
// Buttons are physical: 1 = left punch, 2 = right punch, 3 = left kick, 4 = right kick.

export const PRE = {
  // ---- punches
  jab:      { limb: 'hL', style: 'jab',    A: [-0.20, 1.32, 0.22], P: [-0.10, 1.47, 0.98], Q: [-0.08, 1.47, 1.02], r: 0.17, mv: [[2, 9, 0.10]], side: 'f' },
  cross:    { limb: 'hR', style: 'cross',  A: [0.22, 1.28, 0.05], P: [0.05, 1.46, 1.03], Q: [0.04, 1.46, 1.08], r: 0.18, mv: [[3, 11, 0.14]], side: 'f' },
  bodyjab:  { limb: 'hL', style: 'jab',    A: [-0.20, 1.00, 0.20], P: [-0.10, 1.08, 0.95], Q: [-0.08, 1.08, 1.00], r: 0.18, mv: [[2, 9, 0.10]], side: 'f' },
  hook:     { limb: 'hR', style: 'hook',   A: [0.62, 1.40, 0.28], P: [0.55, 1.43, 0.62], Q: [-0.28, 1.43, 0.90], r: 0.22, mv: [[3, 11, 0.10]], side: 'l' },
  hookL:    { limb: 'hL', style: 'hook',   A: [-0.62, 1.40, 0.28], P: [-0.55, 1.43, 0.62], Q: [0.28, 1.43, 0.90], r: 0.22, mv: [[3, 11, 0.10]], side: 'r' },
  bodyhook: { limb: 'hR', style: 'hook',   A: [0.60, 1.05, 0.25], P: [0.52, 1.05, 0.58], Q: [-0.25, 1.05, 0.88], r: 0.22, mv: [[3, 11, 0.10]], side: 'l' },
  upper:    { limb: 'hR', style: 'upper',  A: [0.20, 0.72, 0.28], P: [0.06, 0.95, 0.85], Q: [0.02, 1.55, 0.94], r: 0.21, mv: [[3, 10, 0.12]], side: 'u' },
  upperL:   { limb: 'hL', style: 'upper',  A: [-0.20, 0.72, 0.28], P: [-0.06, 0.95, 0.85], Q: [-0.02, 1.55, 0.94], r: 0.21, mv: [[3, 10, 0.12]], side: 'u' },
  elbow:    { limb: 'eR', style: 'elbow',  A: [0.30, 1.30, 0.10], P: [0.06, 1.28, 0.84], r: 0.21, mv: [[3, 12, 0.22]], side: 'f' },
  elbowL:   { limb: 'eL', style: 'elbow',  A: [-0.30, 1.30, 0.10], P: [-0.06, 1.28, 0.84], r: 0.21, mv: [[3, 12, 0.22]], side: 'f' },
  chop:     { limb: 'hR', style: 'chop',   A: [0.20, 1.88, 0.18], P: [0.02, 1.62, 0.88], Q: [0.0, 1.02, 0.98], r: 0.21, mv: [[3, 10, 0.10]], side: 'd' },
  palm:     { limb: 'hR', style: 'palm',   A: [0.22, 1.15, 0.08], P: [0.04, 1.22, 0.96], Q: [0.04, 1.22, 1.0], r: 0.22, mv: [[3, 11, 0.16]], side: 'f' },
  palm2:    { limb: 'hR', style: 'burst',  A: [0.15, 1.10, 0.10], P: [0.0, 1.22, 0.95], Q: [0.0, 1.22, 1.0], r: 0.35, mv: [[2, 10, 0.12]], side: 'f' },
  lowjab:   { limb: 'hL', style: 'lowpunch', A: [-0.15, 0.62, 0.22], P: [-0.08, 0.40, 0.82], Q: [-0.08, 0.40, 0.86], r: 0.17, mv: [[2, 8, 0.10]], side: 'f' },
  // ---- kicks
  teep:     { limb: 'fL', style: 'teep',   A: [-0.20, 0.72, 0.38], P: [-0.08, 1.02, 1.00], Q: [-0.08, 1.02, 1.05], r: 0.24, mv: [[3, 11, 0.16]], side: 'f' },
  teepR:    { limb: 'fR', style: 'teep',   A: [0.20, 0.72, 0.30], P: [0.08, 1.02, 1.00], Q: [0.08, 1.02, 1.05], r: 0.24, mv: [[3, 11, 0.16]], side: 'f' },
  kickhigh: { limb: 'fL', style: 'kickhi', A: [-0.20, 0.85, 0.28], P: [-0.10, 1.48, 0.92], Q: [-0.08, 1.48, 0.98], r: 0.22, mv: [[3, 11, 0.12]], side: 'f' },
  lowkick:  { limb: 'fL', style: 'lowkick', A: [-0.30, 0.38, 0.30], P: [-0.20, 0.30, 0.92], Q: [-0.18, 0.30, 0.98], r: 0.20, mv: [[3, 10, 0.12]], side: 'f' },
  midround: { limb: 'fR', style: 'round',  A: [0.30, 0.90, 0.10], P: [0.62, 1.05, 0.52], Q: [-0.18, 1.05, 0.92], r: 0.24, mv: [[3, 12, 0.12]], side: 'l' },
  hiround:  { limb: 'fR', style: 'roundhi', A: [0.30, 1.10, 0.10], P: [0.62, 1.52, 0.48], Q: [-0.15, 1.52, 0.88], r: 0.24, mv: [[3, 12, 0.12]], side: 'l' },
  hiroundL: { limb: 'fL', style: 'roundhi', A: [-0.30, 1.10, 0.10], P: [-0.62, 1.52, 0.48], Q: [0.15, 1.52, 0.88], r: 0.24, mv: [[3, 12, 0.12]], side: 'r' },
  loround:  { limb: 'fR', style: 'roundlo', A: [0.35, 0.40, 0.10], P: [0.55, 0.28, 0.52], Q: [-0.20, 0.28, 0.92], r: 0.20, mv: [[3, 11, 0.12]], side: 'l' },
  sweep:    { limb: 'fR', style: 'sweep',  A: [0.40, 0.20, -0.1], P: [0.72, 0.14, 0.34], Q: [-0.5, 0.14, 0.98], r: 0.21, mv: [[2, 12, 0.10]], side: 'l', crouchMove: true },
  axe:      { limb: 'fL', style: 'axe',    A: [-0.10, 1.92, 0.10], P: [-0.06, 1.58, 0.74], Q: [-0.05, 0.98, 0.88], r: 0.24, mv: [[3, 12, 0.12]], side: 'd' },
  rise:     { limb: 'fR', style: 'rise',   A: [0.15, 0.30, 0.34], P: [0.08, 0.68, 0.86], Q: [0.02, 1.50, 0.96], r: 0.24, mv: [[3, 10, 0.10]], side: 'u' },
  knee:     { limb: 'kR', style: 'knee',   A: [0.15, 0.55, 0.15], P: [0.06, 0.92, 0.80], r: 0.23, mv: [[3, 11, 0.18]], side: 'f' },
  kneeL:    { limb: 'kL', style: 'knee',   A: [-0.15, 0.55, 0.15], P: [-0.06, 0.92, 0.80], r: 0.23, mv: [[3, 11, 0.18]], side: 'f' },
  stomp:    { limb: 'fL', style: 'stomp',  A: [-0.10, 0.90, 0.50], P: [-0.05, 0.16, 0.92], r: 0.24, side: 'd' },
  gpunch:   { limb: 'hR', style: 'gpunch', A: [0.10, 0.90, 0.60], P: [0.05, 0.22, 0.95], r: 0.22, side: 'd' },
  // ---- movement attacks
  jpunch:   { limb: 'hR', style: 'jumppunch', A: [0.20, 1.0, 0.20], P: [0.05, 0.62, 0.90], Q: [0.04, 0.55, 0.96], r: 0.24, side: 'd' },
  jkick:    { limb: 'fR', style: 'jumpkick', A: [0.15, 0.50, 0.10], P: [0.07, 0.35, 0.95], Q: [0.06, 0.30, 1.0], r: 0.26, side: 'f' },
  jkickL:   { limb: 'fL', style: 'jumpkick', A: [-0.15, 0.50, 0.10], P: [-0.07, 0.35, 0.95], Q: [-0.06, 0.30, 1.0], r: 0.26, side: 'f' },
  flykick:  { limb: 'fR', style: 'flykick', A: [0.15, 0.7, 0.10], P: [0.06, 1.05, 1.02], Q: [0.05, 1.05, 1.08], r: 0.26, mv: [[3, 14, 0.5]], side: 'f' },
  shoulder: { limb: 'sh', style: 'shoulder', A: [0.10, 1.30, 0.0], P: [0.0, 1.20, 0.72], Q: [0.0, 1.20, 0.8], r: 0.32, mv: [[3, 12, 0.5]], side: 'f' },
  headbutt: { limb: 'hd', style: 'headbutt', A: [0, 1.55, 0.0], P: [0, 1.50, 0.74], Q: [0, 1.50, 0.78], r: 0.24, mv: [[2, 8, 0.2]], side: 'f' },
  spinback: { limb: 'hR', style: 'spinback', A: [0.6, 1.40, -0.3], P: [0.35, 1.42, 0.65], Q: [-0.3, 1.42, 0.92], r: 0.24, mv: [[3, 12, 0.12]], side: 'l', an: { spin: [1, 16, 360] } },
  spinkick: { limb: 'fR', style: 'spinkick', A: [0.4, 1.0, -0.3], P: [0.62, 1.20, 0.50], Q: [-0.2, 1.20, 0.92], r: 0.25, mv: [[3, 13, 0.14]], side: 'l', an: { spin: [1, 18, 360] } },
  bodyhookL:{ limb: 'hL', style: 'hook',   A: [-0.60, 1.05, 0.25], P: [-0.52, 1.05, 0.58], Q: [0.25, 1.05, 0.88], r: 0.22, mv: [[3, 11, 0.10]], side: 'r' },
  chopL:    { limb: 'hL', style: 'chop',   A: [-0.20, 1.88, 0.18], P: [-0.02, 1.62, 0.88], Q: [0.0, 1.02, 0.98], r: 0.21, mv: [[3, 10, 0.10]], side: 'd' },
  palmL:    { limb: 'hL', style: 'palm',   A: [-0.22, 1.15, 0.08], P: [-0.04, 1.22, 0.96], Q: [-0.04, 1.22, 1.0], r: 0.22, mv: [[3, 11, 0.16]], side: 'f' },
  lowkickR: { limb: 'fR', style: 'lowkick', A: [0.30, 0.38, 0.10], P: [0.20, 0.30, 0.92], Q: [0.18, 0.30, 0.98], r: 0.20, mv: [[3, 10, 0.12]], side: 'f' },
  kickhiR:  { limb: 'fR', style: 'kickhi', A: [0.20, 0.85, 0.10], P: [0.10, 1.48, 0.92], Q: [0.08, 1.48, 0.98], r: 0.22, mv: [[3, 11, 0.12]], side: 'f' },
  sidekick: { limb: 'fR', style: 'teep',   A: [0.25, 0.70, 0.20], P: [0.12, 1.05, 1.08], Q: [0.12, 1.05, 1.14], r: 0.24, mv: [[3, 12, 0.22]], side: 'f' },
  hopkick:  { limb: 'fL', style: 'round',  A: [-0.30, 0.9, 0.1], P: [-0.62, 1.05, 0.52], Q: [0.18, 1.05, 0.92], r: 0.24, mv: [[3, 12, 0.12]], side: 'r' },
  flipkick: { limb: 'fR', style: 'rise',   A: [0.15, 0.30, 0.20], P: [0.08, 0.70, 0.90], Q: [0.02, 1.55, 0.95], r: 0.26, mv: [[3, 12, 0.10]], side: 'u', an: { flip: [3, 20, 360] } },
  handstand:{ limb: 'fR', style: 'rise',   A: [0.15, 0.6, 0.10], P: [0.08, 0.95, 0.90], Q: [0.02, 1.25, 0.95], r: 0.26, side: 'u' },
  beam:     { limb: 'hR', style: 'burst',  A: [0.15, 1.10, 0.10], P: [0.0, 1.25, 3.2], Q: [0.0, 1.25, 5.8], r: 0.35, side: 'f' },
  rocket:   { limb: 'hR', style: 'cross',  A: [0.22, 1.28, 0.05], P: [0.05, 1.46, 2.6], Q: [0.04, 1.46, 3.2], r: 0.24, side: 'f' },
  stab:     { limb: 'hR', style: 'palm',   A: [0.22, 1.15, 0.08], P: [0.04, 1.30, 1.3], Q: [0.04, 1.30, 1.36], r: 0.2, mv: [[3, 11, 0.4]], side: 'f' },
  grab:     { limb: 'hR', style: 'grab',   A: [0.3, 1.2, 0.2], P: [0.15, 1.2, 0.8], r: 0.25 },
};

const WFN = (st) => ({ hit: st });
void WFN;

// -------------------------------------------------------------------- throws & cinematics
// vic: victim keyframes relative to the attacker  [frame, [side, pelvisHeight, forward], [pitch, yaw, roll]]
export const THR = {
  hip: (st = 10, dmg = 30) => ({
    range: 1.3, brk: '1', whiffRec: 26, after: 'kd', end: st + 44,
    vic: [[st, [0.02, 0.95, 0.66], [0, 0, 0]], [st + 12, [0.34, 1.55, 0.22], [0, 0, -100]], [st + 24, [0.10, 1.45, 0.55], [0, 0, -170]], [st + 36, [0.0, 0.22, 1.05], [-90, 0, 0]]],
    hits: [{ f: st + 36, dmg, spark: 'heavy', stop: 8, sfx: 'slam' }],
  }),
  suplex: (st = 10, dmg = 32) => ({
    range: 1.3, brk: '2', whiffRec: 26, after: 'side', end: st + 50,
    vic: [[st, [0.0, 0.95, 0.66], [0, 0, 0]], [st + 14, [0.0, 1.30, 0.45], [-40, 0, 0]], [st + 28, [0.0, 2.10, -0.05], [-160, 0, 0]], [st + 40, [0.0, 0.22, -0.95], [-270, 0, 0]]],
    hits: [{ f: st + 40, dmg, spark: 'heavy', stop: 8, sfx: 'slam' }],
  }),
  slam: (st = 10, dmg = 34) => ({
    range: 1.3, brk: '1', whiffRec: 28, after: 'kd', end: st + 52,
    vic: [[st, [0.0, 0.95, 0.64], [0, 0, 0]], [st + 14, [0.0, 2.05, 0.30], [-20, 0, 0]], [st + 26, [0.0, 2.25, 0.28], [-40, 0, 0]], [st + 38, [0.0, 0.22, 0.95], [-90, 0, 0]]],
    hits: [{ f: st + 38, dmg, spark: 'heavy', stop: 9, sfx: 'slam' }],
  }),
  knees: (st = 10, dmg = 6) => ({
    range: 1.2, brk: '2', whiffRec: 24, after: 'stagger', end: st + 62,
    vic: [[st, [0.0, 0.98, 0.5], [18, 0, 0]], [st + 60, [0.0, 0.98, 0.5], [22, 0, 0]]],
    hits: [{ f: st + 12, dmg, spark: 'med', stop: 3 }, { f: st + 24, dmg, spark: 'med', stop: 3 }, { f: st + 36, dmg, spark: 'med', stop: 3 }, { f: st + 52, dmg: dmg + 10, spark: 'heavy', stop: 7 }],
  }),
  bear: (st = 10, dmg = 40) => ({
    range: 1.35, brk: '2', whiffRec: 30, after: 'kd', end: st + 60,
    vic: [[st, [0.0, 0.95, 0.60], [0, 0, 0]], [st + 14, [0.0, 1.10, 0.45], [-10, 0, 0]], [st + 30, [0.0, 1.55, 0.35], [-50, 0, 0]], [st + 46, [0.0, 0.22, 0.85], [-90, 0, 0]]],
    hits: [{ f: st + 20, dmg: 8, spark: 'med', stop: 4 }, { f: st + 46, dmg: dmg - 8, spark: 'heavy', stop: 9, sfx: 'slam' }],
  }),
  back: (st = 10, dmg = 26) => ({
    range: 1.3, brk: '1', whiffRec: 26, after: 'kd', end: st + 40,
    vic: [[st, [0.0, 0.95, 0.66], [0, 0, 0]], [st + 14, [0.0, 0.7, 0.9], [30, 0, 0]], [st + 30, [0.0, 0.22, 1.15], [-90, 0, 0]]],
    hits: [{ f: st + 30, dmg, spark: 'heavy', stop: 8, sfx: 'slam' }],
  }),
};

// Cinematic Rage Art / Heat Smash captures (unbreakable, start when the opening strike lands)
export function barrage(st, dmgs, after = 'launch', spacing = 8, first = 12) {
  const hits = dmgs.map((d, i) => ({ f: st + first + i * spacing, dmg: d, spark: i === dmgs.length - 1 ? 'heavy' : 'med', stop: i === dmgs.length - 1 ? 12 : 3 }));
  const last = hits[hits.length - 1].f;
  const vic = [[st, [0.0, 1.0, 0.72], [0, 0, 0]]];
  hits.forEach((h, i) => vic.push([h.f, [(i % 2 ? 0.08 : -0.08), 1.0, 0.72 + (i === hits.length - 1 ? 0.15 : 0)], [i === hits.length - 1 ? -25 : 6, 0, i % 2 ? 8 : -8]]));
  return { mode: 'onhit', range: 1.3, brk: null, after, end: last + 6, vic, hits };
}

export const NAMES = {
  j1: 'Jab', j12: 'Jab-Straight', j123: 'Jab-Straight-Kick', j2: 'Straight', j21: 'Straight-Jab',
  k3: 'Front Kick', k34: 'Kick Combo', k4: 'High Kick', f2: 'Elbow Smash', f3: 'Push Kick', f4: 'Power Roundhouse',
  df1: 'Body Jab', df12: 'Body Jab-Cross', df2: 'Rising Uppercut', df3: 'Stab Kick', df4: 'Low Roundhouse',
  d1: 'Low Jab', d3: 'Low Kick', d4: 'Low Sweep', d2: 'Ground Strike', ws1: 'Rising Jab', ws2: 'Wind Uppercut', ws3: 'Snap Kick', ws4: 'Rising Kick',
  wr1: 'Dash Jab', wr2: 'Dash Cross', wr3: 'Dash Kick', wr4: 'Flying Kick', ss1: 'Sidestep Jab', ss2: 'Sidestep Hook', ss3: 'Sidestep Kick', ss4: 'Sidestep Roundhouse',
  air2: 'Jump Punch', air4: 'Jump Kick', air1: 'Jump Jab', air3: 'Jump Knee Kick', th13: 'Hip Throw', th24: 'Suplex', p12: 'Double Palm', p14: 'Shoulder Charge', p34: 'Hop Kick',
  hb: 'Heat Burst', hs: 'Heat Smash', ra: 'Rage Art', rd: 'Rage Drive', dn3: 'Rising Kick', dn4: 'Wake-up Kick', cd2: 'Crouch Uppercut', cd1: 'Crouch Jab',
};

// [id, cmd, level, startup, active, recovery, dmg, block adv, hit adv, preset, extras]
const U = [
  ['j1', '1', 'h', 10, 2, 12, 6, 1, 8, 'jab', { next: { 2: 'j12' }, push: 0.15, pushB: 0.3, cwe: 15 }],
  ['j12', null, 'h', 5, 2, 15, 8, -4, 5, 'cross', { next: { 3: 'j123' }, push: 0.2, pushB: 0.3 }],
  ['j123', null, 'm', 9, 2, 22, 12, -11, 3, 'midround', { limb: 'fL', ht: 'stag', push: 0.6, pushB: 0.6, mv: [[3, 9, 0.12]] }],
  ['j2', '2', 'h', 11, 2, 14, 8, -3, 6, 'cross', { next: { 1: 'j21' }, push: 0.2, pushB: 0.3 }],
  ['j21', null, 'h', 6, 2, 16, 7, -5, 4, 'jab', { push: 0.2 }],
  ['k3', '3', 'h', 13, 2, 16, 9, -5, 3, 'kickhigh', { next: { 4: 'k34' }, push: 0.3 }],
  ['k34', null, 'm', 9, 3, 22, 14, -13, -2, 'midround', { ht: 'stag', push: 0.6, pushB: 0.6 }],
  ['k4', '4', 'h', 15, 3, 19, 14, -9, 4, 'hiround', { push: 0.5, pushB: 0.5 }],
  ['f2', 'f+2', 'm', 14, 2, 20, 14, -9, 5, 'elbow', { cht: 'launch', push: 0.4, pushB: 0.5 }],
  ['f3', 'f+3', 'm', 15, 3, 21, 11, -9, 2, 'teep', { push: 0.7, pushB: 0.7 }],
  ['f4', 'f+4', 'm', 17, 3, 24, 16, -12, 0, 'midround', { ht: 'stag', push: 0.7, pushB: 0.7 }],
  ['df1', 'd/f+1', 'm', 12, 2, 14, 7, -1, 7, 'bodyjab', { next: { 2: 'df12' }, push: 0.15, pushB: 0.25 }],
  ['df12', null, 'm', 7, 2, 16, 9, -8, 3, 'cross', { push: 0.3 }],
  ['df2', 'd/f+2', 'm', 15, 2, 22, 13, -13, 0, 'upper', { ht: 'launch', lvy: 0.165, push: 0.2, pushB: 0.4, crouchMove: false }],
  ['df3', 'd/f+3', 'm', 14, 3, 19, 10, -6, 4, 'teep', { ht: 'stag', push: 0.4 }],
  ['df4', 'd/f+4', 'm', 16, 3, 24, 15, -14, 0, 'midround', { ht: 'kd', push: 0.5, lvp: 0.06 }],
  ['d1', 'd+1', 'l', 11, 2, 14, 5, -9, 2, 'lowjab', { crouchMove: true, push: 0.15 }],
  ['d3', 'd+3', 'l', 14, 2, 22, 7, -13, -2, 'lowkick', { crouchMove: true, push: 0.2 }],
  ['d4', 'd+4', 'l', 16, 3, 26, 9, -15, 0, 'loround', { crouchMove: true, ht: 'kd', push: 0.3, lvp: 0.04 }],
  ['d2', 'd+2', 'm', 12, 2, 22, 8, -10, 0, 'gpunch', { gh: true, crouchMove: true }],
  ['ws1', 'ws+1', 'm', 13, 2, 15, 7, -2, 5, 'jab', { push: 0.2 }],
  ['ws2', 'ws+2', 'm', 15, 2, 24, 13, -15, 0, 'upper', { ht: 'launch', lvy: 0.17, push: 0.2 }],
  ['ws3', 'ws+3', 'm', 14, 3, 20, 9, -9, 3, 'teep', { ht: 'stag' }],
  ['ws4', 'ws+4', 'm', 15, 3, 25, 15, -16, 0, 'rise', { ht: 'launch', lvy: 0.165, push: 0.2 }],
  ['wr1', 'wr+1', 'm', 10, 2, 16, 8, -5, 3, 'jab', { mv: [[1, 8, 0.4]] }],
  ['wr2', 'wr+2', 'm', 12, 2, 22, 15, -12, 0, 'cross', { ht: 'stag', mv: [[1, 10, 0.55]], push: 0.6, pushB: 0.6 }],
  ['wr3', 'wr+3', 'm', 16, 3, 24, 12, -11, 0, 'teep', { mv: [[1, 14, 0.5]], ht: 'stag' }],
  ['wr4', 'wr+4', 'm', 18, 3, 26, 14, -13, 0, 'flykick', { ht: 'kd', lvp: 0.06 }],
  ['ss1', 'ss+1', 'h', 12, 2, 16, 8, -4, 3, 'jab', { hom: true }],
  ['ss2', 'ss+2', 'm', 13, 2, 20, 12, -8, 2, 'hook', { hom: true, ht: 'stag' }],
  ['ss3', 'ss+3', 'm', 14, 3, 20, 10, -8, 2, 'teep', { hom: true }],
  ['ss4', 'ss+4', 'm', 16, 3, 24, 14, -12, 0, 'midround', { hom: true, ht: 'stag' }],
  ['air1', 'air+1', 'm', 9, 4, 12, 6, -6, 2, 'jpunch', { limb: 'hL', sfx: 'light' }],
  ['air2', 'air+2', 'm', 9, 4, 12, 9, -6, 2, 'jpunch'],
  ['air3', 'air+3', 'm', 8, 4, 12, 8, -6, 2, 'jkickL'],
  ['air4', 'air+4', 'm', 8, 4, 12, 11, -6, 2, 'jkick'],
  ['p12', '1+2', 'h', 13, 2, 18, 12, -8, 3, 'palm2', { ht: 'stag', push: 0.7, pushB: 0.6 }],
  ['p14', '1+4', 'm', 17, 3, 26, 16, -12, 0, 'shoulder', { ht: 'stag', pc: [5, 16], push: 0.8, pushB: 0.7 }],
  ['p34', '3+4', 'm', 20, 3, 26, 18, -14, 0, 'flykick', { ht: 'kd', limb: 'fR', mv: [[2, 16, 0.35]], yc: [[0, 0], [9, 0.35], [16, 0.5], [22, 0]] }],
  ['dn3', 'dn+3', 'm', 14, 3, 26, 12, -14, 0, 'rise', { limb: 'fL', hb: [[1, 9, 'down']], ht: 'stag', an: { wake: true } }],
  ['dn4', 'dn+4', 'm', 16, 3, 28, 14, -16, 0, 'rise', { hb: [[1, 10, 'down']], ht: 'kd', an: { wake: true } }],
  ['cd1', 'cd+1', 'm', 11, 2, 15, 7, -3, 4, 'bodyjab', { crouchMove: true }],
  ['cd2', 'cd+2', 'm', 13, 2, 23, 14, -14, 0, 'upper', { ht: 'launch', lvy: 0.17, crouchMove: true }],
  ['th13', '1+3', 't', 10, 1, 52, 30, 0, 0, 'grab', { grab: THR.hip(10, 30), an: { script: 'hip' }, unbl: true }],
  ['th24', '2+4', 't', 10, 1, 56, 32, 0, 0, 'grab', { grab: THR.suplex(10, 32), an: { script: 'suplex' }, unbl: true }],
  ['hb', '2+3', 'm', 16, 2, 28, 10, -10, 4, 'palm2', { req: 'noheat', hbst: true, ht: 'stag', push: 1.4, pushB: 1.2, name: 'Heat Burst', an: { burst: true }, hitstopFx: true }],
];

export function buildMoves(prof = {}, ov = {}, add = [], drop = []) {
  const dm = prof.dmg ?? 1, spd = prof.spd ?? 0;
  const out = [];
  for (const r of U) {
    const [id, cmd, lv, st, ac, rec, dmg, blk, hit, pre, x = {}] = r;
    if (drop.includes(id)) continue;
    const p = PRE[pre];
    if (!p) throw new Error('unknown preset ' + pre);
    const o = ov[id] || {};
    const def = { id, name: NAMES[id] || id, lv, st: st + (lv === 't' ? 0 : spd), ac, rec, dmg: Math.round(dmg * dm), blk, hit, ...p, ...x, ...o };
    if (cmd) def.cmd = cmd;
    if (o.cmd === null) delete def.cmd;
    if (prof.reach && def.P) {
      const k = prof.reach;
      const sc = (v) => (v ? [v[0], v[1], v[2] * k] : v);
      def.P = sc(def.P); def.Q = sc(def.Q); def.A = sc(def.A);
    }
    out.push(def);
  }
  // character specific moves replace universal ones bound to the same command (and same requirement)
  const kept = out.filter((d) => !d.cmd || !add.some((a) => a.cmd && normCmd(a.cmd) === normCmd(d.cmd) && (a.req || null) === (d.req || null)));
  for (const a of add) kept.push(a);
  return kept;
}

function normCmd(c) { return c.replace(/\s+/g, '').toLowerCase(); }

// Generic Rage Art / Heat Smash / Rage Drive templates: characters supply the numbers + look
export function rageArt(o = {}) {
  const st = o.st ?? 16;
  return {
    id: 'ra', cmd: '1+2', name: o.name || 'Rage Art', lv: 'm', st, ac: 2, rec: 44, dmg: o.first ?? 10, blk: -30, hit: 0,
    ...(PRE[o.pre || 'cross']), req: 'rage', ra: true, ht: 'n', unbl: false, pc: [1, st - 1],
    an: { script: o.script || 'rageA', ...(o.an || {}) }, cine: { cam: 'rage' },
    grab: barrage(st, o.hits || [6, 6, 8, 8, 10, 12, 16], o.after || 'launch', o.spacing ?? 8),
    ...(o.over || {}),
  };
}

export function heatSmash(o = {}) {
  const st = o.st ?? 14;
  return {
    id: 'hs', cmd: '2+3', name: o.name || 'Heat Smash', lv: 'm', st, ac: 2, rec: 36, dmg: o.first ?? 8, blk: -22, hit: 0,
    ...(PRE[o.pre || 'palm']), req: 'heat', hs: true, ht: 'n', pc: [1, st - 1],
    an: { script: o.script || 'smashA', ...(o.an || {}) }, cine: { cam: 'smash' },
    grab: barrage(st, o.hits || [8, 10, 18], o.after || 'kd', o.spacing ?? 10, 10),
    ...(o.over || {}),
  };
}

export function rageDrive(o = {}) {
  return {
    id: 'rd', cmd: 'f+1+2', name: o.name || 'Rage Drive', lv: 'm', st: o.st ?? 18, ac: 3, rec: 30, dmg: o.dmg ?? 24, blk: -16, hit: 0,
    ...(PRE[o.pre || 'shoulder']), req: 'rage', rd: true, ht: 'launch', lvy: 0.175, pc: [4, 17], push: 0.5,
    mv: o.mv ?? [[2, 16, 0.8]], ...(o.over || {}),
  };
}

// ---- authoring helpers -------------------------------------------------------------
export function mv(id, cmd, name, lv, st, ac, rec, dmg, blk, hit, pre, x = {}) {
  const p = PRE[pre];
  if (!p) throw new Error('unknown preset ' + pre + ' for ' + id);
  const d = { id, cmd, name, lv, st, ac, rec, dmg, blk, hit, ...p, ...x };
  if (!d.cmd) delete d.cmd;
  return d;
}

// link string continuations: link(a, {2: b, 1: c}); returns all moves for spreading
export function link(parent, map) {
  parent.next = { ...(parent.next || {}) };
  for (const [btn, child] of Object.entries(map)) parent.next[btn] = child.id;
  return [parent, ...Object.values(map)];
}

// extra: combined ids => quick lookups
export function index(moves) { return Object.fromEntries(moves.map((m) => [m.id, m])); }
