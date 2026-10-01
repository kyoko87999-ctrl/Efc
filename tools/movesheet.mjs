// Contact sheet of moves at their key frames (one row per move):  windup/2, windup end, mid approach, first active, last active, mid recovery
//   node tools/movesheet.mjs <char> <id,id,...> [--view=side] [--dist=6] [--d=4.2] [--out=name] [--opp=bruno] [--w=240] [--h=330]
import { execFileSync } from 'node:child_process';
import { CHARS } from '../src/data/roster.js';
import { compileChar } from '../src/sim/move.js';

const [cid, ids] = process.argv.slice(2, 4);
const opt = Object.fromEntries(process.argv.slice(4).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=') || true]; }));
const S = '/tmp/claude-0/-home-user-Efc/519c67b6-6fef-5d28-907c-7a7105e2f7dd/scratchpad/lab';
const def = compileChar(CHARS.find((c) => c.id === cid));
const ops = [['step', 25]];
for (const id of ids.split(',')) {
  const m = def.moveMap.get(id);
  if (!m) throw new Error('no move ' + id);
  const last = m.st + m.ac - 1;
  const marks = [Math.max(1, Math.round(m.wf / 2)), m.wf, Math.round((m.wf + m.st) / 2), m.st, last, Math.round((last + m.total) / 2)];
  ops.push(['eval', "f[0].move=null; f[0].enter('idle'); f[0].lock=0; f[0].stance=null; f[0].crouch=false; f[0].x=-3; f[0].px=-3; f[0].y=0; f[0].py=0; f[1].x=3;f[1].px=3;"]);
  ops.push(['step', 22]);
  ops.push(['move', id]);
  let t = 0;
  for (const mk of marks) { if (mk > t) ops.push(['step', mk - t]); t = mk; ops.push(['shot']); }
  ops.push(['step', 40]);
}
const spec = { chars: [cid, opt.opp || 'bruno'], view: opt.view || 'side', d: +(opt.d || 4.2), fov: +(opt.fov || 34), dist: +(opt.dist || 6), ops };
const out = `${S}/${opt.out || 'mv_' + cid}`;
execFileSync('node', ['tools/animlab.mjs', JSON.stringify(spec), `--out=${out}`, '--cols=6', `--w=${opt.w || 240}`, `--h=${opt.h || 330}`], { stdio: 'inherit' });
