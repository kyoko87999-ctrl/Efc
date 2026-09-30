// Cinematic sweep: node tools/cine.mjs <kind: ra|hs|th13|th24> [charIds comma list] [outdir]
// Triggers a Rage Art / Heat Smash / throw on a standing dummy and saves a strip of frames per character.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { resolve } from 'node:path';
const kind = process.argv[2] || 'ra';
const chars = (process.argv[3] && process.argv[3] !== 'all' ? process.argv[3] : 'kenzo,tawan,meilan,jaeho,marcus,bruno,luna,kage,ironclad,asura').split(',');
const out = process.argv[4] || '/tmp/claude-0/-home-user-Efc/519c67b6-6fef-5d28-907c-7a7105e2f7dd/scratchpad/cine';
import { mkdirSync } from 'node:fs';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 960, height: 540 }, reducedMotion: 'reduce' })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('file://' + resolve('dist/efc.html'));
await page.waitForTimeout(1000);
const STEPS = { ra: [3, 10, 10, 12, 14, 16, 18, 26], hs: [3, 8, 8, 10, 12, 14, 18, 24], th13: [3, 6, 8, 10, 12, 14, 18, 24], th24: [3, 6, 8, 10, 12, 14, 18, 24] };
for (const id of chars) {
  const opp = id === 'marcus' ? 'bruno' : 'marcus';
  await page.evaluate(([a, b]) => { __app.ui.clear(); __app.startMatch({ chars: [a, b], stage: 'grid', practice: { dummy: 'stand' }, cpu: [false, true], showVs: false }); }, [id, opp]);
  await page.waitForTimeout(500);
  await page.evaluate(([kind]) => {
    __app.practiceApply('infRage', true); __app.practiceApply('infHeat', true);
    __app.debugStep(80, {}, {});
    const f = __app.match.fighters; f[0].x = -0.62; f[1].x = 0.62; f[0].z = 0; f[1].z = 0;
    if (kind === 'hs') { f[0].heat.on = true; f[0].heat.t = 500; f[0].heat.avail = false; }
    __app.debugStep(20, {}, {});
  }, [kind]);
  const input = { ra: { b1: true, b2: true }, hs: { b2: true, b3: true }, th13: { b1: true, b3: true }, th24: { b2: true, b4: true } }[kind];
  const shots = [];
  await page.evaluate(([inp]) => { __app.debugStep(2, inp, {}); }, [input]);
  let n = 0;
  for (const st of STEPS[kind]) {
    await page.evaluate(([n]) => { __app.debugStep(n, {}, {}); }, [st]);
    const f = `${out}/${kind}_${id}_${n++}.png`;
    await page.screenshot({ path: f });
    shots.push(f);
  }
  const info = await page.evaluate(() => __app.match.fighters.map((f) => [f.state, f.move && f.move.id, Math.round(f.hp)]));
  console.log(id, kind, JSON.stringify(info));
}
console.log('errors:', errors.length ? [...new Set(errors)].slice(0, 6) : 'none');
await browser.close();
