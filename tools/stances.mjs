// Stance pose sweep: node tools/stances.mjs  -> montage of every stance (idle in stance)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { resolve } from 'node:path';
const CASES = [
  ['luna', 'd+3+4', { d: true, b3: true, b4: true }],
  ['kage', 'd/f+3+4', { d: true, r: true, b3: true, b4: true }],
  ['marcus', 'd/f+1+2', { d: true, r: true, b1: true, b2: true }],
  ['tawan', 'b+3', { l: true, b3: true }],
  ['meilan', 'd/f+1+2', { d: true, r: true, b1: true, b2: true }],
  ['jaeho', 'd/b+3', { d: true, l: true, b3: true }],
];
const out = '/tmp/claude-0/-home-user-Efc/519c67b6-6fef-5d28-907c-7a7105e2f7dd/scratchpad/stance';
import { mkdirSync } from 'node:fs';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 700, height: 420 }, reducedMotion: 'reduce' })).newPage();
await page.goto('file://' + resolve('dist/efc.html'));
await page.waitForTimeout(900);
for (const [id, cmd, inp] of CASES) {
  await page.evaluate(([a]) => { __app.ui.clear(); __app.startMatch({ chars: [a, 'kenzo'], stage: 'grid', practice: { dummy: 'stand' }, cpu: [false, true], showVs: false }); }, [id]);
  await page.waitForTimeout(400);
  await page.evaluate(([inp]) => { __app.debugStep(90, {}, {}); const f = __app.match.fighters; f[0].x = -1.3; f[1].x = 1.3; __app.debugStep(6, {}, {}); __app.debugStep(2, inp, {}); __app.debugStep(30, {}, {}); }, [inp]);
  const st = await page.evaluate(() => { const f = __app.match.fighters[0]; return [f.state, f.stance]; });
  await page.screenshot({ path: `${out}/${id}.png` });
  console.log(id, cmd, JSON.stringify(st));
}
await browser.close();
