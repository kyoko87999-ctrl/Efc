// Contact sheet of the DEFENDER reacting to moves (one row per move): node tools/reactsheet.mjs <attacker> <defender> <id,id,...> [--every=3] [--n=6] [--view=two]
import { execFileSync } from 'node:child_process';
import { CHARS } from '../src/data/roster.js';
import { compileChar } from '../src/sim/move.js';

const [aid, did, ids] = process.argv.slice(2, 5);
const opt = Object.fromEntries(process.argv.slice(5).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=') || true]; }));
const S = '/tmp/claude-0/-home-user-Efc/519c67b6-6fef-5d28-907c-7a7105e2f7dd/scratchpad/lab';
const def = compileChar(CHARS.find((c) => c.id === aid));
const every = +(opt.every || 3), n = +(opt.n || 6);
const ops = [['step', 25]];
for (const id of ids.split(',')) {
  const m = def.moveMap.get(id);
  if (!m) throw new Error('no move ' + id);
  ops.push(['eval', "for (const q of f) { q.move=null; q.enter('idle'); q.lock=0; q.stance=null; q.crouch=false; q.y=0; q.py=0; q.hk=null; q.air=null; q.endCombo&&q.endCombo(); } f[0].x=-0.55*1; f[0].px=-0.55; f[1].x=0.75; f[1].px=0.75; f[0].z=f[1].z=0; f[0].pz=f[1].pz=0; __app.match.hitstop=0;"]);
  ops.push(['step', 20]);
  ops.push(['move', id]);
  ops.push(['step', m.st + 1]);
  for (let i = 0; i < n; i++) { ops.push(['shot']); ops.push(['step', every]); }
  ops.push(['step', 60]);
}
const spec = { chars: [aid, did], view: opt.view || 'two', d: +(opt.d || 3.4), fov: +(opt.fov || 30), dist: 6, ops };
const out = `${S}/${opt.out || 'rx_' + aid}`;
execFileSync('node', ['tools/animlab.mjs', JSON.stringify(spec), `--out=${out}`, `--cols=${opt.cols || n}`, `--w=${opt.w || 230}`, `--h=${opt.h || 300}`], { stdio: 'inherit' });
