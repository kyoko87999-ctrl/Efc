// Contact sheet of a fighter's intro / win / lose sequence:  node tools/showsheet.mjs <char> <intro|win|lose> [--every=6] [--n=10] [--az=35] [--d=3.6]
import { execFileSync } from 'node:child_process';
const [cid, what] = process.argv.slice(2, 4);
const opt = Object.fromEntries(process.argv.slice(4).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=') || true]; }));
const S = '/tmp/claude-0/-home-user-Efc/519c67b6-6fef-5d28-907c-7a7105e2f7dd/scratchpad/lab';
const every = +(opt.every || 6), n = +(opt.n || 10);
const st = { intro: 'intro', win: 'win', lose: 'lose' }[what];
const ops = [['step', 20], ['eval', `f[0].enter('${st}'); f[0].introFirst = true; f[0].lock=0;`]];
for (let i = 0; i < n; i++) { ops.push(['shot']); ops.push(['step', every]); }
const spec = { chars: [cid, opt.opp || 'bruno'], view: 'q', d: +(opt.d || 3.6), az: +(opt.az || 35), fov: +(opt.fov || 32), dist: 6, ops };
execFileSync('node', ['tools/animlab.mjs', JSON.stringify(spec), `--out=${S}/${opt.out || 'sh_' + cid + '_' + what}`, `--cols=${opt.cols || 5}`, `--w=${opt.w || 280}`, `--h=${opt.h || 340}`], { stdio: 'inherit' });
