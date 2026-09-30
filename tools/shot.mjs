// Headless screenshot helper:  node tools/shot.mjs <file.html> <out.png> [--wait=ms] [--js="code"] [--w=1280] [--h=720] [--q=query]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const file = args[0], out = args[1];
const opt = Object.fromEntries(args.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=') || true]; }));
const W = +(opt.w || 1280), H = +(opt.h || 720);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '')));
await page.goto('file://' + resolve(file) + (opt.q ? '?' + opt.q : ''));
await page.waitForTimeout(+(opt.wait || 1500));
if (opt.js) { const r = await page.evaluate(opt.js); if (r !== undefined) console.log('js result:', JSON.stringify(r)); await page.waitForTimeout(+(opt.wait2 || 500)); }
await page.screenshot({ path: out });
if (errors.length) console.log(errors.slice(0, 15).join('\n'));
console.log('saved', out);
await browser.close();
