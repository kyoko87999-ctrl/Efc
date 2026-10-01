// Animation lab: deterministic side-view contact sheets of any move / state.
//
//   node tools/animlab.mjs '<spec json>' [--file=dist/efc.html] [--out=/tmp/lab/name] [--cols=6] [--w=360] [--h=360]
//
// spec = {
//   chars: ['kenzo','bruno'], dist: 6,            // fighters start dist metres apart (P1 on the left, facing +x)
//   view: 'side' | 'two' | 'close' | 'face', fov: 30, d: 3.4, // camera preset (follows P1; 'two' frames both fighters)
//   ops: [
//     ['step', n, in0?, in1?],                     // advance n sim frames with raw inputs (default neutral)
//     ['move', 'j1', who?],                        // start a move on a fighter (bypasses command parsing)
//     ['shot'],                                    // screenshot now
//     ['burst', count, every, in0?, in1?],         // shot, then (step every, shot) x count-1
//     ['eval', 'js code'],                         // run js in the page (has f = fighters, m = match, app)
//   ]
// }
//   Raw input objects are like {r:true,b1:true}.  Output: <out>_NN.png per shot and <out>_sheet.png (montage).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const spec = JSON.parse(args[0]);
const opt = Object.fromEntries(args.slice(1).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=') || true]; }));
const file = opt.file || 'dist/efc.html';
const out = opt.out || '/tmp/claude-0/-home-user-Efc/519c67b6-6fef-5d28-907c-7a7105e2f7dd/scratchpad/lab/lab';
const W = +(opt.w || 360), H = +(opt.h || 360), COLS = +(opt.cols || 6);
mkdirSync(dirname(out), { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: W, height: H }, reducedMotion: 'reduce' })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' | ')));
await page.goto('file://' + resolve(file));
await page.waitForTimeout(900);

await page.evaluate(([spec]) => {
  const chars = spec.chars || ['kenzo', 'bruno'];
  __app.ui.clear();
  __app.startMatch({ chars, stage: spec.stage || 'grid', practice: { dummy: 'stand' }, cpu: [false, true], showVs: false });
  document.getElementById('hud').style.display = 'none';
  document.getElementById('toast').style.display = 'none';
  const gv = __app.gv;
  window.__lab = { spec, shots: 0 };
  gv.rig.update = function (dtF, match) {
    const a = match.fighters[0], b = match.fighters[1];
    const cam = gv.camera;
    const v = spec.view || 'side';
    let cx, cz, px, py, pz, ly, fov;
    if (v === 'two') { cx = (a.x + b.x) / 2; cz = (a.z + b.z) / 2; const d = spec.d || 5.5; px = cx; py = 1.3; pz = cz + d; ly = 0.95; fov = spec.fov || 34; }
    else if (v === 'close') { cx = a.x + 0.2; cz = a.z; const d = spec.d || 2.6; px = cx + 0.4; py = 1.5; pz = cz + d; ly = 1.4; fov = spec.fov || 28; }
    else if (v === 'face') { const d = spec.d || 1.1; const hy = spec.hy || 1.52; px = a.x + d; py = hy; pz = a.z + (spec.side ?? 0.25); cx = a.x; cz = a.z; ly = hy - 0.02; fov = spec.fov || 26; }
    else { cx = a.x + 0.25; cz = a.z; const d = spec.d || 3.6; px = cx; py = 1.0; pz = cz + d; ly = 0.92; fov = spec.fov || 30; }
    cam.position.set(px, py, pz);
    cam.lookAt(cx, ly, cz);
    if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
  };
  const f = __app.match.fighters;
  __app.practiceApply('infHp', true);
  __app.debugStep(150, {}, {});
  const dist = spec.dist ?? 6;
  f[0].x = -dist / 2; f[1].x = dist / 2; f[0].z = f[1].z = 0; f[0].px = f[0].x; f[1].px = f[1].x;
  __app.match.updateAxis();
  __app.debugStep(30, {}, {});
}, [spec]);

const files = [];
async function shot() {
  const n = files.length;
  const f = `${out}_${String(n).padStart(2, '0')}.png`;
  await page.screenshot({ path: f });
  files.push(f);
}
for (const op of spec.ops) {
  const [kind, a, b, c, d] = op;
  if (kind === 'step') await page.evaluate(([n, i0, i1]) => { __app.debugStep(n, i0 || {}, i1 || {}, 1); }, [a, b, c]);
  else if (kind === 'move') await page.evaluate(([id, who]) => { const f = __app.match.fighters[who || 0]; const m = f.ch.moveMap.get(id); if (!m) throw new Error('no move ' + id); f.lock = 0; f.beginMove(m); }, [a, b]);
  else if (kind === 'shot') await shot();
  else if (kind === 'burst') {
    await shot();
    for (let i = 1; i < a; i++) { await page.evaluate(([n, i0, i1]) => { __app.debugStep(n, i0 || {}, i1 || {}, 1); }, [b, c, d]); await shot(); }
  } else if (kind === 'eval') await page.evaluate(([code]) => { const m = __app.match, f = m.fighters, app = __app; return eval(code); }, [a]);
}
if (errors.length) console.log('page errors:', [...new Set(errors)].slice(0, 5));
await browser.close();
if (files.length) {
  execFileSync('node', ['tools/montage.mjs', `${out}_sheet.png`, String(Math.min(COLS, files.length)), ...files], { stdio: 'inherit' });
  writeFileSync(`${out}_files.json`, JSON.stringify(files));
  console.log('sheet', `${out}_sheet.png`, files.length, 'shots');
}
