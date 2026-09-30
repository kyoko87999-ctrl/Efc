// Developer tool: render a sheet of poses.  window.sheet([{char, move, mf, state, set:{...}}], {stage, cam:[x,y,z], look:[x,y,z], fov})
import { GameView } from './render/scene.js';
import { Match } from './sim/match.js';
import { compileChar } from './sim/move.js';
import { STAGES } from './render/stages.js';
import { ST } from './sim/fighter.js';
import { CHARS } from './data/roster.js';

const canvas = document.getElementById('gl');
const view = new GameView(canvas, { quality: 1, preserve: true });
view.flashEl = document.getElementById('flash');
const compiled = {};
for (const c of CHARS) compiled[c.id] = compileChar(c);

window.sheet = function sheet(cells, opts = {}) {
  const stage = STAGES.find((s) => s.id === (opts.stage || 'grid')) || STAGES[0];
  if (view.stageId !== stage.id) view.loadStage(stage.id);
  view.unloadMatch();
  const spacing = opts.spacing || 1.8;
  const n = cells.length;
  cells.forEach((c, i) => {
    const ch = compiled[c.char || CHARS[0].id];
    const m = new Match({ chars: [ch, ch], stage, rules: { time: 0 } });
    while (m.phase === 'intro') m.step([{}, {}]);
    const f = m.fighters[0];
    f.x = (i - (n - 1) / 2) * spacing; f.z = 0; f.px = f.x; f.pz = 0;
    f.fx = 1; f.fz = 0; f.pfx = 1; f.pfz = 0;
    m.fighters[1].x = 200; m.fighters[1].z = 0;
    f.state = c.state || ST.IDLE;
    if (c.move) { f.move = ch.moveMap.get(c.move); if (!f.move) throw new Error('no move ' + c.move); f.state = ST.ATK; f.mf = c.mf ?? f.move.st; }
    if (c.set) Object.assign(f, c.set);
    if (c.stT !== undefined) f.stT = c.stT;
    view.addView(f, ch, c.cust || (c.alt ? { alt: c.alt } : null));
  });
  const cam = opts.cam || [0, 1.25, 2.6 + n * 0.95];
  view.rig.setManual(cam, opts.look || [0, 1.0, 0], opts.fov || 32, true);
  view.rig.time = 0;
  for (let k = 0; k < 3; k++) view.frame(0.016, 0, 1);
  return n;
};
window.view = view;
window.compiled = compiled;
window.ST = ST;
