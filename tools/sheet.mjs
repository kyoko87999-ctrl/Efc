// node tools/sheet.mjs out.png '<json cells>' ['{"cam":[..]}']
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { resolve } from 'node:path';
const [out, cellsJson, optsJson] = process.argv.slice(2);
const W = +(process.env.W || 1400), H = +(process.env.H || 520);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message + '\n' + e.stack));
await page.goto('file://' + resolve('dist/debug.html'));
await page.waitForTimeout(800);
await page.evaluate(([c, o]) => window.sheet(JSON.parse(c), o ? JSON.parse(o) : {}), [cellsJson, optsJson]);
await page.waitForTimeout(400);
await page.screenshot({ path: out });
if (errors.length) console.log(errors.slice(0, 10).join('\n'));
console.log('saved', out);
await browser.close();
